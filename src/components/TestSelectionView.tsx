import React, { useRef, useState, useEffect } from 'react';
import {
  FileText,
  Play,
  Upload,
  Headphones,
  CheckCircle2,
  PlusCircle,
  Trash2,
  Sparkles,
  Music,
  Edit3,
  PenTool,
  BookOpen,
  Layers,
  Clock,
  Search,
  BarChart2,
  Award,
  ArrowRight,
  AlertTriangle,
  Tag,
  Mic,
} from 'lucide-react';
import { TestMetadata, ExamSection, InProgressAttempt, isDraftTest } from '../types/exam';
import { Sidebar, NavTabType } from './navigation/Sidebar';
import { MobileBottomNav } from './navigation/MobileBottomNav';
import { TopBarHeader } from './navigation/TopBarHeader';
import { DashboardHomeView } from './views/DashboardHomeView';
import { ListeningPracticeView } from './views/ListeningPracticeView';
import { ReadingPracticeView } from './views/ReadingPracticeView';
import { VocabularyB1View } from './views/VocabularyB1View';
import { LeaderboardView } from './views/LeaderboardView';
import { StudentManagementView } from './views/admin/StudentManagementView';
import { useAuth } from '../context/AuthContext';
import {
  getStreakStatus,
  STREAK_UPDATED_EVENT,
  ComputedStreakStatus,
} from '../services/streakService';
import {
  DEFAULT_EXAM_CATEGORIES,
  getAllExamCategories,
  getEffectiveTestCategory,
  subscribeToCustomExamTags,
} from '../services/categoryTagService';

export type SkillPackageType = 'LRWS' | 'LRW' | 'LR' | 'W' | 'S';

interface TestSelectionViewProps {
  tests: TestMetadata[];
  selectedMode: 'exam' | 'practice';
  onSelectMode: (mode: 'exam' | 'practice') => void;
  selectedSkillPackage: SkillPackageType;
  onSelectSkillPackage: (pkg: SkillPackageType) => void;
  onStartTest: (testId: string, initialSection?: ExamSection, initialPart?: 1 | 2 | 3 | 4) => void;
  onResumeTest?: (testId: string) => void;
  onRestartTest?: (testId: string) => void;
  onUploadAudio: (file: File) => void;
  customAudioName?: string;
  onOpenCreateExam: () => void;
  onOpenAiPdfModal: () => void;
  onEditTest: (testId: string) => void;
  onOpenHistory: () => void;
  onOpenProfile?: () => void;
  onBackToLanding?: () => void;
  onOpenFeedback?: () => void;
  onOpenAdminFeedback?: () => void;
  unreadFeedbackCount?: number;
  onDeleteCustomTest?: (testId: string) => void;
  onPublishDraftTest?: (testId: string) => void;
  inProgressMap?: Record<string, InProgressAttempt>;
  completedScoresMap?: Record<string, number>;
}

export const TestSelectionView: React.FC<TestSelectionViewProps> = ({
  tests,
  selectedMode,
  onSelectMode,
  selectedSkillPackage,
  onSelectSkillPackage,
  onStartTest,
  onResumeTest,
  onRestartTest,
  onUploadAudio,
  customAudioName,
  onOpenCreateExam,
  onOpenAiPdfModal,
  onEditTest,
  onOpenHistory,
  onOpenProfile,
  onBackToLanding,
  onOpenFeedback,
  onOpenAdminFeedback,
  unreadFeedbackCount = 0,
  onDeleteCustomTest,
  onPublishDraftTest,
  inProgressMap = {},
  completedScoresMap = {},
}) => {
  const { canManageExams } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<NavTabType>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(3);
  const [searchTestQuery, setSearchTestQuery] = useState<string>('');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [customTags, setCustomTags] = useState<string[]>(() => getAllExamCategories());
  const [selectedVocabTestFilterId, setSelectedVocabTestFilterId] = useState<string | undefined>(undefined);
  const [vocabWorkspace, setVocabWorkspace] = useState<'my_decks' | 'study_hub' | 'roadmaps'>('roadmaps');
  const [navHistoryStack, setNavHistoryStack] = useState<
    Array<{
      tab: NavTabType;
      vocabTestFilterId?: string;
      vocabWorkspace: 'my_decks' | 'study_hub' | 'roadmaps';
    }>
  >([]);
  const [streakDays, setStreakDays] = useState<number>(() => getStreakStatus().currentStreak);

  useEffect(() => {
    const unsub = subscribeToCustomExamTags(() => {
      setCustomTags(getAllExamCategories());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setStreakDays(getStreakStatus().currentStreak);
    const handleStreakUpdate = (e: Event) => {
      const ce = e as CustomEvent<ComputedStreakStatus>;
      setStreakDays(ce.detail ? ce.detail.currentStreak : getStreakStatus().currentStreak);
    };
    window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
  }, []);

  // 3-second countdown timer whenever deleteTarget is opened
  useEffect(() => {
    if (!deleteTarget) {
      setDeleteCountdown(3);
      return;
    }
    setDeleteCountdown(3);
    const interval = setInterval(() => {
      setDeleteCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [deleteTarget]);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadAudio(e.target.files[0]);
    }
  };

  const getTabLabel = (tab: NavTabType): string => {
    switch (tab) {
      case 'home':
        return 'Trang chủ';
      case 'tests':
        return 'Kho đề thi';
      case 'listening':
        return 'Luyện nghe';
      case 'reading':
        return 'Luyện đọc';
      case 'vocab':
        return 'Từ vựng B1';
      case 'leaderboard':
        return 'Bảng xếp hạng';
      case 'students':
        return 'Quản lý học viên';
      default:
        return 'Trang chủ';
    }
  };

  const handleTabSelect = (tab: NavTabType, nextVocabTestId?: string) => {
    if (tab === 'admin') {
      if (canManageExams) {
        onOpenCreateExam();
      } else {
        setActiveTab('home');
      }
      return;
    }

    // Push current folder state onto history stack if navigating to a different folder/tab
    if (
      tab !== activeTab ||
      nextVocabTestId !== selectedVocabTestFilterId
    ) {
      setNavHistoryStack((prev) => [
        ...prev.slice(-15),
        {
          tab: activeTab,
          vocabTestFilterId: selectedVocabTestFilterId,
          vocabWorkspace,
        },
      ]);
    }

    if (tab === 'vocab') {
      setVocabWorkspace('my_decks');
      if (nextVocabTestId !== undefined) {
        setSelectedVocabTestFilterId(nextVocabTestId);
      }
    } else if (tab === 'home') {
      setSelectedVocabTestFilterId(undefined);
    }

    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Hierarchical Folder-Style Back Navigation (Item 7)
  const handleNavigateBack = () => {
    // 1. Deepest sub-folder inside Vocab: Study Hub -> step back to Vocab Library (Kho Từ Vựng)
    if (activeTab === 'vocab' && vocabWorkspace === 'study_hub') {
      setVocabWorkspace('my_decks');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. Filtered by a specific Exam inside Vocab -> step back to previous folder or clear filter
    if (activeTab === 'vocab' && selectedVocabTestFilterId) {
      if (navHistoryStack.length > 0) {
        const prevEntry = navHistoryStack[navHistoryStack.length - 1];
        setNavHistoryStack((s) => s.slice(0, -1));
        setActiveTab(prevEntry.tab);
        setSelectedVocabTestFilterId(prevEntry.vocabTestFilterId);
        setVocabWorkspace(prevEntry.vocabWorkspace);
      } else {
        setSelectedVocabTestFilterId(undefined);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 3. Pop from navigation history stack if available
    if (navHistoryStack.length > 0) {
      const prevEntry = navHistoryStack[navHistoryStack.length - 1];
      setNavHistoryStack((s) => s.slice(0, -1));
      setActiveTab(prevEntry.tab);
      setSelectedVocabTestFilterId(prevEntry.vocabTestFilterId);
      setVocabWorkspace(prevEntry.vocabWorkspace);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 4. If on a sub-tab with empty stack, step back to root Dashboard ('home')
    if (activeTab !== 'home') {
      setActiveTab('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 5. At root Dashboard ('home') -> step back to Landing page
    if (onBackToLanding) {
      onBackToLanding();
    }
  };

  const getBackTargetLabel = (): string => {
    if (activeTab === 'vocab' && vocabWorkspace === 'study_hub') {
      return 'Kho Từ Vựng';
    }
    if (activeTab === 'vocab' && selectedVocabTestFilterId) {
      if (navHistoryStack.length > 0) {
        return getTabLabel(navHistoryStack[navHistoryStack.length - 1].tab);
      }
      return 'Tất cả bộ từ';
    }
    if (navHistoryStack.length > 0) {
      return getTabLabel(navHistoryStack[navHistoryStack.length - 1].tab);
    }
    if (activeTab !== 'home') {
      return 'Trang chủ';
    }
    return ' Màn hình chính';
  };

  const getBreadcrumbTrail = (): string[] => {
    const trail: string[] = [];
    if (activeTab !== 'home') {
      trail.push('Trang chủ');
    }
    if (activeTab === 'vocab') {
      if (selectedVocabTestFilterId) {
        trail.push('Kho đề thi');
      }
      if (vocabWorkspace === 'study_hub') {
        trail.push('Kho Từ Vựng');
      }
    }
    return trail;
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'home':
        return 'Trang chủ';
      case 'tests':
        return 'Kho Đề Thi VSTEP 4 Kỹ Năng (B1–B2–C1)';
      case 'listening':
        return 'Luyện nghe (Listening · 35 câu)';
      case 'reading':
        return 'Luyện đọc (Reading · 40 câu)';
      case 'vocab':
        if (vocabWorkspace === 'study_hub') {
          return 'Phòng Luyện Tập Từ Vựng';
        }
        return 'Kho Từ Vựng VSTEP B1–B2';
      case 'leaderboard':
        return 'Bảng xếp hạng VSTEP';
      case 'students':
        return 'Quản lý học viên VSTEP';
      default:
        return 'Luyện thi VSTEP B1–B2–C1';
    }
  };

  const getTabSubtitle = () => {
    switch (activeTab) {
      case 'home':
        return 'Tổng quan tiến độ và lộ trình ôn thi VSTEP 4 Kỹ năng (B1–B2–C1) · Created by Mr.Harry';
      case 'tests':
        return 'Kho bộ đề thi chuẩn cấu trúc VSTEP Bộ GD&ĐT (Listening, Reading, Writing & Speaking)';
      case 'listening':
        return 'Luyện nghe 3 Part (35 câu) với trình phát audio đa tốc độ và transcript song ngữ';
      case 'reading':
        return 'Luyện đọc 4 Passages (40 câu) với giao diện chia đôi màn hình đối chiếu';
      case 'vocab':
        return 'Hệ thống học từ vựng VSTEP đồng bộ Cloud Firestore + Lặp lại ngắt quãng Anki (SM-2)';
      case 'leaderboard':
        return 'Bảng vinh danh học viên theo điểm VSTEP thang 10 và chuỗi ngày học thật trên hệ thống';
      case 'students':
        return 'Theo dõi hồ sơ cá nhân, lịch sử thi và thang điểm mục tiêu 4 kỹ năng của học viên';
      default:
        return undefined;
    }
  };

  const availableCategories = Array.from(
    new Set([
      ...DEFAULT_EXAM_CATEGORIES,
      ...customTags,
      ...tests.map((t) => getEffectiveTestCategory(t)),
    ])
  ).filter((cat) => (cat === 'Đề Nháp' ? canManageExams : true));

  // Filter tests in the 'tests' tab
  const filteredTests = tests.filter((t) => {
    const q = searchTestQuery.toLowerCase();
    const matchesSearch =
      t.title.toLowerCase().includes(q) ||
      (t.subtitle && t.subtitle.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (filterTag === 'all') return true;
    if (filterTag === 'Đề Nháp') return isDraftTest(t);
    return getEffectiveTestCategory(t) === filterTag;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans transition-colors">
      {/* 1. Left Collapsible Sidebar (Desktop) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={handleTabSelect}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        onOpenHistory={onOpenHistory}
        onOpenLogin={onOpenHistory}
        onOpenAiPdf={onOpenAiPdfModal}
        onBackToLanding={onBackToLanding}
        onOpenFeedback={onOpenFeedback}
        onOpenAdminFeedback={onOpenAdminFeedback}
        unreadFeedbackCount={unreadFeedbackCount}
        userPoints={650}
      />

      {/* 2. Main Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-6">
        {/* Top Header Bar */}
        <TopBarHeader
          title={getTabTitle()}
          subtitle={getTabSubtitle()}
          onOpenAiPdf={onOpenAiPdfModal}
          onOpenCreateExam={onOpenCreateExam}
          onOpenHistory={onOpenHistory}
          onOpenProfile={onOpenProfile}
          onNavigateBack={handleNavigateBack}
          backTargetLabel={getBackTargetLabel()}
          breadcrumbTrail={getBreadcrumbTrail()}
          onBackToLanding={onBackToLanding}
          onOpenFeedback={onOpenFeedback}
          onOpenAdminFeedback={onOpenAdminFeedback}
          unreadFeedbackCount={unreadFeedbackCount}
          streakDays={streakDays}
        />

        {/* Content Container */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          {/* TAB 1: Trang chủ (Dashboard) */}
          {activeTab === 'home' && (
            <DashboardHomeView
              tests={tests}
              onStartTest={onStartTest}
              onSelectMode={onSelectMode}
              onNavigateTab={(tab) => handleTabSelect(tab)}
              onEditTest={onEditTest}
              onRequestDeleteTest={(id, title) => setDeleteTarget({ id, title })}
              onOpenHistory={onOpenHistory}
              onOpenProfile={onOpenProfile}
              onResumeInProgress={onResumeTest}
              onRestartTest={onRestartTest}
              onSelectVocabForTest={(id) => {
                handleTabSelect('vocab', id);
              }}
              inProgressMap={inProgressMap}
              completedScoresMap={completedScoresMap}
              streakDays={streakDays}
            />
          )}

          {/* TAB 2: Luyện đề (Full Mock Tests List) */}
          {activeTab === 'tests' && (
            <div className="space-y-6 pb-20">
              {/* Header Title & Intro Banner */}
              <div className="rounded-3xl bg-gradient-to-r from-[#58CC02] to-[#3C8C02] p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-black text-xs mb-2 backdrop-blur-xs">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>BỘ ĐỀ CHUẨN CẤU TRÚC VSTEP BỘ GD&ĐT (4 KỸ NĂNG)</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                    Kho Đề Thi VSTEP B1–B2–C1
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-lime-100 max-w-xl">
                    Mỗi bộ đề gồm đầy đủ 4 kỹ năng: Listening (3 Part · 35 câu), Reading (4 Passage · 40 câu), Writing (2 Task) và Speaking (3 Part · Sơ đồ tư duy Mind-map).
                  </p>
                </div>

                {canManageExams && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenCreateExam}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#3C8C02] hover:bg-lime-50 text-xs font-black shadow-md border-b-2 border-slate-200 transition-all cursor-pointer"
                    >
                      <PlusCircle className="h-4 w-4 text-[#58CC02]" />
                      <span>Tạo đề thủ công (Trắng 100%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenAiPdfModal}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/25 hover:bg-black/35 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-lime-200" />
                      <span>Nhập đề bằng AI (PDF)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mode & Skill Packages Toolbar */}
              <div className="rounded-3xl bg-white dark:bg-slate-800/80 p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
                {/* Mode Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Chế độ mặc định:
                    </span>
                    <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-700 p-1">
                      <button
                        type="button"
                        onClick={() => onSelectMode('exam')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                          selectedMode === 'exam'
                            ? 'bg-[#58CC02] text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        Thi thử (Full Kỹ năng & Bấm giờ)
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectMode('practice')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                          selectedMode === 'practice'
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                        }`}
                      >
                        Luyện tập (Chọn từng Part & Tùy chỉnh giờ)
                      </button>
                    </div>
                  </div>

                  {/* Audio Upload Button */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-[#58CC02] transition-colors cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5 text-[#58CC02]" />
                      <span>
                        {customAudioName ? `Audio: ${customAudioName}` : 'Nạp file Audio MP3 riêng'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Skill Package Selector */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Gói kỹ năng làm bài VSTEP:
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Thang chuẩn 10.0 điểm Bộ GD&ĐT (B1: ≥ 4.0 · B2: ≥ 6.0 · C1: ≥ 8.5)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('LRWS')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border cursor-pointer ${
                        selectedSkillPackage === 'LRWS'
                          ? 'border-[#58CC02] bg-[#E5F9D6]/60 dark:bg-emerald-950/40 ring-2 ring-[#58CC02]/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <Layers className="h-4 w-4 text-[#58CC02]" />
                          <span>Đủ 4 Kỹ năng (L-R-W-S)</span>
                        </span>
                        {selectedSkillPackage === 'LRWS' && (
                          <CheckCircle2 className="h-4 w-4 text-[#58CC02]" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        75 câu + 2 Writing + 3 Speaking · 172p
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('LRW')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border cursor-pointer ${
                        selectedSkillPackage === 'LRW'
                          ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <Headphones className="h-4 w-4 text-emerald-500" />
                          <span>3 Kỹ năng (Nghe-Đọc-Viết)</span>
                        </span>
                        {selectedSkillPackage === 'LRW' && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        75 câu trắc nghiệm + 2 Task Viết · 160p
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('S')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border cursor-pointer ${
                        selectedSkillPackage === 'S'
                          ? 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <Mic className="h-4 w-4 text-rose-500" />
                          <span>Luyện Nói Riêng (Speaking)</span>
                        </span>
                        {selectedSkillPackage === 'S' && (
                          <CheckCircle2 className="h-4 w-4 text-rose-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Part 1, 2 & Part 3 Mind-map · 12 phút
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('W')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border cursor-pointer ${
                        selectedSkillPackage === 'W'
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <PenTool className="h-4 w-4 text-indigo-500" />
                          <span>Luyện Viết Riêng (Writing)</span>
                        </span>
                        {selectedSkillPackage === 'W' && (
                          <CheckCircle2 className="h-4 w-4 text-indigo-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Task 1 (≥120 từ) & Task 2 (≥250 từ) · 60p
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {/* Search & Dynamic Category Tag Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTestQuery}
                    onChange={(e) => setSearchTestQuery(e.target.value)}
                    placeholder="Tìm kiếm bộ đề theo tên..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#58CC02]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setFilterTag('all')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      filterTag === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
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
                        onClick={() => setFilterTag(cat)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          filterTag === cat
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
                        {/* Row 1: Bold Title + Circular Action Buttons */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            {isDraft && (
                              <div className="mb-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 p-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                  <span>ĐỀ NHÁP (Học viên chưa thấy)</span>
                                </span>
                                {canManageExams && onPublishDraftTest && (
                                  <button
                                    type="button"
                                    onClick={() => onPublishDraftTest(test.id)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#58CC02] hover:bg-[#46A302] px-2.5 py-1 text-[10px] font-black text-white shadow-2xs cursor-pointer"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Xuất bản ngay</span>
                                  </button>
                                )}
                              </div>
                            )}
                            <h3
                              className="font-black text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight leading-snug break-words"
                              title={test.title}
                            >
                              {test.title}
                            </h3>
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
                            {canManageExams && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget({ id: test.id, title: test.title })}
                                className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-red-600 hover:border-red-300 flex items-center justify-center transition-colors cursor-pointer"
                                title="Xóa bộ đề này khỏi hệ thống (Đếm ngược 3s)"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={onOpenHistory}
                              className="h-9 w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-purple-600 hover:border-purple-300 flex items-center justify-center transition-colors cursor-pointer"
                              title="Xem lịch sử làm bài"
                            >
                              <Clock className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Category Tag Badge & Score Badge */}
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
                            onClick={onOpenHistory}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50/90 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-extrabold border border-amber-200/80 dark:border-amber-800/50 hover:bg-amber-100 transition-colors cursor-pointer"
                          >
                            <Award className="h-3.5 w-3.5 text-amber-600" />
                            <span>
                              {bestScore !== undefined ? `Điểm cao nhất: ${bestScore}/75` : 'Thang 10 VSTEP'}
                            </span>
                          </button>
                        </div>

                        {/* Audio File Info if present */}
                        {(test.audioFileName || test.audioMode === 'per_part') && (
                          <div className="mb-3 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1.5 truncate">
                            <Music className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {test.audioMode === 'per_part'
                                ? 'Chế độ file Audio riêng cho từng Part'
                                : test.audioFileName}
                            </span>
                          </div>
                        )}

                        {/* Row 3: Question Count & Duration */}
                        <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300 mb-3">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4 text-slate-400" />
                            <span>
                              <strong className="font-black text-slate-900 dark:text-white">
                                {test.totalQuestions || 75}
                              </strong>{' '}
                              câu + 2W + 3S
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <span>
                              <strong className="font-black text-slate-900 dark:text-white">
                                {test.durationMinutes || 172}
                              </strong>{' '}
                              phút
                            </span>
                          </div>
                        </div>

                        {/* Row 4: Skill Breakdown Pills (4 Skills L-R-W-S) */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-[11px] font-bold border border-sky-200/60 dark:border-sky-800/50">
                            <Headphones className="h-3 w-3 text-sky-600" />
                            <span>35 Listening</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-bold border border-amber-200/60 dark:border-amber-800/50">
                            <BookOpen className="h-3 w-3 text-amber-600" />
                            <span>40 Reading</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200/60 dark:border-emerald-800/50">
                            <PenTool className="h-3 w-3 text-emerald-600" />
                            <span>2 Writing</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[11px] font-bold border border-rose-200/60 dark:border-rose-800/50">
                            <Mic className="h-3 w-3 text-rose-600" />
                            <span>3 Speaking</span>
                          </span>
                        </div>
                      </div>

                      {/* Bottom Section: Dashed Divider + Status + Action Buttons */}
                      <div>
                        <div className="border-t border-dashed border-slate-200 dark:border-slate-700 pt-3.5 mb-3.5 flex items-center justify-between">
                          {inProgress ? (
                            <div className="flex items-center gap-2 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>Đang làm bài ({answeredInProgressCount}/{test.totalQuestions || 75} câu)</span>
                            </div>
                          ) : bestScore !== undefined ? (
                            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              <span>Đã hoàn thành ({bestScore}/{test.totalQuestions || 75} câu đúng)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-500 dark:text-slate-400">
                              <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                              <span>Chưa luyện tập</span>
                            </div>
                          )}
                        </div>

                        {inProgress && onResumeTest ? (
                          <div className="grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => onResumeTest(test.id)}
                              className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-black shadow-[0_4px_0_#d97706] active:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Play className="h-3.5 w-3.5 fill-amber-600 text-amber-600 shrink-0" />
                              <span>Làm tiếp</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (onRestartTest) {
                                  onRestartTest(test.id);
                                } else {
                                  onSelectMode('exam');
                                  onStartTest(test.id);
                                }
                              }}
                              className="flex items-center justify-center gap-1.5 py-3 px-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-black shadow-[0_4px_0_#4c1d95] active:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                              title="Xóa tiến trình đang làm dở và bắt đầu lại từ đầu"
                            >
                              <Play className="h-3.5 w-3.5 fill-white shrink-0" />
                              <span>Làm lại từ đầu</span>
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectMode('exam');
                                onStartTest(test.id);
                              }}
                              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-black shadow-[0_4px_0_#4c1d95] active:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                            >
                              <Play className="h-3.5 w-3.5 fill-white shrink-0" />
                              <span>Thi thử</span>
                              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                onSelectMode('practice');
                                onStartTest(test.id);
                              }}
                              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl border-2 border-purple-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-400 hover:bg-purple-50/50 text-purple-700 dark:text-purple-300 text-xs sm:text-sm font-black shadow-[0_4px_0_#e9d5ff] dark:shadow-none active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                            >
                              <BookOpen className="h-3.5 w-3.5 shrink-0" />
                              <span>Luyện tập</span>
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            handleTabSelect('vocab', test.id);
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
          )}

          {/* TAB 3: Luyện nghe (Listening) */}
          {activeTab === 'listening' && (
            <ListeningPracticeView
              tests={tests}
              onStartTest={onStartTest}
              onSelectMode={onSelectMode}
              onOpenTranscriptModal={() => {}}
            />
          )}

          {/* TAB 4: Luyện đọc (Reading) */}
          {activeTab === 'reading' && (
            <ReadingPracticeView
              tests={tests}
              onStartTest={onStartTest}
              onSelectMode={onSelectMode}
            />
          )}

          {/* TAB 5: Từ vựng B1 */}
          {activeTab === 'vocab' && (
            <VocabularyB1View
              tests={tests}
              selectedTestFilterId={selectedVocabTestFilterId}
              onClearTestFilter={() => setSelectedVocabTestFilterId(undefined)}
              activeWorkspace={vocabWorkspace}
              onWorkspaceChange={setVocabWorkspace}
            />
          )}

          {/* TAB 6: Bảng xếp hạng */}
          {activeTab === 'leaderboard' && <LeaderboardView />}

          {/* TAB 7: Quản lý học viên (Gated to Admin & Teachers) */}
          {activeTab === 'students' && (
            <StudentManagementView onOpenTest={(testId) => onStartTest(testId)} />
          )}
        </main>
      </div>

      {/* 3. Bottom Navigation Bar for Mobile */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleTabSelect}
      />

      {/* 3-Second Countdown Delete Confirmation Modal for ANY Test */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Bạn chắc chưa? Xóa bộ đề vĩnh viễn?
                </h3>
                <p className="text-xs font-bold text-red-600 dark:text-red-400">
                  {deleteTarget.title}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700">
              Bộ đề này sẽ bị xóa hoàn toàn và ẩn khỏi danh sách của tất cả học sinh trên toàn hệ thống. Vui lòng đợi đếm ngược <strong>3 giây</strong> để xác nhận thao tác.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-xs font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleteCountdown > 0}
                onClick={() => {
                  if (deleteCountdown > 0) return;
                  if (onDeleteCustomTest && deleteTarget) {
                    onDeleteCustomTest(deleteTarget.id);
                  }
                  setDeleteTarget(null);
                }}
                className={`px-5 py-2.5 text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-2 ${
                  deleteCountdown > 0
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {deleteCountdown > 0
                    ? `Chắc chưa? Đợi (${deleteCountdown}s)...`
                    : 'Xóa vĩnh viễn ngay'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
