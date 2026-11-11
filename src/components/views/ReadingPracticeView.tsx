import React, { useState, useMemo } from 'react';
import {
  FileText,
  Play,
  Sparkles,
  Columns,
  BookOpen,
  Languages,
  Eye,
  BookmarkPlus,
} from 'lucide-react';
import { TestMetadata, ExamSection, Question } from '../../types/exam';
import { TEST_1_QUESTIONS } from '../../data/test1Data';
import { GlobalSelectionDictionaryPopover } from '../GlobalSelectionDictionaryPopover';

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
  const [previewPassageNum, setPreviewPassageNum] = useState<1 | 2 | 3 | 4>(1);
  const [showBilingualPreview, setShowBilingualPreview] = useState<boolean>(true);

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
      title: 'Passage 1: Đọc hiểu Đời sống & Xã hội',
      range: 'Câu 36 – 45 (10 câu)',
      desc: 'Đọc bài văn dài khoảng 400–500 từ về chủ đề đời sống hàng ngày, văn hóa, xã hội và chọn đáp án A, B, C, D.',
      tip: 'Đọc câu hỏi trước để xác định từ khóa, chú ý các câu hỏi tìm ý chính (Main idea) và từ vựng trong ngữ cảnh.',
      highlight: true,
    },
    {
      part: 2,
      title: 'Passage 2: Đọc hiểu Khoa học & Tự nhiên',
      range: 'Câu 46 – 55 (10 câu)',
      desc: 'Đọc bài báo khoa học thường thức, môi trường hoặc công nghệ và trả lời 10 câu hỏi trắc nghiệm A, B, C, D.',
      tip: 'Chú ý các câu hỏi đại từ quy chiếu (it, they, which) và câu hỏi chèn câu vào vị trí [A], [B], [C], [D].',
    },
    {
      part: 3,
      title: 'Passage 3: Đọc hiểu Giáo dục & Lịch sử',
      range: 'Câu 56 – 65 (10 câu)',
      desc: 'Đọc văn bản học thuật chuyên sâu hơn với giao diện chia đôi màn hình độc lập giúp đối chiếu đoạn văn nhanh chóng.',
      tip: 'Cẩn thận với các phương án bẫy (distractors) chứa từ giống bài đọc nhưng sai lệch quan hệ nhân quả.',
      highlight: true,
    },
    {
      part: 4,
      title: 'Passage 4: Đọc hiểu Học thuật & Nghiên cứu (B2–C1)',
      range: 'Câu 66 – 75 (10 câu)',
      desc: 'Đọc bài nghiên cứu học thuật nâng cao, kiểm tra kỹ năng suy luận (Inference), thái độ tác giả và mục đích đoạn văn.',
      tip: 'Phân bổ thời gian hợp lý (khoảng 15 phút/Passage) và dùng tính năng highlight dẫn chứng khi luyện tập.',
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

  const testQuestions: Question[] = useMemo(() => {
    if (activeTestObj?.questions && activeTestObj.questions.length > 0) {
      return activeTestObj.questions;
    }
    return TEST_1_QUESTIONS;
  }, [activeTestObj]);

  const activePassageSource = useMemo(() => {
    return testQuestions.find(
      (q) =>
        q.section === 'READING' &&
        q.partNumber === previewPassageNum &&
        q.readingArticle &&
        Array.isArray(q.readingArticle.paragraphs) &&
        q.readingArticle.paragraphs.length > 0
    );
  }, [testQuestions, previewPassageNum]);

  return (
    <div className="space-y-6 pb-20">
      <GlobalSelectionDictionaryPopover
        sourceLabel={`Luyện Đọc · Passage ${previewPassageNum}`}
        testId={selectedTestId}
        testTitle={activeTestObj?.title}
      />

      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#58CC02] to-[#3C8C02] border-2 border-[#46A302] border-b-4 border-b-[#2B6600] p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-white font-black text-xs mb-2">
            <FileText className="h-3.5 w-3.5" />
            <span>KỸ NĂNG ĐỌC VSTEP · B1 – B2 – C1</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Luyện Đọc Hiểu Chuyên Sâu Theo Passage
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-lime-100 max-w-xl">
            Tổng cộng 40 câu hỏi chuẩn VSTEP (4 Passages · 60 phút). Bôi đen bất kỳ từ hoặc cụm từ nào trong bài đọc để tra từ điển ngữ cảnh và lưu thẳng vào kho Flashcard SRS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartPractice(selectedTestId, 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#2B6600] hover:bg-lime-50 text-xs font-black shadow-md border-2 border-lime-200 border-b-4 border-b-lime-400 active:border-b-0 active:translate-y-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4 fill-[#46A302]" />
            <span>Luyện đọc {activeTestObj?.title || 'Đề 1'}</span>
          </button>
        </div>
      </div>

      {/* Test Selector & Part Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl bg-white dark:bg-slate-800 p-3.5 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-2xs">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#58CC02] shrink-0" />
          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 shrink-0">
            Chọn bộ đề luyện đọc:
          </span>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="rounded-xl border-2 border-slate-200 dark:border-slate-600 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white outline-hidden focus:border-[#58CC02] cursor-pointer"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} {t.isCustom ? '(Đề giáo viên / AI)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Part Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedPart(0)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border-2 border-b-4 active:border-b-0 active:translate-y-1 transition-all cursor-pointer ${
              selectedPart === 0
                ? 'bg-[#58CC02] text-white border-[#58CC02] border-b-[#46A302] shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 border-b-slate-300 dark:border-b-slate-900'
            }`}
          >
            Tất cả (Passage 1 - 4)
          </button>
          {readingParts.map((p) => (
            <button
              key={p.part}
              type="button"
              onClick={() => {
                setSelectedPart(p.part);
                setPreviewPassageNum(p.part);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border-2 border-b-4 active:border-b-0 active:translate-y-1 transition-all cursor-pointer ${
                selectedPart === p.part
                  ? 'bg-[#58CC02] text-white border-[#58CC02] border-b-[#46A302] shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 border-b-slate-300 dark:border-b-slate-900'
              }`}
            >
              Passage {p.part}
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
              className={`rounded-3xl bg-white dark:bg-slate-800/90 p-5 border-2 border-b-4 shadow-2xs hover:-translate-y-0.5 transition-all flex flex-col justify-between ${
                item.highlight
                  ? 'border-[#58CC02] border-b-[#46A302]'
                  : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 hover:border-[#58CC02] hover:border-b-[#46A302]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="font-black text-[#46A302] dark:text-[#58CC02]">
                    {item.range}
                  </span>
                  <span>·</span>
                  {item.highlight ? (
                    <span className="inline-flex items-center gap-1 text-[#2B6600] dark:text-lime-300 font-black">
                      <Columns className="h-3 w-3" /> Chia đôi màn hình
                    </span>
                  ) : (
                    <span className="truncate max-w-[140px]">{activeTestObj?.title}</span>
                  )}
                </div>

                <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                  {item.title}
                </h3>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                  {item.desc}
                </p>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-700/40 border border-slate-200/80 dark:border-slate-700 mb-4">
                  <div className="text-[11px] font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-[#FF9600]" />
                    <span>Mẹo làm bài VSTEP:</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {item.tip}
                  </div>
                </div>
              </div>

              {/* Start Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleStartPractice(selectedTestId, item.part)}
                  className="btn-duo-green py-2.5 px-3 rounded-2xl text-xs whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Luyện Passage {item.part}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartExam(selectedTestId, item.part)}
                  className="btn-duo-blue py-2.5 px-3 rounded-2xl text-xs whitespace-nowrap"
                >
                  <span>Thi thử Passage {item.part}</span>
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Interactive Bilingual Reading Studio & Instant Vocab Lookup */}
      {activePassageSource?.readingArticle && (
        <div className="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-xs font-black text-[#46A302] dark:text-[#58CC02] uppercase tracking-wider">
                Phòng Đọc Song Ngữ & Bóc Tách Từ Vựng (Bôi đen để tra nghĩa & lưu SRS)
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {activePassageSource.readingArticle.title || `Reading Passage ${previewPassageNum}`}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {([1, 2, 3, 4] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreviewPassageNum(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
                      previewPassageNum === p
                        ? 'bg-[#58CC02] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Passage {p}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowBilingualPreview((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-colors cursor-pointer whitespace-nowrap ${
                  showBilingualPreview
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                }`}
              >
                <Languages className="h-3.5 w-3.5" />
                <span>{showBilingualPreview ? 'Đang bật Dịch Song Ngữ' : 'Bật Dịch Song Ngữ'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleStartPractice(selectedTestId, previewPassageNum)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white text-xs font-black shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                <span>Làm 10 Câu Passage {previewPassageNum}</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
            {activePassageSource.readingArticle.paragraphs.map((para, idx) => {
              const transPara =
                activePassageSource.readingArticleTranslation?.paragraphs?.[idx] || '';
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 space-y-2"
                >
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    Đoạn {idx + 1} · Bôi đen từ bất kỳ để tra từ điển & lưu Flashcard
                  </div>
                  <div
                    className="text-sm sm:text-base text-slate-800 dark:text-slate-100 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: para }}
                  />
                  {showBilingualPreview && transPara && (
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                      {transPara}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
