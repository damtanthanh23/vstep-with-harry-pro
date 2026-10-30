import React from 'react';
import { FileText, Headphones, PenTool, ArrowRight } from 'lucide-react';
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

  const getSectionTitle = () => {
    if (isListening) return 'SKILL 1: LISTENING (35 QUESTIONS · 40 MINUTES)';
    if (isWriting) return 'SKILL 3: WRITING (2 TASKS · 60 MINUTES)';
    return 'SKILL 2: READING (4 PASSAGES · 40 QUESTIONS · 60 MINUTES)';
  };

  const getSectionSubtitle = () => {
    if (isListening) {
      return 'Part 1: 8 Short Announcements (Q1–8) · Part 2: 3 Conversations (Q9–20) · Part 3: 3 Talks/Lectures (Q21–35)';
    }
    if (isWriting) {
      return 'Task 1: Letter / Email Writing (≥ 120 words, weight 1/3) · Task 2: Essay Writing (≥ 250 words, weight 2/3)';
    }
    return '4 Academic Reading Passages (Passage 1–4) · 10 Multiple-Choice Questions (A, B, C, D) per Passage';
  };

  const getButtonText = () => {
    if (isListening) return 'Bắt đầu phần thi Nghe (Listening)';
    if (isWriting) return 'Bắt đầu phần thi Viết (Writing)';
    return 'Bắt đầu phần thi Đọc (Reading)';
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col items-center justify-center bg-white dark:bg-slate-950 px-6 py-12 text-center animate-in fade-in duration-300">
      <div className="mb-6 flex h-36 w-36 items-center justify-center rounded-full bg-lime-50/90 dark:bg-lime-950/60 ring-12 ring-lime-100/80 dark:ring-lime-900/40 shadow-sm">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#58CC02] text-white shadow-lg">
          {isListening ? (
            <Headphones className="h-12 w-12 stroke-[2]" />
          ) : isWriting ? (
            <PenTool className="h-12 w-12 stroke-[2]" />
          ) : (
            <FileText className="h-12 w-12 stroke-[2]" />
          )}
        </div>
      </div>

      <span className="mb-2 inline-flex items-center rounded-full bg-lime-100 dark:bg-lime-900/50 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-lime-800 dark:text-lime-300">
        VSTEP B1 - B2 - C1 Computer-Based Test
      </span>

      <h2 className="mb-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
        {getSectionTitle()}
      </h2>

      <p className="mb-3 max-w-2xl text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300">
        {getSectionSubtitle()}
      </p>

      <p className="mb-8 text-sm font-medium text-slate-500 dark:text-slate-400">
        Nhấn nút bên dưới hoặc mũi tên <span className="font-bold text-slate-800 dark:text-white">Tiếp theo (&rarr;)</span> ở góc dưới bên phải để bắt đầu làm bài.
      </p>

      <button
        type="button"
        onClick={onProceed}
        className="inline-flex items-center gap-2.5 rounded-2xl bg-[#58CC02] hover:bg-[#46a302] px-8 py-4 text-sm sm:text-base font-black text-white shadow-md border-b-4 border-[#3c8c02] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
      >
        <span>{getButtonText()}</span>
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
};

