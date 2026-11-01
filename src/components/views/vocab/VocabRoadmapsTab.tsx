import React, { useState, useMemo } from 'react';
import {
  Pin,
  PinOff,
  Trophy,
  Layers,
  BookOpen,
  Search,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  X,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { UserVocabDeck } from '../../../types/vocab';
import { NormalizedVocabItem } from '../../../utils/vocabEngine';
import {
  UserVocabPartitionState,
  saveUserVocabState,
} from '../../../services/vocabStorageService';

export interface VocabRoadmapDefinition {
  id: string;
  title: string;
  description: string;
  category: 'b1_core' | 'listening' | 'reading' | 'exam_sets';
  badgeText: string;
  deckIds: string[];
}

export interface VocabRoadmapsTabProps {
  systemDecks: UserVocabDeck[];
  normalizedByDeckId: Record<string, NormalizedVocabItem[]>;
  vocabState: UserVocabPartitionState;
  onVocabStateChange: (nextState: UserVocabPartitionState) => void;
  onSelectDeck: (deckId: string) => void;
  onOpenSrsForRoadmap: (roadmap: {
    id: string;
    title: string;
    decks: UserVocabDeck[];
    items: NormalizedVocabItem[];
  }) => void;
  currentUserDisplayName?: string | null;
  isUserAuthenticated?: boolean;
}

export const VocabRoadmapsTab: React.FC<VocabRoadmapsTabProps> = ({
  systemDecks,
  normalizedByDeckId,
  vocabState,
  onVocabStateChange,
  onSelectDeck,
  onOpenSrsForRoadmap,
  currentUserDisplayName,
  isUserAuthenticated = false,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'b1_core' | 'listening' | 'reading' | 'exam_sets'
  >('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [leaderboardRoadmapId, setLeaderboardRoadmapId] = useState<string | null>(null);

  // Build dynamic roadmaps from actual system decks
  const roadmaps = useMemo<VocabRoadmapDefinition[]>(() => {
    const official15Decks = systemDecks.filter((d) => d.id.startsWith('sys_15_'));
    const examDecks = systemDecks.filter((d) => d.id.startsWith('exam_deck_'));
    const allIds = systemDecks.map((d) => d.id);

    const list: VocabRoadmapDefinition[] = [
      {
        id: 'roadmap_b1_master',
        title: 'Lộ trình Toàn diện 15 Chủ đề B1 Chuẩn Quốc tế',
        description:
          'Bao trọn toàn bộ 15 chủ đề từ vựng cốt lõi cho kỳ thi VSTEP và LanguageCert B1.',
        category: 'b1_core',
        badgeText: 'Trọng tâm B1',
        deckIds: official15Decks.length > 0 ? official15Decks.map((d) => d.id) : allIds,
      },
      {
        id: 'roadmap_listening_parts',
        title: 'Từ vựng Trọng tâm Phản xạ Nghe hiểu (Listening)',
        description:
          'Tập trung các chủ đề giao tiếp hàng ngày, đi lại, mua sắm, công việc và dịch vụ thường gặp trong bài thi Nghe.',
        category: 'listening',
        badgeText: 'Listening B1',
        deckIds: official15Decks.slice(0, 8).map((d) => d.id),
      },
      {
        id: 'roadmap_reading_parts',
        title: 'Từ vựng Đọc hiểu Học thuật & Xã hội (Reading)',
        description:
          'Hệ thống từ vựng về giáo dục, công nghệ, môi trường, sức khỏe và văn hóa xuất hiện tần suất cao trong bài Đọc.',
        category: 'reading',
        badgeText: 'Reading B1-B2',
        deckIds: official15Decks.slice(7, 15).map((d) => d.id),
      },
    ];

    if (examDecks.length > 0) {
      list.push({
        id: 'roadmap_exam_vocab',
        title: 'Lộ trình Từ vựng Trích xuất Trực tiếp từ Đề thi',
        description:
          'Tổng hợp từ vựng đính kèm theo từng đề thi thực chiến trên hệ thống để ôn sát đề nhất.',
        category: 'exam_sets',
        badgeText: 'Sát đề thi',
        deckIds: examDecks.map((d) => d.id),
      });
    }

    return list;
  }, [systemDecks]);

  // Compute real deduplicated stats per roadmap
  const roadmapStatsMap = useMemo(() => {
    const map: Record<
      string,
      {
        decks: UserVocabDeck[];
        dedupedItems: NormalizedVocabItem[];
        totalWords: number;
        knownWords: number;
        percent: number;
      }
    > = {};

    const deckById = new Map<string, UserVocabDeck>(systemDecks.map((d) => [d.id, d]));

    roadmaps.forEach((rm) => {
      const rmDecks = rm.deckIds
        .map((id) => deckById.get(id))
        .filter((d): d is UserVocabDeck => Boolean(d));

      const seenWordKeys = new Set<string>();
      const dedupedItems: NormalizedVocabItem[] = [];
      let knownWords = 0;

      rmDecks.forEach((d) => {
        const items = normalizedByDeckId[d.id] || [];
        items.forEach((it) => {
          if (!seenWordKeys.has(it.wordKey)) {
            seenWordKeys.add(it.wordKey);
            dedupedItems.push(it);
            if (vocabState.knownMap[it.wordKey]?.isKnown) {
              knownWords++;
            }
          }
        });
      });

      const totalWords = dedupedItems.length;
      const percent = totalWords === 0 ? 0 : Math.round((knownWords / totalWords) * 100);

      map[rm.id] = {
        decks: rmDecks,
        dedupedItems,
        totalWords,
        knownWords,
        percent,
      };
    });

    return map;
  }, [roadmaps, systemDecks, normalizedByDeckId, vocabState.knownMap]);

  const handleTogglePin = (roadmapId: string) => {
    const isPinned = vocabState.pinnedRoadmapIds.includes(roadmapId);
    const nextPinned = isPinned
      ? vocabState.pinnedRoadmapIds.filter((id) => id !== roadmapId)
      : [...vocabState.pinnedRoadmapIds, roadmapId];
    const nextState: UserVocabPartitionState = {
      ...vocabState,
      pinnedRoadmapIds: nextPinned,
    };
    saveUserVocabState(nextState);
    onVocabStateChange(nextState);
  };

  const handleToggleLeaderboardOptIn = () => {
    const nextState: UserVocabPartitionState = {
      ...vocabState,
      leaderboardOptIn: !vocabState.leaderboardOptIn,
    };
    saveUserVocabState(nextState);
    onVocabStateChange(nextState);
  };

  // If viewing a specific Roadmap Detail (Section 10)
  const activeRoadmap = roadmaps.find((r) => r.id === activeRoadmapId);
  if (activeRoadmap) {
    const stats = roadmapStatsMap[activeRoadmap.id];
    const isPinned = vocabState.pinnedRoadmapIds.includes(activeRoadmap.id);

    return (
      <div className="space-y-6">
        {/* Roadmap Detail Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <button
                type="button"
                onClick={() => setActiveRoadmapId(null)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 mb-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Quay lại danh sách lộ trình
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-extrabold">
                  {activeRoadmap.badgeText}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {activeRoadmap.title}
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-600">{activeRoadmap.description}</p>
            </div>

            {/* Action Buttons: Pin, BXH, Học ngắt quãng (SRS) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleTogglePin(activeRoadmap.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition ${
                  isPinned
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isPinned ? (
                  <>
                    <PinOff className="w-4 h-4 text-amber-600" />
                    Bỏ ghim
                  </>
                ) : (
                  <>
                    <Pin className="w-4 h-4 text-slate-500" />
                    Ghim lộ trình
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setLeaderboardRoadmapId(activeRoadmap.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                BXH
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenSrsForRoadmap({
                    id: activeRoadmap.id,
                    title: activeRoadmap.title,
                    decks: stats.decks,
                    items: stats.dedupedItems,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
              >
                <Layers className="w-4 h-4" />
                Học ngắt quãng (SRS)
              </button>
            </div>
          </div>

          {/* Overall Roadmap Progress Bar */}
          <div className="pt-2 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
              <span className="text-slate-600">
                Tiến độ lộ trình ({stats.decks.length} bộ từ):{' '}
                <strong className="text-emerald-700">
                  {stats.knownWords}/{stats.totalWords} từ đã thuộc
                </strong>
              </span>
              <span className="font-extrabold text-indigo-600">{stats.percent}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-300"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Constituent Decks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.decks.map((deck, idx) => {
            const deckItems = normalizedByDeckId[deck.id] || [];
            const dTotal = deckItems.length;
            let dKnown = 0;
            deckItems.forEach((it) => {
              if (vocabState.knownMap[it.wordKey]?.isKnown) dKnown++;
            });
            const dPercent = dTotal === 0 ? 0 : Math.round((dKnown / dTotal) * 100);

            return (
              <div
                key={deck.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-indigo-300 transition flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-extrabold">
                      Chặng {idx + 1}
                    </span>
                    {dPercent === 100 && dTotal > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Hoàn thành
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">{deck.title}</h3>
                  {deck.description && (
                    <p className="text-xs text-slate-500 line-clamp-2">{deck.description}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">
                        Đã thuộc: <strong className="text-slate-900">{dKnown}/{dTotal}</strong> từ
                      </span>
                      <span className="font-bold text-indigo-600">{dPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${dPercent}%` }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectDeck(deck.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white font-bold text-xs sm:text-sm transition"
                  >
                    <span>Vào học bộ từ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Leaderboard Modal (Section 17) */}
        {leaderboardRoadmapId && (
          <RoadmapLeaderboardModal
            roadmap={activeRoadmap}
            stats={stats}
            vocabState={vocabState}
            isUserAuthenticated={isUserAuthenticated}
            currentUserDisplayName={currentUserDisplayName}
            onToggleOptIn={handleToggleLeaderboardOptIn}
            onClose={() => setLeaderboardRoadmapId(null)}
          />
        )}
      </div>
    );
  }

  // Filter roadmaps list
  const filteredRoadmaps = roadmaps.filter((rm) => {
    if (selectedCategory !== 'all' && rm.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      return (
        rm.title.toLowerCase().includes(q) || rm.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pinnedRoadmaps = roadmaps.filter((rm) => vocabState.pinnedRoadmapIds.includes(rm.id));

  return (
    <div className="space-y-6">
      {/* Pinned Roadmaps Section */}
      {pinnedRoadmaps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              Lộ trình đã ghim ({pinnedRoadmaps.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pinnedRoadmaps.map((rm) => {
              const st = roadmapStatsMap[rm.id];
              return (
                <div
                  key={rm.id}
                  className="bg-gradient-to-br from-indigo-50/70 via-white to-amber-50/30 border-2 border-indigo-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-bold">
                        {rm.badgeText}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTogglePin(rm.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-rose-600"
                      >
                        <PinOff className="w-3.5 h-3.5" />
                        Bỏ ghim
                      </button>
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                      {rm.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{rm.description}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          {st.decks.length} bộ từ • Đã thuộc{' '}
                          <strong className="text-slate-900">
                            {st.knownWords}/{st.totalWords}
                          </strong>{' '}
                          từ
                        </span>
                        <span className="font-extrabold text-indigo-600">{st.percent}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${st.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveRoadmapId(rm.id)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-2xs transition"
                      >
                        <span>Mở lộ trình</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenSrsForRoadmap({
                            id: rm.id,
                            title: rm.title,
                            decks: st.decks,
                            items: st.dedupedItems,
                          })
                        }
                        className="px-3.5 py-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold transition"
                      >
                        Ôn SRS
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'Tất cả lộ trình' },
              { id: 'b1_core', label: 'Trọng tâm B1' },
              { id: 'listening', label: 'Kỹ năng Nghe' },
              { id: 'reading', label: 'Kỹ năng Đọc' },
              { id: 'exam_sets', label: 'Từ vựng Đề thi' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm lộ trình học..."
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* All Roadmaps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredRoadmaps.map((rm) => {
          const st = roadmapStatsMap[rm.id];
          const isPinned = vocabState.pinnedRoadmapIds.includes(rm.id);

          return (
            <div
              key={rm.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-bold">
                    {rm.badgeText}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePin(rm.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                      isPinned
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
                    }`}
                  >
                    <Pin className="w-3.5 h-3.5" />
                    {isPinned ? 'Đã ghim' : 'Ghim'}
                  </button>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">{rm.title}</h3>
                <p className="text-xs text-slate-500">{rm.description}</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {st.decks.length} bộ từ •{' '}
                      <strong className="text-slate-900">
                        {st.knownWords}/{st.totalWords}
                      </strong>{' '}
                      từ đã thuộc
                    </span>
                    <span className="font-bold text-indigo-600">{st.percent}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${st.percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveRoadmapId(rm.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition"
                  >
                    <span>Xem chi tiết {st.decks.length} bộ từ</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardRoadmapId(rm.id)}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1"
                    title="Bảng xếp hạng lộ trình"
                  >
                    <Trophy className="w-4 h-4 text-amber-500" />
                    BXH
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leaderboard Modal from List View */}
      {leaderboardRoadmapId && (
        <RoadmapLeaderboardModal
          roadmap={roadmaps.find((r) => r.id === leaderboardRoadmapId)!}
          stats={roadmapStatsMap[leaderboardRoadmapId]}
          vocabState={vocabState}
          isUserAuthenticated={isUserAuthenticated}
          currentUserDisplayName={currentUserDisplayName}
          onToggleOptIn={handleToggleLeaderboardOptIn}
          onClose={() => setLeaderboardRoadmapId(null)}
        />
      )}
    </div>
  );
};

interface RoadmapLeaderboardModalProps {
  roadmap: VocabRoadmapDefinition;
  stats: {
    totalWords: number;
    knownWords: number;
    percent: number;
  };
  vocabState: UserVocabPartitionState;
  isUserAuthenticated: boolean;
  currentUserDisplayName?: string | null;
  onToggleOptIn: () => void;
  onClose: () => void;
}

const RoadmapLeaderboardModal: React.FC<RoadmapLeaderboardModalProps> = ({
  roadmap,
  stats,
  vocabState,
  isUserAuthenticated,
  currentUserDisplayName,
  onToggleOptIn,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Bảng Xếp Hạng Lộ Trình (BXH)
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">{roadmap.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isUserAuthenticated || vocabState.userId === 'guest' ? (
          <div className="p-5 rounded-2xl bg-amber-50/80 border border-amber-200 text-center space-y-2">
            <Lock className="w-8 h-8 text-amber-600 mx-auto" />
            <h4 className="text-sm font-extrabold text-slate-900">
              Cần đăng nhập và đồng bộ để xem xếp hạng
            </h4>
            <p className="text-xs text-slate-600">
              Tiến độ hiện tại của bạn đang lưu cục bộ trên trình duyệt ({stats.knownWords}/
              {stats.totalWords} từ đã thuộc • {vocabState.pointsBalance} điểm). Hãy đăng nhập tài
              khoản học viên để đồng bộ xếp hạng thật.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Opt-in Privacy Control (Section 17) */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Hiển thị tiến độ của tôi trên BXH công khai
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mặc định tắt để bảo vệ quyền riêng tư của học viên.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={vocabState.leaderboardOptIn}
                onClick={onToggleOptIn}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  vocabState.leaderboardOptIn ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    vocabState.leaderboardOptIn ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Verified Current Learner Card */}
            <div className="p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                  #1
                </span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {currentUserDisplayName || 'Học viên (Bạn)'}
                  </div>
                  <div className="text-xs text-slate-600">
                    Đã thuộc {stats.knownWords}/{stats.totalWords} từ ({stats.percent}%)
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-extrabold text-indigo-700">
                  {vocabState.pointsBalance} điểm
                </div>
                <div className="text-[10px] text-slate-500">Dữ liệu xác thực</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
