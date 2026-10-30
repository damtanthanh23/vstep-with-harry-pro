import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import {
  db,
  auth,
  safeSetDoc,
  safeDeleteDoc,
  canWriteToFirestore,
} from '../firebase';

export type FeedbackCategory =
  | 'question_error'
  | 'audio_media'
  | 'answer_explanation'
  | 'ui_issue'
  | 'general_suggestion';

export type FeedbackStatus = 'unread' | 'read' | 'unresolved' | 'resolved';

export interface FeedbackReport {
  id: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  category: FeedbackCategory;
  message: string;
  contextScreen?: string;
  testId?: string;
  testTitle?: string;
  section?: string;
  partNumber?: number;
  questionNumber?: number;
  status: FeedbackStatus;
  adminNote?: string;
  createdAt: number;
  updatedAt: number;
}

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  question_error: 'Lỗi nội dung câu hỏi / Đề bài',
  audio_media: 'Lỗi file Nghe (Audio) / Hình ảnh',
  answer_explanation: 'Lỗi Đáp án / Giải thích / Bằng chứng',
  ui_issue: 'Lỗi hiển thị / Giao diện / Thao tác',
  general_suggestion: 'Góp ý tính năng / Đề xuất cải thiện',
};

export const FEEDBACK_STATUS_META: Record<
  FeedbackStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  unread: {
    label: 'Chưa đọc',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  read: {
    label: 'Đã đọc',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClass: 'bg-sky-500',
  },
  unresolved: {
    label: 'Chưa giải quyết',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  resolved: {
    label: 'Đã giải quyết',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-[#58CC02]',
  },
};

const LOCAL_FEEDBACK_STORAGE_KEY = 'langcert_b1_feedback_reports_v1';

function loadLocalFeedbacks(): FeedbackReport[] {
  try {
    const raw = localStorage.getItem(LOCAL_FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalFeedbacks(items: FeedbackReport[]) {
  try {
    localStorage.setItem(LOCAL_FEEDBACK_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('langcert-feedback-updated'));
  } catch {
    // ignore storage quota errors
  }
}

function mergeFeedbackLists(remote: FeedbackReport[], local: FeedbackReport[]): FeedbackReport[] {
  const map = new Map<string, FeedbackReport>();
  for (const item of local) {
    map.set(item.id, item);
  }
  for (const item of remote) {
    const existing = map.get(item.id);
    if (!existing || item.updatedAt >= existing.updatedAt) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export async function submitFeedbackReport(input: {
  userName: string;
  userEmail?: string;
  category: FeedbackCategory;
  message: string;
  contextScreen?: string;
  testId?: string;
  testTitle?: string;
  section?: string;
  partNumber?: number;
  questionNumber?: number;
}): Promise<FeedbackReport> {
  const now = Date.now();
  const id = `fb_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const currentUser = auth.currentUser;

  const report: FeedbackReport = {
    id,
    userId: currentUser?.uid || 'guest',
    userName: input.userName.trim() || currentUser?.displayName || 'Học viên LanguageCert',
    userEmail: input.userEmail?.trim() || currentUser?.email || '',
    category: input.category,
    message: input.message.trim(),
    contextScreen: input.contextScreen || 'landing',
    ...(input.testId ? { testId: input.testId } : {}),
    ...(input.testTitle ? { testTitle: input.testTitle } : {}),
    ...(input.section ? { section: input.section } : {}),
    ...(typeof input.partNumber === 'number' ? { partNumber: input.partNumber } : {}),
    ...(typeof input.questionNumber === 'number' ? { questionNumber: input.questionNumber } : {}),
    status: 'unread',
    adminNote: '',
    createdAt: now,
    updatedAt: now,
  };

  // Always save locally immediately for instant resilience
  const localList = loadLocalFeedbacks();
  saveLocalFeedbacks([report, ...localList]);

  await safeSetDoc(doc(db, 'feedbacks', id), report as unknown as Record<string, unknown>);

  return report;
}

export function subscribeToFeedbackReports(
  onUpdate: (reports: FeedbackReport[]) => void
): () => void {
  let latestRemote: FeedbackReport[] = [];

  const emitMerged = () => {
    const local = loadLocalFeedbacks();
    onUpdate(mergeFeedbackLists(latestRemote, local));
  };

  // Emit initial local state right away
  emitMerged();

  const handleLocalEvent = () => emitMerged();
  window.addEventListener('langcert-feedback-updated', handleLocalEvent);

  const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
  const unsubscribeFirestore = onSnapshot(
    q,
    (snapshot) => {
      latestRemote = snapshot.docs.map((d) => d.data() as FeedbackReport);
      saveLocalFeedbacks(mergeFeedbackLists(latestRemote, loadLocalFeedbacks()));
      emitMerged();
    },
    () => {
      // If user is not Admin or offline, gracefully fall back to local list
      emitMerged();
    }
  );

  return () => {
    window.removeEventListener('langcert-feedback-updated', handleLocalEvent);
    unsubscribeFirestore();
  };
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  adminNote?: string
): Promise<void> {
  const now = Date.now();
  const local = loadLocalFeedbacks().map((item) =>
    item.id === feedbackId
      ? {
          ...item,
          status,
          ...(adminNote !== undefined ? { adminNote } : {}),
          updatedAt: now,
        }
      : item
  );
  saveLocalFeedbacks(local);

  const payload: Record<string, unknown> = {
    status,
    updatedAt: now,
  };
  if (adminNote !== undefined) {
    payload.adminNote = adminNote;
  }
  await safeSetDoc(doc(db, 'feedbacks', feedbackId), payload, { merge: true });
}

export async function markAllFeedbacksAsRead(reports: FeedbackReport[]): Promise<void> {
  const now = Date.now();
  const unreadItems = reports.filter((r) => r.status === 'unread');
  if (unreadItems.length === 0) return;

  const updatedLocal = loadLocalFeedbacks().map((item) =>
    item.status === 'unread' ? { ...item, status: 'read' as FeedbackStatus, updatedAt: now } : item
  );
  saveLocalFeedbacks(updatedLocal);

  if (!canWriteToFirestore()) return;

  await Promise.all(
    unreadItems.map((item) =>
      safeSetDoc(
        doc(db, 'feedbacks', item.id),
        { status: 'read', updatedAt: now },
        { merge: true }
      )
    )
  );
}

export async function deleteFeedbackReport(feedbackId: string): Promise<void> {
  const filtered = loadLocalFeedbacks().filter((item) => item.id !== feedbackId);
  saveLocalFeedbacks(filtered);

  await safeDeleteDoc(doc(db, 'feedbacks', feedbackId));
}
