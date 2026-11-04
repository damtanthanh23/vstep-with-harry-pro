import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Volume2,
  Search,
  Layers,
  CheckCircle2,
  HelpCircle,
  Headphones,
  Keyboard,
  Puzzle,
  Sparkles,
  Play,
  Plus,
  Edit3,
  Trash2,
  FileSpreadsheet,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  NormalizedVocabItem,
  REWARD_CONFIG,
  fisherYatesShuffle,
  generateQuizQuestionForItem,
} from '../../../utils/vocabEngine';
import {
  UserVocabPartitionState,
  toggleWordKnownDirect,
} from '../../../services/vocabStorageService';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';
import { RunnerMode } from './VocabGameRunner';

export interface VocabDeckDetailViewProps {
  deckId: string;
  deckTitle: string;
  deckSubtitle?: string;
  items: NormalizedVocabItem[];
  vocabState: UserVocabPartitionState;
  onVocabStateChange: (nextState: UserVocabPartitionState) => void;
  isPersonalDeck?: boolean;
  onBack: () => void;
  onLaunchSession: (params: {
    mode: RunnerMode;
    subMode?: string;
    selectedItems: NormalizedVocabItem[];
    distractorPool: NormalizedVocabItem[];
  }) => void;
  onOpenSrsForDeck: () => void;
  onOpenQuickImport?: () => void;
  onOpenAiModal?: () => void;
  onAddManualWord?: (wordData: {
    word: string;
    phonetic: string;
    partOfSpeech: 'n' | 'v' | 'adj' | 'adv' | 'phr';
    meaningVi: string;
    exampleEn: string;
    exampleVi: string;
  }) => void;
  onUpdateManualWord?: (
    wordId: string,
    wordData: {
      word: string;
      phonetic: string;
      partOfSpeech: 'n' | 'v' | 'adj' | 'adv' | 'phr';
      meaningVi: string;
      exampleEn: string;
      exampleVi: string;
    }
  ) => void;
  onDeleteManualWord?: (wordId: string) => void;
}

export const VocabDeckDetailView: React.FC<VocabDeckDetailViewProps> = ({
  deckId,
  deckTitle,
  deckSubtitle,
  items,
  vocabState,
  onVocabStateChange,
  isPersonalDeck = false,
  onBack,
  onLaunchSession,
  onOpenSrsForDeck,
  onOpenQuickImport,
  onOpenAiModal,
  onAddManualWord,
  onUpdateManualWord,
  onDeleteManualWord,
}) => {
  // Session Customization State (Section 3.2)
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'known' | 'unknown'>(
    'all'
  );
  const [sessionMaxCount, setSessionMaxCount] = useState<number>(20); // 10, 20, 50, 100, 0 (All)
  const [sessionOrder, setSessionOrder] = useState<'source' | 'random'>('source');

  // Sub-modals for mode options
  const [activeSubModeModal, setActiveSubModeModal] = useState<
    'flashcard' | 'quiz' | 'special' | null
  >(null);

  // Independent Word Table Search & Filter (Section 3.4)
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | 'known' | 'unknown'>('all');
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  // Manual Word Add/Edit Modal State
  const [editingWordModal, setEditingWordModal] = useState<{
    mode: 'add' | 'edit';
    wordId?: string;
    word: string;
    phonetic: string;
    partOfSpeech: 'n' | 'v' | 'adj' | 'adv' | 'phr';
    meaningVi: string;
    exampleEn: string;
    exampleVi: string;
  } | null>(null);

  // Compute deck known count & percentage
  const { totalCount, knownCount, knownPercent } = useMemo(() => {
    const total = items.length;
    if (total === 0) return { totalCount: 0, knownCount: 0, knownPercent: 0 };
    let known = 0;
    items.forEach((it) => {
      if (vocabState.knownMap[it.wordKey]?.isKnown) {
        known++;
      }
    });
    return {
      totalCount: total,
      knownCount: known,
      knownPercent: Math.round((known / total) * 100),
    };
  }, [items, vocabState.knownMap]);

  // Compute candidate items matching Session Customization Filter
  const filteredSessionPool = useMemo(() => {
    return items.filter((it) => {
      const isKnown = Boolean(vocabState.knownMap[it.wordKey]?.isKnown);
      if (sessionStatusFilter === 'known') return isKnown;
      if (sessionStatusFilter === 'unknown') return !isKnown;
      return true;
    });
  }, [items, vocabState.knownMap, sessionStatusFilter]);

  const selectedSessionCount = useMemo(() => {
    if (sessionMaxCount === 0) return filteredSessionPool.length;
    return Math.min(sessionMaxCount, filteredSessionPool.length);
  }, [filteredSessionPool.length, sessionMaxCount]);

  // Build final ordered session items when launching a game
  const prepareSessionItems = (): NormalizedVocabItem[] => {
    const basePool =
      sessionOrder === 'random' ? fisherYatesShuffle(filteredSessionPool) : [...filteredSessionPool];
    if (sessionMaxCount === 0) return basePool;
    return basePool.slice(0, sessionMaxCount);
  };

  // Eligibility checks for Quiz / Cloze / Match
  const eligibility = useMemo(() => {
    const distractorCandidates = items.length >= 2 ? items : filteredSessionPool;
    let quizEligibleCount = 0;
    let clozeEligibleCount = 0;

    filteredSessionPool.forEach((it, idx) => {
      if (generateQuizQuestionForItem(it, distractorCandidates, 'word_to_meaning', idx)) {
        quizEligibleCount++;
      }
      if (
        it.cloze &&
        generateQuizQuestionForItem(it, distractorCandidates, 'context_cloze', idx)
      ) {
        clozeEligibleCount++;
      }
    });

    return {
      canStartAny: selectedSessionCount >= 1,
      canStartQuiz: selectedSessionCount >= 1 && quizEligibleCount >= 1,
      canStartCloze: selectedSessionCount >= 1 && clozeEligibleCount >= 1,
      canStartMatch: selectedSessionCount >= 2,
      quizEligibleCount,
      clozeEligibleCount,
    };
  }, [items, filteredSessionPool, selectedSessionCount]);

  // Filtered rows for the Word Table below
  const tableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    return items.filter((it) => {
      const isKnown = Boolean(vocabState.knownMap[it.wordKey]?.isKnown);
      if (tableStatusFilter === 'known' && !isKnown) return false;
      if (tableStatusFilter === 'unknown' && isKnown) return false;
      if (q) {
        const matchW = it.word.toLowerCase().includes(q);
        const matchM = it.meaningVi.toLowerCase().includes(q);
        const matchEx = it.exampleEn.toLowerCase().includes(q);
        if (!matchW && !matchM && !matchEx) return false;
      }
      return true;
    });
  }, [items, vocabState.knownMap, tableSearch, tableStatusFilter]);

  const handleToggleKnownRow = (item: NormalizedVocabItem) => {
    const next = toggleWordKnownDirect(vocabState, deckId, item.id, item.contentVersion);
    onVocabStateChange(next);
  };

  const handleTriggerLaunch = (mode: RunnerMode, subMode?: string) => {
    const chosen = prepareSessionItems();
    if (chosen.length === 0) return;

    // If launching context_cloze, filter to items that have valid cloze
    const finalItems =
      mode === 'quiz' && subMode === 'context_cloze'
        ? chosen.filter((it) => Boolean(it.cloze))
        : chosen;

    if (finalItems.length === 0) return;
    setActiveSubModeModal(null);
    onLaunchSession({
      mode,
      subMode,
      selectedItems: finalItems,
      distractorPool: items,
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Deck Header & Overall Progress */}
      <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onBack}
              className="btn-duo-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#58CC02]" />
              Quay lại danh sách bộ từ
            </button>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">{deckTitle}</h1>
            {deckSubtitle && <p className="text-xs sm:text-sm font-bold text-slate-500">{deckSubtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenSrsForDeck}
              className="btn-duo-blue inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              Học ngắt quãng (SRS)
            </button>

            {isPersonalDeck && onAddManualWord && (
              <button
                type="button"
                onClick={() =>
                  setEditingWordModal({
                    mode: 'add',
                    word: '',
                    phonetic: '',
                    partOfSpeech: 'n',
                    meaningVi: '',
                    exampleEn: '',
                    exampleVi: '',
                  })
                }
                className="btn-duo-green inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm từ mới
              </button>
            )}

            {isPersonalDeck && onOpenQuickImport && (
              <button
                type="button"
                onClick={onOpenQuickImport}
                className="btn-duo-white inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#58CC02]" />
                Nhập/Xuất CSV & JSON
              </button>
            )}

            {isPersonalDeck && onOpenAiModal && (
              <button
                type="button"
                onClick={onOpenAiModal}
                className="btn-duo-purple inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                Tạo từ bằng AI
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="pt-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-600">
                Tổng số từ: <strong className="font-black text-slate-900">{totalCount}</strong>
              </span>
              <span className="text-[#46A302] font-black">
                Đã thuộc: <strong>{knownCount}</strong>/{totalCount} từ
              </span>
            </div>
            <span className="font-black text-[#46A302] bg-[#D7FFB8] px-3 py-0.5 rounded-xl border-2 border-[#58CC02] border-b-3 border-b-[#46A302] text-xs">
              {knownPercent}% hoàn thành
            </span>
          </div>
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden border-2 border-[#E5E5E5] p-0.5">
            <div
              className="h-full bg-[#58CC02] rounded-full transition-all duration-300"
              style={{ width: `${knownPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Session Customization Block (Tùy chỉnh lượt học) */}
      <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              Tùy chỉnh phạm vi lượt học
            </h2>
            <p className="text-xs font-bold text-slate-500">
              Áp dụng chung cho cả 6 chế độ luyện tập bên dưới
            </p>
          </div>
          <span className="px-3.5 py-1 rounded-xl bg-[#DDF4FF] text-[#1899D6] border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] text-xs font-black">
            {selectedSessionCount}/{totalCount} từ được chọn
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
              1. Trạng thái từ:
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border-2 border-[#E5E5E5]">
              {(
                [
                  { id: 'all', label: 'Toàn bộ' },
                  { id: 'unknown', label: 'Chưa thuộc' },
                  { id: 'known', label: 'Đã thuộc' },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSessionStatusFilter(st.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-0.5 ${
                    sessionStatusFilter === st.id
                      ? 'bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-3 border-b-[#46A302]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Max Count */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
              2. Số từ tối đa:
            </label>
            <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1.5 rounded-2xl border-2 border-[#E5E5E5]">
              {(
                [
                  { val: 10, label: '10' },
                  { val: 20, label: '20' },
                  { val: 50, label: '50' },
                  { val: 100, label: '100' },
                  { val: 0, label: 'Tất cả' },
                ] as const
              ).map((cnt) => (
                <button
                  key={cnt.val}
                  type="button"
                  onClick={() => setSessionMaxCount(cnt.val)}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-0.5 ${
                    sessionMaxCount === cnt.val
                      ? 'bg-[#1CB0F6] text-white border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cnt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Order Mode */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600">
              3. Thứ tự câu hỏi:
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border-2 border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setSessionOrder('source')}
                className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-0.5 ${
                  sessionOrder === 'source'
                    ? 'bg-[#FF9600] text-white border-2 border-[#FF9600] border-b-3 border-b-[#E58700]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo thứ tự nguồn
              </button>
              <button
                type="button"
                onClick={() => setSessionOrder('random')}
                className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-0.5 ${
                  sessionOrder === 'random'
                    ? 'bg-[#FF9600] text-white border-2 border-[#FF9600] border-b-3 border-b-[#E58700]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ngẫu nhiên (Shuffle)
              </button>
            </div>
          </div>
        </div>

        {selectedSessionCount === 0 && (
          <div className="p-3.5 rounded-2xl bg-[#FFF5D6] border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] text-xs font-bold text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#FF9600] shrink-0" />
            <span>
              Không có từ vựng nào khớp với trạng thái &ldquo;
              {sessionStatusFilter === 'known' ? 'Đã thuộc' : 'Chưa thuộc'}&rdquo;. Hãy chuyển sang
              &ldquo;Toàn bộ&rdquo; để bắt đầu học.
            </span>
          </div>
        )}
      </div>

      {/* 3. 6 Mandatory Study Mode Cards (Duolingo 3D Tactile Tiles) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Flashcard (Beetle Purple) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => setActiveSubModeModal('flashcard')}
          className="group text-left p-5 rounded-3xl border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] bg-gradient-to-br from-[#F3E5FF]/60 to-white hover:bg-[#F3E5FF]/80 active:border-b-2 active:translate-y-0.5 disabled:opacity-45 transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#CE82FF] border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] text-white flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#F3E5FF] border-2 border-[#CE82FF] border-b-3 border-b-[#A560E8] text-[#A560E8] text-xs font-black">
              +{REWARD_CONFIG.flashcard} điểm/thẻ
            </span>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-[#A560E8]">
              1. Thẻ từ (Flashcard)
            </h3>
            <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed">
              Lật thẻ Anh → Việt hoặc Việt → Anh, gõ kiểm tra nhanh và tự đánh giá Quên / Thuộc.
            </p>
          </div>
        </button>

        {/* Card 2: Trắc nghiệm (Fox Orange) */}
        <button
          type="button"
          disabled={!eligibility.canStartQuiz}
          onClick={() => setActiveSubModeModal('quiz')}
          className="group text-left p-5 rounded-3xl border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] bg-gradient-to-br from-[#FFF5D6]/70 to-white hover:bg-[#FFF5D6] active:border-b-2 active:translate-y-0.5 disabled:opacity-45 transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FF9600] border-2 border-[#FF9600] border-b-4 border-b-[#E58700] text-white flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#FFF5D6] border-2 border-[#FFC800] border-b-3 border-b-[#E5B400] text-[#FF9600] text-xs font-black">
              +{REWARD_CONFIG.quiz} điểm/câu
            </span>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-[#FF9600]">
              2. Trắc nghiệm (Quiz)
            </h3>
            <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed">
              3 chế độ: Từ → Nghĩa, Nghĩa → Từ, hoặc Điền khuyết ngữ cảnh (Cloze) trong 30 giây.
            </p>
          </div>
        </button>

        {/* Card 3: Nghe & Gõ (Macaw Blue) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => handleTriggerLaunch('dictation')}
          className="group text-left p-5 rounded-3xl border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] bg-gradient-to-br from-[#DDF4FF]/60 to-white hover:bg-[#DDF4FF]/80 active:border-b-2 active:translate-y-0.5 disabled:opacity-45 transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1CB0F6] border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] text-white flex items-center justify-center">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#DDF4FF] border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] text-[#1899D6] text-xs font-black">
              +{REWARD_CONFIG.dictation} điểm/câu
            </span>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-[#1899D6]">
              3. Nghe & Gõ từ (Dictation)
            </h3>
            <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed">
              Nghe phát âm chuẩn với 3 tốc độ (0.75x, 1x, 1.25x) và gõ lại chính xác từ vựng.
            </p>
          </div>
        </button>

        {/* Card 4: Gõ từ (Feather Green) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => handleTriggerLaunch('spell')}
          className="group text-left p-5 rounded-3xl border-2 border-[#58CC02] border-b-4 border-b-[#46A302] bg-gradient-to-br from-[#D7FFB8]/55 to-white hover:bg-[#D7FFB8]/75 active:border-b-2 active:translate-y-0.5 disabled:opacity-45 transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#58CC02] border-2 border-[#58CC02] border-b-4 border-b-[#46A302] text-white flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#D7FFB8] border-2 border-[#58CC02] border-b-3 border-b-[#46A302] text-[#46A302] text-xs font-black">
              +{REWARD_CONFIG.spell} điểm/câu
            </span>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-[#46A302]">
              4. Gõ từ vựng (Spelling)
            </h3>
            <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed">
              Nhìn nghĩa tiếng Việt và câu ví dụ khuyết từ để gõ lại từ tiếng Anh kèm 3 mức gợi ý.
            </p>
          </div>
        </button>

        {/* Card 5: Ghép cặp (Sky Blue) */}
        <button
          type="button"
          disabled={!eligibility.canStartMatch}
          onClick={() => handleTriggerLaunch('match')}
          className="group text-left p-5 rounded-3xl border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] bg-gradient-to-br from-sky-50 to-white hover:bg-sky-100/70 active:border-b-2 active:translate-y-0.5 disabled:opacity-45 transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1CB0F6] border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] text-white flex items-center justify-center">
              <Puzzle className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#DDF4FF] border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] text-[#1899D6] text-xs font-black">
              +{REWARD_CONFIG.match} điểm/cặp
            </span>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-[#1899D6]">
              5. Ghép cặp (Matching)
            </h3>
            <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed">
              Ghép nhanh tối đa 8 cặp từ/vòng với 5 tim mạng sống. Yêu cầu tối thiểu 2 từ.
            </p>
          </div>
        </button>

        {/* Card 6: Đặc biệt (Cardinal Red) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => setActiveSubModeModal('special')}
          className="group text-left p-5 rounded-3xl border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B] bg-gradient-to-br from-[#FFDADC]/60 to-white hover:bg-[#FFDADC]/80 active:border-b-2 active:translate-y-0.5 disabled:opacity-45 transition-all flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#FF4B4B] border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B] text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="px-3 py-1 rounded-xl bg-[#FFDADC] border-2 border-[#FF4B4B] border-b-3 border-b-[#EA2B2B] text-[#EA2B2B] text-xs font-black">
              +10 đến +20 điểm
            </span>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 group-hover:text-[#EA2B2B]">
              6. Chế độ Đặc biệt
            </h3>
            <p className="text-xs font-bold text-slate-600 mt-1 leading-relaxed">
              Hỗn hợp (Mixed +20đ), Flappy Bird từ vựng (+20đ), và Giải cứu khỉ khỏi Yeti (+10đ).
            </p>
          </div>
        </button>
      </div>

      {/* 4. Word List Table (Danh sách từ vựng trong bộ) */}
      <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">
              Danh sách từ vựng trong bộ ({tableRows.length}/{totalCount})
            </h2>
            <p className="text-xs font-bold text-slate-500">
              Bật công tắc &ldquo;Đã thuộc&rdquo; để ghi nhận tiến độ và tự động đưa từ vào lịch ôn
              ngắt quãng (SRS Lv0).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Tìm từ hoặc nghĩa trong bảng..."
                className="pl-9 pr-3 py-2 text-xs sm:text-sm font-bold border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-2xl focus:outline-hidden focus:border-[#58CC02]"
              />
            </div>

            <select
              value={tableStatusFilter}
              onChange={(e) => setTableStatusFilter(e.target.value as any)}
              className="px-3.5 py-2 text-xs sm:text-sm font-black border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-2xl bg-white text-slate-700 cursor-pointer focus:outline-hidden focus:border-[#58CC02]"
            >
              <option value="all">Hiển thị: Tất cả</option>
              <option value="unknown">Hiển thị: Chưa thuộc</option>
              <option value="known">Hiển thị: Đã thuộc</option>
            </select>
          </div>
        </div>

        <div className="border-2 border-[#E5E5E5] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b-2 border-[#E5E5E5] text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3 w-12 text-center">Loa</th>
                  <th className="py-3 px-3">Từ vựng & IPA</th>
                  <th className="py-3 px-3">Nghĩa tiếng Việt</th>
                  <th className="py-3 px-3">Câu ví dụ</th>
                  <th className="py-3 px-3 text-center w-28">Đã thuộc</th>
                  {isPersonalDeck && <th className="py-3 px-3 text-right w-24">Sửa/Xóa</th>}
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#F0F0F0] text-sm">
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isPersonalDeck ? 6 : 5}
                      className="py-10 text-center font-bold text-slate-400"
                    >
                      Không có từ vựng nào khớp với bộ lọc hiển thị.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((item) => {
                    const isKnown = Boolean(vocabState.knownMap[item.wordKey]?.isKnown);
                    return (
                      <tr
                        key={item.wordKey}
                        className={`transition ${
                          isKnown
                            ? 'bg-[#D7FFB8]/35 hover:bg-[#D7FFB8]/55'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setPlayingWordId(item.id);
                              playDictionaryAudio(item.word, {
                                customAudioUrl: item.audioUrl,
                                volumePercent: vocabState.audioVolumePercent || 85,
                                onEnd: () => setPlayingWordId(null),
                                onError: () => setPlayingWordId(null),
                              });
                            }}
                            className={`p-2 rounded-xl border-2 border-b-3 transition-all cursor-pointer active:border-b-0 active:translate-y-0.5 ${
                              playingWordId === item.id
                                ? 'bg-[#FFF5D6] text-[#FF9600] border-[#FFC800] border-b-[#E5B400] scale-110'
                                : 'bg-[#DDF4FF]/70 text-[#1899D6] border-[#1CB0F6] border-b-[#1899D6] hover:bg-[#DDF4FF]'
                            }`}
                            title={playingWordId === item.id ? 'Đang phát âm...' : 'Bấm để nghe phát âm tiếng Anh chuẩn'}
                          >
                            <Volume2
                              className={`w-4 h-4 ${
                                playingWordId === item.id ? 'animate-bounce text-[#FF9600]' : ''
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-black text-slate-900">{item.word}</span>
                            {item.phonetic && (
                              <span className="text-xs font-mono font-bold text-slate-500">
                                {item.phonetic}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-lg bg-white border-2 border-[#E5E5E5] border-b-3 border-b-[#CECECE] text-[10px] font-black uppercase text-slate-600">
                              {item.partOfSpeech}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-black text-slate-800">
                          {item.meaningVi}
                        </td>
                        <td className="py-3 px-3 text-xs font-semibold text-slate-600 max-w-md">
                          {item.exampleEn ? (
                            <div>
                              <span className="italic">&ldquo;{item.exampleEn}&rdquo;</span>
                              {item.exampleVi && (
                                <div className="text-slate-500 mt-0.5">→ {item.exampleVi}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isKnown}
                            onClick={() => handleToggleKnownRow(item)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              isKnown ? 'bg-[#58CC02]' : 'bg-slate-300'
                            }`}
                            title={isKnown ? 'Đã thuộc (Bấm để bỏ đánh dấu)' : 'Đánh dấu Đã thuộc'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                                isKnown ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        {isPersonalDeck && (
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {onUpdateManualWord && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingWordModal({
                                      mode: 'edit',
                                      wordId: item.id,
                                      word: item.word,
                                      phonetic: item.phonetic,
                                      partOfSpeech: item.partOfSpeech,
                                      meaningVi: item.meaningVi,
                                      exampleEn: item.exampleEn,
                                      exampleVi: item.exampleVi,
                                    })
                                  }
                                  className="btn-duo-white p-1.5 rounded-xl text-slate-600 hover:text-[#1899D6] cursor-pointer"
                                  title="Sửa từ này"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                              {onDeleteManualWord && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteManualWord(item.id)}
                                  className="btn-duo-white p-1.5 rounded-xl text-[#EA2B2B] hover:bg-rose-50 cursor-pointer"
                                  title="Xóa từ này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Submode Modal 1: Flashcard Direction */}
      {activeSubModeModal === 'flashcard' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border-2 border-[#E5E5E5] border-b-8 border-b-[#CECECE] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#F0F0F0] pb-3">
              <h3 className="font-black text-slate-900 text-base">
                Chọn chiều lật Thẻ từ (Flashcard)
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubModeModal(null)}
                className="btn-duo-white p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleTriggerLaunch('flashcard', 'en_to_vn')}
                className="w-full p-4 rounded-2xl border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] hover:bg-[#F3E5FF]/80 bg-[#F3E5FF]/50 text-left transition-all active:border-b-2 active:translate-y-0.5 cursor-pointer"
              >
                <div className="font-black text-slate-900 text-sm">
                  1. Tiếng Anh → Tiếng Việt (EN → VN)
                </div>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  Mặt trước hiển thị từ tiếng Anh, phiên âm & âm thanh. Mặt sau hiển thị nghĩa tiếng
                  Việt.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerLaunch('flashcard', 'vn_to_en')}
                className="w-full p-4 rounded-2xl border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] hover:bg-[#F3E5FF]/80 bg-[#F3E5FF]/50 text-left transition-all active:border-b-2 active:translate-y-0.5 cursor-pointer"
              >
                <div className="font-black text-slate-900 text-sm">
                  2. Tiếng Việt → Tiếng Anh (VN → EN)
                </div>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  Mặt trước chỉ hiển thị nghĩa tiếng Việt & câu ví dụ ẩn từ để bạn tự nhớ lại từ
                  tiếng Anh.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submode Modal 2: Quiz Submode Selection */}
      {activeSubModeModal === 'quiz' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border-2 border-[#E5E5E5] border-b-8 border-b-[#CECECE] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#F0F0F0] pb-3">
              <h3 className="font-black text-slate-900 text-base">
                Chọn kiểu câu hỏi Trắc nghiệm (Quiz)
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubModeModal(null)}
                className="btn-duo-white p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleTriggerLaunch('quiz', 'word_to_meaning')}
                className="w-full p-4 rounded-2xl border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] hover:bg-[#FFF5D6] bg-[#FFF5D6]/60 text-left transition-all active:border-b-2 active:translate-y-0.5 cursor-pointer"
              >
                <div className="font-black text-slate-900 text-sm">1. Từ → Nghĩa</div>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  Nhìn từ tiếng Anh (kèm IPA & âm thanh), chọn nghĩa tiếng Việt chính xác.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerLaunch('quiz', 'meaning_to_word')}
                className="w-full p-4 rounded-2xl border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] hover:bg-[#FFF5D6] bg-[#FFF5D6]/60 text-left transition-all active:border-b-2 active:translate-y-0.5 cursor-pointer"
              >
                <div className="font-black text-slate-900 text-sm">2. Nghĩa → Từ</div>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  Nhìn nghĩa tiếng Việt (ẩn IPA đáp án), chọn từ tiếng Anh chính xác.
                </p>
              </button>

              <button
                type="button"
                disabled={!eligibility.canStartCloze}
                onClick={() => handleTriggerLaunch('quiz', 'context_cloze')}
                className="w-full p-4 rounded-2xl border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] hover:bg-[#FFF5D6] bg-[#FFF5D6]/60 disabled:opacity-45 text-left transition-all active:border-b-2 active:translate-y-0.5 cursor-pointer"
              >
                <div className="font-black text-slate-900 text-sm">
                  3. Ngữ cảnh điền khuyết (Cloze) ({eligibility.clozeEligibleCount} câu hợp lệ)
                </div>
                <p className="text-xs font-bold text-slate-600 mt-1">
                  Điền từ còn thiếu vào chỗ trống &ldquo;_____&rdquo; trong câu ví dụ tiếng Anh.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submode Modal 3: Special Modes (Mixed, Flappy Bird, Monkey Rescue) */}
      {activeSubModeModal === 'special' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border-2 border-[#E5E5E5] border-b-8 border-b-[#CECECE] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#F0F0F0] pb-3">
              <h3 className="font-black text-slate-900 text-base">
                Chọn Chế độ Học Đặc biệt
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubModeModal(null)}
                className="btn-duo-white p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleTriggerLaunch('mixed')}
                className="w-full p-4 rounded-2xl border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] hover:bg-[#DDF4FF] bg-[#DDF4FF]/60 text-left transition-all active:border-b-2 active:translate-y-0.5 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="font-black text-slate-900 text-sm">
                    1. Chế độ Hỗn hợp (Mixed Mode)
                  </div>
                  <p className="text-xs font-bold text-slate-600 mt-1">
                    Kết hợp luân phiên Trắc nghiệm, Gõ từ và Nghe gõ từ trong cùng một lượt học.
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-white border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] text-[#1899D6] text-xs font-black shrink-0">
                  +{REWARD_CONFIG.mixed}đ/câu
                </span>
              </button>

              <button
                type="button"
                disabled={!eligibility.canStartQuiz}
                onClick={() => handleTriggerLaunch('flappy')}
                className="w-full p-4 rounded-2xl border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B] hover:bg-[#FFDADC] bg-[#FFDADC]/60 disabled:opacity-45 text-left transition-all active:border-b-2 active:translate-y-0.5 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="font-black text-slate-900 text-sm">
                    2. Flappy Bird Từ Vựng (5 mạng)
                  </div>
                  <p className="text-xs font-bold text-slate-600 mt-1">
                    Điều khiển chim bay qua ống nước và trả lời câu hỏi từ vựng (có hỗ trợ chế độ Tự
                    bay).
                  </p>
                </div>
                <span className="px-3 py-1 rounded-xl bg-white border-2 border-[#FF4B4B] border-b-3 border-b-[#EA2B2B] text-[#EA2B2B] text-xs font-black shrink-0">
                  +{REWARD_CONFIG.flappy}đ/câu
                </span>
              </button>

              <div className="p-4 rounded-2xl border-2 border-[#58CC02] border-b-4 border-b-[#46A302] bg-[#D7FFB8]/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-black text-slate-900 text-sm">
                    3. Giải cứu khỉ khỏi Yeti (Monkey Rescue)
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-white border-2 border-[#58CC02] border-b-3 border-b-[#46A302] text-[#46A302] text-xs font-black">
                    +{REWARD_CONFIG.monkey}đ/câu
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-700">
                  Giữ khoảng cách an toàn (100m, đúng +15m, sai -10m). Chọn hình thức trả lời:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={!eligibility.canStartQuiz}
                    onClick={() => handleTriggerLaunch('monkey', 'quiz')}
                    className="btn-duo-green py-2.5 px-3 rounded-xl disabled:opacity-45 text-xs font-black cursor-pointer"
                  >
                    Chế độ Trắc nghiệm (Yeti 2 m/s)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerLaunch('monkey', 'spell')}
                    className="btn-duo-blue py-2.5 px-3 rounded-xl text-xs font-black cursor-pointer"
                  >
                    Chế độ Gõ từ (Yeti 1 m/s)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add/Edit Word Modal */}
      {editingWordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border-2 border-[#E5E5E5] border-b-8 border-b-[#CECECE] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#F0F0F0] pb-3">
              <h3 className="font-black text-slate-900 text-base">
                {editingWordModal.mode === 'add' ? 'Thêm từ vựng mới' : 'Chỉnh sửa từ vựng'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingWordModal(null)}
                className="btn-duo-white p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Từ / Cụm từ tiếng Anh *
                  </label>
                  <input
                    type="text"
                    value={editingWordModal.word}
                    onChange={(e) =>
                      setEditingWordModal((prev) => (prev ? { ...prev, word: e.target.value } : null))
                    }
                    className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] text-sm font-black focus:outline-hidden focus:border-[#58CC02]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">Từ loại</label>
                  <select
                    value={editingWordModal.partOfSpeech}
                    onChange={(e) =>
                      setEditingWordModal((prev) =>
                        prev ? { ...prev, partOfSpeech: e.target.value as any } : null
                      )
                    }
                    className="w-full px-3 py-2.5 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] text-sm font-black bg-white focus:outline-hidden focus:border-[#58CC02]"
                  >
                    <option value="n">n (Danh từ)</option>
                    <option value="v">v (Động từ)</option>
                    <option value="adj">adj (Tính từ)</option>
                    <option value="adv">adv (Trạng từ)</option>
                    <option value="phr">phr (Cụm từ)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Nghĩa tiếng Việt *
                  </label>
                  <input
                    type="text"
                    value={editingWordModal.meaningVi}
                    onChange={(e) =>
                      setEditingWordModal((prev) =>
                        prev ? { ...prev, meaningVi: e.target.value } : null
                      )
                    }
                    className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] text-sm font-bold focus:outline-hidden focus:border-[#58CC02]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">
                    Phiên âm IPA (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={editingWordModal.phonetic}
                    onChange={(e) =>
                      setEditingWordModal((prev) =>
                        prev ? { ...prev, phonetic: e.target.value } : null
                      )
                    }
                    placeholder="/.../"
                    className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] text-sm font-mono font-bold focus:outline-hidden focus:border-[#58CC02]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Câu ví dụ tiếng Anh
                </label>
                <input
                  type="text"
                  value={editingWordModal.exampleEn}
                  onChange={(e) =>
                    setEditingWordModal((prev) =>
                      prev ? { ...prev, exampleEn: e.target.value } : null
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] text-sm font-bold focus:outline-hidden focus:border-[#58CC02]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  Dịch nghĩa câu ví dụ
                </label>
                <input
                  type="text"
                  value={editingWordModal.exampleVi}
                  onChange={(e) =>
                    setEditingWordModal((prev) =>
                      prev ? { ...prev, exampleVi: e.target.value } : null
                    )
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] text-sm font-bold focus:outline-hidden focus:border-[#58CC02]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t-2 border-[#F0F0F0]">
              <button
                type="button"
                onClick={() => setEditingWordModal(null)}
                className="btn-duo-white px-4 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!editingWordModal.word.trim() || !editingWordModal.meaningVi.trim()}
                onClick={() => {
                  if (!editingWordModal) return;
                  const payload = {
                    word: editingWordModal.word.trim(),
                    phonetic: editingWordModal.phonetic.trim(),
                    partOfSpeech: editingWordModal.partOfSpeech,
                    meaningVi: editingWordModal.meaningVi.trim(),
                    exampleEn: editingWordModal.exampleEn.trim(),
                    exampleVi: editingWordModal.exampleVi.trim(),
                  };
                  if (editingWordModal.mode === 'add' && onAddManualWord) {
                    onAddManualWord(payload);
                  } else if (
                    editingWordModal.mode === 'edit' &&
                    editingWordModal.wordId &&
                    onUpdateManualWord
                  ) {
                    onUpdateManualWord(editingWordModal.wordId, payload);
                  }
                  setEditingWordModal(null);
                }}
                className="btn-duo-green px-5 py-2.5 rounded-2xl disabled:opacity-40 text-xs font-black cursor-pointer"
              >
                Lưu từ vựng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
