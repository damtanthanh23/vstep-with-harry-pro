import React from 'react';
import { ChevronLeft, ChevronRight, Headphones, BookOpen, PenTool, Mic } from 'lucide-react';
import { ExamSection, Question, getPartRelativeNumber } from '../types/exam';
import { WritingSubmission } from '../types/writing';
import { SpeakingSubmission } from '../types/speaking';

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
  activeSpeakingPartIndex?: 0 | 1 | 2;
  speakingSubmission?: SpeakingSubmission;
  onSelectSpeakingPart?: (partIndex: 0 | 1 | 2) => void;
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
  activeSpeakingPartIndex = 0,
  speakingSubmission,
  onSelectSpeakingPart,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}) => {
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
      : section === 'WRITING'
      ? `Writing Task ${(activeWritingTaskIndex ?? 0) + 1}`
      : `Speaking Part ${(activeSpeakingPartIndex ?? 0) + 1}`;

  const answeredInCurrentPart =
    section === 'WRITING'
      ? ((writingSubmission?.task1WordCount || 0) > 0 ? 1 : 0) +
        ((writingSubmission?.task2WordCount || 0) > 0 ? 1 : 0)
      : section === 'SPEAKING'
      ? ((speakingSubmission?.part1WordCount || 0) > 0 || speakingSubmission?.part1AudioUrl || speakingSubmission?.part1AudioDataUrl ? 1 : 0) +
        ((speakingSubmission?.part2WordCount || 0) > 0 || speakingSubmission?.part2AudioUrl || speakingSubmission?.part2AudioDataUrl ? 1 : 0) +
        ((speakingSubmission?.part3WordCount || 0) > 0 || speakingSubmission?.part3AudioUrl || speakingSubmission?.part3AudioDataUrl ? 1 : 0)
      : partQuestions.filter((q) => isAnswered(q.id)).length;

  const totalInCurrentPart =
    section === 'WRITING' ? 2 : section === 'SPEAKING' ? 3 : partQuestions.length;

  const sectionBadgeStyle =
    section === 'LISTENING'
      ? 'bg-[#1CB0F6] border-[#1899D6] border-b-[#0E74A5]'
      : section === 'READING'
      ? 'bg-[#2B6600] border-[#1E4700] border-b-[#132E00]'
      : section === 'WRITING'
      ? 'bg-[#A560E8] border-[#8438C8] border-b-[#6826A6]'
      : 'bg-[#FF4B4B] border-[#EA2B2B] border-b-[#C91D1D]';

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 h-15 bg-[#58CC02] text-white shadow-lg border-t-2 border-[#46A302] flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 select-none">
      {/* Left & Center: Current Part Badge + Single-Line 3D Question Boxes */}
      <div className="flex items-center gap-2 sm:gap-3 flex-nowrap min-w-0 flex-1 overflow-x-auto no-scrollbar py-1">
        {/* Part Badge */}
        <div
          className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black tracking-wide text-white border-2 border-b-4 ${sectionBadgeStyle}`}
        >
          {section === 'LISTENING' ? (
            <Headphones className="h-3.5 w-3.5 text-white shrink-0" />
          ) : section === 'READING' ? (
            <BookOpen className="h-3.5 w-3.5 text-white shrink-0" />
          ) : section === 'WRITING' ? (
            <PenTool className="h-3.5 w-3.5 text-white shrink-0" />
          ) : (
            <Mic className="h-3.5 w-3.5 text-white shrink-0" />
          )}
          <span className="whitespace-nowrap">{sectionLabel}</span>
          {totalInCurrentPart > 0 && (
            <span className="ml-0.5 rounded-md bg-black/25 px-1.5 py-0.5 font-mono text-[10px] text-white">
              {answeredInCurrentPart}/{totalInCurrentPart}
            </span>
          )}
        </div>

        {/* Single-Row 3D Question Boxes */}
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
                  className={`relative shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-xs transition-all cursor-pointer border-2 border-b-4 active:border-b-0 active:translate-y-0.5 ${
                    done
                      ? 'bg-[#CE82FF] text-white border-[#A560E8] border-b-[#8438C8] font-black'
                      : 'bg-white text-[#8438C8] border-[#E5E5E5] border-b-[#CECECE] hover:bg-[#F3E5FF] font-black'
                  } ${
                    isCurrent
                      ? 'ring-3 ring-[#FFC800] scale-105 z-10 font-black !border-[#FFC800]'
                      : ''
                  }`}
                  title={`Writing Task ${relNum} (${done ? 'Đã viết' : 'Chưa viết'})`}
                >
                  <span>{relNum}</span>
                </button>
              );
            })
          ) : section === 'SPEAKING' ? (
            ([0, 1, 2] as const).map((partIdx) => {
              const relNum = partIdx + 1;
              const isCurrent = activeSpeakingPartIndex === partIdx;
              const done =
                partIdx === 0
                  ? (speakingSubmission?.part1WordCount || 0) > 0 || Boolean(speakingSubmission?.part1AudioUrl || speakingSubmission?.part1AudioDataUrl)
                  : partIdx === 1
                  ? (speakingSubmission?.part2WordCount || 0) > 0 || Boolean(speakingSubmission?.part2AudioUrl || speakingSubmission?.part2AudioDataUrl)
                  : (speakingSubmission?.part3WordCount || 0) > 0 || Boolean(speakingSubmission?.part3AudioUrl || speakingSubmission?.part3AudioDataUrl);

              return (
                <button
                  key={partIdx}
                  type="button"
                  onClick={() => onSelectSpeakingPart && onSelectSpeakingPart(partIdx)}
                  className={`relative shrink-0 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-xs transition-all cursor-pointer border-2 border-b-4 active:border-b-0 active:translate-y-0.5 ${
                    done
                      ? 'bg-[#FF4B4B] text-white border-[#EA2B2B] border-b-[#C91D1D] font-black'
                      : 'bg-white text-[#EA2B2B] border-[#E5E5E5] border-b-[#CECECE] hover:bg-[#FFDFE0] font-black'
                  } ${
                    isCurrent
                      ? 'ring-3 ring-[#FFC800] scale-105 z-10 font-black !border-[#FFC800]'
                      : ''
                  }`}
                  title={`Speaking Part ${relNum} (${done ? 'Đã trả lời / ghi âm' : 'Chưa làm'})`}
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
                    'bg-[#2B6600] text-white border-2 border-[#46A302] border-b-4 border-b-[#132E00] font-black';
                } else {
                  boxStyle =
                    'bg-[#FF4B4B] text-white border-2 border-[#EA2B2B] border-b-4 border-b-[#C91D1D] font-black';
                }
              } else if (answered) {
                boxStyle =
                  section === 'LISTENING'
                    ? 'bg-[#1CB0F6] text-white border-2 border-[#1899D6] border-b-4 border-b-[#0E74A5] font-black'
                    : 'bg-[#2B6600] text-white border-2 border-white/60 border-b-4 border-b-[#132E00] font-black';
              } else {
                boxStyle =
                  'bg-white text-[#3C3C3C] border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] hover:bg-lime-50 font-black';
              }

              const activeHighlight = isCurrent
                ? 'ring-3 ring-[#FFC800] scale-105 z-10 font-black !border-[#FFC800]'
                : 'active:border-b-0 active:translate-y-0.5';

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
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#FF9600] ring-2 ring-white" />
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
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 border-2 border-white/30 border-b-4 border-b-black/30 transition-all ${
            canGoPrev
              ? 'hover:bg-white hover:text-[#46A302] active:border-b-0 active:translate-y-1 cursor-pointer'
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
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#46A302] shadow-sm border-2 border-lime-200 border-b-4 border-b-lime-400 transition-all ${
            canGoNext
              ? 'hover:bg-lime-50 active:border-b-0 active:translate-y-1 cursor-pointer'
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
