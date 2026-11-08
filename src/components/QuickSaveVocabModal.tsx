import React, { useState, useEffect } from 'react';
import {
  X,
  BookmarkPlus,
  Sparkles,
  Volume2,
  CheckCircle2,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { ExtendedVocabItem, UserVocabDeck } from '../types/vocab';
import {
  loadUserVocabState,
  enrollWordInSrsManual,
  saveUserVocabState,
} from '../services/vocabStorageService';
import {
  savePersonalDecksToCloud,
  syncUserVocabStateToCloud,
} from '../services/vocabCloudService';
import { useAuth } from '../context/AuthContext';
import { examAudioManager } from '../utils/audioManager';

export interface QuickSaveVocabPayload {
  initialWord: string;
  contextSentence?: string;
  sourceLabel?: string;
  testId?: string;
  testTitle?: string;
}

interface QuickSaveVocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: QuickSaveVocabPayload | null;
}

export const QuickSaveVocabModal: React.FC<QuickSaveVocabModalProps> = ({
  isOpen,
  onClose,
  payload,
}) => {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || 'guest';

  const [word, setWord] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState<'n' | 'v' | 'adj' | 'adv' | 'phr'>('n');
  const [meaningVi, setMeaningVi] = useState('');
  const [exampleEn, setExampleEn] = useState('');
  const [exampleVi, setExampleVi] = useState('');
  const [collocations, setCollocations] = useState('');

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lookupWithAi = async (targetWord: string, targetContext?: string) => {
    const cleanW = targetWord.trim();
    if (!cleanW) return;
    setIsLookingUp(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/quick-vocab-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: cleanW,
          contextSentence: targetContext || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.word) setWord(data.word);
        if (data.phonetic) setPhonetic(data.phonetic);
        if (data.partOfSpeech && ['n', 'v', 'adj', 'adv', 'phr'].includes(data.partOfSpeech)) {
          setPartOfSpeech(data.partOfSpeech);
        }
        if (data.meaningVi) setMeaningVi(data.meaningVi);
        if (data.exampleEn) setExampleEn(data.exampleEn);
        if (data.exampleVi) setExampleVi(data.exampleVi);
        if (data.collocations) setCollocations(data.collocations);
      }
    } catch {
      // Keep current manual fields
    } finally {
      setIsLookingUp(false);
    }
  };

  useEffect(() => {
    if (isOpen && payload) {
      const initW = (payload.initialWord || '').trim().slice(0, 80);
      const initCtx = (payload.contextSentence || '').trim().slice(0, 350);
      setWord(initW);
      setPhonetic('');
      setPartOfSpeech(initW.includes(' ') ? 'phr' : 'n');
      setMeaningVi('');
      setExampleEn(initCtx);
      setExampleVi('');
      setCollocations('');
      setSavedSuccess(false);
      setErrorMsg(null);

      if (initW.length >= 2) {
        lookupWithAi(initW, initCtx);
      }
    }
  }, [isOpen, payload]);

  if (!isOpen || !payload) return null;

  const handleSaveToSrsDeck = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWord = word.trim();
    const cleanMeaning = meaningVi.trim();
    if (!cleanWord) {
      setErrorMsg('Vui lòng nhập từ hoặc cụm từ tiếng Anh.');
      return;
    }
    if (!cleanMeaning) {
      setErrorMsg('Vui lòng nhập nghĩa tiếng Việt (hoặc bấm nút Tự động điền bằng AI).');
      return;
    }

    const decksStorageKey = `langcert_personal_decks_v3_${uid}`;
    let personalDecks: UserVocabDeck[] = [];
    try {
      const raw = localStorage.getItem(decksStorageKey);
      if (raw) {
        personalDecks = JSON.parse(raw);
      }
    } catch {
      personalDecks = [];
    }

    const targetDeckId = payload.testId
      ? `exam_saved_${payload.testId}_${uid}`
      : `exam_saved_general_${uid}`;
    const targetDeckName = payload.testTitle
      ? `Từ vựng từ đề: ${payload.testTitle}`
      : 'Từ vựng lưu từ Phòng thi & Giải thích';

    let deck = personalDecks.find((d) => d.id === targetDeckId);
    const now = Date.now();
    const newWordId = `qsave_${now}_${Math.random().toString(36).slice(2, 6)}`;

    const newVocabItem: ExtendedVocabItem = {
      id: newWordId,
      word: cleanWord,
      phonetic: phonetic.trim() || '',
      partOfSpeech,
      meaningVi: cleanMeaning,
      exampleEn:
        exampleEn.trim() ||
        payload.contextSentence ||
        `We learned the term "${cleanWord}" in our VSTEP practice.`,
      exampleVi: exampleVi.trim() || cleanMeaning,
      topic: payload.sourceLabel || 'VSTEP Exam Reading & Listening',
      cefr: 'B1',
      collocations: collocations.trim() || undefined,
      note: payload.sourceLabel
        ? `Lưu từ ${payload.sourceLabel}${payload.testTitle ? ` (${payload.testTitle})` : ''}`
        : 'Lưu trực tiếp khi làm đề VSTEP',
      addedAt: now,
      linkedTestId: payload.testId,
      linkedTestTitle: payload.testTitle,
    };

    if (!deck) {
      deck = {
        id: targetDeckId,
        name: targetDeckName,
        title: targetDeckName,
        description: 'Bộ thẻ tự động gom các từ mới bạn lưu trực tiếp khi đọc bài và xem giải thích đề thi VSTEP.',
        icon: '🔖',
        isCustom: true,
        categoryType: 'exam_test',
        linkedTestId: payload.testId,
        linkedTestTitle: payload.testTitle,
        createdAt: now,
        updatedAt: now,
        itemCount: 1,
        items: [newVocabItem],
      };
      personalDecks = [deck, ...personalDecks];
    } else {
      const existingItems = Array.isArray(deck.items) ? deck.items : [];
      const existingIdx = existingItems.findIndex(
        (it) => it.word.trim().toLowerCase() === cleanWord.toLowerCase()
      );
      let updatedItems: ExtendedVocabItem[];
      let finalWordId = newWordId;
      if (existingIdx !== -1) {
        finalWordId = existingItems[existingIdx].id;
        updatedItems = existingItems.map((it, idx) =>
          idx === existingIdx
            ? {
                ...it,
                ...newVocabItem,
                id: finalWordId,
              }
            : it
        );
      } else {
        updatedItems = [newVocabItem, ...existingItems];
      }
      deck = {
        ...deck,
        updatedAt: now,
        itemCount: updatedItems.length,
        items: updatedItems,
      };
      personalDecks = personalDecks.map((d) => (d.id === targetDeckId ? deck! : d));
      newVocabItem.id = finalWordId;
    }

    try {
      localStorage.setItem(decksStorageKey, JSON.stringify(personalDecks));
    } catch {
      // Ignore storage error
    }

    // Enroll immediately into SRS Level 0 (due immediately)
    const currentState = loadUserVocabState(uid);
    const updatedState = enrollWordInSrsManual(currentState, targetDeckId, newVocabItem.id, 1);
    saveUserVocabState(updatedState);

    if (currentUser?.uid) {
      savePersonalDecksToCloud(currentUser.uid, personalDecks).catch(() => {});
      syncUserVocabStateToCloud(currentUser.uid, updatedState).catch(() => {});
    }

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 950);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border-2 border-[#CE82FF] border-b-8 border-b-[#A560E8] text-slate-800 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-2xl bg-[#CE82FF] border-b-4 border-[#A560E8] text-white flex items-center justify-center shrink-0">
              <BookmarkPlus className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#A560E8] dark:text-purple-300 block">
                Cầu nối Phòng thi → Kho Từ Vựng SRS
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Lưu nhanh từ vựng vào Flashcard SRS
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-duo-white p-1.5 rounded-xl text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-[#D7FFB8] dark:bg-emerald-950 text-[#46A302] border-2 border-[#58CC02] border-b-4 border-b-[#46A302] flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              Đã lưu "{word}" vào Kho Flashcard &amp; Lịch ôn SRS (Level 0)!
            </h4>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Bạn có thể ôn tập ngay trong mục <strong>Từ vựng VSTEP → Bộ thẻ của tôi / Ôn SRS</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSaveToSrsDeck} className="mt-4 space-y-3.5">
            {/* Word & AI Auto-Fill */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Từ / Cụm từ tiếng Anh *
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder="Ví dụ: substantial, take into account..."
                    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-black text-slate-900 dark:text-white focus:border-[#CE82FF] focus:outline-none"
                  />
                  {word.trim() && (
                    <button
                      type="button"
                      onClick={() => examAudioManager.speakText(word.trim())}
                      className="btn-duo-white p-2 rounded-xl text-[#1CB0F6] shrink-0"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Từ loại
                </label>
                <select
                  value={partOfSpeech}
                  onChange={(e) => setPartOfSpeech(e.target.value as any)}
                  className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-2 text-xs font-black text-slate-900 dark:text-white focus:border-[#CE82FF] focus:outline-none"
                >
                  <option value="n">Danh từ (n)</option>
                  <option value="v">Động từ (v)</option>
                  <option value="adj">Tính từ (adj)</option>
                  <option value="adv">Trạng từ (adv)</option>
                  <option value="phr">Cụm từ (phr)</option>
                </select>
              </div>
            </div>

            {/* Phonetic + AI Lookup trigger */}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Phiên âm IPA
                </label>
                <input
                  type="text"
                  value={phonetic}
                  onChange={(e) => setPhonetic(e.target.value)}
                  placeholder="/.../"
                  className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 focus:border-[#CE82FF] focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={isLookingUp || !word.trim()}
                onClick={() => lookupWithAi(word, exampleEn || payload.contextSentence)}
                className="btn-duo-purple inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black disabled:opacity-50"
              >
                {isLookingUp ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>AI đang tra...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Tự động điền nghĩa &amp; IPA bằng AI</span>
                  </>
                )}
              </button>
            </div>

            {/* Meaning Vi */}
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Nghĩa tiếng Việt (Sát ngữ cảnh VSTEP) *
              </label>
              <input
                type="text"
                value={meaningVi}
                onChange={(e) => setMeaningVi(e.target.value)}
                placeholder="Nhập nghĩa tiếng Việt..."
                className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
              />
            </div>

            {/* Context Example En & Vi */}
            <div className="space-y-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-600 dark:text-slate-300">
                <BookOpen className="h-3.5 w-3.5 text-[#58CC02]" />
                <span>Câu ngữ cảnh trích từ bài đọc / đề thi:</span>
              </div>
              <textarea
                rows={2}
                value={exampleEn}
                onChange={(e) => setExampleEn(e.target.value)}
                placeholder="Câu ví dụ tiếng Anh..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
              />
              <input
                type="text"
                value={exampleVi}
                onChange={(e) => setExampleVi(e.target.value)}
                placeholder="Dịch câu ví dụ sang tiếng Việt (tùy chọn)..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 focus:outline-none"
              />
            </div>

            {errorMsg && (
              <p className="text-xs font-bold text-[#FF4B4B] bg-rose-50 dark:bg-rose-950/50 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800">
                {errorMsg}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-duo-white px-4 py-2.5 rounded-2xl text-xs font-black"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-duo-green inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-black"
              >
                <BookmarkPlus className="h-4 w-4" />
                <span>Lưu vào Flashcard &amp; Ôn SRS</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
