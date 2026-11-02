import React, { useState } from 'react';
import { Headphones, Play, Sparkles, BookOpen } from 'lucide-react';
import { TestMetadata, ExamSection } from '../../types/exam';

interface ListeningPracticeViewProps {
  tests: TestMetadata[];
  onStartTest: (testId: string, initialSection?: ExamSection, initialPart?: 1 | 2 | 3 | 4) => void;
  onSelectMode: (mode: 'exam' | 'practice') => void;
  onOpenTranscriptModal: (transcript: string, highlight?: string, title?: string) => void;
}

export const ListeningPracticeView: React.FC<ListeningPracticeViewProps> = ({
  tests,
  onStartTest,
  onSelectMode,
}) => {
  const [selectedPart, setSelectedPart] = useState<number>(0); // 0 = all
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0]?.id || 'test-1');

  const listeningParts: Array<{
    part: 1 | 2 | 3;
    title: string;
    range: string;
    desc: string;
    tip: string;
  }> = [
    {
      part: 1,
      title: 'Part 1: 8 Thông báo & Hướng dẫn ngắn',
      range: 'Câu 1 – 8 (8 câu)',
      desc: 'Nghe 8 đoạn thông báo hoặc chỉ dẫn ngắn và chọn đáp án A, B, C hoặc D.',
      tip: 'Chú ý từ khóa chỉ địa điểm, thời gian, sự thay đổi lịch trình và đối tượng tiếp nhận thông báo.',
    },
    {
      part: 2,
      title: 'Part 2: 3 Đoạn hội thoại',
      range: 'Câu 9 – 20 (12 câu)',
      desc: 'Nghe 3 cuộc hội thoại tự nhiên (mỗi đoạn 4 câu hỏi trắc nghiệm A, B, C, D).',
      tip: 'Xác định mối quan hệ giữa 2 người nói, mục đích thảo luận và quyết định cuối cùng.',
    },
    {
      part: 3,
      title: 'Part 3: 3 Bài thuyết trình / Bài giảng học thuật',
      range: 'Câu 21 – 35 (15 câu)',
      desc: 'Nghe 3 bài giảng hoặc bài nói chuyện chuyên đề (mỗi bài 5 câu hỏi A, B, C, D).',
      tip: 'Nắm chắc ý chính của bài giảng, luận điểm của diễn giả và các ví dụ minh họa cụ thể.',
    },
  ];

  const handleStartPractice = (testId: string, part?: 1 | 2 | 3 | 4) => {
    onSelectMode('practice');
    onStartTest(testId, 'LISTENING', part || 1);
  };

  const handleStartExam = (testId: string, part?: 1 | 2 | 3 | 4) => {
    onSelectMode('exam');
    onStartTest(testId, 'LISTENING', part || 1);
  };

  const activeTestObj = tests.find((t) => t.id === selectedTestId) || tests[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-black text-xs mb-2 backdrop-blur-xs">
            <Headphones className="h-3.5 w-3.5" />
            <span>KỸ NĂNG NGHE VSTEP (B1–B2–C1)</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Luyện Nghe Chuyên Sâu Theo Part
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
            Tổng cộng 35 câu hỏi chuẩn VSTEP (Part 1–3). Hỗ trợ chỉnh tốc độ audio 0.1x, tua ±5s, xem script và bấm dẫn chứng tự động highlight.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartPractice(selectedTestId, 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-blue-600 hover:bg-blue-50 text-xs font-black shadow-md border-b-2 border-slate-200 transition-all cursor-pointer"
          >
            <Play className="h-4 w-4 fill-blue-600" />
            <span>Luyện nghe {activeTestObj?.title || 'Đề 1'}</span>
          </button>
        </div>
      </div>

      {/* Test Selector & Part Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            Chọn bộ đề luyện nghe:
          </span>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white outline-hidden focus:border-blue-500 cursor-pointer"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} {t.isCustom ? '(Đề giáo viên / AI)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Part Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedPart(0)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedPart === 0
                ? 'bg-[#58CC02] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            Tất cả (Part 1 - 3)
          </button>
          {listeningParts.map((p) => (
            <button
              key={p.part}
              type="button"
              onClick={() => setSelectedPart(p.part)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedPart === p.part
                  ? 'bg-[#58CC02] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Part {p.part}
            </button>
          ))}
        </div>
      </div>

      {/* Parts Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listeningParts
          .filter((p) => selectedPart === 0 || p.part === selectedPart)
          .map((item) => (
            <div
              key={item.part}
              className="rounded-3xl bg-white dark:bg-slate-800/80 p-5 border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg">
                    {item.range}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {activeTestObj?.title}
                  </span>
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  {item.desc}
                </p>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-100 dark:border-slate-700 mb-4">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>Mẹo làm bài B1:</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {item.tip}
                  </div>
                </div>
              </div>

              {/* Start Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleStartPractice(selectedTestId, item.part)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-[#58CC02] hover:bg-[#46a302] text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                >
                  <Play className="h-3 w-3 fill-white" />
                  <span>Luyện Part {item.part}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartExam(selectedTestId, item.part)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>Thi thử Part {item.part}</span>
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
