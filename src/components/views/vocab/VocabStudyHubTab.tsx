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
        <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF5D6] border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] text-[#FF9600] flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-500">Số dư điểm thưởng</div>
            <div className="text-2xl font-black text-slate-900">
              {vocabState.pointsBalance} điểm
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#D7FFB8] border-2 border-[#58CC02] border-b-4 border-b-[#46A302] text-[#46A302] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-500">Từ vựng đã thuộc</div>
            <div className="text-2xl font-black text-[#46A302]">
              {globalStats.totalKnownWords}
              <span className="text-sm font-bold text-slate-400">
                /{globalStats.totalUniqueWords}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#DDF4FF] border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] text-[#1899D6] flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-black text-slate-500">Đang theo dõi SRS</div>
            <div className="text-2xl font-black text-[#1899D6]">
              {globalStats.totalSrsEnrolled}{' '}
              <span className="text-xs font-black text-[#46A302]">
                ({globalStats.totalMasteredLv5} Lv5)
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#58CC02] to-[#46A302] border-2 border-[#58CC02] border-b-4 border-b-[#2B6600] text-white rounded-3xl p-5 shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-lime-100 uppercase tracking-wider">Hàng đợi SRS đến hạn</span>
            <Clock className="w-4 h-4 text-[#FFC800]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-black">{globalStats.totalSrsDueNow} từ</span>
            <button
              type="button"
              onClick={onOpenGlobalSrsModal}
              className="px-3.5 py-1.5 rounded-2xl bg-white text-[#46A302] border-2 border-white border-b-4 border-b-[#D7FFB8] hover:bg-lime-50 text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-1"
            >
              Mở bảng SRS
            </button>
          </div>
        </div>
      </div>

      {/* 2. Quick Deck Directory */}
      <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#58CC02]" />
              Chọn nhanh bộ từ để luyện tập ({allDecks.length} bộ)
            </h2>
            <p className="text-xs font-semibold text-slate-500">
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
                className="p-3.5 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] hover:border-[#58CC02] hover:border-b-[#46A302] hover:bg-lime-50/30 text-left transition-all flex flex-col justify-between gap-2 cursor-pointer active:border-b-0 active:translate-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-black text-slate-900 text-xs sm:text-sm line-clamp-1">
                    {deck.title}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#58CC02] shrink-0" />
                </div>
                <div className="space-y-1 w-full">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>
                      Đã thuộc: <strong className="text-slate-900 font-black">{known}/{total}</strong>
                    </span>
                    <span className="font-black text-[#46A302]">{percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-[#E5E5E5]">
                    <div
                      className="h-full bg-[#58CC02] rounded-full"
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
      <div className="bg-white border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] rounded-3xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-[#1CB0F6]" />
            Lịch sử lượt học từ vựng đã lưu ({vocabState.sessionHistory.length})
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            Nhấn vào một phiên học để xem lại chi tiết từng câu, làm lại câu sai hoặc chơi tiếp các
            mục chưa chấm
          </p>
        </div>

        {vocabState.sessionHistory.length === 0 ? (
          <div className="py-10 text-center text-slate-400 font-bold text-xs sm:text-sm border-2 border-dashed border-[#E5E5E5] rounded-2xl">
            Bạn chưa có phiên học nào được lưu. Hãy chọn một bộ từ và hoàn thành lượt học đầu tiên!
          </div>
        ) : (
          <div className="space-y-3">
            {vocabState.sessionHistory.slice(0, 20).map((sess) => {
              const wrongCount =
                sess.incorrectCount + sess.timeoutCount + sess.selfRatedForgotCount;
              const unfinishedCount = sess.incompleteCount + sess.unaskedCount;

              return (
                <div
                  key={sess.sessionId}
                  onClick={() => setInspectingSession(sess)}
                  className="cursor-pointer p-4 rounded-2xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] hover:border-[#1CB0F6] hover:border-b-[#1899D6] hover:bg-sky-50/30 transition-all flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-xl bg-[#DDF4FF] text-[#1899D6] border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] text-xs font-black">
                        {MODE_LABELS[sess.mode] || sess.mode}
                      </span>
                      {sess.sessionKind === 'srs' && (
                        <span className="px-2.5 py-0.5 rounded-xl bg-[#FFF5D6] text-[#FF9600] border-2 border-[#FFC800] border-b-3 border-b-[#E5B400] text-[11px] font-black">
                          Ôn SRS
                        </span>
                      )}
                      <span className="font-black text-slate-900 text-sm">{sess.scopeTitle}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-500 flex flex-wrap items-center gap-3">
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
                        <span className="text-[#EA2B2B] font-black">• Sai/Quên: {wrongCount}</span>
                      )}
                      {unfinishedCount > 0 && (
                        <span className="text-[#FF9600] font-black">
                          • Chưa chấm: {unfinishedCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {sess.objectiveAccuracyPercent !== null && (
                      <span className="px-3 py-1 rounded-xl bg-slate-100 border-2 border-[#E5E5E5] border-b-3 border-b-[#CECECE] text-slate-800 text-xs font-black">
                        Độ chính xác: {sess.objectiveAccuracyPercent}%
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-xl bg-[#D7FFB8] text-[#46A302] border-2 border-[#58CC02] border-b-3 border-b-[#46A302] text-xs font-black">
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
          <div className="bg-white rounded-3xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b-2 border-[#E5E5E5] bg-slate-50 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Chi tiết lượt học: {inspectingSession.scopeTitle}
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Chế độ: {MODE_LABELS[inspectingSession.mode] || inspectingSession.mode} • Nhận +
                  {inspectingSession.pointsEarned} điểm (Số dư: {inspectingSession.balanceBefore} →{' '}
                  {inspectingSession.balanceAfter})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSession(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {inspectingSession.attempts.map((att, idx) => (
                <div
                  key={`${att.wordKey}_${idx}`}
                  className="p-3.5 rounded-2xl border-2 border-[#E5E5E5] border-b-3 border-b-[#CECECE] flex items-center justify-between gap-3 bg-white"
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        playDictionaryAudio(att.wordSnapshot, {
                          volumePercent: vocabState.audioVolumePercent,
                        })
                      }
                      className="p-2 rounded-xl bg-[#DDF4FF] border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] text-[#1899D6] hover:bg-sky-100 cursor-pointer active:border-b-0 active:translate-y-0.5"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="font-black text-sm text-slate-900">
                        {att.wordSnapshot}{' '}
                        {att.phoneticSnapshot && (
                          <span className="text-xs font-mono text-slate-500">
                            {att.phoneticSnapshot}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-600">{att.meaningSnapshot}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {att.earnedPoints > 0 && (
                      <span className="text-xs font-black text-[#46A302]">
                        +{att.earnedPoints}đ
                      </span>
                    )}
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-black border-2 border-b-3 ${
                        att.outcome === 'correct'
                          ? 'bg-[#D7FFB8] text-[#46A302] border-[#58CC02] border-b-[#46A302]'
                          : att.outcome === 'assisted_correct'
                          ? 'bg-[#DDF4FF] text-[#1899D6] border-[#1CB0F6] border-b-[#1899D6]'
                          : att.outcome === 'self_rated'
                          ? att.selfRating === 'known'
                            ? 'bg-[#D7FFB8] text-[#46A302] border-[#58CC02] border-b-[#46A302]'
                            : 'bg-[#FFDADC] text-[#EA2B2B] border-[#FF4B4B] border-b-[#EA2B2B]'
                          : att.outcome === 'incomplete'
                          ? 'bg-slate-100 text-slate-600 border-[#E5E5E5] border-b-[#CECECE]'
                          : 'bg-[#FFDADC] text-[#EA2B2B] border-[#FF4B4B] border-b-[#EA2B2B]'
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

            <div className="px-5 py-4 border-t-2 border-[#E5E5E5] bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
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
                    className="btn-duo-red inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black cursor-pointer"
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
                    className="btn-duo-orange inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Chơi tiếp các mục chưa chấm
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setInspectingSession(null)}
                className="btn-duo-white px-5 py-2 rounded-2xl text-slate-700 text-xs font-black cursor-pointer"
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
