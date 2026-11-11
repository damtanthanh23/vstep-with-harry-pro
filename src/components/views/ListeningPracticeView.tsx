import React, { useState, useMemo, useEffect } from 'react';
import {
  Headphones,
  Play,
  Sparkles,
  BookOpen,
  Volume2,
  CheckCircle2,
  RotateCcw,
  Eye,
  BookmarkPlus,
  HelpCircle,
  Award,
} from 'lucide-react';
import { TestMetadata, ExamSection, Question } from '../../types/exam';
import { TEST_1_QUESTIONS } from '../../data/test1Data';
import { examAudioManager } from '../../utils/audioManager';
import { QuickSaveVocabModal, QuickSaveVocabPayload } from '../QuickSaveVocabModal';
import { GlobalSelectionDictionaryPopover } from '../GlobalSelectionDictionaryPopover';

interface ListeningPracticeViewProps {
  tests: TestMetadata[];
  onStartTest: (testId: string, initialSection?: ExamSection, initialPart?: 1 | 2 | 3 | 4) => void;
  onSelectMode: (mode: 'exam' | 'practice') => void;
  onOpenTranscriptModal: (transcript: string, highlight?: string, title?: string) => void;
}

type ClozeDifficulty = 'B1' | 'B2' | 'C1';

interface ClozeToken {
  id: string;
  raw: string;
  cleanWord: string;
  prefixPunct: string;
  suffixPunct: string;
  isBlank: boolean;
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'all',
  'any',
  'can',
  'had',
  'her',
  'was',
  'one',
  'our',
  'out',
  'day',
  'get',
  'has',
  'him',
  'his',
  'how',
  'man',
  'new',
  'now',
  'old',
  'see',
  'two',
  'way',
  'who',
  'boy',
  'did',
  'its',
  'let',
  'put',
  'say',
  'she',
  'too',
  'use',
  'that',
  'with',
  'have',
  'this',
  'will',
  'your',
  'from',
  'they',
  'know',
  'want',
  'been',
  'good',
  'much',
  'some',
  'time',
  'very',
  'when',
  'come',
  'here',
  'just',
  'like',
  'long',
  'make',
  'many',
  'more',
  'only',
  'over',
  'such',
  'take',
  'than',
  'them',
  'well',
  'were',
  'what',
  'about',
  'there',
  'their',
  'would',
  'could',
  'should',
  'speaker',
  'woman',
]);

function buildClozeTokens(scriptText: string, difficulty: ClozeDifficulty): ClozeToken[] {
  const words = (scriptText || '').trim().split(/\s+/).filter(Boolean);
  const minLen = difficulty === 'B1' ? 6 : difficulty === 'B2' ? 5 : 4;
  const stepMod = difficulty === 'B1' ? 6 : difficulty === 'B2' ? 4 : 3;

  let candidateCounter = 0;
  let blankCount = 0;
  const maxBlanks = difficulty === 'B1' ? 8 : difficulty === 'B2' ? 12 : 16;

  return words.map((raw, idx) => {
    const match = raw.match(/^([^a-zA-Z0-9']*)([a-zA-Z0-9']+)([^a-zA-Z0-9']*)$/);
    if (!match) {
      return {
        id: `tok_${idx}`,
        raw,
        cleanWord: raw,
        prefixPunct: '',
        suffixPunct: '',
        isBlank: false,
      };
    }

    const [, prefixPunct, cleanWord, suffixPunct] = match;
    const lower = cleanWord.toLowerCase();
    const isEligible =
      /^[a-zA-Z]+$/.test(cleanWord) &&
      cleanWord.length >= minLen &&
      !STOP_WORDS.has(lower);

    let isBlank = false;
    if (isEligible && blankCount < maxBlanks) {
      candidateCounter += 1;
      if (candidateCounter % stepMod === 1) {
        isBlank = true;
        blankCount += 1;
      }
    }

    return {
      id: `tok_${idx}`,
      raw,
      cleanWord,
      prefixPunct,
      suffixPunct,
      isBlank,
    };
  });
}

export const ListeningPracticeView: React.FC<ListeningPracticeViewProps> = ({
  tests,
  onStartTest,
  onSelectMode,
  onOpenTranscriptModal,
}) => {
  const [selectedPart, setSelectedPart] = useState<number>(0); // 0 = all
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0]?.id || 'test-1');

  // Interactive Cloze Dictation Lab state
  const [clozePartNum, setClozePartNum] = useState<1 | 2 | 3>(1);
  const [clozeQuestionIdx, setClozeQuestionIdx] = useState<number>(0);
  const [clozeDifficulty, setClozeDifficulty] = useState<ClozeDifficulty>('B2');
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [isClozeChecked, setIsClozeChecked] = useState<boolean>(false);
  const [showFirstLetterHint, setShowFirstLetterHint] = useState<boolean>(false);
  const [quickSavePayload, setQuickSavePayload] = useState<QuickSaveVocabPayload | null>(null);

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

  const testQuestions: Question[] = useMemo(() => {
    if (activeTestObj?.questions && activeTestObj.questions.length > 0) {
      return activeTestObj.questions;
    }
    return TEST_1_QUESTIONS;
  }, [activeTestObj]);

  // Extract distinct listening scripts for the selected part
  const partScripts = useMemo(() => {
    const listQuestions = testQuestions.filter(
      (q) => q.section === 'LISTENING' && q.partNumber === clozePartNum && q.audioScript?.trim()
    );
    const seen = new Set<string>();
    const items: Array<{
      label: string;
      questionId: number;
      prompt: string;
      script: string;
      translation?: string;
    }> = [];

    listQuestions.forEach((q) => {
      const cleanScript = (q.audioScript || '').trim();
      const dedupeKey = cleanScript.slice(0, 120);
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        items.push({
          label:
            clozePartNum === 1
              ? `Thông báo #${q.id}`
              : clozePartNum === 2
              ? `Hội thoại (Câu ${q.id}–${q.id + 3})`
              : `Bài giảng (Câu ${q.id}–${q.id + 4})`,
          questionId: q.id,
          prompt: q.prompt || `Question ${q.id}`,
          script: cleanScript,
          translation: q.audioScriptTranslation || q.vietnameseTranslation,
        });
      }
    });
    return items;
  }, [testQuestions, clozePartNum]);

  useEffect(() => {
    setClozeQuestionIdx(0);
    setUserInputs({});
    setIsClozeChecked(false);
  }, [selectedTestId, clozePartNum, clozeDifficulty]);

  const activeScriptItem = partScripts[clozeQuestionIdx] || partScripts[0];

  const clozeTokens = useMemo(() => {
    if (!activeScriptItem?.script) return [];
    return buildClozeTokens(activeScriptItem.script, clozeDifficulty);
  }, [activeScriptItem, clozeDifficulty]);

  const blankTokens = useMemo(
    () => clozeTokens.filter((t) => t.isBlank),
    [clozeTokens]
  );

  const clozeScore = useMemo(() => {
    if (blankTokens.length === 0) return { correct: 0, total: 0, pct: 0 };
    let correct = 0;
    blankTokens.forEach((t) => {
      const typed = (userInputs[t.id] || '').trim().toLowerCase();
      if (typed && typed === t.cleanWord.toLowerCase()) {
        correct += 1;
      }
    });
    return {
      correct,
      total: blankTokens.length,
      pct: Math.round((correct / blankTokens.length) * 100),
    };
  }, [blankTokens, userInputs]);

  return (
    <div className="space-y-6 pb-20">
      <GlobalSelectionDictionaryPopover
        sourceLabel="Luyện Nghe VSTEP"
        testId={selectedTestId}
        testTitle={activeTestObj?.title}
      />

      {/* Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#1CB0F6] to-[#1899D6] border-2 border-[#1899D6] border-b-4 border-b-[#116E9A] p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-white font-black text-xs mb-2">
            <Headphones className="h-3.5 w-3.5" />
            <span>KỸ NĂNG NGHE VSTEP · B1 – B2 – C1</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Luyện Nghe Chuyên Sâu & Nghe Điền Từ Khóa
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-sky-100 max-w-xl">
            Tổng cộng 35 câu hỏi chuẩn VSTEP (Part 1–3). Tích hợp Phòng luyện Nghe chép chính tả (Dictation Cloze) và bôi đen bất kỳ từ tiếng Anh nào để tra từ điển & lưu Flashcard SRS.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleStartPractice(selectedTestId, 1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#1899D6] hover:bg-sky-50 text-xs font-black shadow-md border-2 border-sky-200 border-b-4 border-b-sky-400 active:border-b-0 active:translate-y-1 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="h-4 w-4 fill-[#1899D6]" />
            <span>Luyện nghe {activeTestObj?.title || 'Đề 1'}</span>
          </button>
        </div>
      </div>

      {/* Test Selector & Part Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl bg-white dark:bg-slate-800 p-3.5 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-2xs">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#1CB0F6] shrink-0" />
          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 shrink-0">
            Chọn bộ đề luyện nghe:
          </span>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="rounded-xl border-2 border-slate-200 dark:border-slate-600 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white outline-hidden focus:border-[#1CB0F6] cursor-pointer"
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
            Tất cả (Part 1 - 3)
          </button>
          {listeningParts.map((p) => (
            <button
              key={p.part}
              type="button"
              onClick={() => setSelectedPart(p.part)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border-2 border-b-4 active:border-b-0 active:translate-y-1 transition-all cursor-pointer ${
                selectedPart === p.part
                  ? 'bg-[#58CC02] text-white border-[#58CC02] border-b-[#46A302] shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 border-b-slate-300 dark:border-b-slate-900'
              }`}
            >
              Part {p.part}
            </button>
          ))}
        </div>
      </div>

      {/* Parts Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {listeningParts
          .filter((p) => selectedPart === 0 || p.part === selectedPart)
          .map((item) => (
            <div
              key={item.part}
              className="rounded-3xl bg-white dark:bg-slate-800/90 p-5 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 hover:border-[#1CB0F6] hover:border-b-[#1899D6] shadow-2xs hover:-translate-y-0.5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="font-black text-[#1899D6] dark:text-[#1CB0F6]">
                    {item.range}
                  </span>
                  <span>·</span>
                  <span className="truncate max-w-[140px]">{activeTestObj?.title}</span>
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
                  <span>Luyện Part {item.part}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStartExam(selectedTestId, item.part)}
                  className="btn-duo-blue py-2.5 px-3 rounded-2xl text-xs whitespace-nowrap"
                >
                  <span>Thi thử Part {item.part}</span>
                </button>
              </div>
            </div>
          ))}
      </div>

      {/* Interactive Audio Dictation / Cloze Lab */}
      {activeScriptItem && (
        <div className="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="text-xs font-black text-[#1899D6] dark:text-[#1CB0F6] uppercase tracking-wider">
                Phòng Luyện Nghe Điền Từ Khóa (Interactive Dictation Cloze)
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                Nghe Bắt Từ Khóa & Chép Chính Tả Theo Đề Thi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Nghe đoạn hội thoại/thông báo, điền từ còn thiếu vào ô trống và bôi đen bất kỳ từ nào để tra nghĩa hoặc lưu vào kho SRS.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Part selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {([1, 2, 3] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setClozePartNum(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
                      clozePartNum === p
                        ? 'bg-[#1CB0F6] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Part {p}
                  </button>
                ))}
              </div>

              {/* Difficulty selector */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                {(['B1', 'B2', 'C1'] as ClozeDifficulty[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setClozeDifficulty(lvl)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer whitespace-nowrap ${
                      clozeDifficulty === lvl
                        ? 'bg-[#58CC02] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Mức {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Passage / Script item switcher & audio controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {partScripts.map((item, idx) => (
                <button
                  key={item.questionId}
                  type="button"
                  onClick={() => {
                    setClozeQuestionIdx(idx);
                    setUserInputs({});
                    setIsClozeChecked(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    clozeQuestionIdx === idx
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-[#1899D6] dark:text-sky-300 border-[#1CB0F6]'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => examAudioManager.speakText(activeScriptItem.script)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1CB0F6] hover:bg-[#1899D6] text-white text-xs font-black shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Volume2 className="h-4 w-4" />
                <span>Nghe Đoạn Này (Giọng Chuẩn)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenTranscriptModal(
                    activeScriptItem.script,
                    undefined,
                    `${activeTestObj?.title || 'Đề VSTEP'} · ${activeScriptItem.label}`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Xem Hội Thoại Song Ngữ</span>
              </button>
            </div>
          </div>

          {/* Interactive Cloze Paragraph */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 leading-9 text-sm sm:text-base text-slate-800 dark:text-slate-100">
            {clozeTokens.map((token) => {
              if (!token.isBlank) {
                return <span key={token.id}>{token.raw} </span>;
              }
              const val = userInputs[token.id] || '';
              const isCorrect =
                isClozeChecked && val.trim().toLowerCase() === token.cleanWord.toLowerCase();
              const isWrong = isClozeChecked && !isCorrect;
              const placeholderHint = showFirstLetterHint
                ? `${token.cleanWord[0]}${'_'.repeat(Math.max(2, token.cleanWord.length - 1))}`
                : `${'_'.repeat(Math.min(10, Math.max(4, token.cleanWord.length)))}`;

              return (
                <span key={token.id} className="inline-flex items-center gap-1 mx-0.5 align-baseline">
                  {token.prefixPunct && <span>{token.prefixPunct}</span>}
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => {
                      setUserInputs((prev) => ({ ...prev, [token.id]: e.target.value }));
                      if (isClozeChecked) setIsClozeChecked(false);
                    }}
                    placeholder={placeholderHint}
                    style={{ width: `${Math.max(76, token.cleanWord.length * 10 + 24)}px` }}
                    className={`px-2 py-0.5 rounded-lg text-xs sm:text-sm font-black text-center border-2 outline-hidden transition-colors tabular-nums ${
                      isCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : isWrong
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300'
                        : 'bg-white dark:bg-slate-800 border-sky-300 dark:border-sky-700 text-slate-900 dark:text-white focus:border-[#1CB0F6]'
                    }`}
                  />
                  {isWrong && (
                    <button
                      type="button"
                      onClick={() =>
                        setQuickSavePayload({
                          initialWord: token.cleanWord,
                          contextSentence: activeScriptItem.script.slice(0, 260),
                          sourceLabel: `Nghe Điền Từ · ${activeScriptItem.label}`,
                          testId: selectedTestId,
                          testTitle: activeTestObj?.title,
                        })
                      }
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-black hover:bg-emerald-200 transition-colors cursor-pointer"
                      title="Bấm để lưu từ này vào Flashcard SRS"
                    >
                      <span>{token.cleanWord}</span>
                      <BookmarkPlus className="h-3 w-3" />
                    </button>
                  )}
                  {token.suffixPunct && <span>{token.suffixPunct}</span>}{' '}
                </span>
              );
            })}
          </div>

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <Award className="h-4 w-4 text-[#58CC02]" />
                <span>
                  Kết quả điền từ: <strong className="text-slate-900 dark:text-white">{clozeScore.correct}/{clozeScore.total}</strong> ô đúng ({clozeScore.pct}%)
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFirstLetterHint((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{showFirstLetterHint ? 'Ẩn gợi ý chữ đầu' : 'Gợi ý chữ cái đầu'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserInputs({});
                  setIsClozeChecked(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Làm lại</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClozeChecked(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white text-xs font-black shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Kiểm Tra Đáp Án Điền Từ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <QuickSaveVocabModal
        isOpen={Boolean(quickSavePayload)}
        onClose={() => setQuickSavePayload(null)}
        payload={quickSavePayload}
      />
    </div>
  );
};
