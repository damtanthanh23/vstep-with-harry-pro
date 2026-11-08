import { Question, UserExamAttempt, TestMetadata } from '../types/exam';
import { TEST_1_QUESTIONS } from '../data/test1Data';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface MistakeRecord {
  key: string; // `${testId}_${questionId}`
  testId: string;
  testTitle: string;
  questionId: number;
  section: 'LISTENING' | 'READING';
  partNumber: 1 | 2 | 3 | 4;
  userWrongAnswer: string;
  correctAnswer: string;
  wrongCount: number;
  mastered: boolean;
  lastWrongAt: number;
  masteredAt?: number;
  questionSnapshot: Question;
}

export const MISTAKES_UPDATED_EVENT = 'vstep_mistakes_updated';

function getStorageKey(uid?: string | null): string {
  return `langcert_mistakes_${uid || 'guest'}`;
}

export function getMistakeRecords(uid?: string | null): MistakeRecord[] {
  try {
    const raw =
      localStorage.getItem(getStorageKey(uid)) ||
      (uid ? localStorage.getItem(getStorageKey('guest')) : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  } catch {
    return [];
  }
}

async function pushMistakesToCloud(records: MistakeRecord[], uid?: string | null): Promise<void> {
  if (!uid || uid === 'guest' || auth.currentUser?.uid !== uid) return;
  try {
    const compactRecords = records.slice(0, 150).map((r) => ({
      key: r.key,
      testId: r.testId,
      testTitle: r.testTitle,
      questionId: r.questionId,
      section: r.section,
      partNumber: r.partNumber,
      userWrongAnswer: r.userWrongAnswer,
      correctAnswer: r.correctAnswer,
      wrongCount: r.wrongCount,
      mastered: Boolean(r.mastered),
      lastWrongAt: r.lastWrongAt,
      ...(r.masteredAt ? { masteredAt: r.masteredAt } : {}),
      questionSnapshot: r.questionSnapshot,
    }));
    const ref = doc(db, 'users', uid, 'vocab_state', 'mistakes_notebook');
    await setDoc(
      ref,
      {
        uid,
        updatedAt: Date.now(),
        records: compactRecords,
      },
      { merge: true }
    );
  } catch {
    // Ignore transient offline or quota errors
  }
}

export function saveMistakeRecords(records: MistakeRecord[], uid?: string | null, skipCloud = false): void {
  try {
    const sorted = [...records].sort((a, b) => b.lastWrongAt - a.lastWrongAt);
    localStorage.setItem(getStorageKey(uid), JSON.stringify(sorted));
    window.dispatchEvent(new CustomEvent(MISTAKES_UPDATED_EVENT, { detail: sorted }));
    if (!skipCloud && uid && uid !== 'guest') {
      pushMistakesToCloud(sorted, uid).catch(() => {});
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function syncMistakesWithCloud(params: {
  uid?: string | null;
  tests?: TestMetadata[];
  customQuestionsMap?: Record<string, Question[]>;
}): Promise<MistakeRecord[]> {
  const { uid, customQuestionsMap = {} } = params;
  const localRecords = getMistakeRecords(uid);
  if (!uid || uid === 'guest' || auth.currentUser?.uid !== uid) {
    return localRecords;
  }

  try {
    const ref = doc(db, 'users', uid, 'vocab_state', 'mistakes_notebook');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (localRecords.length > 0) {
        await pushMistakesToCloud(localRecords, uid);
      }
      return localRecords;
    }

    const data = snap.data();
    const cloudList: MistakeRecord[] = Array.isArray(data?.records) ? data.records : [];
    const byKey = new Map<string, MistakeRecord>();

    localRecords.forEach((r) => byKey.set(r.key, r));

    let localChanged = false;
    cloudList.forEach((cloudRec) => {
      if (!cloudRec || !cloudRec.key) return;
      const questionsForTest = customQuestionsMap[cloudRec.testId] || TEST_1_QUESTIONS;
      const foundQ = questionsForTest.find((q) => q.id === cloudRec.questionId);
      const hydratedSnapshot =
        cloudRec.questionSnapshot ||
        (foundQ ? resolveFullContextQuestion(foundQ, questionsForTest) : undefined);
      if (!hydratedSnapshot) return;

      const existing = byKey.get(cloudRec.key);
      if (!existing) {
        byKey.set(cloudRec.key, {
          ...cloudRec,
          questionSnapshot: hydratedSnapshot,
        });
        localChanged = true;
      } else {
        const localLatestAction = Math.max(existing.masteredAt || 0, existing.lastWrongAt || 0);
        const cloudLatestAction = Math.max(cloudRec.masteredAt || 0, cloudRec.lastWrongAt || 0);
        const useCloudStatus = cloudLatestAction > localLatestAction;
        const mergedMastered = useCloudStatus ? Boolean(cloudRec.mastered) : Boolean(existing.mastered);
        const mergedMasteredAt = useCloudStatus ? cloudRec.masteredAt : existing.masteredAt;
        const mergedWrongCount = Math.max(existing.wrongCount || 1, cloudRec.wrongCount || 1);
        const mergedLastWrongAt = Math.max(existing.lastWrongAt || 0, cloudRec.lastWrongAt || 0);

        if (
          mergedMastered !== existing.mastered ||
          mergedWrongCount !== existing.wrongCount ||
          mergedLastWrongAt !== existing.lastWrongAt
        ) {
          byKey.set(cloudRec.key, {
            ...existing,
            wrongCount: mergedWrongCount,
            mastered: mergedMastered,
            masteredAt: mergedMasteredAt,
            lastWrongAt: mergedLastWrongAt,
            userWrongAnswer:
              (cloudRec.lastWrongAt || 0) > (existing.lastWrongAt || 0)
                ? cloudRec.userWrongAnswer
                : existing.userWrongAnswer,
          });
          localChanged = true;
        }
      }
    });

    const merged = Array.from(byKey.values()).sort((a, b) => b.lastWrongAt - a.lastWrongAt);
    if (localChanged) {
      saveMistakeRecords(merged, uid, true);
    }
    if (merged.length !== cloudList.length || localChanged) {
      pushMistakesToCloud(merged, uid).catch(() => {});
    }
    return merged;
  } catch {
    return localRecords;
  }
}

function resolveFullContextQuestion(q: Question, allQuestionsInTest: Question[]): Question {
  if (q.section === 'READING' && !q.readingArticle && !q.multiTextCards) {
    const groupHead = allQuestionsInTest.find(
      (item) =>
        item.section === 'READING' &&
        item.partNumber === q.partNumber &&
        (item.readingArticle || item.multiTextCards)
    );
    if (groupHead) {
      return {
        ...q,
        readingArticle: q.readingArticle || groupHead.readingArticle,
        readingArticleTranslation:
          q.readingArticleTranslation || groupHead.readingArticleTranslation,
        multiTextCards: q.multiTextCards || groupHead.multiTextCards,
      };
    }
  }
  return q;
}

export function recordSingleMistake(params: {
  uid?: string | null;
  testId: string;
  testTitle: string;
  question: Question;
  allQuestionsInTest?: Question[];
  userAnswer: string;
}): void {
  const { uid, testId, testTitle, question, allQuestionsInTest = [], userAnswer } = params;
  const trimmed = (userAnswer || '').trim();
  if (!trimmed) return;
  if (question.section !== 'LISTENING' && question.section !== 'READING') return;

  const correctStr = Array.isArray(question.correctAnswer)
    ? question.correctAnswer[0] || ''
    : String(question.correctAnswer || '');

  const isCorrect = Array.isArray(question.correctAnswer)
    ? question.correctAnswer.some((a) => a.trim().toLowerCase() === trimmed.toLowerCase())
    : correctStr.trim().toLowerCase() === trimmed.toLowerCase();

  if (isCorrect) return;

  const existing = getMistakeRecords(uid);
  const key = `${testId}_${question.id}`;
  const idx = existing.findIndex((r) => r.key === key);
  const snapshot = resolveFullContextQuestion(question, allQuestionsInTest);
  const section: 'LISTENING' | 'READING' =
    question.section === 'LISTENING' ? 'LISTENING' : 'READING';

  if (idx !== -1) {
    existing[idx] = {
      ...existing[idx],
      testTitle: testTitle || existing[idx].testTitle,
      userWrongAnswer: trimmed,
      correctAnswer: correctStr,
      wrongCount: (existing[idx].wrongCount || 1) + 1,
      mastered: false,
      lastWrongAt: Date.now(),
      questionSnapshot: snapshot,
    };
  } else {
    existing.unshift({
      key,
      testId,
      testTitle,
      questionId: question.id,
      section,
      partNumber: question.partNumber,
      userWrongAnswer: trimmed,
      correctAnswer: correctStr,
      wrongCount: 1,
      mastered: false,
      lastWrongAt: Date.now(),
      questionSnapshot: snapshot,
    });
  }

  saveMistakeRecords(existing, uid);
}

export function recordMistakesFromAttempt(params: {
  uid?: string | null;
  testId: string;
  testTitle: string;
  questions: Question[];
  answers: Record<number, string>;
  selectedParts?: string[];
}): number {
  const { uid, testId, testTitle, questions, answers, selectedParts } = params;
  const existing = getMistakeRecords(uid);
  const byKey = new Map<string, MistakeRecord>(existing.map((r) => [r.key, r]));
  let addedOrUpdated = 0;

  const partSet =
    selectedParts && selectedParts.length > 0 ? new Set(selectedParts) : null;

  questions.forEach((q) => {
    if (q.section !== 'LISTENING' && q.section !== 'READING') return;
    const section: 'LISTENING' | 'READING' =
      q.section === 'LISTENING' ? 'LISTENING' : 'READING';
    const partKey = `${section === 'LISTENING' ? 'L' : 'R'}${q.partNumber}`;
    if (partSet && !partSet.has(partKey)) return;

    const userVal = (answers[q.id] || '').trim();
    if (!userVal) return; // Only record questions where the student selected a wrong answer

    const correctStr = Array.isArray(q.correctAnswer)
      ? q.correctAnswer[0] || ''
      : String(q.correctAnswer || '');

    const isCorrect = Array.isArray(q.correctAnswer)
      ? q.correctAnswer.some((a) => a.trim().toLowerCase() === userVal.toLowerCase())
      : correctStr.trim().toLowerCase() === userVal.toLowerCase();

    if (!isCorrect) {
      const key = `${testId}_${q.id}`;
      const prev = byKey.get(key);
      const snapshot = resolveFullContextQuestion(q, questions);

      if (prev) {
        byKey.set(key, {
          ...prev,
          testTitle: testTitle || prev.testTitle,
          userWrongAnswer: userVal,
          correctAnswer: correctStr,
          wrongCount: (prev.wrongCount || 1) + 1,
          mastered: false,
          lastWrongAt: Date.now(),
          questionSnapshot: snapshot,
        });
      } else {
        byKey.set(key, {
          key,
          testId,
          testTitle,
          questionId: q.id,
          section,
          partNumber: q.partNumber,
          userWrongAnswer: userVal,
          correctAnswer: correctStr,
          wrongCount: 1,
          mastered: false,
          lastWrongAt: Date.now(),
          questionSnapshot: snapshot,
        });
      }
      addedOrUpdated += 1;
    }
  });

  if (addedOrUpdated > 0) {
    saveMistakeRecords(Array.from(byKey.values()), uid);
  }
  return addedOrUpdated;
}

export function syncMistakesFromHistoricalAttempts(params: {
  uid?: string | null;
  attempts: UserExamAttempt[];
  tests: TestMetadata[];
  customQuestionsMap?: Record<string, Question[]>;
}): MistakeRecord[] {
  const { uid, attempts, tests, customQuestionsMap = {} } = params;
  const existing = getMistakeRecords(uid);
  const byKey = new Map<string, MistakeRecord>(existing.map((r) => [r.key, r]));
  let changed = false;

  // Sort attempts oldest to newest so latest state wins
  const sortedAttempts = [...attempts].sort((a, b) => a.completedAt - b.completedAt);

  sortedAttempts.forEach((attempt) => {
    if (!attempt.answers) return;
    const questions = customQuestionsMap[attempt.testId] || TEST_1_QUESTIONS;
    const testMeta = tests.find((t) => t.id === attempt.testId);
    const testTitle = attempt.testTitle || testMeta?.title || `Đề ${attempt.testId}`;

    Object.entries(attempt.answers).forEach(([qIdStr, userVal]) => {
      const qId = Number(qIdStr);
      const trimmed = (userVal || '').trim();
      if (!trimmed || Number.isNaN(qId)) return;

      const q = questions.find((item) => item.id === qId);
      if (!q || (q.section !== 'LISTENING' && q.section !== 'READING')) return;
      const section: 'LISTENING' | 'READING' =
        q.section === 'LISTENING' ? 'LISTENING' : 'READING';

      const correctStr = Array.isArray(q.correctAnswer)
        ? q.correctAnswer[0] || ''
        : String(q.correctAnswer || '');

      const isCorrect = Array.isArray(q.correctAnswer)
        ? q.correctAnswer.some((a) => a.trim().toLowerCase() === trimmed.toLowerCase())
        : correctStr.trim().toLowerCase() === trimmed.toLowerCase();

      if (!isCorrect) {
        const key = `${attempt.testId}_${q.id}`;
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            testId: attempt.testId,
            testTitle,
            questionId: q.id,
            section,
            partNumber: q.partNumber,
            userWrongAnswer: trimmed,
            correctAnswer: correctStr,
            wrongCount: 1,
            mastered: false,
            lastWrongAt: attempt.completedAt || Date.now(),
            questionSnapshot: resolveFullContextQuestion(q, questions),
          });
          changed = true;
        }
      }
    });
  });

  const merged = Array.from(byKey.values()).sort((a, b) => b.lastWrongAt - a.lastWrongAt);
  if (changed) {
    saveMistakeRecords(merged, uid);
  }
  return merged;
}

export function markMistakeMastered(key: string, mastered: boolean, uid?: string | null): MistakeRecord[] {
  const existing = getMistakeRecords(uid);
  const updated = existing.map((r) =>
    r.key === key
      ? {
          ...r,
          mastered,
          masteredAt: mastered ? Date.now() : undefined,
        }
      : r
  );
  saveMistakeRecords(updated, uid);
  return updated;
}

export function removeMistakeRecord(key: string, uid?: string | null): MistakeRecord[] {
  const existing = getMistakeRecords(uid);
  const updated = existing.filter((r) => r.key !== key);
  saveMistakeRecords(updated, uid);
  return updated;
}
