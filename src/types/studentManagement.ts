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

export interface UserVocabLevelBreakdown {
  lv0: number;
  lv1: number;
  lv2: number;
  lv3: number;
  lv4: number;
  lv5: number;
}

export interface UserVocabRecentSession {
  sessionId: string;
  mode: string;
  deckTitle?: string;
  scoreEarned: number;
  accuracy: number;
  totalWords: number;
  correctWords: number;
  completedAt: number;
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
  totalCoins?: number;
  dueWordsCount?: number;
  levelBreakdown?: UserVocabLevelBreakdown;
  recentSessions?: UserVocabRecentSession[];
  decks: UserVocabDeckSummary[];
  updatedAt: number;
}

export interface UserLeaderboardStats {
  bestPercentage: number;
  bestScale100Score: number;
  bestScale10Score?: number;
  bestVstepBandScore?: number;
  bestRawScore: number;
  bestTotalQuestions: number;
  bestGrade: string;
  bestTestTitle?: string;
  totalAttempts: number;
  totalCorrectAnswers: number;
  xp: number;
  streakDays: number;
  lastCompletedAt?: number;
}

export interface UserActiveDraftSummary {
  testId: string;
  testTitle: string;
  mode: 'exam' | 'practice';
  answeredCount: number;
  totalQuestions: number;
  writingWordCount?: number;
  speakingWordCount?: number;
  activeQuestionId?: number;
  elapsedSeconds: number;
  timeRemainingSeconds?: number;
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
  leaderboardStats?: UserLeaderboardStats;
  vocabStats?: UserVocabStats;
  recentAttempts?: UserExamAttempt[];
  inProgressSummary?: InProgressAttempt[];
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

export interface PracticeAuditEntry {
  qId: number;
  selectedAnswer: string;
  isCorrect: boolean;
  practicedAt: number;
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
  practiceAuditLogs?: PracticeAuditEntry[];
  practicedQuestionsCount?: number;
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
  aiSpeakingEvaluation?: any;
  aiDiagnosticReport?: any;
  teacherFeedback?: {
    writingScoreOverride?: number;
    speakingScoreOverride?: number;
    commentVi: string;
    teacherName: string;
    teacherEmail?: string;
    updatedAt: number;
  };
  tabSwitchCount?: number;
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
  practiceAuditLogs?: PracticeAuditEntry[];
  practiceLockedAnswers?: Record<number, boolean>;
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

export interface GuestSubmission {
  id?: string;
  submissionId: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  testId: string;
  testTitle: string;
  mode?: 'exam' | 'practice';
  score: number;
  totalQuestions: number;
  percentage: number;
  vstepBandScore: number;
  listeningScore?: number;
  readingScore?: number;
  writingScore?: number;
  speakingScore?: number;
  timeSpentSeconds?: number;
  completedAt: number;
  submittedAt?: number;
  attempt?: UserExamAttempt;
  answers?: Record<number, string>;
  writingSubmission?: any;
  speakingSubmission?: any;
  aiWritingEvaluation?: any;
  aiDiagnosticReport?: any;
  syncedToUid?: string;
}

