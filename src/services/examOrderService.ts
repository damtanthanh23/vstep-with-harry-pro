import { doc, onSnapshot } from 'firebase/firestore';
import { db, safeSetDoc } from '../firebase';
import { TestMetadata, InProgressAttempt } from '../types/exam';

export type ExamSortMode =
  | 'custom'
  | 'title_asc'
  | 'title_desc'
  | 'newest'
  | 'uncompleted_first';

export type ExamViewMode = 'grid' | 'list';

export interface ExamOrderConfig {
  orderedTestIds: string[];
  pinnedTestIds: string[];
  updatedAt?: number;
}

const EXAM_ORDER_STORAGE_KEY = 'langcert_exam_order_config_v1';
const EXAM_VIEW_MODE_KEY = 'langcert_exam_view_mode_v1';
export const EXAM_ORDER_UPDATED_EVENT = 'langcert:exam-order-updated';

/**
 * Natural title comparison so "Test 1", "Test 2", "Test 10" sort in ascending numerical order.
 */
export function compareTestsNaturally(a: TestMetadata, b: TestMetadata): number {
  return (a.title || '').localeCompare(b.title || '', 'vi', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function getSavedExamViewMode(): ExamViewMode {
  try {
    const raw = localStorage.getItem(EXAM_VIEW_MODE_KEY);
    if (raw === 'list' || raw === 'grid') return raw;
  } catch {
    // Ignore
  }
  return 'grid';
}

export function saveExamViewMode(mode: ExamViewMode): void {
  try {
    localStorage.setItem(EXAM_VIEW_MODE_KEY, mode);
  } catch {
    // Ignore
  }
}

export function getLocalExamOrderConfig(): ExamOrderConfig {
  try {
    const raw = localStorage.getItem(EXAM_ORDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        orderedTestIds: Array.isArray(parsed?.orderedTestIds)
          ? parsed.orderedTestIds.map(String)
          : [],
        pinnedTestIds: Array.isArray(parsed?.pinnedTestIds)
          ? parsed.pinnedTestIds.map(String)
          : [],
        updatedAt: parsed?.updatedAt || 0,
      };
    }
  } catch {
    // Ignore
  }
  return { orderedTestIds: [], pinnedTestIds: [], updatedAt: 0 };
}

function broadcastExamOrderUpdate(config: ExamOrderConfig): void {
  try {
    localStorage.setItem(EXAM_ORDER_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EXAM_ORDER_UPDATED_EVENT, { detail: config })
    );
  }
}

/**
 * Persists the Admin's custom exam order & pinned exams to Cloud Firestore
 * (`settings/exam_tags` with merge: true so all students receive real-time updates).
 */
export async function saveExamOrderToCloud(
  orderedTestIds: string[],
  pinnedTestIds?: string[]
): Promise<ExamOrderConfig> {
  const current = getLocalExamOrderConfig();
  const cleanOrdered = Array.from(
    new Set(orderedTestIds.map((id) => String(id || '').trim()).filter(Boolean))
  );
  const cleanPinned = Array.from(
    new Set(
      (pinnedTestIds !== undefined ? pinnedTestIds : current.pinnedTestIds)
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );

  const nextConfig: ExamOrderConfig = {
    orderedTestIds: cleanOrdered,
    pinnedTestIds: cleanPinned,
    updatedAt: Date.now(),
  };

  broadcastExamOrderUpdate(nextConfig);

  const ref = doc(db, 'settings', 'exam_tags');
  await safeSetDoc(
    ref,
    {
      orderedTestIds: nextConfig.orderedTestIds,
      pinnedTestIds: nextConfig.pinnedTestIds,
      orderUpdatedAt: nextConfig.updatedAt,
    },
    { merge: true }
  );

  return nextConfig;
}

export async function togglePinTestOnCloud(
  testId: string,
  allCurrentTestIds: string[]
): Promise<ExamOrderConfig> {
  const current = getLocalExamOrderConfig();
  const pinnedSet = new Set(current.pinnedTestIds);
  if (pinnedSet.has(testId)) {
    pinnedSet.delete(testId);
  } else {
    pinnedSet.add(testId);
  }
  const baseOrder =
    current.orderedTestIds.length > 0 ? current.orderedTestIds : allCurrentTestIds;
  return saveExamOrderToCloud(baseOrder, Array.from(pinnedSet));
}

export function subscribeToExamOrderConfig(
  onUpdate: (config: ExamOrderConfig) => void
): () => void {
  const ref = doc(db, 'settings', 'exam_tags');
  const unsubFirestore = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as {
          orderedTestIds?: string[];
          pinnedTestIds?: string[];
          orderUpdatedAt?: number;
        };
        if (
          Array.isArray(data.orderedTestIds) ||
          Array.isArray(data.pinnedTestIds)
        ) {
          const nextConfig: ExamOrderConfig = {
            orderedTestIds: Array.isArray(data.orderedTestIds)
              ? data.orderedTestIds.map(String).filter(Boolean)
              : [],
            pinnedTestIds: Array.isArray(data.pinnedTestIds)
              ? data.pinnedTestIds.map(String).filter(Boolean)
              : [],
            updatedAt: data.orderUpdatedAt || Date.now(),
          };
          try {
            localStorage.setItem(
              EXAM_ORDER_STORAGE_KEY,
              JSON.stringify(nextConfig)
            );
          } catch {
            // Ignore
          }
          onUpdate(nextConfig);
        }
      }
    },
    () => {
      // Ignore permission or offline notice
    }
  );

  const handleLocalEvent = () => {
    onUpdate(getLocalExamOrderConfig());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(EXAM_ORDER_UPDATED_EVENT, handleLocalEvent);
  }

  return () => {
    unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener(EXAM_ORDER_UPDATED_EVENT, handleLocalEvent);
    }
  };
}

/**
 * Sorts a list of tests according to the active sortMode and Admin Cloud order config.
 * - In 'custom' mode: Pinned tests come first, then tests ordered by `orderedTestIds`,
 *   and any remaining tests are sorted naturally ("Test 1", "Test 2", "Test 3"...).
 */
export function sortTestsList(
  tests: TestMetadata[],
  orderConfig: ExamOrderConfig,
  sortMode: ExamSortMode,
  inProgressMap: Record<string, InProgressAttempt> = {},
  completedScoresMap: Record<string, number> = {}
): TestMetadata[] {
  const copy = [...tests];
  const pinnedSet = new Set(orderConfig.pinnedTestIds || []);
  const orderIndexMap = new Map<string, number>();
  (orderConfig.orderedTestIds || []).forEach((id, idx) => {
    orderIndexMap.set(id, idx);
  });

  copy.sort((a, b) => {
    // Pinned tests always stay at the top when in 'custom' mode
    if (sortMode === 'custom') {
      const aPinned = pinnedSet.has(a.id);
      const bPinned = pinnedSet.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const aIdx = orderIndexMap.get(a.id);
      const bIdx = orderIndexMap.get(b.id);
      if (aIdx !== undefined && bIdx !== undefined) {
        return aIdx - bIdx;
      }
      if (aIdx !== undefined) return -1;
      if (bIdx !== undefined) return 1;

      // Fallback to natural ascending order (Test 1 -> Test 2 -> Test 3)
      return compareTestsNaturally(a, b);
    }

    if (sortMode === 'title_asc') {
      return compareTestsNaturally(a, b);
    }

    if (sortMode === 'title_desc') {
      return compareTestsNaturally(b, a);
    }

    if (sortMode === 'newest') {
      const aTime = a.updatedAt || a.createdAt || 0;
      const bTime = b.updatedAt || b.createdAt || 0;
      if (bTime !== aTime) return bTime - aTime;
      return compareTestsNaturally(a, b);
    }

    if (sortMode === 'uncompleted_first') {
      // Priority: 0 = In-progress, 1 = Not started, 2 = Completed
      const getRank = (t: TestMetadata) => {
        if (inProgressMap[t.id]) return 0;
        if (completedScoresMap[t.id] === undefined) return 1;
        return 2;
      };
      const rankDiff = getRank(a) - getRank(b);
      if (rankDiff !== 0) return rankDiff;
      return compareTestsNaturally(a, b);
    }

    return compareTestsNaturally(a, b);
  });

  return copy;
}
