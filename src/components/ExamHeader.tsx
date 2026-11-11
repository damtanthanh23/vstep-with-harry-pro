import React, { useState } from 'react';
import {
  Clock,
  Check,
  MoreHorizontal,
  Pause,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Headphones,
  Sparkles,
  BookOpen,
  WifiOff,
  CloudCheck,
  RefreshCw,
  Save,
  MessageSquareWarning,
  Sun,
  Moon,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  ShieldAlert,
  StickyNote,
  Keyboard,
} from 'lucide-react';
import { InteractiveAudioPlayer } from './InteractiveAudioPlayer';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export type CloudSyncStatusType =
  | 'idle'
  | 'saving_local'
  | 'syncing_cloud'
  | 'synced_cloud'
  | 'offline_saved'
  | 'sync_error';

interface ExamHeaderProps {
  timeRemainingSeconds: number;
  elapsedSeconds?: number;
  instructionText: string;
  subInstruction?: string;
  currentPromptAudioScript?: string;
  mode: 'exam' | 'practice';
  showAudioPlayer?: boolean;
  isOnline?: boolean;
  lastSavedText?: string;
  cloudSyncStatus?: CloudSyncStatusType;
  onForceCloudSync?: () => void;
  isScratchpadOpen?: boolean;
  scratchpadBadgeCount?: number;
  onToggleScratchpad?: () => void;
  onOpenShortcutsModal?: () => void;
  audioBadgeLabel?: string;
  strictProctoring?: boolean;
  isFullscreen?: boolean;
  tabSwitchCount?: number;
  onToggleFullscreen?: () => void;
  onToggleMode: () => void;
  onPauseClick?: () => void;
  onSaveAndExitPractice?: () => void;
  onSubmitClick: () => void;
  onExitClick: () => void;
  onUploadAudioFile: (file: File) => void;
  customAudioName?: string;
  onOpenTranscript?: () => void;
  onReportIssueClick?: () => void;
}

export const ExamHeader: React.FC<ExamHeaderProps> = React.memo(({
  timeRemainingSeconds,
  elapsedSeconds = 0,
  instructionText,
  subInstruction,
  mode,
  showAudioPlayer = true,
  isOnline = true,
  lastSavedText,
  cloudSyncStatus = 'idle',
  onForceCloudSync,
  isScratchpadOpen = false,
  scratchpadBadgeCount = 0,
  onToggleScratchpad,
  onOpenShortcutsModal,
  audioBadgeLabel,
  strictProctoring = false,
  isFullscreen = false,
  tabSwitchCount = 0,
  onToggleFullscreen,
  onToggleMode,
  onPauseClick,
  onSaveAndExitPractice,
  onSubmitClick,
  onExitClick,
  onUploadAudioFile,
  customAudioName,
  onOpenTranscript,
  onReportIssueClick,
}) => {
  const { isAdmin, canManageExams } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isExitMenuOpen, setIsExitMenuOpen] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isAudioPlayerDrawerOpen, setIsAudioPlayerDrawerOpen] = useState(false);

  // Persistence: collapse/expand state for instruction ribbon
  const [isInstructionCollapsed, setIsInstructionCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('exam_instruction_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleInstructionCollapse = () => {
    setIsInstructionCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('exam_instruction_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isTeacherOrAdmin = Boolean(canManageExams || isAdmin);
  const hasRealBackup = Boolean(lastSavedText && lastSavedText.trim().length > 0);

  const formatTimer = (sec: number) => {
    const safeSec = Math.max(0, sec);
    const hours = Math.floor(safeSec / 3600);
    const minutes = Math.floor((safeSec % 3600) / 60);
    const seconds = safeSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // In practice mode: if a custom countdown timer was set (timeRemainingSeconds > 0), show countdown, otherwise show upward elapsed time
  const displayTime =
    mode === 'exam' || timeRemainingSeconds > 0
      ? formatTimer(timeRemainingSeconds)
      : formatTimer(elapsedSeconds);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#58CC02] text-white shadow-md border-b-2 border-[#46a302] select-none">
      {/* Top Main Navigation Bar */}
      <div className="flex h-16 items-center justify-between px-3 sm:px-6 gap-2">
        {/* Left: Instructions dropdown & Audio player trigger */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Collapse/Expand Toggle Button: Shows "Hiện hướng dẫn" when collapsed */}
          {isInstructionCollapsed ? (
            <button
              type="button"
              onClick={handleToggleInstructionCollapse}
              className="flex items-center gap-1.5 rounded-xl bg-white/25 hover:bg-white/35 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-black text-white shadow-2xs transition-all cursor-pointer whitespace-nowrap animate-in fade-in duration-200"
              title="Mở lại thanh hướng dẫn làm bài"
            >
              <Eye className="h-4 w-4 text-lime-200 shrink-0" />
              <span>Hiện hướng dẫn</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleInstructionCollapse}
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap"
              title="Thu gọn thanh hướng dẫn để giải phóng diện tích làm bài"
            >
              <EyeOff className="h-4 w-4 shrink-0" />
              <span>Ẩn hướng dẫn</span>
              <ChevronUp className="h-3.5 w-3.5 shrink-0" />
            </button>
          )}

          {/* Quy chế thi modal popup */}
          <button
            type="button"
            onClick={() => setIsInstructionsModalOpen(true)}
            className="flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 p-2 text-white transition-colors cursor-pointer shrink-0"
            title="Xem quy chế & hướng dẫn chi tiết từng kỹ năng thi VSTEP"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* Inline Audio Player Bar on Desktop / Laptop (Hidden in Reading & Writing) */}
          {showAudioPlayer && (
            <div className="hidden md:block">
              <InteractiveAudioPlayer
                onUploadFile={onUploadAudioFile}
                customAudioName={customAudioName}
                audioBadgeLabel={audioBadgeLabel}
                isCompact={true}
              />
            </div>
          )}

          {/* Mobile Audio Player Toggle Button (Hidden in Reading & Writing) */}
          {showAudioPlayer && (
            <button
              type="button"
              onClick={() => setIsAudioPlayerDrawerOpen(!isAudioPlayerDrawerOpen)}
              className="md:hidden flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 p-2 transition-colors cursor-pointer"
              title="Mở thanh Audio"
            >
              <Headphones className="h-5 w-5" />
            </button>
          )}

          {/* Quick Script trigger button in practice mode */}
          {mode === 'practice' && onOpenTranscript && (
            <button
              type="button"
              onClick={onOpenTranscript}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-white text-[#46A302] hover:bg-lime-50 px-3 py-1.5 text-xs font-black shadow-xs border-2 border-lime-200 border-b-4 border-b-lime-400 active:border-b-0 active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Xem Script & Dịch (Cột trái)</span>
            </button>
          )}
        </div>

        {/* Center: Timer + Pause Button (with interactive Local/Cloud Sync badge stacked underneath) */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 font-mono text-sm sm:text-base font-black tabular-nums tracking-wide text-white bg-black/20 border-b-2 border-black/25 px-3 py-1.5 rounded-xl"
            title={
              mode === 'exam'
                ? 'Thời gian làm bài còn lại'
                : timeRemainingSeconds > 0
                ? 'Thời gian luyện tập tự chọn còn lại'
                : 'Thời gian đang luyện tập'
            }
          >
            <Clock className="h-4 w-4 text-lime-200" />
            <span>{displayTime}</span>
          </div>

          {onPauseClick && (
            <div className="flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={onPauseClick}
                className={`flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 border-b-3 border-b-black/25 active:border-b-0 active:translate-y-0.5 px-2.5 sm:px-3 text-xs font-black text-white transition-all cursor-pointer whitespace-nowrap ${
                  hasRealBackup || !isOnline || cloudSyncStatus !== 'idle' ? 'py-1' : 'py-1.5'
                }`}
                title="Tạm dừng bài làm"
              >
                <Pause className="h-3.5 w-3.5 fill-white" />
                <span className="hidden sm:inline">Tạm dừng</span>
              </button>

              {(hasRealBackup || !isOnline || cloudSyncStatus !== 'idle') && (
                <button
                  type="button"
                  onClick={() => onForceCloudSync?.()}
                  disabled={!onForceCloudSync || cloudSyncStatus === 'syncing_cloud'}
                  className={`mt-0.5 flex items-center gap-1 text-[10px] font-bold leading-none tabular-nums whitespace-nowrap hover:underline cursor-pointer ${
                    !isOnline || cloudSyncStatus === 'offline_saved'
                      ? 'text-amber-200'
                      : cloudSyncStatus === 'sync_error'
                      ? 'text-rose-200'
                      : 'text-lime-100'
                  }`}
                  title={
                    !isOnline
                      ? 'Đang Offline · Bài làm đã lưu vào trình duyệt. Sẽ tự đồng bộ khi có mạng.'
                      : 'Bấm để đồng bộ ngay bài làm dở lên Cloud Firestore'
                  }
                >
                  {!isOnline || cloudSyncStatus === 'offline_saved' ? (
                    <>
                      <WifiOff className="h-2.5 w-2.5 shrink-0" />
                      <span>{lastSavedText || 'Đã lưu Offline'}</span>
                    </>
                  ) : cloudSyncStatus === 'syncing_cloud' ? (
                    <>
                      <RefreshCw className="h-2.5 w-2.5 text-lime-200 animate-spin shrink-0" />
                      <span>Đang đồng bộ Cloud...</span>
                    </>
                  ) : cloudSyncStatus === 'synced_cloud' ? (
                    <>
                      <CloudCheck className="h-2.5 w-2.5 text-lime-200 shrink-0" />
                      <span>{lastSavedText || 'Đã đồng bộ Cloud'}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-2.5 w-2.5 text-lime-200 shrink-0" />
                      <span>{lastSavedText || 'Đã lưu máy'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Scratchpad + Shortcuts + Fullscreen/Proctoring + Theme + Report Bug + Teacher Mode + Submit + Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Scratchpad Notes Button (Works across all 4 skills, Shortcut: N) */}
          {onToggleScratchpad && (
            <button
              type="button"
              onClick={onToggleScratchpad}
              className={`relative flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-black transition-all active:border-b-0 active:translate-y-0.5 cursor-pointer whitespace-nowrap shrink-0 ${
                isScratchpadOpen
                  ? 'bg-[#FFC800] text-amber-950 border-2 border-[#FF9600] border-b-3 border-b-[#E58700] shadow-xs'
                  : 'bg-white/20 hover:bg-white/30 text-white border border-white/25 border-b-3 border-b-black/25'
              }`}
              title="Bật/Tắt Sổ Ghi Chú Nháp & Danh sách Highlight (Phím tắt: N)"
            >
              <StickyNote className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline">Sổ nháp</span>
              {scratchpadBadgeCount > 0 && (
                <span
                  className={`rounded-md px-1.5 py-0.2 text-[10px] font-mono font-black tabular-nums ${
                    isScratchpadOpen
                      ? 'bg-amber-950 text-[#FFC800]'
                      : 'bg-[#FFC800] text-amber-950'
                  }`}
                >
                  {scratchpadBadgeCount}
                </span>
              )}
            </button>
          )}

          {/* Keyboard Shortcuts Guide Button (Shortcut: ?) */}
          {onOpenShortcutsModal && (
            <button
              type="button"
              onClick={onOpenShortcutsModal}
              className="hidden sm:flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 border-b-3 border-b-black/25 active:border-b-0 active:translate-y-0.5 p-2 text-white transition-all cursor-pointer shrink-0"
              title="Bảng tra cứu Phím tắt & Công cụ phòng thi (Phím tắt: ?)"
              aria-label="Phím tắt phòng thi"
            >
              <Keyboard className="h-4 w-4 text-white" />
            </button>
          )}
          {/* Tab Switch Warning Badge in Strict Exam Mode */}
          {mode === 'exam' && strictProctoring && tabSwitchCount > 0 && (
            <span
              className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-[#FF4B4B] px-2.5 py-1 text-[11px] font-black text-white border border-white/40 shadow-2xs tabular-nums"
              title={`Đã phát hiện rời tab phòng thi ${tabSwitchCount} lần`}
            >
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>Rời tab: {tabSwitchCount}</span>
            </span>
          )}

          {/* Fullscreen Toggle Button */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="hidden sm:flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 border-b-3 border-b-black/25 active:border-b-0 active:translate-y-0.5 p-2 text-white transition-all cursor-pointer shrink-0"
              title={
                isFullscreen
                  ? 'Thoát chế độ Toàn màn hình (Fullscreen)'
                  : 'Bật chế độ Phòng thi Toàn màn hình (Fullscreen)'
              }
              aria-label="Chuyển đổi Toàn màn hình"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-lime-200" />
              ) : (
                <Maximize2 className="h-4 w-4 text-white" />
              )}
            </button>
          )}

          {/* Compact Light/Dark Theme Toggle Icon Button (Item 4) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 border-b-3 border-b-black/25 active:border-b-0 active:translate-y-0.5 p-2 text-white transition-all cursor-pointer shrink-0"
            title={
              theme === 'dark'
                ? 'Đang ở chế độ Tối · Nhấn để chuyển sang Giao diện Sáng'
                : 'Đang ở chế độ Sáng · Nhấn để chuyển sang Giao diện Tối'
            }
            aria-label="Chuyển đổi giao diện Sáng / Tối"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-200" />
            ) : (
              <Moon className="h-4 w-4 text-white" />
            )}
          </button>

          {/* Quick Bug Report / Feedback Button on Current Question (Hidden for Admin) */}
          {onReportIssueClick && !isTeacherOrAdmin && (
            <button
              type="button"
              onClick={onReportIssueClick}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 border border-white/25 border-b-3 border-b-black/25 active:border-b-0 active:translate-y-0.5 px-2.5 sm:px-3 py-1.5 text-xs font-black text-white transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Báo lỗi câu hỏi này hoặc góp ý cho Mr.Harry"
            >
              <MessageSquareWarning className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden md:inline">Báo lỗi</span>
            </button>
          )}

          {/* Mode Toggle: Strictly restricted to Teachers / Admins ONLY (Item 6) */}
          {isTeacherOrAdmin && (
            <button
              type="button"
              onClick={onToggleMode}
              className={`flex items-center gap-1 rounded-xl px-2.5 sm:px-3 py-1.5 text-xs font-black transition-all active:border-b-0 active:translate-y-0.5 cursor-pointer whitespace-nowrap ${
                mode === 'practice'
                  ? 'bg-[#FFC800] text-amber-950 border-2 border-[#FF9600] border-b-4 border-b-[#E58700] shadow-sm'
                  : 'bg-white/20 text-white hover:bg-white/30 border border-white/25 border-b-3 border-b-black/25'
              }`}
              title="[Chế độ Giáo viên/Admin] Chuyển đổi linh hoạt giữa Luyện tập & Thi thử"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">
                {mode === 'practice' ? 'Luyện Tập' : 'Thi Thử'}
              </span>
            </button>
          )}

          {/* Submit Button */}
          <button
            type="button"
            onClick={onSubmitClick}
            className="flex items-center gap-1.5 rounded-xl bg-white text-[#46A302] hover:bg-lime-50 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black shadow-md border-2 border-lime-200 border-b-4 border-b-lime-400 active:border-b-0 active:translate-y-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Check className="h-4 w-4 stroke-[3]" />
            <span>Nộp bài</span>
          </button>

          {/* Three Dots Menu Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExitMenuOpen(!isExitMenuOpen)}
              className="flex items-center justify-center rounded-xl p-1.5 text-white hover:bg-white/20 transition-colors cursor-pointer"
              title="Tùy chọn khác"
            >
              <MoreHorizontal className="h-6 w-6" />
            </button>

            {isExitMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl bg-white dark:bg-slate-900 p-2 shadow-2xl ring-1 ring-black/5 text-slate-800 dark:text-slate-100 border-2 border-lime-400 space-y-1">
                {onReportIssueClick && !canManageExams && !isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsExitMenuOpen(false);
                      onReportIssueClick();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-lime-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <MessageSquareWarning className="h-4 w-4 text-[#58CC02]" />
                    <span>Báo lỗi câu hỏi / Góp ý</span>
                  </button>
                )}
                {mode === 'practice' && onSaveAndExitPractice && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsExitMenuOpen(false);
                      onSaveAndExitPractice();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Save className="h-4 w-4 text-emerald-600" />
                    <span>Lưu tiến trình & Làm tiếp sau</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsExitMenuOpen(false);
                    onExitClick();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span>Thoát phòng thi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Audio Drawer if open */}
      {showAudioPlayer && isAudioPlayerDrawerOpen && (
        <div className="md:hidden bg-white p-3 border-b-2 border-lime-500 shadow-md">
          <InteractiveAudioPlayer
            onUploadFile={onUploadAudioFile}
            customAudioName={customAudioName}
            audioBadgeLabel={audioBadgeLabel}
            isCompact={false}
          />
        </div>
      )}

      {/* Sub-header Ribbon with Instructions (Thu gọn / Mở rộng mượt mà & ghi nhớ localStorage) */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isInstructionCollapsed
            ? 'max-h-0 opacity-0'
            : 'max-h-48 opacity-100'
        }`}
      >
        <div className="bg-[#46a302] px-4 sm:px-6 py-2 text-xs sm:text-sm font-bold text-white flex items-center justify-between gap-3 shadow-inner">
          <p className="max-w-5xl leading-snug">
            {instructionText}
            {subInstruction && (
              <span className="block font-semibold mt-0.5 text-lime-100">
                {subInstruction}
              </span>
            )}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            {mode === 'practice' && (
              <span className="hidden lg:inline text-[11px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
                Luyện tập: Có Script, Dịch song ngữ &amp; Lưu làm tiếp
              </span>
            )}

            {/* Nút Thu gọn ở góc phải của thanh hướng dẫn */}
            <button
              type="button"
              onClick={handleToggleInstructionCollapse}
              className="inline-flex items-center gap-1.5 rounded-xl bg-black/15 hover:bg-black/30 px-2.5 sm:px-3 py-1 text-xs font-black text-white hover:text-lime-200 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              title="Thu gọn thanh hướng dẫn để giải phóng không gian màn hình"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              <span>Thu gọn</span>
            </button>
          </div>
        </div>
      </div>

      {/* Instructions Modal Dropdown */}
      {isInstructionsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setIsInstructionsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 text-slate-800 shadow-2xl border-4 border-[#58CC02]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-[#58CC02]">
                <HelpCircle className="h-6 w-6" />
                <h3 className="text-xl font-black text-slate-900">Hướng Dẫn Làm Bài Thi VSTEP B1-B2-C1</h3>
              </div>
              <button
                onClick={() => setIsInstructionsModalOpen(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-slate-600 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <h4 className="font-black text-slate-900 text-sm">Phần 1: LISTENING (3 Parts - 35 Câu trắc nghiệm A, B, C, D - ~40 Phút)</h4>
                <p className="mt-1 leading-relaxed">
                  • <strong>Listening Part 1 (Câu 1–8):</strong> Nghe 8 đoạn thông báo hoặc hướng dẫn ngắn 1 lần. Chọn đáp án đúng nhất (A, B, C hoặc D).<br />
                  • <strong>Listening Part 2 (Câu 9–20):</strong> Nghe 3 đoạn hội thoại (mỗi đoạn 4 câu hỏi: Câu 9–12, 13–16, 17–20). Chọn đáp án đúng (A, B, C, D).<br />
                  • <strong>Listening Part 3 (Câu 21–35):</strong> Nghe 3 bài thuyết trình hoặc bài giảng học thuật (mỗi bài 5 câu hỏi: Câu 21–25, 26–30, 31–35). Chọn đáp án đúng (A, B, C, D).
                </p>
              </div>

              <div>
                <h4 className="font-black text-slate-900 text-sm">Phần 2: READING (4 Passages - 40 Câu trắc nghiệm A, B, C, D - 60 Phút)</h4>
                <p className="mt-1 leading-relaxed">
                  • <strong>Reading Passage 1 (Câu 1–10) · Passage 2 (Câu 11–20) · Passage 3 (Câu 21–30) · Passage 4 (Câu 31–40):</strong><br />
                  • Giao diện chia 2 cột độc lập: Cột trái hiển thị bài đọc đánh số đoạn <strong>[Đoạn 1], [Đoạn 2]...</strong> cùng các từ vựng/đại từ được <u><strong>gạch chân &amp; in đậm</strong></u> hoặc các ô vuông chèn câu <strong>[A], [B], [C], [D]</strong>; Cột phải hiển thị 10 câu hỏi trắc nghiệm.
                </p>
              </div>

              <div>
                <h4 className="font-black text-slate-900 text-sm">Phần 3: WRITING (2 Tasks - 60 Phút - Tính điểm thang 10)</h4>
                <p className="mt-1 leading-relaxed">
                  • <strong>Writing Task 1 (20 phút - Tối thiểu 120 từ - Trọng số 1/3):</strong> Viết thư hoặc email phản hồi (Formal hoặc Informal).<br />
                  • <strong>Writing Task 2 (40 phút - Tối thiểu 250 từ - Trọng số 2/3):</strong> Viết bài luận học thuật (Essay) nêu quan điểm, nguyên nhân/giải pháp hoặc ưu/nhược điểm.
                </p>
              </div>

              <div className="rounded-2xl bg-lime-50 p-3.5 text-xs text-lime-900 font-bold border border-lime-200">
                Mẹo: Điểm từng kỹ năng được quy đổi sang <strong>Thang điểm 10 (làm tròn 0.5)</strong>: 4.0–5.5 đạt <strong>B1 (Bậc 3)</strong>, 6.0–8.0 đạt <strong>B2 (Bậc 4)</strong>, và 8.5–10.0 đạt <strong>C1 (Bậc 5)</strong>!
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsInstructionsModalOpen(false)}
                className="rounded-2xl bg-[#58CC02] hover:bg-[#46a302] px-6 py-2.5 text-xs font-black text-white shadow-md border-b-3 border-[#3c8c02]"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});
