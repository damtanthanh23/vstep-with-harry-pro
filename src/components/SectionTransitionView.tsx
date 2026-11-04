import React from 'react';
import { FileText, Headphones, PenTool, Mic, ArrowRight } from 'lucide-react';
import { ExamSection } from '../types/exam';

interface SectionTransitionViewProps {
  section: ExamSection;
  onProceed: () => void;
}

export const SectionTransitionView: React.FC<SectionTransitionViewProps> = ({
  section,
  onProceed,
}) => {
  const isListening = section === 'LISTENING';
  const isWriting = section === 'WRITING';
  const isSpeaking = section === 'SPEAKING';

  const getSectionTitle = () => {
    if (isListening) return 'SKILL 1: LISTENING (35 QUESTIONS · 40 MINUTES)';
    if (isWriting) return 'SKILL 3: WRITING (2 TASKS · 60 MINUTES)';
    if (isSpeaking) return 'SKILL 4: SPEAKING (3 PARTS · 12 MINUTES)';
    return 'SKILL 2: READING (4 PASSAGES · 40 QUESTIONS · 60 MINUTES)';
  };

  const getSectionSubtitle = () => {
    if (isListening) {
      return 'Part 1: 8 Short Announcements (Q1–8) · Part 2: 3 Conversations (Q9–20) · Part 3: 3 Talks/Lectures (Q21–35)';
    }
    if (isWriting) {
      return 'Task 1: Letter / Email Writing (≥ 120 words, weight 1/3) · Task 2: Essay Writing (≥ 250 words, weight 2/3)';
    }
    if (isSpeaking) {
      return "Part 1: Social Interaction (3') · Part 2: Solution Discussion (4') · Part 3: Topic Development & Mind-map (5')";
    }
    return '4 Academic Reading Passages (Passage 1–4) · 10 Multiple-Choice Questions (A, B, C, D) per Passage';
  };

  const getButtonText = () => {
    if (isListening) return 'Bắt đầu phần thi Nghe (Listening)';
    if (isWriting) return 'Bắt đầu phần thi Viết (Writing)';
    if (isSpeaking) return 'Bắt đầu phần thi Nói (Speaking)';
    return 'Bắt đầu phần thi Đọc (Reading)';
  };

  const outerRingClass = isListening
    ? 'bg-[#DDF4FF] ring-[#1CB0F6]/25'
    : isWriting
    ? 'bg-[#F3E5FF] ring-[#CE82FF]/25'
    : isSpeaking
    ? 'bg-[#FFDFE0] ring-[#FF4B4B]/25'
    : 'bg-[#D7FFB8] ring-[#58CC02]/25';

  const innerCircleClass = isListening
    ? 'bg-[#1CB0F6] border-2 border-[#1899D6] border-b-6 border-b-[#0E74A5]'
    : isWriting
    ? 'bg-[#CE82FF] border-2 border-[#A560E8] border-b-6 border-b-[#8438C8]'
    : isSpeaking
    ? 'bg-[#FF4B4B] border-2 border-[#EA2B2B] border-b-6 border-b-[#C91D1D]'
    : 'bg-[#58CC02] border-2 border-[#46A302] border-b-6 border-b-[#2B6600]';

  const btnClass = isListening
    ? 'btn-duo-blue'
    : isWriting
    ? 'btn-duo-purple'
    : isSpeaking
    ? 'btn-duo-red'
    : 'btn-duo-green';

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center bg-[#F7F9FA] dark:bg-slate-950 px-6 py-12 text-center animate-in fade-in duration-300">
      <div className="card-duo max-w-2xl w-full p-8 sm:p-10 bg-white dark:bg-slate-900 flex flex-col items-center">
        <div
          className={`mb-6 flex h-36 w-36 items-center justify-center rounded-full ring-12 shadow-xs ${outerRingClass}`}
        >
          <div
            className={`flex h-24 w-24 items-center justify-center rounded-3xl text-white shadow-md ${innerCircleClass}`}
          >
            {isListening ? (
              <Headphones className="h-12 w-12 stroke-[2.2]" />
            ) : isWriting ? (
              <PenTool className="h-12 w-12 stroke-[2.2]" />
            ) : isSpeaking ? (
              <Mic className="h-12 w-12 stroke-[2.2]" />
            ) : (
              <FileText className="h-12 w-12 stroke-[2.2]" />
            )}
          </div>
        </div>

        <span className="mb-3 inline-flex items-center rounded-xl bg-[#D7FFB8] dark:bg-lime-900/50 border-2 border-[#58CC02] border-b-3 border-b-[#46A302] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#2B6600] dark:text-lime-300">
          VSTEP B1 - B2 - C1 Computer-Based Test
        </span>

        <h2 className="mb-3 text-2xl sm:text-3xl font-black tracking-tight text-[#3C3C3C] dark:text-white">
          {getSectionTitle()}
        </h2>

        <p className="mb-3 max-w-xl text-sm sm:text-base font-bold text-[#4B4B4B] dark:text-slate-300">
          {getSectionSubtitle()}
        </p>

        <p className="mb-8 text-xs sm:text-sm font-bold text-[#777777] dark:text-slate-400">
          Nhấn nút 3D bên dưới hoặc mũi tên{' '}
          <span className="font-black text-[#3C3C3C] dark:text-white">Tiếp theo (&rarr;)</span> ở góc dưới bên phải để bắt đầu làm bài.
        </p>

        <button
          type="button"
          onClick={onProceed}
          className={`${btnClass} inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-sm sm:text-base font-black cursor-pointer`}
        >
          <span>{getButtonText()}</span>
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
