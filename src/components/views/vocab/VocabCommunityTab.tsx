import React, { useState } from 'react';
import { Globe, Bookmark, Check, Volume2, Search, ArrowRight, Share2 } from 'lucide-react';
import { COMMUNITY_DECKS, UserVocabDeck, ExtendedVocabItem } from '../../../types/vocab';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';

interface VocabCommunityTabProps {
  onCloneDeck: (deck: UserVocabDeck) => void;
  onStartStudyItems: (items: ExtendedVocabItem[], title: string) => void;
}

export const VocabCommunityTab: React.FC<VocabCommunityTabProps> = ({
  onCloneDeck,
  onStartStudyItems,
}) => {
  const [clonedDeckIds, setClonedDeckIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCommunity = COMMUNITY_DECKS.filter((d) => {
    return (
      !searchQuery.trim() ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleClone = (deck: UserVocabDeck) => {
    onCloneDeck(deck);
    setClonedDeckIds((prev) => new Set([...prev, deck.id]));
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
              Thư Viện Từ Vựng Cộng Đồng LanguageCert
            </h3>
            <p className="text-xs text-white/90 mt-0.5">
              Các bộ flashcard được biên soạn bởi giáo viên, chuyên gia khảo thí và thí sinh đạt điểm cao.
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-white/60 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm bộ từ cộng đồng..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-xs text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>
      </div>

      {/* 2. COMMUNITY DECKS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCommunity.map((deck) => {
          const isCloned = clonedDeckIds.has(deck.id);
          return (
            <div
              key={deck.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-3xl p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60">
                    {deck.icon}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {deck.itemCount} từ vựng
                  </span>
                </div>

                <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100 leading-snug">
                  {deck.name}
                </h4>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                  {deck.description}
                </p>

                {/* Sample items preview */}
                <div className="mt-4 space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Từ vựng tiêu biểu:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {deck.items.slice(0, 4).map((it) => (
                      <span
                        key={it.id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {it.word}
                        <button
                          type="button"
                          onClick={() => playDictionaryAudio(it.word, 'uk')}
                          className="hover:text-primary-600 text-slate-400"
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
                  onClick={() => onStartStudyItems(deck.items, deck.name)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors"
                >
                  Học thử ngay
                </button>
                <button
                  type="button"
                  onClick={() => handleClone(deck)}
                  className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isCloned
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
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
