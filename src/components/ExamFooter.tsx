import React from 'react';
import { ChevronLeft, ChevronRight, Headphones, BookOpen, PenTool } from 'lucide-react';
import { ExamSection, Question, getPartRelativeNumber } from '../types/exam';
import { WritingSubmission } from '../types/writing';

interface ExamFooterProps {
  progressPercent: number;
  section: ExamSection;
  partNumber?: 1 | 2 | 3 | 4;
  questionRangeLabel: string;
  partQuestions?: Question[];
  activeQuestionId?: number;
  answers?: Record<number, string>;
  flagged?: Record<number, boolean>;
  isPracticeMode?: boolean;
  onSelectQuestion?: (questionId: number) => void;
  activeWritingTaskIndex?: 0 | 1;
  writingSubmission?: WritingSubmission;
  onSelectWritingTask?: (taskIndex: 0 | 1) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export const ExamFooter: React.FC<ExamFooterProps> = ({
  progressPercent,
  section,
  partNumber = 1,
  partQuestions = [],
  activeQuestionId,
  answers = {},
  flagged = {},
  isPracticeMode = false,
  onSelectQuestion,
  activeWritingTaskIndex = 0,
  writingSubmission,
  onSelectWritingTask,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}) => {
  const isOddCluster = partNumber === 1 || partNumber === 3;

  const isAnswered = (qId: number) => {
    const val = answers[qId];
    return val !== undefined && val.trim().length > 0;
  };

  const isQuestionCorrect = (q: Question) => {
    const userVal = (answers[q.id] || '').trim().toLowerCase();
    if (!userVal) return false;
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer.some((ans) => userVal === ans.trim().toLowerCase());
    }
    return userVal === (q.correctAnswer || '').trim().toLowerCase();
  };

  const sectionLabel =
    section === 'LISTENING'
      ? `Listening Part ${partNumber}`
      : section === 'READING'
      ? `Reading Passage ${partNumber}`
      : `Writing Task ${(activeWritingTaskIndex ?? 0) + 1}`;

  const answeredInCurrentPart =
    section === 'WRITING'
      ? ((writingSubmission?.task1WordCount || 0) > 0 ? 1 : 0) +
        ((writingSubmission?.task2WordCount || 0) > 0 ? 1 : 0)
      : partQuestions.filter((q) => isAnswered(q.id)).length;

  const totalInCurrentPart = section === 'WRITING' ? 2 : partQuestions.length;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 h-14 bg-[#58CC02] text-white shadow-lg border-t-2 border-[#46a302] flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 select-none">
      {/* Left & Center: Current Part Badge + Single-Line Question Boxes matching SummaryBoardDrawer */}
      <div className="flex items-center gap-2 sm:gap-3 flex-nowrap min-w-0 flex-1 overflow-x-auto no-scrollbar py-1">
        {/* Part Badge */}
        <div
          className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black tracking-wide shadow-xs border border-white/25 ${
            isOddCluster ? 'bg-[#1B5E20] text-white' : 'bg-[#365314] text-white'
          }`}
        >
          {section === 'LISTENING' ? (
            <Headphones className="h-3.5 w-3.5 text-lime-300 shrink-0" />
          ) : section === 'READING' ? (
            <BookOpen className="h-3.5 w-3.5 text-lime-300 shrink-0" />
          ) : (
            <PenTool className="h-3.5 w-3.5 text-lime-300 shrink-0" />
          )}
          <span className="whitespace-nowrap">{sectionLabel}</span>
          {totalInCurrentPart > 0 && (
            <span className="ml-0.5 rounded-md bg-black/25 px-1.5 py-0.5 font-mono text-[10px] text-lime-200">
              {answeredInCurrentPart}/{totalInCurrentPart}
            </span>
          )}
        </div>

        {/* Single-Row Question Boxes */}
        <div className="flex items-center gap-1.5 flex-nowrap shrink-0 pr-2">
          {section === 'WRITING' ? (
            ([0, 1] as const).map((taskIdx) => {
              const relNum = taskIdx + 1;
              const isCurrent = activeWritingTaskIndex === taskIdx;
              const done =
                taskIdx === 0
                  ? (writingSubmission?.task1WordCount || 0) > 0
                  : (writingSubmission?.task2WordCount || 0) > 0;

              return (
                <button
                  key={taskIdx}
                  type="button"
                  onClick={() => onSelectWritingTask && onSelectWritingTask(taskIdx)}
                  className={`relative shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-xs transition-all cursor-pointer ${
                    done
                      ? 'bg-[#1B5E20] text-white border-2 border-white/80 font-black'
                      : 'bg-white/95 text-[#1B5E20] border-2 border-[#1B5E20]/40 hover:bg-white font-bold'
                  } ${
                    isCurrent
                      ? 'ring-3 ring-amber-300 scale-105 z-10 font-black shadow-md border-amber-300'
                      : ''
                  }`}
                  title={`Writing Task ${relNum} (${done ? 'Đã viết' : 'Chưa viết'})`}
                >
                  <span>{relNum}</span>
                </button>
              );
            })
          ) : (
            partQuestions.map((q) => {
              const relNum = getPartRelativeNumber(q.id, partQuestions);
              const answered = isAnswered(q.id);
              const isCurrent = activeQuestionId === q.id;
              const isFlagged = !!flagged[q.id];
              const isCorrect = answered ? isQuestionCorrect(q) : false;

              let boxStyle = '';
              if (isPracticeMode && answered) {
                if (isCorrect) {
                  boxStyle =
                    'bg-emerald-600 text-white border-2 border-emerald-300 font-black shadow-xs hover:bg-emerald-700';
                } else {
                  boxStyle =
                    'bg-rose-600 text-white border-2 border-rose-300 font-black shadow-xs hover:bg-rose-700';
                }
              } else if (answered) {
                boxStyle = isOddCluster
                  ? 'bg-[#1B5E20] text-white border-2 border-white/80 hover:bg-[#14532D] font-black'
                  : 'bg-[#365314] text-white border-2 border-white/80 hover:bg-[#1A2E05] font-black';
              } else {
                boxStyle = isOddCluster
                  ? 'bg-white/95 text-emerald-950 border-2 border-[#1B5E20]/50 hover:bg-white font-bold'
                  : 'bg-lime-50/95 text-lime-950 border-2 border-[#365314]/50 hover:bg-white font-bold';
              }

              const activeHighlight = isCurrent
                ? 'ring-3 ring-amber-300 scale-105 z-10 font-black shadow-md !border-amber-400'
                : '';

              const statusText =
                isPracticeMode && answered
                  ? isCorrect
                    ? 'Đúng'
                    : 'Sai'
                  : answered
                  ? 'Đã làm'
                  : 'Chưa làm';

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelectQuestion && onSelectQuestion(q.id)}
                  className={`relative shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-xs transition-all cursor-pointer ${boxStyle} ${activeHighlight}`}
                  title={`Câu ${relNum} (${statusText})${isFlagged ? ' - Đã gắn cờ' : ''}`}
                >
                  <span className="flex items-center justify-center gap-0.5">
                    <span>{relNum}</span>
                    {isPracticeMode && answered && (
                      <span className="text-[10px] leading-none opacity-90 font-mono">
                        {isCorrect ? '✓' : '✗'}
                      </span>
                    )}
                  </span>
                  {isFlagged && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Overall Progress Pill + Prev / Next Part Navigation Buttons */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 bg-black/15 px-2.5 py-1 rounded-xl border border-white/15">
          <div className="w-16 h-2 rounded-full bg-black/25 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${Math.max(4, progressPercent)}%` }}
            />
          </div>
          <span className="text-[11px] font-black tabular-nums">{progressPercent}%</span>
        </div>

        {/* Prev Arrow */}
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 border-b-2 border-black/20 transition-all ${
            canGoPrev
              ? 'hover:bg-white hover:text-[#58CC02] active:translate-y-0.5 cursor-pointer'
              : 'opacity-40 cursor-not-allowed'
          }`}
          title="Phần trước"
        >
          <ChevronLeft className="h-5 w-5 stroke-[2.5]" />
        </button>

        {/* Next Arrow */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#58CC02] shadow-sm border-b-2 border-slate-200 transition-all ${
            canGoNext
              ? 'hover:bg-lime-50 active:translate-y-0.5 cursor-pointer'
              : 'opacity-40 cursor-not-allowed'
          }`}
          title="Phần tiếp theo"
        >
          <ChevronRight className="h-5 w-5 stroke-[2.5]" />
        </button>
      </div>
    </footer>
  );
};
