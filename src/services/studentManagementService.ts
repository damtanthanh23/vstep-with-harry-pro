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
  UserActiveDraftSummary,
  InProgressAttempt,
  GuestSubmission,
} from '../types/studentManagement';
import { TESTS_LIST } from '../data/testsList';
import { TEST_1_QUESTIONS } from '../data/test1Data';
import { Question } from '../types/exam';
import { hydrateQuestionsFromStorage } from './examService';
import { computeVocabStatsFromPartition } from './vocabCloudService';
import { UserVocabDeck, UserVocabFolder } from '../types/vocab';
import { generateDefault15TopicDecks } from '../data/b1Official15TopicsData';

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
 * Formats exact timestamp as "HH:mm DD/MM/YYYY" (e.g. "10:22 01/11/2026")
 */
export function formatExactLoginTimestamp(timestamp?: number): string {
  if (!timestamp || timestamp <= 0) return 'Chưa ghi nhận';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return 'Chưa ghi nhận';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hh}:${mm} ${day}/${month}/${year}`;
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

// Track UIDs already enriched in this session to avoid redundant subcollection reads
const enrichedStudentUids = new Set<string>();
const enrichedCacheByUid = new Map<string, Partial<UserProfile>>();

export async function enrichStudentsFromSubcollections(
  students: UserProfile[],
  onEnriched: (updatedList: UserProfile[]) => void,
  forceRefresh: boolean = false
): Promise<void> {
  if (forceRefresh) {
    enrichedStudentUids.clear();
    enrichedCacheByUid.clear();
  }

  const candidates = students.filter(
    (s) =>
      s.uid &&
      !s.uid.startsWith('demo_') &&
      (forceRefresh || !enrichedStudentUids.has(s.uid)) &&
      (forceRefresh ||
        s.totalExamAttempts === undefined ||
        s.totalExamAttempts === 0 ||
        s.activeDraftSummary === undefined ||
        !s.vocabStats)
  );

  if (candidates.length === 0) return;

  let anyChanged = false;

  await Promise.all(
    candidates.map(async (st) => {
      enrichedStudentUids.add(st.uid);
      const patch: Partial<UserProfile> = {};
      const firestorePatch: Record<string, any> = {};

      // 1. Check attempts subcollection if totalExamAttempts is missing, 0, or forced
      if (st.totalExamAttempts === undefined || st.totalExamAttempts === 0 || forceRefresh) {
        try {
          const attSnap = await getDocs(collection(db, 'users', st.uid, 'attempts'));
          if (attSnap.size > 0) {
            let bestBand = 0;
            let bestRaw = 0;
            let latestAt = 0;
            let latestTitle = 'Bài thi VSTEP';
            attSnap.forEach((docSnap) => {
              const att = docSnap.data() as UserExamAttempt;
              const raw = Number(att.score) || 0;
              const tot = Number(att.totalQuestions) || 75;
              const band =
                typeof att.vstepBandScore === 'number' && att.vstepBandScore > 0
                  ? att.vstepBandScore
                  : Math.round(((raw / Math.max(1, tot)) * 10) * 2) / 2;
              if (band > bestBand) bestBand = band;
              if (raw > bestRaw) bestRaw = raw;
              if ((att.completedAt || 0) >= latestAt) {
                latestAt = att.completedAt || Date.now();
                latestTitle = resolveTestTitle(att.testId, att.testTitle);
              }
            });
            patch.totalExamAttempts = attSnap.size;
            patch.bestVstepBandScore = bestBand;
            patch.bestRawScore = bestRaw;
            patch.lastAttemptAt = latestAt;
            patch.lastTestTitle = latestTitle;
            Object.assign(firestorePatch, {
              totalExamAttempts: attSnap.size,
              bestVstepBandScore: bestBand,
              bestRawScore: bestRaw,
              lastAttemptAt: latestAt,
              lastTestTitle: latestTitle,
            });
            anyChanged = true;
          } else {
            patch.totalExamAttempts = 0;
          }
        } catch (err) {
          console.warn(`Could not read attempts subcollection for ${st.uid}:`, err);
        }
      }

      // 2. Check inProgress subcollection if activeDraftSummary is missing or forced
      if (st.activeDraftSummary === undefined || forceRefresh) {
        try {
          const inProgSnap = await getDocs(collection(db, 'users', st.uid, 'inProgress'));
          if (inProgSnap.size > 0) {
            const drafts: InProgressAttempt[] = [];
            inProgSnap.forEach((d) => {
              const data = d.data() as InProgressAttempt;
              if (data) drafts.push({ ...data, testId: data.testId || d.id });
            });
            drafts.sort(
              (a, b) =>
                (b.savedAt || b.lastUpdatedAt || 0) - (a.savedAt || a.lastUpdatedAt || 0)
            );
            const latest = drafts[0];
            if (latest) {
              const answeredCount = Object.values(latest.answers || {}).filter(
                (v) => v && String(v).trim().length > 0
              ).length;
              const writingWords =
                (latest.writingDraft?.task1WordCount || 0) +
                (latest.writingDraft?.task2WordCount || 0);
              const speakingWords =
                (latest.speakingDraft?.part1Text
                  ? latest.speakingDraft.part1Text.trim().split(/\s+/).filter(Boolean).length
                  : 0) +
                (latest.speakingDraft?.part2Text
                  ? latest.speakingDraft.part2Text.trim().split(/\s+/).filter(Boolean).length
                  : 0) +
                (latest.speakingDraft?.part3Text
                  ? latest.speakingDraft.part3Text.trim().split(/\s+/).filter(Boolean).length
                  : 0);
              const summary: UserActiveDraftSummary = {
                testId: latest.testId,
                testTitle: resolveTestTitle(latest.testId, latest.testTitle),
                mode: latest.mode || 'exam',
                answeredCount,
                totalQuestions: 75,
                elapsedSeconds: latest.elapsedSeconds || 0,
                writingWordCount: writingWords > 0 ? writingWords : undefined,
                speakingWordCount: speakingWords > 0 ? speakingWords : undefined,
                updatedAt: latest.savedAt || latest.lastUpdatedAt || Date.now(),
              };
              patch.activeDraftSummary = summary;
              firestorePatch.activeDraftSummary = summary;
              anyChanged = true;
            }
          } else {
            patch.activeDraftSummary = null;
          }
        } catch {
          // Ignore
        }
      }

      // 3. Check vocab_state/main + vocab_decks if vocabStats is missing or forced
      if (!st.vocabStats || forceRefresh) {
        try {
          const [vocabSnap, personalDecksSnap] = await Promise.all([
            getDoc(doc(db, 'users', st.uid, 'vocab_state', 'main')),
            getDocs(collection(db, 'users', st.uid, 'vocab_decks')),
          ]);
          const personalDecks: UserVocabDeck[] = [];
          personalDecksSnap.forEach((d) => {
            personalDecks.push({ ...(d.data() as UserVocabDeck), id: d.id });
          });

          if (vocabSnap.exists() || personalDecks.length > 0) {
            const vData = vocabSnap.exists() ? vocabSnap.data() : {};
            const allDecks = [...generateDefault15TopicDecks(), ...personalDecks];
            const computedStats = computeVocabStatsFromPartition(vData, allDecks);
            computedStats.personalDecksCount = personalDecks.length;
            if (Array.isArray(vData?.personalFolders)) {
              computedStats.personalFoldersCount = vData.personalFolders.length;
            }
            if (
              computedStats.masteredCount > 0 ||
              computedStats.learningCount > 0 ||
              personalDecks.length > 0
            ) {
              patch.vocabStats = computedStats;
              firestorePatch.vocabStats = computedStats;
              anyChanged = true;
            }
          }
        } catch {
          // Ignore
        }
      }

      if (Object.keys(patch).length > 0) {
        enrichedCacheByUid.set(st.uid, {
          ...(enrichedCacheByUid.get(st.uid) || {}),
          ...patch,
        });
      }

      if (Object.keys(firestorePatch).length > 0 && canWriteToFirestore()) {
        try {
          await safeSetDoc(
            doc(db, 'users', st.uid),
            sanitizeFirestoreData(firestorePatch),
            { merge: true }
          );
        } catch {
          // Ignore backfill write notice
        }
      }
    })
  );

  if (anyChanged || forceRefresh) {
    const mergedList = students.map((s) => {
      const cached = enrichedCacheByUid.get(s.uid);
      return cached ? { ...s, ...cached } : s;
    });
    onEnriched(mergedList);
  }
}

/**
 * Deep scan and force-refresh all students from Cloud Firestore,
 * actively counting real attempts in users/{uid}/attempts and healing root summary stats.
 */
export async function forceRefreshAllStudentsFromCloud(): Promise<UserProfile[]> {
  enrichedStudentUids.clear();
  enrichedCacheByUid.clear();

  const usersCol = collection(db, 'users');
  const snap = await getDocs(usersCol);
  const list: UserProfile[] = [];

  snap.forEach((d) => {
    list.push({ ...(d.data() as UserProfile), uid: d.id });
  });

  // Deep enrich every real user
  await new Promise<void>((resolve) => {
    enrichStudentsFromSubcollections(
      list,
      (updated) => {
        list.length = 0;
        list.push(...updated);
        resolve();
      },
      true
    ).then(() => resolve());
  });

  const sorted = list.sort((a, b) => {
    if (a.email && SUPER_ADMIN_EMAILS.includes(a.email.toLowerCase())) return -1;
    if (b.email && SUPER_ADMIN_EMAILS.includes(b.email.toLowerCase())) return 1;
    return (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0);
  });

  try {
    localStorage.setItem(USER_DIRECTORY_BACKUP_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore
  }

  return sorted;
}

/**
 * Merges a raw user document with standalone user_target_scores, user_vocab_stats,
 * and derives summary metrics from recentAttempts / leaderboardStats / inProgressSummary
 */
function normalizeStudentProfile(
  uid: string,
  rawData: UserProfile,
  cachedEnrichment: Partial<UserProfile>,
  externalGoals?: UserTargetScores,
  externalVocab?: UserVocabStats
): UserProfile {
  const merged: UserProfile = {
    ...cachedEnrichment,
    ...rawData,
    uid,
  };

  if (externalGoals && (!merged.targetScores || (externalGoals.updatedAt || 0) >= (merged.targetScores.updatedAt || 0))) {
    merged.targetScores = externalGoals;
  }

  if (externalVocab && (!merged.vocabStats || (externalVocab.updatedAt || 0) >= (merged.vocabStats.updatedAt || 0))) {
    merged.vocabStats = externalVocab;
  }

  // Derive totalExamAttempts & best scores from leaderboardStats or recentAttempts if not yet set
  if (!merged.totalExamAttempts || merged.totalExamAttempts === 0) {
    if (merged.leaderboardStats && merged.leaderboardStats.totalAttempts > 0) {
      merged.totalExamAttempts = merged.leaderboardStats.totalAttempts;
      if (!merged.bestRawScore && merged.leaderboardStats.bestRawScore) {
        merged.bestRawScore = merged.leaderboardStats.bestRawScore;
      }
      if (!merged.bestVstepBandScore && merged.leaderboardStats.bestScale100Score) {
        merged.bestVstepBandScore = Math.round((merged.leaderboardStats.bestScale100Score / 10) * 2) / 2;
      }
    } else if (Array.isArray(merged.recentAttempts) && merged.recentAttempts.length > 0) {
      merged.totalExamAttempts = merged.recentAttempts.length;
      let bestBand = 0;
      let bestRaw = 0;
      merged.recentAttempts.forEach((att) => {
        const raw = Number(att.score) || 0;
        const tot = Number(att.totalQuestions) || 75;
        const band =
          typeof att.vstepBandScore === 'number' && att.vstepBandScore > 0
            ? att.vstepBandScore
            : Math.round(((raw / Math.max(1, tot)) * 10) * 2) / 2;
        if (band > bestBand) bestBand = band;
        if (raw > bestRaw) bestRaw = raw;
      });
      merged.bestVstepBandScore = bestBand;
      merged.bestRawScore = bestRaw;
    }
  }

  // Derive activeDraftSummary from inProgressSummary if not set
  if (!merged.activeDraftSummary && Array.isArray(merged.inProgressSummary) && merged.inProgressSummary.length > 0) {
    const firstDraft = merged.inProgressSummary[0];
    if (firstDraft && firstDraft.testId) {
      const answeredCount = Object.values(firstDraft.answers || {}).filter(
        (v) => v && String(v).trim().length > 0
      ).length;
      merged.activeDraftSummary = {
        testId: firstDraft.testId,
        testTitle: resolveTestTitle(firstDraft.testId, firstDraft.testTitle),
        mode: firstDraft.mode || 'exam',
        answeredCount,
        totalQuestions: 75,
        activeQuestionId: firstDraft.activeQuestionId,
        elapsedSeconds: firstDraft.elapsedSeconds || 0,
        timeRemainingSeconds: firstDraft.timeRemainingSeconds ?? firstDraft.remainingSeconds,
        updatedAt: firstDraft.savedAt || firstDraft.lastUpdatedAt || Date.now(),
      };
    }
  }

  return merged;
}

/**
 * Real-time subscription to users, user_target_scores, and user_vocab_stats collections
 * with local storage backup & live subcollection enrichment
 */
export function subscribeToStudentDirectory(
  onUpdate: (students: UserProfile[]) => void,
  onError?: (err: any) => void
): () => void {
  const usersCol = collection(db, 'users');
  const targetScoresCol = collection(db, 'user_target_scores');
  const vocabStatsCol = collection(db, 'user_vocab_stats');

  let latestRawUsers = new Map<string, UserProfile>();
  const latestGoalsMap = new Map<string, UserTargetScores>();
  const latestVocabMap = new Map<string, UserVocabStats>();

  const emitMergedDirectory = (triggerEnrichment: boolean = false) => {
    if (latestRawUsers.size === 0) return;
    const list: UserProfile[] = [];
    latestRawUsers.forEach((data, uid) => {
      const cachedEnrichment = enrichedCacheByUid.get(uid) || {};
      const externalGoals = latestGoalsMap.get(uid);
      const externalVocab = latestVocabMap.get(uid);
      list.push(normalizeStudentProfile(uid, data, cachedEnrichment, externalGoals, externalVocab));
    });

    try {
      localStorage.setItem(USER_DIRECTORY_BACKUP_KEY, JSON.stringify(list));
    } catch {
      // ignore storage errors
    }

    onUpdate(list);

    if (triggerEnrichment) {
      enrichStudentsFromSubcollections(list, (enrichedList) => {
        try {
          localStorage.setItem(USER_DIRECTORY_BACKUP_KEY, JSON.stringify(enrichedList));
        } catch {
          // ignore
        }
        onUpdate(enrichedList);
      }).catch(() => {});
    }
  };

  const unsubGoals = onSnapshot(
    targetScoresCol,
    (snap) => {
      snap.forEach((d) => {
        const data = d.data() as any;
        const scores: UserTargetScores = data.targetScores || {
          overall: Number(data.overall) || 6.5,
          listening: Number(data.listening) || 6.5,
          reading: Number(data.reading) || 6.5,
          writing: Number(data.writing) || 6.5,
          speaking: Number(data.speaking) || 6.5,
          updatedAt: data.updatedAt || Date.now(),
        };
        latestGoalsMap.set(d.id, scores);
      });
      emitMergedDirectory(false);
    },
    () => {
      // Ignore optional collection notice
    }
  );

  const unsubVocab = onSnapshot(
    vocabStatsCol,
    (snap) => {
      snap.forEach((d) => {
        const data = d.data() as any;
        const stats: UserVocabStats = data.vocabStats || (data as UserVocabStats);
        if (stats && typeof stats.masteredCount === 'number') {
          latestVocabMap.set(d.id, stats);
        }
      });
      emitMergedDirectory(false);
    },
    () => {
      // Ignore optional collection notice
    }
  );

  const unsubUsers = onSnapshot(
    usersCol,
    (snap) => {
      const nextMap = new Map<string, UserProfile>();
      snap.forEach((d) => {
        nextMap.set(d.id, d.data() as UserProfile);
      });
      latestRawUsers = nextMap;
      emitMergedDirectory(true);
    },
    async (err) => {
      console.warn('Real-time student snapshot listener error, trying fallback:', err);
      if (onError) onError(err);

      // Attempt single fetch fallback
      try {
        const snap = await getDocs(usersCol);
        const nextMap = new Map<string, UserProfile>();
        snap.forEach((d) => {
          nextMap.set(d.id, d.data() as UserProfile);
        });
        if (nextMap.size > 0) {
          latestRawUsers = nextMap;
          emitMergedDirectory(true);
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

  return () => {
    unsubUsers();
    unsubGoals();
    unsubVocab();
  };
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

  // If this is a guest submission ID, read directly from guest_submissions or local cache
  if (uid.startsWith('guest_') || uid.startsWith('guest-')) {
    getDoc(doc(db, 'guest_submissions', uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data() as GuestSubmission;
        if (data.attempt) {
          onUpdate([data.attempt]);
        }
      }
    }).catch(() => {});
    return () => {};
  }

  const attemptsCol = collection(db, 'users', uid, 'attempts');

  const processAttemptsSnap = (snap: any) => {
    const list: UserExamAttempt[] = [];
    snap.forEach((d: any) => {
      const data = d.data() as UserExamAttempt;
      list.push({ ...data, attemptId: d.id });
    });

    list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    try {
      localStorage.setItem(localCacheKey, JSON.stringify(list.slice(0, 100)));
    } catch {
      // Ignore
    }

    onUpdate(list);

    // Auto-heal root document in Firestore if attempts exist
    if (list.length > 0 && canWriteToFirestore()) {
      let bestBand = 0;
      let bestRaw = 0;
      list.forEach((att) => {
        const raw = Number(att.score) || 0;
        const tot = Number(att.totalQuestions) || 75;
        const band =
          typeof att.vstepBandScore === 'number' && att.vstepBandScore > 0
            ? att.vstepBandScore
            : Math.round(((raw / Math.max(1, tot)) * 10) * 2) / 2;
        if (band > bestBand) bestBand = band;
        if (raw > bestRaw) bestRaw = raw;
      });

      safeSetDoc(
        doc(db, 'users', uid),
        {
          totalExamAttempts: list.length,
          bestVstepBandScore: bestBand,
          bestRawScore: bestRaw,
          lastAttemptAt: list[0]?.completedAt || Date.now(),
          lastTestTitle: resolveTestTitle(list[0]?.testId, list[0]?.testTitle),
        },
        { merge: true }
      ).catch(() => {});
    }
  };

  const unsub = onSnapshot(
    attemptsCol,
    (snap) => {
      processAttemptsSnap(snap);
    },
    async (err) => {
      console.warn(`Real-time attempts listener error for ${uid}, falling back to direct getDocs:`, err);
      try {
        const snap = await getDocs(attemptsCol);
        processAttemptsSnap(snap);
      } catch (fallbackErr) {
        if (onError) onError(fallbackErr);
      }
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
 * Fetch personal vocabulary decks, personal folders, and partition state for a student
 */
export async function fetchStudentPersonalVocabData(uid: string): Promise<{
  personalDecks: UserVocabDeck[];
  personalFolders: UserVocabFolder[];
  audioVolumePercent?: number;
  rawPartitionState?: any;
}> {
  if (uid.startsWith('demo_')) {
    return DEMO_PERSONAL_VOCAB[uid] || { personalDecks: [], personalFolders: [] };
  }
  try {
    const [stateSnap, decksSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid, 'vocab_state', 'main')),
      getDocs(collection(db, 'users', uid, 'vocab_decks')),
    ]);

    const personalDecks: UserVocabDeck[] = [];
    decksSnap.forEach((d) => {
      const data = d.data() as UserVocabDeck;
      if (data) {
        personalDecks.push({ ...data, id: data.id || d.id });
      }
    });
    personalDecks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const rawPartitionState = stateSnap.exists() ? stateSnap.data() : null;
    const personalFolders: UserVocabFolder[] = Array.isArray(rawPartitionState?.personalFolders)
      ? rawPartitionState.personalFolders
      : [];
    const audioVolumePercent =
      typeof rawPartitionState?.audioVolumePercent === 'number'
        ? rawPartitionState.audioVolumePercent
        : undefined;

    return {
      personalDecks,
      personalFolders,
      audioVolumePercent,
      rawPartitionState,
    };
  } catch (err) {
    console.warn(`Lỗi lấy bộ từ vựng cá nhân của học viên ${uid}:`, err);
    return { personalDecks: [], personalFolders: [] };
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
 * Updates target scores for a student in both users/{uid} and user_target_scores/{uid}
 */
export async function updateStudentTargetScores(
  uid: string,
  targetScores: UserTargetScores
): Promise<void> {
  const stampedScores: UserTargetScores = {
    ...targetScores,
    updatedAt: Date.now(),
  };
  const userRef = doc(db, 'users', uid);
  const targetScoresRef = doc(db, 'user_target_scores', uid);

  await Promise.all([
    safeSetDoc(
      userRef,
      sanitizeFirestoreData({
        targetScores: stampedScores,
      }),
      { merge: true }
    ),
    safeSetDoc(
      targetScoresRef,
      sanitizeFirestoreData({
        uid,
        ...stampedScores,
        targetScores: stampedScores,
      }),
      { merge: true }
    ),
  ]);
}

/**
 * Updates a student's personal profile info and VSTEP target scores directly (Teacher/Admin 2-way sync)
 */
export async function updateStudentProfileAndGoals(
  uid: string,
  profilePatch: {
    displayName?: string;
    nickname?: string;
    phone?: string;
    birthDate?: string;
    address?: string;
  },
  targetScores: UserTargetScores
): Promise<void> {
  const now = Date.now();
  const stampedScores: UserTargetScores = {
    ...targetScores,
    updatedAt: now,
  };

  if (uid.startsWith('demo_')) {
    return;
  }

  const userRef = doc(db, 'users', uid);
  const targetScoresRef = doc(db, 'user_target_scores', uid);

  await Promise.all([
    safeSetDoc(
      userRef,
      sanitizeFirestoreData({
        ...profilePatch,
        targetScores: stampedScores,
        updatedAt: now,
      }),
      { merge: true }
    ),
    safeSetDoc(
      targetScoresRef,
      sanitizeFirestoreData({
        uid,
        ...stampedScores,
        targetScores: stampedScores,
      }),
      { merge: true }
    ),
  ]);
}

/**
 * Fetches and caches the 75-question map for a test (from Firestore tests/{testId} or TEST_1_QUESTIONS)
 * so the Teacher 360 modal can compare student answers against official correctAnswer and explanation.
 */
const testQuestionsCache = new Map<string, Record<number, Question>>();

export async function fetchTestQuestionsMapForReview(
  testId?: string
): Promise<Record<number, Question>> {
  const key = testId || 'vstep_test_1';
  if (testQuestionsCache.has(key)) {
    return testQuestionsCache.get(key)!;
  }

  let questionsList: Question[] = TEST_1_QUESTIONS;

  if (key && key !== 'vstep_test_1' && key !== 'test-1') {
    try {
      const snap = await getDoc(doc(db, 'tests', key));
      if (snap.exists()) {
        const data = snap.data() as any;
        if (Array.isArray(data.questions) && data.questions.length > 0) {
          questionsList = hydrateQuestionsFromStorage(data.questions);
        }
      }
    } catch {
      // Fallback to TEST_1_QUESTIONS
    }
  }

  const map: Record<number, Question> = {};
  questionsList.forEach((q, idx) => {
    const qNum = Number(q.id) || idx + 1;
    map[qNum] = q;
  });

  testQuestionsCache.set(key, map);
  return map;
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
    totalExamAttempts: 2,
    bestVstepBandScore: 7.5,
    bestRawScore: 58,
    lastTestTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
    activeDraftSummary: {
      testId: 'vstep_test_3',
      testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 3',
      mode: 'exam',
      answeredCount: 10,
      totalQuestions: 75,
      elapsedSeconds: 2100,
      updatedAt: Date.now() - 1000 * 60 * 2,
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
    totalExamAttempts: 1,
    bestVstepBandScore: 8.5,
    bestRawScore: 66,
    lastTestTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
    activeDraftSummary: {
      testId: 'vstep_test_2',
      testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 2',
      mode: 'practice',
      answeredCount: 4,
      totalQuestions: 75,
      elapsedSeconds: 1200,
      updatedAt: Date.now() - 1000 * 60 * 45,
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
    totalExamAttempts: 1,
    bestVstepBandScore: 9.0,
    bestRawScore: 71,
    lastTestTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
    activeDraftSummary: null,
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

export const DEMO_PERSONAL_VOCAB: Record<
  string,
  {
    personalDecks: UserVocabDeck[];
    personalFolders: UserVocabFolder[];
    audioVolumePercent?: number;
  }
> = {
  demo_student_1: {
    audioVolumePercent: 90,
    personalFolders: [
      {
        id: 'folder_demo_1',
        name: 'Từ vựng Writing B2 trọng tâm',
        description: 'Các cụm từ học thuật dùng cho Essay Task 2',
        createdAt: Date.now() - 86400000 * 10,
      },
    ],
    personalDecks: [
      {
        id: 'deck_demo_101',
        name: 'Linking Words & Academic Collocations',
        description: 'Tổng hợp từ nối ăn điểm C1 trong Writing Task 2',
        folderId: 'folder_demo_1',
        categoryTag: 'Writing B2-C1',
        visibility: 'private',
        authorId: 'demo_student_1',
        authorName: 'Nguyễn Thu Trang',
        createdAt: Date.now() - 86400000 * 8,
        updatedAt: Date.now() - 86400000 * 2,
        words: [
          {
            id: 'w_demo_1',
            word: 'consequently',
            pos: 'adv',
            ipa: '/ˈkɒnsɪkwəntli/',
            meaningVi: 'do đó, hệ quả là',
            exampleEn: 'Traffic volume has surged; consequently, air quality has deteriorated.',
            exampleVi: 'Lưu lượng giao thông tăng vọt; hệ quả là chất lượng không khí suy giảm.',
          },
          {
            id: 'w_demo_2',
            word: 'mitigate',
            pos: 'v',
            ipa: '/ˈmɪtɪɡeɪt/',
            meaningVi: 'giảm thiểu, làm dịu bớt',
            exampleEn: 'Planting urban trees helps mitigate the heat island effect.',
            exampleVi: 'Trồng cây xanh đô thị giúp giảm thiểu hiệu ứng đảo nhiệt.',
          },
          {
            id: 'w_demo_3',
            word: 'indispensable',
            pos: 'adj',
            ipa: '/ˌɪndɪˈspensəbl/',
            meaningVi: 'không thể thiếu được, thiết yếu',
            exampleEn: 'Digital literacy is indispensable in the modern workplace.',
            exampleVi: 'Kỹ năng số là yếu tố không thể thiếu trong môi trường làm việc hiện đại.',
          },
        ],
      },
    ],
  },
  demo_student_3: {
    audioVolumePercent: 100,
    personalFolders: [
      {
        id: 'folder_demo_3',
        name: 'Kho từ vựng C1 Chuyên sâu',
        createdAt: Date.now() - 86400000 * 20,
      },
    ],
    personalDecks: [
      {
        id: 'c1_academic',
        name: 'VSTEP C1 Idioms & Collocations',
        description: 'Bộ từ cá nhân tự biên soạn cho Speaking Part 3',
        folderId: 'folder_demo_3',
        categoryTag: 'Speaking C1',
        visibility: 'public',
        authorId: 'demo_student_3',
        authorName: 'Lê Thảo My',
        createdAt: Date.now() - 86400000 * 15,
        updatedAt: Date.now() - 1000 * 60 * 12,
        words: [
          {
            id: 'w_demo_31',
            word: 'double-edged sword',
            pos: 'n',
            ipa: '/ˌdʌbl edʒd ˈsɔːd/',
            meaningVi: 'con dao hai lưỡi',
            exampleEn: 'Social media can be a double-edged sword for teenagers.',
            exampleVi: 'Mạng xã hội có thể là con dao hai lưỡi đối với thanh thiếu niên.',
          },
          {
            id: 'w_demo_32',
            word: 'ubiquitous',
            pos: 'adj',
            ipa: '/juːˈbɪkwɪtəs/',
            meaningVi: 'phổ biến ở khắp mọi nơi',
            exampleEn: 'Smartphones have become ubiquitous in daily communication.',
            exampleVi: 'Điện thoại thông minh đã trở nên phổ biến khắp mọi nơi trong giao tiếp hàng ngày.',
          },
        ],
      },
    ],
  },
};

/**
 * Real-time subscription to unauthenticated guest submissions (e.g. Uyên or Nam submitting before login)
 */
export function subscribeToGuestSubmissions(
  onUpdate: (submissions: GuestSubmission[]) => void,
  onError?: (err: any) => void
): () => void {
  const colRef = collection(db, 'guest_submissions');
  const unsub = onSnapshot(
    colRef,
    (snap) => {
      const list: GuestSubmission[] = [];
      snap.forEach((d) => {
        list.push({ ...(d.data() as GuestSubmission), submissionId: d.id });
      });
      list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      onUpdate(list);
    },
    (err) => {
      console.warn('Real-time guest submissions listener notice:', err);
      if (onError) onError(err);
    }
  );
  return unsub;
}

