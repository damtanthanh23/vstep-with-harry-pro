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
      {/* Official VSTEP Writing Paper Header Banner */}
      <div className="mb-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="inline-block border-y-2 border-slate-800 dark:border-slate-200 px-8 py-1 mb-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-[0.2em] text-slate-900 dark:text-white uppercase">
              WRITING
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-extrabold text-slate-700 dark:text-slate-300">
            <span>Time allotted: 60 minutes</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Number of tasks: 2</span>
          </div>
        </div>

        {/* Task Selector Tabs */}
        <div className="flex flex-col sm:items-end gap-2">
          <div className="flex items-center gap-2">
            {activeTasks.map((t, idx) => {
              const words = idx === 0 ? submission.task1WordCount : submission.task2WordCount;
              const meetsCriteria = words >= t.minWords;

              return (
                <button
                  key={t.id || idx}
                  type="button"
                  onClick={() => setActiveTaskIndex(idx === 0 ? 0 : 1)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
                    activeTaskIndex === idx
                      ? 'bg-[#2E7D32] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>
                    Task {t.partNumber} ({t.partNumber === 1 ? '20 phút · ≥120 từ' : '40 phút · ≥250 từ'})
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
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <Info className="h-3.5 w-3.5 text-[#58CC02]" />
            <span>Công thức VSTEP Thang 10: Điểm Writing = (Task 1 + Task 2 × 2) / 3</span>
          </div>
        </div>
      </div>

      {/* Main Task Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Authentic VSTEP Paper Task Prompt & Dashed Stimulus Box */}
        <div className="lg:col-span-5 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-[#FCFDFD] dark:bg-slate-900 p-6 shadow-xs space-y-4">
          {/* Official VSTEP Book Task Badge */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="inline-flex items-center gap-2 rounded-r-full rounded-l-md bg-slate-800 dark:bg-slate-700 pl-3 pr-4 py-1 text-white shadow-xs">
              <span className="italic font-serif font-bold text-sm tracking-wide">Task</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-900 font-black text-xs">
                {task.partNumber}
              </span>
            </div>
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
              {task.partNumber === 1 ? 'Trọng số 1/3 · ~20 phút' : 'Trọng số 2/3 · ~40 phút'}
            </span>
          </div>

          <div className="space-y-2 font-serif text-slate-900 dark:text-slate-100">
            <p className="text-sm font-bold leading-relaxed">
              You should spend about {task.partNumber === 1 ? '20' : '40'} minutes on this task.
            </p>
            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">
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

          {/* Authentic VSTEP Dashed Gray Box (matches official exam paper image) */}
          {task.stimulusText && (
            <div className="rounded-none border-2 border-dashed border-slate-500 dark:border-slate-500 bg-slate-100/90 dark:bg-slate-800/80 p-5 text-sm font-serif italic text-slate-900 dark:text-slate-100 leading-relaxed whitespace-pre-line shadow-2xs">
              {task.stimulusText}
            </div>
          )}

          {/* Official Footer Requirement Line */}
          <p className="font-serif text-sm font-bold text-slate-900 dark:text-white pt-1">
            You should write at least {task.minWords} words.
          </p>

          {/* Mandatory Content Points / Guidance */}
          {task.bulletPoints && task.bulletPoints.some((b) => b.trim().length > 0) && (
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-2">
                Gợi ý triển khai ý (Checklist chấm điểm VSTEP):
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
                  <span>{showSampleAnswer ? 'Ẩn bài viết mẫu' : 'Xem bài viết mẫu chuẩn VSTEP B2–C1'}</span>
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
                      Bài viết mẫu chuẩn VSTEP (Sample Answer)
                    </span>
                    <span className="rounded-md bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 text-[10px] font-mono text-emerald-900 dark:text-emerald-100">
                      B2 – C1 Band
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
                <span>Bài làm Writing Task {task.partNumber} của bạn</span>
              </span>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-xl px-3 py-1 font-mono text-xs font-black ${
                    wordCount >= task.minWords
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : isUnder
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  {wordCount} / tối thiểu {task.minWords} từ
                </span>
              </div>
            </div>

            <textarea
              rows={15}
              readOnly={isReviewMode}
              value={currentText}
              onChange={handleTextChange}
              placeholder={
                activeTaskIndex === 0
                  ? 'Dear Uncle Hung,\n\nI hope you and your family are doing well. I am writing this email in response to...'
                  : 'In recent years, traffic congestion in major Vietnamese cities has become a pressing issue...'
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
                  <span>Chuyển sang Writing Task 2</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <button
                    type="button"
                    onClick={() => setActiveTaskIndex(0)}
                    className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Quay lại Writing Task 1
                  </button>
                  <button
                    type="button"
                    onClick={onProceedToReview}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-[#2E7D32] px-6 py-2.5 text-xs font-black text-white shadow-xs hover:bg-[#1B5E20] active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Hoàn tất Writing / Chuyển tiếp</span>
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
