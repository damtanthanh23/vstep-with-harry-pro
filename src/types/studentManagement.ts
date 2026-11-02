export type UserRole = 'student' | 'co_teacher' | 'admin';

export interface UserTargetScores {
  overall: number;     // 0 - 10 VSTEP scale or 0 - 100 percentage
  listening: number;   // 0 - 10
  reading: number;     // 0 - 10
  writing: number;     // 0 - 10
  speaking?: number;   // 0 - 10
  updatedAt?: number;
}

export interface UserVocabDeckSummary {
  id: string;
  name: string;
  categoryLabel: string; // e.g. '15 Chủ đề chuẩn B1' | 'Từ vựng theo Đề thi' | 'Bộ từ cá nhân'
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  updatedAt?: number;
}

export interface UserVocabStats {
  totalWords: number;
  masteredCount: number;
  learningCount: number;
  totalDecks: number;
  personalDecksCount?: number;
  personalFoldersCount?: number;
  lastStudiedDeckName?: string;
  lastStudiedAt?: number;
  decks: UserVocabDeckSummary[];
  updatedAt: number;
}

export interface UserActiveDraftSummary {
  testId: string;
  testTitle: string;
  mode: 'exam' | 'practice';
  answeredCount: number;
  totalQuestions: number;
  writingWordCount?: number;
  speakingWordCount?: number;
  elapsedSeconds: number;
  updatedAt: number;
}

export interface UserPreferences {
  themeMode?: 'light' | 'dark' | 'system';
  audioVolumePercent?: number;
  updatedAt?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  nickname?: string;
  phone?: string;
  birthDate?: string; // YYYY-MM-DD
  address?: string;
  photoURL?: string;
  role: UserRole; // Default 'student', auto 'admin' if SUPER_ADMIN_EMAILS
  targetScores?: UserTargetScores;
  vocabStats?: UserVocabStats;
  activeDraftSummary?: UserActiveDraftSummary | null;
  preferences?: UserPreferences;
  totalExamAttempts?: number;
  bestVstepBandScore?: number;
  bestRawScore?: number;
  lastAttemptAt?: number;
  lastTestTitle?: string;
  currentStreak?: number;
  longestStreak?: number;
  pointsBalance?: number;
  assignedBy?: string;
  createdAt: number;
  lastLoginAt?: number;
  lastActiveAt?: number;
}

export interface UserExamAttempt {
  attemptId: string;
  testId: string;
  testTitle: string;
  mode: 'exam' | 'practice';
  score: number;
  totalQuestions: number;
  percentage: number;
  vstepBandScore?: number;
  grade: 'High Pass' | 'Pass' | 'Chưa đạt' | 'Fail';
  listeningScore?: number;
  readingScore?: number;
  writingScore?: number;
  speakingScore?: number;
  timeSpentSeconds: number;
  totalPausedSeconds?: number;
  completedAt: number;
  selectedParts?: string[];
  answers?: Record<number, string>;
  writingSubmission?: {
    task1Text: string;
    task2Text: string;
    task1WordCount: number;
    task2WordCount: number;
  };
  speakingSubmission?: {
    part1Transcript?: string;
    part2Transcript?: string;
    part3Transcript?: string;
    part1Text?: string;
    part2Text?: string;
    part3Text?: string;
    part1WordCount?: number;
    part2WordCount?: number;
    part3WordCount?: number;
    part1AudioDataUrl?: string;
    part2AudioDataUrl?: string;
    part3AudioDataUrl?: string;
    part1DurationSec?: number;
    part2DurationSec?: number;
    part3DurationSec?: number;
    overallBand?: number;
  };
  aiWritingEvaluation?: any;
  aiDiagnosticReport?: any;
}

export interface InProgressAttempt {
  testId: string;
  testTitle?: string;
  mode?: 'exam' | 'practice';
  startedAt?: number;
  lastUpdatedAt?: number;
  savedAt?: number;
  elapsedSeconds: number;
  remainingSeconds?: number;
  timeRemainingSeconds?: number;
  totalPausedSeconds?: number;
  answers: Record<number, string>;
  flagged?: Record<number, boolean>;
  flaggedQuestions?: number[];
  selectedParts?: string[];
  currentPart?: string;
  currentGroupIndex?: number;
  activeQuestionId?: number;
  writingDraft?: {
    task1Text: string;
    task2Text: string;
    task1WordCount: number;
    task2WordCount: number;
  };
  writingSubmission?: {
    task1Text: string;
    task2Text: string;
    task1WordCount: number;
    task2WordCount: number;
  };
  speakingDraft?: any;
  speakingSubmission?: any;
}

