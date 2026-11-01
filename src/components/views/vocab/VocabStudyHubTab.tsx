import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Layers,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  BookOpen,
  History,
  Volume2,
  X,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { UserVocabDeck } from '../../../types/vocab';
import { NormalizedVocabItem } from '../../../utils/vocabEngine';
import {
  UserVocabPartitionState,
  VocabSavedSession,
} from '../../../services/vocabStorageService';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';
import { RunnerMode } from './VocabGameRunner';

export interface VocabStudyHubTabProps {
  allDecks: UserVocabDeck[];
  normalizedByDeckId: Record<string, NormalizedVocabItem[]>;
  vocabState: UserVocabPartitionState;
  onSelectDeck: (deckId: string) => void;
  onOpenGlobalSrsModal: () => void;
  onReplaySavedSessionSubset: (params: {
    session: VocabSavedSession;
    subsetType: 'wrong' | 'incomplete';
  }) => void;
}

const MODE_LABELS: Record<string, string> = {
  flashcard: 'Thẻ từ (Flashcard)',
  quiz: 'Trắc nghiệm (Quiz)',
  dictation: 'Nghe & Gõ từ',
  spell: 'Gõ từ vựng',
  match: 'Ghép cặp',
  mixed: 'Hỗn hợp (Mixed)',
  flappy: 'Flappy Bird Từ Vựng',
  monkey: 'Giải cứu khỉ',
};

export const VocabStudyHubTab: React.FC<VocabStudyHubTabProps> = ({
  allDecks,
  normalizedByDeckId,
  vocabState,
  onSelectDeck,
  onOpenGlobalSrsModal,
  onReplaySavedSessionSubset,
}) => {
  const [inspectingSession, setInspectingSession] = useState<VocabSavedSession | null>(null);

  // Compute global stats across all unique wordKeys
  const globalStats = useMemo(() => {
    const now = Date.now();
    let totalUniqueWords = 0;
    let totalKnownWords = 0;
    let totalSrsEnrolled = 0;
    let totalSrsDueNow = 0;
    let totalMasteredLv5 = 0;

    const seenKeys = new Set<string>();
    Object.values(normalizedByDeckId).forEach((items) => {
      items.forEach((it) => {
        if (!seenKeys.has(it.wordKey)) {
          seenKeys.add(it.wordKey);
          totalUniqueWords++;
          if (vocabState.knownMap[it.wordKey]?.isKnown) {
            totalKnownWords++;
          }
          const rec = vocabState.srsMap[it.wordKey];
          if (rec && rec.enrolled && !rec.suspended) {
            totalSrsEnrolled++;
            if (rec.srsLevel === 5) totalMasteredLv5++;
            if (rec.dueAt !== null && rec.dueAt <= now) {
              totalSrsDueNow++;
            }
          }
        }
      });
    });

    return {
      totalUniqueWords,
      totalKnownWords,
      totalSrsEnrolled,
      totalSrsDueNow,
      totalMasteredLv5,
    };
  }, [normalizedByDeckId, vocabState.knownMap, vocabState.srsMap]);

  return (
    <div className="space-y-6">
      {/* 1. Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Số dư điểm thưởng</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {vocabState.pointsBalance} điểm
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Từ vựng đã thuộc</div>
            <div className="text-2xl font-extrabold text-emerald-700">
              {globalStats.totalKnownWords}
              <span className="text-sm font-semibold text-slate-400">
                /{globalStats.totalUniqueWords}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">Đang theo dõi SRS</div>
            <div className="text-2xl font-extrabold text-indigo-700">
              {globalStats.totalSrsEnrolled}{' '}
              <span className="text-xs font-semibold text-emerald-600">
                ({globalStats.totalMasteredLv5} Lv5)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-100">Hàng đợi SRS đến hạn</span>
            <Clock className="w-4 h-4 text-amber-300" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-extrabold">{globalStats.totalSrsDueNow} từ</span>
            <button
              type="button"
              onClick={onOpenGlobalSrsModal}
              className="px-3.5 py-1.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 text-xs font-extrabold shadow-2xs transition"
            >
              Mở bảng SRS
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Deck Directory */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              Chọn nhanh bộ từ để luyện tập ({allDecks.length} bộ)
            </h2>
            <p className="text-xs text-slate-500">
              Nhấn vào bất kỳ bộ từ nào để mở 6 chế độ học (Thẻ từ, Trắc nghiệm, Nghe, Gõ từ, Ghép
              cặp, Đặc biệt)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
          {allDecks.map((deck) => {
            const items = normalizedByDeckId[deck.id] || [];
            const total = items.length;
            let known = 0;
            items.forEach((it) => {
              if (vocabState.knownMap[it.wordKey]?.isKnown) known++;
            });
            const percent = total === 0 ? 0 : Math.round((known / total) * 100);

            return (
              <button
                key={deck.id}
                type="button"
                onClick={() => onSelectDeck(deck.id)}
                className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 text-left transition flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-900 text-xs sm:text-sm line-clamp-1">
                    {deck.title}
                  </span>
                  <ArrowRight className="w-4 h-4 text-indigo-600 shrink-0" />
                </div>
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Đã thuộc: <strong className="text-slate-800">{known}/{total}</strong>
                    </span>
                    <span className="font-bold text-indigo-600">{percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Saved Session History (Lịch sử phiên học đã lưu — Section 7) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            Lịch sử lượt học từ vựng đã lưu ({vocabState.sessionHistory.length})
          </h2>
          <p className="text-xs text-slate-500">
            Nhấn vào một phiên học để xem lại chi tiết từng câu, làm lại câu sai hoặc chơi tiếp các
            mục chưa chấm
          </p>
        </div>

        {vocabState.sessionHistory.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs sm:text-sm border border-dashed border-slate-200 rounded-xl">
            Bạn chưa có phiên học nào được lưu. Hãy chọn một bộ từ và hoàn thành lượt học đầu tiên!
          </div>
        ) : (
          <div className="space-y-2.5">
            {vocabState.sessionHistory.slice(0, 20).map((sess) => {
              const wrongCount =
                sess.incorrectCount + sess.timeoutCount + sess.selfRatedForgotCount;
              const unfinishedCount = sess.incompleteCount + sess.unaskedCount;

              return (
                <div
                  key={sess.sessionId}
                  onClick={() => setInspectingSession(sess)}
                  className="cursor-pointer p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70 transition flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-extrabold">
                        {MODE_LABELS[sess.mode] || sess.mode}
                      </span>
                      {sess.sessionKind === 'srs' && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                          Ôn SRS
                        </span>
                      )}
                      <span className="font-bold text-slate-900 text-sm">{sess.scopeTitle}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                      <span>
                        {new Date(sess.savedAt).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                      <span>• Đúng độc lập: {sess.independentCorrectCount}</span>
                      {sess.assistedCorrectCount > 0 && (
                        <span>• Có trợ giúp: {sess.assistedCorrectCount}</span>
                      )}
                      {wrongCount > 0 && (
                        <span className="text-rose-600 font-semibold">• Sai/Quên: {wrongCount}</span>
                      )}
                      {unfinishedCount > 0 && (
                        <span className="text-amber-700 font-semibold">
                          • Chưa chấm: {unfinishedCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {sess.objectiveAccuracyPercent !== null && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-extrabold">
                        Độ chính xác: {sess.objectiveAccuracyPercent}%
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold">
                      +{sess.pointsEarned} điểm ({sess.balanceBefore} → {sess.balanceAfter})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Saved Session Inspection Modal */}
      {inspectingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Chi tiết lượt học: {inspectingSession.scopeTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  Chế độ: {MODE_LABELS[inspectingSession.mode] || inspectingSession.mode} • Nhận +
                  {inspectingSession.pointsEarned} điểm (Số dư: {inspectingSession.balanceBefore} →{' '}
                  {inspectingSession.balanceAfter})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSession(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {inspectingSession.attempts.map((att, idx) => (
                <div
                  key={`${att.wordKey}_${idx}`}
                  className="p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 bg-white"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        playDictionaryAudio(att.wordSnapshot, {
                          volumePercent: vocabState.audioVolumePercent,
                        })
                      }
                      className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        {att.wordSnapshot}{' '}
                        {att.phoneticSnapshot && (
                          <span className="text-xs font-mono text-slate-500">
                            {att.phoneticSnapshot}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">{att.meaningSnapshot}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {att.earnedPoints > 0 && (
                      <span className="text-xs font-extrabold text-emerald-600">
                        +{att.earnedPoints}đ
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        att.outcome === 'correct'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : att.outcome === 'assisted_correct'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : att.outcome === 'self_rated'
                          ? att.selfRating === 'known'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                          : att.outcome === 'incomplete'
                          ? 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {att.outcome === 'correct'
                        ? 'Đúng độc lập'
                        : att.outcome === 'assisted_correct'
                        ? 'Đúng có trợ giúp'
                        : att.outcome === 'timeout'
                        ? 'Hết giờ'
                        : att.outcome === 'self_rated'
                        ? att.selfRating === 'known'
                          ? 'Tự đánh giá: Thuộc'
                          : 'Tự đánh giá: Quên'
                        : att.outcome === 'incomplete'
                        ? 'Chưa chấm'
                        : 'Sai'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {inspectingSession.incorrectCount +
                  inspectingSession.timeoutCount +
                  inspectingSession.selfRatedForgotCount >
                  0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = inspectingSession;
                      setInspectingSession(null);
                      onReplaySavedSessionSubset({ session: s, subsetType: 'wrong' });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Làm lại câu sai
                  </button>
                )}

                {inspectingSession.incompleteCount + inspectingSession.unaskedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = inspectingSession;
                      setInspectingSession(null);
                      onReplaySavedSessionSubset({ session: s, subsetType: 'incomplete' });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Chơi tiếp các mục chưa chấm
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInspectingSession(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
