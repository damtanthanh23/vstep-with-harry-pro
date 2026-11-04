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
  LayoutGrid,
  List,
  ArrowUpDown,
  GripVertical,
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
import { CompactExamCard } from './CompactExamCard';
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
} from '../services/examOrderService';

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
  onOpenHistory: (testId?: string) => void;
  onOpenProfile?: () => void;
  onBackToLanding?: () => void;
  onOpenFeedback?: () => void;
  onOpenAdminFeedback?: () => void;
  isAdminFeedbackOpen?: boolean;
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
  isAdminFeedbackOpen = false,
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
  const [selectedVocabTestFilterId, setSelectedVocabTestFilterId] = useState<string | undefined>(undefined);
  const [vocabWorkspace, setVocabWorkspace] = useState<'community' | 'my_decks' | 'study_hub' | 'roadmaps'>('roadmaps');
  const [navHistoryStack, setNavHistoryStack] = useState<
    Array<{
      tab: NavTabType;
      vocabTestFilterId?: string;
      vocabWorkspace: 'community' | 'my_decks' | 'study_hub' | 'roadmaps';
    }>
  >([]);
  const [streakDays, setStreakDays] = useState<number>(() => getStreakStatus().currentStreak);

  useEffect(() => {
    const unsub = subscribeToCustomExamTags(() => {
      setCustomTags(getAllExamCategories());
    });
    const unsubOrder = subscribeToExamOrderConfig((cfg) => {
      setExamOrderConfig(cfg);
      setViewMode(getSavedExamViewMode());
    });
    return () => {
      unsub();
      unsubOrder();
    };
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

  // Filter & Sort tests in the 'tests' tab
  const filteredTests = sortTestsList(
    tests.filter((t) => {
      const q = searchTestQuery.toLowerCase();
      const matchesSearch =
        t.title.toLowerCase().includes(q) ||
        (t.subtitle && t.subtitle.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      if (filterTag === 'all') return true;
      if (filterTag === 'Đề Nháp') return isDraftTest(t);
      return getEffectiveTestCategory(t) === filterTag;
    }),
    examOrderConfig,
    sortMode,
    inProgressMap,
    completedScoresMap
  );

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
        isAdminFeedbackOpen={isAdminFeedbackOpen}
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
          isAdminFeedbackOpen={isAdminFeedbackOpen}
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
              <div className="rounded-3xl bg-gradient-to-r from-[#58CC02] to-[#3C8C02] border-2 border-[#46A302] border-b-4 border-b-[#2B6600] p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#2B6600] hover:bg-lime-50 text-xs font-black shadow-md border-2 border-lime-200 border-b-4 border-b-lime-400 active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
                    >
                      <PlusCircle className="h-4 w-4 text-[#58CC02]" />
                      <span>Tạo đề thủ công (Trắng 100%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenAiPdfModal}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#1CB0F6] hover:bg-[#1899D6] text-white text-xs font-black border-2 border-[#1899D6] border-b-4 border-b-[#1480B3] active:border-b-0 active:translate-y-1 shadow-sm transition-all cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 text-white" />
                      <span>Nhập đề bằng AI (PDF)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mode & Skill Packages Toolbar */}
              <div className="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-2xs space-y-4">
                {/* Mode Selector */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                      Chế độ mặc định:
                    </span>
                    <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-700/80 p-1 border border-slate-200/80 dark:border-slate-600 gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectMode('exam')}
                        className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                          selectedMode === 'exam'
                            ? 'bg-[#58CC02] text-white border-b-2 border-[#46A302] shadow-xs'
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
                            ? 'bg-[#FF9600] text-white border-b-2 border-[#E58700] shadow-xs'
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
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-700 dark:text-slate-300 hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-2 active:translate-y-0.5 transition-all cursor-pointer"
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
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                      Gói kỹ năng làm bài VSTEP:
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      Thang chuẩn 10.0 điểm Bộ GD&ĐT (B1: ≥ 4.0 · B2: ≥ 6.0 · C1: ≥ 8.5)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('LRWS')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border-2 border-b-4 active:border-b-2 active:translate-y-0.5 cursor-pointer ${
                        selectedSkillPackage === 'LRWS'
                          ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/55 dark:bg-emerald-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/50 dark:bg-slate-800/40 hover:border-[#58CC02]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <Layers className="h-4 w-4 text-[#58CC02]" />
                          <span>Đủ 4 Kỹ năng (L-R-W-S)</span>
                        </span>
                        {selectedSkillPackage === 'LRWS' && (
                          <CheckCircle2 className="h-4 w-4 text-[#46A302]" />
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        75 câu + 2 Writing + 3 Speaking · 172p
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('LRW')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border-2 border-b-4 active:border-b-2 active:translate-y-0.5 cursor-pointer ${
                        selectedSkillPackage === 'LRW'
                          ? 'border-[#1CB0F6] border-b-[#1899D6] bg-[#DDF4FF]/65 dark:bg-sky-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/50 dark:bg-slate-800/40 hover:border-[#1CB0F6]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <Headphones className="h-4 w-4 text-[#1CB0F6]" />
                          <span>3 Kỹ năng (Nghe-Đọc-Viết)</span>
                        </span>
                        {selectedSkillPackage === 'LRW' && (
                          <CheckCircle2 className="h-4 w-4 text-[#1899D6]" />
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        75 câu trắc nghiệm + 2 Task Viết · 160p
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('S')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border-2 border-b-4 active:border-b-2 active:translate-y-0.5 cursor-pointer ${
                        selectedSkillPackage === 'S'
                          ? 'border-[#FF4B4B] border-b-[#EA2B2B] bg-[#FFDFE0]/65 dark:bg-rose-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/50 dark:bg-slate-800/40 hover:border-[#FF4B4B]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <Mic className="h-4 w-4 text-[#FF4B4B]" />
                          <span>Luyện Nói Riêng (Speaking)</span>
                        </span>
                        {selectedSkillPackage === 'S' && (
                          <CheckCircle2 className="h-4 w-4 text-[#EA2B2B]" />
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Part 1, 2 & Part 3 Mind-map · 12 phút
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectSkillPackage('W')}
                      className={`flex flex-col text-left rounded-2xl p-3.5 transition-all border-2 border-b-4 active:border-b-2 active:translate-y-0.5 cursor-pointer ${
                        selectedSkillPackage === 'W'
                          ? 'border-[#CE82FF] border-b-[#A560E8] bg-[#F3E5FF]/70 dark:bg-purple-950/40 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/50 dark:bg-slate-800/40 hover:border-[#CE82FF]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                          <PenTool className="h-4 w-4 text-[#A560E8]" />
                          <span>Luyện Viết Riêng (Writing)</span>
                        </span>
                        {selectedSkillPackage === 'W' && (
                          <CheckCircle2 className="h-4 w-4 text-[#A560E8]" />
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Task 1 (≥120 từ) & Task 2 (≥250 từ) · 60p
                      </p>
                    </button>
                  </div>
                </div>
              </div>

              {orderSyncNotice && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold animate-in fade-in duration-150">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{orderSyncNotice}</span>
                </div>
              )}

              {/* Search + Sort + Admin Reorder + View Mode Switcher Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Left: Search Input */}
                <div className="relative flex-1 max-w-xl">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTestQuery}
                    onChange={(e) => setSearchTestQuery(e.target.value)}
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
                  onClick={() => setFilterTag('all')}
                  className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                    filterTag === 'all'
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
                      onClick={() => setFilterTag(cat)}
                      className={`px-3.5 py-1.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                        filterTag === cat
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
                    onStartExam={(id) => {
                      onSelectMode('exam');
                      onStartTest(id);
                    }}
                    onStartPractice={(id) => {
                      onSelectMode('practice');
                      onStartTest(id);
                    }}
                    onResumeTest={onResumeTest}
                    onRestartTest={onRestartTest}
                    onEditTest={onEditTest}
                    onRequestDeleteTest={(id, title) => setDeleteTarget({ id, title })}
                    onPublishDraftTest={onPublishDraftTest}
                    onOpenHistory={onOpenHistory ? (id) => onOpenHistory(id) : undefined}
                    onOpenVocabForTest={(id) => handleTabSelect('vocab', id)}
                  />
                ))}
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
