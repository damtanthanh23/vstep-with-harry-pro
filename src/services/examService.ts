import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, safeSetDoc, safeDeleteDoc, canWriteToFirestore } from '../firebase';
import {
  TestMetadata,
  Question,
  UserExamAttempt,
  PartAudioMap,
  InProgressAttempt,
} from '../types/exam';
import { WritingTask, SAMPLE_B1_WRITING_TASKS } from '../types/writing';
import { SpeakingTask, SAMPLE_VSTEP_SPEAKING_TASKS } from '../types/speaking';
import { TEST_1_QUESTIONS } from '../data/test1Data';

export interface CustomTestPayload {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  totalQuestions: number;
  durationMinutes: number;
  isAvailable: boolean;
  isCustom: boolean;
  status?: 'draft' | 'published';
  categoryTag?: string;
  createdAt: number;
  updatedAt?: number;
  creatorId: string;
  creatorEmail: string;
  audioMode?: 'single' | 'per_part';
  audioUrl?: string;
  audioFileName?: string;
  partAudioUrls?: PartAudioMap;
  partAudioFileNames?: PartAudioMap;
  questions: Question[];
  writingTasks?: WritingTask[];
  speakingTasks?: SpeakingTask[];
  vocabulary?: any[];
}

/**
 * Deduplicates shared passage-level articles/translations/images across Reading Passages 1-4
 * before saving to Firestore or localStorage so each passage is stored only ONCE on its first question
 * (Q36, Q46, Q56, Q66), preventing Firestore 1MiB document size limit errors.
 */
export function compactQuestionsForStorage(questions: Question[]): Question[] {
  const savedReadingPassageArticle: Record<number, boolean> = {};
  let r2GappedSaved = false;
  let r3MultiSaved = false;

  return questions.map((q) => {
    const clone: Question = { ...q };

    if (clone.section === 'READING' && clone.partNumber === 1 && clone.stimulusCard) {
      const sharedImg = clone.stimulusCard.imageUrl || clone.imageUrl || '';
      const sharedCap = clone.stimulusCard.imageCaption || clone.imageCaption || '';
      clone.stimulusCard = {
        ...clone.stimulusCard,
        imageUrl: sharedImg,
        imageCaption: sharedCap,
      };
      delete clone.imageUrl;
      delete clone.imageCaption;
    }

    if (clone.section === 'READING' && clone.partNumber === 2 && (clone.gappedArticle || clone.gappedOptions)) {
      if (!r2GappedSaved) {
        r2GappedSaved = true;
      } else {
        delete clone.gappedArticle;
        delete clone.gappedOptions;
        delete clone.gappedArticleTranslation;
      }
    }

    if (clone.section === 'READING' && clone.partNumber === 3 && clone.multiTextCards) {
      if (!r3MultiSaved) {
        r3MultiSaved = true;
      } else {
        delete clone.multiTextCards;
      }
    }

    // VSTEP Reading Passages 1-4: keep readingArticle & readingArticleTranslation only on the first question of each Passage
    if (clone.section === 'READING') {
      const pNum = clone.partNumber;
      if (!savedReadingPassageArticle[pNum] && (clone.readingArticle || clone.readingArticleTranslation)) {
        savedReadingPassageArticle[pNum] = true;
      } else {
        delete clone.readingArticle;
        delete clone.readingArticleTranslation;
      }
    }

    return clone;
  });
}

/**
 * Re-hydrates shared passage-level articles/translations across all questions of Reading Passages 1-4
 * when loading from Firestore, localStorage, or imported JSON.
 */
export function hydrateQuestionsFromStorage(questions: Question[]): Question[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  const readingSources: Record<number, Question | undefined> = {
    1: questions.find(
      (q) => q.section === 'READING' && q.partNumber === 1 && (q.readingArticle || q.readingArticleTranslation)
    ),
    2: questions.find(
      (q) => q.section === 'READING' && q.partNumber === 2 && (q.readingArticle || q.readingArticleTranslation)
    ),
    3: questions.find(
      (q) => q.section === 'READING' && q.partNumber === 3 && (q.readingArticle || q.readingArticleTranslation)
    ),
    4: questions.find(
      (q) => q.section === 'READING' && q.partNumber === 4 && (q.readingArticle || q.readingArticleTranslation)
    ),
  };

  const r2GappedSource = questions.find(
    (q) => q.section === 'READING' && q.partNumber === 2 && (q.gappedArticle || q.gappedOptions || q.gappedArticleTranslation)
  );
  const r3MultiSource = questions.find(
    (q) => q.section === 'READING' && q.partNumber === 3 && q.multiTextCards
  );

  return questions.map((q) => {
    const clone: Question = { ...q };

    if (clone.section === 'READING' && clone.partNumber === 1 && clone.stimulusCard) {
      const img = clone.stimulusCard.imageUrl || clone.imageUrl || '';
      const cap = clone.stimulusCard.imageCaption || clone.imageCaption || '';
      clone.stimulusCard = {
        ...clone.stimulusCard,
        imageUrl: img,
        imageCaption: cap,
      };
      clone.imageUrl = img;
      clone.imageCaption = cap;
    }

    if (clone.section === 'READING' && clone.partNumber === 2 && r2GappedSource) {
      if (!clone.gappedArticle && r2GappedSource.gappedArticle) {
        clone.gappedArticle = r2GappedSource.gappedArticle;
      }
      if (!clone.gappedOptions && r2GappedSource.gappedOptions) {
        clone.gappedOptions = r2GappedSource.gappedOptions;
      }
      if (!clone.gappedArticleTranslation && r2GappedSource.gappedArticleTranslation) {
        clone.gappedArticleTranslation = r2GappedSource.gappedArticleTranslation;
      }
    }

    if (clone.section === 'READING' && clone.partNumber === 3 && r3MultiSource) {
      if (!clone.multiTextCards && r3MultiSource.multiTextCards) {
        clone.multiTextCards = r3MultiSource.multiTextCards;
      }
    }

    // Hydrate readingArticle & readingArticleTranslation for all 4 VSTEP Reading Passages
    if (clone.section === 'READING') {
      const src = readingSources[clone.partNumber];
      if (src) {
        if (!clone.readingArticle && src.readingArticle) {
          clone.readingArticle = src.readingArticle;
        }
        if (!clone.readingArticleTranslation && src.readingArticleTranslation) {
          clone.readingArticleTranslation = src.readingArticleTranslation;
        }
      }
    }

    return clone;
  });
}

export function getLocalCustomTestsBackup(): TestMetadata[] {
  try {
    const map: Record<string, CustomTestPayload> = {};
    const rawV1 = localStorage.getItem('langcert_custom_tests_backup_v1');
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (parsedV1 && typeof parsedV1 === 'object' && !Array.isArray(parsedV1)) {
        Object.assign(map, parsedV1);
      }
    }

    // Migrate any legacy array backup key into v1 map so nothing is ever lost
    const rawLegacy = localStorage.getItem('langcert_custom_tests_backup');
    if (rawLegacy) {
      try {
        const legacyArr = JSON.parse(rawLegacy);
        if (Array.isArray(legacyArr)) {
          legacyArr.forEach((item: any) => {
            if (item && item.id) {
              const existing = map[item.id];
              if (!existing || (item.updatedAt || item.createdAt || 0) > (existing.updatedAt || existing.createdAt || 0)) {
                map[item.id] = item;
              }
            }
          });
          localStorage.setItem('langcert_custom_tests_backup_v1', JSON.stringify(map));
          localStorage.removeItem('langcert_custom_tests_backup');
        }
      } catch {
        // Ignore legacy parse error
      }
    }

    const list: TestMetadata[] = [];
    Object.values(map).forEach((data) => {
      if (!data || !data.id) return;
      const hydratedQuestions = hydrateQuestionsFromStorage(data.questions || []);
      list.push({
        id: data.id,
        title: data.title,
        subtitle: data.subtitle || 'Đề thi VSTEP 4 Kỹ năng tùy chỉnh',
        description: data.description || data.subtitle,
        totalQuestions: data.totalQuestions || (hydratedQuestions.length || 75),
        durationMinutes: data.durationMinutes || 172,
        isAvailable: true,
        isCustom: true,
        status: data.status || (data.categoryTag === 'Đề Nháp' ? 'draft' : 'published'),
        categoryTag: data.categoryTag || (data.status === 'draft' ? 'Đề Nháp' : 'Đề thi minh họa'),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt || data.createdAt,
        creatorId: data.creatorId,
        creatorEmail: data.creatorEmail,
        audioMode: data.audioMode || 'single',
        audioUrl: data.audioUrl,
        audioFileName: data.audioFileName,
        partAudioUrls: data.partAudioUrls,
        partAudioFileNames: data.partAudioFileNames,
        questions: hydratedQuestions,
        writingTasks: data.writingTasks || SAMPLE_B1_WRITING_TASKS,
        speakingTasks: data.speakingTasks || SAMPLE_VSTEP_SPEAKING_TASKS,
        vocabulary: data.vocabulary,
      });
    });
    return list;
  } catch {
    return [];
  }
}

/**
 * Real-time listener for custom tests uploaded to Firestore (with local backup fallback)
 */
export function subscribeToCustomTests(
  onUpdate: (tests: TestMetadata[]) => void,
  onError?: (err: Error) => void
) {
  const collectionRef = collection(db, 'tests');

  return onSnapshot(
    collectionRef,
    (snapshot) => {
      const testsMap = new Map<string, TestMetadata>();

      // 1. Load local backups first
      getLocalCustomTestsBackup().forEach((t) => testsMap.set(t.id, t));

      // 2. Override with authoritative Cloud Firestore snapshot
      const updatedBackupMap: Record<string, CustomTestPayload> = {};
      try {
        const raw = localStorage.getItem('langcert_custom_tests_backup_v1');
        if (raw) Object.assign(updatedBackupMap, JSON.parse(raw));
      } catch {
        // Ignore
      }

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CustomTestPayload;
        if (!data || !data.id) return;
        const hydratedQuestions = hydrateQuestionsFromStorage(data.questions || []);
        const remoteMeta: TestMetadata = {
          id: data.id,
          title: data.title,
          subtitle: data.subtitle || 'Đề thi VSTEP 4 Kỹ năng tùy chỉnh',
          description: data.description || data.subtitle,
          totalQuestions: data.totalQuestions || (hydratedQuestions.length || 75),
          durationMinutes: data.durationMinutes || 172,
          isAvailable: true,
          isCustom: true,
          status: data.status || (data.categoryTag === 'Đề Nháp' ? 'draft' : 'published'),
          categoryTag: data.categoryTag || (data.status === 'draft' ? 'Đề Nháp' : 'Đề thi minh họa'),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt || data.createdAt,
          creatorId: data.creatorId,
          creatorEmail: data.creatorEmail,
          audioMode: data.audioMode || 'single',
          audioUrl: data.audioUrl,
          audioFileName: data.audioFileName,
          partAudioUrls: data.partAudioUrls,
          partAudioFileNames: data.partAudioFileNames,
          questions: hydratedQuestions,
          writingTasks: data.writingTasks || SAMPLE_B1_WRITING_TASKS,
          speakingTasks: data.speakingTasks || SAMPLE_VSTEP_SPEAKING_TASKS,
          vocabulary: data.vocabulary,
        };
        testsMap.set(data.id, remoteMeta);
        updatedBackupMap[data.id] = data;
      });

      try {
        localStorage.setItem('langcert_custom_tests_backup_v1', JSON.stringify(updatedBackupMap));
      } catch {
        // Ignore storage quota
      }

      const combined = Array.from(testsMap.values()).sort(
        (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
      );
      onUpdate(combined);
    },
    (error) => {
      console.warn('Firestore custom test subscription notice (using local backup):', error);
      const localBackups = getLocalCustomTestsBackup().sort(
        (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
      );
      onUpdate(localBackups);
      if (onError) onError(error);
    }
  );
}

/**
 * Real-time listener for deleted test IDs
 */
export function subscribeToDeletedTestIds(
  onUpdate: (deletedIds: string[]) => void
) {
  const docRef = doc(db, 'settings', 'deleted_tests');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as { ids?: string[] };
        onUpdate(Array.isArray(data.ids) ? data.ids : []);
      } else {
        onUpdate([]);
      }
    },
    (err) => {
      console.warn('Could not subscribe to deleted_tests setting:', err);
    }
  );
}

/**
 * Permanently delete any test (custom or built-in default test) from the system
 */
export async function deleteAnyTestFromSystem(testId: string): Promise<void> {
  try {
    const rawV1 = localStorage.getItem('langcert_custom_tests_backup_v1');
    if (rawV1) {
      const mapV1: Record<string, CustomTestPayload> = JSON.parse(rawV1);
      if (mapV1 && mapV1[testId]) {
        delete mapV1[testId];
        localStorage.setItem('langcert_custom_tests_backup_v1', JSON.stringify(mapV1));
      }
    }
    localStorage.removeItem('langcert_custom_tests_backup');
  } catch {
    // Ignore local storage errors
  }

  if (!canWriteToFirestore()) return;

  try {
    const testDocRef = doc(db, 'tests', testId);
    await safeDeleteDoc(testDocRef);
  } catch (err) {
    console.warn('Notice deleting custom test doc:', err);
  }

  try {
    const settingsRef = doc(db, 'settings', 'deleted_tests');
    const snap = await getDoc(settingsRef);
    const existingIds: string[] = snap.exists() && Array.isArray(snap.data()?.ids) ? snap.data().ids : [];
    if (!existingIds.includes(testId)) {
      await safeSetDoc(settingsRef, {
        ids: [...existingIds, testId],
        updatedAt: Date.now(),
      });
    }
  } catch (err) {
    console.warn('Notice updating deleted_tests setting:', err);
  }
}

/**
 * Recursively strips keys with `undefined` values from objects and arrays
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Save a new or edited custom test to Firestore and local backup storage.
 * Returns { syncedToCloud: boolean } so UI can display true Cloud Firestore sync status.
 */
export async function saveTestToFirestore(
  payload: CustomTestPayload
): Promise<{ syncedToCloud: boolean }> {
  const now = Date.now();
  const compactedPayload: CustomTestPayload = {
    ...payload,
    updatedAt: payload.updatedAt || now,
    questions: compactQuestionsForStorage(payload.questions || []),
  };

  try {
    const backupKey = 'langcert_custom_tests_backup_v1';
    const raw = localStorage.getItem(backupKey);
    const existingMap: Record<string, CustomTestPayload> = raw ? JSON.parse(raw) : {};
    existingMap[payload.id] = compactedPayload;
    localStorage.setItem(backupKey, JSON.stringify(existingMap));
    localStorage.removeItem('langcert_custom_tests_backup');
  } catch (err) {
    console.warn('Notice saving local custom test backup:', err);
  }

  if (!canWriteToFirestore()) {
    return { syncedToCloud: false };
  }

  try {
    const docRef = doc(db, 'tests', payload.id);
    const sanitizedPayload = sanitizeForFirestore(compactedPayload);
    const synced = await safeSetDoc(docRef, sanitizedPayload);

    // If this test ID was previously in deleted_tests, remove it so it stays visible
    const settingsRef = doc(db, 'settings', 'deleted_tests');
    const snap = await getDoc(settingsRef);
    if (snap.exists() && Array.isArray(snap.data()?.ids) && snap.data().ids.includes(payload.id)) {
      const updatedIds = (snap.data().ids as string[]).filter((id) => id !== payload.id);
      await safeSetDoc(settingsRef, {
        ids: updatedIds,
        updatedAt: Date.now(),
      });
    }
    return { syncedToCloud: synced };
  } catch (error) {
    console.warn('Firestore test save notice (saved to local backup):', error);
    return { syncedToCloud: false };
  }
}

/**
 * Delete a custom test from Firestore
 */
export async function deleteTestFromFirestore(testId: string): Promise<void> {
  await deleteAnyTestFromSystem(testId);
}

/**
 * Save user exam attempt result to Firestore and localStorage backup
 */
export async function recordUserAttempt(userId: string, attempt: UserExamAttempt): Promise<void> {
  try {
    const key = `langcert_attempts_${userId}`;
    const raw = localStorage.getItem(key);
    const existing: UserExamAttempt[] = raw ? JSON.parse(raw) : [];
    const updated = [
      attempt,
      ...existing.filter((a) => a.attemptId !== attempt.attemptId),
    ].slice(0, 100);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Ignore local storage errors
  }

  if (!canWriteToFirestore()) return;

  try {
    const docRef = doc(db, 'users', userId, 'attempts', attempt.attemptId);
    const sanitizedAttempt = sanitizeForFirestore(attempt);
    await safeSetDoc(docRef, sanitizedAttempt);

    // Also sync summary stats to top-level user doc for instant real-time leaderboard & admin cards
    if (userId && userId !== 'guest') {
      try {
        const userDocRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userDocRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        const prevBestBand = Number(userData?.bestVstepBandScore) || 0;
        const prevBestRaw = Number(userData?.bestRawScore) || 0;
        const currentAttemptsCount = Number(userData?.totalExamAttempts) || 0;
        const attemptBand =
          typeof attempt.vstepBandScore === 'number' && attempt.vstepBandScore > 0
            ? attempt.vstepBandScore
            : Number((attempt.percentage / 10).toFixed(1));
        const attemptRaw = Number(attempt.score) || 0;

        await safeSetDoc(
          userDocRef,
          {
            bestVstepBandScore: Math.max(prevBestBand, attemptBand),
            bestRawScore: Math.max(prevBestRaw, attemptRaw),
            totalExamAttempts: currentAttemptsCount + 1,
            lastAttemptAt: attempt.completedAt || Date.now(),
            lastTestTitle: attempt.testTitle || 'Bài thi VSTEP',
            activeDraftSummary: null,
            lastActiveAt: Date.now(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Notice updating user summary stats for leaderboard:', err);
      }
    }
  } catch (error) {
    console.warn('Saved attempt locally; Firestore sync notice:', error);
  }
}

/**
 * Updates an existing exam attempt on Cloud Firestore and local backup with AI Writing Examiner evaluation
 * or AI Diagnostic Report once grading completes in ResultsView.
 */
export async function updateAttemptAiEvaluationInFirestore(
  userId: string,
  attemptId: string,
  patch: {
    writingScore?: number;
    speakingScore?: number;
    vstepBandScore?: number;
    aiWritingEvaluation?: any;
    aiDiagnosticReport?: any;
  }
): Promise<void> {
  if (!attemptId) return;
  const safeUid = userId || 'guest';

  try {
    const key = `langcert_attempts_${safeUid}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const existing: UserExamAttempt[] = JSON.parse(raw);
      if (Array.isArray(existing)) {
        const updated = existing.map((att) =>
          att.attemptId === attemptId
            ? {
                ...att,
                ...(patch.writingScore !== undefined ? { writingScore: patch.writingScore } : {}),
                ...(patch.speakingScore !== undefined ? { speakingScore: patch.speakingScore } : {}),
                ...(patch.vstepBandScore !== undefined ? { vstepBandScore: patch.vstepBandScore } : {}),
                ...(patch.aiWritingEvaluation !== undefined
                  ? { aiWritingEvaluation: patch.aiWritingEvaluation }
                  : {}),
                ...(patch.aiDiagnosticReport !== undefined
                  ? { aiDiagnosticReport: patch.aiDiagnosticReport }
                  : {}),
              }
            : att
        );
        localStorage.setItem(key, JSON.stringify(updated));
      }
    }
  } catch {
    // Ignore local storage errors
  }

  if (!canWriteToFirestore() || !safeUid || safeUid === 'guest') return;

  try {
    const docRef = doc(db, 'users', safeUid, 'attempts', attemptId);
    await safeSetDoc(docRef, sanitizeForFirestore(patch), { merge: true });

    if (typeof patch.vstepBandScore === 'number' && patch.vstepBandScore > 0) {
      const userDocRef = doc(db, 'users', safeUid);
      const userSnap = await getDoc(userDocRef);
      const prevBestBand = Number(userSnap.data()?.bestVstepBandScore) || 0;
      if (patch.vstepBandScore > prevBestBand) {
        await safeSetDoc(
          userDocRef,
          { bestVstepBandScore: patch.vstepBandScore, lastActiveAt: Date.now() },
          { merge: true }
        );
      }
    }
  } catch (err) {
    console.warn('Notice syncing AI evaluation to Firestore attempt:', err);
  }
}

/**
 * Fetch all exam attempts for a user and backfill summary stats onto users/{userId}
 */
export async function fetchUserAttempts(userId: string): Promise<UserExamAttempt[]> {
  let localList: UserExamAttempt[] = [];
  try {
    const raw = localStorage.getItem(`langcert_attempts_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localList = parsed;
    }
  } catch {
    // Ignore
  }

  try {
    const collRef = collection(db, 'users', userId, 'attempts');
    const q = query(collRef, orderBy('completedAt', 'desc'));
    const snap = await getDocs(q);
    const remoteList: UserExamAttempt[] = [];
    const remoteIds = new Set<string>();
    snap.forEach((d) => {
      const att = d.data() as UserExamAttempt;
      remoteList.push(att);
      if (att?.attemptId) remoteIds.add(att.attemptId);
    });

    const map = new Map<string, UserExamAttempt>();
    localList.forEach((a) => map.set(a.attemptId, a));
    remoteList.forEach((a) => {
      const existingLocal = map.get(a.attemptId);
      map.set(a.attemptId, {
        ...existingLocal,
        ...a,
        answers: a.answers || existingLocal?.answers,
        writingSubmission: a.writingSubmission || existingLocal?.writingSubmission,
        speakingSubmission: a.speakingSubmission || existingLocal?.speakingSubmission,
        aiWritingEvaluation: a.aiWritingEvaluation || existingLocal?.aiWritingEvaluation,
        aiDiagnosticReport: a.aiDiagnosticReport || existingLocal?.aiDiagnosticReport,
      });
    });

    const merged = Array.from(map.values()).sort((a, b) => b.completedAt - a.completedAt);
    try {
      localStorage.setItem(`langcert_attempts_${userId}`, JSON.stringify(merged.slice(0, 100)));
    } catch {
      // Ignore
    }

    // Backfill any local-only attempts to Firestore & sync accurate summary fields on users/{userId}
    if (userId && userId !== 'guest' && canWriteToFirestore() && merged.length > 0) {
      try {
        for (const locAtt of localList) {
          if (locAtt?.attemptId && !remoteIds.has(locAtt.attemptId)) {
            await safeSetDoc(
              doc(db, 'users', userId, 'attempts', locAtt.attemptId),
              sanitizeForFirestore(locAtt)
            );
          }
        }

        let bestBand = 0;
        let bestRaw = 0;
        merged.forEach((att) => {
          const rawScore = Number(att.score) || 0;
          const totalQs = Number(att.totalQuestions) || 75;
          const band =
            typeof att.vstepBandScore === 'number' && att.vstepBandScore > 0
              ? att.vstepBandScore
              : Math.round(((rawScore / Math.max(1, totalQs)) * 10) * 2) / 2;
          if (band > bestBand) bestBand = band;
          if (rawScore > bestRaw) bestRaw = rawScore;
        });

        await safeSetDoc(
          doc(db, 'users', userId),
          {
            bestVstepBandScore: bestBand,
            bestRawScore: bestRaw,
            totalExamAttempts: merged.length,
            lastAttemptAt: merged[0]?.completedAt || Date.now(),
            lastTestTitle: merged[0]?.testTitle || 'Bài thi VSTEP',
          },
          { merge: true }
        );
      } catch {
        // Ignore background backfill error
      }
    }

    return merged;
  } catch (error) {
    console.warn('Could not fetch attempts from Firestore, using local backup:', error);
    return localList.sort((a, b) => b.completedAt - a.completedAt);
  }
}

/**
 * Save in-progress attempt to Firestore and update activeDraftSummary on users/{userId}
 */
export async function saveInProgressAttemptToFirestore(
  userId: string,
  attempt: InProgressAttempt
): Promise<void> {
  if (!canWriteToFirestore() || !userId || userId === 'guest') return;
  try {
    const docRef = doc(db, 'users', userId, 'inProgress', attempt.testId);
    const enrichedAttempt = {
      ...attempt,
      writingDraft: attempt.writingSubmission,
      speakingDraft: attempt.speakingSubmission,
      lastUpdatedAt: attempt.savedAt || Date.now(),
    };
    await safeSetDoc(docRef, sanitizeForFirestore(enrichedAttempt));

    const answeredCount = Object.values(attempt.answers || {}).filter(
      (v) => v && String(v).trim().length > 0
    ).length;

    const writingWordCount =
      (attempt.writingSubmission?.task1WordCount || 0) +
      (attempt.writingSubmission?.task2WordCount || 0);
    const speakingWordCount =
      (attempt.speakingSubmission?.part1WordCount || 0) +
      (attempt.speakingSubmission?.part2WordCount || 0) +
      (attempt.speakingSubmission?.part3WordCount || 0);

    await safeSetDoc(
      doc(db, 'users', userId),
      sanitizeForFirestore({
        activeDraftSummary: {
          testId: attempt.testId,
          testTitle: attempt.testTitle || '',
          mode: attempt.mode,
          answeredCount,
          totalQuestions: 75,
          writingWordCount: writingWordCount > 0 ? writingWordCount : undefined,
          speakingWordCount: speakingWordCount > 0 ? speakingWordCount : undefined,
          elapsedSeconds: attempt.elapsedSeconds || 0,
          updatedAt: Date.now(),
        },
        lastActiveAt: Date.now(),
      }),
      { merge: true }
    );
  } catch {
    // Ignore
  }
}

/**
 * Fetch all in-progress attempts for a user from Firestore
 */
export async function fetchUserInProgressMap(
  userId: string
): Promise<Record<string, InProgressAttempt>> {
  try {
    const collRef = collection(db, 'users', userId, 'inProgress');
    const snap = await getDocs(collRef);
    const map: Record<string, InProgressAttempt> = {};
    snap.forEach((d) => {
      const data = d.data() as InProgressAttempt;
      if (data && data.testId) {
        map[data.testId] = data;
      }
    });
    return map;
  } catch (error) {
    console.warn('Could not fetch in-progress attempts from Firestore:', error);
    return {};
  }
}

/**
 * Clear in-progress attempt from Firestore upon completion
 */
export async function clearInProgressAttemptFromFirestore(
  userId: string,
  testId: string
): Promise<void> {
  if (!canWriteToFirestore() || !userId || userId === 'guest') return;
  try {
    const docRef = doc(db, 'users', userId, 'inProgress', testId);
    await safeDeleteDoc(docRef);
    await safeSetDoc(
      doc(db, 'users', userId),
      {
        activeDraftSummary: null,
        lastActiveAt: Date.now(),
      },
      { merge: true }
    );
  } catch {
    // Ignore
  }
}

/**
 * Generates a 100% BLANK 75-question VSTEP template for Manual Exam Creation ("Tạo đề thủ công")
 * - Listening Part 1: IDs 1..8 (8 announcements)
 * - Listening Part 2: IDs 9..20 (3 conversations x 4 questions)
 * - Listening Part 3: IDs 21..35 (3 talks/lectures x 5 questions)
 * - Reading Passage 1: IDs 36..45 (Questions 1..10)
 * - Reading Passage 2: IDs 46..55 (Questions 11..20)
 * - Reading Passage 3: IDs 56..65 (Questions 21..30)
 * - Reading Passage 4: IDs 66..75 (Questions 31..40)
 */
export function createBlankQuestionsTemplate(): Question[] {
  const blankPassageMap: Record<number, { title: string; paragraphs: string[]; imageUrl: string; imageCaption: string }> = {
    1: { title: 'PASSAGE 1 – QUESTIONS 1–10', paragraphs: [''], imageUrl: '', imageCaption: '' },
    2: { title: 'PASSAGE 2 – QUESTIONS 11–20', paragraphs: [''], imageUrl: '', imageCaption: '' },
    3: { title: 'PASSAGE 3 – QUESTIONS 21–30', paragraphs: [''], imageUrl: '', imageCaption: '' },
    4: { title: 'PASSAGE 4 – QUESTIONS 31–40', paragraphs: [''], imageUrl: '', imageCaption: '' },
  };

  const blankTranslationMap: Record<number, { title: string; paragraphs: string[] }> = {
    1: { title: '', paragraphs: [''] },
    2: { title: '', paragraphs: [''] },
    3: { title: '', paragraphs: [''] },
    4: { title: '', paragraphs: [''] },
  };

  return TEST_1_QUESTIONS.map((q) => {
    return {
      id: q.id,
      partNumber: q.partNumber,
      section: q.section,
      type: 'mcq',
      instruction: q.instruction,
      subInstruction: q.subInstruction,
      prompt: '',
      options: [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
      ],
      correctAnswer: 'A',
      explanation: '',
      evidenceQuote: '',
      vietnameseTranslation: '',
      audioScript: '',
      audioScriptTranslation: '',
      imageUrl: '',
      imageCaption: '',
      ...(q.section === 'READING'
        ? {
            readingArticle: JSON.parse(JSON.stringify(blankPassageMap[q.partNumber])),
            readingArticleTranslation: JSON.parse(JSON.stringify(blankTranslationMap[q.partNumber])),
          }
        : {}),
    };
  });
}

/**
 * Generates blank VSTEP Writing Tasks template (Task 1 & Task 2) for manual creation
 */
export function createBlankWritingTasksTemplate(): WritingTask[] {
  return [
    {
      id: 'task-1',
      partNumber: 1,
      title: 'VSTEP Writing Task 1: Letter / Email Writing (20 phút · Trọng số 1/3)',
      instruction:
        'You should spend about 20 minutes on this task. Write a letter or email of at least 120 words responding to the situation below.',
      stimulusText: '',
      imageUrl: '',
      imageCaption: '',
      bulletPoints: ['', '', ''],
      minWords: 120,
      maxWords: 180,
      marks: 10,
      sampleAnswer: '',
    },
    {
      id: 'task-2',
      partNumber: 2,
      title: 'VSTEP Writing Task 2: Essay Writing (40 phút · Trọng số 2/3)',
      instruction:
        'You should spend about 40 minutes on this task. Write an essay of at least 250 words about the following topic:',
      stimulusText: '',
      imageUrl: '',
      imageCaption: '',
      bulletPoints: ['', '', ''],
      minWords: 250,
      maxWords: 350,
      marks: 10,
      sampleAnswer: '',
    },
  ];
}

/**
 * Generates blank VSTEP Speaking Tasks template (Part 1, Part 2, Part 3 with Mind-map) for manual creation
 */
export function createBlankSpeakingTasksTemplate(): SpeakingTask[] {
  return [
    {
      id: 'speaking-part-1',
      partNumber: 1,
      title: "PART 1: Social Interaction (3')",
      durationMinutes: 3,
      prepSeconds: 0,
      speakSeconds: 180,
      instruction:
        'In this part of the speaking test, the examiner will ask you 3–6 questions about TWO familiar topics. Answer naturally with full sentences and reasons.',
      topicClusters: [
        {
          topicTitle: "Let's talk about your free time activities.",
          questions: ['', '', ''],
        },
        {
          topicTitle: "Let's talk about your neighborhood.",
          questions: ['', '', ''],
        },
      ],
      sampleAnswer: '',
      vietnameseTranslation: '',
    },
    {
      id: 'speaking-part-2',
      partNumber: 2,
      title: "PART 2: Solution Discussion (4')",
      durationMinutes: 4,
      prepSeconds: 60,
      speakSeconds: 180,
      instruction:
        'You have 1 minute to prepare and up to 3 minutes to speak. Explain which option you think is the best choice and why you do not choose the other two options.',
      situation: '',
      options: ['', '', ''],
      sampleAnswer: '',
      vietnameseTranslation: '',
    },
    {
      id: 'speaking-part-3',
      partNumber: 3,
      title: "PART 3: Topic Development (5')",
      durationMinutes: 5,
      prepSeconds: 60,
      speakSeconds: 240,
      instruction:
        'You have 1 minute to prepare your talk based on the mind-map below, then speak for 2–3 minutes and answer the follow-up discussion questions.',
      topicStatement: '',
      mindMap: {
        centralIdea: '',
        nodes: ['', '', '', '[Your own ideas]'],
      },
      followUpQuestions: ['', '', ''],
      sampleAnswer: '',
      vietnameseTranslation: '',
    },
  ];
}

/**
 * Smart normalizer for any VSTEP JSON produced by external AI (ChatGPT, Claude, Gemini) or internal parser.
 * Automatically resolves Reading question numbering whether numbered 1..40 or 36..75,
 * preserves underlined/highlighted words (<u><b>...</b></u>, <mark>...</mark>),
 * normalizes 4 options A-D, propagates shared Reading passages across all 10 questions of each Passage,
 * and normalizes both Writing (2 Tasks) and Speaking (3 Parts with Mind-map).
 */
export function normalizeImportedExamData(rawParsed: Record<string, any>): {
  title: string;
  subtitle: string;
  durationMinutes: number;
  audioUrl?: string;
  audioFileName?: string;
  audioMode?: 'single' | 'per_part';
  partAudioUrls?: PartAudioMap;
  questions: Question[];
  writingTasks: WritingTask[];
  speakingTasks: SpeakingTask[];
  vocabulary?: any[];
} {
  const skeleton = createBlankQuestionsTemplate();
  const rawQuestions: any[] = Array.isArray(rawParsed.questions) ? rawParsed.questions : [];

  // Optional top-level passages map if AI placed passages in rawParsed.readingPassages or rawParsed.passages
  const topLevelPassages: any[] = Array.isArray(rawParsed.readingPassages)
    ? rawParsed.readingPassages
    : Array.isArray(rawParsed.passages)
    ? rawParsed.passages
    : [];

  const normalizeParagraphArray = (rawParas: any): string[] => {
    if (Array.isArray(rawParas)) {
      const cleaned = rawParas
        .map((p: any) => (typeof p === 'string' ? p : String(p?.text || p?.content || '')))
        .filter((s: string) => s.trim().length > 0);
      return cleaned.length > 0 ? cleaned : [''];
    }
    if (typeof rawParas === 'string' && rawParas.trim().length > 0) {
      return rawParas.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    }
    return [''];
  };

  // Match each skeleton question (1..75) with the corresponding item in rawQuestions
  const mergedQuestions: Question[] = skeleton.map((skelQ, idx) => {
    const isReading = skelQ.section === 'READING';
    // Reading question number in VSTEP paper (1..40)
    const vstepReadingNum = isReading ? skelQ.id - 35 : skelQ.id;
    // Passage-relative question number (1..10 for Reading, or part-relative for Listening)
    const partRelNum = isReading
      ? ((skelQ.id - 36) % 10) + 1
      : skelQ.partNumber === 1
      ? skelQ.id
      : skelQ.partNumber === 2
      ? skelQ.id - 8
      : skelQ.id - 20;

    // 1. Match by global ID (1..75) ensuring section does not conflict when ID <= 40
    let found = rawQuestions.find((rq) => {
      if (Number(rq?.id) !== skelQ.id) return false;
      const rqSec = String(rq?.section || '').toUpperCase();
      if (rqSec && rqSec !== skelQ.section) return false;
      return true;
    });

    // 2. If Reading (IDs 36..75), match AI JSONs that numbered Reading questions 1..40 with section: 'READING'
    if (!found && isReading) {
      found = rawQuestions.find((rq) => {
        const rqSec = String(rq?.section || '').toUpperCase();
        if (rqSec !== 'READING') return false;
        const rqId = Number(rq?.id);
        const rqQNum = Number(rq?.questionNumber || rq?.relativeId);
        if (rqId === vstepReadingNum || rqQNum === vstepReadingNum) return true;
        if (
          Number(rq?.partNumber || rq?.passageNumber) === skelQ.partNumber &&
          (rqId === partRelNum || rqQNum === partRelNum)
        ) {
          return true;
        }
        return false;
      });
    }

    // 3. If Listening (IDs 1..35), match by section + partNumber + relative number
    if (!found && !isReading) {
      found = rawQuestions.find((rq) => {
        const rqSec = String(rq?.section || '').toUpperCase();
        if (rqSec !== 'LISTENING') return false;
        const rqId = Number(rq?.id);
        const rqQNum = Number(rq?.questionNumber || rq?.relativeId);
        if (rqId === skelQ.id || rqQNum === skelQ.id) return true;
        if (Number(rq?.partNumber) === skelQ.partNumber && (rqId === partRelNum || rqQNum === partRelNum)) {
          return true;
        }
        return false;
      });
    }

    // 4. Fallback: positional index if rawQuestions has exactly 75 items
    if (!found && rawQuestions.length === 75) {
      found = rawQuestions[idx];
    }

    if (!found) return skelQ;

    const merged: Question = {
      ...skelQ,
      id: skelQ.id,
      partNumber: skelQ.partNumber,
      section: skelQ.section,
      type: 'mcq',
      instruction: found.instruction || skelQ.instruction,
      subInstruction: found.subInstruction || skelQ.subInstruction,
      prompt: found.prompt !== undefined ? String(found.prompt) : skelQ.prompt,
      correctAnswer:
        found.correctAnswer !== undefined && found.correctAnswer !== ''
          ? String(found.correctAnswer).trim().toUpperCase()
          : skelQ.correctAnswer,
      explanation: found.explanation || '',
      evidenceQuote: found.evidenceQuote || '',
      vietnameseTranslation: found.vietnameseTranslation || '',
      audioScript: found.audioScript || '',
      audioScriptTranslation: found.audioScriptTranslation || '',
      imageUrl: found.imageUrl || '',
      imageCaption: found.imageCaption || '',
    };

    // Normalize 4 MCQ options (A, B, C, D)
    if (Array.isArray(found.options) && found.options.length > 0) {
      merged.options = ['A', 'B', 'C', 'D'].map((letter, optIdx) => {
        const matchOpt =
          found.options.find((o: any) => String(o?.id || '').toUpperCase() === letter) ||
          found.options[optIdx];
        if (typeof matchOpt === 'string') {
          return { id: letter, text: matchOpt.replace(/^[A-D][.)\s:-]+/i, '').trim() };
        }
        return {
          id: letter,
          text: String(matchOpt?.text || ''),
        };
      });
    }

    // Normalize Reading Passage article & translation for all 4 Passages (partNumber 1..4)
    if (isReading) {
      const topPassage =
        topLevelPassages.find(
          (tp: any) => Number(tp?.partNumber || tp?.passageNumber || tp?.id) === skelQ.partNumber
        ) || topLevelPassages[skelQ.partNumber - 1];

      const rawArticle = found.readingArticle || topPassage?.readingArticle || topPassage;
      if (rawArticle && (rawArticle.paragraphs || rawArticle.content || rawArticle.text)) {
        merged.readingArticle = {
          title:
            rawArticle.title ||
            `PASSAGE ${skelQ.partNumber} – QUESTIONS ${(skelQ.partNumber - 1) * 10 + 1}–${
              skelQ.partNumber * 10
            }`,
          paragraphs: normalizeParagraphArray(
            rawArticle.paragraphs || rawArticle.content || rawArticle.text
          ),
          imageUrl: rawArticle.imageUrl || '',
          imageCaption: rawArticle.imageCaption || '',
        };
      }

      const rawTrans =
        found.readingArticleTranslation ||
        topPassage?.readingArticleTranslation ||
        rawArticle?.readingArticleTranslation ||
        rawArticle?.translation;
      if (rawTrans) {
        merged.readingArticleTranslation = {
          title:
            rawTrans.title ||
            `Bản dịch Bài đọc ${skelQ.partNumber} (Câu ${(skelQ.partNumber - 1) * 10 + 1}–${
              skelQ.partNumber * 10
            })`,
          paragraphs: normalizeParagraphArray(
            rawTrans.paragraphs || rawTrans.fullText || rawTrans.content || rawTrans.text || rawTrans
          ),
        };
      }
    }

    return merged;
  });

  // Propagate shared Reading Passage articles (R1..R4) and shared Listening conversation/talk scripts
  const hydratedQuestions = hydrateQuestionsFromStorage(mergedQuestions);

  // Propagate shared conversation/lecture audioScript within Listening Part 2 (groups of 4) and Part 3 (groups of 5) if AI only put script on first question of each group
  const l2Groups = [
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20],
  ];
  const l3Groups = [
    [21, 22, 23, 24, 25],
    [26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35],
  ];
  [...l2Groups, ...l3Groups].forEach((groupIds) => {
    const groupQuestions = hydratedQuestions.filter((q) => groupIds.includes(q.id));
    const scriptDonor = groupQuestions.find((q) => q.audioScript && q.audioScript.trim().length > 0);
    if (scriptDonor) {
      groupQuestions.forEach((q) => {
        if (!q.audioScript) q.audioScript = scriptDonor.audioScript;
        if (!q.audioScriptTranslation && scriptDonor.audioScriptTranslation) {
          q.audioScriptTranslation = scriptDonor.audioScriptTranslation;
        }
      });
    }
  });

  // Normalize Writing Tasks
  const blankWriting = createBlankWritingTasksTemplate();
  const rawWriting = Array.isArray(rawParsed.writingTasks) ? rawParsed.writingTasks : [];
  const normalizedWritingTasks: WritingTask[] = [0, 1].map((idx) => {
    const partNum = (idx + 1) as 1 | 2;
    const foundW =
      rawWriting.find((w: any) => Number(w?.partNumber) === partNum) || rawWriting[idx];
    if (!foundW) return SAMPLE_B1_WRITING_TASKS[idx] || blankWriting[idx];
    return {
      ...blankWriting[idx],
      id: `task-${partNum}`,
      partNumber: partNum,
      title: foundW.title || blankWriting[idx].title,
      instruction: foundW.instruction || blankWriting[idx].instruction,
      stimulusText: foundW.stimulusText || foundW.prompt || foundW.context || '',
      imageUrl: foundW.imageUrl || '',
      imageCaption: foundW.imageCaption || '',
      bulletPoints:
        Array.isArray(foundW.bulletPoints) && foundW.bulletPoints.length > 0
          ? foundW.bulletPoints.map((b: any) => String(b))
          : blankWriting[idx].bulletPoints,
      minWords: Number(foundW.minWords) || blankWriting[idx].minWords,
      maxWords: Number(foundW.maxWords) || blankWriting[idx].maxWords,
      marks: 10,
      sampleAnswer: foundW.sampleAnswer || '',
    };
  });

  // Normalize Speaking Tasks (3 Parts: Part 1 Social Interaction, Part 2 Solution Discussion, Part 3 Topic Development + Mind-map)
  const blankSpeaking = createBlankSpeakingTasksTemplate();
  const rawSpeaking = Array.isArray(rawParsed.speakingTasks) ? rawParsed.speakingTasks : [];
  const normalizedSpeakingTasks: SpeakingTask[] = [0, 1, 2].map((idx) => {
    const partNum = (idx + 1) as 1 | 2 | 3;
    const foundS =
      rawSpeaking.find((s: any) => Number(s?.partNumber) === partNum) || rawSpeaking[idx];
    if (!foundS) return SAMPLE_VSTEP_SPEAKING_TASKS[idx] || blankSpeaking[idx];

    const baseTask = blankSpeaking[idx];
    return {
      ...baseTask,
      id: `speaking-part-${partNum}`,
      partNumber: partNum,
      title: foundS.title || baseTask.title,
      durationMinutes: Number(foundS.durationMinutes) || baseTask.durationMinutes,
      prepSeconds: foundS.prepSeconds !== undefined ? Number(foundS.prepSeconds) : baseTask.prepSeconds,
      speakSeconds: Number(foundS.speakSeconds) || baseTask.speakSeconds,
      instruction: foundS.instruction || baseTask.instruction,
      topicClusters:
        Array.isArray(foundS.topicClusters) && foundS.topicClusters.length > 0
          ? foundS.topicClusters.map((tc: any) => ({
              topicTitle: String(tc?.topicTitle || tc?.title || tc?.topic || ''),
              questions: Array.isArray(tc?.questions)
                ? tc.questions.map((q: any) => String(q))
                : [''],
            }))
          : baseTask.topicClusters,
      situation: foundS.situation !== undefined ? String(foundS.situation) : baseTask.situation,
      options:
        Array.isArray(foundS.options) && foundS.options.length > 0
          ? foundS.options.map((o: any) => String(o))
          : baseTask.options,
      topicStatement:
        foundS.topicStatement !== undefined
          ? String(foundS.topicStatement)
          : foundS.topic !== undefined
          ? String(foundS.topic)
          : baseTask.topicStatement,
      mindMap: foundS.mindMap
        ? {
            centralIdea: String(foundS.mindMap.centralIdea || foundS.mindMap.center || ''),
            nodes: Array.isArray(foundS.mindMap.nodes)
              ? foundS.mindMap.nodes.map((n: any) => String(n))
              : baseTask.mindMap?.nodes || [],
          }
        : baseTask.mindMap,
      followUpQuestions:
        Array.isArray(foundS.followUpQuestions) && foundS.followUpQuestions.length > 0
          ? foundS.followUpQuestions.map((fq: any) => String(fq))
          : baseTask.followUpQuestions,
      sampleAnswer: foundS.sampleAnswer || '',
      vietnameseTranslation: foundS.vietnameseTranslation || '',
    };
  });

  // Normalize Vocabulary if present
  let normalizedVocabulary: any[] = [];
  if (Array.isArray(rawParsed.vocabulary)) {
    normalizedVocabulary = rawParsed.vocabulary
      .map((v: any, i: number) => ({
        id: String(v.id || `vocab-test-${i + 1}`),
        word: String(v.word || '').trim(),
        phonetic: String(v.phonetic || ''),
        partOfSpeech: String(v.partOfSpeech || 'n.'),
        meaningVi: String(v.meaningVi || ''),
        exampleEn: String(v.exampleEn || ''),
        exampleVi: String(v.exampleVi || ''),
        topic: String(v.topic || 'Từ vựng VSTEP theo đề thi'),
        cefr: v.cefr || ('B2' as const),
      }))
      .filter((v: any) => v.word.length > 0);
  }

  return {
    title: String(rawParsed.title || 'VSTEP B1-B2-C1 Practice Test'),
    subtitle: String(
      rawParsed.subtitle ||
        'Đề luyện thi chuẩn cấu trúc 4 kỹ năng VSTEP B1-B2-C1 (Listening 35 câu · Reading 40 câu · Writing 2 bài · Speaking 3 phần)'
    ),
    durationMinutes: Number(rawParsed.durationMinutes) || 172,
    audioUrl: rawParsed.audioUrl || '',
    audioFileName: rawParsed.audioFileName || '',
    audioMode: rawParsed.audioMode || 'single',
    partAudioUrls: rawParsed.partAudioUrls || {},
    questions: hydratedQuestions,
    writingTasks: normalizedWritingTasks,
    speakingTasks: normalizedSpeakingTasks,
    vocabulary: normalizedVocabulary,
  };
}

/**
 * Returns a comprehensive copy-paste Master Prompt that the user can paste into ChatGPT/Claude/Gemini
 * alongside the downloaded JSON Master Guide and their VSTEP PDF/images.
 */
export function getAiExtractionMasterPromptText(): string {
  return `ĐÓNG VAI CHUYÊN GIA KHẢO THÍ VSTEP (B1-B2-C1) CỦA BỘ GIÁO DỤC & ĐÀO TẠO:
Hãy đọc kỹ mục "_AI_MASTER_EXTRACTION_PROMPT_AND_RULES" trong file JSON mẫu đính kèm, sau đó trích xuất TOÀN BỘ đề thi VSTEP 4 Kỹ Năng (Listening, Reading, Writing, Speaking) từ file PDF / ảnh chụp đề thi tôi gửi thành 1 file JSON chuẩn mực duy nhất.

⚠️ CÁC YẾU TỐ ĐẶC THÙ CỦA KỲ THI VSTEP 4 KỸ NĂNG BẮT BUỘC PHẢI TUÂN THỦ 100%:
1. QUY ƯỚC ID 75 CÂU HỎI TRẮC NGHIỆM (LISTENING & READING):
   - LISTENING (35 câu, 4 lựa chọn A, B, C, D):
     • Part 1 (8 thông báo ngắn): "section": "LISTENING", "partNumber": 1, "id": từ 1 đến 8.
     • Part 2 (3 đoạn hội thoại × 4 câu): "section": "LISTENING", "partNumber": 2, "id": từ 9 đến 20 (Hội thoại 1: 9-12, Hội thoại 2: 13-16, Hội thoại 3: 17-20).
     • Part 3 (3 bài nói/bài giảng × 5 câu): "section": "LISTENING", "partNumber": 3, "id": từ 21 đến 35 (Bài giảng 1: 21-25, Bài giảng 2: 26-30, Bài giảng 3: 31-35).
   - READING (40 câu, 4 bài đọc Passages 1-4, mỗi bài 10 câu A, B, C, D):
     • Passage 1 (Câu 1–10 trên đề giấy): "section": "READING", "partNumber": 1, "id": từ 36 đến 45.
     • Passage 2 (Câu 11–20 trên đề giấy): "section": "READING", "partNumber": 2, "id": từ 46 đến 55.
     • Passage 3 (Câu 21–30 trên đề giấy): "section": "READING", "partNumber": 3, "id": từ 56 đến 65.
     • Passage 4 (Câu 31–40 trên đề giấy): "section": "READING", "partNumber": 4, "id": từ 66 đến 75.

2. BẢO TOÀN 100% CHỮ GẠCH CHÂN, IN ĐẬM, HIGHLIGHT & Ô VUÔNG CHÈN CÂU TRONG BÀI ĐỌC VSTEP:
   - Trong mảng "readingArticle.paragraphs" VÀ trong "prompt" của câu hỏi, BẮT BUỘC bọc chính xác các từ/cụm từ được gạch chân hoặc in đậm trên đề gốc bằng thẻ HTML: <u><b>từ_vựng</b></u> hoặc <mark>cụm_từ_highlight</mark>.
   - Nếu bài đọc có các ô vuông chèn câu (Insertion question), giữ nguyên ký hiệu [A], [B], [C], [D] trong đoạn văn.

3. ĐẦY ĐỦ ĐÁP ÁN, SCRIPT, BẢN DỊCH SONG NGỮ, GIẢI THÍCH & BẰNG CHỨNG NGUYÊN VĂN (EVIDENCE QUOTE):
   - "correctAnswer": Đáp án đúng ("A", "B", "C", hoặc "D").
   - "evidenceQuote": BẮT BUỘC trích dẫn NGUYÊN VĂN 100% câu văn chứa đáp án trong Audio Script hoặc Reading Passage.
   - "explanation", "vietnameseTranslation", "audioScript", "audioScriptTranslation", "readingArticle", "readingArticleTranslation".

4. WRITING (2 BÀI VIẾT VSTEP — 60 PHÚT):
   - Task 1 (partNumber: 1, tối thiểu 120 từ, trọng số 1/3): Viết thư/email ("stimulusText" chứa nội dung bức thư gốc trong khung nét đứt).
   - Task 2 (partNumber: 2, tối thiểu 250 từ, trọng số 2/3): Viết bài luận Essay ("stimulusText" chứa chủ đề nghị luận trong khung nét đứt) kèm "sampleAnswer".

5. SPEAKING (3 PHẦN THI NÓI VSTEP — 12 PHÚT) TRONG MẢNG "speakingTasks":
   - Part 1 (partNumber: 1, Social Interaction 3'): Mảng "topicClusters" gồm 2 chủ đề ("Let's talk about..."), mỗi chủ đề 3 câu hỏi nhỏ.
   - Part 2 (partNumber: 2, Solution Discussion 4'): Trường "situation" (tình huống thảo luận) và mảng "options" (3 phương án lựa chọn).
   - Part 3 (partNumber: 3, Topic Development 5'): Trường "topicStatement" (câu chủ đề), object "mindMap": { "centralIdea": "Ô trung tâm", "nodes": ["Nhánh trái", "Nhánh phải", "Nhánh dưới", "[Your own ideas]"] } giống hệt sơ đồ tư duy trên đề gốc, và mảng "followUpQuestions" (3 câu hỏi thảo luận mở rộng) kèm "sampleAnswer".`;
}

/**
 * Generates the comprehensive VSTEP B1-B2-C1 AI Master Instruction + 4-Skill (75 Qs + 2 Writing + 3 Speaking) JSON Template.
 */
export function getSampleTestJsonTemplate(): string {
  const masterGuideAndTemplate = {
    _AI_MASTER_EXTRACTION_PROMPT_AND_RULES: {
      DIRECTIVE_FOR_ANY_AI_MODEL:
        'QUAN TRỌNG — ĐỌC ĐẦU TIÊN: Khi người dùng tải file JSON này lên kèm theo file PDF/Word/ảnh chụp của đề thi VSTEP B1-B2-C1 4 kỹ năng (Listening, Reading, Writing, Speaking), BẠN PHẢI ĐÓNG VAI CHUYÊN GIA KHẢO THÍ VSTEP CỦA BỘ GD&ĐT VÀ TRÍCH XUẤT TOÀN BỘ ĐỀ THI THÀNH 1 FILE JSON HOÀN CHỈNH KHỚP 100% VỚI CẤU TRÚC CỦA FILE NÀY.',
      STEP_BY_STEP_VSTEP_EXTRACTION_RULES: {
        RULE_1_75_QUESTION_ID_MAPPING:
          'Hệ thống sử dụng ID liên tục từ 1 đến 75: [Listening Part 1 (8 thông báo ngắn): id 1..8, partNumber: 1] | [Listening Part 2 (3 hội thoại × 4 câu): id 9..20, partNumber: 2] | [Listening Part 3 (3 bài giảng × 5 câu): id 21..35, partNumber: 3] | [Reading Passage 1 (Câu 1-10): id 36..45, partNumber: 1] | [Reading Passage 2 (Câu 11-20): id 46..55, partNumber: 2] | [Reading Passage 3 (Câu 21-30): id 56..65, partNumber: 3] | [Reading Passage 4 (Câu 31-40): id 66..75, partNumber: 4]. Mọi câu hỏi đều có 4 phương án options: A, B, C, D.',
        RULE_2_UNDERLINED_AND_HIGHLIGHTED_WORDS_IN_READING:
          'Đề thi VSTEP Reading có đặc trưng là gạch chân/in đậm các từ vựng và đại từ được hỏi trong bài đọc. Khi trích xuất mảng "readingArticle.paragraphs" và "prompt", BẮT BUỘC giữ nguyên định dạng gạch chân bằng thẻ <u><b>word</b></u>. Với câu hỏi chèn câu vào đoạn văn, giữ nguyên ký hiệu [A], [B], [C], [D].',
        RULE_3_VERBATIM_EVIDENCE_QUOTE_AND_EXPLANATION:
          'Mọi câu hỏi từ 1 đến 75 BẮT BUỘC phải có: 1) "evidenceQuote": câu trích dẫn NGUYÊN VĂN 100% từ bài đọc hoặc script chứng minh đáp án đúng. 2) "explanation": giải thích rõ ràng bằng tiếng Việt. 3) "vietnameseTranslation": bản dịch tiếng Việt của câu hỏi và 4 đáp án A, B, C, D.',
        RULE_4_LISTENING_SCRIPTS_AND_READING_PASSAGES:
          '1) Với Listening (id: 1..35): Điền đầy đủ "audioScript" và "audioScriptTranslation". 2) Với Reading (id: 36..75): Đặt object "readingArticle" và "readingArticleTranslation" vào câu đầu tiên của mỗi Passage (id: 36, 46, 56, 66).',
        RULE_5_WRITING_SPEAKING_AND_VOCABULARY:
          '1) Trích xuất đủ 2 bài viết VSTEP vào mảng "writingTasks": Task 1 (Thư/Email >= 120 từ) và Task 2 (Bài luận Essay >= 250 từ). 2) Trích xuất đủ 3 phần Nói VSTEP vào mảng "speakingTasks": Part 1 (Social Interaction 2 chủ đề), Part 2 (Solution Discussion tình huống + 3 lựa chọn), Part 3 (Topic Development kèm sơ đồ tư duy "mindMap": { "centralIdea": "...", "nodes": ["...", "...", "..."] } và 3 câu hỏi "followUpQuestions"). 3) Trích xuất 15-25 từ vựng B1-B2-C1 quan trọng vào mảng "vocabulary".',
      },
    },
    id: `vstep-custom-${Date.now()}`,
    title: 'VSTEP B1-B2-C1 Official 4-Skill Practice Test (Extracted by AI)',
    subtitle: 'Chuẩn cấu trúc 4 kỹ năng Bộ GD&ĐT (Listening 35 câu · Reading 40 câu · Writing 2 bài · Speaking 3 phần)',
    totalQuestions: 75,
    durationMinutes: 172,
    isAvailable: true,
    isCustom: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    creatorId: 'admin',
    creatorEmail: 'admin@vsteptutor.vn',
    audioMode: 'single',
    audioUrl: '',
    audioFileName: 'vstep_full_listening_audio.mp3',
    writingTasks: SAMPLE_B1_WRITING_TASKS,
    speakingTasks: SAMPLE_VSTEP_SPEAKING_TASKS,
    questions: compactQuestionsForStorage(TEST_1_QUESTIONS),
  };

  return JSON.stringify(masterGuideAndTemplate, null, 2);
}
