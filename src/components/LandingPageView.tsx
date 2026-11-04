import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  BookOpen,
  Headphones,
  Award,
  CheckCircle2,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Languages,
  LogIn,
  ShieldCheck,
  Play,
  PenTool,
  LayoutGrid,
  CloudCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Volume2,
  GraduationCap,
  SlidersHorizontal,
  MessageSquareWarning,
  Bell,
  UserCheck,
  Pencil,
  Layers,
  Sun,
  Moon,
  Monitor,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { mapScoreToCEFR } from '../utils/scoringEngine';
import { UkFlagLogo } from './UkFlagLogo';

interface LandingPageViewProps {
  totalPublishedExams?: number;
  unreadFeedbackCount?: number;
  onStartSampleTest: () => void;
  onOpenLoginModal: () => void;
  onDirectEnterSystem: () => void;
  onOpenFeedbackModal?: () => void;
  onOpenAdminFeedbackModal?: () => void;
}

/**
 * Animated Count-Up Hook: Smoothly animates a number from 0 -> endValue
 * whenever triggerKey changes or section scrolls into view.
 */
function useCountUp(endValue: number, durationMs = 1100, triggerKey = 0): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (triggerKey <= 0) return;
    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * endValue));

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      }
    };

    setCount(0);
    animationFrameId = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [endValue, durationMs, triggerKey]);

  return count;
}

/**
 * Scroll-Reveal Container: Automatically unfolds and flies elements into view
 * as the user scrolls down the page.
 */
interface ScrollRevealSectionProps {
  id: string;
  partLabel: string;
  subtitle: string;
  onVisible?: () => void;
  children: (isVisible: boolean) => React.ReactNode;
}

const ScrollRevealSection: React.FC<ScrollRevealSectionProps> = ({
  id,
  partLabel,
  subtitle,
  onVisible,
  children,
}) => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            onVisible?.();
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return (
    <section
      id={id}
      ref={sectionRef}
      className={`scroll-mt-24 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-xl p-6 sm:p-8 lg:p-10 transition-all duration-700 ease-out transform ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-12 scale-[0.97]'
      }`}
    >
      {/* Top Section Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b-2 border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-[#58CC02] px-3 py-1 text-xs font-black text-white shadow-2xs border-2 border-[#58CC02] border-b-3 border-b-[#46A302]">
            {partLabel}
          </span>
          <span className="text-xs sm:text-sm font-extrabold text-slate-600 dark:text-slate-300">
            {subtitle}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
          <UserCheck className="h-4 w-4 text-[#58CC02]" />
          <span>
            Biên soạn:{' '}
            <strong className="text-slate-800 dark:text-slate-100">
              Mr.Harry (English Lecturer and Instructor)
            </strong>
          </span>
        </div>
      </div>

      {children(isVisible)}
    </section>
  );
};

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  totalPublishedExams = 7,
  unreadFeedbackCount = 0,
  onStartSampleTest,
  onOpenLoginModal,
  onDirectEnterSystem,
  onOpenFeedbackModal,
  onOpenAdminFeedbackModal,
}) => {
  const { currentUser, isAdmin, canManageExams } = useAuth();
  const { themeMode, setThemeMode } = useTheme();

  // Trigger keys for count-up animations when sections enter viewport
  const [heroTrigger, setHeroTrigger] = useState<number>(1);
  const [labTrigger, setLabTrigger] = useState<number>(0);

  // Interactive demo states
  const [simulatedScore10, setSimulatedScore10] = useState<number>(6.5);
  const [demoSpeed, setDemoSpeed] = useState<number>(1.0);
  const [demoAudioMode, setDemoAudioMode] = useState<'full' | 'part'>('part');
  const [showBilingualDemo, setShowBilingualDemo] = useState<boolean>(true);
  const [selectedGapDemo, setSelectedGapDemo] = useState<string>('B');
  const [demoPracticeMode, setDemoPracticeMode] = useState<'exam' | 'practice'>('exam');
  const [activeSkillTab, setActiveSkillTab] = useState<
    'listening' | 'reading' | 'writing' | 'simulator'
  >('listening');

  // Horizontal scroll refs for Part 2 carousels
  const verbCarouselRef = useRef<HTMLDivElement>(null);
  const clauseCarouselRef = useRef<HTMLDivElement>(null);

  // Animated Count-up values (75 VSTEP questions = 35 Listening + 40 Reading)
  const countQuestions = useCountUp(75, 1100, heroTrigger);
  const countListening = useCountUp(35, 1000, Math.max(heroTrigger, labTrigger));
  const countReading = useCountUp(40, 1000, Math.max(heroTrigger, labTrigger));
  const countWritingWords = useCountUp(250, 1200, heroTrigger);
  const countPassRate = useCountUp(98, 1200, heroTrigger);
  const countExams = useCountUp(totalPublishedExams, 900, heroTrigger);

  // STRICT AUTH GATE: Unauthenticated users cannot start ANY exam or demo test
  const handleProtectedTestAction = () => {
    if (!currentUser) {
      onOpenLoginModal();
      return;
    }
    onStartSampleTest();
  };

  const handleProtectedPracticeCardAction = () => {
    if (!currentUser) {
      onOpenLoginModal();
      return;
    }
    onDirectEnterSystem();
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, dir: 'left' | 'right') => {
    if (!ref.current) return;
    const offset = dir === 'left' ? -320 : 320;
    ref.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const cefrInfo = mapScoreToCEFR(simulatedScore10 * 10, simulatedScore10);
  const simGrade =
    simulatedScore10 >= 8.5
      ? 'Bậc 5 (C1)'
      : simulatedScore10 >= 6.0
      ? 'Bậc 4 (B2)'
      : simulatedScore10 >= 4.0
      ? 'Bậc 3 (B1)'
      : 'Không xét bậc (< 4.0)';

  return (
    <div className="min-h-screen bg-[#F7F9F4] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-lime-200 selection:text-slate-950 transition-colors">
      {/* ===================================================================== */}
      {/* 1. STICKY TOP NAVBAR (No Part Pill Row; 3-Mode Theme; Admin Check)    */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b-2 border-slate-200 dark:border-slate-800 shadow-2xs transition-colors">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-3">
          {/* Brand Identity + Author Signature */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="active:translate-y-0.5 transition-all cursor-pointer"
              title="Về đầu trang"
            >
              <UkFlagLogo size="md" className="h-11 w-11" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white leading-none">
                  VSTEP <span className="text-[#58CC02]">Tutor</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-[#D7FFB8] dark:bg-lime-950/80 px-2 py-0.5 text-[10px] font-black text-[#2B6601] dark:text-[#78E014] border border-[#58CC02]/40">
                  Luyện thi VSTEP B1-B2-C1
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mt-0.5">
                Chuẩn Khung Năng Lực Ngoại Ngữ 6 Bậc Dùng Cho Việt Nam · Mr.Harry
              </span>
            </div>
          </div>

          {/* Right Action CTAs (3-Mode Theme Switcher, Student Feedback, Admin Inbox, Kho đề, Login) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* 3-Mode Theme Switcher (Sáng | Tối | Hệ thống) */}
            <div
              className="hidden md:inline-flex items-center rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border-2 border-slate-200 dark:border-slate-700 shrink-0"
              role="group"
              aria-label="Chọn giao diện Sáng, Tối hoặc Hệ thống"
            >
              {[
                { mode: 'light' as const, label: 'Sáng', icon: Sun },
                { mode: 'dark' as const, label: 'Tối', icon: Moon },
                { mode: 'system' as const, label: 'Hệ thống', icon: Monitor },
              ].map(({ mode, label, icon: Icon }) => {
                const active = themeMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setThemeMode(mode)}
                    className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#46A302]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden lg:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Student Feedback Button: Hidden for Admin */}
            {onOpenFeedbackModal && !canManageExams && !isAdmin && (
              <button
                type="button"
                onClick={onOpenFeedbackModal}
                className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-0 active:translate-y-1 px-3 py-2 text-xs font-extrabold text-slate-700 dark:text-slate-200 transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Báo lỗi câu hỏi hoặc góp ý trực tiếp cho Mr.Harry"
              >
                <MessageSquareWarning className="h-4 w-4 text-[#FF9600] shrink-0" />
                <span className="hidden sm:inline">Báo lỗi / Góp ý</span>
              </button>
            )}

            {/* Admin Inbox Button: Shown only for Admin */}
            {canManageExams && onOpenAdminFeedbackModal && (
              <button
                type="button"
                onClick={onOpenAdminFeedbackModal}
                className="relative inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#58CC02] border-b-4 border-b-[#46A302] bg-[#E5F9D6] dark:bg-lime-950/60 hover:bg-[#D7FFB8] active:border-b-0 active:translate-y-1 px-3 py-2 text-xs font-black text-[#2B6601] dark:text-[#78E014] transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Mở Trung tâm thông báo Báo lỗi & Góp ý của học viên"
              >
                <Bell className="h-4 w-4 text-[#3C8C02] dark:text-[#78E014] shrink-0" />
                <span className="hidden xl:inline">Hòm thư Admin</span>
                {unreadFeedbackCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF4B4B] px-1 text-[10px] font-black text-white tabular-nums">
                    {unreadFeedbackCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onDirectEnterSystem}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 hover:border-[#1CB0F6] hover:border-b-[#1899D6] active:border-b-0 active:translate-y-1 px-3.5 py-2 text-xs font-black text-slate-800 dark:text-slate-100 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <LayoutGrid className="h-4 w-4 text-[#1CB0F6] shrink-0" />
              <span>Kho đề ({totalPublishedExams})</span>
            </button>

            {currentUser ? (
              <button
                type="button"
                onClick={onDirectEnterSystem}
                className="btn-duo-green inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-black text-white whitespace-nowrap shrink-0"
              >
                <span>Vào phòng thi</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLoginModal}
                className="btn-duo-green inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-black text-white whitespace-nowrap shrink-0"
              >
                <LogIn className="h-3.5 w-3.5 shrink-0" />
                <span>Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 2. SCROLL-REVEAL SECTIONS (Auto-unfolds & flies in as user scrolls)   */}
      {/* ===================================================================== */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* ----------------------------------------------------------------- */}
        {/* SECTION 1: HERO & REAL VSTEP B1-B2-C1 EXAM PREVIEW                */}
        {/* ----------------------------------------------------------------- */}
        <ScrollRevealSection
          id="landing-section-1"
          partLabel="01 / 05"
          subtitle="Tổng quan cấu trúc đề thi VSTEP B1-B2-C1 (75 câu trắc nghiệm + 2 bài Writing)"
          onVisible={() => setHeroTrigger((prev) => (prev === 0 ? 1 : prev))}
        >
          {(isVisible) => (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Flies in from Left */}
              <div
                className={`lg:col-span-7 space-y-6 text-left transition-all duration-700 delay-100 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
              >
                <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl bg-[#E5F9D6]/80 dark:bg-lime-950/60 px-3.5 py-1.5 text-xs font-extrabold text-[#2B6601] dark:text-[#78E014] border-2 border-[#58CC02] border-b-3 border-b-[#46A302]">
                  <ShieldCheck className="h-4 w-4 text-[#58CC02] shrink-0" />
                  <span>
                    CHUẨN ĐỊNH DẠNG BỘ GIÁO DỤC &amp; ĐÀO TẠO (VSTEP B1–B2–C1) · BY MR.HARRY
                  </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-[46px] font-black tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                  Chinh phục chứng chỉ{' '}
                  <span className="text-[#58CC02]">VSTEP B1-B2-C1</span> ngay từ lần thi đầu tiên.
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  Nền tảng <strong>VSTEP Tutor - Luyện thi VSTEP B1-B2-C1</strong> do{' '}
                  <strong className="font-extrabold text-slate-900 dark:text-white">
                    Mr.Harry (English Lecturer and Instructor)
                  </strong>{' '}
                  xây dựng, kết hợp giao diện học tập sinh động phong cách Duolingo với bố cục thi máy tính chuẩn VSTEP:{' '}
                  <strong className="font-bold text-slate-800 dark:text-slate-100">
                    Listening (3 Parts · 35 câu) · Reading chia đôi màn hình (4 Passages · 40 câu) · Writing (2 Tasks)
                  </strong>
                  . Tích hợp giải thích chi tiết, bằng chứng trích dẫn, bản dịch song ngữ và chấm điểm thang 10 làm tròn 0.5.
                </p>

                {/* Primary & Secondary CTAs (Auth-Gated for Demo Test) */}
                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                  <button
                    type="button"
                    onClick={handleProtectedTestAction}
                    className="btn-duo-green inline-flex items-center justify-center gap-2.5 px-7 py-4 text-sm sm:text-base font-black text-white shadow-lg shadow-lime-600/20 whitespace-nowrap"
                  >
                    {currentUser ? (
                      <Play className="h-5 w-5 fill-white shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 shrink-0" />
                    )}
                    <span>
                      {currentUser ? 'Làm ngay Đề Thi VSTEP Mẫu (75 câu)' : 'Đăng nhập để làm Đề Thi VSTEP Mẫu'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onDirectEnterSystem}
                    className="btn-duo-blue inline-flex items-center justify-center gap-2 px-6 py-4 text-sm sm:text-base font-black text-white whitespace-nowrap"
                  >
                    <BookOpen className="h-5 w-5 text-white shrink-0" />
                    <span>Khám phá kho đề VSTEP ({countExams} bộ đề)</span>
                  </button>
                </div>

                {/* 4 Animated Count-Up Metrics */}
                <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                      {countQuestions}{' '}
                      <span className="text-sm font-extrabold text-[#58CC02]">câu</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      {countListening} Listening · {countReading} Reading
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                      120–{countWritingWords}{' '}
                      <span className="text-sm font-extrabold text-[#58CC02]">từ</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Task 1 Thư · Task 2 Luận
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-[#58CC02] tabular-nums">
                      {countPassRate}%
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Chuẩn cấu trúc VSTEP Bộ GD&amp;ĐT
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                      4.0–8.5+
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                      Thang 10 xét Bậc 3 (B1) – Bậc 5 (C1)
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Flies in from Right */}
              <div
                className={`lg:col-span-5 transition-all duration-700 delay-200 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
                }`}
              >
                <div className="relative mx-auto max-w-md lg:max-w-none">
                  <div className="relative overflow-hidden rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-xl aspect-4/5">
                    <img
                      src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=85"
                      alt="Sinh viên và học viên cao học luyện thi VSTEP B1-B2-C1 trên máy tính"
                      className="h-full w-full object-cover object-center"
                      loading="eager"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/15 to-transparent" />

                    <div className="absolute bottom-5 left-5 right-5 text-white">
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#58CC02] px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white mb-2 shadow-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Phòng thi VSTEP trực tuyến chuẩn Bộ GD&amp;ĐT</span>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-slate-100 leading-snug">
                        Giao diện chia cột Bài đọc trái – Câu hỏi phải, hỗ trợ đầy đủ từ in đậm gạch chân, ô vuông chèn câu [A]–[D] và thanh chọn Part phía dưới.
                      </p>
                    </div>
                  </div>

                  {/* Floating Badge Top-Left */}
                  <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 shadow-xl border-2 border-lime-200 dark:border-lime-800 absolute -top-4 -left-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#58CC02] text-white shrink-0 border-b-2 border-[#3C8C02]">
                      <Award className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Quy đổi thang điểm 10
                      </div>
                      <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        B1 (4.0) · B2 (6.0) · C1 (8.5)
                      </div>
                    </div>
                  </div>

                  {/* Floating Badge Bottom-Right */}
                  <div className="hidden sm:block rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 shadow-xl border-2 border-lime-200 dark:border-lime-800 absolute -bottom-5 -right-4 w-64">
                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-100 mb-2">
                      <span>Tiến độ hoàn thành đề</span>
                      <span className="text-[#3C8C02] dark:text-[#78E014] flex items-center gap-1">
                        <CloudCheck className="h-3.5 w-3.5 text-[#58CC02]" /> Tự động lưu
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                        <span>Listening (35) &amp; Reading (40)</span>
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">
                          {countQuestions}/75 câu
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="bg-[#58CC02] h-full w-[94%] rounded-full transition-all duration-700" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollRevealSection>

        {/* Scroll Down Divider 1 -> 2 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => scrollToSection('landing-section-2')}
            className="group inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-[#58CC02] px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300 shadow-xs transition-all cursor-pointer"
          >
            <span>Cuộn xuống xem Chứng chỉ VSTEP, Đối tượng dự thi &amp; Cấu trúc 4 Kỹ năng</span>
            <ArrowDown className="h-3.5 w-3.5 text-[#58CC02] group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 2: OFFICIAL VSTEP OVERVIEW, TARGET CANDIDATES & GRAMMAR   */}
        {/* ----------------------------------------------------------------- */}
        <ScrollRevealSection
          id="landing-section-2"
          partLabel="02 / 05"
          subtitle="Chứng chỉ VSTEP là gì? Đối tượng dự thi, Cấu trúc 4 kỹ năng & Sơ đồ ngữ pháp B1-B2-C1"
        >
          {(isVisible) => (
            <div className="space-y-8">
              {/* VSTEP Overview & Sample Certificate Card + Structure Tables */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Chứng chỉ VSTEP là gì + Hình ảnh Chứng chỉ thật */}
                <div className="lg:col-span-5 rounded-3xl bg-amber-50/60 dark:bg-slate-800/60 border-2 border-amber-200 dark:border-slate-700 p-5 space-y-4">
                  <div>
                    <span className="inline-block rounded-lg bg-[#58CC02] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white mb-1.5">
                      Khung năng lực ngoại ngữ 6 bậc Việt Nam
                    </span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      Chứng chỉ VSTEP là gì?
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                      <strong>VSTEP</strong> (Vietnamese Standardized Test of English Proficiency) là kỳ thi đánh giá năng lực tiếng Anh theo Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam, được cấp bởi các trường Đại học được Bộ Giáo dục và Đào tạo ủy quyền, tương ứng với các cấp độ <strong>A2, B1 (Bậc 3), B2 (Bậc 4) và C1 (Bậc 5)</strong>.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border-2 border-amber-300/80 bg-white shadow-sm">
                    <img
                      src="/assets/aistudio/image_23333a94.png"
                      alt="Mẫu Chứng chỉ Ngoại ngữ VSTEP chuẩn Bộ Giáo dục và Đào tạo"
                      className="w-full h-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-[11px] text-center font-bold text-slate-500 dark:text-slate-400">
                    Mẫu Chứng chỉ VSTEP thực tế (Cấp kèm trên hệ thống sau khi hoàn thành bài thi đạt ≥ 4.0/10)
                  </p>
                </div>

                {/* Right: Cấu trúc đề thi VSTEP B1-B2-C1 & Đối tượng dự thi */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Table 1: Cấu trúc 4 kỹ năng VSTEP B1, B2, C1 */}
                  <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        Cấu trúc đề thi VSTEP B1, B2, C1 (4 Kỹ năng)
                      </h3>
                      <span className="text-xs font-extrabold text-[#3C8C02] dark:text-[#78E014]">
                        Dùng chung 1 bài thi xét Bậc 3, 4, 5
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-3">Kỹ năng</th>
                            <th className="p-3">Thời gian</th>
                            <th className="p-3">Cấu trúc chi tiết các phần thi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                          <tr>
                            <td className="p-3 font-black text-sky-700 dark:text-sky-400 whitespace-nowrap">
                              Listening (Nghe)
                            </td>
                            <td className="p-3 font-bold whitespace-nowrap">40 phút</td>
                            <td className="p-3">
                              <strong>35 câu trắc nghiệm (A–D)</strong>: Phần 1 (8 câu thông báo ngắn) · Phần 2 (12 câu / 3 hội thoại) · Phần 3 (15 câu / 3 bài giảng).
                            </td>
                          </tr>
                          <tr>
                            <td className="p-3 font-black text-amber-700 dark:text-amber-400 whitespace-nowrap">
                              Reading (Đọc)
                            </td>
                            <td className="p-3 font-bold whitespace-nowrap">60 phút</td>
                            <td className="p-3">
                              <strong>4 bài đọc · 40 câu trắc nghiệm (A–D)</strong> (10 câu/bài, tổng 1500–2000 từ): Từ vựng gạch chân, đại từ quy chiếu, điền câu vào ô [A]–[D], ý chính &amp; suy luận.
                            </td>
                          </tr>
                          <tr>
                            <td className="p-3 font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                              Writing (Viết)
                            </td>
                            <td className="p-3 font-bold whitespace-nowrap">60 phút</td>
                            <td className="p-3">
                              <strong>2 bài viết</strong>: Task 1 Viết thư/email (~120 từ, chiếm 1/3 điểm) · Task 2 Viết bài luận Essay (~250 từ, chiếm 2/3 điểm).
                            </td>
                          </tr>
                          <tr>
                            <td className="p-3 font-black text-purple-700 dark:text-purple-400 whitespace-nowrap">
                              Speaking (Nói)
                            </td>
                            <td className="p-3 font-bold whitespace-nowrap">12 phút</td>
                            <td className="p-3">
                              <strong>3 phần</strong>: Phần 1 Giao tiếp xã hội · Phần 2 Thảo luận giải pháp (chọn 1 trong 3 phương án) · Phần 3 Phát triển chủ đề.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Table 2: Đối tượng dự thi VSTEP A2, B1, B2, C1 */}
                  <div className="rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 p-5 space-y-3">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      Đối tượng cần chứng chỉ VSTEP B1, B2, C1
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <span className="inline-block rounded-lg bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 px-2.5 py-0.5 font-black">
                          VSTEP B1 (Bậc 3 · 4.0–5.5đ)
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          <li>Sinh viên Đại học/Cao đẳng xét chuẩn đầu ra tốt nghiệp</li>
                          <li>Học viên cao học nộp hồ sơ &amp; bảo vệ Thạc sĩ, miễn tiếng Anh đầu vào</li>
                          <li>Thi công chức, viên chức hạng chuyên viên chính</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <span className="inline-block rounded-lg bg-lime-100 dark:bg-lime-950 text-[#2B6601] dark:text-[#78E014] px-2.5 py-0.5 font-black">
                          VSTEP B2 (Bậc 4 · 6.0–8.0đ)
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          <li>Giáo viên tiếng Anh bậc Tiểu học và THCS</li>
                          <li>Đầu vào và đầu ra Nghiên cứu sinh (Tiến sĩ)</li>
                          <li>Sinh viên chương trình chất lượng cao &amp; Chuyên viên cao cấp</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-700 space-y-1.5">
                        <span className="inline-block rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 font-black">
                          VSTEP C1 (Bậc 5 · 8.5–10đ)
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          <li>Giáo viên tiếng Anh bậc THPT &amp; Giảng viên đại học</li>
                          <li>Sinh viên chuyên ngành Ngôn ngữ Anh / Sư phạm Anh</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-[#3C8C02] dark:text-[#78E014] mb-1">
                    MINH HỌA TRỰC QUAN THEO CHỦ ĐIỂM VSTEP B1–B2–C1
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Sơ đồ Ngữ pháp, Từ vựng &amp; Cấu trúc câu trọng tâm VSTEP
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                    Mỗi chủ điểm được minh họa bằng trục thời gian (timeline) và sơ đồ khối trực quan giúp học viên nhớ ngay công thức khi làm Reading &amp; Writing.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleProtectedPracticeCardAction}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#58CC02] hover:bg-[#46A302] px-5 py-2.5 text-xs font-black text-white shadow-sm border-b-4 border-[#3C8C02] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Vào Luyện Tập Toàn Bộ Chủ Điểm</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {/* ====== CONTAINER 1: ĐỘNG TỪ VÀ THÌ (Warm Cream) ====== */}
              <div
                className={`rounded-3xl bg-[#FFF7ED] dark:bg-slate-800/70 border border-orange-200/80 dark:border-orange-900/50 p-5 sm:p-6 space-y-4 shadow-xs transition-all duration-700 delay-100 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rotate-45 rounded-xs bg-[#EA580C]" />
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                        Động từ và thì
                      </h3>
                      <span className="text-xs font-extrabold text-[#EA580C] dark:text-orange-400">
                        11 chủ điểm
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                      Các thì, hòa hợp chủ ngữ – động từ, động từ khuyết thiếu, câu bị động và các mẫu động từ trong Reading Part 2 &amp; Writing.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => scrollCarousel(verbCarouselRef, 'left')}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-400 hover:text-orange-600 shadow-2xs transition-colors cursor-pointer"
                      title="Cuộn sang trái"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCarousel(verbCarouselRef, 'right')}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-400 hover:text-orange-600 shadow-2xs transition-colors cursor-pointer"
                      title="Cuộn sang phải"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Cards Row */}
                <div
                  ref={verbCarouselRef}
                  className="grid grid-flow-col auto-cols-[240px] sm:auto-cols-[255px] gap-4 overflow-x-auto pb-2 scrollbar-thin"
                >
                  {/* Card 11 */}
                  <div
                    onClick={handleProtectedPracticeCardAction}
                    className="group rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-700 hover:border-orange-400 p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="relative h-32 rounded-xl bg-[#FFEDD5]/75 dark:bg-orange-950/40 overflow-hidden p-3 flex flex-col justify-between">
                        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[#FDBA74]/40" />
                        <div className="flex items-center justify-center gap-2 z-10 pt-1">
                          <span className="rounded-full bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 px-3 py-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 shadow-2xs">
                            works
                          </span>
                          <span className="rounded-full bg-[#D9531E] px-3 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            is working
                          </span>
                        </div>
                        <div className="relative z-10 pb-1">
                          <svg viewBox="0 0 200 36" className="w-full h-9 overflow-visible">
                            <line x1="10" y1="16" x2="188" y2="16" stroke="#EA580C" strokeWidth="2" />
                            <polyline points="182,11 189,16 182,21" fill="none" stroke="#EA580C" strokeWidth="2" />
                            {[35, 62, 89, 145, 168].map((cx) => (
                              <circle key={cx} cx={cx} cy={16} r="4.5" fill="#EA580C" stroke="#FFF7ED" strokeWidth="1.5" />
                            ))}
                            <circle cx="117" cy="16" r="8" fill="none" stroke="#EA580C" strokeWidth="2" />
                            <line x1="117" y1="6" x2="117" y2="26" stroke="#EA580C" strokeWidth="2" />
                            <text x="117" y="34" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              now
                            </text>
                          </svg>
                        </div>
                        <span className="absolute bottom-1.5 right-2.5 text-[10px] font-bold text-orange-700/70 dark:text-orange-300 tabular-nums">
                          11
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-white group-hover:text-[#EA580C] transition-colors leading-snug">
                        Hiện tại đơn và hiện tại tiếp diễn
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Present simple and present continuous
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="ml-1 text-slate-700 dark:text-slate-300">Cơ bản</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                        <Pencil className="h-3 w-3" /> 60 câu
                      </span>
                    </div>
                  </div>

                  {/* Card 12 */}
                  <div
                    onClick={handleProtectedPracticeCardAction}
                    className="group rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-700 hover:border-orange-400 p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="relative h-32 rounded-xl bg-[#FFEDD5]/75 dark:bg-orange-950/40 overflow-hidden p-3 flex flex-col justify-between">
                        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[#FDBA74]/40" />
                        <div className="flex items-center justify-center gap-2 z-10 pt-1">
                          <span className="rounded-full bg-[#D9531E] px-3 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            was calling
                          </span>
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            arrived
                          </span>
                        </div>
                        <div className="relative z-10 pb-1">
                          <svg viewBox="0 0 200 36" className="w-full h-9 overflow-visible">
                            <line x1="10" y1="18" x2="188" y2="18" stroke="#EA580C" strokeWidth="2" />
                            <polyline points="182,13 189,18 182,23" fill="none" stroke="#EA580C" strokeWidth="2" />
                            <rect x="35" y="13" width="58" height="10" rx="5" fill="#FDBA74" />
                            <circle cx="64" cy="18" r="5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="2" />
                            <line x1="128" y1="10" x2="128" y2="26" stroke="#DC2626" strokeWidth="2" />
                            <text x="128" y="34" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              now
                            </text>
                          </svg>
                        </div>
                        <span className="absolute bottom-1.5 right-2.5 text-[10px] font-bold text-orange-700/70 dark:text-orange-300 tabular-nums">
                          12
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-white group-hover:text-[#EA580C] transition-colors leading-snug">
                        Quá khứ đơn và quá khứ tiếp diễn
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Past simple and past continuous
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="ml-1 text-slate-700 dark:text-slate-300">Cơ bản</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                        <Pencil className="h-3 w-3" /> 60 câu
                      </span>
                    </div>
                  </div>

                  {/* Card 13 */}
                  <div
                    onClick={handleProtectedPracticeCardAction}
                    className="group rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-700 hover:border-orange-400 p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="relative h-32 rounded-xl bg-[#FFEDD5]/75 dark:bg-orange-950/40 overflow-hidden p-3 flex flex-col justify-between">
                        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[#FDBA74]/40" />
                        <div className="flex items-center justify-center z-10 pt-1">
                          <span className="rounded-full bg-[#D9531E] px-3.5 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            have + V3
                          </span>
                        </div>
                        <div className="relative z-10 pb-1">
                          <svg viewBox="0 0 200 36" className="w-full h-9 overflow-visible">
                            <line x1="10" y1="16" x2="188" y2="16" stroke="#EA580C" strokeWidth="2" />
                            <polyline points="182,11 189,16 182,21" fill="none" stroke="#EA580C" strokeWidth="2" />
                            <rect x="44" y="12" width="84" height="8" rx="4" fill="#FDBA74" />
                            <circle cx="44" cy="16" r="5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="1.5" />
                            <line x1="128" y1="8" x2="128" y2="24" stroke="#DC2626" strokeWidth="2" />
                            <text x="44" y="33" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              since
                            </text>
                            <text x="128" y="33" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              now
                            </text>
                          </svg>
                        </div>
                        <span className="absolute bottom-1.5 right-2.5 text-[10px] font-bold text-orange-700/70 dark:text-orange-300 tabular-nums">
                          13
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-white group-hover:text-[#EA580C] transition-colors leading-snug">
                        Hiện tại hoàn thành và tiếp diễn
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Present perfect simple and continuous
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="ml-1 text-slate-700 dark:text-slate-300">Trung bình</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                        <Pencil className="h-3 w-3" /> 60 câu
                      </span>
                    </div>
                  </div>

                  {/* Card 14 */}
                  <div
                    onClick={handleProtectedPracticeCardAction}
                    className="group rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-700 hover:border-orange-400 p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="relative h-32 rounded-xl bg-[#FFEDD5]/75 dark:bg-orange-950/40 overflow-hidden p-3 flex flex-col justify-between">
                        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[#FDBA74]/40" />
                        <div className="flex items-center justify-center gap-2 z-10 pt-1">
                          <span className="rounded-full bg-[#D9531E] px-3 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            had left
                          </span>
                          <span className="rounded-full bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 px-3 py-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 shadow-2xs">
                            arrived
                          </span>
                        </div>
                        <div className="relative z-10 pb-1">
                          <svg viewBox="0 0 200 36" className="w-full h-9 overflow-visible">
                            <line x1="10" y1="16" x2="188" y2="16" stroke="#EA580C" strokeWidth="2" />
                            <polyline points="182,11 189,16 182,21" fill="none" stroke="#EA580C" strokeWidth="2" />
                            <circle cx="42" cy="16" r="5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="1.5" />
                            <circle cx="88" cy="16" r="5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="1.5" />
                            <line x1="132" y1="8" x2="132" y2="24" stroke="#DC2626" strokeWidth="2" />
                            <text x="42" y="33" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              1
                            </text>
                            <text x="88" y="33" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              2
                            </text>
                            <text x="132" y="33" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              now
                            </text>
                          </svg>
                        </div>
                        <span className="absolute bottom-1.5 right-2.5 text-[10px] font-bold text-orange-700/70 dark:text-orange-300 tabular-nums">
                          14
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-white group-hover:text-[#EA580C] transition-colors leading-snug">
                        Quá khứ hoàn thành
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Past perfect &amp; narrative sequencing
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="ml-1 text-slate-700 dark:text-slate-300">Trung bình</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                        <Pencil className="h-3 w-3" /> 60 câu
                      </span>
                    </div>
                  </div>

                  {/* Card 15 */}
                  <div
                    onClick={handleProtectedPracticeCardAction}
                    className="group rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-700 hover:border-orange-400 p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                  >
                    <div>
                      <div className="relative h-32 rounded-xl bg-[#FFEDD5]/75 dark:bg-orange-950/40 overflow-hidden p-3 flex flex-col justify-between">
                        <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[#FDBA74]/40" />
                        <div className="flex items-center justify-center gap-1.5 z-10 pt-1">
                          <span className="rounded-full bg-[#D9531E] px-2.5 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            will
                          </span>
                          <span className="rounded-full bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 px-2.5 py-1 text-[11px] font-extrabold text-slate-800 dark:text-slate-100 shadow-2xs">
                            going to
                          </span>
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-2xs">
                            by
                          </span>
                        </div>
                        <div className="relative z-10 pb-1">
                          <svg viewBox="0 0 200 36" className="w-full h-9 overflow-visible">
                            <line x1="10" y1="16" x2="188" y2="16" stroke="#EA580C" strokeWidth="2" />
                            <polyline points="182,11 189,16 182,21" fill="none" stroke="#EA580C" strokeWidth="2" />
                            <line x1="115" y1="8" x2="115" y2="24" stroke="#DC2626" strokeWidth="2" />
                            <circle cx="162" cy="16" r="5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="1.5" />
                            <text x="115" y="33" textAnchor="middle" className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300">
                              now
                            </text>
                          </svg>
                        </div>
                        <span className="absolute bottom-1.5 right-2.5 text-[10px] font-bold text-orange-700/70 dark:text-orange-300 tabular-nums">
                          15
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-white group-hover:text-[#EA580C] transition-colors leading-snug">
                        Các cách diễn đạt tương lai
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        Future forms &amp; predictions
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-[#EA580C]" />
                        <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                        <span className="ml-1 text-slate-700 dark:text-slate-300">Trung bình</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                        <Pencil className="h-3 w-3" /> 60 câu
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ====== CONTAINER 2: MỆNH ĐỀ VÀ CÂU PHỨC (Soft Mint) ====== */}
              <div
                className={`rounded-3xl bg-[#ECFDF5] dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 p-5 sm:p-6 space-y-4 shadow-xs transition-all duration-700 delay-200 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rotate-45 rounded-xs bg-[#059669]" />
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                        Mệnh đề và câu phức
                      </h3>
                      <span className="text-xs font-extrabold text-[#059669] dark:text-emerald-400">
                        9 chủ điểm
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                      Mệnh đề quan hệ, câu điều kiện, từ nối và các cấu trúc nối ý thường gặp ở Reading Part 2 &amp; Writing Part 1–2.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => scrollCarousel(clauseCarouselRef, 'left')}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition-colors cursor-pointer"
                      title="Cuộn sang trái"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollCarousel(clauseCarouselRef, 'right')}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition-colors cursor-pointer"
                      title="Cuộn sang phải"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div
                  ref={clauseCarouselRef}
                  className="grid grid-flow-col auto-cols-[240px] sm:auto-cols-[255px] gap-4 overflow-x-auto pb-2 scrollbar-thin"
                >
                  {[
                    {
                      num: '22',
                      title: 'Mệnh đề quan hệ',
                      sub: 'Relative clauses (who, which, that)',
                      pillA: 'the client',
                      pillB: 'who / that',
                      level: 'Trung bình',
                    },
                    {
                      num: '23',
                      title: 'Câu điều kiện',
                      sub: 'Conditionals (Type 0, 1, 2 & Unless)',
                      pillA: 'If + S + V',
                      pillB: '0 · 1 · 2 · 3',
                      level: 'Trung bình',
                    },
                    {
                      num: '24',
                      title: 'Câu ước và thể giả định',
                      sub: 'Wishes and polite suggestions',
                      pillA: 'I wish',
                      pillB: '+ past simple',
                      level: 'Nâng cao',
                    },
                    {
                      num: '25',
                      title: 'Liên từ kết hợp & Tương quan',
                      sub: 'Conjunctions & discourse markers',
                      pillA: 'both ... and',
                      pillB: 'not only ...',
                      level: 'Trung bình',
                    },
                    {
                      num: '26',
                      title: 'Mệnh đề trạng ngữ và từ nối',
                      sub: 'Adverbial clauses and linking words',
                      pillA: 'although',
                      pillB: 'however,',
                      level: 'Trung bình',
                    },
                  ].map((card) => (
                    <div
                      key={card.num}
                      onClick={handleProtectedPracticeCardAction}
                      className="group rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-700 hover:border-[#58CC02] p-3 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="relative h-32 rounded-xl bg-[#D1FAE5]/70 dark:bg-emerald-950/50 overflow-hidden p-3 flex flex-col justify-between">
                          <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-[#6EE7B7]/40" />
                          <div className="flex items-center justify-center gap-1.5 z-10 pt-2">
                            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-extrabold text-white">
                              {card.pillA}
                            </span>
                            <span className="rounded-full bg-[#059669] px-2.5 py-1 text-[11px] font-extrabold text-white">
                              {card.pillB}
                            </span>
                          </div>
                          <div className="relative z-10 text-center pb-1">
                            <div className="mx-auto w-36 h-3 border-b-2 border-l-2 border-[#059669] rounded-bl-xl" />
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-1 block">
                              Cấu trúc câu phức B1
                            </span>
                          </div>
                          <span className="absolute bottom-1.5 right-2.5 text-[10px] font-bold text-emerald-800/70 dark:text-emerald-300 tabular-nums">
                            {card.num}
                          </span>
                        </div>

                        <h4 className="mt-3 text-sm font-black text-slate-900 dark:text-white group-hover:text-[#059669] transition-colors leading-snug">
                          {card.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {card.sub}
                        </p>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-[#059669]" />
                          <span className="h-2 w-2 rounded-full bg-[#059669]" />
                          <span className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <span className="ml-1 text-slate-700 dark:text-slate-300">{card.level}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-500 tabular-nums">
                          <Pencil className="h-3 w-3" /> 60 câu
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollRevealSection>

        {/* Scroll Down Divider 2 -> 3 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => scrollToSection('landing-section-3')}
            className="group inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-[#58CC02] px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300 shadow-xs transition-all cursor-pointer"
          >
            <span>Cuộn xuống trải nghiệm Phòng thi thông minh 4 kỹ năng</span>
            <ArrowDown className="h-3.5 w-3.5 text-[#58CC02] group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 3: INTERACTIVE 4-SKILL LAB SHOWCASE                       */}
        {/* ----------------------------------------------------------------- */}
        <ScrollRevealSection
          id="landing-section-3"
          partLabel="03 / 05"
          subtitle="Trình nghe 0.1x, Đọc chia đôi màn hình chuẩn VSTEP, Giám khảo AI & Thanh chọn Part"
          onVisible={() => setLabTrigger((prev) => (prev === 0 ? 1 : prev))}
        >
          {(isVisible) => (
            <div
              className={`space-y-6 transition-all duration-700 delay-100 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-[#3C8C02] dark:text-[#78E014] mb-1">
                    CÔNG NGHỆ PHÒNG THI VSTEP THÔNG MINH
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Tương tác trực tiếp với 4 công cụ luyện thi VSTEP chuyên sâu
                  </h2>
                </div>

                {/* 4 Skill Tabs Switcher */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {[
                    { id: 'listening' as const, label: '01. Listening (35 câu)', icon: Headphones },
                    { id: 'reading' as const, label: '02. Split Reading (40 câu)', icon: BookOpen },
                    { id: 'writing' as const, label: '03. Writing AI (Task 1 & 2)', icon: PenTool },
                    { id: 'simulator' as const, label: '04. Thanh chọn Part VSTEP', icon: Layers },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = activeSkillTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveSkillTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer ${
                          active
                            ? 'bg-[#58CC02] text-white shadow-xs border-b-2 border-[#3C8C02]'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TAB CONTENT 1: LISTENING */}
              {activeSkillTab === 'listening' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
                  <div className="lg:col-span-5">
                    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-md aspect-4/3">
                      <img
                        src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85"
                        alt="Sinh viên luyện nghe VSTEP tiếng Anh"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs font-bold">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#58CC02] px-3 py-1 text-white font-black">
                          <Headphones className="h-3.5 w-3.5" /> Listening · {countListening} Câu (3 Parts)
                        </span>
                        <span>Part 1 (8) · Part 2 (12) · Part 3 (15)</span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      Làm chủ tốc độ nghe 0.1x &amp; Giải thích + Bằng chứng Transcript song ngữ
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Hỗ trợ cả chế độ <strong>1 file nghe xuyên suốt</strong> lẫn{' '}
                      <strong>file nghe tách riêng cho từng Part 1, 2, 3</strong>. Mỗi câu hỏi đều có giải thích chi tiết tại sao chọn đáp án đúng và trích dẫn câu bằng chứng từ Audio Script:
                    </p>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#58CC02] text-white border-b-2 border-[#3C8C02]">
                            <Volume2 className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 dark:text-white">
                              VSTEP Listening Part 2 · Conversations (Q9–20)
                            </div>
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                              01:42 / 06:15 · Tốc độ đang chọn: {demoSpeed.toFixed(1)}x
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                          {[0.8, 0.9, 1.0, 1.1, 1.2].map((spd) => (
                            <button
                              key={spd}
                              type="button"
                              onClick={() => setDemoSpeed(spd)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer tabular-nums ${
                                demoSpeed === spd
                                  ? 'bg-[#58CC02] text-white'
                                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                              }`}
                            >
                              {spd.toFixed(1)}x
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          Chế độ phát file âm thanh:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDemoAudioMode('part')}
                            className={`px-2.5 py-1 rounded-lg font-black transition-colors cursor-pointer ${
                              demoAudioMode === 'part'
                                ? 'bg-[#58CC02] text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                            }`}
                          >
                            Từng Part riêng biệt
                          </button>
                          <button
                            type="button"
                            onClick={() => setDemoAudioMode('full')}
                            className={`px-2.5 py-1 rounded-lg font-black transition-colors cursor-pointer ${
                              demoAudioMode === 'full'
                                ? 'bg-[#58CC02] text-white'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                            }`}
                          >
                            1 File toàn bài
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl bg-white dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-700 space-y-2 text-xs leading-relaxed">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-400 uppercase tracking-wider text-[10px]">
                            Transcript có đánh dấu bằng chứng VSTEP
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowBilingualDemo(!showBilingualDemo)}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-[#3C8C02] dark:text-[#78E014] hover:underline cursor-pointer"
                          >
                            <Languages className="h-3.5 w-3.5" />
                            <span>
                              {showBilingualDemo ? 'Đang bật dịch Anh-Việt' : 'Bật dịch Anh-Việt'}
                            </span>
                          </button>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300">
                          <strong className="text-slate-900 dark:text-white">Announcer:</strong> Look at the wall on your right.{' '}
                          <mark className="rounded bg-lime-200 dark:bg-lime-900 px-1.5 py-0.5 font-bold text-slate-900 dark:text-lime-100">
                            [Câu 1] Every Thursday at 2:00 PM there will be a special display of producing plastic bags.
                          </mark>
                        </p>
                        {showBilingualDemo && (
                          <p className="text-slate-600 dark:text-slate-400 italic border-l-2 border-[#58CC02] pl-2.5">
                            Giải thích &amp; Dịch nghĩa: Vào mỗi chiều thứ Năm lúc 2 giờ chiều sẽ có buổi trưng bày đặc biệt. → Đáp án đúng:{' '}
                            <strong>D (On Thursday afternoon)</strong>.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 2: SPLIT READING */}
              {activeSkillTab === 'reading' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      Giao diện chia cột Bài đọc Trái – 10 Câu hỏi Phải chuẩn VSTEP (4 Passages · 40 câu)
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Hiển thị chuẩn xác <strong>từ gạch chân in đậm</strong> (<u><b>evolutionary fine-tuning</b></u>), <strong>đại từ quy chiếu</strong> (<u><b>they</b></u>, <u><b>these</b></u>), đánh số đoạn văn <strong>[Đoạn 1]..[Đoạn N]</strong> và các <strong>ô vuông chèn câu [A] [B] [C] [D]</strong>:
                    </p>

                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 p-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                        <div className="rounded-xl bg-white dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-700 space-y-2 leading-relaxed text-slate-700 dark:text-slate-300">
                          <div className="text-[10px] font-black uppercase tracking-wider text-[#2B6601] dark:text-[#78E014]">
                            Reading Passage 1 · Bài đọc (Cột trái)
                          </div>
                          <p>
                            <span className="inline-flex items-center rounded bg-lime-100 dark:bg-lime-950 px-1.5 py-0.5 text-[10px] font-black text-[#2B6601] dark:text-[#78E014] mr-1">
                              [Đoạn 1]
                            </span>
                            In the world of birds, bill design is a prime example of{' '}
                            <u className="font-black underline decoration-2 decoration-slate-900 dark:decoration-white underline-offset-4">
                              evolutionary fine-tuning
                            </u>
                            .{' '}
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border-2 border-slate-800 dark:border-slate-200 bg-slate-900 text-white font-mono text-[10px] font-black">
                              [B]
                            </span>{' '}
                            Two species of <u className="font-black">these</u> finches reside in the evergreen forests...
                          </p>
                        </div>

                        <div className="rounded-xl bg-white dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-700 space-y-2">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Question 2 · Từ vựng gạch chân (Cột phải)
                          </div>
                          <p className="font-bold text-slate-800 dark:text-slate-100">
                            &ldquo;<u className="font-black">evolutionary fine-tuning</u>&rdquo; in paragraph 1 most likely refers to ______.
                          </p>
                          <div className="space-y-1.5">
                            {[
                              { key: 'A', text: 'gradual evolution' },
                              { key: 'B', text: 'adaptation' },
                              { key: 'C', text: 'useful tool' },
                              { key: 'D', text: 'natural selection' },
                            ].map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => setSelectedGapDemo(opt.key)}
                                className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2 cursor-pointer ${
                                  selectedGapDemo === opt.key
                                    ? 'bg-lime-50 dark:bg-lime-950/60 border-[#58CC02] text-slate-900 dark:text-white font-bold'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                <span
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-black ${
                                    selectedGapDemo === opt.key
                                      ? 'bg-[#58CC02] text-white'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {opt.key}
                                </span>
                                <span className="leading-snug">{opt.text}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-md aspect-4/3">
                      <img
                        src="https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1000&q=85"
                        alt="Sinh viên luyện đọc hiểu VSTEP"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs font-bold">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#58CC02] px-3 py-1 text-white font-black">
                          <BookOpen className="h-3.5 w-3.5" /> Reading · {countReading} Câu hỏi (4 Passages)
                        </span>
                        <span>Tô sáng bằng chứng tự động</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 3: WRITING AI */}
              {activeSkillTab === 'writing' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
                  <div className="lg:col-span-5">
                    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-md aspect-4/3">
                      <img
                        src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=85"
                        alt="Sinh viên thực hành viết luận Writing VSTEP"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs font-bold">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#58CC02] px-3 py-1 text-white font-black">
                          <PenTool className="h-3.5 w-3.5" /> Writing · Task 1 (1/3) &amp; Task 2 (2/3)
                        </span>
                        <span>Chấm điểm AI Thang 10 VSTEP</span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      Chấm điểm VSTEP Writing theo trọng số (Task 1 × 1 + Task 2 × 2) / 3
                    </h3>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 p-5 space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        {[
                          { label: 'Task Fulfillment', score: '7.5 / 10' },
                          { label: 'Organization', score: '7.0 / 10' },
                          { label: 'Vocabulary', score: '7.5 / 10' },
                          { label: 'Grammar', score: '7.0 / 10' },
                        ].map((crit) => (
                          <div
                            key={crit.label}
                            className="rounded-xl bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-700 text-center"
                          >
                            <div className="text-[10px] font-bold text-slate-500 truncate">
                              {crit.label}
                            </div>
                            <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                              {crit.score}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl bg-lime-50 dark:bg-lime-950/40 border border-lime-200 dark:border-lime-800 p-3.5 text-xs space-y-1.5">
                        <div className="font-black text-[#2B6601] dark:text-[#78E014] flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-[#58CC02]" />
                          <span>Gợi ý nâng cấp câu chuẩn VSTEP B2–C1:</span>
                        </div>
                        <p className="text-slate-500 line-through">
                          &ldquo;Traffic congestion is very bad in big cities in Vietnam.&rdquo; (B1)
                        </p>
                        <p className="text-slate-900 dark:text-white font-bold">
                          &ldquo;Traffic congestion has emerged as a pressing urban challenge in major Vietnamese metropolises.&rdquo; (B2/C1)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB CONTENT 4: SIMULATOR & PALETTE */}
              {activeSkillTab === 'simulator' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
                  <div className="lg:col-span-7 space-y-4">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      Thanh chọn Part cố định phía dưới chuẩn VSTEP &amp; Lưu tiến trình tự động
                    </h3>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black">
                          <button
                            type="button"
                            onClick={() => setDemoPracticeMode('exam')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                              demoPracticeMode === 'exam'
                                ? 'bg-[#58CC02] text-white'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            Chế độ Thi thử (Bấm giờ 100 phút)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDemoPracticeMode('practice')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                              demoPracticeMode === 'practice'
                                ? 'bg-[#58CC02] text-white'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            Chế độ Luyện tập (Chọn từng Part / Passage)
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-[#58CC02] p-3.5 text-white shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                          <span className="rounded-lg bg-black/20 px-2.5 py-1 text-xs font-black uppercase tracking-wide shrink-0">
                            Reading Passage 1
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <span
                                key={n}
                                className={`h-7 w-7 rounded-lg text-xs font-black flex items-center justify-center tabular-nums ${
                                  n === 1
                                    ? 'bg-white text-[#3C8C02] ring-2 ring-amber-300'
                                    : 'bg-white/20 text-white'
                                }`}
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-[11px] font-extrabold text-lime-100">
                          Thanh điều hướng câu hỏi chuẩn VSTEP
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shadow-md aspect-4/3">
                      <img
                        src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1000&q=85"
                        alt="Nhóm sinh viên thảo luận kết quả thi VSTEP"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 text-white text-xs font-bold">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#58CC02] px-3 py-1 text-white font-black">
                          <CloudCheck className="h-3.5 w-3.5" /> Làm tiếp hoặc Làm lại từ đầu linh hoạt
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollRevealSection>

        {/* Scroll Down Divider 3 -> 4 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => scrollToSection('landing-section-4')}
            className="group inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-[#58CC02] px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300 shadow-xs transition-all cursor-pointer"
          >
            <span>Cuộn xuống Bảng quy đổi Thang điểm 10 VSTEP (B1 – B2 – C1)</span>
            <ArrowDown className="h-3.5 w-3.5 text-[#58CC02] group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 4: INTERACTIVE VSTEP 10-POINT SCORE CALCULATOR & ROADMAP  */}
        {/* ----------------------------------------------------------------- */}
        <ScrollRevealSection
          id="landing-section-4"
          partLabel="04 / 05"
          subtitle="Công cụ quy đổi Thang điểm 10 VSTEP (Làm tròn 0.5) & Lộ trình ôn luyện"
        >
          {(isVisible) => (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: Interactive Slider */}
              <div
                className={`lg:col-span-7 rounded-3xl bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 p-6 sm:p-7 space-y-5 transition-all duration-700 delay-100 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#3C8C02] dark:text-[#78E014]">
                    <SlidersHorizontal className="h-4 w-4 text-[#58CC02]" />
                    <span>CÔNG CỤ QUY ĐỔI THANG ĐIỂM 10 VSTEP (B1–B2–C1)</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Kéo thanh trượt để kiểm tra bậc đạt được
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      Điểm trung bình các kỹ năng (Thang 10 · Làm tròn 0.5):
                    </span>
                    <span className="text-2xl font-black text-[#58CC02] tabular-nums">
                      {simulatedScore10.toFixed(1)} / 10.0 điểm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={10.0}
                    step={0.5}
                    value={simulatedScore10}
                    onChange={(e) => setSimulatedScore10(Number(e.target.value))}
                    className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#58CC02]"
                  />
                  <div className="flex justify-between text-[11px] font-bold text-slate-400 mt-1.5 tabular-nums">
                    <span>&lt; 4.0 (Không xét)</span>
                    <span className="text-sky-600 dark:text-sky-400 font-black">
                      4.0–5.5 (Bậc 3 · B1)
                    </span>
                    <span className="text-[#3C8C02] dark:text-[#78E014] font-black">
                      6.0–8.0 (Bậc 4 · B2)
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-black">
                      8.5–10 (Bậc 5 · C1)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">
                      Bậc quy đổi VSTEP
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                      {simGrade}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">
                      Số câu Nghe cần đúng
                    </div>
                    <div className="text-lg font-black text-[#58CC02] mt-1 tabular-nums">
                      ~{Math.round((simulatedScore10 / 10) * 35)}/35 câu
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] font-bold text-slate-400 uppercase">
                      Số câu Đọc cần đúng
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                      ~{Math.round((simulatedScore10 / 10) * 40)}/40 câu
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong className="text-slate-900 dark:text-white">Ý nghĩa năng lực ({cefrInfo.name}):</strong>{' '}
                  {cefrInfo.description}
                </div>
              </div>

              {/* Right: 3-Step Roadmap */}
              <div
                className={`lg:col-span-5 space-y-4 transition-all duration-700 delay-200 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                }`}
              >
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Lộ trình 3 bước chinh phục VSTEP B1–B2–C1 cùng Mr.Harry
                </h3>
                {[
                  {
                    step: '01',
                    title: 'Làm đề thi VSTEP chuẩn 75 câu + 2 bài Writing',
                    desc: 'Đánh giá chính xác điểm Listening (trên 35 câu), Reading (trên 40 câu) và Writing theo thang điểm 10 chuẩn Bộ GD&ĐT.',
                  },
                  {
                    step: '02',
                    title: 'Đối chiếu Giải thích, Bằng chứng & Bản dịch song ngữ',
                    desc: 'Nắm vững các dạng câu hỏi VSTEP đặc trưng: từ vựng in đậm gạch chân, đại từ quy chiếu, điền câu vào ô [A]–[D] và suy luận.',
                  },
                  {
                    step: '03',
                    title: 'Tự tạo đề thi VSTEP mới bằng AI & File JSON chuẩn mực',
                    desc: 'Tải lên bất kỳ đề VSTEP PDF/Word nào kèm Master Prompt trích dẫn nguyên văn câu hỏi, đáp án, script và bằng chứng.',
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="flex items-start gap-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#58CC02] text-white font-black text-xs border-b-2 border-[#3C8C02] tabular-nums">
                      {item.step}
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ScrollRevealSection>

        {/* Scroll Down Divider 4 -> 5 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => scrollToSection('landing-section-5')}
            className="group inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-[#58CC02] px-4 py-2 text-xs font-black text-slate-600 dark:text-slate-300 shadow-xs transition-all cursor-pointer"
          >
            <span>Cuộn xuống Thông điệp từ Giảng viên Mr.Harry</span>
            <ArrowDown className="h-3.5 w-3.5 text-[#58CC02] group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* SECTION 5: AUTHOR SIGNATURE (MR.HARRY), FEEDBACK & CTA            */}
        {/* ----------------------------------------------------------------- */}
        <ScrollRevealSection
          id="landing-section-5"
          partLabel="05 / 05"
          subtitle="Thông điệp học thuật từ Mr.Harry (English Lecturer and Instructor) & Hỗ trợ học viên"
        >
          {(isVisible) => (
            <div
              className={`rounded-3xl bg-gradient-to-br from-lime-50 via-white to-emerald-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 border-2 border-[#58CC02] p-6 sm:p-8 shadow-md transition-all duration-700 delay-100 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-8 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-[#58CC02] px-3.5 py-1 text-xs font-black text-white shadow-2xs">
                    <GraduationCap className="h-4 w-4" />
                    <span>OFFICIAL AUTHOR &amp; ACADEMIC CREATOR</span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    Mr.Harry{' '}
                    <span className="text-[#3C8C02] dark:text-[#78E014]">
                      (English Lecturer and Instructor)
                    </span>
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    Hệ thống <strong>VSTEP Tutor - Luyện thi VSTEP B1-B2-C1</strong> được nghiên cứu, biên soạn và phát triển bởi{' '}
                    <strong className="text-slate-900 dark:text-white">
                      Mr.Harry (English Lecturer and Instructor)
                    </strong>{' '}
                    nhằm mang đến cho sinh viên, học viên cao học và giáo viên môi trường luyện thi VSTEP sát thực tế nhất, có đầy đủ giải thích chi tiết, bằng chứng trích dẫn rõ ràng cho từng câu hỏi và công cụ tạo đề AI thông minh.
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleProtectedTestAction}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#58CC02] hover:bg-[#46A302] px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md border-b-4 border-[#3C8C02] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      {currentUser ? (
                        <Play className="h-4 w-4 fill-white" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      <span>
                        {currentUser ? 'Bắt đầu làm đề VSTEP mẫu ngay' : 'Đăng nhập để làm đề mẫu'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={onDirectEnterSystem}
                      className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 hover:bg-lime-50 dark:hover:bg-slate-700 border-2 border-[#58CC02] px-5 py-3.5 text-xs sm:text-sm font-black text-[#2B6601] dark:text-[#78E014] shadow-xs border-b-4 border-b-[#3C8C02] active:border-b-2 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                    >
                      <LayoutGrid className="h-4 w-4 text-[#58CC02]" />
                      <span>Vào Kho Đề VSTEP ({totalPublishedExams} bộ đề)</span>
                    </button>

                    {onOpenFeedbackModal && !canManageExams && !isAdmin && (
                      <button
                        type="button"
                        onClick={onOpenFeedbackModal}
                        className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 border-2 border-slate-200 dark:border-slate-700 px-5 py-3.5 text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 transition-all cursor-pointer whitespace-nowrap"
                      >
                        <MessageSquareWarning className="h-4 w-4 text-[#58CC02]" />
                        <span>Báo lỗi đề thi / Góp ý cho Mr.Harry</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Signature Seal Card */}
                <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 p-5 border-2 border-lime-200 dark:border-lime-800 shadow-sm space-y-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#58CC02] text-white font-black text-xl shadow-sm border-b-4 border-[#3C8C02]">
                    MH
                  </div>
                  <div>
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      Mr.Harry
                    </div>
                    <div className="text-xs font-extrabold text-[#3C8C02] dark:text-[#78E014]">
                      English Lecturer and Instructor
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                    &ldquo;Nắm vững bản chất từng câu hỏi thông qua bằng chứng cụ thể là chìa khóa đạt Bậc 3 (B1), Bậc 4 (B2) và Bậc 5 (C1) VSTEP.&rdquo;
                  </div>
                </div>
              </div>
            </div>
          )}
        </ScrollRevealSection>

        {/* Scroll Back to Top Button */}
        <div className="flex justify-center pt-2 pb-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 hover:bg-lime-50 dark:hover:bg-slate-800 border-2 border-[#58CC02] px-6 py-3 text-xs font-black text-[#2B6601] dark:text-[#78E014] shadow-xs border-b-4 border-b-[#3C8C02] transition-all cursor-pointer"
          >
            <ArrowUp className="h-4 w-4 text-[#58CC02] stroke-[3]" />
            <span>Cuộn về đầu trang</span>
          </button>
        </div>
      </main>

      {/* ===================================================================== */}
      {/* 3. COMPACT FOOTER WITH MR.HARRY SIGNATURE                             */}
      {/* ===================================================================== */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 py-5 px-4 sm:px-6 lg:px-8 mt-auto transition-colors">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
            <UkFlagLogo size="xs" />
            <span>VSTEP Tutor - Luyện thi VSTEP B1-B2-C1</span>
            <span>·</span>
            <span className="text-[#2B6601] dark:text-[#78E014] font-black">
              Created by Mr.Harry (English Lecturer and Instructor)
            </span>
          </div>

          <div className="flex items-center gap-4">
            {onOpenFeedbackModal && !canManageExams && !isAdmin && (
              <button
                type="button"
                onClick={onOpenFeedbackModal}
                className="font-extrabold text-[#3C8C02] dark:text-[#78E014] hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <MessageSquareWarning className="h-3.5 w-3.5" />
                <span>Báo lỗi / Góp ý</span>
              </button>
            )}
            <span>Chuẩn Khung Năng Lực Ngoại Ngữ 6 Bậc Dùng Cho Việt Nam (Bộ GD&amp;ĐT)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
