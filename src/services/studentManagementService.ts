import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
} from 'firebase/firestore';
import { db, safeSetDoc, canWriteToFirestore } from '../firebase';
import {
  UserProfile,
  UserRole,
  UserExamAttempt,
  UserTargetScores,
  UserVocabStats,
  InProgressAttempt,
} from '../types/studentManagement';
import { TESTS_LIST } from '../data/testsList';

export const SUPER_ADMIN_EMAILS = [
  'damtanthanh23@gmail.com',
  'admin@gmail.com',
];

export const USER_DIRECTORY_BACKUP_KEY = 'langcert_user_directory_backup';

/**
 * Recursively removes undefined fields from an object to prevent Firestore errors
 */
export function sanitizeFirestoreData<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeFirestoreData(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = sanitizeFirestoreData(value);
      }
    }
    return clean as T;
  }
  return obj;
}

/**
 * Safe test title resolver that guarantees a non-null string
 * and prevents runtime errors like undefined.replace()
 */
export function resolveTestTitle(
  testId?: string,
  rawTitle?: string,
  extraTestsList?: Array<{ id: string; title: string }>
): string {
  if (typeof rawTitle === 'string' && rawTitle.trim().length > 0) {
    return rawTitle.trim();
  }
  if (!testId) {
    return 'Bài thi VSTEP B1-B2-C1';
  }

  if (extraTestsList && extraTestsList.length > 0) {
    const found = extraTestsList.find((t) => t.id === testId);
    if (found && typeof found.title === 'string' && found.title.trim().length > 0) {
      return found.title.trim();
    }
  }

  const staticMatch = TESTS_LIST.find((t) => t.id === testId);
  if (staticMatch && typeof staticMatch.title === 'string') {
    return staticMatch.title.trim();
  }

  // Format ID safely
  return `VSTEP — ${testId.replace(/[_-]/g, ' ').toUpperCase()}`;
}

/**
 * Checks whether a user is currently considered online (active in last 5 minutes or current user)
 */
export function isUserOnline(student: UserProfile, currentUid?: string): boolean {
  if (currentUid && student.uid === currentUid) return true;
  if (!student.lastActiveAt) return false;
  return Date.now() - student.lastActiveAt <= 5 * 60 * 1000;
}

/**
 * Formats relative active time in Vietnamese (e.g., "Vừa xong", "15 phút trước", "Hôm qua")
 */
export function formatRelativeActiveTime(timestamp?: number): string {
  if (!timestamp) return 'Chưa có hoạt động';
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'Vừa xong';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Vừa xong';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return new Date(timestamp).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Real-time subscription to the users collection with local storage backup
 */
export function subscribeToStudentDirectory(
  onUpdate: (students: UserProfile[]) => void,
  onError?: (err: any) => void
): () => void {
  const usersCol = collection(db, 'users');

  const unsub = onSnapshot(
    usersCol,
    (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as UserProfile;
        list.push({ ...data, uid: d.id });
      });

      // Save to local backup
      try {
        localStorage.setItem(USER_DIRECTORY_BACKUP_KEY, JSON.stringify(list));
      } catch {
        // ignore storage errors
      }

      onUpdate(list);
    },
    async (err) => {
      console.warn('Real-time student snapshot listener error, trying fallback:', err);
      if (onError) onError(err);

      // Attempt single fetch fallback
      try {
        const snap = await getDocs(usersCol);
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          const data = d.data() as UserProfile;
          list.push({ ...data, uid: d.id });
        });
        if (list.length > 0) {
          try {
            localStorage.setItem(USER_DIRECTORY_BACKUP_KEY, JSON.stringify(list));
          } catch {
            // Ignore
          }
          onUpdate(list);
          return;
        }
      } catch (fetchErr) {
        console.warn('Direct getDocs fallback failed:', fetchErr);
      }

      // Read local cache if offline
      try {
        const cached = localStorage.getItem(USER_DIRECTORY_BACKUP_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            onUpdate(parsed);
          }
        }
      } catch {
        // Ignore
      }
    }
  );

  return unsub;
}

/**
 * Real-time subscription to student attempts subcollection
 */
export function subscribeToStudentAttempts(
  uid: string,
  onUpdate: (attempts: UserExamAttempt[]) => void,
  onError?: (err: any) => void
): () => void {
  // Read local backup first for snappy load
  const localCacheKey = `langcert_attempts_${uid}`;
  try {
    const cached = localStorage.getItem(localCacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate(parsed);
      }
    }
  } catch {
    // Ignore
  }

  const attemptsCol = collection(db, 'users', uid, 'attempts');
  const q = query(attemptsCol, orderBy('completedAt', 'desc'));

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list: UserExamAttempt[] = [];
      snap.forEach((d) => {
        list.push({ ...(d.data() as UserExamAttempt), attemptId: d.id });
      });

      try {
        localStorage.setItem(localCacheKey, JSON.stringify(list.slice(0, 100)));
      } catch {
        // Ignore
      }

      onUpdate(list);
    },
    (err) => {
      console.warn(`Real-time attempts error for ${uid}:`, err);
      if (onError) onError(err);
    }
  );

  return unsub;
}

/**
 * Fetch all in-progress attempts for a student
 */
export async function fetchStudentInProgressMap(
  uid: string
): Promise<Record<string, InProgressAttempt>> {
  try {
    const colRef = collection(db, 'users', uid, 'inProgress');
    const snap = await getDocs(colRef);
    const map: Record<string, InProgressAttempt> = {};
    snap.forEach((d) => {
      const data = d.data() as InProgressAttempt;
      if (data && (data.testId || d.id)) {
        map[data.testId || d.id] = data;
      }
    });
    return map;
  } catch (err) {
    console.warn(`Lỗi lấy bài thi đang dở của học viên ${uid}:`, err);
    return {};
  }
}

/**
 * Updates a student's role directly in Firestore
 */
export async function updateStudentRole(
  targetUid: string,
  newRole: UserRole,
  actorEmail?: string
): Promise<void> {
  const targetDocRef = doc(db, 'users', targetUid);
  const payload = sanitizeFirestoreData({
    role: newRole,
    assignedBy: actorEmail || 'admin',
    updatedAt: Date.now(),
  });
  await safeSetDoc(targetDocRef, payload, { merge: true });
}

/**
 * Updates target scores for a student
 */
export async function updateStudentTargetScores(
  uid: string,
  targetScores: UserTargetScores
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await safeSetDoc(
    userRef,
    sanitizeFirestoreData({
      targetScores: {
        ...targetScores,
        updatedAt: Date.now(),
      },
    }),
    { merge: true }
  );
}

/**
 * Records heartbeat ping to keep lastActiveAt fresh
 */
export async function recordStudentHeartbeat(uid: string): Promise<void> {
  if (!canWriteToFirestore() || !uid) return;
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { lastActiveAt: Date.now() }, { merge: true });
  } catch {
    // Ignore heartbeat errors quietly
  }
}

/**
 * 3 Realistic Demo Students with complete Mock Data for presentation & testing
 */
export const DEMO_STUDENTS: UserProfile[] = [
  {
    uid: 'demo_student_1',
    displayName: 'Nguyễn Thu Trang',
    nickname: 'Trang Candy',
    email: 'thutrang.nguyen@example.com',
    phone: '0983 124 567',
    birthDate: '2001-05-14',
    address: 'Cầu Giấy, Hà Nội',
    photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    targetScores: {
      overall: 7.0,
      listening: 7.0,
      reading: 7.5,
      writing: 6.5,
      speaking: 7.0,
      updatedAt: Date.now() - 86400000 * 2,
    },
    vocabStats: {
      totalWords: 340,
      masteredCount: 198,
      learningCount: 112,
      totalDecks: 7,
      lastStudiedDeckName: '15 Chủ đề chuẩn B1 — Daily Life & Routines',
      lastStudiedAt: Date.now() - 1000 * 60 * 35,
      decks: [
        {
          id: 'b1_daily_life',
          name: 'Chủ đề 1: Daily Life & Routines',
          categoryLabel: '15 Chủ đề chuẩn B1',
          totalWords: 50,
          masteredWords: 42,
          learningWords: 8,
          updatedAt: Date.now() - 1000 * 60 * 35,
        },
        {
          id: 'b1_education',
          name: 'Chủ đề 2: Education & Careers',
          categoryLabel: '15 Chủ đề chuẩn B1',
          totalWords: 60,
          masteredWords: 38,
          learningWords: 18,
          updatedAt: Date.now() - 86400000,
        },
        {
          id: 'test_1_vocab',
          name: 'Từ vựng trọng tâm — Test 1',
          categoryLabel: 'Từ vựng theo Đề thi',
          totalWords: 45,
          masteredWords: 35,
          learningWords: 7,
          updatedAt: Date.now() - 86400000 * 3,
        },
      ],
      updatedAt: Date.now() - 1000 * 60 * 35,
    },
    createdAt: Date.now() - 86400000 * 45,
    lastLoginAt: Date.now() - 1000 * 60 * 40,
    lastActiveAt: Date.now() - 1000 * 60 * 2, // ONLINE NOW!
  },
  {
    uid: 'demo_student_2',
    displayName: 'Trần Minh Hoàng',
    nickname: 'Hoàng Master',
    email: 'hoang.tran99@example.com',
    phone: '0912 345 678',
    birthDate: '1999-08-22',
    address: 'Quận 1, TP. Hồ Chí Minh',
    photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    role: 'student',
    targetScores: {
      overall: 8.0,
      listening: 8.5,
      reading: 8.0,
      writing: 7.5,
      speaking: 8.0,
      updatedAt: Date.now() - 86400000 * 5,
    },
    vocabStats: {
      totalWords: 420,
      masteredCount: 280,
      learningCount: 110,
      totalDecks: 9,
      lastStudiedDeckName: 'Từ vựng học thuật C1 — Environmental Issues',
      lastStudiedAt: Date.now() - 86400000 * 1.5,
      decks: [
        {
          id: 'b1_environment',
          name: 'Chủ đề 5: Environment & Climate',
          categoryLabel: '15 Chủ đề chuẩn B1',
          totalWords: 55,
          masteredWords: 48,
          learningWords: 5,
          updatedAt: Date.now() - 86400000 * 1.5,
        },
        {
          id: 'b1_travel',
          name: 'Chủ đề 3: Travel & Tourism',
          categoryLabel: '15 Chủ đề chuẩn B1',
          totalWords: 48,
          masteredWords: 42,
          learningWords: 4,
          updatedAt: Date.now() - 86400000 * 4,
        },
      ],
      updatedAt: Date.now() - 86400000 * 1.5,
    },
    createdAt: Date.now() - 86400000 * 60,
    lastLoginAt: Date.now() - 86400000 * 1.5,
    lastActiveAt: Date.now() - 1000 * 60 * 45, // Active 45 mins ago
  },
  {
    uid: 'demo_student_3',
    displayName: 'Lê Thảo My',
    nickname: 'My Trợ Giảng',
    email: 'thaomy.ta@example.com',
    phone: '0977 888 999',
    birthDate: '2000-11-03',
    address: 'Đống Đa, Hà Nội',
    photoURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    role: 'co_teacher',
    targetScores: {
      overall: 8.5,
      listening: 9.0,
      reading: 8.5,
      writing: 8.0,
      speaking: 8.5,
      updatedAt: Date.now() - 86400000 * 10,
    },
    vocabStats: {
      totalWords: 680,
      masteredCount: 590,
      learningCount: 65,
      totalDecks: 14,
      lastStudiedDeckName: 'Bộ từ vựng Chuyên sâu VSTEP B2-C1',
      lastStudiedAt: Date.now() - 1000 * 60 * 12,
      decks: [
        {
          id: 'c1_academic',
          name: 'VSTEP C1 Idioms & Collocations',
          categoryLabel: 'Bộ từ cá nhân',
          totalWords: 120,
          masteredWords: 112,
          learningWords: 5,
          updatedAt: Date.now() - 1000 * 60 * 12,
        },
      ],
      updatedAt: Date.now() - 1000 * 60 * 12,
    },
    createdAt: Date.now() - 86400000 * 90,
    lastLoginAt: Date.now() - 1000 * 60 * 15,
    lastActiveAt: Date.now() - 1000 * 60 * 3, // ONLINE NOW!
  },
];

/**
 * Mock exam attempts for demo students
 */
export const DEMO_ATTEMPTS: Record<string, UserExamAttempt[]> = {
  demo_student_1: [
    {
      attemptId: 'demo_att_101',
      testId: 'vstep_test_1',
      testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
      mode: 'exam',
      score: 58,
      totalQuestions: 75,
      percentage: 77.3,
      vstepBandScore: 7.0,
      grade: 'High Pass',
      listeningScore: 27, // out of 35
      readingScore: 31,   // out of 40
      writingScore: 7.0,
      speakingScore: 7.0,
      timeSpentSeconds: 9850,
      completedAt: Date.now() - 86400000 * 2,
      answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'A', 5: 'D', 9: 'B', 10: 'C', 11: 'A', 12: 'D', 36: 'B', 37: 'C', 38: 'A', 39: 'D' },
      writingSubmission: {
        task1Text: 'Dear Uncle Hung,\n\nI was delighted to receive your email inquiring about An. He is a diligent and respectful young man who loves reading and playing badminton. He keeps his living space clean and is very considerate of others. I am confident he will fit into your family warmly.\n\nBest regards,\nTrang',
        task2Text: 'Traffic congestion has become one of the most critical issues in modern metropolises. In my opinion, limiting roadway encroachment and upgrading public transit are essential steps toward sustainable urban mobility...',
        task1WordCount: 135,
        task2WordCount: 268,
      },
      speakingSubmission: {
        part1Transcript: 'I enjoy swimming and reading literature in my spare time. My neighborhood is peaceful and has a great sense of community.',
        part2Transcript: 'I would choose travelling by train because it is scenic, safe, and cost-effective compared to flight and coach.',
        part3Transcript: 'Travelling offers extensive cognitive and emotional benefits. It helps open our minds, creates enduring friendships, and provides deep mental relaxation.',
        overallBand: 7.0,
      },
    },
    {
      attemptId: 'demo_att_102',
      testId: 'vstep_test_2',
      testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 2',
      mode: 'practice',
      score: 29,
      totalQuestions: 35,
      percentage: 82.8,
      vstepBandScore: 7.5,
      grade: 'High Pass',
      listeningScore: 29,
      timeSpentSeconds: 2240,
      completedAt: Date.now() - 86400000 * 6,
      answers: { 1: 'A', 2: 'C', 3: 'B', 4: 'B', 5: 'A', 6: 'C', 7: 'D', 8: 'A' },
    },
  ],
  demo_student_2: [
    {
      attemptId: 'demo_att_201',
      testId: 'vstep_test_1',
      testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
      mode: 'exam',
      score: 66,
      totalQuestions: 75,
      percentage: 88.0,
      vstepBandScore: 8.5,
      grade: 'High Pass',
      listeningScore: 32,
      readingScore: 34,
      writingScore: 8.0,
      speakingScore: 8.5,
      timeSpentSeconds: 9600,
      completedAt: Date.now() - 86400000 * 4,
      writingSubmission: {
        task1Text: 'Dear Mr. Hung,\n\nI am writing to provide detailed insights regarding An. He is an exceptionally disciplined student with strong interpersonal skills...',
        task2Text: 'Urban infrastructure expansion requires balanced governmental policies. Mass rapid transit networks significantly curtail greenhouse gas emissions...',
        task1WordCount: 148,
        task2WordCount: 295,
      },
    },
  ],
  demo_student_3: [
    {
      attemptId: 'demo_att_301',
      testId: 'vstep_test_1',
      testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
      mode: 'exam',
      score: 71,
      totalQuestions: 75,
      percentage: 94.6,
      vstepBandScore: 9.0,
      grade: 'High Pass',
      listeningScore: 34,
      readingScore: 37,
      writingScore: 8.5,
      speakingScore: 9.0,
      timeSpentSeconds: 9200,
      completedAt: Date.now() - 86400000 * 10,
    },
  ],
};

/**
 * Mock in-progress attempt for demo students
 */
export const DEMO_IN_PROGRESS: Record<string, InProgressAttempt> = {
  demo_student_1: {
    testId: 'vstep_test_3',
    testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 3',
    mode: 'exam',
    startedAt: Date.now() - 1000 * 60 * 35,
    lastUpdatedAt: Date.now() - 1000 * 60 * 2,
    elapsedSeconds: 2100,
    remainingSeconds: 8220,
    currentPart: 'R2',
    answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'A', 5: 'B', 9: 'D', 10: 'A', 36: 'C', 37: 'B', 38: 'A' },
    flaggedQuestions: [3, 10],
    writingDraft: {
      task1Text: 'Dear Mr. Johnson, I am writing to express my appreciation...',
      task2Text: '',
      task1WordCount: 42,
      task2WordCount: 0,
    },
  },
  demo_student_2: {
    testId: 'vstep_test_2',
    testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 2',
    mode: 'practice',
    startedAt: Date.now() - 1000 * 60 * 50,
    lastUpdatedAt: Date.now() - 1000 * 60 * 45,
    elapsedSeconds: 1200,
    answers: { 1: 'C', 2: 'A', 3: 'D', 4: 'B' },
  },
};
