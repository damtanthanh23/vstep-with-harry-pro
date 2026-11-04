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

  // Render question circle with relative number (1..N) and Duolingo 3D section color palette
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

    // 3D Duolingo Tactile Styling
    let colorClasses = '';
    if (isPracticeMode && answered && targetQ) {
      if (isCorrect) {
        colorClasses =
          'bg-[#58CC02] text-white border-2 border-[#46A302] border-b-4 border-b-[#2B6600] font-black hover:bg-[#61E002]';
      } else {
        colorClasses =
          'bg-[#FF4B4B] text-white border-2 border-[#EA2B2B] border-b-4 border-b-[#C91D1D] font-black hover:bg-[#FF6262]';
      }
    } else if (answered) {
      colorClasses =
        section === 'LISTENING'
          ? 'bg-[#1CB0F6] text-white border-2 border-[#1899D6] border-b-4 border-b-[#0E74A5] font-black hover:bg-[#29B9FF]'
          : 'bg-[#58CC02] text-white border-2 border-[#46A302] border-b-4 border-b-[#2B6600] font-black hover:bg-[#61E002]';
    } else {
      colorClasses =
        section === 'LISTENING'
          ? 'bg-[#DDF4FF]/65 dark:bg-slate-800 text-[#0E74A5] dark:text-sky-200 border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] hover:bg-[#DDF4FF] font-black'
          : 'bg-[#D7FFB8]/65 dark:bg-slate-800 text-[#2B6600] dark:text-lime-200 border-2 border-[#58CC02] border-b-4 border-b-[#46A302] hover:bg-[#D7FFB8] font-black';
    }

    const activeGlowClasses = isCurrent
      ? 'ring-4 ring-[#FFC800] ring-offset-2 dark:ring-offset-slate-900 scale-105 z-10 font-black'
      : 'active:border-b-2 active:translate-y-0.5';

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
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#FF9600] ring-2 ring-white dark:ring-slate-900" />
        )}
      </button>
    );
  };

  const renderPartCluster = (cluster: PartClusterConfig) => {
    const isListening = cluster.code.startsWith('L');
    const section: 'LISTENING' | 'READING' = isListening ? 'LISTENING' : 'READING';
    const answeredInCluster = cluster.questionIds.filter(isAnswered).length;
    const isClusterActive =
      activeSection !== 'WRITING' &&
      activeSection !== 'SPEAKING' &&
      cluster.questionIds.includes(activeQuestionId);

    const headerBannerClass = isListening
      ? 'bg-[#1CB0F6] border-2 border-[#1899D6] border-b-3 border-b-[#0E74A5] text-white'
      : 'bg-[#58CC02] border-2 border-[#46A302] border-b-3 border-b-[#2B6600] text-white';

    return (
      <div
        key={cluster.code}
        className={`rounded-2xl border-2 border-b-4 p-3 transition-all ${
          isClusterActive
            ? 'border-[#FFC800] border-b-[#E58700] bg-amber-50/40 dark:bg-amber-950/25 shadow-xs'
            : isListening
            ? 'border-[#DDF4FF] border-b-[#BAE6FD] dark:border-slate-700 bg-white dark:bg-slate-800/80'
            : 'border-[#D7FFB8] border-b-[#B8F28B] dark:border-slate-700 bg-white dark:bg-slate-800/80'
        }`}
      >
        <div
          className={`mb-2.5 flex items-center justify-between rounded-xl px-3 py-1.5 text-xs font-black ${headerBannerClass}`}
        >
          <span className="flex items-center gap-1.5">
            <span>{cluster.partLabel}</span>
            {isClusterActive && (
              <span className="h-2 w-2 rounded-full bg-[#FFC800] animate-ping" />
            )}
          </span>
          <span className="font-mono text-[11px] bg-black/20 px-2 py-0.5 rounded-md">
            {answeredInCluster}/{cluster.questionIds.length}
          </span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
          {cluster.questionIds.map((qId) =>
            renderClusterQuestionCircle(qId, qId <= 35 ? qId : qId - 35, section)
          )}
        </div>
      </div>
    );
  };

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

  const renderSpeakingStatusLabel = (
    hasAudio: boolean,
    wordCount: number
  ) => {
    if (hasAudio && wordCount > 0) return `Đã thu · ${wordCount} từ`;
    if (hasAudio) return 'Đã thu âm';
    if (wordCount > 0) return `${wordCount} từ`;
    return 'Chưa thu';
  };

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

      {/* Floating Vertical Tab (3D Duolingo Green) */}
      <div
        className={`fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300 ${
          isOpen ? 'right-80 sm:right-88' : 'right-0'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1.5 rounded-l-2xl bg-[#58CC02] hover:bg-[#61E002] py-4 px-2.5 text-white shadow-lg border-y-2 border-l-2 border-[#46A302] border-b-4 border-b-[#2B6600] active:translate-y-0.5 transition-all cursor-pointer"
          title="Mở / Đóng Bảng Tổng Quan (Summary Board)"
        >
          {isOpen ? (
            <ChevronRight className="h-5 w-5 stroke-[3]" />
          ) : (
            <div className="flex flex-col items-center gap-2">
              <ChevronLeft className="h-4 w-4 stroke-[3]" />
              <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-black tracking-widest uppercase">
                BẢNG TỔNG QUAN
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Drawer Panel with Duolingo 3D Hierarchy */}
      <div
        className={`fixed top-0 bottom-14 right-0 z-50 w-80 sm:w-88 bg-white dark:bg-slate-900 border-l-2 border-[#E5E5E5] dark:border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Sticky Top Header inside Drawer */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b-2 border-[#E5E5E5] dark:border-slate-800 px-5 py-3.5 shrink-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="block text-[10px] font-black uppercase tracking-widest text-[#58CC02]">
                VSTEP B1-B2-C1 Exam Navigator
              </span>
              <h3 className="text-base font-black text-[#3C3C3C] dark:text-white leading-tight mt-0.5">
                Bảng Tổng Quan Bài Thi VSTEP
              </h3>
              <p className="text-xs font-bold text-[#777777] dark:text-slate-400 truncate mt-0.5">
                {testTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="btn-duo-white rounded-xl p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
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
                  className="btn-duo-green flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black cursor-pointer whitespace-nowrap"
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
                  className="btn-duo-white flex-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-[#46A302] cursor-pointer whitespace-nowrap"
                  title="Sao lưu tiến trình và thoát ra để lần sau làm tiếp"
                >
                  <Save className="h-3.5 w-3.5 shrink-0 text-[#58CC02]" />
                  <span>Lưu làm tiếp</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-6 flex-1 overflow-y-auto">
          {/* 1. MAJOR SECTION: LISTENING (Macaw Blue #1CB0F6) */}
          {activeListeningClusters.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#3C3C3C] dark:text-slate-200">
                  <Headphones className="h-4 w-4 text-[#1CB0F6]" />
                  <span>Listening</span>
                </h4>
                <span className="text-xs font-black text-[#1899D6] dark:text-sky-400">
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

          {/* 2. MAJOR SECTION: READING (Feather Green #58CC02) */}
          {activeReadingClusters.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#3C3C3C] dark:text-slate-200">
                  <BookOpen className="h-4 w-4 text-[#58CC02]" />
                  <span>Reading</span>
                </h4>
                <span className="text-xs font-black text-[#46A302] dark:text-lime-400">
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

          {/* 3. MAJOR SECTION: WRITING (Beetle Purple #CE82FF) */}
          {(showWritingPart1 || showWritingPart2) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#3C3C3C] dark:text-slate-200">
                  <PenTool className="h-4 w-4 text-[#A560E8]" />
                  <span>Writing</span>
                </h4>
                <span className="text-xs font-black text-[#A560E8]">
                  {(task1Done ? 1 : 0) + (task2Done ? 1 : 0)}/
                  {(showWritingPart1 ? 1 : 0) + (showWritingPart2 ? 1 : 0)} bài
                </span>
              </div>

              <div className="space-y-2.5">
                {showWritingPart1 && (
                  <button
                    type="button"
                    onClick={() => onSelectWritingTask && onSelectWritingTask(0)}
                    className={`w-full flex items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-black transition-all cursor-pointer border-2 border-b-4 active:border-b-2 active:translate-y-0.5 ${
                      activeSection === 'WRITING' && activeWritingTaskIndex === 0
                        ? 'bg-[#CE82FF] text-white border-[#A560E8] border-b-[#8438C8] ring-3 ring-[#FFC800] ring-offset-1 dark:ring-offset-slate-900 shadow-sm'
                        : task1Done
                        ? 'bg-[#CE82FF] text-white border-[#A560E8] border-b-[#8438C8]'
                        : 'bg-[#F3E5FF]/55 dark:bg-slate-800 text-[#3C3C3C] dark:text-slate-200 border-[#CE82FF] border-b-[#A560E8] hover:bg-[#F3E5FF]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-mono font-black ${
                          (activeSection === 'WRITING' && activeWritingTaskIndex === 0) || task1Done
                            ? 'bg-black/20 text-white'
                            : 'bg-white text-[#8438C8] border border-[#CE82FF]'
                        }`}
                      >
                        1
                      </span>
                      <span>Writing Task 1 (Thư/Email)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-90">
                        {writingSubmission?.task1WordCount || 0} từ
                      </span>
                      {task1Done && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                )}

                {showWritingPart2 && (
                  <button
                    type="button"
                    onClick={() => onSelectWritingTask && onSelectWritingTask(1)}
                    className={`w-full flex items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-black transition-all cursor-pointer border-2 border-b-4 active:border-b-2 active:translate-y-0.5 ${
                      activeSection === 'WRITING' && activeWritingTaskIndex === 1
                        ? 'bg-[#CE82FF] text-white border-[#A560E8] border-b-[#8438C8] ring-3 ring-[#FFC800] ring-offset-1 dark:ring-offset-slate-900 shadow-sm'
                        : task2Done
                        ? 'bg-[#CE82FF] text-white border-[#A560E8] border-b-[#8438C8]'
                        : 'bg-[#F3E5FF]/55 dark:bg-slate-800 text-[#3C3C3C] dark:text-slate-200 border-[#CE82FF] border-b-[#A560E8] hover:bg-[#F3E5FF]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-mono font-black ${
                          (activeSection === 'WRITING' && activeWritingTaskIndex === 1) || task2Done
                            ? 'bg-black/20 text-white'
                            : 'bg-white text-[#8438C8] border border-[#CE82FF]'
                        }`}
                      >
                        2
                      </span>
                      <span>Writing Task 2 (Luận Essay)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono opacity-90">
                        {writingSubmission?.task2WordCount || 0} từ
                      </span>
                      {task2Done && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 4. MAJOR SECTION: SPEAKING (Cardinal Red #FF4B4B) */}
          {(showSpeakingPart1 || showSpeakingPart2 || showSpeakingPart3) && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#3C3C3C] dark:text-slate-200">
                  <Mic className="h-4 w-4 text-[#FF4B4B]" />
                  <span>Speaking</span>
                </h4>
                <span className="text-xs font-black text-[#EA2B2B]">
                  {(speaking1Done ? 1 : 0) + (speaking2Done ? 1 : 0) + (speaking3Done ? 1 : 0)}/
                  {(showSpeakingPart1 ? 1 : 0) + (showSpeakingPart2 ? 1 : 0) + (showSpeakingPart3 ? 1 : 0)} phần
                </span>
              </div>

              <div className="space-y-2.5">
                {showSpeakingPart1 && (
                  <button
                    type="button"
                    onClick={() => onSelectSpeakingPart && onSelectSpeakingPart(0)}
                    className={`w-full flex items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-black transition-all cursor-pointer border-2 border-b-4 active:border-b-2 active:translate-y-0.5 ${
                      activeSection === 'SPEAKING' && activeSpeakingPartIndex === 0
                        ? 'bg-[#FF4B4B] text-white border-[#EA2B2B] border-b-[#C91D1D] ring-3 ring-[#FFC800] ring-offset-1 dark:ring-offset-slate-900 shadow-sm'
                        : speaking1Done
                        ? 'bg-[#FF4B4B] text-white border-[#EA2B2B] border-b-[#C91D1D]'
                        : 'bg-[#FFDFE0]/55 dark:bg-slate-800 text-[#3C3C3C] dark:text-slate-200 border-[#FF4B4B] border-b-[#EA2B2B] hover:bg-[#FFDFE0]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-left">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-mono font-black ${
                          (activeSection === 'SPEAKING' && activeSpeakingPartIndex === 0) || speaking1Done
                            ? 'bg-black/20 text-white'
                            : 'bg-white text-[#EA2B2B] border border-[#FF4B4B]'
                        }`}
                      >
                        1
                      </span>
                      <span>Speaking Part 1 (Social Interaction)</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono opacity-90">
                        {renderSpeakingStatusLabel(
                          Boolean(speakingSubmission?.part1AudioUrl || speakingSubmission?.part1AudioDataUrl),
                          speakingSubmission?.part1WordCount || 0
                        )}
                      </span>
                      {speaking1Done && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                )}

                {showSpeakingPart2 && (
                  <button
                    type="button"
                    onClick={() => onSelectSpeakingPart && onSelectSpeakingPart(1)}
                    className={`w-full flex items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-black transition-all cursor-pointer border-2 border-b-4 active:border-b-2 active:translate-y-0.5 ${
                      activeSection === 'SPEAKING' && activeSpeakingPartIndex === 1
                        ? 'bg-[#FF4B4B] text-white border-[#EA2B2B] border-b-[#C91D1D] ring-3 ring-[#FFC800] ring-offset-1 dark:ring-offset-slate-900 shadow-sm'
                        : speaking2Done
                        ? 'bg-[#FF4B4B] text-white border-[#EA2B2B] border-b-[#C91D1D]'
                        : 'bg-[#FFDFE0]/55 dark:bg-slate-800 text-[#3C3C3C] dark:text-slate-200 border-[#FF4B4B] border-b-[#EA2B2B] hover:bg-[#FFDFE0]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-left">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-mono font-black ${
                          (activeSection === 'SPEAKING' && activeSpeakingPartIndex === 1) || speaking2Done
                            ? 'bg-black/20 text-white'
                            : 'bg-white text-[#EA2B2B] border border-[#FF4B4B]'
                        }`}
                      >
                        2
                      </span>
                      <span>Speaking Part 2 (Solution Discussion)</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono opacity-90">
                        {renderSpeakingStatusLabel(
                          Boolean(speakingSubmission?.part2AudioUrl || speakingSubmission?.part2AudioDataUrl),
                          speakingSubmission?.part2WordCount || 0
                        )}
                      </span>
                      {speaking2Done && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                )}

                {showSpeakingPart3 && (
                  <button
                    type="button"
                    onClick={() => onSelectSpeakingPart && onSelectSpeakingPart(2)}
                    className={`w-full flex items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-black transition-all cursor-pointer border-2 border-b-4 active:border-b-2 active:translate-y-0.5 ${
                      activeSection === 'SPEAKING' && activeSpeakingPartIndex === 2
                        ? 'bg-[#FF4B4B] text-white border-[#EA2B2B] border-b-[#C91D1D] ring-3 ring-[#FFC800] ring-offset-1 dark:ring-offset-slate-900 shadow-sm'
                        : speaking3Done
                        ? 'bg-[#FF4B4B] text-white border-[#EA2B2B] border-b-[#C91D1D]'
                        : 'bg-[#FFDFE0]/55 dark:bg-slate-800 text-[#3C3C3C] dark:text-slate-200 border-[#FF4B4B] border-b-[#EA2B2B] hover:bg-[#FFDFE0]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-left">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-mono font-black ${
                          (activeSection === 'SPEAKING' && activeSpeakingPartIndex === 2) || speaking3Done
                            ? 'bg-black/20 text-white'
                            : 'bg-white text-[#EA2B2B] border border-[#FF4B4B]'
                        }`}
                      >
                        3
                      </span>
                      <span>Speaking Part 3 (Topic Development)</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-mono opacity-90">
                        {renderSpeakingStatusLabel(
                          Boolean(speakingSubmission?.part3AudioUrl || speakingSubmission?.part3AudioDataUrl),
                          speakingSubmission?.part3WordCount || 0
                        )}
                      </span>
                      {speaking3Done && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-3.5 border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-2">
            <div className="font-black text-[#3C3C3C] dark:text-slate-100 uppercase text-[10px] tracking-wider mb-1">
              Chú giải màu sắc theo 4 kỹ năng VSTEP
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#1CB0F6] border-b-2 border-[#1899D6]" />
                <span className="font-bold">Listening Part 1–3 (35 câu)</span>
              </div>
              <span className="font-black text-[#1899D6]">
                {activeListeningClusters.flatMap((c) => c.questionIds).filter(isAnswered).length}/
                {activeListeningClusters.flatMap((c) => c.questionIds).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#58CC02] border-b-2 border-[#46A302]" />
                <span className="font-bold">Reading Passage 1–4 (40 câu)</span>
              </div>
              <span className="font-black text-[#46A302]">
                {activeReadingClusters.flatMap((c) => c.questionIds).filter(isAnswered).length}/
                {activeReadingClusters.flatMap((c) => c.questionIds).length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#CE82FF] border-b-2 border-[#A560E8]" />
                <span className="font-bold">Writing Task 1–2 (2 bài viết)</span>
              </div>
              <span className="font-black text-[#A560E8]">
                {(task1Done ? 1 : 0) + (task2Done ? 1 : 0)}/2
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-md bg-[#FF4B4B] border-b-2 border-[#EA2B2B]" />
                <span className="font-bold">Speaking Part 1–3 (3 phần nói)</span>
              </div>
              <span className="font-black text-[#EA2B2B]">
                {(speaking1Done ? 1 : 0) + (speaking2Done ? 1 : 0) + (speaking3Done ? 1 : 0)}/3
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative h-4 w-4 rounded-md border-2 border-[#E5E5E5] bg-white dark:bg-slate-800">
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#FF9600]" />
                </div>
                <span className="font-bold">Đánh dấu xem lại (Flagged)</span>
              </div>
              <span className="font-black text-[#FF9600]">
                {Object.values(flagged).filter(Boolean).length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
