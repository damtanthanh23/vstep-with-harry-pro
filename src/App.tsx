/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TESTS_LIST } from './data/testsList';
import { TEST_1_QUESTIONS } from './data/test1Data';
import {
  Question,
  StimulusCard,
  ExamSection,
  TestMetadata,
  UserExamAttempt,
  InProgressAttempt,
  isDraftTest,
} from './types/exam';
import { TestSelectionView, SkillPackageType } from './components/TestSelectionView';
import { LandingPageView } from './components/LandingPageView';
import { LoginModal } from './components/LoginModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AiPdfUploadModal } from './components/AiPdfUploadModal';
import { InteractiveTranscriptModal } from './components/InteractiveTranscriptModal';
import { ExamHeader } from './components/ExamHeader';
import { ExamFooter } from './components/ExamFooter';
import { SummaryBoardDrawer } from './components/SummaryBoardDrawer';
import { SectionTransitionView } from './components/SectionTransitionView';
import { QuestionStage } from './components/QuestionStage';
import { SubmitModal } from './components/SubmitModal';
import { ResultsView } from './components/ResultsView';
import { ImageZoomModal } from './components/ImageZoomModal';
import { ExamBuilderView } from './components/ExamBuilderView';
import { AdminPinModal } from './components/AdminPinModal';
import { ExamHistoryModal } from './components/ExamHistoryModal';
import { WritingSectionStage } from './components/WritingSectionStage';
import { SpeakingSectionStage } from './components/SpeakingSectionStage';
import { WritingSubmission, SAMPLE_B1_WRITING_TASKS } from './types/writing';
import {
  SpeakingSubmission,
  EMPTY_SPEAKING_SUBMISSION,
  SAMPLE_VSTEP_SPEAKING_TASKS,
} from './types/speaking';
import {
  evaluateWritingStrictRubric,
  evaluateSpeakingStrictRubric,
  calculateExamResults,
} from './utils/scoringEngine';
import { examAudioManager } from './utils/audioManager';
import { useAuth, SUPER_ADMIN_EMAILS } from './context/AuthContext';
import {
  Lock,
  Pause,
  Play,
  Save,
  Clock,
  CheckSquare,
  Square,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  Sparkles,
  X,
  AlertTriangle,
} from 'lucide-react';
import {
  subscribeToCustomTests,
  subscribeToDeletedTestIds,
  deleteAnyTestFromSystem,
  saveTestToFirestore,
  recordUserAttempt,
  updateAttemptAiEvaluationInFirestore,
  fetchUserAttempts,
  saveInProgressAttemptToFirestore,
  fetchUserInProgressMap,
  clearInProgressAttemptFromFirestore,
  hydrateQuestionsFromStorage,
} from './services/examService';
import { getPartRelativeNumber } from './types/exam';
import { FeedbackModal, FeedbackContextData } from './components/FeedbackModal';
import { AdminFeedbackModal } from './components/AdminFeedbackModal';
import { FeedbackReport, subscribeToFeedbackReports } from './services/feedbackService';
import {
  recordStudyActivity,
  syncStreakWithCloudAndAttempts,
} from './services/streakService';
import {
  ExamOrderConfig,
  getLocalExamOrderConfig,
  subscribeToExamOrderConfig,
  sortTestsList,
} from './services/examOrderService';

// Define question groups matching the VSTEP 4-skill exam sections with Part-relative numbering
interface QuestionGroup {
  type: 'questions' | 'transition' | 'writing' | 'speaking';
  section: ExamSection;
  partNumber?: 1 | 2 | 3 | 4;
  partKey?: string; // e.g. 'L1'..'L3', 'R1'..'R4', 'W', 'S'
  rangeLabel: string;
  startId?: number;
  endId?: number;
  instructionText?: string;
  subInstruction?: string;
}

const QUESTION_GROUPS: QuestionGroup[] = [
  // Group 0: Listening Section Intro Transition Screen
  {
    type: 'transition',
    section: 'LISTENING',
    partKey: 'L_INTRO',
    rangeLabel: 'Listening Section Intro',
    instructionText: 'SKILL 1: LISTENING (3 Parts · 35 Questions · ~40 Minutes)',
  },
  // Group 1: Listening Part 1 (Global 1-8)
  {
    type: 'questions',
    section: 'LISTENING',
    partNumber: 1,
    partKey: 'L1',
    rangeLabel: 'Listening Part 1 · Câu 1–8',
    startId: 1,
    endId: 8,
    instructionText:
      'In this part, you will hear EIGHT short announcements or instructions. There is one question for each announcement or instruction. For each question, choose the right answer A, B, C or D.',
  },
  // Group 2: Listening Part 2 Conversation 1 (Global 9-12)
  {
    type: 'questions',
    section: 'LISTENING',
    partNumber: 2,
    partKey: 'L2',
    rangeLabel: 'Listening Part 2 · Câu 9–12 (Conv 1)',
    startId: 9,
    endId: 12,
    instructionText:
      'In this part, you will hear THREE conversations. The conversations will not be repeated. There are four questions for each conversation. For each question, choose the correct answer A, B, C or D.',
    subInstruction: 'Questions 9 to 12 — Listen to a conversation about the dogs.',
  },
  // Group 3: Listening Part 2 Conversation 2 (Global 13-16)
  {
    type: 'questions',
    section: 'LISTENING',
    partNumber: 2,
    partKey: 'L2',
    rangeLabel: 'Listening Part 2 · Câu 13–16 (Conv 2)',
    startId: 13,
    endId: 16,
    instructionText:
      'In this part, you will hear THREE conversations. The conversations will not be repeated. There are four questions for each conversation. For each question, choose the correct answer A, B, C or D.',
    subInstruction: 'Questions 13 to 16 — Listen to the conversation between two friends.',
  },
  // Group 4: Listening Part 2 Conversation 3 (Global 17-20)
  {
    type: 'questions',
    section: 'LISTENING',
    partNumber: 2,
    partKey: 'L2',
    rangeLabel: 'Listening Part 2 · Câu 17–20 (Conv 3)',
    startId: 17,
    endId: 20,
    instructionText:
      'In this part, you will hear THREE conversations. The conversations will not be repeated. There are four questions for each conversation. For each question, choose the correct answer A, B, C or D.',
    subInstruction: 'Questions 17 to 20 — Listen to a conversation between the waiter and the customer.',
  },
  // Group 5: Listening Part 3 Talk 1 (Global 21-25)
  {
    type: 'questions',
    section: 'LISTENING',
    partNumber: 3,
    partKey: 'L3',
    rangeLabel: 'Listening Part 3 · Câu 21–25 (Talk 1)',
    startId: 21,
    endId: 25,
    instructionText:
      'In this part, you will hear THREE talks or lectures. The talks or lectures will not be repeated. There are five questions for each talk or lecture. For each question, choose the right answer A, B, C or D.',
    subInstruction: 'Questions 21 to 25 — Listen to a talk about language learning.',
  },
  // Group 6: Listening Part 3 Talk 2 (Global 26-30)
  {
    type: 'questions',
    section: 'LISTENING',
    partNumber: 3,
    partKey: 'L3',
    rangeLabel: 'Listening Part 3 · Câu 26–30 (Talk 2)',
    startId: 26,
    endId: 30,
    instructionText:
      'In this part, you will hear THREE talks or lectures. The talks or lectures will not be repeated. There are five questions for each talk or lecture. For each question, choose the right answer A, B, C or D.',
    subInstruction: 'Questions 26 to 30 — Listen to a talk about two famous writers.',
  },
  // Group 7: Listening Part 3 Talk 3 (Global 31-35)
  {
    type: 'questions',
    section: 'LISTENING',
    partNumber: 3,
    partKey: 'L3',
    rangeLabel: 'Listening Part 3 · Câu 31–35 (Talk 3)',
    startId: 31,
    endId: 35,
    instructionText:
      'In this part, you will hear THREE talks or lectures. The talks or lectures will not be repeated. There are five questions for each talk or lecture. For each question, choose the right answer A, B, C or D.',
    subInstruction: 'Questions 31 to 35 — Listen to a lecture on psychology.',
  },
  // Group 8: Transition Screen to Reading
  {
    type: 'transition',
    section: 'READING',
    partKey: 'R_INTRO',
    rangeLabel: 'Transition to Reading',
    instructionText: 'SKILL 2: READING (4 Passages · 40 Questions · 60 Minutes)',
  },
  // Group 9: Reading Passage 1 (Global 36-45 -> Relative 1-10)
  {
    type: 'questions',
    section: 'READING',
    partNumber: 1,
    partKey: 'R1',
    rangeLabel: 'Reading Passage 1 · Câu 1–10',
    startId: 36,
    endId: 45,
    instructionText:
      'Directions: In this section of the test, you will read FOUR different passages, each followed by 10 questions about it. For questions 1-40, you have to choose the best answer A, B, C, or D, to each question.',
    subInstruction: 'PASSAGE 1 – QUESTIONS 1–10 (60 minutes for all 4 passages)',
  },
  // Group 10: Reading Passage 2 (Global 46-55 -> Relative 11-20)
  {
    type: 'questions',
    section: 'READING',
    partNumber: 2,
    partKey: 'R2',
    rangeLabel: 'Reading Passage 2 · Câu 11–20',
    startId: 46,
    endId: 55,
    instructionText:
      'Directions: Read Passage 2 carefully and choose the best answer A, B, C, or D to each question on the basis of what is stated or implied in the passage.',
    subInstruction: 'PASSAGE 2 – QUESTIONS 11–20',
  },
  // Group 11: Reading Passage 3 (Global 56-65 -> Relative 21-30)
  {
    type: 'questions',
    section: 'READING',
    partNumber: 3,
    partKey: 'R3',
    rangeLabel: 'Reading Passage 3 · Câu 21–30',
    startId: 56,
    endId: 65,
    instructionText:
      'Directions: Read Passage 3 carefully and choose the best answer A, B, C, or D to each question on the basis of what is stated or implied in the passage.',
    subInstruction: 'PASSAGE 3 – QUESTIONS 21–30',
  },
  // Group 12: Reading Passage 4 (Global 66-75 -> Relative 31-40)
  {
    type: 'questions',
    section: 'READING',
    partNumber: 4,
    partKey: 'R4',
    rangeLabel: 'Reading Passage 4 · Câu 31–40',
    startId: 66,
    endId: 75,
    instructionText:
      'Directions: Read Passage 4 carefully and choose the best answer A, B, C, or D to each question on the basis of what is stated or implied in the passage.',
    subInstruction: 'PASSAGE 4 – QUESTIONS 31–40',
  },
];

const ALL_PRACTICE_PARTS = [
  'L1',
  'L2',
  'L3',
  'R1',
  'R2',
  'R3',
  'R4',
  'W1',
  'W2',
  'S1',
  'S2',
  'S3',
];

const PART_METADATA: {
  key: string;
  section: 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING';
  label: string;
  questionCount: number;
  suggestedMinutes: number;
}[] = [
  { key: 'L1', section: 'LISTENING', label: 'Listening Part 1 (8 câu: Câu 1–8)', questionCount: 8, suggestedMinutes: 10 },
  { key: 'L2', section: 'LISTENING', label: 'Listening Part 2 (12 câu: Câu 9–20)', questionCount: 12, suggestedMinutes: 14 },
  { key: 'L3', section: 'LISTENING', label: 'Listening Part 3 (15 câu: Câu 21–35)', questionCount: 15, suggestedMinutes: 16 },
  { key: 'R1', section: 'READING', label: 'Reading Passage 1 (10 câu: Câu 1–10)', questionCount: 10, suggestedMinutes: 15 },
  { key: 'R2', section: 'READING', label: 'Reading Passage 2 (10 câu: Câu 11–20)', questionCount: 10, suggestedMinutes: 15 },
  { key: 'R3', section: 'READING', label: 'Reading Passage 3 (10 câu: Câu 21–30)', questionCount: 10, suggestedMinutes: 15 },
  { key: 'R4', section: 'READING', label: 'Reading Passage 4 (10 câu: Câu 31–40)', questionCount: 10, suggestedMinutes: 15 },
  { key: 'W1', section: 'WRITING', label: 'Writing Task 1 (Thư/Email ≥ 120 từ)', questionCount: 1, suggestedMinutes: 20 },
  { key: 'W2', section: 'WRITING', label: 'Writing Task 2 (Luận Essay ≥ 250 từ)', questionCount: 1, suggestedMinutes: 40 },
  { key: 'S1', section: 'SPEAKING', label: 'Speaking Part 1 (Social Interaction · 3 phút)', questionCount: 1, suggestedMinutes: 3 },
  { key: 'S2', section: 'SPEAKING', label: 'Speaking Part 2 (Solution Discussion · 4 phút)', questionCount: 1, suggestedMinutes: 4 },
  { key: 'S3', section: 'SPEAKING', label: 'Speaking Part 3 (Topic Development Mind-map · 5 phút)', questionCount: 1, suggestedMinutes: 5 },
];

export default function App() {
  const { currentUser, canManageExams } = useAuth();

  // Navigation Screens ('landing' | 'selection' | 'exam' | 'results' | 'builder')
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'selection' | 'exam' | 'results' | 'builder'>('landing');
  const [selectedTestId, setSelectedTestId] = useState<string>('test-1');
  const [examMode, setExamMode] = useState<'exam' | 'practice'>('exam');

  // Custom Tests & Deleted Tests from Firestore Realtime
  const [customTests, setCustomTests] = useState<TestMetadata[]>([]);
  const [customQuestionsMap, setCustomQuestionsMap] = useState<Record<string, Question[]>>({});
  const [deletedTestIds, setDeletedTestIds] = useState<string[]>([]);
  const [examOrderConfig, setExamOrderConfig] = useState<ExamOrderConfig>(() =>
    getLocalExamOrderConfig()
  );

  // In-Progress & Completed Maps
  const [inProgressMap, setInProgressMap] = useState<Record<string, InProgressAttempt>>({});
  const [completedScoresMap, setCompletedScoresMap] = useState<Record<string, number>>({});

  // Online / Auto-save status (Empty initially; only displayed when a real backup occurs)
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastSavedText, setLastSavedText] = useState<string>('');

  // Editing state for ExamBuilder
  const [editingTest, setEditingTest] = useState<TestMetadata | null>(null);
  const [editingQuestions, setEditingQuestions] = useState<Question[] | null>(null);
  const [pendingEditTestId, setPendingEditTestId] = useState<string | null>(null);

  // Modals
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [isAdminPinUnlocked, setIsAdminPinUnlocked] = useState<boolean>(
    () => sessionStorage.getItem('langcert_admin_unlocked') === 'true'
  );
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyFilterTestId, setHistoryFilterTestId] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAiPdfModalOpen, setIsAiPdfModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackContextData, setFeedbackContextData] = useState<FeedbackContextData | undefined>(undefined);
  const [isAdminFeedbackModalOpen, setIsAdminFeedbackModalOpen] = useState(false);
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReport[]>([]);
  const [scriptToggleCounter, setScriptToggleCounter] = useState(0);

  // Pre-Start Setup Modal state (Item 16)
  const [preStartModalOpen, setPreStartModalOpen] = useState<boolean>(false);
  const [pendingStartTestId, setPendingStartTestId] = useState<string>('test-1');
  const [selectedPartsForSession, setSelectedPartsForSession] = useState<string[]>(ALL_PRACTICE_PARTS);
  const [practiceTimerType, setPracticeTimerType] = useState<'suggested' | 'custom' | 'untimed'>('suggested');
  const [customMinutesInput, setCustomMinutesInput] = useState<number>(45);
  const [examSkillsSelected, setExamSkillsSelected] = useState<{
    listening: boolean;
    reading: boolean;
    writing: boolean;
    speaking: boolean;
  }>({
    listening: true,
    reading: true,
    writing: true,
    speaking: true,
  });

  // Skill package, Writing & Speaking state
  const [selectedSkillPackage, setSelectedSkillPackage] = useState<SkillPackageType>('LRWS');
  const [writingSubmission, setWritingSubmission] = useState<WritingSubmission>({
    task1Text: '',
    task1WordCount: 0,
    task2Text: '',
    task2WordCount: 0,
  });
  const [activeWritingTaskIndex, setActiveWritingTaskIndex] = useState<0 | 1>(0);

  const [speakingSubmission, setSpeakingSubmission] = useState<SpeakingSubmission>(
    EMPTY_SPEAKING_SUBMISSION
  );
  const [activeSpeakingPartIndex, setActiveSpeakingPartIndex] = useState<0 | 1 | 2>(0);

  // Active Attempt ID & Persisted AI Evaluations for ResultsView
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);
  const [activeWritingAiEval, setActiveWritingAiEval] = useState<any>(undefined);
  const [activeAiDiagnostic, setActiveAiDiagnostic] = useState<any>(null);

  // Exam Active State
  const [currentGroupIndex, setCurrentGroupIndex] = useState<number>(0);
  const [activeQuestionId, setActiveQuestionId] = useState<number>(1);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Record<number, boolean>>({});

  // Timers & Pause State (Items 11 & 15)
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(172 * 60);
  const [initialTimeSeconds, setInitialTimeSeconds] = useState<number>(172 * 60);
  const [isTimedSession, setIsTimedSession] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [totalPausedSeconds, setTotalPausedSeconds] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isTimeUpModalOpen, setIsTimeUpModalOpen] = useState<boolean>(false);

  const [isSummaryDrawerOpen, setIsSummaryDrawerOpen] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [zoomCard, setZoomCard] = useState<StimulusCard | null>(null);

  const [customAudioName, setCustomAudioName] = useState<string | undefined>(undefined);
  const [activeAudioBadgeLabel, setActiveAudioBadgeLabel] = useState<string | undefined>(undefined);
  // Temporary per-part local audio overrides (RAM only; never modifies database audio; resets on exam exit/finish)
  const [sessionPartAudioOverrides, setSessionPartAudioOverrides] = useState<
    Record<number, { url: string; fileName: string }>
  >({});

  const clearSessionLocalAudioOverrides = useCallback(() => {
    setSessionPartAudioOverrides((prev) => {
      Object.values(prev).forEach((entry) => {
        if (entry?.url?.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(entry.url);
          } catch {
            // Ignore
          }
        }
      });
      return {};
    });
    setCustomAudioName(undefined);
    setActiveAudioBadgeLabel(undefined);
  }, []);

  // Track Online / Offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Subscribe to Student Feedback / Bug Reports in real time
  useEffect(() => {
    const unsub = subscribeToFeedbackReports((reports) => {
      setFeedbackReports(reports);
    });
    return () => unsub();
  }, []);

  const unreadFeedbackCount = useMemo(
    () => feedbackReports.filter((r) => r.status === 'unread').length,
    [feedbackReports]
  );

  const openFeedbackWithContext = useCallback((ctx?: FeedbackContextData) => {
    setFeedbackContextData(ctx);
    setIsFeedbackModalOpen(true);
  }, []);

  // Load local custom tests, deleted test IDs, and subscribe to Firestore
  useEffect(() => {
    try {
      const rawBackup =
        localStorage.getItem('langcert_custom_tests_backup_v1') ||
        localStorage.getItem('langcert_custom_tests_backup');
      if (rawBackup) {
        const localTests: TestMetadata[] = JSON.parse(rawBackup);
        if (Array.isArray(localTests) && localTests.length > 0) {
          const hydratedLocalTests = localTests.map((t) => ({
            ...t,
            questions:
              t.questions && t.questions.length > 0
                ? hydrateQuestionsFromStorage(t.questions)
                : t.questions,
          }));
          setCustomTests(hydratedLocalTests);
          const localQMap: Record<string, Question[]> = {};
          hydratedLocalTests.forEach((t) => {
            if (t.questions && t.questions.length > 0) {
              localQMap[t.id] = t.questions;
            }
          });
          setCustomQuestionsMap((prev) => ({ ...prev, ...localQMap }));
        }
      }

      const rawDeleted = localStorage.getItem('langcert_deleted_test_ids');
      if (rawDeleted) {
        const parsedDel = JSON.parse(rawDeleted);
        if (Array.isArray(parsedDel)) setDeletedTestIds(parsedDel);
      }

      const rawInProg = localStorage.getItem('langcert_in_progress_map');
      if (rawInProg) {
        const parsedMap = JSON.parse(rawInProg);
        if (parsedMap && typeof parsedMap === 'object') {
          setInProgressMap(parsedMap);
        }
      }
    } catch (e) {
      console.warn('Could not read local backups:', e);
    }

    const unsubCustom = subscribeToCustomTests(
      (loadedCustomTests) => {
        setCustomTests((prev) => {
          const map = new Map<string, TestMetadata>();
          prev.forEach((t) => map.set(t.id, t));
          loadedCustomTests.forEach((t) => {
            const existing = map.get(t.id);
            if (!existing || (t.updatedAt || 0) >= (existing.updatedAt || 0)) {
              map.set(t.id, t);
            }
          });
          return Array.from(map.values());
        });
        const qMap: Record<string, Question[]> = {};
        loadedCustomTests.forEach((t) => {
          if (t.questions && t.questions.length > 0) {
            qMap[t.id] = t.questions;
          }
        });
        setCustomQuestionsMap((prev) => ({ ...prev, ...qMap }));
      },
      (err) => {
        console.warn('Firestore custom tests subscription notice:', err);
      }
    );

    const unsubDeleted = subscribeToDeletedTestIds((ids) => {
      setDeletedTestIds(ids);
      try {
        localStorage.setItem('langcert_deleted_test_ids', JSON.stringify(ids));
      } catch {
        // Ignore
      }
    });

    const unsubOrder = subscribeToExamOrderConfig((cfg) => {
      setExamOrderConfig(cfg);
    });

    return () => {
      unsubCustom();
      unsubDeleted();
      unsubOrder();
    };
  }, []);

  const inProgressStorageKey = `langcert_in_progress_map_${currentUser?.uid || 'guest'}`;

  // Load user's completed attempts & in-progress attempts from Firestore when logged in
  useEffect(() => {
    if (!currentUser) {
      try {
        const guestRaw = localStorage.getItem('langcert_in_progress_map_guest');
        setInProgressMap(guestRaw ? JSON.parse(guestRaw) : {});
      } catch {
        setInProgressMap({});
      }
      return;
    }

    const userMapKey = `langcert_in_progress_map_${currentUser.uid}`;
    let localUserMap: Record<string, InProgressAttempt> = {};
    try {
      const rawUserMap = localStorage.getItem(userMapKey) || localStorage.getItem('langcert_in_progress_map');
      if (rawUserMap) {
        const parsed = JSON.parse(rawUserMap);
        if (parsed && typeof parsed === 'object') {
          localUserMap = parsed;
          setInProgressMap(parsed);
        }
      }
    } catch {
      // Ignore
    }

    fetchUserAttempts(currentUser.uid)
      .then((attempts) => {
        const scores: Record<string, number> = {};
        attempts.forEach((a) => {
          if (scores[a.testId] === undefined || a.score > scores[a.testId]) {
            scores[a.testId] = a.score;
          }
        });
        setCompletedScoresMap(scores);
        syncStreakWithCloudAndAttempts(currentUser.uid, attempts).catch(() => {});
      })
      .catch(() => {
        syncStreakWithCloudAndAttempts(currentUser.uid, []).catch(() => {});
      });

    fetchUserInProgressMap(currentUser.uid)
      .then((remoteMap) => {
        setInProgressMap(() => {
          const merged: Record<string, InProgressAttempt> = { ...localUserMap };
          Object.entries(remoteMap).forEach(([tId, rAttempt]) => {
            const lAttempt = merged[tId];
            if (!lAttempt || (rAttempt.savedAt || 0) >= (lAttempt.savedAt || 0)) {
              merged[tId] = rAttempt;
            }
          });
          try {
            localStorage.setItem(userMapKey, JSON.stringify(merged));
            localStorage.setItem('langcert_in_progress_map', JSON.stringify(merged));
          } catch {
            // Ignore
          }
          // Backfill any local in-progress draft to Firestore so Admin sees real-time progress
          const entries = Object.values(merged);
          if (entries.length > 0) {
            const latestDraft = entries.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
            if (latestDraft && latestDraft.testId) {
              saveInProgressAttemptToFirestore(currentUser.uid, latestDraft).catch(() => {});
            }
          }
          return merged;
        });
      })
      .catch(() => {});
  }, [currentUser]);

  // Keep a mutable ref of rapidly changing timer/navigation state so auto-save never re-triggers on 1-second clock ticks
  const liveSessionMetricsRef = useRef({
    timeRemainingSeconds,
    elapsedSeconds,
    totalPausedSeconds,
    currentGroupIndex,
    activeQuestionId,
  });
  useEffect(() => {
    liveSessionMetricsRef.current = {
      timeRemainingSeconds,
      elapsedSeconds,
      totalPausedSeconds,
      currentGroupIndex,
      activeQuestionId,
    };
  }, [
    timeRemainingSeconds,
    elapsedSeconds,
    totalPausedSeconds,
    currentGroupIndex,
    activeQuestionId,
  ]);

  // Build current InProgressAttempt snapshot helper without depending on 1-second timer state
  const buildInProgressSnapshot = useCallback((): InProgressAttempt => {
    const metrics = liveSessionMetricsRef.current;
    const matchedTest =
      customTests.find((t) => t.id === selectedTestId) ||
      TESTS_LIST.find((t) => t.id === selectedTestId);
    return {
      testId: selectedTestId,
      testTitle: matchedTest?.title || 'Đề thi VSTEP',
      mode: examMode,
      selectedParts: selectedPartsForSession,
      answers,
      flagged,
      writingSubmission,
      speakingSubmission,
      timeRemainingSeconds: metrics.timeRemainingSeconds,
      elapsedSeconds: metrics.elapsedSeconds,
      totalPausedSeconds: metrics.totalPausedSeconds,
      currentGroupIndex: metrics.currentGroupIndex,
      activeQuestionId: metrics.activeQuestionId,
      savedAt: Date.now(),
    };
  }, [
    selectedTestId,
    customTests,
    examMode,
    selectedPartsForSession,
    answers,
    flagged,
    writingSubmission,
    speakingSubmission,
  ]);

  // Track last cloud sync timestamp so Firestore writes are throttled to at most once every 60 seconds
  const lastCloudSyncAtRef = useRef<number>(0);
  const pendingCloudSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2-Tier Smart Auto-Save:
  // Tier 1 (Local): Instant 800ms localStorage backup with compact 'Saved HH:MM:SS' timestamp (0 Firestore cost)
  // Tier 2 (Cloud): Throttled Firestore backup at most once every 60 seconds when changes occur
  useEffect(() => {
    if (currentScreen !== 'exam') return;

    const hasAnsweredAny = Object.values(answers).some((v) => v && v.trim().length > 0);
    const hasFlaggedAny = Object.values(flagged).some(Boolean);
    const hasWritingAny =
      writingSubmission.task1Text.trim().length > 0 ||
      writingSubmission.task2Text.trim().length > 0;
    const hasSpeakingAny =
      speakingSubmission.part1Text.trim().length > 0 ||
      speakingSubmission.part2Text.trim().length > 0 ||
      speakingSubmission.part3Text.trim().length > 0 ||
      Boolean(speakingSubmission.part1AudioDataUrl) ||
      Boolean(speakingSubmission.part2AudioDataUrl) ||
      Boolean(speakingSubmission.part3AudioDataUrl);

    if (!hasAnsweredAny && !hasFlaggedAny && !hasWritingAny && !hasSpeakingAny) {
      return;
    }

    // Immediately persist lightweight writing & speaking drafts to localStorage partitioned by user
    const uidPrefix = currentUser?.uid || 'guest';
    try {
      if (hasWritingAny) {
        localStorage.setItem(
          `langcert_writing_draft_${uidPrefix}_${selectedTestId}`,
          JSON.stringify(writingSubmission)
        );
        localStorage.setItem(
          `langcert_writing_draft_${selectedTestId}`,
          JSON.stringify(writingSubmission)
        );
      }
      if (hasSpeakingAny) {
        localStorage.setItem(
          `langcert_speaking_draft_${uidPrefix}_${selectedTestId}`,
          JSON.stringify(speakingSubmission)
        );
        localStorage.setItem(
          `langcert_speaking_draft_${selectedTestId}`,
          JSON.stringify(speakingSubmission)
        );
      }
    } catch {
      // Ignore storage quota errors
    }

    const debounceTimer = setTimeout(() => {
      const snap = buildInProgressSnapshot();
      try {
        localStorage.setItem(`langcert_inprogress_${uidPrefix}_${selectedTestId}`, JSON.stringify(snap));
        localStorage.setItem(`langcert_inprogress_${selectedTestId}`, JSON.stringify(snap));
        const rawMap = localStorage.getItem(inProgressStorageKey);
        const parsedMap = rawMap ? JSON.parse(rawMap) : {};
        parsedMap[selectedTestId] = snap;
        localStorage.setItem(inProgressStorageKey, JSON.stringify(parsedMap));
        localStorage.setItem('langcert_in_progress_map', JSON.stringify(parsedMap));
      } catch {
        // Ignore storage errors
      }

      const nowStr = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSavedText(`Saved ${nowStr}`);

      if (currentUser && isOnline) {
        const CLOUD_THROTTLE_MS = 60000;
        const elapsedSinceLastCloud = Date.now() - lastCloudSyncAtRef.current;

        if (elapsedSinceLastCloud >= CLOUD_THROTTLE_MS) {
          lastCloudSyncAtRef.current = Date.now();
          if (pendingCloudSyncTimerRef.current) {
            clearTimeout(pendingCloudSyncTimerRef.current);
            pendingCloudSyncTimerRef.current = null;
          }
          saveInProgressAttemptToFirestore(currentUser.uid, snap).catch(() => {});
        } else if (!pendingCloudSyncTimerRef.current) {
          const remainingWait = Math.max(5000, CLOUD_THROTTLE_MS - elapsedSinceLastCloud);
          pendingCloudSyncTimerRef.current = setTimeout(() => {
            pendingCloudSyncTimerRef.current = null;
            lastCloudSyncAtRef.current = Date.now();
            const latestSnap = buildInProgressSnapshot();
            saveInProgressAttemptToFirestore(currentUser.uid, latestSnap).catch(() => {});
          }, remainingWait);
        }
      }
    }, 800);

    return () => clearTimeout(debounceTimer);
  }, [
    currentScreen,
    selectedTestId,
    answers,
    flagged,
    writingSubmission,
    speakingSubmission,
    buildInProgressSnapshot,
    currentUser,
    isOnline,
    inProgressStorageKey,
  ]);

  // Immediate flush helper: bypasses 60s throttle when student switches sections, hides tab, or exits exam
  const flushInProgressToCloudImmediately = useCallback(() => {
    if (currentScreen !== 'exam') return;
    const hasAnsweredAny = Object.values(answers).some((v) => v && v.trim().length > 0);
    const hasFlaggedAny = Object.values(flagged).some(Boolean);
    const hasWritingAny =
      writingSubmission.task1Text.trim().length > 0 ||
      writingSubmission.task2Text.trim().length > 0;
    const hasSpeakingAny =
      speakingSubmission.part1Text.trim().length > 0 ||
      speakingSubmission.part2Text.trim().length > 0 ||
      speakingSubmission.part3Text.trim().length > 0 ||
      Boolean(speakingSubmission.part1AudioDataUrl) ||
      Boolean(speakingSubmission.part2AudioDataUrl) ||
      Boolean(speakingSubmission.part3AudioDataUrl);

    if (!hasAnsweredAny && !hasFlaggedAny && !hasWritingAny && !hasSpeakingAny) return;

    if (pendingCloudSyncTimerRef.current) {
      clearTimeout(pendingCloudSyncTimerRef.current);
      pendingCloudSyncTimerRef.current = null;
    }

    const snap = buildInProgressSnapshot();
    const uidPrefix = currentUser?.uid || 'guest';
    try {
      localStorage.setItem(`langcert_inprogress_${uidPrefix}_${selectedTestId}`, JSON.stringify(snap));
      const rawMap = localStorage.getItem(inProgressStorageKey);
      const parsedMap = rawMap ? JSON.parse(rawMap) : {};
      parsedMap[selectedTestId] = snap;
      localStorage.setItem(inProgressStorageKey, JSON.stringify(parsedMap));
      localStorage.setItem('langcert_in_progress_map', JSON.stringify(parsedMap));
    } catch {
      // Ignore
    }

    if (currentUser) {
      lastCloudSyncAtRef.current = Date.now();
      saveInProgressAttemptToFirestore(currentUser.uid, snap).catch(() => {});
    }
  }, [
    currentScreen,
    answers,
    flagged,
    writingSubmission,
    speakingSubmission,
    buildInProgressSnapshot,
    currentUser,
    selectedTestId,
    inProgressStorageKey,
  ]);

  // Flush to Cloud Firestore immediately when tab is hidden or page is closed during an active exam
  useEffect(() => {
    if (currentScreen !== 'exam') return;
    const handleVisibilityOrHide = () => {
      if (document.visibilityState === 'hidden') {
        flushInProgressToCloudImmediately();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrHide);
    window.addEventListener('pagehide', flushInProgressToCloudImmediately);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrHide);
      window.removeEventListener('pagehide', flushInProgressToCloudImmediately);
    };
  }, [currentScreen, flushInProgressToCloudImmediately]);

  // Combined tests list excluding deletedTestIds, sorted by Admin Cloud order & natural title order
  const allTests = useMemo(() => {
    const deletedSet = new Set(deletedTestIds);
    const customMap = new Map(customTests.map((t) => [t.id, t]));
    const mergedDefaults = TESTS_LIST.map((defTest) => {
      if (customMap.has(defTest.id)) {
        const override = customMap.get(defTest.id)!;
        customMap.delete(defTest.id);
        return override;
      }
      return defTest;
    });
    const remainingCustom = Array.from(customMap.values());
    const rawList = [...remainingCustom, ...mergedDefaults].filter((t) => !deletedSet.has(t.id));
    return sortTestsList(rawList, examOrderConfig, 'custom');
  }, [customTests, deletedTestIds, examOrderConfig]);

  // Role-filtered tests: Only Teachers and Admins can see Draft exams (status === 'draft' or categoryTag === 'Đề Nháp')
  const visibleTests = useMemo(() => {
    const isUnlocked =
      isAdminPinUnlocked || sessionStorage.getItem('langcert_admin_unlocked') === 'true';
    if (canManageExams || isUnlocked) {
      return allTests;
    }
    return allTests.filter((t) => !isDraftTest(t));
  }, [allTests, canManageExams, isAdminPinUnlocked]);

  // Current active test questions
  const activeExamQuestions = useMemo(() => {
    if (customQuestionsMap[selectedTestId]) {
      return customQuestionsMap[selectedTestId];
    }
    return TEST_1_QUESTIONS;
  }, [selectedTestId, customQuestionsMap]);

  // Active test metadata
  const activeTestMetadata = useMemo(() => {
    return allTests.find((t) => t.id === selectedTestId) || TESTS_LIST[0];
  }, [allTests, selectedTestId]);

  // Active question groups filtered by selectedPartsForSession
  const activeQuestionGroups = useMemo((): QuestionGroup[] => {
    const partSet = new Set(selectedPartsForSession);
    const hasAnyListening = ['L1', 'L2', 'L3'].some((k) => partSet.has(k));
    const hasAnyReading = ['R1', 'R2', 'R3', 'R4'].some((k) => partSet.has(k));
    const hasAnyWriting = partSet.has('W1') || partSet.has('W2');
    const hasAnySpeaking = ['S1', 'S2', 'S3'].some((k) => partSet.has(k));

    const groups: QuestionGroup[] = [];

    if (hasAnyListening) {
      groups.push(QUESTION_GROUPS[0]); // Listening intro
      QUESTION_GROUPS.forEach((g) => {
        if (g.type === 'questions' && g.section === 'LISTENING' && g.partKey && partSet.has(g.partKey)) {
          groups.push(g);
        }
      });
    }

    if (hasAnyReading) {
      if (hasAnyListening) {
        const readingIntro = QUESTION_GROUPS.find((g) => g.partKey === 'R_INTRO');
        if (readingIntro) groups.push(readingIntro);
      }
      QUESTION_GROUPS.forEach((g) => {
        if (g.type === 'questions' && g.section === 'READING' && g.partKey && partSet.has(g.partKey)) {
          groups.push(g);
        }
      });
    }

    if (hasAnyWriting) {
      if (hasAnyListening || hasAnyReading) {
        groups.push({
          type: 'transition',
          section: 'WRITING',
          partKey: 'W_INTRO',
          rangeLabel: 'Transition to Writing',
          instructionText: 'SKILL 3: WRITING (2 Tasks · 60 Minutes)',
        });
      }
      groups.push({
        type: 'writing',
        section: 'WRITING',
        partKey: 'W',
        rangeLabel: 'Writing Task 1 & Task 2',
        instructionText: 'VSTEP B1-B2-C1 Writing Section (Task 1: ≥120 words · Task 2: ≥250 words)',
      });
    }

    if (hasAnySpeaking) {
      if (hasAnyListening || hasAnyReading || hasAnyWriting) {
        groups.push({
          type: 'transition',
          section: 'SPEAKING',
          partKey: 'S_INTRO',
          rangeLabel: 'Transition to Speaking',
          instructionText: 'SKILL 4: SPEAKING (3 Parts · 12 Minutes)',
        });
      }
      groups.push({
        type: 'speaking',
        section: 'SPEAKING',
        partKey: 'S',
        rangeLabel: 'Speaking Part 1, Part 2 & Part 3',
        instructionText: 'VSTEP B1-B2-C1 Speaking Section (Part 1: 3m · Part 2: 4m · Part 3: 5m)',
      });
    }

    return groups.length > 0 ? groups : QUESTION_GROUPS;
  }, [selectedPartsForSession]);

  // Current Group & Questions
  const currentGroup = activeQuestionGroups[currentGroupIndex] || activeQuestionGroups[0];

  // Automatically configure & auto-play Listening Audio (with IndexedDB/Firestore recovery + Script fallback)
  useEffect(() => {
    if (currentScreen !== 'exam') return;

    if (currentGroup.section !== 'LISTENING') {
      examAudioManager.pause();
      setActiveAudioBadgeLabel(undefined);
      return;
    }

    const activePartNum = currentGroup.partNumber || 1;
    const partLabel = `Listening Part ${activePartNum}`;
    const partQuestions = activeExamQuestions.filter(
      (q) => q.section === 'LISTENING' && q.partNumber === activePartNum
    );
    const partFallbackScript = partQuestions
      .map((q) => q.audioScript)
      .filter(Boolean)
      .join(' ');

    // Always register fallback script for this Listening part so playback never fails
    examAudioManager.setPartScriptFallback(partFallbackScript, partLabel);

    const shouldAutoPlayNow = currentGroup.type === 'questions' && !isPaused;

    // 1. Temporary Local Fallback for THIS specific Listening Part only (does not touch database audio)
    const localPartOverride = sessionPartAudioOverrides[activePartNum];
    if (localPartOverride) {
      setCustomAudioName(localPartOverride.fileName);
      setActiveAudioBadgeLabel(`Local · Part ${activePartNum}`);
      examAudioManager.setCustomAudioUrl(
        localPartOverride.url,
        localPartOverride.fileName,
        shouldAutoPlayNow
      );
      return;
    }

    // 2. Per-Part Audio Mode configured in ExamBuilder (Database / IndexedDB)
    if (activeTestMetadata.audioMode === 'per_part' && currentGroup.partNumber) {
      const partKey = `part${currentGroup.partNumber}` as 'part1' | 'part2' | 'part3' | 'part4';
      const partUrl =
        activeTestMetadata.partAudioUrls?.[partKey] || activeTestMetadata.audioUrl || '';
      const partName =
        activeTestMetadata.partAudioFileNames?.[partKey] ||
        `Listening Part ${currentGroup.partNumber}`;

      setCustomAudioName(partName);
      setActiveAudioBadgeLabel(`Audio Part ${currentGroup.partNumber}`);

      if (partUrl) {
        examAudioManager.setCustomAudioUrl(partUrl, partName, shouldAutoPlayNow);
      } else if (shouldAutoPlayNow) {
        examAudioManager.autoPlayForListeningPart(partFallbackScript, partName);
      }
    } else if (activeTestMetadata.audioUrl) {
      // 3. Single Full-Test Audio Track configured in ExamBuilder (Database / IndexedDB)
      const fullAudioName = activeTestMetadata.audioFileName || 'Audio toàn bài';
      setCustomAudioName(fullAudioName);
      setActiveAudioBadgeLabel('Audio toàn bài');
      examAudioManager.setCustomAudioUrl(
        activeTestMetadata.audioUrl,
        fullAudioName,
        shouldAutoPlayNow
      );
    } else {
      // 4. Fallback Script Narration when no MP3 file is attached
      setCustomAudioName(undefined);
      setActiveAudioBadgeLabel(`Audio Part ${activePartNum}`);
      if (shouldAutoPlayNow) {
        examAudioManager.autoPlayForListeningPart(partFallbackScript, partLabel);
      }
    }
  }, [
    currentScreen,
    selectedTestId,
    sessionPartAudioOverrides,
    activeTestMetadata,
    activeExamQuestions,
    currentGroup.type,
    currentGroup.section,
    currentGroup.partNumber,
    isPaused,
  ]);

  // Master 1-Second Timer Effect handling Exam Countdown, Practice Elapsed, and Pause Break Clock
  useEffect(() => {
    if (currentScreen !== 'exam') return;

    const timer = setInterval(() => {
      if (isPaused) {
        // While paused: Freeze remaining time & elapsed study time; increment cumulative pause clock
        setTotalPausedSeconds((prev) => prev + 1);
      } else {
        // Active exam/practice: Increment elapsed study time
        setElapsedSeconds((prev) => prev + 1);

        if (isTimedSession) {
          setTimeRemainingSeconds((prev) => {
            if (prev <= 1) {
              setIsSubmitModalOpen(false);
              setIsTimeUpModalOpen(true);
              return 0;
            }
            return prev - 1;
          });
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentScreen, isPaused, isTimedSession]);

  const currentQuestions = useMemo(() => {
    if (currentGroup.type !== 'questions' || !currentGroup.startId || !currentGroup.endId) {
      return [];
    }
    return activeExamQuestions.filter(
      (q) => q.id >= currentGroup.startId! && q.id <= currentGroup.endId!
    );
  }, [currentGroup, activeExamQuestions]);

  // All questions belonging to the current Part (so ExamFooter shows full 1..N boxes for the active Part on 1 single row)
  const currentPartQuestionsForFooter = useMemo(() => {
    if (currentGroup.section === 'WRITING' || currentGroup.section === 'SPEAKING') return [];
    const targetPartNum = currentGroup.partNumber || 1;
    return activeExamQuestions.filter(
      (q) => q.section === currentGroup.section && q.partNumber === targetPartNum
    );
  }, [currentGroup, activeExamQuestions]);

  // Answered count & progress percentage
  const answeredCount = useMemo(() => {
    return Object.values(answers).filter((val) => val && val.trim().length > 0).length;
  }, [answers]);

  const progressPercent = Math.min(100, Math.round((answeredCount / 75) * 100));

  // Current active prompt audio script
  const activePromptAudioScript = useMemo(() => {
    const q = activeExamQuestions.find((item) => item.id === activeQuestionId);
    return q?.audioScript;
  }, [activeQuestionId, activeExamQuestions]);

  // Strict Writing Scores based on official VSTEP 4-criteria rubric
  const writingScores = useMemo(() => {
    const hasWriting =
      selectedPartsForSession.includes('W1') || selectedPartsForSession.includes('W2');
    if (!hasWriting) return undefined;

    const strictEval = evaluateWritingStrictRubric(
      writingSubmission,
      activeTestMetadata.writingTasks || SAMPLE_B1_WRITING_TASKS
    );
    return {
      task1Score: strictEval.task1Score,
      task2Score: strictEval.task2Score,
    };
  }, [selectedPartsForSession, writingSubmission, activeTestMetadata.writingTasks]);

  // Strict Speaking Scores based on official VSTEP 5-criteria rubric on 10-point scale
  const speakingScores = useMemo(() => {
    const hasSpeaking =
      selectedPartsForSession.includes('S1') ||
      selectedPartsForSession.includes('S2') ||
      selectedPartsForSession.includes('S3');
    if (!hasSpeaking) return undefined;

    const strictEval = evaluateSpeakingStrictRubric(
      speakingSubmission,
      activeTestMetadata.speakingTasks || SAMPLE_VSTEP_SPEAKING_TASKS
    );
    return {
      part1Score: strictEval.part1Score,
      part2Score: strictEval.part2Score,
      part3Score: strictEval.part3Score,
      overallBand10: strictEval.overallBand10,
    };
  }, [selectedPartsForSession, speakingSubmission, activeTestMetadata.speakingTasks]);

  // Calculate suggested minutes for selected practice parts
  const suggestedPracticeMinutes = useMemo(() => {
    return PART_METADATA.filter((p) => selectedPartsForSession.includes(p.key)).reduce(
      (acc, item) => acc + item.suggestedMinutes,
      0
    );
  }, [selectedPartsForSession]);

  // Open Pre-Start Setup Modal when user clicks "Thi thử" or "Luyện tập"
  const handleRequestStartTest = (
    testId: string,
    initialSection?: ExamSection,
    initialPart?: 1 | 2 | 3 | 4
  ) => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }

    setPendingStartTestId(testId);

    if (initialSection && initialPart) {
      const prefix =
        initialSection === 'LISTENING'
          ? 'L'
          : initialSection === 'READING'
          ? 'R'
          : initialSection === 'SPEAKING'
          ? 'S'
          : 'W';
      const partKey = `${prefix}${initialPart}`;
      setExamMode('practice');
      setSelectedPartsForSession([partKey]);
      setPracticeTimerType('suggested');
    } else {
      setSelectedPartsForSession(ALL_PRACTICE_PARTS);
      setExamSkillsSelected({
        listening: selectedSkillPackage !== 'W' && selectedSkillPackage !== 'S',
        reading: selectedSkillPackage !== 'W' && selectedSkillPackage !== 'S',
        writing: selectedSkillPackage === 'LRWS' || selectedSkillPackage === 'LRW' || selectedSkillPackage === 'W',
        speaking: selectedSkillPackage === 'LRWS' || selectedSkillPackage === 'S',
      });
    }

    setPreStartModalOpen(true);
  };

  // Resume an existing In-Progress attempt directly
  const handleResumeInProgressTest = (testId: string) => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }

    const saved = inProgressMap[testId];
    if (!saved) {
      handleRequestStartTest(testId);
      return;
    }

    clearSessionLocalAudioOverrides();
    setSelectedTestId(testId);
    setExamMode(saved.mode);
    setSelectedPartsForSession(
      saved.selectedParts && saved.selectedParts.length > 0
        ? saved.selectedParts
        : ALL_PRACTICE_PARTS
    );
    setAnswers(saved.answers || {});
    setFlagged(saved.flagged || {});
    const uidPrefix = currentUser?.uid || 'guest';
    // Restore writing submission from saved attempt or dedicated local draft backup
    let restoredWriting: WritingSubmission =
      saved.writingSubmission ||
      (saved as any).writingDraft || {
        task1Text: '',
        task1WordCount: 0,
        task2Text: '',
        task2WordCount: 0,
      };
    try {
      const rawDraft =
        localStorage.getItem(`langcert_writing_draft_${uidPrefix}_${testId}`) ||
        localStorage.getItem(`langcert_writing_draft_${testId}`);
      if (rawDraft) {
        const parsedDraft: WritingSubmission = JSON.parse(rawDraft);
        if (
          (parsedDraft.task1Text?.length || 0) > (restoredWriting.task1Text?.length || 0) ||
          (parsedDraft.task2Text?.length || 0) > (restoredWriting.task2Text?.length || 0)
        ) {
          restoredWriting = parsedDraft;
        }
      }
    } catch {
      // Ignore
    }

    let restoredSpeaking: SpeakingSubmission =
      saved.speakingSubmission || (saved as any).speakingDraft || EMPTY_SPEAKING_SUBMISSION;
    try {
      const rawSpeakingDraft =
        localStorage.getItem(`langcert_speaking_draft_${uidPrefix}_${testId}`) ||
        localStorage.getItem(`langcert_speaking_draft_${testId}`);
      if (rawSpeakingDraft) {
        const parsedSpeakingDraft: SpeakingSubmission = JSON.parse(rawSpeakingDraft);
        if (
          (parsedSpeakingDraft.part1Text?.length || 0) >= (restoredSpeaking.part1Text?.length || 0) &&
          (parsedSpeakingDraft.part2Text?.length || 0) >= (restoredSpeaking.part2Text?.length || 0) &&
          (parsedSpeakingDraft.part3Text?.length || 0) >= (restoredSpeaking.part3Text?.length || 0)
        ) {
          restoredSpeaking = parsedSpeakingDraft;
        }
      }
    } catch {
      // Ignore
    }

    setWritingSubmission(restoredWriting);
    setSpeakingSubmission(restoredSpeaking);
    setTimeRemainingSeconds(saved.timeRemainingSeconds || 172 * 60);
    setInitialTimeSeconds(saved.timeRemainingSeconds || 172 * 60);
    setIsTimedSession((saved.timeRemainingSeconds || 0) > 0);
    setElapsedSeconds(saved.elapsedSeconds || 0);
    setTotalPausedSeconds(saved.totalPausedSeconds || 0);
    setCurrentGroupIndex(saved.currentGroupIndex || 0);
    setActiveQuestionId(saved.activeQuestionId || 1);
    if (saved.savedAt) {
      const savedTimeStr = new Date(saved.savedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastSavedText(`Saved ${savedTimeStr}`);
    } else {
      setLastSavedText('');
    }
    setIsPaused(false);
    setIsSummaryDrawerOpen(false);
    setIsSubmitModalOpen(false);
    setPreStartModalOpen(false);
    setCurrentScreen('exam');
  };

  // Clear an existing In-Progress attempt and open Pre-Start Setup Modal to start fresh
  const handleRestartTestFromScratch = (testId: string) => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }

    const uidPrefix = currentUser?.uid || 'guest';
    setInProgressMap((prev) => {
      const next = { ...prev };
      delete next[testId];
      try {
        localStorage.setItem(inProgressStorageKey, JSON.stringify(next));
        localStorage.setItem('langcert_in_progress_map', JSON.stringify(next));
        localStorage.removeItem(`langcert_inprogress_${uidPrefix}_${testId}`);
        localStorage.removeItem(`langcert_inprogress_${testId}`);
        localStorage.removeItem(`langcert_writing_draft_${uidPrefix}_${testId}`);
        localStorage.removeItem(`langcert_writing_draft_${testId}`);
        localStorage.removeItem(`langcert_speaking_draft_${uidPrefix}_${testId}`);
        localStorage.removeItem(`langcert_speaking_draft_${testId}`);
      } catch {
        // Ignore
      }
      return next;
    });

    if (currentUser) {
      clearInProgressAttemptFromFirestore(currentUser.uid, testId).catch(() => {});
    }

    handleRequestStartTest(testId);
  };

  // Review a completed historical attempt in ResultsView
  const handleReviewHistoricalAttempt = (attempt: UserExamAttempt) => {
    setSelectedTestId(attempt.testId);
    setActiveAttemptId(attempt.attemptId);
    setActiveWritingAiEval(attempt.aiWritingEvaluation);
    setActiveAiDiagnostic(attempt.aiDiagnosticReport || null);
    setAnswers(attempt.answers || {});
    setWritingSubmission(
      attempt.writingSubmission || {
        task1Text: '',
        task1WordCount: 0,
        task2Text: '',
        task2WordCount: 0,
      }
    );
    setSpeakingSubmission(attempt.speakingSubmission || EMPTY_SPEAKING_SUBMISSION);
    if (attempt.selectedParts && attempt.selectedParts.length > 0) {
      setSelectedPartsForSession(attempt.selectedParts);
    } else {
      setSelectedPartsForSession(ALL_PRACTICE_PARTS);
    }
    setElapsedSeconds(attempt.timeSpentSeconds || 0);
    setIsHistoryModalOpen(false);
    setCurrentScreen('results');
  };

  // Launch fresh exam/practice session from the Pre-Start Modal
  const handleConfirmLaunchFromPreStart = () => {
    clearSessionLocalAudioOverrides();
    const testId = pendingStartTestId;
    setSelectedTestId(testId);
    setActiveAttemptId(null);
    setActiveWritingAiEval(undefined);
    setActiveAiDiagnostic(null);

    let partsToRun: string[] = [];
    let durationSec = 172 * 60;
    let timed = true;

    if (examMode === 'exam') {
      if (examSkillsSelected.listening) partsToRun.push('L1', 'L2', 'L3');
      if (examSkillsSelected.reading) partsToRun.push('R1', 'R2', 'R3', 'R4');
      if (examSkillsSelected.writing) partsToRun.push('W1', 'W2');
      if (examSkillsSelected.speaking) partsToRun.push('S1', 'S2', 'S3');
      if (partsToRun.length === 0) partsToRun = ALL_PRACTICE_PARTS;

      let mins = 0;
      if (examSkillsSelected.listening) mins += 40;
      if (examSkillsSelected.reading) mins += 60;
      if (examSkillsSelected.writing) mins += 60;
      if (examSkillsSelected.speaking) mins += 12;
      durationSec = (mins || 172) * 60;
      timed = true;
    } else {
      partsToRun = selectedPartsForSession.length > 0 ? selectedPartsForSession : ALL_PRACTICE_PARTS;
      if (practiceTimerType === 'untimed') {
        durationSec = 0;
        timed = false;
      } else if (practiceTimerType === 'custom') {
        durationSec = Math.max(1, customMinutesInput) * 60;
        timed = true;
      } else {
        durationSec = Math.max(3, suggestedPracticeMinutes) * 60;
        timed = true;
      }
    }

    setSelectedPartsForSession(partsToRun);
    setAnswers({});
    setFlagged({});
    setWritingSubmission({
      task1Text: '',
      task1WordCount: 0,
      task2Text: '',
      task2WordCount: 0,
    });
    setSpeakingSubmission(EMPTY_SPEAKING_SUBMISSION);
    setActiveSpeakingPartIndex(0);
    setLastSavedText('');
    setTimeRemainingSeconds(durationSec);
    setInitialTimeSeconds(durationSec);
    setIsTimedSession(timed);
    setElapsedSeconds(0);
    setTotalPausedSeconds(0);
    setIsPaused(false);
    setIsTimeUpModalOpen(false);

    // Clear previous in-progress for this test
    const uidPrefix = currentUser?.uid || 'guest';
    setInProgressMap((prev) => {
      const next = { ...prev };
      delete next[testId];
      try {
        localStorage.setItem(inProgressStorageKey, JSON.stringify(next));
        localStorage.setItem('langcert_in_progress_map', JSON.stringify(next));
        localStorage.removeItem(`langcert_inprogress_${uidPrefix}_${testId}`);
        localStorage.removeItem(`langcert_inprogress_${testId}`);
        localStorage.removeItem(`langcert_writing_draft_${uidPrefix}_${testId}`);
        localStorage.removeItem(`langcert_writing_draft_${testId}`);
        localStorage.removeItem(`langcert_speaking_draft_${uidPrefix}_${testId}`);
        localStorage.removeItem(`langcert_speaking_draft_${testId}`);
      } catch {
        // Ignore
      }
      return next;
    });
    if (currentUser) {
      clearInProgressAttemptFromFirestore(currentUser.uid, testId).catch(() => {});
    }

    // Set initial group and active question ID
    const firstQuestionPart = QUESTION_GROUPS.find(
      (g) => g.type === 'questions' && g.partKey && partsToRun.includes(g.partKey)
    );
    setCurrentGroupIndex(0);
    setActiveQuestionId(firstQuestionPart?.startId || 1);
    setIsSummaryDrawerOpen(false);
    setIsSubmitModalOpen(false);
    setPreStartModalOpen(false);
    setCurrentScreen('exam');
  };

  // Fix "Thi lại" button so it switches to 'selection' screen and opens Pre-Start Setup Modal (Item 2)
  const handleRetakeTest = () => {
    examAudioManager.pause();
    clearSessionLocalAudioOverrides();
    setIsPaused(false);
    setCurrentScreen('selection');
    handleRequestStartTest(selectedTestId);
  };

  const handleBackToTests = () => {
    examAudioManager.pause();
    clearSessionLocalAudioOverrides();
    if (currentScreen === 'exam') {
      const hasAnsweredAny = Object.values(answers).some((v) => v && v.trim().length > 0);
      const hasFlaggedAny = Object.values(flagged).some(Boolean);
      const hasWritingAny =
        writingSubmission.task1Text.trim().length > 0 ||
        writingSubmission.task2Text.trim().length > 0;
      const hasSpeakingAny =
        speakingSubmission.part1Text.trim().length > 0 ||
        speakingSubmission.part2Text.trim().length > 0 ||
        speakingSubmission.part3Text.trim().length > 0 ||
        Boolean(speakingSubmission.part1AudioDataUrl) ||
        Boolean(speakingSubmission.part2AudioDataUrl) ||
        Boolean(speakingSubmission.part3AudioDataUrl);

      if (hasAnsweredAny || hasFlaggedAny || hasWritingAny || hasSpeakingAny) {
        if (pendingCloudSyncTimerRef.current) {
          clearTimeout(pendingCloudSyncTimerRef.current);
          pendingCloudSyncTimerRef.current = null;
        }
        const snap = buildInProgressSnapshot();
        const uidPrefix = currentUser?.uid || 'guest';
        setInProgressMap((prev) => {
          const updated = { ...prev, [selectedTestId]: snap };
          try {
            localStorage.setItem(inProgressStorageKey, JSON.stringify(updated));
            localStorage.setItem('langcert_in_progress_map', JSON.stringify(updated));
            localStorage.setItem(`langcert_inprogress_${uidPrefix}_${selectedTestId}`, JSON.stringify(snap));
            localStorage.setItem(`langcert_inprogress_${selectedTestId}`, JSON.stringify(snap));
          } catch {
            // Ignore
          }
          return updated;
        });
        if (currentUser) {
          lastCloudSyncAtRef.current = Date.now();
          saveInProgressAttemptToFirestore(currentUser.uid, snap).catch(() => {});
        }
      }
    }
    setIsPaused(false);
    setCurrentScreen('selection');
  };

  // Save & Exit in Practice Mode (Item 11)
  const handleSaveAndExitPractice = () => {
    examAudioManager.pause();
    clearSessionLocalAudioOverrides();
    if (pendingCloudSyncTimerRef.current) {
      clearTimeout(pendingCloudSyncTimerRef.current);
      pendingCloudSyncTimerRef.current = null;
    }
    const snap = buildInProgressSnapshot();
    const uidPrefix = currentUser?.uid || 'guest';
    setInProgressMap((prev) => {
      const updated = { ...prev, [selectedTestId]: snap };
      try {
        localStorage.setItem(inProgressStorageKey, JSON.stringify(updated));
        localStorage.setItem('langcert_in_progress_map', JSON.stringify(updated));
        localStorage.setItem(`langcert_inprogress_${uidPrefix}_${selectedTestId}`, JSON.stringify(snap));
        localStorage.setItem(`langcert_inprogress_${selectedTestId}`, JSON.stringify(snap));
      } catch {
        // Ignore
      }
      return updated;
    });
    if (currentUser) {
      lastCloudSyncAtRef.current = Date.now();
      saveInProgressAttemptToFirestore(currentUser.uid, snap).catch(() => {});
    }
    const answeredCountNow = Object.values(answers).filter((v) => v && v.trim().length > 0).length;
    if (
      answeredCountNow > 0 ||
      writingSubmission.task1WordCount > 0 ||
      writingSubmission.task2WordCount > 0 ||
      speakingSubmission.part1WordCount > 0 ||
      speakingSubmission.part2WordCount > 0 ||
      speakingSubmission.part3WordCount > 0
    ) {
      recordStudyActivity(`Luyện tập đề: ${activeTestMetadata.title}`, currentUser?.uid);
    }
    setIsPaused(false);
    setCurrentScreen('selection');
  };

  const handleAnswerChange = (qId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  const handleToggleFlag = (qId: number) => {
    setFlagged((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const handleSelectQuestionFromSummary = (qId: number) => {
    setActiveQuestionId(qId);
    const groupIdx = activeQuestionGroups.findIndex(
      (g) => g.type === 'questions' && g.startId && g.endId && qId >= g.startId && qId <= g.endId
    );
    if (groupIdx !== -1) {
      setCurrentGroupIndex(groupIdx);
    }
  };

  const handleSelectWritingTaskFromSummary = (taskIndex: 0 | 1) => {
    const writingGroupIdx = activeQuestionGroups.findIndex((g) => g.type === 'writing');
    if (writingGroupIdx !== -1) {
      setCurrentGroupIndex(writingGroupIdx);
      setActiveWritingTaskIndex(taskIndex);
    }
  };

  const handleSelectSpeakingPartFromSummary = (partIndex: 0 | 1 | 2) => {
    const speakingGroupIdx = activeQuestionGroups.findIndex((g) => g.type === 'speaking');
    if (speakingGroupIdx !== -1) {
      setCurrentGroupIndex(speakingGroupIdx);
      setActiveSpeakingPartIndex(partIndex);
    }
  };

  const handleNextGroup = () => {
    flushInProgressToCloudImmediately();
    if (currentGroupIndex < activeQuestionGroups.length - 1) {
      const nextIdx = currentGroupIndex + 1;
      setCurrentGroupIndex(nextIdx);
      const nextGroup = activeQuestionGroups[nextIdx];
      if (nextGroup.startId) {
        setActiveQuestionId(nextGroup.startId);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevGroup = () => {
    flushInProgressToCloudImmediately();
    if (currentGroupIndex > 0) {
      const prevIdx = currentGroupIndex - 1;
      setCurrentGroupIndex(prevIdx);
      const prevGroup = activeQuestionGroups[prevIdx];
      if (prevGroup.startId) {
        setActiveQuestionId(prevGroup.startId);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Submit and save attempt to Firestore
  const submitExamAndSave = () => {
    examAudioManager.pause();
    setIsSubmitModalOpen(false);
    setIsTimeUpModalOpen(false);
    setIsPaused(false);

    let correctCount = 0;
    let listeningScore = 0;
    let readingScore = 0;

    activeExamQuestions.forEach((q) => {
      const userAns = (answers[q.id] || '').trim().toLowerCase();
      let isCorrect = false;

      if (Array.isArray(q.correctAnswer)) {
        isCorrect = q.correctAnswer.some(
          (ans) => ans.trim().toLowerCase() === userAns
        );
      } else {
        isCorrect = q.correctAnswer.trim().toLowerCase() === userAns;
      }

      if (isCorrect) {
        correctCount += 1;
        if (q.section === 'LISTENING') listeningScore += 1;
        else readingScore += 1;
      }
    });

    const evalResult = calculateExamResults(
      activeExamQuestions,
      answers,
      elapsedSeconds,
      writingScores,
      speakingScores
    );

    const percentage = evalResult.overallPercentage;
    const grade = evalResult.grade;

    setCompletedScoresMap((prev) => ({
      ...prev,
      [selectedTestId]: Math.max(prev[selectedTestId] || 0, correctCount),
    }));

    const writingRawScore = writingScores
      ? writingScores.task1Score + writingScores.task2Score
      : undefined;

    const speakingBand10 = speakingScores ? speakingScores.overallBand10 : undefined;

    const newAttemptId = `attempt-${Date.now()}`;
    setActiveAttemptId(newAttemptId);
    setActiveWritingAiEval(undefined);
    setActiveAiDiagnostic(null);

    const attempt: UserExamAttempt = {
      attemptId: newAttemptId,
      testId: selectedTestId,
      testTitle: activeTestMetadata.title,
      mode: examMode,
      score: correctCount,
      totalQuestions: activeExamQuestions.length,
      percentage,
      grade,
      vstepBandScore: Number((percentage / 10).toFixed(1)),
      listeningScore,
      readingScore,
      writingScore: writingRawScore,
      speakingScore: speakingBand10,
      timeSpentSeconds: elapsedSeconds,
      totalPausedSeconds,
      completedAt: Date.now(),
      answers: { ...answers },
      writingSubmission: { ...writingSubmission },
      speakingSubmission: { ...speakingSubmission },
      selectedParts: [...selectedPartsForSession],
    };

    recordUserAttempt(currentUser?.uid || 'guest', attempt).catch((err) => {
      console.warn('Could not record attempt to Firestore:', err);
    });
    recordStudyActivity(`Hoàn thành đề: ${activeTestMetadata.title}`, currentUser?.uid);

    if (pendingCloudSyncTimerRef.current) {
      clearTimeout(pendingCloudSyncTimerRef.current);
      pendingCloudSyncTimerRef.current = null;
    }

    if (currentUser) {
      clearInProgressAttemptFromFirestore(currentUser.uid, selectedTestId).catch(() => {});
    }

    const uidPrefix = currentUser?.uid || 'guest';
    setInProgressMap((prev) => {
      const next = { ...prev };
      delete next[selectedTestId];
      try {
        localStorage.setItem(inProgressStorageKey, JSON.stringify(next));
        localStorage.setItem('langcert_in_progress_map', JSON.stringify(next));
        localStorage.removeItem(`langcert_inprogress_${uidPrefix}_${selectedTestId}`);
        localStorage.removeItem(`langcert_inprogress_${selectedTestId}`);
        localStorage.removeItem(`langcert_writing_draft_${uidPrefix}_${selectedTestId}`);
        localStorage.removeItem(`langcert_writing_draft_${selectedTestId}`);
        localStorage.removeItem(`langcert_speaking_draft_${uidPrefix}_${selectedTestId}`);
        localStorage.removeItem(`langcert_speaking_draft_${selectedTestId}`);
      } catch {
        // Ignore
      }
      return next;
    });

    setCurrentScreen('results');
    clearSessionLocalAudioOverrides();
  };

  const handleConfirmSubmit = () => {
    submitExamAndSave();
  };

  // Temporary local audio upload for the active Listening Part ONLY (never modifies database audio; resets after exam)
  const handleUploadAudio = (file: File) => {
    const activePartNum = currentGroup.partNumber || 1;
    const directBlobUrl = URL.createObjectURL(file);
    setCustomAudioName(file.name);
    setActiveAudioBadgeLabel(`Local · Part ${activePartNum}`);
    setSessionPartAudioOverrides((prev) => {
      const existing = prev[activePartNum];
      if (existing?.url?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(existing.url);
        } catch {
          // Ignore
        }
      }
      return {
        ...prev,
        [activePartNum]: {
          url: directBlobUrl,
          fileName: file.name,
        },
      };
    });
    examAudioManager.setCustomAudio(
      file,
      currentScreen === 'exam' ? currentGroup.section === 'LISTENING' : true
    );
  };

  // Open Create Exam (100% blank builder — Item 7 & 8)
  const handleOpenCreateExam = () => {
    const isUnlocked = sessionStorage.getItem('langcert_admin_unlocked') === 'true';
    if (canManageExams || isUnlocked) {
      setEditingTest(null);
      setEditingQuestions(null);
      setCurrentScreen('builder');
    } else {
      setPendingEditTestId('NEW_TEST');
      setIsAdminPinModalOpen(true);
    }
  };

  // Open Edit Exam for ANY existing test (Item 8)
  const handleOpenEditExam = (testId: string) => {
    const isUnlocked = sessionStorage.getItem('langcert_admin_unlocked') === 'true';
    if (canManageExams || isUnlocked) {
      loadAndEditTest(testId);
    } else {
      setPendingEditTestId(testId);
      setIsAdminPinModalOpen(true);
    }
  };

  const loadAndEditTest = (testId: string) => {
    const targetTest = allTests.find((t) => t.id === testId);
    if (!targetTest) return;

    let targetQuestions = customQuestionsMap[testId];
    if (!targetQuestions || targetQuestions.length === 0) {
      targetQuestions = TEST_1_QUESTIONS.map((q) => ({ ...q }));
    }

    setEditingTest(targetTest);
    setEditingQuestions(targetQuestions);
    setCurrentScreen('builder');
  };

  const handleAdminPinSuccess = () => {
    setIsAdminPinUnlocked(true);
    if (pendingEditTestId === 'NEW_TEST' || !pendingEditTestId) {
      setEditingTest(null);
      setEditingQuestions(null);
      setCurrentScreen('builder');
    } else {
      loadAndEditTest(pendingEditTestId);
    }
    setPendingEditTestId(null);
  };

  // 1-Click Publish Draft Test for Admins
  const handleQuickPublishDraftTest = async (testId: string) => {
    const target = allTests.find((t) => t.id === testId);
    if (!target) return;

    const targetQuestions =
      customQuestionsMap[testId] && customQuestionsMap[testId].length > 0
        ? customQuestionsMap[testId]
        : target.questions && target.questions.length > 0
        ? target.questions
        : TEST_1_QUESTIONS.map((q) => ({ ...q }));

    const publishedTest = {
      ...target,
      description: target.description || '',
      createdAt: target.createdAt || Date.now(),
      creatorId: target.creatorId || currentUser?.uid || 'admin',
      creatorEmail: target.creatorEmail || currentUser?.email || '',
      isCustom: true,
      status: 'published' as const,
      categoryTag:
        target.categoryTag === 'Đề Nháp' ? 'Đề Chính Thức' : target.categoryTag || 'Đề Chính Thức',
      updatedAt: Date.now(),
      questions: targetQuestions,
    };

    syncSavedTestIntoState(publishedTest);
    await saveTestToFirestore(publishedTest);
  };

  // Delete ANY test from the system (both default and custom tests — Item 9)
  const handleDeleteAnyTest = async (testId: string) => {
    const isUnlocked = sessionStorage.getItem('langcert_admin_unlocked') === 'true';
    if (!canManageExams && !isUnlocked) {
      console.warn('Unauthorized delete attempt blocked');
      return;
    }

    setDeletedTestIds((prev) => {
      const next = Array.from(new Set([...prev, testId]));
      try {
        localStorage.setItem('langcert_deleted_test_ids', JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });

    setCustomTests((prev) => prev.filter((t) => t.id !== testId));
    try {
      const rawBackup =
        localStorage.getItem('langcert_custom_tests_backup_v1') ||
        localStorage.getItem('langcert_custom_tests_backup');
      if (rawBackup) {
        const list: TestMetadata[] = JSON.parse(rawBackup);
        const filtered = JSON.stringify(list.filter((t) => t.id !== testId));
        localStorage.setItem('langcert_custom_tests_backup_v1', filtered);
        localStorage.setItem('langcert_custom_tests_backup', filtered);
      }
    } catch {
      // Ignore
    }

    try {
      await deleteAnyTestFromSystem(testId);
    } catch (err) {
      console.error('Error deleting test from system:', err);
    }
  };

  const syncSavedTestIntoState = (newTest: TestMetadata) => {
    clearSessionLocalAudioOverrides();
    setDeletedTestIds((prev) => prev.filter((id) => id !== newTest.id));
    setCustomTests((prev) => [
      newTest,
      ...prev.filter((item) => item.id !== newTest.id),
    ]);
    if (newTest.questions) {
      setCustomQuestionsMap((prev) => ({
        ...prev,
        [newTest.id]: newTest.questions!,
      }));
    }
  };

  const handleTestSaved = (newTest: TestMetadata) => {
    syncSavedTestIntoState(newTest);
    setEditingTest(null);
    setEditingQuestions(null);
    setCurrentScreen('selection');
  };

  // Format seconds helper for modals
  const formatClock = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map((v) => v.toString().padStart(2, '0')).join(':');
  };

  // LANDING VIEW (Home / Showcase)
  if (currentScreen === 'landing') {
    return (
      <>
        <LandingPageView
          totalPublishedExams={visibleTests.length}
          unreadFeedbackCount={unreadFeedbackCount}
          onStartSampleTest={() => {
            if (!currentUser) {
              setIsLoginModalOpen(true);
              return;
            }
            setCurrentScreen('selection');
            handleRequestStartTest('test-1');
          }}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onDirectEnterSystem={() => setCurrentScreen('selection')}
          onOpenFeedbackModal={() =>
            openFeedbackWithContext({ contextScreen: 'landing' })
          }
          onOpenAdminFeedbackModal={() => setIsAdminFeedbackModalOpen(true)}
        />
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSuccess={() => setCurrentScreen('selection')}
        />
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          contextData={feedbackContextData}
        />
        <AdminFeedbackModal
          isOpen={isAdminFeedbackModalOpen}
          onClose={() => setIsAdminFeedbackModalOpen(false)}
          reports={feedbackReports}
        />
      </>
    );
  }

  // BUILDER VIEW (Protected - only for Super Admin, Admin, and Co-teachers)
  if (currentScreen === 'builder') {
    const isUnlocked = sessionStorage.getItem('langcert_admin_unlocked') === 'true';
    if (!canManageExams && !isUnlocked) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 select-none font-sans">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl text-center border border-slate-200 dark:border-slate-700">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Khu vực dành riêng cho Quản trị viên
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6 leading-relaxed">
              Tính năng soạn thảo và chỉnh sửa đề thi chỉ khả dụng cho Super Admin ({SUPER_ADMIN_EMAILS[0]}) và Giáo viên được phân quyền.
            </p>
            <button
              type="button"
              onClick={() => setCurrentScreen('selection')}
              className="w-full py-3 rounded-2xl bg-[#58CC02] hover:bg-[#46a302] text-white font-black text-xs shadow-md border-b-2 border-[#3c8c02] transition-all cursor-pointer"
            >
              Quay lại Danh sách Đề thi
            </button>
          </div>
        </div>
      );
    }

    return (
      <ExamBuilderView
        initialTest={editingTest}
        initialQuestions={editingQuestions}
        onBack={() => {
          setEditingTest(null);
          setEditingQuestions(null);
          setCurrentScreen('selection');
        }}
        onTestSaved={handleTestSaved}
        onSaveProgress={syncSavedTestIntoState}
      />
    );
  }

  // SELECTION VIEW
  if (currentScreen === 'selection') {
    const pendingTestObj = allTests.find((t) => t.id === pendingStartTestId) || TESTS_LIST[0];
    const existingInProgressForPending = inProgressMap[pendingStartTestId];

    return (
      <>
        <TestSelectionView
          tests={visibleTests}
          selectedMode={examMode}
          onSelectMode={setExamMode}
          selectedSkillPackage={selectedSkillPackage}
          onSelectSkillPackage={setSelectedSkillPackage}
          onStartTest={handleRequestStartTest}
          onResumeTest={handleResumeInProgressTest}
          onRestartTest={handleRestartTestFromScratch}
          onUploadAudio={handleUploadAudio}
          customAudioName={customAudioName}
          onOpenCreateExam={handleOpenCreateExam}
          onOpenAiPdfModal={() => {
            const isUnlocked = sessionStorage.getItem('langcert_admin_unlocked') === 'true';
            if (canManageExams || isUnlocked) {
              setIsAiPdfModalOpen(true);
            } else {
              setIsAdminPinModalOpen(true);
            }
          }}
          onEditTest={handleOpenEditExam}
          onPublishDraftTest={handleQuickPublishDraftTest}
          onOpenHistory={(testId?: string) => {
            setHistoryFilterTestId(testId || null);
            setIsHistoryModalOpen(true);
          }}
          onOpenProfile={() => setIsProfileModalOpen(true)}
          onBackToLanding={() => setCurrentScreen('landing')}
          onOpenFeedback={() =>
            openFeedbackWithContext({ contextScreen: 'selection' })
          }
          onOpenAdminFeedback={() => setIsAdminFeedbackModalOpen(true)}
          unreadFeedbackCount={unreadFeedbackCount}
          onDeleteCustomTest={handleDeleteAnyTest}
          inProgressMap={inProgressMap}
          completedScoresMap={completedScoresMap}
        />

        {/* Pre-Start Part & Timer Configuration Modal (Item 15 & 16) */}
        {preStartModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-lime-100 dark:bg-emerald-950 text-[#2E7D32] dark:text-lime-300 text-[11px] font-black mb-1">
                    <Sparkles className="h-3 w-3" />
                    THIẾT LẬP PHÒNG THI VSTEP 4 KỸ NĂNG
                  </span>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {pendingTestObj.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPreStartModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Resume Banner if an in-progress attempt exists */}
              {existingInProgressForPending && (
                <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span>Bạn đang có bài làm dở ở bộ đề này!</span>
                    </div>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      Đã trả lời{' '}
                      {
                        Object.values(existingInProgressForPending.answers || {}).filter(
                          (v) => v && v.trim().length > 0
                        ).length
                      }
                      /75 câu trắc nghiệm · Chế độ:{' '}
                      {existingInProgressForPending.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleResumeInProgressTest(pendingStartTestId)}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    Làm tiếp bài đang dở →
                  </button>
                </div>
              )}

              {/* Mode Switcher */}
              <div className="mt-5">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                  1. Chọn chế độ làm bài
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExamMode('exam')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      examMode === 'exam'
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Thi thử (Mock Exam)</span>
                      {examMode === 'exam' && (
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-600" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Chọn trọn bộ 4 kỹ năng (Listening, Reading, Writing, Speaking), bấm giờ chuẩn VSTEP & tự động nộp khi hết giờ.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExamMode('practice')}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      examMode === 'practice'
                        ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-black text-sm text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Luyện tập (Practice)</span>
                      {examMode === 'practice' && (
                        <span className="h-2.5 w-2.5 rounded-full bg-[#58CC02]" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Chọn từng Part lẻ tùy thích (gồm cả Speaking Part 1, 2, 3), tùy chỉnh thời gian hoặc không giới hạn giờ.
                    </p>
                  </button>
                </div>
              </div>

              {/* Section / Part Selection */}
              {examMode === 'exam' ? (
                <div className="mt-5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                    2. Chọn Kỹ năng Thi thử VSTEP (4 Kỹ năng L - R - W - S)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExamSkillsSelected((prev) => ({ ...prev, listening: !prev.listening }))
                      }
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        examSkillsSelected.listening
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40'
                          : 'border-slate-200 dark:border-slate-700 opacity-70'
                      }`}
                    >
                      {examSkillsSelected.listening ? (
                        <CheckSquare className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                          <Headphones className="h-3.5 w-3.5 text-purple-600" />
                          <span>1. Full Listening</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Part 1–3 (35 câu · 40 phút)</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExamSkillsSelected((prev) => ({ ...prev, reading: !prev.reading }))
                      }
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        examSkillsSelected.reading
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40'
                          : 'border-slate-200 dark:border-slate-700 opacity-70'
                      }`}
                    >
                      {examSkillsSelected.reading ? (
                        <CheckSquare className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                          <span>2. Full Reading</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Passage 1–4 (40 câu · 60 phút)</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExamSkillsSelected((prev) => ({ ...prev, writing: !prev.writing }))
                      }
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        examSkillsSelected.writing
                          ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/40'
                          : 'border-slate-200 dark:border-slate-700 opacity-70'
                      }`}
                    >
                      {examSkillsSelected.writing ? (
                        <CheckSquare className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                          <PenTool className="h-3.5 w-3.5 text-purple-600" />
                          <span>3. Full Writing</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Task 1 &amp; Task 2 (60 phút)</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExamSkillsSelected((prev) => ({ ...prev, speaking: !prev.speaking }))
                      }
                      className={`p-3.5 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        examSkillsSelected.speaking
                          ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/40'
                          : 'border-slate-200 dark:border-slate-700 opacity-70'
                      }`}
                    >
                      {examSkillsSelected.speaking ? (
                        <CheckSquare className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                          <Mic className="h-3.5 w-3.5 text-teal-600" />
                          <span>4. Full Speaking</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Part 1, 2 &amp; 3 Mind-map (12 phút)</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Practice Mode: Granular Part Picker */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                        2. Chọn các Part muốn luyện tập ({selectedPartsForSession.length}/{ALL_PRACTICE_PARTS.length} Part)
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPartsForSession(ALL_PRACTICE_PARTS)}
                          className="text-[11px] font-bold text-[#2E7D32] hover:underline cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPartsForSession(['L1'])}
                          className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                      {PART_METADATA.map((part) => {
                        const checked = selectedPartsForSession.includes(part.key);
                        return (
                          <button
                            key={part.key}
                            type="button"
                            onClick={() => {
                              setSelectedPartsForSession((prev) =>
                                prev.includes(part.key)
                                  ? prev.length > 1
                                    ? prev.filter((k) => k !== part.key)
                                    : prev
                                  : [...prev, part.key]
                              );
                            }}
                            className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                              checked
                                ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/50 text-slate-900 dark:text-white'
                                : 'border-slate-200 dark:border-slate-700 text-slate-500'
                            }`}
                          >
                            {checked ? (
                              <CheckSquare className="h-4 w-4 text-[#58CC02] shrink-0" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-400 shrink-0" />
                            )}
                            <div className="truncate">
                              <div className="text-xs font-extrabold truncate">{part.label}</div>
                              <div className="text-[10px] text-slate-400">
                                Đề xuất: {part.suggestedMinutes} phút
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Practice Mode Timer Selector */}
                  <div className="mt-5">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                      3. Thời gian làm bài Luyện tập
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setPracticeTimerType('suggested')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          practiceTimerType === 'suggested'
                            ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black text-slate-900 dark:text-white">
                          Hệ thống đề xuất ({suggestedPracticeMinutes} phút)
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Tự động tính theo số Part đã chọn
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPracticeTimerType('custom')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          practiceTimerType === 'custom'
                            ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between gap-2">
                          <span>Tự chọn số phút:</span>
                          <input
                            type="number"
                            min={1}
                            max={240}
                            value={customMinutesInput}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setCustomMinutesInput(Math.max(1, Number(e.target.value) || 15))
                            }
                            className="w-16 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-black text-center"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Đếm ngược theo ý thích của bạn
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPracticeTimerType('untimed')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          practiceTimerType === 'untimed'
                            ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black text-slate-900 dark:text-white">
                          Không giới hạn giờ
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Đồng hồ đếm tiến để theo dõi thời gian học
                        </p>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Modal Actions */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPreStartModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Đóng lại
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLaunchFromPreStart}
                  className="px-6 py-3 rounded-2xl bg-[#58CC02] hover:bg-[#46a302] text-white text-xs sm:text-sm font-black shadow-md border-b-2 border-[#3c8c02] flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>
                    {examMode === 'exam' ? 'Vào phòng Thi thử ngay' : 'Bắt đầu Luyện tập ngay'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI PDF Extraction Modal */}
        <AiPdfUploadModal
          isOpen={isAiPdfModalOpen}
          onClose={() => setIsAiPdfModalOpen(false)}
          onExamExtracted={(newTest, newQuestions) => {
            setEditingTest(newTest);
            setEditingQuestions(newQuestions);
            setCurrentScreen('builder');
          }}
        />

        {/* Login Modal */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
        />

        {/* Admin PIN Unlock Modal */}
        <AdminPinModal
          isOpen={isAdminPinModalOpen}
          onClose={() => {
            setIsAdminPinModalOpen(false);
            setPendingEditTestId(null);
          }}
          onSuccess={handleAdminPinSuccess}
        />

        {/* User Exam History Modal */}
        <ExamHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setHistoryFilterTestId(null);
          }}
          tests={visibleTests}
          inProgressMap={inProgressMap}
          onResumeTest={handleResumeInProgressTest}
          onRestartTest={handleRestartTestFromScratch}
          onRetakeTest={handleRequestStartTest}
          onReviewAttempt={handleReviewHistoricalAttempt}
          initialTestFilter={historyFilterTestId}
        />

        {/* Personal Profile Modal (Thông tin cá nhân) */}
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />

        {/* Student Feedback & Bug Report Modal */}
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          contextData={feedbackContextData}
        />

        {/* Admin Notification Center Modal */}
        <AdminFeedbackModal
          isOpen={isAdminFeedbackModalOpen}
          onClose={() => setIsAdminFeedbackModalOpen(false)}
          reports={feedbackReports}
        />
      </>
    );
  }

  // RESULTS VIEW (Supports Interactive Full Solution Review in both Exam and Practice modes — Item 17)
  if (currentScreen === 'results') {
    const hasWritingInSession =
      selectedPartsForSession.includes('W1') || selectedPartsForSession.includes('W2');
    const hasSpeakingInSession =
      selectedPartsForSession.includes('S1') ||
      selectedPartsForSession.includes('S2') ||
      selectedPartsForSession.includes('S3');
    return (
      <>
        <ResultsView
          questions={activeExamQuestions}
          answers={answers}
          timeSpentSeconds={elapsedSeconds || Math.max(0, initialTimeSeconds - timeRemainingSeconds)}
          testTitle={activeTestMetadata.title}
          writingSubmission={hasWritingInSession ? writingSubmission : undefined}
          writingTasks={activeTestMetadata.writingTasks || SAMPLE_B1_WRITING_TASKS}
          writingScores={writingScores}
          initialWritingEvaluation={activeWritingAiEval}
          onWritingGraded={(scores, fullEvaluation) => {
            if (fullEvaluation) {
              setActiveWritingAiEval(fullEvaluation);
            }
            if (activeAttemptId) {
              const recalc = calculateExamResults(
                activeExamQuestions,
                answers,
                elapsedSeconds,
                scores,
                speakingScores
              );
              updateAttemptAiEvaluationInFirestore(
                currentUser?.uid || 'guest',
                activeAttemptId,
                {
                  writingScore: scores.task1Score + scores.task2Score,
                  vstepBandScore: Number((recalc.overallPercentage / 10).toFixed(1)),
                  aiWritingEvaluation: fullEvaluation,
                }
              ).catch(() => {});
            }
          }}
          speakingSubmission={hasSpeakingInSession ? speakingSubmission : undefined}
          speakingTasks={activeTestMetadata.speakingTasks || SAMPLE_VSTEP_SPEAKING_TASKS}
          speakingScores={speakingScores}
          initialAiDiagnostic={activeAiDiagnostic}
          onAiDiagnosticGenerated={(report) => {
            setActiveAiDiagnostic(report);
            if (activeAttemptId) {
              updateAttemptAiEvaluationInFirestore(
                currentUser?.uid || 'guest',
                activeAttemptId,
                {
                  aiDiagnosticReport: report,
                }
              ).catch(() => {});
            }
          }}
          onRetake={handleRetakeTest}
          onBackToTests={handleBackToTests}
          onOpenFeedback={() =>
            openFeedbackWithContext({
              contextScreen: 'results',
              testId: activeTestMetadata.id,
              testTitle: activeTestMetadata.title,
            })
          }
        />
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          contextData={feedbackContextData}
        />
      </>
    );
  }

  // EXAM VIEW
  return (
    <div className="min-h-screen bg-[#F7F9FA] dark:bg-slate-950 text-slate-800 dark:text-slate-100 pb-20 select-none relative transition-colors duration-200">
      {/* Main Exam Content (Blurred when Paused — Items 11 & 15) */}
      <div
        className={`transition-all duration-200 ${
          isPaused ? 'blur-md pointer-events-none select-none' : ''
        }`}
      >
        {/* Top Header */}
        <ExamHeader
          timeRemainingSeconds={isTimedSession ? timeRemainingSeconds : 0}
          elapsedSeconds={elapsedSeconds}
          instructionText={currentGroup.instructionText || ''}
          subInstruction={currentGroup.subInstruction}
          currentPromptAudioScript={activePromptAudioScript}
          mode={examMode}
          showAudioPlayer={currentGroup.section === 'LISTENING' && currentGroup.type !== 'transition'}
          onToggleMode={() => setExamMode((prev) => (prev === 'exam' ? 'practice' : 'exam'))}
          onSubmitClick={() => setIsSubmitModalOpen(true)}
          onExitClick={handleBackToTests}
          onPauseClick={() => {
            examAudioManager.pause();
            setIsPaused(true);
          }}
          onSaveAndExitPractice={examMode === 'practice' ? handleSaveAndExitPractice : undefined}
          onUploadAudioFile={handleUploadAudio}
          customAudioName={customAudioName}
          audioBadgeLabel={activeAudioBadgeLabel}
          isOnline={isOnline}
          lastSavedText={lastSavedText}
          onOpenTranscript={
            examMode === 'practice' &&
            currentGroup.type === 'questions' &&
            currentGroup.section !== 'WRITING' &&
            currentGroup.section !== 'SPEAKING'
              ? () => {
                  setScriptToggleCounter((c) => c + 1);
                }
              : undefined
          }
          onReportIssueClick={() => {
            const relNum =
              currentGroup.type === 'questions'
                ? getPartRelativeNumber(activeQuestionId, currentPartQuestionsForFooter)
                : currentGroup.type === 'speaking'
                ? activeSpeakingPartIndex + 1
                : activeWritingTaskIndex + 1;
            openFeedbackWithContext({
              contextScreen: 'exam',
              testId: activeTestMetadata.id,
              testTitle: activeTestMetadata.title,
              section: currentGroup.section,
              partNumber:
                currentGroup.partNumber ||
                (currentGroup.type === 'speaking'
                  ? activeSpeakingPartIndex + 1
                  : activeWritingTaskIndex + 1),
              questionNumber: relNum,
            });
          }}
        />

        {/* Main Question Arena, Section Transition, Writing Editor, or Speaking Stage */}
        <main className="w-full">
          {currentGroup.type === 'transition' ? (
            <SectionTransitionView
              section={currentGroup.section}
              onProceed={handleNextGroup}
            />
          ) : currentGroup.type === 'writing' ? (
            <WritingSectionStage
              submission={writingSubmission}
              onChange={setWritingSubmission}
              onProceedToReview={() => {
                const hasSpeakingNext = activeQuestionGroups.some((g) => g.type === 'speaking');
                if (hasSpeakingNext && currentGroupIndex < activeQuestionGroups.length - 1) {
                  handleNextGroup();
                } else {
                  setIsSubmitModalOpen(true);
                }
              }}
              tasks={activeTestMetadata.writingTasks || SAMPLE_B1_WRITING_TASKS}
              activeTaskIndex={activeWritingTaskIndex}
              onTaskIndexChange={setActiveWritingTaskIndex}
            />
          ) : currentGroup.type === 'speaking' ? (
            <SpeakingSectionStage
              submission={speakingSubmission}
              onChange={setSpeakingSubmission}
              onProceedToReview={() => setIsSubmitModalOpen(true)}
              tasks={activeTestMetadata.speakingTasks || SAMPLE_VSTEP_SPEAKING_TASKS}
              activePartIndex={activeSpeakingPartIndex}
              onPartIndexChange={setActiveSpeakingPartIndex}
              isPracticeMode={examMode === 'practice'}
            />
          ) : (
            <QuestionStage
              questions={currentQuestions}
              activeQuestionId={activeQuestionId}
              answers={answers}
              flagged={flagged}
              mode={examMode}
              externalScriptToggleCounter={scriptToggleCounter}
              onAnswerChange={handleAnswerChange}
              onToggleFlag={handleToggleFlag}
              onSelectQuestion={setActiveQuestionId}
              onOpenZoomModal={setZoomCard}
            />
          )}
        </main>

        {/* Right Slide-out Summary Board Drawer (4 Skills L - R - W - S) */}
        <SummaryBoardDrawer
          isOpen={isSummaryDrawerOpen}
          onToggle={() => setIsSummaryDrawerOpen(!isSummaryDrawerOpen)}
          testTitle={activeTestMetadata.title}
          activeQuestionId={activeQuestionId}
          activeSection={currentGroup.section}
          activeWritingTaskIndex={activeWritingTaskIndex}
          activeSpeakingPartIndex={activeSpeakingPartIndex}
          answers={answers}
          flagged={flagged}
          writingSubmission={
            selectedPartsForSession.includes('W1') || selectedPartsForSession.includes('W2')
              ? writingSubmission
              : undefined
          }
          speakingSubmission={
            selectedPartsForSession.includes('S1') ||
            selectedPartsForSession.includes('S2') ||
            selectedPartsForSession.includes('S3')
              ? speakingSubmission
              : undefined
          }
          selectedParts={selectedPartsForSession}
          isPracticeMode={examMode === 'practice'}
          questions={activeExamQuestions}
          onSelectQuestion={handleSelectQuestionFromSummary}
          onSelectWritingTask={handleSelectWritingTaskFromSummary}
          onSelectSpeakingPart={handleSelectSpeakingPartFromSummary}
          onSubmitClick={() => setIsSubmitModalOpen(true)}
          onSaveAndExitPractice={examMode === 'practice' ? handleSaveAndExitPractice : undefined}
        />

        {/* Bottom Sticky Progress & Navigation Bar (Supports L - R - W - S) */}
        <ExamFooter
          progressPercent={progressPercent}
          section={currentGroup.section}
          partNumber={currentGroup.partNumber || 1}
          questionRangeLabel={currentGroup.rangeLabel}
          partQuestions={currentPartQuestionsForFooter}
          activeQuestionId={activeQuestionId}
          answers={answers}
          flagged={flagged}
          isPracticeMode={examMode === 'practice'}
          onSelectQuestion={handleSelectQuestionFromSummary}
          activeWritingTaskIndex={activeWritingTaskIndex}
          writingSubmission={
            selectedPartsForSession.includes('W1') || selectedPartsForSession.includes('W2')
              ? writingSubmission
              : undefined
          }
          onSelectWritingTask={handleSelectWritingTaskFromSummary}
          activeSpeakingPartIndex={activeSpeakingPartIndex}
          speakingSubmission={
            selectedPartsForSession.includes('S1') ||
            selectedPartsForSession.includes('S2') ||
            selectedPartsForSession.includes('S3')
              ? speakingSubmission
              : undefined
          }
          onSelectSpeakingPart={handleSelectSpeakingPartFromSummary}
          canGoPrev={currentGroupIndex > 0}
          canGoNext={currentGroupIndex < activeQuestionGroups.length - 1}
          onPrev={handlePrevGroup}
          onNext={handleNextGroup}
        />
      </div>

      {/* PAUSE OVERLAY MODAL (Items 11 & 15) */}
      {isPaused && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 text-center shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-xs">
              <Pause className="h-8 w-8" />
            </div>

            <h3 className="text-2xl font-black text-slate-900">
              {examMode === 'exam' ? 'Đang Tạm Dừng Phòng Thi Thử' : 'Đang Tạm Dừng Luyện Tập'}
            </h3>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Màn hình đề thi đã được làm mờ để đảm bảo tính minh bạch. Tiến trình làm bài của bạn đã được sao lưu tự động.
            </p>

            {examMode === 'exam' ? (
              /* Exam Mode: 2 Clocks (Frozen Remaining Time + Cumulative Break Clock) */
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-2xl bg-slate-100 p-4 border border-slate-200">
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                    Đồng hồ 1 · Thời gian còn lại
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-black text-slate-900">
                    {formatClock(timeRemainingSeconds)}
                  </div>
                  <span className="mt-1 inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Đang đóng băng
                  </span>
                </div>

                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                    Đồng hồ 2 · Tổng thời gian nghỉ
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-black text-amber-600">
                    {formatClock(totalPausedSeconds)}
                  </div>
                  <span className="mt-1 inline-block text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                    Đang đếm cộng dồn
                  </span>
                </div>
              </div>
            ) : (
              /* Practice Mode: Elapsed Study Time Clock */
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-2xl bg-lime-50 p-4 border border-lime-200">
                  <div className="text-[11px] font-black uppercase tracking-wider text-[#2E7D32]">
                    Thời gian đã luyện tập
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-black text-[#1B5E20]">
                    {formatClock(elapsedSeconds)}
                  </div>
                  <span className="mt-1 inline-block text-[10px] font-bold text-[#2E7D32]">
                    Đã tạm dừng đếm giờ
                  </span>
                </div>

                <div className="rounded-2xl bg-amber-50 p-4 border border-amber-200">
                  <div className="text-[11px] font-black uppercase tracking-wider text-amber-700">
                    Thời gian nghỉ giải lao
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-black text-amber-600">
                    {formatClock(totalPausedSeconds)}
                  </div>
                  <span className="mt-1 inline-block text-[10px] font-bold text-amber-700">
                    Đang cộng dồn
                  </span>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsPaused(false)}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-[#58CC02] hover:bg-[#46a302] text-white text-sm font-black shadow-md border-b-2 border-[#3c8c02] transition-all cursor-pointer"
              >
                <Play className="h-4 w-4 fill-white" />
                <span>Tiếp tục làm bài</span>
              </button>

              {examMode === 'practice' && (
                <button
                  type="button"
                  onClick={handleSaveAndExitPractice}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-black transition-all cursor-pointer"
                >
                  <Save className="h-4 w-4 text-indigo-600" />
                  <span>Lưu & Làm tiếp sau</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TIME'S UP AUTO-SUBMIT MODAL (Item 15) */}
      {isTimeUpModalOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl border border-rose-200">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <AlertTriangle className="h-9 w-9" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">Đã hết thời gian làm bài!</h3>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              Thời gian làm bài đã kết thúc. Hệ thống đã tự động ghi nhận toàn bộ câu trả lời của bạn để chấm điểm.
            </p>
            <button
              type="button"
              onClick={submitExamAndSave}
              className="mt-6 w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm shadow-lg transition-all cursor-pointer"
            >
              Nộp bài & Xem Kết Quả Ngay
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Dialog (Matches image_6294e89d.png) */}
      <SubmitModal
        isOpen={isSubmitModalOpen}
        timeRemainingSeconds={isTimedSession ? timeRemainingSeconds : elapsedSeconds}
        onContinue={() => setIsSubmitModalOpen(false)}
        onSubmit={handleConfirmSubmit}
      />

      {/* Stimulus Document Enlarge Modal */}
      <ImageZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

      {/* Student Feedback & Bug Report Modal inside Exam Room */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        contextData={feedbackContextData}
      />
    </div>
  );
}
