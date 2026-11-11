import { WritingTask, WritingSubmission } from './writing';
import { SpeakingTask, SpeakingSubmission } from './speaking';
import type { VocabItem } from '../data/b1VocabData';
export type { VocabItem };

export type ExamSection = 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING';

export type QuestionType =
  | 'mcq'
  | 'notes'
  | 'gapped_text'
  | 'multi_text_match'
  | 'short_answer';

export interface Option {
  id: string; // 'A', 'B', 'C', etc.
  text: string;
}

export interface StimulusCard {
  id: string; // 'A', 'B', 'C', 'D'
  title?: string;
  tag?: string;
  content: string;
  sender?: string;
  recipient?: string;
  date?: string;
  price?: string;
  details?: string[];
  imagePlaceholderType?: 'business_card' | 'football_note' | 'cinema' | 'memo' | 'for_sale' | 'email';
  imageUrl?: string; // Direct image URL or base64 data URL
  imageCaption?: string;
  vietnameseTranslation?: string;
}

export interface Question {
  id: number; // 1 to 52
  partNumber: 1 | 2 | 3 | 4;
  section: ExamSection;
  type: QuestionType;
  instruction: string;
  subInstruction?: string;
  prompt?: string;
  options?: Option[];
  correctAnswer: string | string[]; // Can be single option 'A' or acceptable text variations
  explanation?: string;
  evidenceQuote?: string; // The exact sentence in the script or reading passage proving the answer
  vietnameseTranslation?: string; // Vietnamese translation of question & options A, B, C
  audioScript?: string; // Supports Speaker A:, B:, C: multi-sentence turns
  audioScriptTranslation?: string; // Vietnamese translation of audio transcript by speaker turn
  imageUrl?: string; // Optional question-level image (sign, announcement, photo)
  imageCaption?: string;
  // Specific properties per part
  stimulusCard?: StimulusCard;
  stimulusCardTranslation?: string;
  notesData?: {
    showTitle: string;
    itemNumber: number;
    label: string;
  };
  gappedOptions?: { id: string; text: string; vietnameseTranslation?: string }[];
  gappedArticle?: {
    title: string;
    paragraphs: { text: string; gapId?: number; vietnameseTranslation?: string }[];
    imageUrl?: string;
    imageCaption?: string;
    vietnameseTranslation?: string;
  };
  gappedArticleTranslation?: {
    title?: string;
    optionsTranslation?: string;
    fullText?: string;
    paragraphs?: string[];
  };
  multiTextCards?: StimulusCard[];
  readingArticle?: {
    title: string;
    paragraphs: string[];
    imageUrl?: string;
    imageCaption?: string;
  };
  readingArticleTranslation?: {
    title: string;
    paragraphs: string[];
  };
}

export interface PartAudioMap {
  part1?: string;
  part2?: string;
  part3?: string;
  part4?: string;
}

export type DefaultExamCategoryTag = 'Đề thi minh họa' | 'Đề Nháp' | 'Đề thi thật';

export interface TestMetadata {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  totalQuestions: number;
  durationMinutes: number;
  isAvailable: boolean;
  isCustom?: boolean;
  status?: 'draft' | 'published';
  categoryTag?: string;
  level?: string;
  createdAt?: number;
  updatedAt?: number;
  creatorId?: string;
  creatorEmail?: string;
  audioMode?: 'single' | 'per_part';
  audioUrl?: string;
  audioFileName?: string;
  partAudioUrls?: PartAudioMap;
  partAudioFileNames?: PartAudioMap;
  questions?: Question[];
  writingTasks?: WritingTask[];
  speakingTasks?: SpeakingTask[];
  vocabulary?: VocabItem[];
}

export function isDraftTest(test?: TestMetadata | null): boolean {
  if (!test) return false;
  return test.status === 'draft' || test.categoryTag === 'Đề Nháp';
}

export interface ExamUserHighlight {
  id: string;
  partKey: string;
  text: string;
  color: 'yellow' | 'green' | 'pink';
  targetType?: 'passage' | 'question';
  questionId?: number;
  createdAt?: number;
}

export type ExamScratchpadNotesMap = Record<string, string>;

export interface InProgressAttempt {
  testId: string;
  testTitle?: string;
  mode: 'exam' | 'practice';
  selectedParts?: string[]; // e.g., ['L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'R4', 'W1', 'W2', 'S1', 'S2', 'S3']
  answers: Record<number, string>;
  flagged: Record<number, boolean>;
  writingSubmission: WritingSubmission;
  speakingSubmission?: SpeakingSubmission;
  writingDraft?: WritingSubmission;
  speakingDraft?: SpeakingSubmission;
  userHighlights?: ExamUserHighlight[];
  eliminatedOptions?: Record<number, string[]>;
  scratchpadNotes?: ExamScratchpadNotesMap;
  timeRemainingSeconds: number;
  remainingSeconds?: number;
  elapsedSeconds: number;
  totalPausedSeconds: number;
  currentGroupIndex: number;
  activeQuestionId: number;
  savedAt: number;
  lastUpdatedAt?: number;
  cloudSyncedAt?: number;
  practiceAuditLogs?: PracticeAuditEntry[];
  practiceLockedAnswers?: Record<number, boolean>;
}

export interface ExamSessionState {
  testId: string;
  mode: 'exam' | 'practice';
  activeSection: ExamSection;
  activeQuestionIndex: number; // 1-indexed (1 to 75)
  answers: Record<number, string>;
  flagged: Record<number, boolean>;
  timeRemainingSeconds: number;
  isSummaryBoardOpen: boolean;
  isSubmitted: boolean;
  customAudioUrl?: string;
  customAudioName?: string;
}

export interface UserTargetScores {
  overall: number; // 0 - 10 (VSTEP scale, step 0.5)
  listening: number; // 0 - 10
  reading: number; // 0 - 10
  writing: number; // 0 - 10
  speaking?: number; // 0 - 10
  updatedAt?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  nickname?: string;
  birthDate?: string; // YYYY-MM-DD
  phone?: string;
  address?: string;
  age?: number;
  targetScores?: UserTargetScores;
  vocabStats?: import('./studentManagement').UserVocabStats;
  activeDraftSummary?: import('./studentManagement').UserActiveDraftSummary | null;
  preferences?: import('./studentManagement').UserPreferences;
  totalExamAttempts?: number;
  bestVstepBandScore?: number;
  bestRawScore?: number;
  lastAttemptAt?: number;
  lastTestTitle?: string;
  currentStreak?: number;
  longestStreak?: number;
  pointsBalance?: number;
  photoURL?: string;
  role: 'admin' | 'co_teacher' | 'student';
  assignedBy?: string;
  createdAt: number;
  lastLoginAt?: number;
  lastActiveAt?: number;
}

export interface PracticeAuditEntry {
  qId: number;
  selectedAnswer: string;
  isCorrect: boolean;
  practicedAt: number;
}

export interface TeacherAttemptFeedback {
  writingScoreOverride?: number;
  speakingScoreOverride?: number;
  commentVi: string;
  teacherName: string;
  teacherEmail?: string;
  updatedAt: number;
}

export interface UserExamAttempt {
  attemptId: string;
  testId: string;
  testTitle: string;
  mode: 'exam' | 'practice';
  score: number;
  totalQuestions: number;
  percentage: number;
  vstepBandScore?: number; // 0-10 VSTEP overall score (e.g. 6.5)
  grade: 'High Pass' | 'Pass' | 'Fail';
  listeningScore: number;
  readingScore: number;
  writingScore?: number;
  speakingScore?: number;
  timeSpentSeconds: number;
  totalPausedSeconds?: number;
  completedAt: number;
  answers?: Record<number, string>;
  writingSubmission?: WritingSubmission;
  speakingSubmission?: SpeakingSubmission;
  aiWritingEvaluation?: any;
  aiSpeakingEvaluation?: any;
  aiDiagnosticReport?: any;
  teacherFeedback?: TeacherAttemptFeedback;
  selectedParts?: string[];
  practiceAuditLogs?: PracticeAuditEntry[];
  practicedQuestionsCount?: number;
  tabSwitchCount?: number;
}

/**
 * Computes the VSTEP display question number:
 * - Listening Part 1 (ID 1-8) -> Question 1..8
 * - Listening Part 2 (ID 9-20) -> Question 9..20 (3 conversations x 4 questions)
 * - Listening Part 3 (ID 21-35) -> Question 21..35 (3 talks/lectures x 5 questions)
 * - Reading Passage 1 (ID 36-45) -> Question 1..10
 * - Reading Passage 2 (ID 46-55) -> Question 11..20
 * - Reading Passage 3 (ID 56-65) -> Question 21..30
 * - Reading Passage 4 (ID 66-75) -> Question 31..40
 */
export function getPartRelativeNumber(
  qId: number,
  partQuestions?: Question[]
): number {
  if (partQuestions && partQuestions.length > 0) {
    const found = partQuestions.find((q) => q.id === qId);
    if (found) {
      if (found.section === 'LISTENING') {
        return qId;
      }
      if (found.section === 'READING' && qId >= 36) {
        return qId - 35;
      }
    }
    const idx = partQuestions.findIndex((q) => q.id === qId);
    if (idx !== -1) {
      const firstQ = partQuestions[0];
      if (firstQ.section === 'LISTENING') {
        if (firstQ.partNumber === 1) return idx + 1;
        if (firstQ.partNumber === 2) return idx + 9;
        if (firstQ.partNumber === 3) return idx + 21;
      }
      if (firstQ.section === 'READING') {
        return (firstQ.partNumber - 1) * 10 + idx + 1;
      }
      return idx + 1;
    }
  }
  if (qId >= 1 && qId <= 35) return qId;
  if (qId >= 36 && qId <= 75) return qId - 35;
  return qId;
}

