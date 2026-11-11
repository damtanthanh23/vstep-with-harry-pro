import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, BookmarkPlus, Sparkles, X, Loader2, BookOpen } from 'lucide-react';
import { playDictionaryAudio } from '../utils/dictionaryAudio';
import { QuickSaveVocabModal, QuickSaveVocabPayload } from './QuickSaveVocabModal';
import { B1_VOCAB_LIST } from '../data/b1VocabData';

interface QuickDictResult {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  meaningVi: string;
}

const LOCAL_DICT_CACHE = new Map<string, QuickDictResult>();

function lookupOfflineQuickMeaning(rawWord: string): QuickDictResult | null {
  const clean = rawWord.trim().toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
  if (!clean) return null;

  if (LOCAL_DICT_CACHE.has(clean)) {
    return LOCAL_DICT_CACHE.get(clean)!;
  }

  const found = B1_VOCAB_LIST.find(
    (item) =>
      item.word.toLowerCase() === clean ||
      item.word.toLowerCase() === clean.replace(/(?:s|es|ed|ing|ly)$/, '')
  );
  if (found) {
    const res: QuickDictResult = {
      word: found.word,
      phonetic: found.phonetic,
      partOfSpeech: found.partOfSpeech,
      meaningVi: found.meaningVi,
    };
    LOCAL_DICT_CACHE.set(clean, res);
    return res;
  }

  return null;
}

interface GlobalSelectionDictionaryPopoverProps {
  sourceLabel?: string;
  testId?: string;
  testTitle?: string;
}

export const GlobalSelectionDictionaryPopover: React.FC<GlobalSelectionDictionaryPopoverProps> = ({
  sourceLabel = 'Tra từ nhanh VSTEP',
  testId,
  testTitle,
}) => {
  const [selectionState, setSelectionState] = useState<{
    text: string;
    contextSentence: string;
    x: number;
    y: number;
  } | null>(null);
  const [dictResult, setDictResult] = useState<QuickDictResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [quickSavePayload, setQuickSavePayload] = useState<QuickSaveVocabPayload | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const handleClose = useCallback(() => {
    setSelectionState(null);
    setDictResult(null);
    setIsLookingUp(false);
  }, []);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }

      const targetEl = e.target as HTMLElement | null;
      if (
        targetEl &&
        (targetEl.tagName === 'INPUT' ||
          targetEl.tagName === 'TEXTAREA' ||
          targetEl.tagName === 'BUTTON' ||
          targetEl.closest('button') ||
          targetEl.closest('[data-disable-global-dict="true"]'))
      ) {
        return;
      }

      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          return;
        }
        const rawText = sel.toString().trim();
        if (rawText.length < 2 || rawText.length > 65) {
          return;
        }
        // Only trigger on text containing English letters
        if (!/[a-zA-Z]{2,}/.test(rawText)) {
          return;
        }
        const wordCount = rawText.split(/\s+/).length;
        if (wordCount > 7) {
          return;
        }

        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return;

          // Extract surrounding sentence context
          const anchorText = sel.anchorNode?.textContent || '';
          let contextSentence = rawText;
          if (anchorText.length > rawText.length) {
            const sentences = anchorText.split(/(?<=[.!?])\s+/);
            const matched = sentences.find((s) =>
              s.toLowerCase().includes(rawText.toLowerCase())
            );
            contextSentence = (matched || anchorText).trim().slice(0, 260);
          }

          const clampedX = Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2));
          const clampedY = Math.max(76, rect.top - 10);

          setSelectionState({
            text: rawText,
            contextSentence,
            x: clampedX,
            y: clampedY,
          });

          const offline = lookupOfflineQuickMeaning(rawText);
          if (offline) {
            setDictResult(offline);
            setIsLookingUp(false);
          } else {
            setDictResult(null);
            setIsLookingUp(true);
            fetch('/api/ai/quick-vocab-lookup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                word: rawText,
                contextSentence,
              }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (data && data.meaningVi) {
                  const res: QuickDictResult = {
                    word: data.word || rawText,
                    phonetic: data.phonetic || '',
                    partOfSpeech: data.partOfSpeech || '',
                    meaningVi: data.meaningVi,
                  };
                  LOCAL_DICT_CACHE.set(rawText.toLowerCase(), res);
                  setDictResult(res);
                }
              })
              .catch(() => {})
              .finally(() => {
                setIsLookingUp(false);
              });
          }
        } catch {
          // Ignore range error
        }
      }, 20);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  return (
    <>
      {selectionState && (
        <div
          ref={popoverRef}
          style={{
            left: `${selectionState.x}px`,
            top: `${selectionState.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="fixed z-50 w-72 sm:w-80 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-2xl border border-slate-700 p-3 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-black text-sky-400 truncate max-w-[160px]">
                  {dictResult?.word || selectionState.text}
                </span>
                {dictResult?.phonetic && (
                  <span className="text-[11px] font-mono text-slate-300">
                    {dictResult.phonetic}
                  </span>
                )}
                {dictResult?.partOfSpeech && (
                  <span className="text-[10px] font-bold uppercase text-amber-300">
                    ({dictResult.partOfSpeech})
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-100 leading-snug">
                {isLookingUp ? (
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
                    <span>Đang tra nghĩa ngữ cảnh VSTEP...</span>
                  </span>
                ) : dictResult?.meaningVi ? (
                  <span className="font-semibold text-emerald-300">{dictResult.meaningVi}</span>
                ) : (
                  <span className="text-slate-300">
                    Bấm <strong className="text-white">Lưu SRS</strong> để AI phân tích nghĩa & ví dụ.
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-700/80 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => playDictionaryAudio(selectionState.text, 'uk')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-sky-300 transition-colors cursor-pointer"
                title="Nghe phát âm Anh - Anh (UK)"
              >
                <Volume2 className="h-3 w-3" />
                <span>UK</span>
              </button>
              <button
                type="button"
                onClick={() => playDictionaryAudio(selectionState.text, 'us')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-amber-300 transition-colors cursor-pointer"
                title="Nghe phát âm Anh - Mỹ (US)"
              >
                <Volume2 className="h-3 w-3" />
                <span>US</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setQuickSavePayload({
                  initialWord: selectionState.text,
                  contextSentence: selectionState.contextSentence,
                  sourceLabel,
                  testId,
                  testTitle,
                });
                handleClose();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white text-[11px] font-black transition-colors cursor-pointer"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              <span>Lưu Flashcard SRS</span>
            </button>
          </div>
        </div>
      )}

      <QuickSaveVocabModal
        isOpen={Boolean(quickSavePayload)}
        onClose={() => setQuickSavePayload(null)}
        payload={quickSavePayload}
      />
    </>
  );
};
