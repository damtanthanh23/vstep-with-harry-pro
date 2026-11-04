import React from 'react';
import {
  FileText,
  Play,
  Headphones,
  CheckCircle2,
  Trash2,
  Music,
  Edit3,
  BookOpen,
  Layers,
  Clock,
  Award,
  AlertTriangle,
  Mic,
  ArrowRight,
  BarChart2,
  Tag,
  Pin,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  GripVertical,
} from 'lucide-react';
import { TestMetadata, InProgressAttempt, isDraftTest } from '../types/exam';
import { getEffectiveTestCategory } from '../services/categoryTagService';
import { ExamViewMode } from '../services/examOrderService';

interface CompactExamCardProps {
  test: TestMetadata;
  viewMode?: ExamViewMode;
  canManageExams: boolean;
  inProgress?: InProgressAttempt;
  bestScore?: number;
  orderIndex?: number;
  isPinned?: boolean;
  isReorderMode?: boolean;
  canMovePrev?: boolean;
  canMoveNext?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onMovePrev?: () => void;
  onMoveNext?: () => void;
  onTogglePin?: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onStartExam: (testId: string) => void;
  onStartPractice: (testId: string) => void;
  onResumeTest?: (testId: string) => void;
  onRestartTest?: (testId: string) => void;
  onEditTest: (testId: string) => void;
  onRequestDeleteTest?: (testId: string, testTitle: string) => void;
  onPublishDraftTest?: (testId: string) => void;
  onOpenHistory?: (testId: string) => void;
  onOpenVocabForTest: (testId: string) => void;
}

export const CompactExamCard: React.FC<CompactExamCardProps> = ({
  test,
  viewMode = 'grid',
  canManageExams,
  inProgress,
  bestScore,
  orderIndex,
  isPinned = false,
  isReorderMode = false,
  canMovePrev = false,
  canMoveNext = false,
  isDragging = false,
  isDragOver = false,
  onMovePrev,
  onMoveNext,
  onTogglePin,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onStartExam,
  onStartPractice,
  onResumeTest,
  onRestartTest,
  onEditTest,
  onRequestDeleteTest,
  onPublishDraftTest,
  onOpenHistory,
  onOpenVocabForTest,
}) => {
  const answeredInProgressCount = inProgress
    ? Object.values(inProgress.answers || {}).filter((v) => v && v.trim().length > 0).length
    : 0;
  const isDraft = isDraftTest(test);
  const effectiveCat = getEffectiveTestCategory(test);
  const totalQ = test.totalQuestions || 75;
  const durationMin = test.durationMinutes || 172;
  const hasSeparateAudio = test.audioMode === 'per_part' || Boolean(test.audioFileName);
  const configuredPartCount = test.partAudioUrls
    ? Object.values(test.partAudioUrls).filter((v) => Boolean(v && v.trim().length > 0)).length
    : 0;
  const audioLabel =
    test.audioMode === 'per_part'
      ? configuredPartCount > 0
        ? `${configuredPartCount} Audio riêng`
        : '3 Audio riêng'
      : test.audioFileName
      ? test.audioFileName
      : '3 Audio riêng';

  const dragProps =
    canManageExams && isReorderMode
      ? {
          draggable: true,
          onDragStart,
          onDragOver,
          onDrop,
          onDragEnd,
        }
      : {};

  // ============================================================================
  // LIST VIEW MODE (Chế độ Danh sách — Horizontal Row)
  // ============================================================================
  if (viewMode === 'list') {
    return (
      <div
        {...dragProps}
        className={`w-full group rounded-3xl p-4 sm:p-5 border-2 border-b-4 transition-all flex flex-col gap-3 ${
          isDragging ? 'opacity-50 scale-[0.99]' : ''
        } ${
          isDragOver
            ? 'ring-2 ring-[#58CC02] border-[#58CC02] border-b-[#46A302] bg-[#E5F9D6]/40 dark:bg-emerald-950/20'
            : isDraft
            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-dashed border-amber-400 border-b-amber-500 dark:border-amber-500/80 hover:border-amber-500'
            : isPinned
            ? 'bg-white dark:bg-slate-900 border-[#FFC800] border-b-[#E5B400] shadow-xs hover:shadow-md'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-b-slate-300 dark:border-b-slate-950 hover:border-[#58CC02] hover:border-b-[#46A302] shadow-2xs hover:shadow-md'
        } ${canManageExams && isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* ROW 1: Badges + Full Exam Title */}
        <div className="w-full min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {canManageExams && isReorderMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#F3E5FF] dark:bg-purple-950/80 text-[#A560E8] dark:text-purple-300 text-[11px] font-black shrink-0 whitespace-nowrap">
                <GripVertical className="h-3 w-3" />
                <span>#{orderIndex !== undefined ? orderIndex + 1 : 1}</span>
              </span>
            )}

            {isPinned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FFF3D6] dark:bg-amber-950/80 border border-[#FFC800] text-[#B8860B] dark:text-amber-300 text-[10px] font-black shrink-0 whitespace-nowrap">
                <Pin className="h-2.5 w-2.5 fill-[#FFC800] text-[#E5B400]" />
                <span>Ghim</span>
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold border shrink-0 whitespace-nowrap ${
                isDraft
                  ? 'bg-amber-100/90 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                  : 'bg-[#E5F9D6] dark:bg-emerald-950/50 border-[#58CC02]/50 dark:border-emerald-800 text-[#2B6601] dark:text-emerald-300'
              }`}
            >
              <span>{effectiveCat}</span>
            </span>

            {hasSeparateAudio && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold bg-[#DDF4FF] dark:bg-sky-950/50 border border-[#1CB0F6]/50 dark:border-sky-800 text-[#1899D6] dark:text-sky-300 shrink-0 whitespace-nowrap">
                <span>{audioLabel}</span>
              </span>
            )}

            {isDraft && canManageExams && onPublishDraftTest && (
              <button
                type="button"
                onClick={() => onPublishDraftTest(test.id)}
                className="btn-duo-green inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black text-white shrink-0 whitespace-nowrap"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                <span>Xuất bản</span>
              </button>
            )}
          </div>

          <h3
            className="w-full font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight leading-snug break-normal group-hover:text-[#3C8C02] dark:group-hover:text-[#58CC02] transition-colors"
            title={test.title}
          >
            {test.title}
          </h3>
        </div>

        {/* ROW 2: Specs & Score on left, Action Buttons on right */}
        <div className="w-full pt-2.5 border-t-2 border-slate-100 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Middle: Question/Time Specs + Compact Skill Tags + Score/Progress */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 whitespace-nowrap">
              <span>{totalQ} câu</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>{durationMin}p</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-black">
              <span
                className="px-2 py-0.5 rounded-lg bg-[#DDF4FF] dark:bg-sky-950/60 text-[#1899D6] dark:text-sky-300 border border-[#1CB0F6]/50"
                title="Listening: 35 câu"
              >
                35L
              </span>
              <span
                className="px-2 py-0.5 rounded-lg bg-[#E5F9D6] dark:bg-emerald-950/60 text-[#3C8C02] dark:text-emerald-300 border border-[#58CC02]/50"
                title="Reading: 40 câu"
              >
                40R
              </span>
              <span
                className="px-2 py-0.5 rounded-lg bg-[#F3E5FF] dark:bg-purple-950/60 text-[#A560E8] dark:text-purple-300 border border-[#CE82FF]/50"
                title="Writing: 2 Task"
              >
                2W
              </span>
              <span
                className="px-2 py-0.5 rounded-lg bg-[#FFDFE0] dark:bg-rose-950/60 text-[#EA2B2B] dark:text-rose-300 border border-[#FF4B4B]/50"
                title="Speaking: 3 Part"
              >
                3S
              </span>
            </div>

            <div className="min-w-[92px] text-right">
              {inProgress ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF9600]">
                  <span className="h-2 w-2 rounded-full bg-[#FF9600] animate-pulse" />
                  <span>
                    {answeredInProgressCount}/{totalQ} câu
                  </span>
                </span>
              ) : bestScore !== undefined ? (
                <button
                  type="button"
                  onClick={() => onOpenHistory && onOpenHistory(test.id)}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-[#3C8C02] dark:text-[#58CC02] hover:underline cursor-pointer"
                  title="Xem lịch sử điểm số của đề này"
                >
                  <Award className="h-3.5 w-3.5 text-[#FFC800] shrink-0" />
                  <span>
                    {bestScore}/{totalQ} điểm
                  </span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  <span>Chưa làm</span>
                </span>
              )}
            </div>
          </div>

          {/* Right: Action Buttons + Icon Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {inProgress && onResumeTest ? (
              <>
                <button
                  type="button"
                  onClick={() => onResumeTest(test.id)}
                  className="btn-duo-orange inline-flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-black whitespace-nowrap"
                >
                  <Play className="h-3 w-3 fill-white text-white shrink-0" />
                  <span>Tiếp tục</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onRestartTest ? onRestartTest(test.id) : onStartExam(test.id)
                  }
                  className="btn-duo-green inline-flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-black whitespace-nowrap"
                  title="Xóa tiến trình đang làm dở và bắt đầu lại từ đầu"
                >
                  <span>Làm lại</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onStartExam(test.id)}
                  className="btn-duo-green inline-flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-black whitespace-nowrap"
                >
                  <Play className="h-3 w-3 fill-white shrink-0" />
                  <span>Thi thử</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartPractice(test.id)}
                  className="btn-duo-blue inline-flex items-center justify-center gap-1.5 py-2 px-3.5 text-xs font-black whitespace-nowrap"
                >
                  <span>Luyện tập</span>
                </button>
              </>
            )}

            {/* Vocab Icon Button */}
            <button
              type="button"
              onClick={() => onOpenVocabForTest(test.id)}
              className="h-9 w-9 rounded-2xl border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] bg-[#F3E5FF]/60 dark:bg-purple-950/40 text-[#A560E8] dark:text-purple-300 hover:bg-[#F3E5FF] active:border-b-0 active:translate-y-1 flex items-center justify-center transition-all cursor-pointer"
              title="Từ vựng của đề này"
            >
              <Layers className="h-4 w-4" />
            </button>

            {/* Admin Reorder Controls in List Mode */}
            {canManageExams && isReorderMode && (
              <div className="flex items-center gap-1 pl-1 border-l-2 border-slate-200 dark:border-slate-700">
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={onTogglePin}
                    className={`h-9 w-9 rounded-2xl border-2 border-b-4 active:border-b-0 active:translate-y-1 flex items-center justify-center transition-all cursor-pointer ${
                      isPinned
                        ? 'border-[#FFC800] border-b-[#E5B400] bg-[#FFF3D6] text-[#B8860B] dark:bg-amber-950/70 dark:text-amber-300'
                        : 'border-slate-200 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-amber-600'
                    }`}
                    title={isPinned ? 'Bỏ ghim đề này' : 'Ghim đề này lên đầu'}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canMovePrev}
                  onClick={onMovePrev}
                  className="h-9 w-9 rounded-2xl border-2 border-slate-200 border-b-4 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#58CC02] hover:text-[#3C8C02] active:border-b-0 active:translate-y-1 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                  title="Đưa đề lên trên"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!canMoveNext}
                  onClick={onMoveNext}
                  className="h-9 w-9 rounded-2xl border-2 border-slate-200 border-b-4 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#58CC02] hover:text-[#3C8C02] active:border-b-0 active:translate-y-1 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                  title="Đưa đề xuống dưới"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {canManageExams && (
              <button
                type="button"
                onClick={() => onEditTest(test.id)}
                className="h-9 w-9 rounded-2xl border-2 border-slate-200 border-b-4 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-[#1CB0F6] hover:border-[#1CB0F6] hover:border-b-[#1899D6] active:border-b-0 active:translate-y-1 flex items-center justify-center transition-all cursor-pointer"
                title="Chỉnh sửa bộ đề"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
            {canManageExams && onRequestDeleteTest && (
              <button
                type="button"
                onClick={() => onRequestDeleteTest(test.id, test.title)}
                className="h-9 w-9 rounded-2xl border-2 border-slate-200 border-b-4 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-[#FF4B4B] hover:border-[#FF4B4B] hover:border-b-[#EA2B2B] active:border-b-0 active:translate-y-1 flex items-center justify-center transition-all cursor-pointer"
                title="Xóa bộ đề (Đếm ngược 3s)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {onOpenHistory && (
              <button
                type="button"
                onClick={() => onOpenHistory(test.id)}
                className="h-9 w-9 rounded-2xl border-2 border-slate-200 border-b-4 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-[#58CC02] hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-0 active:translate-y-1 flex items-center justify-center transition-all cursor-pointer"
                title="Xem lịch sử làm bài của đề này"
              >
                <Clock className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // GRID VIEW MODE (Chế độ Lưới — 2-Column Card)
  // ============================================================================
  return (
    <div
      {...dragProps}
      className={`group rounded-3xl p-5 border-2 border-b-4 transition-all flex flex-col justify-between ${
        isDragging ? 'opacity-50 scale-[0.99]' : ''
      } ${
        isDragOver
          ? 'ring-2 ring-[#58CC02] border-[#58CC02] border-b-[#46A302] bg-[#E5F9D6]/40 dark:bg-emerald-950/20'
          : isDraft
          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-dashed border-amber-400 border-b-amber-500 dark:border-amber-500/80 hover:border-amber-500'
          : isPinned
          ? 'bg-white dark:bg-slate-900 border-[#FFC800] border-b-[#E5B400] shadow-xs hover:shadow-md'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 border-b-slate-300 dark:border-b-slate-950 hover:border-[#58CC02] hover:border-b-[#46A302] shadow-2xs hover:shadow-md'
      } ${canManageExams && isReorderMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div>
        {/* Draft Warning Banner (Only if Draft) */}
        {isDraft && (
          <div className="mb-3 rounded-2xl bg-amber-100/90 dark:bg-amber-950/80 border-2 border-amber-300 dark:border-amber-700 px-3 py-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 truncate">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="truncate">Đề nháp (Ẩn với học viên)</span>
            </span>
            {canManageExams && onPublishDraftTest && (
              <button
                type="button"
                onClick={() => onPublishDraftTest(test.id)}
                className="btn-duo-green inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-black text-white shrink-0"
              >
                <CheckCircle2 className="h-3 w-3" />
                <span>Xuất bản</span>
              </button>
            )}
          </div>
        )}

        {/* Row 1: Category Pills on Left | Utility & Reorder Icons on Right */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {canManageExams && isReorderMode && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-[#F3E5FF] dark:bg-purple-950/80 text-[#A560E8] dark:text-purple-300 text-xs font-black">
                <GripVertical className="h-3.5 w-3.5" />
                <span>#{orderIndex !== undefined ? orderIndex + 1 : 1}</span>
              </span>
            )}

            {isPinned && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF3D6] dark:bg-amber-950/80 border border-[#FFC800] text-[#B8860B] dark:text-amber-300 text-[11px] font-black">
                <Pin className="h-3 w-3 fill-[#FFC800] text-[#E5B400]" />
                <span>Ghim đầu</span>
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-extrabold border ${
                isDraft
                  ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                  : 'bg-[#E5F9D6] dark:bg-emerald-950/50 border-[#58CC02]/50 dark:border-emerald-800 text-[#2B6601] dark:text-emerald-300'
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5 shrink-0 text-[#58CC02]" />
              <span>{effectiveCat}</span>
            </span>

            {test.level && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold bg-[#DDF4FF] dark:bg-sky-950/40 border border-[#1CB0F6]/50 text-[#1899D6] dark:text-sky-300">
                <BarChart2 className="h-3 w-3 shrink-0" />
                <span>VSTEP {test.level}</span>
              </span>
            )}
          </div>

          {/* Right Utility & Reorder Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {canManageExams && isReorderMode && (
              <>
                {onTogglePin && (
                  <button
                    type="button"
                    onClick={onTogglePin}
                    className={`h-8 w-8 rounded-xl border-2 border-b-3 active:border-b-0 active:translate-y-0.5 flex items-center justify-center transition-all cursor-pointer ${
                      isPinned
                        ? 'border-[#FFC800] border-b-[#E5B400] bg-[#FFF3D6] text-[#B8860B] dark:bg-amber-950/70 dark:text-amber-300'
                        : 'border-slate-200 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-amber-600'
                    }`}
                    title={isPinned ? 'Bỏ ghim đề này' : 'Ghim đề này lên đầu danh sách'}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={!canMovePrev}
                  onClick={onMovePrev}
                  className="h-8 w-8 rounded-xl border-2 border-slate-200 border-b-3 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#58CC02] hover:text-[#3C8C02] active:border-b-0 active:translate-y-0.5 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                  title="Di chuyển đề lên trước"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!canMoveNext}
                  onClick={onMoveNext}
                  className="h-8 w-8 rounded-xl border-2 border-slate-200 border-b-3 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#58CC02] hover:text-[#3C8C02] active:border-b-0 active:translate-y-0.5 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                  title="Di chuyển đề ra sau"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {canManageExams && (
              <button
                type="button"
                onClick={() => onEditTest(test.id)}
                className="h-8 w-8 rounded-xl border-2 border-slate-200 border-b-3 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-[#1CB0F6] hover:border-[#1CB0F6] hover:border-b-[#1899D6] active:border-b-0 active:translate-y-0.5 flex items-center justify-center transition-all cursor-pointer"
                title="Chỉnh sửa bộ đề"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}
            {canManageExams && onRequestDeleteTest && (
              <button
                type="button"
                onClick={() => onRequestDeleteTest(test.id, test.title)}
                className="h-8 w-8 rounded-xl border-2 border-slate-200 border-b-3 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-[#FF4B4B] hover:border-[#FF4B4B] hover:border-b-[#EA2B2B] active:border-b-0 active:translate-y-0.5 flex items-center justify-center transition-all cursor-pointer"
                title="Xóa bộ đề (Đếm ngược 3s)"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {onOpenHistory && (
              <button
                type="button"
                onClick={() => onOpenHistory(test.id)}
                className="h-8 w-8 rounded-xl border-2 border-slate-200 border-b-3 border-b-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-[#58CC02] hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-0 active:translate-y-0.5 flex items-center justify-center transition-all cursor-pointer"
                title="Xem lịch sử làm bài của đề này"
              >
                <Clock className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Full-Width Bold Exam Title */}
        <h3
          className="font-black text-lg sm:text-[19px] text-slate-900 dark:text-white tracking-tight leading-snug break-normal mb-3 group-hover:text-[#3C8C02] dark:group-hover:text-[#58CC02] transition-colors"
          title={test.title}
        >
          {test.title}
        </h3>

        {/* Row 3: Grey Info Box (Question Count + Duration on Left | Separate Audio Badge on Right) */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200/80 dark:border-slate-700/70 px-3.5 py-2 mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[#58CC02] shrink-0" />
              <span>
                <strong className="font-black text-slate-900 dark:text-white">{totalQ}</strong> câu
              </span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#FF9600] shrink-0" />
              <span>
                <strong className="font-black text-slate-900 dark:text-white">{durationMin}</strong> phút
              </span>
            </span>
          </div>

          {hasSeparateAudio && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-[#1CB0F6]/50 text-[#1899D6] dark:text-sky-400 text-[11px] font-extrabold truncate max-w-[140px]"
              title={
                test.audioMode === 'per_part'
                  ? 'Có 3 file Audio riêng cho từng Part VSTEP (Part 1, 2, 3)'
                  : test.audioFileName
              }
            >
              <Music className="h-3 w-3 shrink-0" />
              <span className="truncate">{audioLabel}</span>
            </span>
          )}
        </div>

        {/* Row 4: Colored 4-Skill Pills Row (Duolingo Semantic Colors) */}
        <div className="flex flex-wrap items-center gap-2 pb-3.5 mb-3 border-b-2 border-slate-100 dark:border-slate-800 text-xs font-extrabold">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#DDF4FF] dark:bg-sky-950/50 border border-[#1CB0F6]/60 text-[#1899D6] dark:text-sky-300">
            <Headphones className="h-3.5 w-3.5 text-[#1CB0F6] shrink-0" />
            <span>35 Nghe</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#E5F9D6] dark:bg-emerald-950/50 border border-[#58CC02]/60 text-[#2B6601] dark:text-emerald-300">
            <BookOpen className="h-3.5 w-3.5 text-[#58CC02] shrink-0" />
            <span>40 Đọc</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#F3E5FF] dark:bg-purple-950/50 border border-[#CE82FF]/60 text-[#A560E8] dark:text-purple-300">
            <Tag className="h-3.5 w-3.5 text-[#CE82FF] shrink-0" />
            <span>2 Viết</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FFDFE0] dark:bg-rose-950/50 border border-[#FF4B4B]/60 text-[#EA2B2B] dark:text-rose-300">
            <Mic className="h-3.5 w-3.5 text-[#FF4B4B] shrink-0" />
            <span>3 Nói</span>
          </span>
        </div>
      </div>

      {/* Bottom Section: Status & Score + 2 Primary 3D Action Buttons + Centered Vocab Button */}
      <div>
        {/* Row 5: Status & Score Badge */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {inProgress ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#FF9600]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF9600] animate-pulse shrink-0" />
              <span>
                Đang làm ({answeredInProgressCount}/{totalQ} câu)
              </span>
            </span>
          ) : bestScore !== undefined ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#3C8C02] dark:text-[#58CC02]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#58CC02] shrink-0" />
              <span>
                Đã hoàn thành ({bestScore}/{totalQ} câu đúng)
              </span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
              <span>Chưa luyện tập</span>
            </span>
          )}

          {(bestScore !== undefined || inProgress) && (
            <button
              type="button"
              onClick={() => onOpenHistory && onOpenHistory(test.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FFF3D6] dark:bg-amber-950/50 border-2 border-[#FFC800] border-b-3 border-b-[#E5B400] text-[#B8860B] dark:text-amber-300 text-xs font-black hover:bg-amber-100/80 active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
              title="Xem lịch sử điểm số của đề này"
            >
              <Award className="h-3.5 w-3.5 text-[#FF9600] shrink-0" />
              <span>
                Điểm: {bestScore !== undefined ? bestScore : 0}/{totalQ}
              </span>
            </button>
          )}
        </div>

        {/* Row 6: Two Equal Duolingo 3D Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          {inProgress && onResumeTest ? (
            <>
              <button
                type="button"
                onClick={() => onResumeTest(test.id)}
                className="btn-duo-orange flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-black whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5 fill-white text-white shrink-0" />
                <span>Làm tiếp</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onRestartTest ? onRestartTest(test.id) : onStartExam(test.id)
                }
                className="btn-duo-green flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-black whitespace-nowrap"
                title="Xóa tiến trình đang làm dở và bắt đầu lại từ đầu"
              >
                <Play className="h-3.5 w-3.5 fill-white shrink-0" />
                <span>Làm lại từ đầu</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onStartExam(test.id)}
                className="btn-duo-green flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-black whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5 fill-white shrink-0" />
                <span>Thi thử</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => onStartPractice(test.id)}
                className="btn-duo-blue flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-black whitespace-nowrap"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span>Luyện tập</span>
              </button>
            </>
          )}
        </div>

        {/* Row 7: Bottom Centered Vocabulary 3D Button */}
        <button
          type="button"
          onClick={() => onOpenVocabForTest(test.id)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-[#F3E5FF]/60 dark:bg-purple-950/30 hover:bg-[#F3E5FF] border-2 border-[#CE82FF]/70 border-b-4 border-b-[#A560E8] active:border-b-0 active:translate-y-1 text-xs font-black text-[#8E35D0] dark:text-purple-300 transition-all cursor-pointer"
        >
          <Layers className="h-3.5 w-3.5 text-[#CE82FF] shrink-0" />
          <span>Học Từ vựng của đề này</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
        </button>
      </div>
    </div>
  );
};
