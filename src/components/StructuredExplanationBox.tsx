import React, { useState } from 'react';
import { Sparkles, Volume2, Languages, Check, PanelLeftOpen, BookmarkPlus } from 'lucide-react';
import { examAudioManager } from '../utils/audioManager';
import { parseScriptIntoSpeakerTurns } from './InteractiveTranscriptModal';
import { QuickSaveVocabModal, QuickSaveVocabPayload } from './QuickSaveVocabModal';

interface StructuredExplanationBoxProps {
  explanation?: string; // Deprecated & ignored: explanations are completely removed
  evidenceQuote?: string;
  audioScript?: string;
  audioScriptTranslation?: string;
  vietnameseTranslation?: string;
  questionPrompt?: string;
  options?: { id: string; text: string }[];
  hideInlineScript?: boolean;
  hideEvidenceQuote?: boolean;
  onOpenEvidence?: () => void;
  onHighlightQuote?: (quote: string) => void;
}

export const StructuredExplanationBox: React.FC<StructuredExplanationBoxProps> = ({
  explanation,
  evidenceQuote,
  audioScript,
  audioScriptTranslation,
  vietnameseTranslation,
  questionPrompt,
  options,
  hideInlineScript = false,
  hideEvidenceQuote = false,
  onOpenEvidence,
  onHighlightQuote,
}) => {
  const [liveQuestionTranslation, setLiveQuestionTranslation] = useState<string | null>(null);
  const [isTranslatingQuestion, setIsTranslatingQuestion] = useState(false);
  const [quickSavePayload, setQuickSavePayload] = useState<QuickSaveVocabPayload | null>(null);

  const effectiveQuestionTranslation = vietnameseTranslation || liveQuestionTranslation;

  const handleOpenQuickSaveFromSelection = () => {
    const sel = window.getSelection()?.toString().trim() || '';
    const cleanedWord = sel.length >= 2 && sel.length <= 75 ? sel : '';
    const contextCandidate =
      evidenceQuote || questionPrompt || (options && options[0]?.text) || '';
    setQuickSavePayload({
      initialWord: cleanedWord,
      contextSentence: contextCandidate,
      sourceLabel: 'Giải thích & Câu bằng chứng VSTEP',
    });
  };

  const handleEvidenceClick = () => {
    if (evidenceQuote && onHighlightQuote) {
      onHighlightQuote(evidenceQuote);
    }
    if (onOpenEvidence) {
      onOpenEvidence();
    }
  };

  const handleTranslateQuestionAndOptions = async () => {
    if (effectiveQuestionTranslation || isTranslatingQuestion) return;
    const partsToTranslate: string[] = [];
    if (questionPrompt) partsToTranslate.push(`Question: ${questionPrompt}`);
    if (options && options.length > 0) {
      options.forEach((opt) => {
        partsToTranslate.push(`${opt.id}. ${opt.text}`);
      });
    }
    const rawText = partsToTranslate.join('\n');
    if (!rawText.trim()) return;

    try {
      setIsTranslatingQuestion(true);
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          context: 'Dịch câu hỏi và tất cả các phương án A, B, C, D trong đề thi VSTEP B1-B2-C1 sang tiếng Việt rõ ràng',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          setLiveQuestionTranslation(data.translation);
        }
      }
    } catch (err) {
      console.error('Error translating question and options:', err);
    } finally {
      setIsTranslatingQuestion(false);
    }
  };

  const speakerTurns = React.useMemo(
    () => (audioScript ? parseScriptIntoSpeakerTurns(audioScript, audioScriptTranslation) : []),
    [audioScript, audioScriptTranslation]
  );

  return (
    <div className="space-y-3 pt-1">
      {/* 0. Detailed Vietnamese Explanation (Giải thích chi tiết) */}
      {explanation && explanation.trim().length > 0 && (
        <div className="rounded-2xl border-2 border-[#58CC02] dark:border-lime-800 border-b-4 border-b-[#46A302] bg-white dark:bg-slate-900 p-3.5 text-xs text-slate-800 dark:text-slate-100 shadow-2xs space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-black text-[#2B6601] dark:text-[#78E014] text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#58CC02]" />
              <span>Giải thích chi tiết đáp án:</span>
            </div>
            <button
              type="button"
              onClick={handleOpenQuickSaveFromSelection}
              className="inline-flex items-center gap-1 rounded-xl bg-[#F3E5FF] dark:bg-purple-950/70 border border-[#CE82FF] px-2.5 py-1 text-[10px] font-black text-[#A560E8] dark:text-purple-300 hover:bg-purple-200 transition-colors cursor-pointer"
              title="Bôi đen từ mới hoặc bấm để lưu nhanh vào Kho Flashcard SRS"
            >
              <BookmarkPlus className="h-3 w-3" />
              <span>+ Lưu từ vựng SRS</span>
            </button>
          </div>
          <p className="leading-relaxed font-semibold whitespace-pre-line pl-1">
            {explanation}
          </p>
        </div>
      )}

      {/* 1. Interactive Evidence Quote with Left-Panel Highlighting */}
      {!hideEvidenceQuote && evidenceQuote && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={handleEvidenceClick}
            className="w-full inline-flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#FFF5D6] dark:bg-amber-950/70 hover:bg-[#FFECB3] p-3 sm:px-4 sm:py-2.5 text-xs font-black text-amber-950 dark:text-amber-100 border-2 border-[#FFC800] dark:border-amber-700 border-b-4 border-b-[#E5B400] transition-all cursor-pointer active:border-b-0 active:translate-y-1"
          >
            <div className="flex items-start sm:items-center gap-2 text-left min-w-0 flex-1">
              <Sparkles className="h-4 w-4 shrink-0 text-[#E58700] dark:text-amber-300 mt-0.5 sm:mt-0" />
              <span className="leading-snug">
                Câu bằng chứng: <span className="font-semibold italic">"{evidenceQuote}"</span>
              </span>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-[#FF9600] border border-[#E58700] border-b-2 border-b-[#B36B00] text-white px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
              <PanelLeftOpen className="h-3 w-3" />
              <span>Đối chiếu cột trái</span>
            </span>
          </button>
        </div>
      )}

      {/* 2. Vietnamese Translation of Question & All Options A, B, C, D */}
      {effectiveQuestionTranslation ? (
        <div className="rounded-2xl border-2 border-[#58CC02] dark:border-emerald-800/80 border-b-4 border-b-[#46A302] bg-[#D7FFB8]/40 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-950 dark:text-emerald-100 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between gap-2 font-black text-[#2B6600] dark:text-emerald-300 text-[11px] uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-[#46A302] dark:text-emerald-400" />
              <span>Bản dịch Câu hỏi &amp; Các phương án:</span>
            </span>
            <button
              type="button"
              onClick={handleOpenQuickSaveFromSelection}
              className="inline-flex items-center gap-1 rounded-xl bg-white dark:bg-slate-900 border border-[#CE82FF] px-2.5 py-1 text-[10px] font-black text-[#A560E8] dark:text-purple-300 hover:bg-purple-50 cursor-pointer"
            >
              <BookmarkPlus className="h-3 w-3" />
              <span>+ Lưu từ SRS</span>
            </button>
          </div>
          <p className="leading-relaxed font-semibold whitespace-pre-line pl-1 text-slate-800 dark:text-slate-100">
            {effectiveQuestionTranslation}
          </p>
        </div>
      ) : (
        (questionPrompt || (options && options.length > 0)) && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTranslateQuestionAndOptions}
              disabled={isTranslatingQuestion}
              className="btn-duo-white inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black text-[#2B6600] dark:text-emerald-300 cursor-pointer"
            >
              <Languages className="h-3.5 w-3.5 text-[#58CC02]" />
              <span>
                {isTranslatingQuestion
                  ? 'Đang dịch câu hỏi & đáp án...'
                  : 'Xem bản dịch câu hỏi & các phương án A, B, C, D'}
              </span>
            </button>
            <button
              type="button"
              onClick={handleOpenQuickSaveFromSelection}
              className="btn-duo-white inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-black text-[#A560E8] dark:text-purple-300 cursor-pointer"
              title="Lưu nhanh từ mới trong câu hỏi này vào Kho Flashcard SRS"
            >
              <BookmarkPlus className="h-3.5 w-3.5 text-[#CE82FF]" />
              <span>+ Lưu từ vựng SRS</span>
            </button>
          </div>
        )
      )}

      <QuickSaveVocabModal
        isOpen={Boolean(quickSavePayload)}
        onClose={() => setQuickSavePayload(null)}
        payload={quickSavePayload}
      />

      {/* 3. Speaker-Grouped Audio Script & Whole-Turn Translation (if Listening and not hidden) */}
      {!hideInlineScript && speakerTurns.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 text-xs border-2 border-[#E5E5E5] dark:border-slate-800 border-b-4 border-b-[#CECECE] dark:border-b-slate-950 shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 font-black text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-[#58CC02]" />
              <span>Lời thoại theo lượt người nói (A, B, C) &amp; Dịch nghĩa:</span>
            </span>
            <div className="flex items-center gap-2">
              {onOpenEvidence && (
                <button
                  type="button"
                  onClick={handleEvidenceClick}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#D7FFB8] dark:bg-lime-950/60 border border-[#58CC02] border-b-2 border-b-[#46A302] px-2.5 py-1 text-[11px] text-[#2B6600] dark:text-[#78E014] hover:bg-lime-200 font-black cursor-pointer active:translate-y-0.5"
                >
                  <PanelLeftOpen className="h-3 w-3" />
                  <span>Mở ở cột trái</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => audioScript && examAudioManager.speakText(audioScript)}
                className="text-[11px] text-[#46A302] hover:underline font-extrabold cursor-pointer"
              >
                Nghe cả đoạn
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {speakerTurns.map((turn) => (
              <div
                key={turn.id}
                className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-2.5 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-3 border-b-[#CECECE] space-y-1"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      examAudioManager.speakText(turn.englishText, undefined, turn.speaker)
                    }
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-black text-white cursor-pointer border-b-2 ${
                      turn.speaker === 'B'
                        ? 'bg-[#1CB0F6] border-[#1899D6]'
                        : turn.speaker === 'C'
                        ? 'bg-[#CE82FF] border-[#A560E8]'
                        : 'bg-[#58CC02] border-[#46A302]'
                    }`}
                    title={`Nghe giọng đọc người nói ${turn.speaker}`}
                  >
                    {turn.speaker}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                      {turn.englishText}
                    </p>
                    {turn.vietnameseText && (
                      <p className="mt-1 text-[11px] font-semibold text-[#2B6600] dark:text-emerald-300 flex items-start gap-1">
                        <Check className="h-3 w-3 text-[#58CC02] shrink-0 mt-0.5" />
                        <span>
                          <strong>{turn.speaker}:</strong> {turn.vietnameseText}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
