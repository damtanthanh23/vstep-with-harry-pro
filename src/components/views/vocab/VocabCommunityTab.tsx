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
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#1CB0F6] via-[#1899D6] to-[#58CC02] border-2 border-[#1899D6] border-b-4 border-b-[#11709E] text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-white/20 border-2 border-white/30 backdrop-blur-md rounded-2xl text-2xl">
            🌐
          </div>
          <div>
            <h3 className="font-black text-lg">
              Thư Viện Từ Vựng Cộng Đồng VSTEP Cloud ({combinedCommunityDecks.length} bộ)
            </h3>
            <p className="text-xs font-bold text-white/95 mt-0.5">
              Các bộ flashcard được chia sẻ công khai lên Cloud bởi giáo viên, chuyên gia khảo thí và học viên đạt điểm cao.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-white/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm bộ từ hoặc tác giả..."
              className="w-full pl-9 pr-3 py-2 rounded-2xl bg-white/20 backdrop-blur-md border-2 border-white/30 text-xs font-bold text-white placeholder-white/75 focus:outline-none focus:border-white"
            />
          </div>
          {onRefreshCloudDecks && (
            <button
              type="button"
              onClick={onRefreshCloudDecks}
              className="p-2.5 rounded-2xl bg-white text-[#1899D6] border-2 border-white border-b-4 border-b-[#DDF4FF] hover:bg-sky-50 transition-all cursor-pointer active:border-b-0 active:translate-y-1"
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
              className="bg-white dark:bg-slate-900 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-800 hover:border-[#1CB0F6] hover:border-b-[#1899D6] rounded-3xl p-5 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-3xl p-2.5 rounded-2xl bg-[#DDF4FF] dark:bg-blue-950/60 border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6]">
                    {deck.icon || '🌐'}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-black px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-[#E5E5E5] border-b-3 border-b-[#CECECE] text-slate-700 dark:text-slate-300">
                      {deck.itemCount || items.length} từ vựng
                    </span>
                    {deck.authorName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#46A302] dark:text-[#58CC02]">
                        <User className="w-3 h-3" />
                        <span>{deck.authorName}</span>
                      </span>
                    )}
                  </div>
                </div>

                <h4 className="font-black text-base text-slate-900 dark:text-slate-100 leading-snug">
                  {deck.title || deck.name}
                </h4>

                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                  {deck.description || 'Bộ từ vựng chia sẻ trên Thư viện Cộng đồng VSTEP.'}
                </p>

                {/* Sample items preview */}
                <div className="mt-4 space-y-1.5 pt-3 border-t-2 border-[#F0F0F0] dark:border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Từ vựng tiêu biểu:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {items.slice(0, 4).map((it) => (
                      <span
                        key={it.id}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] text-slate-700 dark:text-slate-300"
                      >
                        {it.word}
                        <button
                          type="button"
                          onClick={() => playDictionaryAudio(it.word, 'uk')}
                          className="hover:text-[#1CB0F6] text-slate-400 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2.5 mt-5 pt-3 border-t-2 border-[#F0F0F0] dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onStartStudyItems(items, deck.title || deck.name)}
                  className="btn-duo-white flex-1 py-2.5 px-3 rounded-2xl text-slate-800 dark:text-slate-200 text-xs font-black cursor-pointer"
                >
                  Học thử ngay
                </button>
                <button
                  type="button"
                  onClick={() => handleClone(deck)}
                  className={`py-2.5 px-3.5 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    isCloned
                      ? 'bg-[#D7FFB8] dark:bg-emerald-950/60 text-[#46A302] dark:text-emerald-400 border-2 border-[#58CC02] border-b-4 border-b-[#46A302]'
                      : 'btn-duo-green'
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
