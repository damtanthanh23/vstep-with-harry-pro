import React, { useState } from 'react';
import { PenTool, CheckCircle2, Info, ChevronRight, Sparkles } from 'lucide-react';
import { WritingTask, WritingSubmission, SAMPLE_B1_WRITING_TASKS } from '../types/writing';

interface WritingSectionStageProps {
  tasks?: WritingTask[];
  submission: WritingSubmission;
  activeTaskIndex?: number;
  onTaskIndexChange?: (idx: 0 | 1) => void;
  isReviewMode?: boolean;
  mode?: 'exam' | 'practice';
  onChange: (submission: WritingSubmission) => void;
  onProceedToReview: () => void;
}

export const WritingSectionStage: React.FC<WritingSectionStageProps> = ({
  tasks = SAMPLE_B1_WRITING_TASKS,
  submission,
  activeTaskIndex: controlledIndex,
  onTaskIndexChange,
  isReviewMode = false,
  mode = 'practice',
  onChange,
  onProceedToReview,
}) => {
  const [internalTaskIndex, setInternalTaskIndex] = useState<0 | 1>(0);
  const [showSampleAnswer, setShowSampleAnswer] = useState(false);
  const activeTaskIndex = controlledIndex !== undefined ? controlledIndex : internalTaskIndex;

  const setActiveTaskIndex = (idx: 0 | 1) => {
    setInternalTaskIndex(idx);
    onTaskIndexChange?.(idx);
  };

  const activeTasks = tasks && tasks.length >= 2 ? tasks : SAMPLE_B1_WRITING_TASKS;
  const task = activeTasks[activeTaskIndex] || activeTasks[0];

  const currentText = activeTaskIndex === 0 ? submission.task1Text : submission.task2Text;

  const countWords = (text: string): number => {
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isReviewMode) return;
    const newText = e.target.value;
    const wordCount = countWords(newText);

    if (activeTaskIndex === 0) {
      onChange({
        ...submission,
        task1Text: newText,
        task1WordCount: wordCount,
      });
    } else {
      onChange({
        ...submission,
        task2Text: newText,
        task2WordCount: wordCount,
      });
    }
  };

  const wordCount = activeTaskIndex === 0 ? submission.task1WordCount : submission.task2WordCount;
  const isOptimal = wordCount >= task.minWords && wordCount <= task.maxWords;
  const isUnder = wordCount < task.minWords;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      {/* Task Selector Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          {activeTasks.map((t, idx) => {
            const words = idx === 0 ? submission.task1WordCount : submission.task2WordCount;
            const meetsCriteria = words >= t.minWords && words <= t.maxWords;

            return (
              <button
                key={t.id || idx}
                type="button"
                onClick={() => setActiveTaskIndex(idx === 0 ? 0 : 1)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
                  activeTaskIndex === idx
                    ? 'bg-[#2E7D32] text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>
                  Writing Part {t.partNumber} ({t.minWords}–{t.maxWords} từ)
                </span>
                {meetsCriteria && (
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      activeTaskIndex === idx ? 'text-lime-200' : 'text-emerald-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Info className="h-4 w-4 text-[#58CC02]" />
          <span>Tổng 2 bài viết: 24 điểm raw → Quy đổi thang 50 điểm chuẩn LanguageCert</span>
        </div>
      </div>

      {/* Main Task Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Task Prompt & Guidance */}
        <div className="lg:col-span-5 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="rounded-lg bg-lime-100 dark:bg-lime-950/60 px-2.5 py-0.5 text-xs font-black text-lime-900 dark:text-lime-200">
              Writing Part {task.partNumber} · {task.marks || 12} Marks
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Mục tiêu: {task.minWords}–{task.maxWords} từ
            </span>
          </div>

          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-2">{task.title}</h3>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
              {task.instruction}
            </p>
          </div>

          {/* Optional Stimulus Image */}
          {task.imageUrl && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-center">
              <img
                src={task.imageUrl}
                alt={task.imageCaption || task.title}
                className="mx-auto max-h-60 w-auto rounded-xl object-contain"
              />
              {task.imageCaption && (
                <p className="mt-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 italic">
                  {task.imageCaption}
                </p>
              )}
            </div>
          )}

          {/* Stimulus Context Box */}
          {task.stimulusText && (
            <div className="rounded-2xl border-2 border-lime-200 dark:border-lime-800 bg-lime-50/50 dark:bg-lime-950/30 p-4 text-xs font-sans text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
              {task.stimulusText}
            </div>
          )}

          {/* Mandatory Content Points */}
          {task.bulletPoints && task.bulletPoints.some((b) => b.trim().length > 0) && (
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                Các ý bắt buộc phải có trong bài viết:
              </h4>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                {task.bulletPoints
                  .filter((pt) => pt.trim().length > 0)
                  .map((pt, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-100 dark:bg-lime-900 text-[10px] font-black text-[#2E7D32] dark:text-lime-200 mt-0.5">
                        {i + 1}
                      </span>
                      <span className="font-medium">{pt}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Sample Answer Toggle in Practice Mode & Review Mode */}
          {(isReviewMode || mode === 'practice') && task.sampleAnswer && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSampleAnswer((prev) => !prev)}
                className="w-full inline-flex items-center justify-between rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-black text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{showSampleAnswer ? 'Ẩn bài viết mẫu' : 'Xem bài viết mẫu chuẩn B1 (Sample Answer)'}</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 underline">
                  {showSampleAnswer ? 'Thu gọn' : 'Bấm để xem'}
                </span>
              </button>

              {showSampleAnswer && (
                <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/95 dark:bg-emerald-950/60 p-4 text-xs text-emerald-950 dark:text-emerald-100 space-y-2 shadow-xs transition-all animate-fadeIn">
                  <div className="flex items-center justify-between font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Bài viết mẫu chuẩn B1 High Pass
                    </span>
                    <span className="rounded-md bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 text-[10px] font-mono text-emerald-900 dark:text-emerald-100">
                      Chuẩn CEFR B1
                    </span>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed font-medium bg-white/70 dark:bg-slate-900/70 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    {task.sampleAnswer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Writing Editor & Live Word Counter */}
        <div className="lg:col-span-7 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between min-h-[480px]">
          <div>
            {/* Header with Live Counter */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <PenTool className="h-4 w-4 text-[#58CC02]" />
                <span>Nội dung bài viết của bạn (Your Composition)</span>
              </span>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-xl px-3 py-1 font-mono text-xs font-black ${
                    isOptimal
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : isUnder
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {wordCount} / {task.minWords}–{task.maxWords} từ
                </span>
              </div>
            </div>

            <textarea
              rows={14}
              readOnly={isReviewMode}
              value={currentText}
              onChange={handleTextChange}
              placeholder={
                activeTaskIndex === 0
                  ? 'Dear Mr. Taylor,\n\nI am writing in response to the notice...'
                  : 'Hi Jamie,\n\nThanks for your email! I am really excited about...'
              }
              className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 p-4 font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-100 outline-hidden transition-all focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-900 resize-none"
            />
          </div>

          {!isReviewMode && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {activeTaskIndex === 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTaskIndex(1)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-2xl bg-[#58CC02] px-5 py-2.5 text-xs font-black text-white shadow-xs hover:bg-[#46a302] active:scale-95 transition-all cursor-pointer"
                >
                  <span>Chuyển sang Writing Part 2</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <button
                    type="button"
                    onClick={() => setActiveTaskIndex(0)}
                    className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Quay lại Writing Part 1
                  </button>
                  <button
                    type="button"
                    onClick={onProceedToReview}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-[#2E7D32] px-6 py-2.5 text-xs font-black text-white shadow-xs hover:bg-[#1B5E20] active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Nộp bài & Chấm điểm AI</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
