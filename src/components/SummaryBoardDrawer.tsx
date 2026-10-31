import React from 'react';
import { ChevronLeft, ChevronRight, Headphones, BookOpen, PenTool, Mic, CheckCircle2, X, Check, Save } from 'lucide-react';
import { Question } from '../types/exam';
import { WritingSubmission } from '../types/writing';
import { SpeakingSubmission } from '../types/speaking';

interface SummaryBoardDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  testTitle: string;
  activeQuestionId: number;
  activeSection?: 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING';
  activeWritingTaskIndex?: number;
  activeSpeakingPartIndex?: number;
  answers: Record<number, string>;
  flagged: Record<number, boolean>;
  writingSubmission?: WritingSubmission;
  speakingSubmission?: SpeakingSubmission;
  selectedParts?: string[]; // e.g. ['L1','L2','L3','R1','R2','R3','R4','W1','W2','S1','S2','S3']
  isPracticeMode?: boolean;
  questions?: Question[];
  onSelectQuestion: (questionId: number) => void;
  onSelectWritingTask?: (taskIndex: 0 | 1) => void;
  onSelectSpeakingPart?: (partIndex: 0 | 1 | 2) => void;
  onSubmitClick?: () => void;
  onSaveAndExitPractice?: () => void;
}

interface PartClusterConfig {
  code: string;
  partLabel: string;
  partNumber: 1 | 2 | 3 | 4;
  questionIds: number[];
  isOddCluster: boolean;
}

const LISTENING_CLUSTERS: PartClusterConfig[] = [
  {
    code: 'L1',
    partLabel: 'Listening Part 1 (Câu 1–8)',
    partNumber: 1,
    questionIds: [1, 2, 3, 4, 5, 6, 7, 8],
    isOddCluster: true,
  },
  {
    code: 'L2',
    partLabel: 'Listening Part 2 (Câu 9–20)',
    partNumber: 2,
    questionIds: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    isOddCluster: false,
  },
  {
    code: 'L3',
    partLabel: 'Listening Part 3 (Câu 21–35)',
    partNumber: 3,
    questionIds: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35],
    isOddCluster: true,
  },
];

const READING_CLUSTERS: PartClusterConfig[] = [
  {
    code: 'R1',
    partLabel: 'Reading Passage 1 (Câu 1–10)',
    partNumber: 1,
    questionIds: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45],
    isOddCluster: true,
  },
  {
    code: 'R2',
    partLabel: 'Reading Passage 2 (Câu 11–20)',
    partNumber: 2,
    questionIds: [46, 47, 48, 49, 50, 51, 52, 53, 54, 55],
    isOddCluster: false,
  },
  {
    code: 'R3',
    partLabel: 'Reading Passage 3 (Câu 21–30)',
    partNumber: 3,
    questionIds: [56, 57, 58, 59, 60, 61, 62, 63, 64, 65],
    isOddCluster: true,
  },
  {
    code: 'R4',
    partLabel: 'Reading Passage 4 (Câu 31–40)',
    partNumber: 4,
    questionIds: [66, 67, 68, 69, 70, 71, 72, 73, 74, 75],
    isOddCluster: false,
  },
];

export const SummaryBoardDrawer: React.FC<SummaryBoardDrawerProps> = ({
  isOpen,
  onToggle,
  testTitle,
  activeQuestionId,
  activeSection = 'LISTENING',
  activeWritingTaskIndex = 0,
  activeSpeakingPartIndex = 0,
  answers,
  flagged,
  writingSubmission,
  speakingSubmission,
  selectedParts,
  isPracticeMode = false,
  questions = [],
  onSelectQuestion,
  onSelectWritingTask,
  onSelectSpeakingPart,
  onSubmitClick,
  onSaveAndExitPractice,
}) => {
  const isPartEnabled = (code: string) => {
    if (!selectedParts || selectedParts.length === 0) return true;
    return selectedParts.includes(code);
  };

  const activeListeningClusters = LISTENING_CLUSTERS.filter((c) => isPartEnabled(c.code));
  const activeReadingClusters = READING_CLUSTERS.filter((c) => isPartEnabled(c.code));
  const showWritingPart1 = isPartEnabled('W1');
  const showWritingPart2 = isPartEnabled('W2');
  const showSpeakingPart1 = isPartEnabled('S1');
  const showSpeakingPart2 = isPartEnabled('S2');
  const showSpeakingPart3 = isPartEnabled('S3');

  const isAnswered = (qId: number) => {
    const val = answers[qId];
    return val !== undefined && val.trim().length > 0;
  };

  // Render question circle with relative number (1..N) and unified section color palette
  const renderClusterQuestionCircle = (
    qId: number,
    relativeNum: number,
    section: 'LISTENING' | 'READING'
  ) => {
    const answered = isAnswered(qId);
    const isCurrent =
      activeSection !== 'WRITING' &&
      activeSection !== 'SPEAKING' &&
      activeQuestionId === qId;
    const isFlagged = !!flagged[qId];

    const targetQ = questions.find((q) => q.id === qId);
    const isCorrect =
      targetQ && answered
        ? (() => {
            const userVal = (answers[qId] || '').trim().toLowerCase();
            if (!userVal) return false;
            if (Array.isArray(targetQ.correctAnswer)) {
              return targetQ.correctAnswer.some(
                (ans) => userVal === ans.trim().toLowerCase()
              );
            }
            return userVal === (targetQ.correctAnswer || '').trim().toLowerCase();
          })()
        : false;

    // Status Styling
    let colorClasses = '';
    if (isPracticeMode && answered && targetQ) {
      if (isCorrect) {
        colorClasses =
          'bg-emerald-600 text-white border-2 border-emerald-300 dark:border-emerald-400/60 font-black shadow-xs hover:bg-emerald-700';
      } else {
        colorClasses =
          'bg-rose-600 text-white border-2 border-rose-300 dark:border-rose-400/60 font-black shadow-xs hover:bg-rose-700';
      }
    } else if (answered) {
      colorClasses =
        section === 'LISTENING'
          ? 'bg-[#58CC02] text-white border-[#46A302] shadow-xs hover:bg-[#46A302]'
          : 'bg-[#2E7D32] text-white border-[#1B5E20] shadow-xs hover:bg-[#1B5E20]';
    } else {
      colorClasses =
        section === 'LISTENING'
          ? 'bg-lime-50/80 dark:bg-slate-800 text-lime-950 dark:text-lime-200 border-2 border-[#84CC16] dark:border-lime-600/70 hover:bg-lime-100 dark:hover:bg-slate-700'
          : 'bg-emerald-50/80 dark:bg-slate-800 text-emerald-950 dark:text-emerald-200 border-2 border-[#2E7D32]/60 dark:border-emerald-600/70 hover:bg-emerald-100 dark:hover:bg-slate-700';
    }

    const activeGlowClasses = isCurrent
      ? 'ring-4 ring-amber-400 ring-offset-2 dark:ring-offset-slate-900 scale-110 z-10 font-black shadow-md'
      : 'font-bold';

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
        key={qId}
        type="button"
        onClick={() => onSelectQuestion(qId)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-xs transition-all cursor-pointer ${colorClasses} ${activeGlowClasses}`}
        title={`Câu ${relativeNum} (${statusText})${isFlagged ? ' - Đã đánh dấu' : ''}`}
      >
        <span className="flex items-center justify-center gap-0.5">
          <span>{relativeNum}</span>
          {isPracticeMode && answered && targetQ && (
            <span className="text-[10px] leading-none opacity-90 font-mono">
              {isCorrect ? '✓' : '✗'}
            </span>
          )}
        </span>
        {isFlagged && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>
    );
  };

  const renderPartCluster = (cluster: PartClusterConfig) => {
    const isListening = cluster.code.startsWith('L');
    const section: 'LISTENING' | 'READING' = isListening ? 'LISTENING' : 'READING';
    const answeredInCluster = cluster.questionIds.filter(isAnswered).length;
    const isClusterActive =
      activeSection !== 'WRITING' && cluster.questionIds.includes(activeQuestionId);

    const headerBannerClass = isListening
      ? 'bg-[#58CC02] text-white shadow-2xs'
      : 'bg-[#2E7D32] text-white shadow-2xs';

    return (
      <div
        key={cluster.code}
        className={`rounded-2xl border p-3 transition-all ${
          isClusterActive
            ? 'border-amber-400 bg-amber-50/30 dark:bg-amber-950/25 shadow-xs ring-1 ring-amber-300 dark:ring-amber-500/50'
            : isListening
            ? 'border-lime-200 dark:border-slate-700 bg-white dark:bg-slate-800/80'
            : 'border-emerald-200 dark:border-slate-700 bg-white dark:bg-slate-800/80'
        }`}
      >
        <div
          className={`mb-2.5 flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-black ${headerBannerClass}`}
        >
          <span className="flex items-center gap-1.5">
            <span>{cluster.partLabel}</span>
            {isClusterActive && (
              <span className="h-2 w-2 rounded-full bg-amber-300 animate-ping" />
            )}
          </span>
          <span className="font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded-md">
            {answeredInCluster}/{cluster.questionIds.length}
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
          {cluster.questionIds.map((qId) =>
            renderClusterQuestionCircle(qId, qId <= 35 ? qId : qId - 35, section)
          )}
        </div>
      </div>
    );
  };

  const allActiveObjectiveIds = [
    ...activeListeningClusters.flatMap((c) => c.questionIds),
    ...activeReadingClusters.flatMap((c) => c.questionIds),
  ];

  const task1Done = (writingSubmission?.task1WordCount || 0) > 0;
  const task2Done = (writingSubmission?.task2WordCount || 0) > 0;
  const speaking1Done =
    (speakingSubmission?.part1WordCount || 0) > 0 ||
    Boolean(speakingSubmission?.part1AudioUrl || speakingSubmission?.part1AudioDataUrl);
  const speaking2Done =
    (speakingSubmission?.part2WordCount || 0) > 0 ||
    Boolean(speakingSubmission?.part2AudioUrl || speakingSubmission?.part2AudioDataUrl);
  const speaking3Done =
    (speakingSubmission?.part3WordCount || 0) > 0 ||
    Boolean(speakingSubmission?.part3AudioUrl || speakingSubmission?.part3AudioDataUrl);

  return (
    <>
      {/* Optional subtle backdrop when open so clicking outside also closes cleanly on smaller screens */}
      {isOpen && (
        <div
          onClick={onToggle}
          className="fixed inset-0 z-40 bg-slate-900/20 dark:bg-black/40 backdrop-blur-[1px] sm:bg-transparent sm:backdrop-blur-none"
          aria-hidden="true"
        />
      )}

      {/* Floating Vertical Tab */}
      <div
        className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ${
          isOpen ? 'right-80 sm:right-88' : 'right-0'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 rounded-l-2xl bg-[#2E7D32] dark:bg-emerald-700 py-4 px-2 text-white shadow-lg hover:bg-[#1B5E20] dark:hover:bg-emerald-600 active:scale-95 transition-all cursor-pointer border-y-2 border-l-2 border-white/20 dark:border-slate-700"
          title="Mở / Đóng Bảng Tổng Quan (Summary Board)"
        >
          {isOpen ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-black tracking-widest uppercase">
                BẢNG TỔNG QUAN
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Drawer Panel with PeopleCert Hierarchy (z-50 & top-0 so ExamHeader never clips the top header) */}
      <div
        className={`fixed top-0 bottom-14 right-0 z-50 w-80 sm:w-88 bg-white dark:bg-slate-900 border-l-2 border-slate-200 dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sticky Top Header inside Drawer — 100% visible, never covered */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#16A34A] dark:text-[#58CC02]">
                VSTEP B1-B2-C1 Exam Navigator
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight mt-0.5">
                Bảng Tổng Quan Bài Thi VSTEP
              </h3>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {testTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-xl p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer shrink-0"
              title="Thu gọn bảng tổng quan"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Top Action Bar inside Summary Board Drawer: Submit & Save for Later */}
          {(onSubmitClick || (isPracticeMode && onSaveAndExitPractice)) && (
            <div className="flex items-center gap-2 pt-0.5">
              {onSubmitClick && (
                <button
                  type="button"
                  onClick={() => {
                    onToggle();
                    onSubmitClick();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#58CC02] hover:bg-[#46a302] text-white px-3 py-2 text-xs font-black shadow-md border-b-3 border-[#3c8c02] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Nộp bài</span>
                </button>
              )}

              {isPracticeMode && onSaveAndExitPractice && (
                <button
                  type="button"
                  onClick={() => {
                    onToggle();
                    onSaveAndExitPractice();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs font-black transition-all cursor-pointer whitespace-nowrap"
                  title="Sao lưu tiến trình và thoát ra để lần sau làm tiếp"
                >
                  <Save className="h-3.5 w-3.5 shrink-0" />
                  <span>Lưu làm tiếp</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">

          {/* 1. MAJOR SECTION: LISTENING */}
          {activeListeningClusters.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  <Headphones className="h-4 w-4 text-[#2E7D32] dark:text-[#58CC02]" />
                  <span>Listening</span>
                </h4>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {
                    activeListeningClusters
                      .flatMap((c) => c.questionIds)
                      .filter(isAnswered).length
                  }
                  /{activeListeningClusters.flatMap((c) => c.questionIds).length} câu
                </span>
              </div>
              <div className="space-y-2.5">
                {activeListeningClusters.map(renderPartCluster)}
              </div>
            </div>
          )}

          {/* 2. MAJOR SECTION: READING */}
          {activeReadingClusters.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  <BookOpen className="h-4 w-4 text-[#65A30D] dark:text-lime-400" />
                  <span>Reading</span>
                </h4>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {
                    activeReadingClusters
                      .flatMap((c) => c.questionIds)
                      .filter(isAnswered).length
                  }
                  /{activeReadingClusters.flatMap((c) => c.questionIds).length} câu
                </span>
              </div>
              <div className="space-y-2.5">
                {activeReadingClusters.map(renderPartCluster)}
              </div>
            </div>
          )}

          {/* 3. MAJOR SECTION: WRITING */}
          {(showWritingPart1 || showWritingPart2) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  <PenTool className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Writing</span>
                </h4>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {(task1Done ? 1 : 0) + (task2Done ? 1 : 0)}/
                  {(showWritingPart1 ? 1 : 0) + (showWritingPart2 ? 1 : 0)} bài
                </span>
              </div>

              <div className="space-y-2">
                {showWritingPart1 && (
                  <button
                    type="button"
                    onClick={() => onSelectWritingTask && onSelectWritingTask(0)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-black transition-all cursor-pointer border-2 ${
                      activeSection === 'WRITING' && activeWritingTaskIndex === 0
                        ? 'bg-[#65A30D] text-white border-[#4D7C0F] ring-4 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900 shadow-md scale-[1.01]'
                        : task1Done
                        ? 'bg-[#65A30D] text-white border-[#4D7C0F]'
                        : 'bg-lime-50/60 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-lime-300 dark:border-slate-700 hover:border-[#65A30D] dark:hover:border-lime-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 dark:bg-black/25 text-[11px] font-mono">
                        1
                      </span>
                      <span>Writing Task 1 (Thư/Email)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-85">
                        {writingSubmission?.task1WordCount || 0} từ
                      </span>
                      {task1Done && <CheckCircle2 className="h-4 w-4 text-lime-300" />}
                    </div>
                  </button>
                )}

                {showWritingPart2 && (
                  <button
                    type="button"
                    onClick={() => onSelectWritingTask && onSelectWritingTask(1)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-black transition-all cursor-pointer border-2 ${
                      activeSection === 'WRITING' && activeWritingTaskIndex === 1
                        ? 'bg-[#65A30D] text-white border-[#4D7C0F] ring-4 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900 shadow-md scale-[1.01]'
                        : task2Done
                        ? 'bg-[#65A30D] text-white border-[#4D7C0F]'
                        : 'bg-lime-50/60 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-lime-300 dark:border-slate-700 hover:border-[#65A30D] dark:hover:border-lime-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 dark:bg-black/25 text-[11px] font-mono">
                        2
                      </span>
                      <span>Writing Task 2 (Luận Essay)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-85">
                        {writingSubmission?.task2WordCount || 0} từ
                      </span>
                      {task2Done && <CheckCircle2 className="h-4 w-4 text-lime-200" />}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. MAJOR SECTION: SPEAKING */}
          {(showSpeakingPart1 || showSpeakingPart2 || showSpeakingPart3) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  <Mic className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span>Speaking</span>
                </h4>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {(speaking1Done ? 1 : 0) + (speaking2Done ? 1 : 0) + (speaking3Done ? 1 : 0)}/
                  {(showSpeakingPart1 ? 1 : 0) + (showSpeakingPart2 ? 1 : 0) + (showSpeakingPart3 ? 1 : 0)} phần
                </span>
              </div>

              <div className="space-y-2">
                {showSpeakingPart1 && (
                  <button
                    type="button"
                    onClick={() => onSelectSpeakingPart && onSelectSpeakingPart(0)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-black transition-all cursor-pointer border-2 ${
                      activeSection === 'SPEAKING' && activeSpeakingPartIndex === 0
                        ? 'bg-[#0D9488] text-white border-[#0F766E] ring-4 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900 shadow-md scale-[1.01]'
                        : speaking1Done
                        ? 'bg-[#0D9488] text-white border-[#0F766E]'
                        : 'bg-teal-50/60 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-teal-300 dark:border-slate-700 hover:border-[#0D9488] dark:hover:border-teal-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 dark:bg-black/25 text-[11px] font-mono">
                        1
                      </span>
                      <span>Speaking Part 1 (Social Interaction)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-85">
                        {speakingSubmission?.part1AudioDataUrl
                          ? 'Ghi âm + '
                          : ''}
                        {speakingSubmission?.part1WordCount || 0} từ
                      </span>
                      {speaking1Done && <CheckCircle2 className="h-4 w-4 text-teal-200" />}
                    </div>
                  </button>
                )}

                {showSpeakingPart2 && (
                  <button
                    type="button"
                    onClick={() => onSelectSpeakingPart && onSelectSpeakingPart(1)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-black transition-all cursor-pointer border-2 ${
                      activeSection === 'SPEAKING' && activeSpeakingPartIndex === 1
                        ? 'bg-[#0D9488] text-white border-[#0F766E] ring-4 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900 shadow-md scale-[1.01]'
                        : speaking2Done
                        ? 'bg-[#0D9488] text-white border-[#0F766E]'
                        : 'bg-teal-50/60 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-teal-300 dark:border-slate-700 hover:border-[#0D9488] dark:hover:border-teal-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 dark:bg-black/25 text-[11px] font-mono">
                        2
                      </span>
                      <span>Speaking Part 2 (Solution Discussion)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-85">
                        {speakingSubmission?.part2AudioDataUrl
                          ? 'Ghi âm + '
                          : ''}
                        {speakingSubmission?.part2WordCount || 0} từ
                      </span>
                      {speaking2Done && <CheckCircle2 className="h-4 w-4 text-teal-200" />}
                    </div>
                  </button>
                )}

                {showSpeakingPart3 && (
                  <button
                    type="button"
                    onClick={() => onSelectSpeakingPart && onSelectSpeakingPart(2)}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-black transition-all cursor-pointer border-2 ${
                      activeSection === 'SPEAKING' && activeSpeakingPartIndex === 2
                        ? 'bg-[#0D9488] text-white border-[#0F766E] ring-4 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900 shadow-md scale-[1.01]'
                        : speaking3Done
                        ? 'bg-[#0D9488] text-white border-[#0F766E]'
                        : 'bg-teal-50/60 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-teal-300 dark:border-slate-700 hover:border-[#0D9488] dark:hover:border-teal-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/20 dark:bg-black/25 text-[11px] font-mono">
                        3
                      </span>
                      <span>Speaking Part 3 (Topic Development)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-85">
                        {speakingSubmission?.part3AudioDataUrl
                          ? 'Ghi âm + '
                          : ''}
                        {speakingSubmission?.part3WordCount || 0} từ
                      </span>
                      {speaking3Done && <CheckCircle2 className="h-4 w-4 text-teal-200" />}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3.5 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <div className="font-black text-slate-800 dark:text-slate-100 uppercase text-[10px] tracking-wider mb-1">
              Chú giải màu sắc theo 4 kỹ năng VSTEP
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#58CC02]" />
                <span>Listening Part 1–3 (35 câu)</span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {activeListeningClusters.flatMap((c) => c.questionIds).filter(isAnswered).length}/
                {activeListeningClusters.flatMap((c) => c.questionIds).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#2E7D32]" />
                <span>Reading Passage 1–4 (40 câu)</span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {activeReadingClusters.flatMap((c) => c.questionIds).filter(isAnswered).length}/
                {activeReadingClusters.flatMap((c) => c.questionIds).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#65A30D]" />
                <span>Writing Task 1–2 (2 bài viết)</span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {(task1Done ? 1 : 0) + (task2Done ? 1 : 0)}/2
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#0D9488]" />
                <span>Speaking Part 1–3 (3 phần nói)</span>
              </div>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {(speaking1Done ? 1 : 0) + (speaking2Done ? 1 : 0) + (speaking3Done ? 1 : 0)}/3
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative h-4 w-4 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500" />
                </div>
                <span>Đánh dấu xem lại (Flagged)</span>
              </div>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                {Object.values(flagged).filter(Boolean).length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-md border-2 border-amber-400 bg-white dark:bg-slate-800 ring-2 ring-amber-300 dark:ring-amber-500/60" />
              <span>Đang chọn (Hiện viền sáng vàng)</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
