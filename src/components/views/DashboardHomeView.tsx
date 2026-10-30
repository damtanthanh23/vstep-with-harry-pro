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
  onOpenHistory?: () => void;
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
    return () => unsub();
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
    if (filterCategory === 'all') return tests;
    return tests.filter((t) => {
      if (filterCategory === 'Đề Nháp') {
        return isDraftTest(t);
      }
      return getEffectiveTestCategory(t) === filterCategory;
    });
  }, [tests, filterCategory]);

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
      <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-lime-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm relative overflow-hidden">
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
              className="shrink-0 inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 border border-amber-200 dark:border-slate-600 p-2.5 text-amber-700 dark:text-amber-300 shadow-2xs transition-all active:scale-95 cursor-pointer"
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
        <div className="md:col-span-7 rounded-3xl bg-gradient-to-br from-[#58CC02] via-[#46A302] to-[#2E7D32] p-5 sm:p-6 text-white shadow-md relative overflow-hidden flex flex-col justify-between">
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
                className="inline-flex items-center gap-2 rounded-2xl bg-white text-[#2E7D32] hover:bg-lime-50 px-4 py-2 text-xs font-black shadow-md border-b-2 border-slate-200 transition-all active:translate-y-0.5 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-[#2E7D32]" />
                <span>Thi thử ngay</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigateTab('listening')}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-black/20 hover:bg-black/30 text-white px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer"
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
        <div className="md:col-span-5 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-500 p-6 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
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

      {/* Truy Cập Nhanh */}
      <div className="space-y-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center sm:text-left">
          Truy cập nhanh
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div
            onClick={() => onNavigateTab('tests')}
            className="group cursor-pointer rounded-2xl bg-white dark:bg-slate-800/80 p-4 border border-slate-200 dark:border-slate-800 hover:border-[#58CC02] dark:hover:border-[#58CC02] shadow-2xs hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-lime-100 dark:bg-emerald-950/60 flex items-center justify-center text-[#3C8C02] dark:text-[#58CC02] group-hover:scale-110 transition-transform">
                <BookOpen className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform text-[#58CC02]" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Luyện đề</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {tests.length} bộ đề chuẩn Nghe - Đọc - Viết
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('listening')}
            className="group cursor-pointer rounded-2xl bg-white dark:bg-slate-800/80 p-4 border border-slate-200 dark:border-slate-800 hover:border-[#58CC02] dark:hover:border-[#58CC02] shadow-2xs hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <Headphones className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform text-blue-500" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Luyện nghe</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Audio từng Part & Highlight script
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('reading')}
            className="group cursor-pointer rounded-2xl bg-white dark:bg-slate-800/80 p-4 border border-slate-200 dark:border-slate-800 hover:border-[#58CC02] dark:hover:border-[#58CC02] shadow-2xs hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform text-amber-500" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Luyện đọc</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Split screen đối chiếu 4 Passages
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('vocab')}
            className="group cursor-pointer rounded-2xl bg-white dark:bg-slate-800/80 p-4 border border-slate-200 dark:border-slate-800 hover:border-[#58CC02] dark:hover:border-[#58CC02] shadow-2xs hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                <BookmarkCheck className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition-transform text-purple-500" />
            </div>
            <div className="font-black text-sm text-slate-800 dark:text-white">Từ vựng VSTEP</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
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

          {/* Dynamic Category Tag Filter Control */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterCategory === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
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
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterCategory === cat
                      ? isDraftTab
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : isDraftTab
                      ? 'text-amber-700 dark:text-amber-400 hover:bg-amber-100/60 dark:hover:bg-amber-950/40'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tests Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((test) => {
            const inProgress = inProgressMap[test.id];
            const bestScore = completedScoresMap[test.id];
            const answeredInProgressCount = inProgress
              ? Object.values(inProgress.answers || {}).filter((v) => v && v.trim().length > 0).length
              : 0;
            const isDraft = isDraftTest(test);
            const effectiveCat = getEffectiveTestCategory(test);

            return (
              <div
                key={test.id}
                className={`rounded-[28px] p-6 border-2 transition-all flex flex-col justify-between ${
                  isDraft
                    ? 'bg-amber-50/45 dark:bg-amber-950/20 border-dashed border-amber-400 dark:border-amber-500/80 shadow-[0_6px_24px_rgba(245,158,11,0.10)] hover:border-amber-500'
                    : 'bg-white dark:bg-slate-900 border-indigo-100/90 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-500 shadow-[0_6px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_10px_30px_rgba(139,92,246,0.13)]'
                }`}
              >
                <div>
                  {/* Row 1: Large Bold Test Title + Action Icon Buttons on Top Right */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      {isDraft && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider mb-1.5 shadow-2xs">
                          <span>BẢN NHÁP (CHƯA XUẤT BẢN)</span>
                        </span>
                      )}
                      <h4
                        className="font-black text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight leading-snug break-words"
                        title={test.title}
                      >
                        {test.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canManageExams && (
                        <button
                          type="button"
                          onClick={() => onEditTest(test.id)}
                          className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center transition-colors cursor-pointer"
                          title="Chỉnh sửa bộ đề này"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {canManageExams && onRequestDeleteTest && (
                        <button
                          type="button"
                          onClick={() => onRequestDeleteTest(test.id, test.title)}
                          className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-600 hover:border-red-300 flex items-center justify-center transition-colors cursor-pointer"
                          title="Xóa bộ đề này (Đếm ngược 3s)"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenHistory && onOpenHistory()}
                        className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-purple-600 hover:border-purple-300 flex items-center justify-center transition-colors cursor-pointer"
                        title="Xem lịch sử làm đề"
                      >
                        <Clock className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Category Tag Badge + Score Badge */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold border ${
                        isDraft
                          ? 'bg-amber-100/90 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/50'
                      }`}
                    >
                      {isDraft ? (
                        <Tag className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <BarChart2 className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      <span>{effectiveCat}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => onOpenHistory && onOpenHistory()}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50/90 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-extrabold border border-amber-200/80 dark:border-amber-800/50 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <Award className="h-3.5 w-3.5 text-amber-600" />
                      <span>
                        {bestScore !== undefined
                          ? `Điểm số: ${bestScore}/${test.totalQuestions || 75}`
                          : 'Điểm số'}
                      </span>
                    </button>
                  </div>

                  {/* Row 3: Question Count & Duration */}
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300 mb-3">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span>
                        <strong className="font-black text-slate-900 dark:text-white">
                          {test.totalQuestions || 75}
                        </strong>{' '}
                        câu
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span>
                        <strong className="font-black text-slate-900 dark:text-white">
                          {test.durationMinutes || 160}
                        </strong>{' '}
                        phút
                      </span>
                    </div>
                  </div>

                  {/* Row 4: Skill Breakdown Pills */}
                  <div className="flex flex-wrap items-center gap-2 mb-5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                      <Headphones className="h-3.5 w-3.5 text-slate-500" />
                      <span>35 Listening</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                      <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                      <span>40 Reading</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                      <PenTool className="h-3.5 w-3.5 text-slate-500" />
                      <span>2 Writing</span>
                    </span>
                  </div>
                </div>

                {/* Bottom Section: Dashed Divider + Status + Action Buttons */}
                <div>
                  <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-3.5 mb-3.5 flex items-center justify-between">
                    {inProgress ? (
                      <div className="flex items-center gap-2 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <span>
                          Đang làm bài ({answeredInProgressCount}/{test.totalQuestions || 75} câu)
                        </span>
                      </div>
                    ) : bestScore !== undefined ? (
                      <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>
                          Đã hoàn thành ({bestScore}/{test.totalQuestions || 75} câu đúng)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <span>Chưa luyện tập</span>
                      </div>
                    )}

                    {test.audioMode === 'per_part' && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                        4 Audio riêng
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {inProgress && onResumeInProgress ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => onResumeInProgress(test.id)}
                          className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-black shadow-[0_4px_0_#d97706] active:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                        >
                          <Play className="h-3.5 w-3.5 fill-amber-600 text-amber-600 shrink-0" />
                          <span>Làm tiếp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onRestartTest
                              ? onRestartTest(test.id)
                              : handleStartExamMode(test.id)
                          }
                          className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-black shadow-[0_4px_0_#4c1d95] active:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                          title="Xóa tiến trình đang làm dở và bắt đầu lại từ đầu"
                        >
                          <Play className="h-3.5 w-3.5 fill-white shrink-0" />
                          <span>Làm lại từ đầu</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleStartExamMode(test.id)}
                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-black shadow-[0_4px_0_#4c1d95] active:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <Play className="h-3.5 w-3.5 fill-white shrink-0" />
                        <span>Thi thử</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartPracticeMode(test.id)}
                        className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl border-2 border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-400 hover:bg-purple-50/50 text-purple-700 dark:text-purple-300 text-xs sm:text-sm font-black shadow-[0_4px_0_#e9d5ff] dark:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0" />
                        <span>Luyện tập</span>
                      </button>
                    </div>
                  )}

                  {/* Footer Vocabulary Link */}
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectVocabForTest) {
                        onSelectVocabForTest(test.id);
                      } else {
                        onNavigateTab('vocab');
                      }
                    }}
                    className="mt-3.5 w-full flex items-center justify-center gap-1.5 py-1 text-xs font-extrabold text-purple-700 dark:text-purple-400 hover:text-purple-900 transition-colors cursor-pointer"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Từ vựng của đề này</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
