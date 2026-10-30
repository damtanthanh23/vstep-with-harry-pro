import React, { useState } from 'react';
import { FileText, Play, Sparkles, Columns, BookOpen } from 'lucide-react';
import { TestMetadata, ExamSection } from '../../types/exam';

interface ReadingPracticeViewProps {
  tests: TestMetadata[];
  onStartTest: (testId: string, initialSection?: ExamSection, initialPart?: 1 | 2 | 3 | 4) => void;
  onSelectMode: (mode: 'exam' | 'practice') => void;
}

export const ReadingPracticeView: React.FC<ReadingPracticeViewProps> = ({
  tests,
  onStartTest,
  onSelectMode,
}) => {
  const [selectedPart, setSelectedPart] = useState<number>(0);
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0]?.id || 'test-1');

  const readingParts: Array<{
    part: 1 | 2 | 3 | 4;
    title: string;
    range: string;
    desc: string;
    tip: string;
    highlight?: boolean;
  }> = [
    {
      part: 1,
      title: 'Part 1: Biển báo & Tin nhắn ngắn',
      range: 'Câu 27 - 31 (5 câu)',
      desc: 'Đọc 5 văn bản ngắn thực tế (email, thông báo, biển chỉ dẫn) và chọn câu trả lời đúng (A, B hoặc C).',
      tip: 'Xác định mục đích thông báo (cho phép, cấm đoán, nhắc nhở hay cảnh báo).',
    },
    {
      part: 2,
      title: 'Part 2: Điền câu khuyết vào đoạn văn',
      range: 'Câu 32 - 37 (6 câu)',
      desc: 'Đọc một bài văn có 6 chỗ trống và chọn 6 câu phù hợp từ danh sách 7 câu (có 1 câu thừa).',
      tip: 'Chú ý liên từ nối (However, Therefore, In addition) và đại từ chỉ định (it, they, these).',
    },
    {
      part: 3,
      title: 'Part 3: Đối chiếu 4 đoạn văn (Split-view)',
      range: 'Câu 38 - 44 (7 câu)',
      desc: 'Đọc 4 bài văn ngắn (A, B, C, D) cùng chủ đề. Giao diện chia đôi màn hình độc lập giúp đối chiếu trực tiếp.',
      tip: 'Đọc kỹ câu hỏi để bắt từ khóa trước, sau đó scan nhanh trong 4 văn bản A, B, C, D.',
      highlight: true,
    },
    {
      part: 4,
      title: 'Part 4: Đọc hiểu văn bản dài',
      range: 'Câu 45 - 52 (8 câu)',
      desc: 'Đọc bài báo/bài viết chi tiết và trả lời câu hỏi bằng cách viết câu ngắn tối đa 3 từ.',
      tip: 'Chỉ trích xuất đúng thông tin trong bài đọc, không suy đoán ngoài bài.',
    },
  ];

  const handleStartPractice = (testId: string, part?: 1 | 2 | 3 | 4) => {
    onSelectMode('practice');
    onStartTest(testId, 'READING', part || 1);
  };

  const handleStartExam = (testId: string, part?: 1 | 2 | 3 | 4) => {
    onSelectMode('exam');
    onStartTest(testId, 'READING', part || 1);
  };

  const activeTestObj = tests.find((t) => t.id === selectedTestId) || tests[0];

  return (
    <div className="space-y-6 pb-20">
      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-black text-xs mb-2 backdrop-blur-xs">
            <FileText className="h-3.5 w-3.5" />
            <span>KỸ NĂNG ĐỌC LANGUAGECERT B1</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Luyện Đọc Hiểu Chuyên Sâu Theo Part
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-emerald-100 max-w-xl">
            Tổng cộng 26 câu hỏi chuẩn LanguageCert B1. Giao diện tối ưu chia đôi màn hình độc lập cho câu 38–44 và hỗ trợ dịch nghĩa song ngữ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartPractice(selectedTestId, 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-emerald-700 hover:bg-emerald-50 text-xs font-black shadow-md border-b-2 border-slate-200 transition-all cursor-pointer"
          >
            <Play className="h-4 w-4 fill-emerald-600" />
            <span>Luyện đọc {activeTestObj?.title || 'Đề 1'}</span>
          </button>
        </div>
      </div>

      {/* Test Selector & Part Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-800 p-3.5 border border-slate-200 dark:border-slate-700 shadow-2xs">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            Chọn bộ đề luyện đọc:
          </span>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white outline-hidden focus:border-emerald-500 cursor-pointer"
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
            Tất cả (Part 1 - 4)
          </button>
          {readingParts.map((p) => (
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
        {readingParts
          .filter((p) => selectedPart === 0 || p.part === selectedPart)
          .map((item) => (
            <div
              key={item.part}
              className={`rounded-3xl bg-white dark:bg-slate-800/80 p-5 border shadow-2xs hover:shadow-md transition-all flex flex-col justify-between ${
                item.highlight
                  ? 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-400/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-emerald-400'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg">
                    {item.range}
                  </span>
                  {item.highlight ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                      <Columns className="h-3 w-3" /> Chia đôi màn hình
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-semibold">
                      {activeTestObj?.title}
                    </span>
                  )}
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
