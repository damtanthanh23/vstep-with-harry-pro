import { doc, onSnapshot } from 'firebase/firestore';
import { db, safeSetDoc } from '../firebase';
import { TestMetadata, isDraftTest } from '../types/exam';

export const DEFAULT_EXAM_TAGS = [
  'Đề thi minh họa',
  'Đề Nháp',
  'Đề thi thật',
] as const;

export const DEFAULT_EXAM_CATEGORIES = DEFAULT_EXAM_TAGS;

const CUSTOM_TAGS_STORAGE_KEY = 'langcert_custom_exam_tags_v1';
export const EXAM_TAGS_UPDATED_EVENT = 'langcert:exam-tags-updated';

export function getCustomExamTags(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .map((t) => String(t || '').trim())
          .filter(
            (t) =>
              t.length > 0 &&
              !DEFAULT_EXAM_TAGS.includes(t as (typeof DEFAULT_EXAM_TAGS)[number])
          )
      )
    );
  } catch {
    return [];
  }
}

export function getAllExamCategoryTags(includeDraftTag = true): string[] {
  const custom = getCustomExamTags();
  const base = includeDraftTag
    ? [...DEFAULT_EXAM_TAGS]
    : DEFAULT_EXAM_TAGS.filter((t) => t !== 'Đề Nháp');
  return [...base, ...custom];
}

export function getAllExamCategories(
  customTags?: string[],
  tests?: TestMetadata[],
  includeDraftTag = true
): string[] {
  const base = includeDraftTag
    ? [...DEFAULT_EXAM_TAGS]
    : DEFAULT_EXAM_TAGS.filter((t) => t !== 'Đề Nháp');
  const fromCustom = customTags || getCustomExamTags();
  const fromTests = (tests || [])
    .map((t) => (t.categoryTag || '').trim())
    .filter((tag) => tag.length > 0 && (includeDraftTag || tag !== 'Đề Nháp'));

  return Array.from(new Set([...base, ...fromCustom, ...fromTests]));
}

export function getEffectiveTestCategory(test: TestMetadata): string {
  if (isDraftTest(test)) {
    return test.categoryTag && test.categoryTag.trim().length > 0
      ? test.categoryTag.trim()
      : 'Đề Nháp';
  }
  if (test.categoryTag && test.categoryTag.trim().length > 0) {
    return test.categoryTag.trim();
  }
  const numMatch = test.id.match(/test-(\d+)/);
  if (numMatch) {
    const num = Number(numMatch[1]);
    return num <= 3 ? 'Đề thi minh họa' : 'Đề thi thật';
  }
  return 'Đề thi minh họa';
}

function broadcastTagsUpdate(customTags: string[]) {
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(customTags));
  } catch {
    // Ignore storage quota
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(EXAM_TAGS_UPDATED_EVENT, { detail: customTags })
    );
  }
}

export async function addCustomExamTag(tagName: string): Promise<string[]> {
  const clean = tagName.trim();
  if (!clean) return getCustomExamTags();
  if (DEFAULT_EXAM_TAGS.includes(clean as (typeof DEFAULT_EXAM_TAGS)[number])) {
    return getCustomExamTags();
  }

  const existing = getCustomExamTags();
  if (existing.includes(clean)) return existing;

  const updated = [...existing, clean];
  broadcastTagsUpdate(updated);

  const ref = doc(db, 'settings', 'exam_tags');
  await safeSetDoc(ref, { customTags: updated, updatedAt: Date.now() }, { merge: true });

  return updated;
}

export async function renameCustomExamTag(
  oldTag: string,
  newTag: string
): Promise<string[]> {
  const cleanNew = newTag.trim();
  if (!cleanNew || oldTag === cleanNew) return getCustomExamTags();

  const existing = getCustomExamTags();
  const updated = Array.from(
    new Set(
      existing
        .map((t) => (t === oldTag ? cleanNew : t))
        .filter(
          (t) =>
            t.length > 0 &&
            !DEFAULT_EXAM_TAGS.includes(t as (typeof DEFAULT_EXAM_TAGS)[number])
        )
    )
  );

  // If oldTag wasn't in existing yet and cleanNew isn't a default tag, add it
  if (
    !updated.includes(cleanNew) &&
    !DEFAULT_EXAM_TAGS.includes(cleanNew as (typeof DEFAULT_EXAM_TAGS)[number])
  ) {
    updated.push(cleanNew);
  }

  broadcastTagsUpdate(updated);

  const ref = doc(db, 'settings', 'exam_tags');
  await safeSetDoc(ref, { customTags: updated, updatedAt: Date.now() }, { merge: true });

  return updated;
}

export async function removeCustomExamTag(tagName: string): Promise<string[]> {
  const existing = getCustomExamTags();
  const updated = existing.filter((t) => t !== tagName);
  broadcastTagsUpdate(updated);

  const ref = doc(db, 'settings', 'exam_tags');
  await safeSetDoc(ref, { customTags: updated, updatedAt: Date.now() }, { merge: true });

  return updated;
}

export function subscribeToCustomExamTags(
  onUpdate: (customTags: string[]) => void
): () => void {
  const ref = doc(db, 'settings', 'exam_tags');
  const unsubFirestore = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { customTags?: string[] };
        if (Array.isArray(data.customTags)) {
          const sanitized = Array.from(
            new Set(
              data.customTags
                .map((t) => String(t || '').trim())
                .filter(
                  (t) =>
                    t.length > 0 &&
                    !DEFAULT_EXAM_TAGS.includes(t as (typeof DEFAULT_EXAM_TAGS)[number])
                )
            )
          );
          try {
            localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(sanitized));
          } catch {
            // Ignore
          }
          onUpdate(sanitized);
        }
      }
    },
    () => {
      // Ignore permission or network notice
    }
  );

  const handleLocalEvent = () => {
    onUpdate(getCustomExamTags());
  };

  if (typeof window !== 'undefined') {
    window.addEventListener(EXAM_TAGS_UPDATED_EVENT, handleLocalEvent);
  }

  return () => {
    unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener(EXAM_TAGS_UPDATED_EVENT, handleLocalEvent);
    }
  };
}
