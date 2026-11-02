import React, { useState, useMemo } from 'react';
import { Bookmark, Check, Volume2, Search, RefreshCw, User } from 'lucide-react';
import { COMMUNITY_DECKS, UserVocabDeck, ExtendedVocabItem } from '../../../types/vocab';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';

interface VocabCommunityTabProps {
  cloudCommunityDecks?: UserVocabDeck[];
  clonedDeckIds?: string[];
  onRefreshCloudDecks?: () => void;
  onCloneDeck: (deck: UserVocabDeck) => void;
  onStartStudyItems: (items: ExtendedVocabItem[], title: string) => void;
}

export const VocabCommunityTab: React.FC<VocabCommunityTabProps> = ({
  cloudCommunityDecks = [],
  clonedDeckIds = [],
  onRefreshCloudDecks,
  onCloneDeck,
  onStartStudyItems,
}) => {
  const [localClonedIds, setLocalClonedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const clonedSet = useMemo(() => {
    return new Set([...clonedDeckIds, ...Array.from(localClonedIds)]);
  }, [clonedDeckIds, localClonedIds]);

  const combinedCommunityDecks = useMemo(() => {
    const map = new Map<string, UserVocabDeck>();
    cloudCommunityDecks.forEach((d) => {
      if (d && d.id) map.set(d.id, d);
    });
    COMMUNITY_DECKS.forEach((d) => {
      if (!map.has(d.id)) map.set(d.id, d);
    });
    return Array.from(map.values());
  }, [cloudCommunityDecks]);

  const filteredCommunity = combinedCommunityDecks.filter((d) => {
    const titleStr = d.title || d.name || '';
    return (
      !searchQuery.trim() ||
      titleStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.authorName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleClone = (deck: UserVocabDeck) => {
    onCloneDeck(deck);
    setLocalClonedIds((prev) => new Set([...prev, deck.id]));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. HERO HEADER */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-2xl">
            🌐
          </div>
          <div>
            <h3 className="font-extrabold text-lg">
              Thư Viện Từ Vựng Cộng Đồng VSTEP Cloud ({combinedCommunityDecks.length} bộ)
            </h3>
            <p className="text-xs text-white/90 mt-0.5">
              Các bộ flashcard được chia sẻ công khai lên Cloud bởi giáo viên, chuyên gia khảo thí và học viên đạt điểm cao.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-white/60 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm bộ từ hoặc tác giả..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-xs text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
            />
          </div>
          {onRefreshCloudDecks && (
            <button
              type="button"
              onClick={onRefreshCloudDecks}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white transition"
              title="Làm mới bộ từ Cộng đồng từ Cloud"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. COMMUNITY DECKS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCommunity.map((deck) => {
          const isCloned = clonedSet.has(deck.id);
          const items = Array.isArray(deck.items) ? deck.items : [];
          return (
            <div
              key={deck.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-3xl p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60">
                    {deck.icon || '🌐'}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {deck.itemCount || items.length} từ vựng
                    </span>
                    {deck.authorName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                        <User className="w-3 h-3" />
                        <span>{deck.authorName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100 leading-snug">
                  {deck.title || deck.name}
                </h4>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                  {deck.description || 'Bộ từ vựng chia sẻ trên Thư viện Cộng đồng VSTEP.'}
                </p>

                {/* Sample items preview */}
                <div className="mt-4 space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Từ vựng tiêu biểu:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 4).map((it) => (
                      <span
                        key={it.id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {it.word}
                        <button
                          type="button"
                          onClick={() => playDictionaryAudio(it.word, 'uk')}
                          className="hover:text-indigo-600 text-slate-400"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onStartStudyItems(items, deck.title || deck.name)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  Học thử ngay
                </button>
                <button
                  type="button"
                  onClick={() => handleClone(deck)}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isCloned
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  }`}
                >
                  {isCloned ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Đã sao chép
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5" /> Sao chép vào Bộ
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
