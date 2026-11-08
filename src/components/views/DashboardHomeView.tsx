import React, { useState, useEffect, useMemo } from 'react';
import {
  Flame,
  BookOpen,
  Headphones,
  FileText,
  BookmarkCheck,
  ArrowRight,
  Play,
  Sparkles,
  Edit3,
  Clock,
  Layers,
  Trash2,
  BarChart2,
  Award,
  PenTool,
  CheckCircle2,
  RefreshCw,
  Quote,
  Check,
  Target,
  Tag,
  Mic,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  GripVertical,
  AlertTriangle,
} from 'lucide-react';
import { TestMetadata, InProgressAttempt, isDraftTest, UserTargetScores } from '../../types/exam';
import { NavTabType } from '../navigation/Sidebar';
import { useAuth } from '../../context/AuthContext';
import {
  getStreakStatus,
  recordStudyActivity,
  STREAK_UPDATED_EVENT,
  ComputedStreakStatus,
} from '../../services/streakService';
import { loadUserVocabState } from '../../services/vocabStorageService';
import {
  getMistakeRecords,
  MISTAKES_UPDATED_EVENT,
  syncMistakesWithCloud,
} from '../../services/mistakeService';
import {
  getDailyQuote,
  getRandomDifferentQuote,
  getTimeOfDayGreeting,
  getSavedNickname,
  StudyQuote,
  VIETNAMESE_STUDY_QUOTES,
} from '../../data/vietnameseStudyQuotes';
import {
  DEFAULT_EXAM_CATEGORIES,
  getAllExamCategories,
  getEffectiveTestCategory,
  subscribeToCustomExamTags,
} from '../../services/categoryTagService';
import { ZodiacPixelMascot } from './ZodiacPixelMascot';
import { CompactExamCard } from '../CompactExamCard';
import {
  ExamSortMode,
  ExamViewMode,
  ExamOrderConfig,
  getSavedExamViewMode,
  saveExamViewMode,
  getLocalExamOrderConfig,
  saveExamOrderToCloud,
  togglePinTestOnCloud,
  subscribeToExamOrderConfig,
  sortTestsList,
  compareTestsNaturally,
} from '../../services/examOrderService';

const TARGET_SCORES_STORAGE_KEY = 'langcert_target_scores_v1';

const DEFAULT_TARGET_SCORES: UserTargetScores = {
  overall: 6.5,
  listening: 6.5,
  reading: 6.5,
  writing: 6.5,
  speaking: 6.5,
};

function roundToHalfScore(val: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 6.5;
  return Math.round(Math.max(0, Math.min(10, num)) * 2) / 2;
}

function normalizeLegacyScore(raw: unknown, fallback = 6.5): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (num > 10) {
    // Legacy 50-point default 38 maps cleanly to VSTEP default 6.5 (B2)
    if (num === 38) return 6.5;
    return roundToHalfScore((num / 50) * 10);
  }
  return roundToHalfScore(num);
}

function loadSavedTargetScores(uid?: string, profileScores?: UserTargetScores): UserTargetScores {
  if (profileScores && typeof profileScores.overall === 'number') {
    const listening = normalizeLegacyScore(profileScores.listening, 6.5);
    const reading = normalizeLegacyScore(profileScores.reading, 6.5);
    const writing = normalizeLegacyScore(profileScores.writing, 6.5);
    const speaking =
      profileScores.speaking !== undefined
        ? normalizeLegacyScore(profileScores.speaking, 6.5)
        : 6.5;
    const overall =
      profileScores.overall > 10 || profileScores.speaking === undefined
        ? roundToHalfScore((listening + reading + writing + speaking) / 4)
        : normalizeLegacyScore(profileScores.overall, 6.5);
    return { overall, listening, reading, writing, speaking };
  }
  try {
    const raw = localStorage.getItem(`${TARGET_SCORES_STORAGE_KEY}_${uid || 'guest'}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const listening = normalizeLegacyScore(parsed.listening, 6.5);
      const reading = normalizeLegacyScore(parsed.reading, 6.5);
      const writing = normalizeLegacyScore(parsed.writing, 6.5);
      const speaking =
        parsed.speaking !== undefined ? normalizeLegacyScore(parsed.speaking, 6.5) : 6.5;
      const overall =
        Number(parsed.overall) > 10 || parsed.speaking === undefined
          ? roundToHalfScore((listening + reading + writing + speaking) / 4)
          : normalizeLegacyScore(parsed.overall, 6.5);
      return {
        overall,
        listening,
        reading,
        writing,
        speaking,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_TARGET_SCORES;
}

interface DashboardHomeViewProps {
  tests: TestMetadata[];
  onStartTest: (testId: string) => void;
  onSelectMode: (mode: 'exam' | 'practice') => void;
  onNavigateTab: (tab: NavTabType) => void;
  onEditTest: (testId: string) => void;
  onRequestDeleteTest?: (testId: string, testTitle: string) => void;
  onOpenHistory?: (testId?: string) => void;
  onOpenProfile?: () => void;
  onResumeInProgress?: (testId: string) => void;
  onRestartTest?: (testId: string) => void;
  onSelectVocabForTest?: (testId: string) => void;
  inProgressMap?: Record<string, InProgressAttempt>;
  completedScoresMap?: Record<string, number>;
  streakDays?: number;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  tests,
  onStartTest,
  onSelectMode,
  onNavigateTab,
  onEditTest,
  onRequestDeleteTest,
  onOpenHistory,
  onOpenProfile,
  onResumeInProgress,
  onRestartTest,
  onSelectVocabForTest,
  inProgressMap = {},
  completedScoresMap = {},
}) => {
  const { canManageExams, currentUser, userProfile, updateUserProfileData } = useAuth();
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ExamViewMode>(() => getSavedExamViewMode());
  const [sortMode, setSortMode] = useState<ExamSortMode>('custom');
  const [examOrderConfig, setExamOrderConfig] = useState<ExamOrderConfig>(() =>
    getLocalExamOrderConfig()
  );
  const [isReorderMode, setIsReorderMode] = useState<boolean>(false);
  const [draggedTestId, setDraggedTestId] = useState<string | null>(null);
  const [dragOverTestId, setDragOverTestId] = useState<string | null>(null);
  const [orderSyncNotice, setOrderSyncNotice] = useState<string>('');
  const [customTags, setCustomTags] = useState<string[]>(() => getAllExamCategories());
  const [streakStatus, setStreakStatus] = useState<ComputedStreakStatus>(() => getStreakStatus());

  // Greeting & Daily Quote States
  const defaultAccountName =
    userProfile?.nickname ||
    userProfile?.displayName ||
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'Học viên VSTEP');

  const [nickname, setNickname] = useState<string>(() =>
    userProfile?.nickname || getSavedNickname(currentUser?.uid, defaultAccountName)
  );
  const [currentQuote, setCurrentQuote] = useState<StudyQuote>(() => getDailyQuote());
  const [isQuoteSpinning, setIsQuoteSpinning] = useState<boolean>(false);
  const [greetingInfo, setGreetingInfo] = useState(() => getTimeOfDayGreeting());

  // Goal Board (Bảng Mục Tiêu) States
  const [targetScores, setTargetScores] = useState<UserTargetScores>(() =>
    loadSavedTargetScores(currentUser?.uid, userProfile?.targetScores)
  );
  const [isEditingGoals, setIsEditingGoals] = useState<boolean>(false);

  // Daily Study Mission real-time metrics (SRS Due, Unmastered Mistakes)
  const [dueSrsCount, setDueSrsCount] = useState<number>(0);
  const [enrolledSrsCount, setEnrolledSrsCount] = useState<number>(0);
  const [unmasteredMistakesCount, setUnmasteredMistakesCount] = useState<number>(0);
  const [masteredMistakesCount, setMasteredMistakesCount] = useState<number>(0);

  useEffect(() => {
    const uid = currentUser?.uid || 'guest';
    const refreshDailyMissionData = () => {
      try {
        const vocabState = loadUserVocabState(uid);
        const now = Date.now();
        const srsRecords = Object.values(vocabState.srsMap || {}).filter(
          (r) => r && r.enrolled && !r.suspended
        );
        setEnrolledSrsCount(srsRecords.length);
        setDueSrsCount(
          srsRecords.filter((r) => r.dueAt !== null && r.dueAt <= now).length
        );
      } catch {
        setDueSrsCount(0);
      }

      try {
        const mistakes = getMistakeRecords(uid);
        setUnmasteredMistakesCount(mistakes.filter((m) => !m.mastered).length);
        setMasteredMistakesCount(mistakes.filter((m) => m.mastered).length);
      } catch {
        setUnmasteredMistakesCount(0);
      }
    };

    refreshDailyMissionData();
    if (uid !== 'guest') {
      syncMistakesWithCloud({ uid, tests }).then(() => {
        refreshDailyMissionData();
      }).catch(() => {});
    }

    window.addEventListener(MISTAKES_UPDATED_EVENT, refreshDailyMissionData);
    window.addEventListener(STREAK_UPDATED_EVENT, refreshDailyMissionData);
    return () => {
      window.removeEventListener(MISTAKES_UPDATED_EVENT, refreshDailyMissionData);
      window.removeEventListener(STREAK_UPDATED_EVENT, refreshDailyMissionData);
    };
  }, [currentUser?.uid, tests]);

  useEffect(() => {
    const resolved =
      userProfile?.nickname || getSavedNickname(currentUser?.uid, defaultAccountName);
    setNickname(resolved);
  }, [userProfile?.nickname, currentUser?.uid, defaultAccountName]);

  useEffect(() => {
    setTargetScores(loadSavedTargetScores(currentUser?.uid, userProfile?.targetScores));
  }, [currentUser?.uid, userProfile?.targetScores]);

  useEffect(() => {
    const unsub = subscribeToCustomExamTags(() => {
      setCustomTags(getAllExamCategories());
    });
    const unsubOrder = subscribeToExamOrderConfig((cfg) => {
      setExamOrderConfig(cfg);
    });
    return () => {
      unsub();
      unsubOrder();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setGreetingInfo(getTimeOfDayGreeting());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshQuote = () => {
    setIsQuoteSpinning(true);
    const nextQuote = getRandomDifferentQuote(currentQuote.id);
    setCurrentQuote(nextQuote);
    setTimeout(() => setIsQuoteSpinning(false), 350);
  };

  const clampScore = (val: number) => roundToHalfScore(val);

  const handleSkillGoalChange = (
    skill: 'listening' | 'reading' | 'writing' | 'speaking',
    rawVal: number
  ) => {
    const val = clampScore(rawVal);
    setTargetScores((prev) => {
      const next: UserTargetScores = {
        ...prev,
        speaking: prev.speaking ?? 6.5,
        [skill]: val,
      };
      next.overall = roundToHalfScore(
        (next.listening + next.reading + next.writing + (next.speaking ?? 6.5)) / 4
      );
      return next;
    });
  };

  const handleOverallGoalChange = (rawVal: number) => {
    const val = clampScore(rawVal);
    setTargetScores({
      overall: val,
      listening: val,
      reading: val,
      writing: val,
      speaking: val,
    });
  };

  const handleSaveGoals = async () => {
    setIsEditingGoals(false);
    const payload: UserTargetScores = {
      ...targetScores,
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(
        `${TARGET_SCORES_STORAGE_KEY}_${currentUser?.uid || 'guest'}`,
        JSON.stringify(payload)
      );
    } catch {
      // ignore
    }
    await updateUserProfileData({ targetScores: payload });
  };

  useEffect(() => {
    setStreakStatus(getStreakStatus());
    const handleStreakUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<ComputedStreakStatus>;
      if (customEvent.detail) {
        setStreakStatus(customEvent.detail);
      } else {
        setStreakStatus(getStreakStatus());
      }
    };
    window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdated);
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdated);
  }, []);

  const handleStartExamMode = (testId: string) => {
    onSelectMode('exam');
    onStartTest(testId);
  };

  const handleStartPracticeMode = (testId: string) => {
    onSelectMode('practice');
    onStartTest(testId);
  };

  // Build available category filter tabs dynamically
  const availableCategories = useMemo(() => {
    const base = [...DEFAULT_EXAM_CATEGORIES];
    const fromTests = tests
      .map((t) => getEffectiveTestCategory(t))
      .filter((c) => c && !base.includes(c as (typeof DEFAULT_EXAM_CATEGORIES)[number]));
    const merged = Array.from(new Set([...base, ...customTags, ...fromTests]));
    // Hide "Đề Nháp" tab for students (only Teachers & Admins see Draft exams)
    return merged.filter((cat) => (cat === 'Đề Nháp' ? canManageExams : true));
  }, [tests, customTags, canManageExams]);

  const filteredTests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const byCatAndSearch = tests.filter((t) => {
      if (q) {
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchSub = t.subtitle ? t.subtitle.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchSub) return false;
      }
      if (filterCategory === 'all') return true;
      if (filterCategory === 'Đề Nháp') return isDraftTest(t);
      return getEffectiveTestCategory(t) === filterCategory;
    });

    return sortTestsList(
      byCatAndSearch,
      examOrderConfig,
      sortMode,
      inProgressMap,
      completedScoresMap
    );
  }, [
    tests,
    searchQuery,
    filterCategory,
    examOrderConfig,
    sortMode,
    inProgressMap,
    completedScoresMap,
  ]);

  const handleSelectViewMode = (mode: ExamViewMode) => {
    setViewMode(mode);
    saveExamViewMode(mode);
  };

  const showSyncToast = (msg: string) => {
    setOrderSyncNotice(msg);
    setTimeout(() => {
      setOrderSyncNotice((prev) => (prev === msg ? '' : prev));
    }, 3000);
  };

  const handleMoveTestRelative = async (testId: string, direction: -1 | 1) => {
    const fullSorted = sortTestsList(tests, examOrderConfig, 'custom');
    const visibleIds = filteredTests.map((t) => t.id);
    const currentPosInVisible = visibleIds.indexOf(testId);
    const targetPosInVisible = currentPosInVisible + direction;
    if (
      currentPosInVisible === -1 ||
      targetPosInVisible < 0 ||
      targetPosInVisible >= visibleIds.length
    ) {
      return;
    }
    const swapTargetId = visibleIds[targetPosInVisible];
    const fullIds = fullSorted.map((t) => t.id);
    const idxA = fullIds.indexOf(testId);
    const idxB = fullIds.indexOf(swapTargetId);
    if (idxA === -1 || idxB === -1) return;

    const nextIds = [...fullIds];
    const temp = nextIds[idxA];
    nextIds[idxA] = nextIds[idxB];
    nextIds[idxB] = temp;

    const updated = await saveExamOrderToCloud(nextIds, examOrderConfig.pinnedTestIds);
    setExamOrderConfig(updated);
    setSortMode('custom');
    showSyncToast('Đã lưu vị trí đề lên Cloud!');
  };

  const handleDropTestOnTarget = async (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const fullSorted = sortTestsList(tests, examOrderConfig, 'custom');
    const fullIds = fullSorted.map((t) => t.id);
    const fromIdx = fullIds.indexOf(sourceId);
    const toIdx = fullIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const nextIds = [...fullIds];
    const [moved] = nextIds.splice(fromIdx, 1);
    nextIds.splice(toIdx, 0, moved);

    const updated = await saveExamOrderToCloud(nextIds, examOrderConfig.pinnedTestIds);
    setExamOrderConfig(updated);
    setSortMode('custom');
    showSyncToast('Đã cập nhật thứ tự kéo thả lên Cloud!');
  };

  const handleTogglePinTest = async (testId: string) => {
    const fullSorted = sortTestsList(tests, examOrderConfig, 'custom');
    const updated = await togglePinTestOnCloud(
      testId,
      fullSorted.map((t) => t.id)
    );
    setExamOrderConfig(updated);
    setSortMode('custom');
    const isNowPinned = updated.pinnedTestIds.includes(testId);
    showSyncToast(
      isNowPinned ? 'Đã ghim bộ đề lên đầu trang (Cloud)!' : 'Đã bỏ ghim bộ đề!'
    );
  };

  const handleAutoSortNaturalOrderToCloud = async () => {
    const naturallySorted = [...tests].sort(compareTestsNaturally);
    const updated = await saveExamOrderToCloud(
      naturallySorted.map((t) => t.id),
      examOrderConfig.pinnedTestIds
    );
    setExamOrderConfig(updated);
    setSortMode('custom');
    showSyncToast('Đã chuẩn hóa thứ tự Test 1 → N và đồng bộ Cloud!');
  };

  const getLevelBadgeForScore = (score: number) => {
    if (score >= 8.5) return { label: 'Bậc 5 (C1)', color: 'bg-amber-300 text-slate-950' };
    if (score >= 6.0) return { label: 'Bậc 4 (B2)', color: 'bg-lime-200 text-slate-950' };
    if (score >= 4.0) return { label: 'Bậc 3 (B1)', color: 'bg-sky-200 text-slate-950' };
    return { label: 'Dưới B1 (<4.0)', color: 'bg-slate-200 text-slate-900' };
  };

  const getSkillLevelLabel = (score: number) => {
    if (score >= 8.5) return 'Bậc 5 - C1';
    if (score >= 6.0) return 'Bậc 4 - B2';
    if (score >= 4.0) return 'Bậc 3 - B1';
    return 'Dưới B1';
  };

  const overallBadge = getLevelBadgeForScore(targetScores.overall);

  return (
    <div className="space-y-6 pb-20">
      {/* Greeting + Daily Inspirational Study Quote Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-lime-200 dark:border-slate-800 border-b-4 border-b-lime-300 dark:border-b-slate-950 p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-lime-100/60 dark:bg-emerald-950/30 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Time-of-Day Greeting + Nickname (Nickname editor moved to Avatar -> Thông tin cá nhân) */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#3C8C02] dark:text-[#58CC02] bg-lime-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-lime-200 dark:border-emerald-800/60">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{greetingInfo.periodLabelVi}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {greetingInfo.greeting},{' '}
                <span className="bg-gradient-to-r from-[#3C8C02] to-emerald-600 dark:from-[#58CC02] dark:to-emerald-400 bg-clip-text text-transparent">
                  {nickname}!
                </span>
              </h2>
            </div>
          </div>

          {/* Right: Vietnamese Inspirational Quote of the Day + Icon-Only Refresh Button */}
          <div className="lg:max-w-xl w-full rounded-2xl bg-gradient-to-br from-amber-50/90 via-lime-50/60 to-emerald-50/70 dark:from-slate-800/90 dark:via-slate-800/70 dark:to-emerald-950/30 border border-amber-200/80 dark:border-slate-700 p-4 flex items-start justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Quote className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="font-serif italic text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                  “{currentQuote.text}”
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="text-amber-700 dark:text-amber-400 font-extrabold">
                    — {currentQuote.author}
                  </span>
                  <span>•</span>
                  <span className="text-[10px] bg-white/80 dark:bg-slate-900/70 px-2 py-0.5 rounded-md border border-slate-200/70 dark:border-slate-700">
                    Châm ngôn #{currentQuote.id}/{VIETNAMESE_STUDY_QUOTES.length}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshQuote}
              className="shrink-0 inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 border-2 border-amber-200 dark:border-slate-600 border-b-4 border-b-amber-300 dark:border-b-slate-950 p-2.5 text-amber-700 dark:text-amber-300 shadow-2xs transition-all active:border-b-2 active:translate-y-0.5 cursor-pointer"
              title="Đổi câu châm ngôn học tập khác"
              aria-label="Đổi câu châm ngôn học tập khác"
            >
              <RefreshCw
                className={`h-4 w-4 transition-transform duration-300 ${
                  isQuoteSpinning ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Top Banner Row: Interactive Goal Board (Bảng Mục Tiêu + 12-Zodiac Pixel Mascot) & Streak Widget */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
        {/* Left Hero Card: Bảng Mục Tiêu Điểm Số + Linh Vật 12 Con Giáp Pixel */}
        <div className="md:col-span-7 rounded-3xl bg-gradient-to-br from-[#58CC02] via-[#46A302] to-[#2E7D32] border-2 border-[#46A302] border-b-4 border-b-[#1B5E20] p-5 sm:p-6 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 flex flex-col sm:flex-row items-start justify-between gap-4">
            {/* Left Column: Goal Board Header, Overall Target & 4 VSTEP Skill Bars / Sliders */}
            <div className="flex-1 w-full min-w-0">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-black text-xs backdrop-blur-xs">
                  <Target className="h-3.5 w-3.5" />
                  <span>BẢNG MỤC TIÊU VSTEP B1–B2–C1</span>
                </div>

                {/* Compact Edit Button */}
                {isEditingGoals ? (
                  <button
                    type="button"
                    onClick={handleSaveGoals}
                    className="inline-flex items-center gap-1 rounded-xl bg-white text-[#2E7D32] hover:bg-lime-50 px-2.5 py-1 text-xs font-black shadow-xs transition-all cursor-pointer"
                    title="Lưu mục tiêu điểm số"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Lưu</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingGoals(true)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-xl bg-black/20 hover:bg-black/35 text-white border border-white/25 transition-all cursor-pointer"
                    title="Chỉnh sửa mục tiêu điểm số 4 kỹ năng VSTEP (Thang 10, bước nhảy 0.5)"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Overall Target Score Display */}
              <div className="flex flex-wrap items-baseline gap-2.5 mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-lime-100">
                    Overall:
                  </span>
                  {isEditingGoals ? (
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      value={targetScores.overall}
                      onChange={(e) => handleOverallGoalChange(Number(e.target.value))}
                      className="w-20 rounded-xl bg-white text-slate-900 px-2 py-0.5 text-xl font-black text-center focus:outline-hidden"
                    />
                  ) : (
                    <span className="text-3xl sm:text-4xl font-black tabular-nums">
                      {targetScores.overall.toFixed(1)}
                    </span>
                  )}
                  <span className="text-sm font-bold text-lime-100">/10</span>
                </div>

                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-black shadow-2xs ${overallBadge.color}`}
                >
                  {overallBadge.label}
                </span>

                {isEditingGoals && (
                  <input
                    type="range"
                    min={0}
                    max={10}
                    step={0.5}
                    value={targetScores.overall}
                    onChange={(e) => handleOverallGoalChange(Number(e.target.value))}
                    className="w-full sm:w-32 accent-amber-300 cursor-pointer h-1.5 rounded-lg"
                    title="Kéo để chỉnh nhanh điểm Overall (Thang 10)"
                  />
                )}
              </div>

              {/* 4 Individual VSTEP Skills (Listening, Reading, Writing, Speaking) */}
              <div className="space-y-2 bg-black/15 rounded-2xl p-3 border border-white/15 backdrop-blur-[2px]">
                {(
                  [
                    { key: 'listening', label: 'Listening (Nghe)', icon: Headphones },
                    { key: 'reading', label: 'Reading (Đọc)', icon: BookOpen },
                    { key: 'writing', label: 'Writing (Viết)', icon: PenTool },
                    { key: 'speaking', label: 'Speaking (Nói)', icon: Mic },
                  ] as const
                ).map(({ key, label, icon: SkillIcon }) => {
                  const val =
                    key === 'speaking'
                      ? targetScores.speaking ?? 6.5
                      : targetScores[key];
                  const pct = Math.min(100, Math.round((val / 10) * 100));
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 font-extrabold text-lime-50">
                          <SkillIcon className="h-3.5 w-3.5 text-lime-200" />
                          <span>{label}</span>
                        </span>
                        {isEditingGoals ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="range"
                              min={0}
                              max={10}
                              step={0.5}
                              value={val}
                              onChange={(e) =>
                                handleSkillGoalChange(key, Number(e.target.value))
                              }
                              className="w-20 sm:w-24 accent-lime-300 cursor-pointer h-1.5"
                            />
                            <input
                              type="number"
                              min={0}
                              max={10}
                              step={0.5}
                              value={val}
                              onChange={(e) =>
                                handleSkillGoalChange(key, Number(e.target.value))
                              }
                              className="w-14 rounded-lg bg-white text-slate-900 px-1.5 py-0.5 text-xs font-black text-center focus:outline-hidden"
                            />
                            <span className="text-[10px] font-bold text-lime-100">/10</span>
                          </div>
                        ) : (
                          <span className="font-mono font-black text-white tabular-nums">
                            {val.toFixed(1)}/10{' '}
                            <span className="text-[10px] font-bold text-lime-200">
                              ({getSkillLevelLabel(val)})
                            </span>
                          </span>
                        )}
                      </div>
                      {!isEditingGoals && (
                        <div className="h-2 w-full rounded-full bg-black/25 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-lime-200 to-amber-300 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column inside Goal Board: 12-Zodiac Pixel / Voxel Mascot */}
            <div className="shrink-0 self-center sm:self-end pt-1 sm:pt-0">
              <ZodiacPixelMascot
                birthDate={userProfile?.birthDate}
                targetOverall={targetScores.overall}
                onOpenProfile={onOpenProfile}
              />
            </div>
          </div>

          {/* Bottom Quick Action Buttons inside Goal Board */}
          <div className="mt-4 pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 relative z-10">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleStartExamMode(tests[0]?.id || 'test-1')}
                className="inline-flex items-center gap-2 rounded-2xl bg-white text-[#2E7D32] hover:bg-lime-50 px-4 py-2 text-xs font-black shadow-md border-2 border-lime-200 border-b-4 border-b-lime-400 transition-all active:border-b-0 active:translate-y-1 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-[#2E7D32]" />
                <span>Thi thử ngay</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('listening')}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-[#1CB0F6] hover:bg-[#1899D6] text-white border-2 border-[#1899D6] border-b-4 border-b-[#1480B3] px-3.5 py-2 text-xs font-black transition-all active:border-b-0 active:translate-y-1 cursor-pointer"
              >
                <Headphones className="h-3.5 w-3.5" />
                <span>Luyện nghe theo Part</span>
              </button>
            </div>

            <span className="text-[11px] font-bold text-lime-100/90">
              Chuẩn Bộ GD&ĐT: B1 ≥4.0 · B2 ≥6.0 · C1 ≥8.5
            </span>
          </div>

          {/* Background decorative circles */}
          <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
        </div>

        {/* Right Streak Card (Real Calendar-Tracked Streak) */}
        <div className="md:col-span-5 rounded-3xl bg-gradient-to-br from-[#FF9600] to-[#FFC800] border-2 border-[#E58700] border-b-4 border-b-[#CC7700] p-6 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-orange-100">
                <Flame className="h-4 w-4 fill-white text-white" />
                <span>CHUỖI NGÀY HỌC</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-extrabold bg-black/15 px-2.5 py-0.5 rounded-full text-orange-50 tabular-nums">
                <span>Kỷ lục: {streakStatus.longestStreak} ngày</span>
                <span>•</span>
                <span>Tổng: {streakStatus.totalActiveDays} ngày</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black tabular-nums">
                  {streakStatus.currentStreak}
                </span>
                <span className="text-sm font-bold text-orange-100">ngày liên tiếp</span>
              </div>

              {streakStatus.studiedToday ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/25 text-white text-[11px] font-black shadow-2xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  <span>Đã học hôm nay ({streakStatus.todayCount})</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    recordStudyActivity('Điểm danh & khởi động học tập hôm nay', currentUser?.uid);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white text-orange-600 hover:bg-orange-50 text-[11px] font-black shadow-xs transition-all cursor-pointer"
                  title="Điểm danh bắt đầu phiên học hôm nay hoặc hoàn thành 1 bài tập / ôn từ vựng để giữ chuỗi!"
                >
                  <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
                  <span>Điểm danh hôm nay</span>
                </button>
              )}
            </div>

            <p className="mt-1.5 text-xs text-orange-50 leading-relaxed">
              {streakStatus.studiedToday
                ? `Tuyệt vời! Bạn đã hoàn thành ${streakStatus.todayCount} hoạt động học tập hôm nay. Chuỗi ngày học đã được giữ vững!`
                : 'Hãy hoàn thành ít nhất 1 bài tập, ôn từ vựng hoặc điểm danh hôm nay để giữ vững chuỗi học tập!'}
            </p>
          </div>

          {/* Days Indicator Row (Real Monday T2 -> Sunday CN of Current Week) */}
          <div className="mt-5 pt-4 border-t border-white/20 relative z-10">
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {streakStatus.weekDays.map((d) => (
                <div
                  key={d.dateKey}
                  className="flex flex-col items-center gap-1"
                  title={`${d.label} (${d.dayNumber}/${d.monthNumber}): ${
                    d.active ? `Đã học (${d.activityCount} hoạt động)` : d.isToday ? 'Hôm nay (Chưa học)' : 'Chưa học'
                  }`}
                >
                  <span
                    className={`text-[10px] font-extrabold ${
                      d.isToday ? 'text-white underline underline-offset-2' : 'text-orange-100'
                    }`}
                  >
                    {d.label}
                  </span>
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                      d.active
                        ? 'bg-white text-orange-600 shadow-sm scale-110'
                        : d.isToday
                        ? 'bg-white/25 text-white ring-2 ring-white border border-white/60 animate-pulse'
                        : 'bg-white/20 text-white/80'
                    }`}
                  >
                    {d.active ? (
                      <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
                    ) : (
                      <span className="text-[10px] font-bold tabular-nums">{d.dayNumber}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bảng Nhiệm Vụ Học Tập Hôm Nay (Daily VSTEP Study Mission) */}
      {(() => {
        const inProgressList = Object.values(inProgressMap || {}).sort(
          (a, b) => (b.savedAt || 0) - (a.savedAt || 0)
        );
        const latestDraft = inProgressList[0];
        const nextRecommendedTest =
          tests.find((t) => completedScoresMap[t.id] === undefined) || tests[0];

        const srsTaskDone = enrolledSrsCount > 0 && dueSrsCount === 0;
        const mistakeTaskDone = unmasteredMistakesCount === 0 && masteredMistakesCount > 0;
        const practiceTaskDone = Boolean(streakStatus.studiedToday);

        const completedMissions =
          (srsTaskDone ? 1 : 0) + (mistakeTaskDone ? 1 : 0) + (practiceTaskDone ? 1 : 0);
        const missionProgressPct = Math.round((completedMissions / 3) * 100);

        return (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-4 border-b-slate-300 dark:border-b-slate-950 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#1899D6] dark:text-[#1CB0F6]">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>LỘ TRÌNH TỰ ĐỘNG HẰNG NGÀY</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  Nhiệm Vụ Học Tập Hôm Nay (3 Bước Tăng Band VSTEP)
                </h3>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase text-slate-400">
                    Tiến độ hôm nay
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-black tabular-nums text-slate-800 dark:text-white">
                    {completedMissions}/3 nhiệm vụ ({missionProgressPct}%)
                  </div>
                </div>
                <div className="w-20 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#58CC02] transition-all duration-300"
                    style={{ width: `${missionProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Mission 1: SRS Vocabulary Review */}
              <div
                className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col justify-between gap-3 transition-all ${
                  dueSrsCount > 0
                    ? 'border-[#CE82FF] border-b-[#A560E8] bg-purple-50/40 dark:bg-purple-950/25'
                    : 'border-slate-200 dark:border-slate-800 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/60 dark:bg-slate-800/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#A560E8] dark:text-purple-300">
                      <BookmarkCheck className="h-4 w-4" />
                      <span>1. Ôn từ vựng SRS đến hạn</span>
                    </span>
                    <span className="font-mono text-xs font-black tabular-nums px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 text-[#A560E8] dark:text-purple-300">
                      {dueSrsCount} từ cần ôn
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                    {dueSrsCount > 0
                      ? `Bạn có ${dueSrsCount} từ vựng đã đến lịch lặp lại ngắt quãng (SRS) hôm nay.`
                      : enrolledSrsCount > 0
                      ? `Tuyệt vời! Bạn đã ôn hết toàn bộ ${enrolledSrsCount} từ vựng đến hạn hôm nay.`
                      : 'Khởi động kho 450+ từ vựng B1-B2 theo 15 chủ đề để nạp vào lịch SRS.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('vocab')}
                  className={`${
                    dueSrsCount > 0 ? 'btn-duo-purple' : 'btn-duo-white'
                  } w-full py-2.5 px-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer`}
                >
                  <span>
                    {dueSrsCount > 0 ? `Ôn ngay ${dueSrsCount} từ đến hạn` : 'Mở Kho Từ Vựng SRS'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Mission 2: Mistake Notebook Redo */}
              <div
                className={`rounded-2xl border-2 border-b-4 p-4 flex flex-col justify-between gap-3 transition-all ${
                  unmasteredMistakesCount > 0
                    ? 'border-[#FF9600] border-b-[#E58700] bg-amber-50/40 dark:bg-amber-950/25'
                    : 'border-slate-200 dark:border-slate-800 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/60 dark:bg-slate-800/40'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#E58700] dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 text-[#FF9600]" />
                      <span>2. Khắc phục câu từng sai</span>
                    </span>
                    <span className="font-mono text-xs font-black tabular-nums px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 text-[#E58700] dark:text-amber-300">
                      {unmasteredMistakesCount} câu cần sửa
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                    {unmasteredMistakesCount > 0
                      ? `Có ${unmasteredMistakesCount} câu Listening/Reading từng chọn nhầm cần làm lại để nắm chắc bẫy đề.`
                      : masteredMistakesCount > 0
                      ? `Đã khắc phục 100% (${masteredMistakesCount} câu từng sai)! Sổ tay câu sai đã sạch bóng.`
                      : 'Chưa có câu sai tồn đọng. Mọi câu làm nhầm khi luyện đề sẽ tự động lưu vào đây.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('mistakes')}
                  className={`${
                    unmasteredMistakesCount > 0 ? 'btn-duo-orange' : 'btn-duo-white'
                  } w-full py-2.5 px-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer`}
                >
                  <span>
                    {unmasteredMistakesCount > 0
                      ? `Làm lại ${unmasteredMistakesCount} câu hay sai`
                      : 'Xem Sổ Tay Câu Sai'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Mission 3: Resume In-Progress Draft or Start Next Recommended Exam */}
              <div className="rounded-2xl border-2 border-[#58CC02] border-b-4 border-b-[#46A302] bg-lime-50/40 dark:bg-emerald-950/25 p-4 flex flex-col justify-between gap-3 transition-all">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#3C8C02] dark:text-lime-300">
                      <Play className="h-4 w-4 fill-[#58CC02] text-[#58CC02]" />
                      <span>
                        {latestDraft ? '3. Làm tiếp bài đang dở' : '3. Luyện đề gợi ý hôm nay'}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-lime-300 dark:border-emerald-800 text-[#3C8C02] dark:text-lime-300">
                      {latestDraft ? 'Đang lưu Cloud' : 'Đề xuất'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                    {latestDraft
                      ? `Tiếp tục "${latestDraft.testTitle}" (${
                          Object.values(latestDraft.answers || {}).filter(
                            (v) => v && v.trim().length > 0
                          ).length
                        }/75 câu đã chọn).`
                      : `Luyện tập "${
                          nextRecommendedTest?.title || 'Test 1'
                        }" để rèn phản xạ 4 kỹ năng chuẩn VSTEP.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (latestDraft && onResumeInProgress) {
                      onResumeInProgress(latestDraft.testId);
                    } else {
                      handleStartPracticeMode(nextRecommendedTest?.id || 'test-1');
                    }
                  }}
                  className="btn-duo-green w-full py-2.5 px-3.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>
                    {latestDraft
                      ? `Làm tiếp ${latestDraft.testTitle}`
                      : `Luyện ngay ${nextRecommendedTest?.title || 'Test 1'}`}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Truy Cập Nhanh */}
      <div className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center sm:text-left">
          Truy cập nhanh
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div
            onClick={() => onNavigateTab('tests')}
            className="group cursor-pointer rounded-3xl bg-white dark:bg-slate-800/90 p-4 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 hover:border-[#58CC02] hover:border-b-[#46A302] dark:hover:border-[#58CC02] shadow-2xs hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-11 w-11 rounded-2xl bg-[#D7FFB8] dark:bg-emerald-950/60 border-b-2 border-[#58CC02]/40 flex items-center justify-center text-[#46A302] dark:text-[#58CC02] group-hover:scale-110 transition-transform">
                <BookOpen className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform group-hover:text-[#58CC02]" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Luyện đề</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {tests.length} bộ đề chuẩn 4 kỹ năng L-R-W-S
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('listening')}
            className="group cursor-pointer rounded-3xl bg-white dark:bg-slate-800/90 p-4 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 hover:border-[#1CB0F6] hover:border-b-[#1899D6] dark:hover:border-[#1CB0F6] shadow-2xs hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-11 w-11 rounded-2xl bg-[#DDF4FF] dark:bg-sky-950/60 border-b-2 border-[#1CB0F6]/40 flex items-center justify-center text-[#1899D6] dark:text-[#1CB0F6] group-hover:scale-110 transition-transform">
                <Headphones className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform group-hover:text-[#1CB0F6]" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Luyện nghe</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Audio từng Part & Highlight script
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('reading')}
            className="group cursor-pointer rounded-3xl bg-white dark:bg-slate-800/90 p-4 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 hover:border-[#FF9600] hover:border-b-[#E58700] dark:hover:border-[#FF9600] shadow-2xs hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-11 w-11 rounded-2xl bg-[#FFF0D6] dark:bg-amber-950/60 border-b-2 border-[#FF9600]/40 flex items-center justify-center text-[#E58700] dark:text-[#FF9600] group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform group-hover:text-[#FF9600]" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Luyện đọc</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Split screen đối chiếu 4 Passages
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('writing_speaking')}
            className="group cursor-pointer rounded-3xl bg-white dark:bg-slate-800/90 p-4 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 hover:border-[#CE82FF] hover:border-b-[#A560E8] dark:hover:border-[#CE82FF] shadow-2xs hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-11 w-11 rounded-2xl bg-[#F3E5FF] dark:bg-purple-950/60 border-b-2 border-[#CE82FF]/40 flex items-center justify-center text-[#A560E8] dark:text-[#CE82FF] group-hover:scale-110 transition-transform">
                <PenTool className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform group-hover:text-[#CE82FF]" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Viết & Nói</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Task 1–2, Mind-map & Chấm chữa AI
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('vocab')}
            className="group cursor-pointer rounded-3xl bg-white dark:bg-slate-800/90 p-4 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 hover:border-[#FF4B4B] hover:border-b-[#EA2B2B] dark:hover:border-[#FF4B4B] shadow-2xs hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-11 w-11 rounded-2xl bg-[#FFDFE0] dark:bg-rose-950/60 border-b-2 border-[#FF4B4B]/40 flex items-center justify-center text-[#EA2B2B] dark:text-[#FF4B4B] group-hover:scale-110 transition-transform">
                <BookmarkCheck className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform group-hover:text-[#FF4B4B]" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Từ vựng VSTEP</div>
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              Quizlet + Anki Spaced Repetition
            </div>
          </div>
        </div>
      </div>

      {/* Lộ Trình Học & Danh Sách Đề Thi */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Lộ trình đề thi VSTEP B1–B2–C1
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Phân loại theo nhãn đề của Giáo viên: Đề thi minh họa, Đề thi thật{canManageExams ? ', Đề Nháp' : ''} và các mục tùy chỉnh
            </p>
          </div>

          {orderSyncNotice && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold animate-in fade-in duration-150">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>{orderSyncNotice}</span>
            </div>
          )}
        </div>

        {/* Search + Sort + Admin Reorder + View Mode Switcher Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Search Input */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm bộ đề theo tên..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-4 border-b-slate-300 dark:border-b-slate-950 text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#58CC02]/30 focus:border-[#58CC02] focus:border-b-[#46A302]"
            />
          </div>

          {/* Right: Quick Sort Select + Admin Reorder Button + Grid/List Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Sort Dropdown */}
            <div className="relative inline-flex items-center">
              <ArrowUpDown className="h-3.5 w-3.5 text-[#58CC02] absolute left-3 pointer-events-none" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as ExamSortMode)}
                className="pl-8 pr-7 py-2 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-4 border-b-slate-300 dark:border-b-slate-950 text-xs font-extrabold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:border-[#58CC02] cursor-pointer"
                title="Chọn cách sắp xếp bộ đề"
              >
                <option value="custom">Thứ tự chuẩn GV (Cloud)</option>
                <option value="title_asc">Tên đề: Test 1 → N</option>
                <option value="title_desc">Tên đề: Test N → 1</option>
                <option value="newest">Mới cập nhật nhất</option>
                <option value="uncompleted_first">Ưu tiên đề Đang làm / Chưa làm</option>
              </select>
            </div>

            {/* Admin Custom Reorder Mode Toggle */}
            {canManageExams && (
              <button
                type="button"
                onClick={() => {
                  setIsReorderMode((prev) => !prev);
                  setSortMode('custom');
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black border-2 border-b-4 transition-all active:border-b-0 active:translate-y-1 cursor-pointer ${
                  isReorderMode
                    ? 'bg-[#58CC02] text-white border-[#58CC02] border-b-[#46A302] shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 border-b-slate-300 dark:border-b-slate-950 hover:border-[#58CC02] hover:border-b-[#46A302]'
                }`}
                title="Bật chế độ kéo thả hoặc bấm nút đổi vị trí đề và đồng bộ Cloud cho toàn bộ học viên"
              >
                <GripVertical className="h-3.5 w-3.5" />
                <span>{isReorderMode ? 'Xong sắp xếp' : 'Sắp xếp vị trí'}</span>
              </button>
            )}

            {/* Lưới | Danh sách View Mode Switcher */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950">
              <button
                type="button"
                onClick={() => handleSelectViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#46A302]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Lưới</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#46A302]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Danh sách</span>
              </button>
            </div>
          </div>
        </div>

        {/* Admin Active Reorder Helper Bar */}
        {canManageExams && isReorderMode && (
          <div className="rounded-2xl bg-[#D7FFB8]/60 dark:bg-emerald-950/40 border-2 border-[#58CC02] border-b-4 border-b-[#46A302] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-[#2B6600] dark:text-lime-200 font-bold">
              <strong className="font-black">Chế độ Sắp xếp đề (Đồng bộ Cloud):</strong> Kéo thả trực tiếp thẻ đề, bấm nút mũi tên <span className="font-black">← / →</span> để đổi vị trí hoặc bấm <span className="font-black">📌 Ghim</span> để cố định đề lên đầu trang cho mọi học viên.
            </div>
            <button
              type="button"
              onClick={handleAutoSortNaturalOrderToCloud}
              className="btn-duo-green px-3.5 py-2 rounded-xl text-xs shrink-0"
              title="Tự động xếp theo tên Test 1 -> Test 2 -> Test 3... và lưu lên Cloud"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Chuẩn hóa Test 1 → N (Lưu Cloud)</span>
            </button>
          </div>
        )}

        {/* Dynamic Category Tag Filter Bar */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 dark:bg-slate-800/90 border-2 border-slate-200/80 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 rounded-2xl">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#46A302]'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Tất cả đề ({tests.length})
          </button>
          {availableCategories.map((cat) => {
            const count = tests.filter((t) =>
              cat === 'Đề Nháp' ? isDraftTest(t) : getEffectiveTestCategory(t) === cat
            ).length;
            const isDraftTab = cat === 'Đề Nháp';
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                  filterCategory === cat
                    ? isDraftTab
                      ? 'bg-[#FF9600] text-white shadow-2xs border-b-2 border-[#E58700]'
                      : 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#46A302]'
                    : isDraftTab
                    ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>{cat}</span>
                <span className="text-[11px] opacity-85">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Tests Container: 2-Column Grid ('grid') or Horizontal Rows ('list') */}
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'flex flex-col gap-3'
          }
        >
          {filteredTests.map((test, index) => (
            <CompactExamCard
              key={test.id}
              test={test}
              viewMode={viewMode}
              canManageExams={canManageExams}
              inProgress={inProgressMap[test.id]}
              bestScore={completedScoresMap[test.id]}
              orderIndex={index}
              isPinned={examOrderConfig.pinnedTestIds.includes(test.id)}
              isReorderMode={isReorderMode}
              canMovePrev={index > 0}
              canMoveNext={index < filteredTests.length - 1}
              isDragging={draggedTestId === test.id}
              isDragOver={dragOverTestId === test.id && draggedTestId !== test.id}
              onMovePrev={() => handleMoveTestRelative(test.id, -1)}
              onMoveNext={() => handleMoveTestRelative(test.id, 1)}
              onTogglePin={() => handleTogglePinTest(test.id)}
              onDragStart={(e) => {
                setDraggedTestId(test.id);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', test.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverTestId !== test.id) {
                  setDragOverTestId(test.id);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = draggedTestId || e.dataTransfer.getData('text/plain');
                setDraggedTestId(null);
                setDragOverTestId(null);
                if (sourceId && sourceId !== test.id) {
                  handleDropTestOnTarget(sourceId, test.id);
                }
              }}
              onDragEnd={() => {
                setDraggedTestId(null);
                setDragOverTestId(null);
              }}
              onStartExam={handleStartExamMode}
              onStartPractice={handleStartPracticeMode}
              onResumeTest={onResumeInProgress}
              onRestartTest={onRestartTest}
              onEditTest={onEditTest}
              onRequestDeleteTest={onRequestDeleteTest}
              onOpenHistory={onOpenHistory ? (id) => onOpenHistory(id) : undefined}
              onOpenVocabForTest={(id) => {
                if (onSelectVocabForTest) {
                  onSelectVocabForTest(id);
                } else {
                  onNavigateTab('vocab');
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
