import React, { useState, useMemo } from 'react';
import {
  Compass,
  Bookmark,
  Layers,
  ArrowRight,
  Sparkles,
  Check,
  ChevronRight,
  BookOpen,
  Volume2,
  X,
  Flame,
  DownloadCloud,
} from 'lucide-react';
import {
  CURATED_ROADMAPS,
  VocabRoadmap,
  ExtendedVocabItem,
} from '../../../types/vocab';
import { generate15TopicRoadmaps } from '../../../data/b1Official15TopicsData';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';

interface VocabRoadmapsTabProps {
  onSaveRoadmapToMyDecks: (roadmap: VocabRoadmap) => void;
  onStartStudyItems: (items: ExtendedVocabItem[], title: string) => void;
}

export const VocabRoadmapsTab: React.FC<VocabRoadmapsTabProps> = ({
  onSaveRoadmapToMyDecks,
  onStartStudyItems,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | '15_topics' | 'exam_parts' | 'levels'
  >('15_topics');
  const [savedRoadmapIds, setSavedRoadmapIds] = useState<Set<string>>(new Set());
  const [activeDetailRoadmap, setActiveDetailRoadmap] = useState<VocabRoadmap | null>(null);
  const [savedAllMessage, setSavedAllMessage] = useState(false);

  // Combine official 15 topic roadmaps with skill-based roadmaps
  const combinedRoadmaps = useMemo(() => {
    const topicRoadmaps = generate15TopicRoadmaps();
    const otherRoadmaps = CURATED_ROADMAPS.filter((r) => r.category !== '15_topics');
    return [...topicRoadmaps, ...otherRoadmaps];
  }, []);

  const pinnedRoadmaps = useMemo(() => {
    return combinedRoadmaps.filter((r) => r.isPinned);
  }, [combinedRoadmaps]);

  const filteredRoadmaps = useMemo(() => {
    if (selectedCategory === 'all') return combinedRoadmaps;
    return combinedRoadmaps.filter((r) => r.category === selectedCategory);
  }, [combinedRoadmaps, selectedCategory]);

  const handleSave = (roadmap: VocabRoadmap) => {
    onSaveRoadmapToMyDecks(roadmap);
    setSavedRoadmapIds((prev) => new Set([...prev, roadmap.id]));
  };

  const handleSaveAll15Topics = () => {
    const topicRoadmaps = generate15TopicRoadmaps();
    topicRoadmaps.forEach((rm) => onSaveRoadmapToMyDecks(rm));
    const allIds = new Set(savedRoadmapIds);
    topicRoadmaps.forEach((rm) => allIds.add(rm.id));
    setSavedRoadmapIds(allIds);
    setSavedAllMessage(true);
    setTimeout(() => setSavedAllMessage(false), 3500);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* SECTION 1: LỘ TRÌNH ĐÃ GHIM (PINNED ROADMAPS) */}
      {pinnedRoadmaps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-base">
            <span className="text-red-500">📌</span>
            <h3>Lộ trình đã ghim</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinnedRoadmaps.map((item) => {
              const isSaved = savedRoadmapIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className="relative group rounded-2xl bg-white dark:bg-slate-900 border-2 border-amber-400/80 dark:border-amber-500/60 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {/* Decorative corner ribbon */}
                  <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none">
                    <div className="bg-amber-400 dark:bg-amber-500 text-white text-[9px] font-bold py-1 w-20 text-center transform rotate-45 translate-x-5 translate-y-1 shadow-sm">
                      HOT
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors pr-6">
                      {item.title}
                    </h4>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                        📚 {item.totalDecks} bộ từ ({item.totalWords} từ)
                      </span>
                    </div>

                    {/* Difficulty indicator */}
                    <div className="mt-3.5 space-y-1 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium uppercase text-[10px] tracking-wider">
                          ĐỘ KHÓ
                        </span>
                        <span className="font-bold text-amber-600 dark:text-amber-400">
                          {item.difficulty}/5
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all"
                          style={{ width: `${(item.difficulty / 5) * 100}%` }}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => setActiveDetailRoadmap(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-1"
                    >
                      Xem chi tiết
                    </button>
                    <button
                      onClick={() => handleSave(item)}
                      className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        isSaved
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Đã lưu
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5" /> Lưu bộ này
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: CATEGORY FILTER PILLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('15_topics')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${
              selectedCategory === '15_topics'
                ? 'bg-[#58CC02] text-white shadow-md shadow-lime-500/25'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Theo 15 chủ đề B1 (15 bộ)
          </button>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#58CC02] text-white shadow-md shadow-lime-500/25'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Tất cả ({combinedRoadmaps.length})
          </button>
          <button
            onClick={() => setSelectedCategory('exam_parts')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${
              selectedCategory === 'exam_parts'
                ? 'bg-[#58CC02] text-white shadow-md shadow-lime-500/25'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Theo Part đề thi & Kỹ năng
          </button>
          <button
            onClick={() => setSelectedCategory('levels')}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${
              selectedCategory === 'levels'
                ? 'bg-[#58CC02] text-white shadow-md shadow-lime-500/25'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            Theo level (A2 - B1 - High Pass)
          </button>
        </div>

        {selectedCategory === '15_topics' && (
          <button
            type="button"
            onClick={handleSaveAll15Topics}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer self-start sm:self-auto"
          >
            <DownloadCloud className="w-4 h-4" />
            <span>{savedAllMessage ? '✓ Đã lưu trọn bộ 15 chủ đề vào Bộ của tôi!' : '📥 Lưu cả 15 chủ đề vào Bộ của tôi'}</span>
          </button>
        )}
      </div>

      {/* SECTION 3: ROADMAP CARDS GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>Danh sách lộ trình</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {filteredRoadmaps.length} lộ trình
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRoadmaps.map((roadmap) => {
            const isSaved = savedRoadmapIds.has(roadmap.id);
            return (
              <div
                key={roadmap.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 leading-snug">
                      {roadmap.title}
                    </h4>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {roadmap.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      📚 {roadmap.totalDecks} bộ từ
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {roadmap.totalWords} từ vựng
                    </span>
                  </div>

                  {/* Difficulty Bar */}
                  <div className="mt-3.5 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium text-[10px] uppercase tracking-wider">
                        ĐỘ KHÓ
                      </span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                        {roadmap.difficulty}/5
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(roadmap.difficulty / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 line-clamp-2">
                    {roadmap.description}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => setActiveDetailRoadmap(roadmap)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Xem chi tiết ({roadmap.sampleItems?.length || 0} từ)
                  </button>
                  <button
                    onClick={() => handleSave(roadmap)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                      isSaved
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-[#58CC02] hover:bg-[#46a302] text-white shadow-sm'
                    }`}
                  >
                    {isSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Đã lưu
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-3.5 h-3.5" /> Lưu vào Bộ
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAIL MODAL FOR A ROADMAP */}
      {activeDetailRoadmap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <span className="text-2xl p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                  🧭
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {activeDetailRoadmap.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeDetailRoadmap.totalWords} từ vựng chuẩn B1 • Độ khó {activeDetailRoadmap.difficulty}/5
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveDetailRoadmap(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {activeDetailRoadmap.description}
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Danh sách từ vựng trong bộ này ({activeDetailRoadmap.sampleItems.length} từ):
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Bấm loa để nghe phát âm UK
                  </span>
                </div>

                <div className="space-y-2.5">
                  {activeDetailRoadmap.sampleItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                            {item.word}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {item.phonetic}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold uppercase">
                            {item.partOfSpeech}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                          {item.meaningVi}
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-500">Ví dụ: </span>
                          <span className="italic">"{item.exampleEn}"</span>
                        </p>
                        {item.exampleVi && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            &rarr; {item.exampleVi}
                          </p>
                        )}
                        {item.collocations && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            🔗 Collocations: {item.collocations}
                          </p>
                        )}
                        {item.note && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            📌 Ghi chú: {item.note}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => playDictionaryAudio(item.word, 'uk')}
                        className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                        title="Nghe phát âm chuẩn UK"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <button
                type="button"
                onClick={() => setActiveDetailRoadmap(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Đóng
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSave(activeDetailRoadmap);
                    setActiveDetailRoadmap(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" /> Lưu vào Bộ của tôi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onStartStudyItems(activeDetailRoadmap.sampleItems, activeDetailRoadmap.title);
                    setActiveDetailRoadmap(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#58CC02] hover:bg-[#46a302] text-xs font-bold text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Luyện tập bộ này ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
