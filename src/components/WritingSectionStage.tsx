import React, { useState, useEffect, useMemo } from 'react';
import {
  PenTool,
  CheckCircle2,
  Info,
  ChevronRight,
  Sparkles,
  Clock,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  PlusCircle,
  CheckSquare,
  Languages,
} from 'lucide-react';
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

interface PhraseCategory {
  label: string;
  band: 'B1' | 'B2' | 'C1';
  phrases: { en: string; vi: string }[];
}

const TASK1_PHRASE_BANK: PhraseCategory[] = [
  {
    label: 'Mở đầu thư & Hỏi thăm',
    band: 'B1',
    phrases: [
      {
        en: 'Dear [Name],\n\nI hope this email finds you and your family in good health and high spirits. ',
        vi: 'Lời chào & hỏi thăm sức khỏe trang trọng/thân mật',
      },
      {
        en: 'It was such a pleasure to receive your last letter. I am writing this email to share some exciting news with you. ',
        vi: 'Vui mừng khi nhận thư & nêu lý do viết phản hồi',
      },
    ],
  },
  {
    label: 'Trả lời yêu cầu & Đưa lời khuyên',
    band: 'B2',
    phrases: [
      {
        en: 'Regarding your question about..., I would strongly recommend that you consider... ',
        vi: 'Trả lời câu hỏi trong đề & đưa ra gợi ý B2',
      },
      {
        en: 'From my personal experience, it would be a great idea if you could... because it allows you to... ',
        vi: 'Đưa lời khuyên dựa trên trải nghiệm cá nhân',
      },
      {
        en: 'Furthermore, another important point worth mentioning is that... ',
        vi: 'Bổ sung ý thứ 2/thứ 3 trong bức thư',
      },
    ],
  },
  {
    label: 'Kết thư & Hẹn gặp lại',
    band: 'B2',
    phrases: [
      {
        en: '\n\nPlease let me know if you need any further information. I look forward to hearing from you soon.\n\nWarm regards,\n[Your Name]',
        vi: 'Kết thư chuẩn VSTEP B1–B2 hoàn chỉnh',
      },
    ],
  },
];

const TASK2_PHRASE_BANK: PhraseCategory[] = [
  {
    label: 'Mở bài học thuật (Introduction)',
    band: 'B2',
    phrases: [
      {
        en: 'In recent years, the issue of ... has attracted considerable public attention and sparked heated debate. ',
        vi: 'Câu dẫn nhập chủ đề xã hội chuẩn B2–C1',
      },
      {
        en: 'While some people argue that ..., I firmly believe that this trend brings both significant benefits and potential drawbacks. ',
        vi: 'Câu luận điểm (Thesis Statement) cân bằng 2 mặt',
      },
    ],
  },
  {
    label: 'Triển khai Luận điểm (Body Paragraphs)',
    band: 'B2',
    phrases: [
      {
        en: '\n\nOn the one hand, there are several compelling reasons why ... First and foremost, ... ',
        vi: 'Mở đoạn thân bài 1 + Luận điểm chính đầu tiên',
      },
      {
        en: 'Moreover, a clear illustration of this is that ... As a result, individuals and society as a whole can benefit greatly from ... ',
        vi: 'Đưa dẫn chứng thực tế & phân tích hệ quả',
      },
      {
        en: '\n\nOn the other hand, despite the aforementioned advantages, we should not overlook the negative impacts of ... ',
        vi: 'Chuyển đoạn phản biện / mặt đối lập mượt mà',
      },
    ],
  },
  {
    label: 'Cấu trúc ăn điểm C1 & Kết luận',
    band: 'C1',
    phrases: [
      {
        en: 'Not only does this phenomenon enhance ..., but it also plays a pivotal role in fostering ... ',
        vi: 'Cấu trúc đảo ngữ Not only... but also ăn điểm C1',
      },
      {
        en: '\n\nIn conclusion, taking all the aforementioned factors into account, I am convinced that ... Only by combining joint efforts can we achieve sustainable results.',
        vi: 'Kết bài tổng kết sắc bén kèm thông điệp hành động',
      },
    ],
  },
];

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
  const [showPhraseBank, setShowPhraseBank] = useState(true);
  const [showPromptTips, setShowPromptTips] = useState(false);
  const activeTaskIndex = controlledIndex !== undefined ? controlledIndex : internalTaskIndex;

  // Per-task countdown timer: Task 1 = 20 mins (1200s), Task 2 = 40 mins (2400s)
  const [task1SecondsLeft, setTask1SecondsLeft] = useState<number>(20 * 60);
  const [task2SecondsLeft, setTask2SecondsLeft] = useState<number>(40 * 60);
  const [isTaskTimerRunning, setIsTaskTimerRunning] = useState<boolean>(!isReviewMode);

  useEffect(() => {
    if (isReviewMode || !isTaskTimerRunning) return;
    const interval = window.setInterval(() => {
      if (activeTaskIndex === 0) {
        setTask1SecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      } else {
        setTask2SecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTaskIndex, isTaskTimerRunning, isReviewMode]);

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

  const updateCurrentTaskText = (newText: string) => {
    if (isReviewMode) return;
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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateCurrentTaskText(e.target.value);
  };

  const handleInsertPhrase = (phraseEn: string) => {
    if (isReviewMode || mode === 'exam') return;
    const trimmed = currentText.trimEnd();
    const separator =
      trimmed.length === 0
        ? ''
        : phraseEn.startsWith('\n')
        ? ''
        : ' ';
    updateCurrentTaskText(`${trimmed}${separator}${phraseEn}`);
  };

  const wordCount = activeTaskIndex === 0 ? submission.task1WordCount : submission.task2WordCount;
  const isUnder = wordCount < task.minWords;

  const currentTimerSeconds = activeTaskIndex === 0 ? task1SecondsLeft : task2SecondsLeft;
  const formatTaskTimer = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleResetTaskTimer = () => {
    if (activeTaskIndex === 0) {
      setTask1SecondsLeft(20 * 60);
    } else {
      setTask2SecondsLeft(40 * 60);
    }
  };

  // Real-Time VSTEP Writing Structure Analyzer
  const structureChecks = useMemo(() => {
    const text = currentText.trim();
    const lower = text.toLowerCase();
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (activeTaskIndex === 0) {
      // Task 1: Letter / Email
      const hasGreeting = /^(dear|hi|hello)\b/i.test(text);
      const hasPurpose =
        /\b(writing|write|hope you|how are you|received your|thank you for|reply to|response to|let you know)\b/i.test(
          lower
        );
      const hasParagraphs = paragraphs.length >= 3;
      const hasSignOff =
        /\b(regards|wishes|sincerely|faithfully|love|take care|yours|see you soon|hearing from you)\b/i.test(
          lower
        );

      return [
        { label: 'Lời chào mở thư (Dear...)', done: hasGreeting },
        { label: 'Mục đích viết thư rõ ràng', done: hasPurpose },
        { label: `Chia đoạn hợp lý (${paragraphs.length}/3+ đoạn)`, done: hasParagraphs },
        { label: 'Lời kết thư (Best regards...)', done: hasSignOff },
      ];
    } else {
      // Task 2: Essay
      const hasIntro = wordCount >= 30 && paragraphs.length >= 1;
      const hasBodyParagraphs = paragraphs.length >= 3;
      const linkingMatches =
        lower.match(
          /\b(however|furthermore|moreover|therefore|in addition|on the other hand|firstly|secondly|first of all|consequently|nevertheless|although|despite|for instance|for example|as a result)\b/g
        ) || [];
      const hasLinkingWords = linkingMatches.length >= 3;
      const hasConclusion =
        /\b(in conclusion|to sum up|all in all|to conclude|in summary|overall|taking everything into account)\b/i.test(
          lower
        );

      return [
        { label: 'Mở bài dẫn nhập chủ đề', done: hasIntro },
        { label: `Bố cục ≥ 3 đoạn (${paragraphs.length} đoạn)`, done: hasBodyParagraphs },
        { label: `Từ nối học thuật (${linkingMatches.length}/3+ từ)`, done: hasLinkingWords },
        { label: 'Kết bài (In conclusion...)', done: hasConclusion },
      ];
    }
  }, [currentText, activeTaskIndex, wordCount]);

  const activePhraseBank = activeTaskIndex === 0 ? TASK1_PHRASE_BANK : TASK2_PHRASE_BANK;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      {/* Official VSTEP Writing Paper Header Banner */}
      <div className="mb-6 rounded-3xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-[#F3E5FF] dark:bg-purple-950/60 border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] px-5 py-1.5 mb-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-[0.15em] text-[#8438C8] dark:text-purple-200 uppercase">
              WRITING
            </h2>
            <span
              className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                mode === 'exam'
                  ? 'bg-rose-600 text-white'
                  : 'bg-[#8438C8] text-white'
              }`}
            >
              {mode === 'exam' ? 'Chế độ Thi thử' : 'Chế độ Luyện tập'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-xs font-black text-[#4B4B4B] dark:text-slate-300">
            <span>Time allotted: 60 minutes</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Number of tasks: 2</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[#8438C8] dark:text-purple-300">
              Điểm Writing = (Task 1 + Task 2 × 2) / 3
            </span>
          </div>
        </div>

        {/* Per-Task Recommended Countdown Timer + Task Selector Tabs */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-center lg:items-end gap-2.5">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            {/* Independent Task 1 (20m) / Task 2 (40m) Countdown Timer */}
            {!isReviewMode && (
              <div
                className={`inline-flex items-center gap-2 rounded-2xl border-2 border-b-4 px-3.5 py-2 text-xs font-black tabular-nums transition-colors ${
                  currentTimerSeconds <= 180
                    ? 'border-rose-400 border-b-rose-600 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 animate-pulse'
                    : 'border-purple-200 border-b-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200'
                }`}
                title="Đồng hồ bấm giờ khuyến nghị riêng cho từng Task (Task 1: 20 phút, Task 2: 40 phút)"
              >
                <Clock className="h-4 w-4 text-[#A560E8]" />
                <span>
                  Giờ Task {task.partNumber}: {formatTaskTimer(currentTimerSeconds)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsTaskTimerRunning((prev) => !prev)}
                  className="p-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-slate-700 cursor-pointer"
                  title={isTaskTimerRunning ? 'Tạm dừng đồng hồ Task' : 'Tiếp tục đếm ngược'}
                >
                  {isTaskTimerRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={handleResetTaskTimer}
                  className="p-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 border border-purple-200 dark:border-slate-700 cursor-pointer"
                  title="Đặt lại đồng hồ Task này"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            )}

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
                      ? 'btn-duo-purple'
                      : 'btn-duo-white text-[#4B4B4B] dark:text-slate-200'
                  }`}
                >
                  <span>
                    Task {t.partNumber} ({t.partNumber === 1 ? '20 phút · ≥120 từ' : '40 phút · ≥250 từ'})
                  </span>
                  {meetsCriteria && (
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        activeTaskIndex === idx ? 'text-white' : 'text-[#58CC02]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#777777] dark:text-slate-400">
            <Info className="h-3.5 w-3.5 text-[#A560E8]" />
            <span>
              {mode === 'exam'
                ? 'Chế độ Thi thử chuẩn VSTEP: Đã ẩn bài mẫu & gợi ý cụm từ để đánh giá thực lực'
                : 'Chế độ Luyện tập: Hỗ trợ kiểm tra cấu trúc bài viết, kho cụm từ B1–C1 & bài viết mẫu'}
            </span>
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

          {/* Mandatory Content Points / Guidance (Visible in Practice & Review Mode) */}
          {(isReviewMode || mode === 'practice') &&
            task.bulletPoints &&
            task.bulletPoints.some((b) => b.trim().length > 0) && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Languages className="h-3.5 w-3.5 text-[#58CC02]" />
                    <span>Gợi ý triển khai ý (Checklist chấm điểm VSTEP):</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowPromptTips((prev) => !prev)}
                    className="text-[11px] font-black text-[#1CB0F6] hover:underline cursor-pointer"
                  >
                    {showPromptTips ? 'Thu gọn mẹo' : 'Mẹo phân bổ thời gian'}
                  </button>
                </div>
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

                {showPromptTips && (
                  <div className="mt-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3 text-[11px] text-sky-900 dark:text-sky-200 space-y-1">
                    <div className="font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">
                      Chiến thuật phân bổ {task.partNumber === 1 ? '20 phút (Task 1)' : '40 phút (Task 2)'}:
                    </div>
                    {task.partNumber === 1 ? (
                      <p className="leading-relaxed">
                        • <strong>3 phút đầu:</strong> Xác định người nhận, mức độ trang trọng (Formal/Informal) và 3 câu hỏi chính trong đề.<br />
                        • <strong>14 phút viết:</strong> Mỗi yêu cầu trong đề tách thành 1 đoạn ngắn (2–3 câu).<br />
                        • <strong>3 phút cuối:</strong> Kiểm tra lỗi chia thì, dấu phẩy sau lời chào và tổng số từ ≥ 120 từ.
                      </p>
                    ) : (
                      <p className="leading-relaxed">
                        • <strong>5 phút lập dàn ý:</strong> Chọn rõ quan điểm và 2 luận điểm chính kèm ví dụ thực tế.<br />
                        • <strong>30 phút viết bài:</strong> Chia 4 đoạn rõ ràng (Intro → Body 1 → Body 2 → Conclusion).<br />
                        • <strong>5 phút soát lỗi:</strong> Rà soát sự hòa hợp chủ ngữ - động từ, từ nối học thuật và đủ ≥ 250 từ.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* Sample Answer Toggle ONLY in Practice Mode & Review Mode */}
          {(isReviewMode || mode === 'practice') && task.sampleAnswer && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSampleAnswer((prev) => !prev)}
                className="w-full inline-flex items-center justify-between rounded-2xl border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] bg-[#F3E5FF]/60 dark:bg-purple-950/40 px-4 py-2.5 text-xs font-black text-[#8438C8] dark:text-purple-200 hover:bg-[#F3E5FF] active:border-b-2 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#A560E8]" />
                  <span>{showSampleAnswer ? 'Ẩn bài viết mẫu' : 'Xem bài viết mẫu chuẩn VSTEP B2–C1'}</span>
                </span>
                <span className="text-[11px] font-black text-[#8438C8] dark:text-purple-300 underline">
                  {showSampleAnswer ? 'Thu gọn' : 'Bấm để xem'}
                </span>
              </button>

              {showSampleAnswer && (
                <div className="rounded-2xl border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] bg-[#F3E5FF]/40 dark:bg-purple-950/60 p-4 text-xs text-slate-900 dark:text-purple-100 space-y-2 shadow-xs transition-all animate-fadeIn">
                  <div className="flex items-center justify-between font-black text-[#8438C8] dark:text-purple-300 uppercase tracking-wider text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#A560E8]" />
                      Bài viết mẫu chuẩn VSTEP (Sample Answer)
                    </span>
                    <span className="rounded-md bg-[#CE82FF]/30 px-2 py-0.5 text-[10px] font-mono text-[#8438C8]">
                      B2 – C1 Band
                    </span>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed font-medium bg-white/90 dark:bg-slate-900/70 p-3 rounded-xl border border-[#CE82FF]">
                    {task.sampleAnswer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Writing Editor, Live Structure Checklist & Phrase Bank */}
        <div className="lg:col-span-7 rounded-3xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between min-h-[480px]">
          <div className="space-y-4">
            {/* Header with Live Counter */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <PenTool className="h-4 w-4 text-[#A560E8]" />
                <span>Bài làm Writing Task {task.partNumber} của bạn</span>
              </span>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-xl px-3 py-1 font-mono text-xs font-black border-2 border-b-3 tabular-nums ${
                    wordCount >= task.minWords
                      ? 'bg-[#D7FFB8] text-[#2B6600] border-[#58CC02] border-b-[#46A302]'
                      : isUnder
                      ? 'bg-[#FFF4E5] text-[#E58700] border-[#FF9600] border-b-[#E58700]'
                      : 'bg-[#FFDFE0] text-[#EA2B2B] border-[#FF4B4B] border-b-[#EA2B2B]'
                  }`}
                >
                  {wordCount} / tối thiểu {task.minWords} từ
                </span>
              </div>
            </div>

            {/* Live VSTEP Structure Checklist (Practice & Review Mode) */}
            {(isReviewMode || mode === 'practice') && (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <CheckSquare className="h-3.5 w-3.5 text-[#58CC02]" />
                    <span>Kiểm tra cấu trúc bài viết VSTEP (Tự động):</span>
                  </span>
                  <span className="text-[#46A302] dark:text-[#58CC02] tabular-nums">
                    Đạt {structureChecks.filter((c) => c.done).length}/{structureChecks.length} tiêu chí
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {structureChecks.map((chk, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold border transition-all ${
                        chk.done
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <CheckCircle2
                        className={`h-3.5 w-3.5 shrink-0 ${
                          chk.done ? 'text-[#58CC02]' : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                      <span className="truncate" title={chk.label}>
                        {chk.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 1-Click Academic Phrase Bank (Practice Mode Only) */}
            {!isReviewMode && mode === 'practice' && (
              <div className="rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#8438C8] dark:text-purple-300 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-[#A560E8]" />
                    <span>Kho Cụm Từ Ăn Điểm B1–B2–C1 (Bấm 1 chạm để chèn vào bài)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPhraseBank((prev) => !prev)}
                    className="text-[11px] font-black text-[#8438C8] dark:text-purple-300 hover:underline cursor-pointer"
                  >
                    {showPhraseBank ? 'Thu gọn' : 'Mở kho cụm từ'}
                  </button>
                </div>

                {showPhraseBank && (
                  <div className="space-y-2 pt-1">
                    {activePhraseBank.map((cat, cIdx) => (
                      <div key={cIdx} className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-purple-200/70 dark:bg-purple-900 text-[#8438C8] dark:text-purple-200">
                            {cat.band}
                          </span>
                          <span>{cat.label}:</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.phrases.map((p, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => handleInsertPhrase(p.en)}
                              className="group inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-purple-100/70 dark:hover:bg-purple-900/50 border border-purple-200 dark:border-purple-800 px-2.5 py-1.5 text-left text-[11px] transition-all cursor-pointer shadow-2xs"
                              title={`Chèn mẫu câu: "${p.en.trim()}"`}
                            >
                              <PlusCircle className="h-3.5 w-3.5 text-[#A560E8] shrink-0 group-hover:scale-110 transition-transform" />
                              <div>
                                <span className="font-bold text-slate-800 dark:text-slate-100 block leading-snug">
                                  {p.en.trim().slice(0, 62)}
                                  {p.en.trim().length > 62 ? '...' : ''}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block">
                                  {p.vi}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
              className="w-full rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 p-4 font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-100 outline-hidden transition-all focus:border-[#CE82FF] focus:bg-white dark:focus:bg-slate-900 resize-none"
            />
          </div>

          {!isReviewMode && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {activeTaskIndex === 0 ? (
                <button
                  type="button"
                  onClick={() => setActiveTaskIndex(1)}
                  className="btn-duo-purple ml-auto inline-flex items-center gap-1.5 rounded-2xl px-5 py-3 text-xs font-black cursor-pointer"
                >
                  <span>Chuyển sang Writing Task 2</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center justify-between w-full gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTaskIndex(0)}
                    className="btn-duo-white rounded-2xl px-4 py-2.5 text-xs font-black cursor-pointer"
                  >
                    Quay lại Writing Task 1
                  </button>
                  <button
                    type="button"
                    onClick={onProceedToReview}
                    className="btn-duo-green inline-flex items-center gap-1.5 rounded-2xl px-6 py-3 text-xs font-black cursor-pointer"
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
