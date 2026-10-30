import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Layers,
  CheckCircle2,
  Brain,
  Zap,
  Volume2,
  Keyboard,
  RotateCcw,
  Trophy,
  Flame,
  Check,
  X,
  Play,
  Shuffle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Headphones,
} from 'lucide-react';
import {
  UserVocabDeck,
  ExtendedVocabItem,
  VocabGameMode,
  VocabSrsRecord,
} from '../../../types/vocab';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';

interface VocabStudyHubTabProps {
  decks: UserVocabDeck[];
  activeDeckId: string;
  onSelectDeck: (deckId: string) => void;
  srsRecords: Record<string, VocabSrsRecord>;
  onRateSrsWord: (wordId: string, rating: 'again' | 'hard' | 'good' | 'easy') => void;
  streakCount: number;
  coinCount: number;
  onEarnCoins: (amount: number) => void;
}

export const VocabStudyHubTab: React.FC<VocabStudyHubTabProps> = ({
  decks,
  activeDeckId,
  onSelectDeck,
  srsRecords,
  onRateSrsWord,
  streakCount,
  coinCount,
  onEarnCoins,
}) => {
  // Setup filters
  const [statusFilter, setStatusFilter] = useState<'unmastered' | 'mastered' | 'all'>('unmastered');
  const [orderMode, setOrderMode] = useState<'random' | 'default'>('random');
  const [wordCountLimit, setWordCountLimit] = useState<number>(10);

  // Active game session
  const [activeGame, setActiveGame] = useState<VocabGameMode | null>(null);

  // Active deck
  const currentDeck = useMemo(() => {
    return decks.find((d) => d.id === activeDeckId) || decks[0] || null;
  }, [decks, activeDeckId]);

  // Available words in current deck
  const poolWords = useMemo(() => {
    if (!currentDeck) return [];
    let items = [...(currentDeck.items || [])];

    // Status filter
    if (statusFilter === 'unmastered') {
      items = items.filter((w) => !w.isMastered);
    } else if (statusFilter === 'mastered') {
      items = items.filter((w) => w.isMastered);
    }

    // Fallback if empty and unmastered was picked
    if (items.length === 0 && (currentDeck.items || []).length > 0) {
      items = [...(currentDeck.items || [])];
    }

    // Order
    if (orderMode === 'random') {
      items = [...items].sort(() => Math.random() - 0.5);
    }

    // Word count limit
    if (wordCountLimit > 0) {
      items = items.slice(0, wordCountLimit);
    }

    return items;
  }, [currentDeck, statusFilter, orderMode, wordCountLimit]);

  // SRS due count
  const dueSrsWords = useMemo(() => {
    const now = Date.now();
    const allWords = currentDeck?.items || [];
    return allWords.filter((w) => {
      const rec = srsRecords[w.id];
      if (!rec) return true; // new words are due
      return rec.dueAt <= now;
    });
  }, [currentDeck, srsRecords]);

  // ==========================================
  // GAME RUNNER INNER STATES
  // ==========================================
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [score, setScore] = useState(0);

  // Quiz state
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<string | null>(null);
  const [quizOptions, setQuizOptions] = useState<ExtendedVocabItem[]>([]);

  // Spelling state
  const [spellInput, setSpellInput] = useState('');
  const [spellFeedback, setSpellFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Matching game state
  const [matchedPairs, setMatchedPairs] = useState<Set<string>>(new Set());
  const [selectedMatchLeft, setSelectedMatchLeft] = useState<string | null>(null);
  const [selectedMatchRight, setSelectedMatchRight] = useState<string | null>(null);
  const [shuffledLeft, setShuffledLeft] = useState<ExtendedVocabItem[]>([]);
  const [shuffledRight, setShuffledRight] = useState<ExtendedVocabItem[]>([]);

  // Initialize game
  const startGame = (mode: VocabGameMode) => {
    if (poolWords.length === 0) return;
    setActiveGame(mode);
    setCurrentIndex(0);
    setIsFlipped(false);
    setScore(0);
    setSpellInput('');
    setSpellFeedback(null);
    setSelectedQuizAnswer(null);

    // Matching mode setup
    if (mode === 'match') {
      const sample = poolWords.slice(0, 6);
      setShuffledLeft([...sample].sort(() => Math.random() - 0.5));
      setShuffledRight([...sample].sort(() => Math.random() - 0.5));
      setMatchedPairs(new Set());
      setSelectedMatchLeft(null);
      setSelectedMatchRight(null);
    }
  };

  const currentWord = poolWords[currentIndex] || null;

  // Setup quiz options when current word changes
  useEffect(() => {
    if (activeGame === 'quiz' && currentWord && poolWords.length > 0) {
      setSelectedQuizAnswer(null);
      const wrong = poolWords.filter((w) => w.id !== currentWord.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const all = [...wrong, currentWord].sort(() => Math.random() - 0.5);
      setQuizOptions(all);
    }
  }, [activeGame, currentIndex, currentWord]);

  // Play audio automatically on flashcard or dictation
  useEffect(() => {
    if (currentWord && (activeGame === 'flashcard' || activeGame === 'dictation')) {
      playDictionaryAudio(currentWord.word, 'uk');
    }
  }, [activeGame, currentIndex]);

  // Handle Quiz pick
  const handleQuizPick = (opt: ExtendedVocabItem) => {
    if (selectedQuizAnswer || !currentWord) return;
    setSelectedQuizAnswer(opt.id);

    if (opt.id === currentWord.id) {
      setScore((s) => s + 1);
      onEarnCoins(5);
    }

    setTimeout(() => {
      if (currentIndex + 1 < poolWords.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        // finished
        alert(`Chúc mừng! Bạn đã hoàn thành bài trắc nghiệm với điểm số: ${score + (opt.id === currentWord.id ? 1 : 0)}/${poolWords.length}`);
        setActiveGame(null);
      }
    }, 1200);
  };

  // Handle Spell submit
  const handleSpellSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWord || spellFeedback) return;

    const cleanInput = spellInput.trim().toLowerCase();
    const cleanTarget = currentWord.word.trim().toLowerCase();

    if (cleanInput === cleanTarget) {
      setSpellFeedback('correct');
      setScore((s) => s + 1);
      onEarnCoins(10);
      playDictionaryAudio(currentWord.word, 'uk');
      setTimeout(() => {
        setSpellFeedback(null);
        setSpellInput('');
        if (currentIndex + 1 < poolWords.length) {
          setCurrentIndex((i) => i + 1);
        } else {
          alert(`Tuyệt vời! Bạn đã hoàn thành bài gõ từ vựng!`);
          setActiveGame(null);
        }
      }, 1000);
    } else {
      setSpellFeedback('wrong');
      setTimeout(() => setSpellFeedback(null), 1500);
    }
  };

  // Handle Matching click
  const handleMatchLeftClick = (id: string) => {
    if (matchedPairs.has(id)) return;
    setSelectedMatchLeft(id);
    if (selectedMatchRight) {
      checkMatch(id, selectedMatchRight);
    }
  };

  const handleMatchRightClick = (id: string) => {
    if (matchedPairs.has(id)) return;
    setSelectedMatchRight(id);
    if (selectedMatchLeft) {
      checkMatch(selectedMatchLeft, id);
    }
  };

  const checkMatch = (leftId: string, rightId: string) => {
    if (leftId === rightId) {
      // correct match
      const next = new Set(matchedPairs);
      next.add(leftId);
      setMatchedPairs(next);
      setSelectedMatchLeft(null);
      setSelectedMatchRight(null);
      onEarnCoins(5);

      if (next.size === shuffledLeft.length) {
        setTimeout(() => {
          alert('Xuất sắc! Bạn đã nối hoàn tất tất cả các cặp từ!');
          setActiveGame(null);
        }, 600);
      }
    } else {
      // mismatch
      setTimeout(() => {
        setSelectedMatchLeft(null);
        setSelectedMatchRight(null);
      }, 500);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. TOP STREAK & STATS HEADER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-2xl">
            🔥
          </div>
          <div>
            <h3 className="font-extrabold text-lg leading-tight">
              Trung Tâm Luyện Tập & Game Từ Vựng
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              Chuỗi học liên tục: <span className="font-bold text-amber-300">{streakCount} ngày</span> • Thưởng xu: <span className="font-bold text-amber-300">+{coinCount} xu</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20">
            🎯 Đã chọn: {currentDeck?.name || 'Mặc định'}
          </span>
        </div>
      </div>

      {/* 2. FILTER & SETUP BAR */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Deck select */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              BỘ TỪ:
            </span>
            <select
              value={currentDeck?.id || ''}
              onChange={(e) => onSelectDeck(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.icon} {d.name} ({d.items?.length || 0} từ)
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setStatusFilter('unmastered')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'unmastered'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Chưa thuộc
            </button>
            <button
              onClick={() => setStatusFilter('mastered')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'mastered'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Đã thuộc
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Order */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setOrderMode(orderMode === 'random' ? 'default' : 'random')}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                orderMode === 'random'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              {orderMode === 'random' ? 'Ngẫu nhiên' : 'Thứ tự mặc định'}
            </button>
          </div>

          {/* Word count limit */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 font-semibold">Số từ:</span>
            {[10, 20, 50, 0].map((num) => (
              <button
                key={num}
                onClick={() => setWordCountLimit(num)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  wordCountLimit === num
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {num === 0 ? 'Tất cả' : num}
              </button>
            ))}
          </div>

          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
            Sẵn sàng: {poolWords.length} từ
          </div>
        </div>
      </div>

      {/* 3. SRS SM-2 BANNER CARD */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-2xl">
            🧠
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-base">
                Thuật Toán Lặp Lại Ngắt Quãng (SRS SM-2)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-orange-600">
                ANKI ENGINE
              </span>
            </div>
            <p className="text-xs text-white/90 mt-1">
              Hôm nay có <strong className="underline">{dueSrsWords.length} từ vựng</strong> cần ôn tập lại để không rơi vào đường cong quên lãng Ebbinghaus.
            </p>
          </div>
        </div>

        <button
          onClick={() => startGame('srs')}
          disabled={dueSrsWords.length === 0}
          className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-orange-600 font-bold text-xs shadow-md disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
        >
          <Play className="w-4 h-4 fill-orange-600" />
          Bắt đầu ôn tập SRS ({dueSrsWords.length})
        </button>
      </div>

      {/* 4. 6 INTERACTIVE GAME MODE CARDS */}
      <div className="space-y-3">
        <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>6 Chế Độ Luyện Tập Đổi Thưởng</span>
          <span className="text-xs text-slate-400 font-normal">
            (Chọn 1 chế độ để bắt đầu ngay)
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Flashcard 3D */}
          <div
            onClick={() => startGame('flashcard')}
            className="group cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary-500 dark:hover:border-primary-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                  📋
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  Căn bản
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-primary-600 transition-colors">
                Flashcard 3D Lật Thẻ
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Lật thẻ hai mặt kèm âm thanh bản xứ Oxford/Cambridge, phiên âm IPA và ví dụ song ngữ.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-primary-600 dark:text-primary-400">
              <span>Bắt đầu lật thẻ</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. Trắc nghiệm */}
          <div
            onClick={() => startGame('quiz')}
            className="group cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                  ☑️
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  Phản xạ
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">
                Trắc Nghiệm 4 Lựa Chọn
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Phản xạ nhanh chọn định nghĩa hoặc từ vựng chính xác trong 4 phương án, tích lũy xu thưởng.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <span>Vào thi trắc nghiệm</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. Nối từ với nghĩa */}
          <div
            onClick={() => startGame('match')}
            className="group cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-purple-500 dark:hover:border-purple-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
                  ⊞
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                  Tốc độ
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                Nối Từ Với Nghĩa (Word Match)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Ghép cặp từ tiếng Anh và nghĩa tiếng Việt tương ứng càng nhanh càng tốt để lập kỷ lục cá nhân.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
              <span>Chơi ghép thẻ</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 4. Gõ từ vựng */}
          <div
            onClick={() => startGame('spell')}
            className="group cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-amber-500 dark:hover:border-amber-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                  🔤
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                  Chính tả
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                Gõ Từ Vựng (Spelling & Writing)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Gợi ý nghĩa tiếng Việt và phiên âm để luyện thói quen gõ chính xác từng ký tự cho bài thi Viết.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
              <span>Luyện gõ từ</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 5. Nghe viết */}
          <div
            onClick={() => startGame('dictation')}
            className="group cursor-pointer p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-rose-500 dark:hover:border-rose-500 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600">
                  🎧
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                  Nghe & Chép
                </span>
              </div>
              <h4 className="font-bold text-base text-slate-800 dark:text-slate-100 group-hover:text-rose-600 transition-colors">
                Nghe Viết (Dictation Audio)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Lắng nghe audio phát âm người bản xứ và gõ lại từ vựng mà không xem mặt chữ trước.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400">
              <span>Luyện nghe chép</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 6. Thử thách đặc biệt (HOT) */}
          <div
            onClick={() => startGame('mixed')}
            className="group cursor-pointer p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-900 dark:to-slate-850 border-2 border-orange-400/70 dark:border-orange-500/50 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl p-2.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600">
                  🔀
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500 text-white">
                  HOT MIXED
                </span>
              </div>
              <h4 className="font-extrabold text-base text-orange-950 dark:text-orange-200">
                Thử Thách Đặc Biệt (Speed Run)
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Chế độ hỗn hợp đan xen giữa trắc nghiệm, lật thẻ và gõ từ với thời gian giới hạn để nhân đôi xu thưởng!
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-orange-200/60 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-orange-600 dark:text-orange-400">
              <span>Chiến thử thách ngay</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTIVE GAME MODAL RUNNER */}
      {/* ========================================================================= */}
      {activeGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col min-h-[480px]">
            {/* Game Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                  {activeGame.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500">
                  Từ {currentIndex + 1} / {poolWords.length}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                  🪙 +{score * 5} xu
                </span>
                <button
                  onClick={() => setActiveGame(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Game Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-primary-600 transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / poolWords.length) * 100}%` }}
              />
            </div>

            {/* Content Area */}
            <div className="p-6 flex-1 flex flex-col justify-center items-center">
              {/* 1. FLASHCARD 3D */}
              {activeGame === 'flashcard' && currentWord && (
                <div className="w-full max-w-md space-y-6 text-center">
                  <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="min-h-[260px] p-8 rounded-3xl border-2 border-primary-200 dark:border-primary-800/60 bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-850 shadow-lg cursor-pointer flex flex-col justify-center items-center transition-all hover:scale-101"
                  >
                    {!isFlipped ? (
                      /* FRONT */
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-2">
                          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                            {currentWord.word}
                          </h2>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playDictionaryAudio(currentWord.word, 'uk');
                            }}
                            className="p-2 text-primary-600 hover:bg-primary-50 rounded-full"
                          >
                            <Volume2 className="w-6 h-6" />
                          </button>
                        </div>
                        <p className="text-sm font-mono text-slate-400">
                          {currentWord.phonetic}
                        </p>
                        <p className="text-xs text-slate-400 italic">
                          (Nhấn để lật thẻ xem nghĩa)
                        </p>
                      </div>
                    ) : (
                      /* BACK */
                      <div className="space-y-3 animate-fade-in">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 uppercase">
                          {currentWord.partOfSpeech}
                        </span>
                        <h3 className="text-xl font-bold text-primary-700 dark:text-primary-300">
                          {currentWord.meaningVi}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                          "{currentWord.exampleEn}"
                        </p>
                        <p className="text-xs text-slate-500">
                          {currentWord.exampleVi}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (currentIndex > 0) {
                          setCurrentIndex((i) => i - 1);
                          setIsFlipped(false);
                        }
                      }}
                      disabled={currentIndex === 0}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold disabled:opacity-40"
                    >
                      <ArrowLeft className="w-4 h-4 inline mr-1" /> Câu trước
                    </button>
                    <button
                      onClick={() => {
                        if (currentIndex + 1 < poolWords.length) {
                          setCurrentIndex((i) => i + 1);
                          setIsFlipped(false);
                          onEarnCoins(2);
                        } else {
                          alert('Chúc mừng bạn đã hoàn thành bộ flashcard!');
                          setActiveGame(null);
                        }
                      }}
                      className="px-5 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold shadow-sm"
                    >
                      {currentIndex + 1 < poolWords.length ? 'Câu tiếp theo' : 'Hoàn thành'}{' '}
                      <ArrowRight className="w-4 h-4 inline ml-1" />
                    </button>
                  </div>
                </div>
              )}

              {/* 2. QUIZ */}
              {activeGame === 'quiz' && currentWord && (
                <div className="w-full max-w-lg space-y-6">
                  <div className="text-center space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      CHỌN NGHĨA ĐÚNG CỦA TỪ
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                        {currentWord.word}
                      </h2>
                      <button
                        type="button"
                        onClick={() => playDictionaryAudio(currentWord.word, 'uk')}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-full"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-400">{currentWord.phonetic}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {quizOptions.map((opt) => {
                      const isPicked = selectedQuizAnswer === opt.id;
                      const isCorrect = opt.id === currentWord.id;

                      let btnStyle = 'border-slate-200 dark:border-slate-700 hover:border-primary-400 bg-white dark:bg-slate-800';
                      if (selectedQuizAnswer) {
                        if (isCorrect) {
                          btnStyle = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold';
                        } else if (isPicked) {
                          btnStyle = 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300';
                        }
                      }

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleQuizPick(opt)}
                          disabled={!!selectedQuizAnswer}
                          className={`p-4 rounded-2xl border text-sm text-left transition-all flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{opt.meaningVi}</span>
                          {selectedQuizAnswer && isCorrect && <Check className="w-5 h-5 text-emerald-500" />}
                          {selectedQuizAnswer && isPicked && !isCorrect && <X className="w-5 h-5 text-red-500" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. SPELL / DICTATION */}
              {(activeGame === 'spell' || activeGame === 'dictation') && currentWord && (
                <div className="w-full max-w-md space-y-6 text-center">
                  <div className="space-y-2">
                    {activeGame === 'dictation' ? (
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          NGHE VÀ GÕ LẠI TỪ CHÍNH XÁC
                        </span>
                        <div className="my-4">
                          <button
                            type="button"
                            onClick={() => playDictionaryAudio(currentWord.word, 'uk')}
                            className="p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl shadow-md transition-all inline-flex items-center gap-2 font-bold text-sm"
                          >
                            <Volume2 className="w-6 h-6" /> Bấm để nghe lại
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          GÕ TỪ VỰNG TIẾNG ANH TƯƠNG ỨNG
                        </span>
                        <h3 className="text-2xl font-black text-primary-600 dark:text-primary-400 mt-2">
                          {currentWord.meaningVi}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-1">
                          Phiên âm gợi ý: {currentWord.phonetic}
                        </p>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSpellSubmit} className="space-y-3">
                    <input
                      type="text"
                      value={spellInput}
                      onChange={(e) => setSpellInput(e.target.value)}
                      placeholder="Gõ từ vựng tại đây..."
                      className={`w-full p-4 text-center rounded-2xl border text-lg font-bold tracking-wider focus:outline-none transition-all ${
                        spellFeedback === 'correct'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : spellFeedback === 'wrong'
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-600'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-sm transition-colors"
                    >
                      Kiểm tra
                    </button>
                  </form>
                </div>
              )}

              {/* 4. MATCHING */}
              {activeGame === 'match' && (
                <div className="w-full max-w-xl space-y-4">
                  <div className="text-center text-xs text-slate-400 font-semibold">
                    Nhấn vào 1 thẻ tiếng Anh và 1 thẻ nghĩa tiếng Việt tương ứng
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Left: English words */}
                    <div className="space-y-2">
                      {shuffledLeft.map((item) => {
                        const isDone = matchedPairs.has(item.id);
                        const isSelected = selectedMatchLeft === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleMatchLeftClick(item.id)}
                            disabled={isDone}
                            className={`w-full p-3.5 rounded-xl border text-xs font-bold transition-all text-left ${
                              isDone
                                ? 'opacity-30 border-slate-200 line-through'
                                : isSelected
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-600 shadow-sm'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            {item.word}
                          </button>
                        );
                      })}
                    </div>

                    {/* Right: Vietnamese meanings */}
                    <div className="space-y-2">
                      {shuffledRight.map((item) => {
                        const isDone = matchedPairs.has(item.id);
                        const isSelected = selectedMatchRight === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleMatchRightClick(item.id)}
                            disabled={isDone}
                            className={`w-full p-3.5 rounded-xl border text-xs font-medium transition-all text-left ${
                              isDone
                                ? 'opacity-30 border-slate-200 line-through'
                                : isSelected
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 text-purple-600 shadow-sm'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            {item.meaningVi}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. SRS 4-BUTTON ANKI RUNNER */}
              {activeGame === 'srs' && currentWord && (
                <div className="w-full max-w-md space-y-6 text-center">
                  <div
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="min-h-[220px] p-6 rounded-3xl border-2 border-orange-200 dark:border-orange-900 bg-white dark:bg-slate-800 shadow-md cursor-pointer flex flex-col justify-center items-center"
                  >
                    {!isFlipped ? (
                      <div className="space-y-3">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100">
                          {currentWord.word}
                        </h2>
                        <p className="text-xs font-mono text-slate-400">{currentWord.phonetic}</p>
                        <p className="text-xs text-orange-500 font-semibold">(Nhấn xem đáp án)</p>
                      </div>
                    ) : (
                      <div className="space-y-2 animate-fade-in">
                        <h3 className="text-xl font-bold text-orange-600">{currentWord.meaningVi}</h3>
                        <p className="text-xs italic text-slate-500">"{currentWord.exampleEn}"</p>
                      </div>
                    )}
                  </div>

                  {/* 4 Anki Rating Buttons */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      ĐÁNH GIÁ MỨC ĐỘ NHỚ CỦA BẠN:
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => {
                          onRateSrsWord(currentWord.id, 'again');
                          if (currentIndex + 1 < dueSrsWords.length) {
                            setCurrentIndex((i) => i + 1);
                            setIsFlipped(false);
                          } else {
                            alert('Hoàn thành phiên ôn tập SRS hôm nay!');
                            setActiveGame(null);
                          }
                        }}
                        className="py-3 px-1 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100"
                      >
                        Again
                        <span className="block text-[10px] font-normal text-slate-400">&lt;10m</span>
                      </button>
                      <button
                        onClick={() => {
                          onRateSrsWord(currentWord.id, 'hard');
                          if (currentIndex + 1 < dueSrsWords.length) {
                            setCurrentIndex((i) => i + 1);
                            setIsFlipped(false);
                          } else {
                            alert('Hoàn thành phiên ôn tập SRS hôm nay!');
                            setActiveGame(null);
                          }
                        }}
                        className="py-3 px-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-100"
                      >
                        Hard
                        <span className="block text-[10px] font-normal text-slate-400">1d</span>
                      </button>
                      <button
                        onClick={() => {
                          onRateSrsWord(currentWord.id, 'good');
                          if (currentIndex + 1 < dueSrsWords.length) {
                            setCurrentIndex((i) => i + 1);
                            setIsFlipped(false);
                          } else {
                            alert('Hoàn thành phiên ôn tập SRS hôm nay!');
                            setActiveGame(null);
                          }
                        }}
                        className="py-3 px-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100"
                      >
                        Good
                        <span className="block text-[10px] font-normal text-slate-400">3d</span>
                      </button>
                      <button
                        onClick={() => {
                          onRateSrsWord(currentWord.id, 'easy');
                          if (currentIndex + 1 < dueSrsWords.length) {
                            setCurrentIndex((i) => i + 1);
                            setIsFlipped(false);
                          } else {
                            alert('Hoàn thành phiên ôn tập SRS hôm nay!');
                            setActiveGame(null);
                          }
                        }}
                        className="py-3 px-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100"
                      >
                        Easy
                        <span className="block text-[10px] font-normal text-slate-400">7d</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
