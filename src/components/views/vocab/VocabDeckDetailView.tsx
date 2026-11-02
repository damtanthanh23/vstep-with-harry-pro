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
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại danh sách bộ từ
            </button>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{deckTitle}</h1>
            {deckSubtitle && <p className="text-xs sm:text-sm text-slate-500">{deckSubtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenSrsForDeck}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                <Plus className="w-4 h-4" />
                Thêm từ mới
              </button>
            )}

            {isPersonalDeck && onOpenQuickImport && (
              <button
                type="button"
                onClick={onOpenQuickImport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Nhập/Xuất CSV & JSON
              </button>
            )}

            {isPersonalDeck && onOpenAiModal && (
              <button
                type="button"
                onClick={onOpenAiModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition"
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
              <span className="text-slate-600">
                Tổng số từ: <strong className="text-slate-900">{totalCount}</strong>
              </span>
              <span className="text-emerald-700 font-semibold">
                Đã thuộc: <strong>{knownCount}</strong>/{totalCount} từ
              </span>
            </div>
            <span className="font-extrabold text-indigo-600">{knownPercent}% hoàn thành</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
              style={{ width: `${knownPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2. Session Customization Block (Tùy chỉnh lượt học) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              Tùy chỉnh phạm vi lượt học
            </h2>
            <p className="text-xs text-slate-500">
              Áp dụng chung cho cả 6 chế độ luyện tập bên dưới
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-extrabold">
            {selectedSessionCount}/{totalCount} từ được chọn
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-600">1. Trạng thái từ:</label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
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
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                    sessionStatusFilter === st.id
                      ? 'bg-white text-indigo-700 shadow-2xs'
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
            <label className="block text-xs font-bold text-slate-600">2. Số từ tối đa:</label>
            <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl">
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
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition ${
                    sessionMaxCount === cnt.val
                      ? 'bg-white text-indigo-700 shadow-2xs'
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
            <label className="block text-xs font-bold text-slate-600">3. Thứ tự câu hỏi:</label>
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSessionOrder('source')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                  sessionOrder === 'source'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo thứ tự nguồn
              </button>
              <button
                type="button"
                onClick={() => setSessionOrder('random')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition ${
                  sessionOrder === 'random'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ngẫu nhiên (Shuffle)
              </button>
            </div>
          </div>
        </div>

        {selectedSessionCount === 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Không có từ vựng nào khớp với trạng thái &ldquo;
              {sessionStatusFilter === 'known' ? 'Đã thuộc' : 'Chưa thuộc'}&rdquo;. Hãy chuyển sang
              &ldquo;Toàn bộ&rdquo; để bắt đầu học.
            </span>
          </div>
        )}
      </div>

      {/* 3. 6 Mandatory Study Mode Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Flashcard (Violet) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => setActiveSubModeModal('flashcard')}
          className="group text-left p-5 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/80 to-white hover:border-violet-400 hover:shadow-md disabled:opacity-45 transition flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-11 h-11 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-1 rounded-full bg-violet-100 text-violet-800 text-xs font-extrabold">
              +{REWARD_CONFIG.flashcard} điểm/thẻ
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-violet-700">
              1. Thẻ từ (Flashcard)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Lật thẻ Anh → Việt hoặc Việt → Anh, gõ kiểm tra nhanh và tự đánh giá Quên / Thuộc.
            </p>
          </div>
        </button>

        {/* Card 2: Trắc nghiệm (Orange/Amber) */}
        <button
          type="button"
          disabled={!eligibility.canStartQuiz}
          onClick={() => setActiveSubModeModal('quiz')}
          className="group text-left p-5 rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 to-white hover:border-amber-400 hover:shadow-md disabled:opacity-45 transition flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold">
              +{REWARD_CONFIG.quiz} điểm/câu
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-amber-700">
              2. Trắc nghiệm (Quiz)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              3 chế độ: Từ → Nghĩa, Nghĩa → Từ, hoặc Điền khuyết ngữ cảnh (Cloze) trong 30 giây.
            </p>
          </div>
        </button>

        {/* Card 3: Nghe & Gõ (Teal) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => handleTriggerLaunch('dictation')}
          className="group text-left p-5 rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50/80 to-white hover:border-teal-400 hover:shadow-md disabled:opacity-45 transition flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-11 h-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-extrabold">
              +{REWARD_CONFIG.dictation} điểm/câu
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-teal-700">
              3. Nghe & Gõ từ (Dictation)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Nghe phát âm chuẩn với 3 tốc độ (0.75x, 1x, 1.25x) và gõ lại chính xác từ vựng.
            </p>
          </div>
        </button>

        {/* Card 4: Gõ từ (Emerald Green) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => handleTriggerLaunch('spell')}
          className="group text-left p-5 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white hover:border-emerald-400 hover:shadow-md disabled:opacity-45 transition flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Keyboard className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
              +{REWARD_CONFIG.spell} điểm/câu
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-emerald-700">
              4. Gõ từ vựng (Spelling)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Nhìn nghĩa tiếng Việt và câu ví dụ khuyết từ để gõ lại từ tiếng Anh kèm 3 mức gợi ý.
            </p>
          </div>
        </button>

        {/* Card 5: Ghép cặp (Sky Blue) */}
        <button
          type="button"
          disabled={!eligibility.canStartMatch}
          onClick={() => handleTriggerLaunch('match')}
          className="group text-left p-5 rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50/80 to-white hover:border-sky-400 hover:shadow-md disabled:opacity-45 transition flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Puzzle className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-extrabold">
              +{REWARD_CONFIG.match} điểm/cặp
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-sky-700">
              5. Ghép cặp (Matching)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Ghép nhanh tối đa 8 cặp từ/vòng với 5 tim mạng sống. Yêu cầu tối thiểu 2 từ.
            </p>
          </div>
        </button>

        {/* Card 6: Đặc biệt (Pink/Rose) */}
        <button
          type="button"
          disabled={!eligibility.canStartAny}
          onClick={() => setActiveSubModeModal('special')}
          className="group text-left p-5 rounded-2xl border-2 border-pink-200 bg-gradient-to-br from-pink-50/80 to-white hover:border-pink-400 hover:shadow-md disabled:opacity-45 transition flex flex-col justify-between gap-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="w-11 h-11 rounded-xl bg-pink-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="px-2.5 py-1 rounded-full bg-pink-100 text-pink-800 text-xs font-extrabold">
              +10 đến +20 điểm
            </span>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-pink-700">
              6. Chế độ Đặc biệt
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Hỗn hợp (Mixed +20đ), Flappy Bird từ vựng (+20đ), và Giải cứu khỉ khỏi Yeti (+10đ).
            </p>
          </div>
        </button>
      </div>

      {/* 4. Word List Table (Danh sách từ vựng trong bộ) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Danh sách từ vựng trong bộ ({tableRows.length}/{totalCount})
            </h2>
            <p className="text-xs text-slate-500">
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
                className="pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={tableStatusFilter}
              onChange={(e) => setTableStatusFilter(e.target.value as any)}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl bg-white text-slate-700"
            >
              <option value="all">Hiển thị: Tất cả</option>
              <option value="unknown">Hiển thị: Chưa thuộc</option>
              <option value="known">Hiển thị: Đã thuộc</option>
            </select>
          </div>
        </div>

        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-3 w-12 text-center">Loa</th>
                  <th className="py-3 px-3">Từ vựng & IPA</th>
                  <th className="py-3 px-3">Nghĩa tiếng Việt</th>
                  <th className="py-3 px-3">Câu ví dụ</th>
                  <th className="py-3 px-3 text-center w-28">Đã thuộc</th>
                  {isPersonalDeck && <th className="py-3 px-3 text-right w-24">Sửa/Xóa</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isPersonalDeck ? 6 : 5}
                      className="py-10 text-center text-slate-400"
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
                            ? 'bg-emerald-50/60 hover:bg-emerald-50'
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
                            className={`p-2 rounded-xl transition cursor-pointer ${
                              playingWordId === item.id
                                ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400 scale-110 shadow-xs'
                                : 'text-indigo-600 hover:bg-indigo-100/70 hover:scale-105'
                            }`}
                            title={playingWordId === item.id ? 'Đang phát âm...' : 'Bấm để nghe phát âm tiếng Anh chuẩn'}
                          >
                            <Volume2
                              className={`w-4 h-4 ${
                                playingWordId === item.id ? 'animate-bounce text-amber-600' : ''
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-900">{item.word}</span>
                            {item.phonetic && (
                              <span className="text-xs font-mono text-slate-500">
                                {item.phonetic}
                              </span>
                            )}
                            <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                              {item.partOfSpeech}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          {item.meaningVi}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 max-w-md">
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
                              isKnown ? 'bg-emerald-600' : 'bg-slate-300'
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
                            <div className="inline-flex items-center gap-1">
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
                                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                                  title="Sửa từ này"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                              {onDeleteManualWord && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteManualWord(item.id)}
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                Chọn chiều lật Thẻ từ (Flashcard)
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubModeModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleTriggerLaunch('flashcard', 'en_to_vn')}
                className="w-full p-4 rounded-xl border-2 border-violet-200 hover:border-violet-500 bg-violet-50/40 text-left transition"
              >
                <div className="font-extrabold text-slate-900 text-sm">
                  1. Tiếng Anh → Tiếng Việt (EN → VN)
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Mặt trước hiển thị từ tiếng Anh, phiên âm & âm thanh. Mặt sau hiển thị nghĩa tiếng
                  Việt.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerLaunch('flashcard', 'vn_to_en')}
                className="w-full p-4 rounded-xl border-2 border-violet-200 hover:border-violet-500 bg-violet-50/40 text-left transition"
              >
                <div className="font-extrabold text-slate-900 text-sm">
                  2. Tiếng Việt → Tiếng Anh (VN → EN)
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                Chọn kiểu câu hỏi Trắc nghiệm (Quiz)
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubModeModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleTriggerLaunch('quiz', 'word_to_meaning')}
                className="w-full p-4 rounded-xl border-2 border-amber-200 hover:border-amber-500 bg-amber-50/40 text-left transition"
              >
                <div className="font-extrabold text-slate-900 text-sm">1. Từ → Nghĩa</div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nhìn từ tiếng Anh (kèm IPA & âm thanh), chọn nghĩa tiếng Việt chính xác.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTriggerLaunch('quiz', 'meaning_to_word')}
                className="w-full p-4 rounded-xl border-2 border-amber-200 hover:border-amber-500 bg-amber-50/40 text-left transition"
              >
                <div className="font-extrabold text-slate-900 text-sm">2. Nghĩa → Từ</div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Nhìn nghĩa tiếng Việt (ẩn IPA đáp án), chọn từ tiếng Anh chính xác.
                </p>
              </button>

              <button
                type="button"
                disabled={!eligibility.canStartCloze}
                onClick={() => handleTriggerLaunch('quiz', 'context_cloze')}
                className="w-full p-4 rounded-xl border-2 border-amber-200 hover:border-amber-500 bg-amber-50/40 disabled:opacity-45 text-left transition"
              >
                <div className="font-extrabold text-slate-900 text-sm">
                  3. Ngữ cảnh điền khuyết (Cloze) ({eligibility.clozeEligibleCount} câu hợp lệ)
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Điền từ còn thiếu vào chỗ trống &ldquo;_____&rdquo; trong câu ví dụ tiếng Anh.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submode Modal 3: Special Modes (Mixed, Flappy Bird, Monkey Rescue) */}
      {activeSubModeModal === 'special' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                Chọn Chế độ Học Đặc biệt
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubModeModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleTriggerLaunch('mixed')}
                className="w-full p-4 rounded-xl border-2 border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 text-left transition flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    1. Chế độ Hỗn hợp (Mixed Mode)
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Kết hợp luân phiên Trắc nghiệm, Gõ từ và Nghe gõ từ trong cùng một lượt học.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold shrink-0">
                  +{REWARD_CONFIG.mixed}đ/câu
                </span>
              </button>

              <button
                type="button"
                disabled={!eligibility.canStartQuiz}
                onClick={() => handleTriggerLaunch('flappy')}
                className="w-full p-4 rounded-xl border-2 border-pink-200 hover:border-pink-500 bg-pink-50/40 disabled:opacity-45 text-left transition flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-extrabold text-slate-900 text-sm">
                    2. Flappy Bird Từ Vựng (5 mạng)
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Điều khiển chim bay qua ống nước và trả lời câu hỏi từ vựng (có hỗ trợ chế độ Tự
                    bay).
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-pink-100 text-pink-800 text-xs font-extrabold shrink-0">
                  +{REWARD_CONFIG.flappy}đ/câu
                </span>
              </button>

              <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-slate-900 text-sm">
                    3. Giải cứu khỉ khỏi Yeti (Monkey Rescue)
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                    +{REWARD_CONFIG.monkey}đ/câu
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Giữ khoảng cách an toàn (100m, đúng +15m, sai -10m). Chọn hình thức trả lời:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!eligibility.canStartQuiz}
                    onClick={() => handleTriggerLaunch('monkey', 'quiz')}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-45 text-white text-xs font-bold shadow-2xs transition"
                  >
                    Chế độ Trắc nghiệm (Yeti 2 m/s)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerLaunch('monkey', 'spell')}
                    className="py-2.5 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs transition"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingWordModal.mode === 'add' ? 'Thêm từ vựng mới' : 'Chỉnh sửa từ vựng'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingWordModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Từ / Cụm từ tiếng Anh *
                  </label>
                  <input
                    type="text"
                    value={editingWordModal.word}
                    onChange={(e) =>
                      setEditingWordModal((prev) => (prev ? { ...prev, word: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Từ loại</label>
                  <select
                    value={editingWordModal.partOfSpeech}
                    onChange={(e) =>
                      setEditingWordModal((prev) =>
                        prev ? { ...prev, partOfSpeech: e.target.value as any } : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold bg-white"
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingWordModal(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold"
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
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold"
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
