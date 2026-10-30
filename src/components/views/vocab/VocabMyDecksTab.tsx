import React, { useState, useMemo } from 'react';
import {
  Plus,
  Sparkles,
  FileSpreadsheet,
  Search,
  Volume2,
  CheckCircle2,
  Circle,
  Trash2,
  Layers,
  FileCode2,
  BookOpen,
  Compass,
  FileText,
  Tag,
  Play,
  Link2,
  Check,
  X,
} from 'lucide-react';
import {
  UserVocabDeck,
  UserVocabFolder,
  VocabDeckCategoryType,
  OFFICIAL_15_TOPICS,
} from '../../../types/vocab';
import { TestMetadata } from '../../../types/exam';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';

interface VocabMyDecksTabProps {
  decks: UserVocabDeck[];
  folders: UserVocabFolder[];
  tests?: TestMetadata[];
  activeDeckId: string;
  initialRelationshipFilter?: 'all' | VocabDeckCategoryType;
  onSelectDeck: (deckId: string) => void;
  onStartPracticeDeck?: (deckId: string) => void;
  onUpdateDeckRelationship?: (
    deckId: string,
    rel: {
      categoryType: VocabDeckCategoryType;
      officialTopicCode?: string;
      linkedTestId?: string;
      linkedTestTitle?: string;
      customTopicTag?: string;
    }
  ) => void;
  onCreateDeck: () => void;
  onCreateFolder: () => void;
  onOpenAiModal: () => void;
  onOpenImportModal: () => void;
  onOpenJsonModal?: () => void;
  onLoadDefault15Topics?: () => void;
  onToggleMasterWord: (deckId: string, wordId: string) => void;
  onDeleteWord: (deckId: string, wordId: string) => void;
  onDeleteDeck: (deckId: string) => void;
  onDeleteFolder: (folderId: string) => void;
}

export function resolveDeckCategory(deck: UserVocabDeck): VocabDeckCategoryType {
  if (deck.categoryType) return deck.categoryType;
  if (deck.id?.startsWith('deck_official_') || deck.officialTopicCode) return '15_topics';
  if (deck.linkedTestId || deck.linkedTestTitle) return 'exam_test';
  if (deck.customTopicTag) return 'custom_topic';
  return 'untagged';
}

export const VocabMyDecksTab: React.FC<VocabMyDecksTabProps> = ({
  decks,
  tests = [],
  activeDeckId,
  initialRelationshipFilter = 'all',
  onSelectDeck,
  onStartPracticeDeck,
  onUpdateDeckRelationship,
  onCreateDeck,
  onOpenAiModal,
  onOpenImportModal,
  onOpenJsonModal,
  onLoadDefault15Topics,
  onToggleMasterWord,
  onDeleteWord,
  onDeleteDeck,
}) => {
  const [relationshipFilter, setRelationshipFilter] = useState<'all' | VocabDeckCategoryType>(
    initialRelationshipFilter
  );
  const [deckSearchQuery, setDeckSearchQuery] = useState('');
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'mastered' | 'unmastered'>('all');

  // Relationship editor state for the currently active deck
  const [isEditingRelation, setIsEditingRelation] = useState(false);
  const [editCategory, setEditCategory] = useState<VocabDeckCategoryType>('15_topics');
  const [editOfficialTopic, setEditOfficialTopic] = useState<string>(OFFICIAL_15_TOPICS[0]);
  const [editTestId, setEditTestId] = useState<string>('');
  const [editCustomTag, setEditCustomTag] = useState<string>('');
  const [confirmDeleteDeckId, setConfirmDeleteDeckId] = useState<string | null>(null);

  // Sync relationshipFilter if parent passes a specific initial filter
  React.useEffect(() => {
    if (initialRelationshipFilter) {
      setRelationshipFilter(initialRelationshipFilter);
    }
  }, [initialRelationshipFilter]);

  // Count decks per relationship category
  const categoryCounts = useMemo(() => {
    const counts = {
      all: decks.length,
      '15_topics': 0,
      exam_test: 0,
      custom_topic: 0,
      untagged: 0,
    };
    decks.forEach((d) => {
      const cat = resolveDeckCategory(d);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [decks]);

  // Filtered decks on the left sidebar
  const visibleDecks = useMemo(() => {
    return decks.filter((d) => {
      const cat = resolveDeckCategory(d);
      const matchesCat = relationshipFilter === 'all' || cat === relationshipFilter;
      const q = deckSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.linkedTestTitle || '').toLowerCase().includes(q) ||
        (d.customTopicTag || '').toLowerCase().includes(q) ||
        (d.officialTopicCode || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [decks, relationshipFilter, deckSearchQuery]);

  // Active Deck object
  const activeDeck = useMemo(() => {
    return (
      decks.find((d) => d.id === activeDeckId) ||
      visibleDecks[0] ||
      decks[0] ||
      null
    );
  }, [decks, visibleDecks, activeDeckId]);

  const activeDeckCategory = useMemo(
    () => (activeDeck ? resolveDeckCategory(activeDeck) : 'untagged'),
    [activeDeck]
  );

  // Open relationship editor initialized with current deck values
  const handleOpenRelationEditor = () => {
    if (!activeDeck) return;
    const cat = resolveDeckCategory(activeDeck);
    setEditCategory(cat);
    setEditOfficialTopic(activeDeck.officialTopicCode || OFFICIAL_15_TOPICS[0]);
    setEditTestId(activeDeck.linkedTestId || tests[0]?.id || '');
    setEditCustomTag(activeDeck.customTopicTag || activeDeck.name);
    setIsEditingRelation(true);
  };

  const handleSaveRelation = () => {
    if (!activeDeck || !onUpdateDeckRelationship) return;
    const matchedTest = tests.find((t) => t.id === editTestId);
    onUpdateDeckRelationship(activeDeck.id, {
      categoryType: editCategory,
      officialTopicCode: editCategory === '15_topics' ? editOfficialTopic : undefined,
      linkedTestId: editCategory === 'exam_test' ? editTestId : undefined,
      linkedTestTitle:
        editCategory === 'exam_test'
          ? matchedTest?.title || activeDeck.linkedTestTitle || 'Đề thi LanguageCert B1'
          : undefined,
      customTopicTag:
        editCategory === 'custom_topic'
          ? editCustomTag.trim() || activeDeck.name
          : undefined,
    });
    setIsEditingRelation(false);
  };

  // Words list in active deck
  const words = activeDeck ? activeDeck.items || [] : [];

  // Stats calculation
  const totalCount = words.length;
  const masteredCount = words.filter((w) => w.isMastered).length;
  const unmasteredCount = totalCount - masteredCount;
  const masteredPercent = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  // Filtered words
  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      const q = wordSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        w.word.toLowerCase().includes(q) ||
        w.meaningVi.toLowerCase().includes(q) ||
        (w.collocations || '').toLowerCase().includes(q) ||
        (w.topic || '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'mastered' && w.isMastered) ||
        (statusFilter === 'unmastered' && !w.isMastered);

      return matchesSearch && matchesStatus;
    });
  }, [words, wordSearchQuery, statusFilter]);

  const renderCategoryBadge = (deck: UserVocabDeck) => {
    const cat = resolveDeckCategory(deck);
    if (cat === '15_topics') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70">
          <Compass className="w-3 h-3 shrink-0" />
          <span>15 Chủ đề chuẩn B1</span>
        </span>
      );
    }
    if (cat === 'exam_test') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/70">
          <FileText className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[180px]">
            Đề: {deck.linkedTestTitle || 'Đề thi trong Web'}
          </span>
        </span>
      );
    }
    if (cat === 'custom_topic') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/70">
          <Tag className="w-3 h-3 shrink-0" />
          <span>Chủ đề: {deck.customTopicTag || 'Tự tạo'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <Layers className="w-3 h-3 shrink-0" />
        <span>Không gắn tag</span>
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 1. RELATIONSHIP FILTER BAR & QUICK CREATION ACTIONS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-600" />
              Phân loại & Mối quan hệ Bộ Từ Vựng
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mỗi bộ từ có thể thuộc 15 Chủ đề B1, gắn với Đề thi trong Web, gắn Chủ đề riêng hoặc độc lập không gắn tag.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onCreateDeck}
              className="px-3.5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo bộ từ mới</span>
            </button>

            <button
              type="button"
              onClick={onOpenJsonModal || onOpenImportModal}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileCode2 className="w-4 h-4" />
              <span>Nhập JSON hàng loạt & AI Prompt</span>
            </button>

            <button
              type="button"
              onClick={onOpenAiModal}
              className="px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tạo từ bằng AI</span>
            </button>

            <button
              type="button"
              onClick={onOpenImportModal}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
              <span>Thêm nhanh</span>
            </button>

            {onLoadDefault15Topics && (
              <button
                type="button"
                onClick={onLoadDefault15Topics}
                className="px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="Đồng bộ hoặc khôi phục 15 chủ đề chuẩn LanguageCert B1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>15 Chủ đề gốc</span>
              </button>
            )}
          </div>
        </div>

        {/* 5 Relationship Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRelationshipFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              relationshipFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>Tất cả bộ từ</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-white/20 dark:bg-slate-900/20 tabular-nums">
              {categoryCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRelationshipFilter('15_topics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              relationshipFilter === '15_topics'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>15 Chủ đề chuẩn B1</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 dark:bg-white/10 tabular-nums">
              {categoryCounts['15_topics']}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRelationshipFilter('exam_test')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              relationshipFilter === 'exam_test'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50/80 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Theo Đề thi trong Web</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 dark:bg-white/10 tabular-nums">
              {categoryCounts.exam_test}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRelationshipFilter('custom_topic')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              relationshipFilter === 'custom_topic'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50/80 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Chủ đề riêng (Tự tạo)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 dark:bg-white/10 tabular-nums">
              {categoryCounts.custom_topic}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRelationshipFilter('untagged')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              relationshipFilter === 'untagged'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Không gắn tag (Độc lập)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/10 dark:bg-white/10 tabular-nums">
              {categoryCounts.untagged}
            </span>
          </button>
        </div>
      </div>

      {/* 2. MASTER-DETAIL WORKSPACE (LEFT: DECK DIRECTORY | RIGHT: ACTIVE DECK INSPECTOR) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: DECK LIST (4 COLS) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Danh sách bộ từ ({visibleDecks.length})
            </span>
          </div>

          {/* Search deck input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={deckSearchQuery}
              onChange={(e) => setDeckSearchQuery(e.target.value)}
              placeholder="Tìm tên bộ từ, chủ đề hoặc tên đề thi..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Scrollable Deck Cards */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {visibleDecks.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  Không có bộ từ nào trong phân mục này.
                </p>
                <button
                  type="button"
                  onClick={onOpenJsonModal || onCreateDeck}
                  className="px-3.5 py-2 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition-all inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tạo hoặc Nhập JSON ngay</span>
                </button>
              </div>
            ) : (
              visibleDecks.map((deck) => {
                const isSelected = deck.id === (activeDeck?.id || '');
                const dWords = deck.items || [];
                const dMastered = dWords.filter((i) => i.isMastered).length;
                const dPct = dWords.length > 0 ? Math.round((dMastered / dWords.length) * 100) : 0;

                return (
                  <div
                    key={deck.id}
                    onClick={() => {
                      onSelectDeck(deck.id);
                      setIsEditingRelation(false);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-950/40 shadow-sm ring-1 ring-primary-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="text-xl p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                          {deck.icon || '📚'}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-snug break-words">
                            {deck.name}
                          </h4>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {renderCategoryBadge(deck)}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-black tabular-nums shrink-0 ${
                          isSelected
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {dWords.length} từ
                      </span>
                    </div>

                    {/* Progress & Quick Practice */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1">
                          <span>Đã thuộc: {dMastered}/{dWords.length}</span>
                          <span className="tabular-nums font-bold">{dPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${dPct}%` }}
                          />
                        </div>
                      </div>

                      {onStartPracticeDeck && dWords.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDeck(deck.id);
                            onStartPracticeDeck(deck.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold flex items-center gap-1 shrink-0 shadow-2xs transition-colors cursor-pointer"
                          title="Chuyển sang Phòng Luyện Tập với bộ từ này"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Luyện</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE DECK INSPECTOR (8 COLS) */}
        <div className="lg:col-span-8 space-y-4">
          {activeDeck ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              {/* Deck Header + Primary Practice CTA */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3.5">
                  <span className="text-3xl p-3 rounded-2xl bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-900">
                    {activeDeck.icon || '📚'}
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderCategoryBadge(activeDeck)}
                      <button
                        type="button"
                        onClick={handleOpenRelationEditor}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Đổi liên kết (Chủ đề / Đề thi / Tag)</span>
                      </button>
                    </div>
                    <h3 className="font-black text-xl text-slate-900 dark:text-slate-100 leading-tight">
                      {activeDeck.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeDeck.description || 'Danh sách từ vựng trọng tâm LanguageCert B1'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onStartPracticeDeck && (
                    <button
                      type="button"
                      onClick={() => onStartPracticeDeck(activeDeck.id)}
                      className="px-4 py-2.5 rounded-xl bg-[#58CC02] hover:bg-[#4eb802] text-white font-black text-xs sm:text-sm shadow-md shadow-lime-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Luyện tập bộ từ này ngay</span>
                    </button>
                  )}

                  {decks.length > 1 && (
                    <>
                      {confirmDeleteDeckId === activeDeck.id ? (
                        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-2.5 py-1.5 rounded-xl">
                          <span className="text-[11px] font-bold text-red-700 dark:text-red-300">
                            Xóa bộ từ?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteDeck(activeDeck.id);
                              setConfirmDeleteDeckId(null);
                            }}
                            className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-bold"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteDeckId(null)}
                            className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDeckId(activeDeck.id)}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer"
                          title="Xóa bộ từ này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* INLINE RELATIONSHIP EDITOR PANEL */}
              {isEditingRelation && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-primary-200 dark:border-primary-800 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-primary-600" />
                      Gán lại mối quan hệ cho bộ từ "{activeDeck.name}"
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingRelation(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditCategory('15_topics')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        editCategory === '15_topics'
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600'
                      }`}
                    >
                      <Compass className="w-3.5 h-3.5 text-emerald-500" />
                      <span>15 Chủ đề B1</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditCategory('exam_test')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        editCategory === 'exam_test'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span>Gắn vào Đề thi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditCategory('custom_topic')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        editCategory === 'custom_topic'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5 text-purple-500" />
                      <span>Chủ đề tự tạo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditCategory('untagged')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                        editCategory === 'untagged'
                          ? 'border-slate-700 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span>Không gắn tag</span>
                    </button>
                  </div>

                  {editCategory === '15_topics' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Chọn chủ đề chuẩn B1:
                      </label>
                      <select
                        value={editOfficialTopic}
                        onChange={(e) => setEditOfficialTopic(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      >
                        {OFFICIAL_15_TOPICS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editCategory === 'exam_test' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Chọn Đề thi trong hệ thống Web:
                      </label>
                      <select
                        value={editTestId}
                        onChange={(e) => setEditTestId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      >
                        <option value="">-- Chọn đề thi --</option>
                        {tests.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {editCategory === 'custom_topic' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Tên nhãn chủ đề riêng:
                      </label>
                      <input
                        type="text"
                        value={editCustomTag}
                        onChange={(e) => setEditCustomTag(e.target.value)}
                        placeholder="VD: Từ vựng Bẫy Listening Part 1..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingRelation(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRelation}
                      className="px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Lưu liên kết</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Compact Stats Strip for Active Deck */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng số từ</span>
                    <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">
                      {totalCount}
                    </p>
                  </div>
                  <span className="text-base">📘</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Đã thuộc</span>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {masteredCount}
                    </p>
                  </div>
                  <span className="text-base">✅</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-600 uppercase">Chưa thuộc</span>
                    <p className="text-lg font-black text-amber-600 dark:text-amber-400 tabular-nums">
                      {unmasteredCount}
                    </p>
                  </div>
                  <span className="text-base">⏳</span>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-600 uppercase">Hoàn thành</span>
                    <p className="text-lg font-black text-purple-600 dark:text-purple-400 tabular-nums">
                      {masteredPercent}%
                    </p>
                  </div>
                  <span className="text-base">🎯</span>
                </div>
              </div>

              {/* Word Search & Mastery Filter */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={wordSearchQuery}
                    onChange={(e) => setWordSearchQuery(e.target.value)}
                    placeholder="Tìm từ tiếng Anh, nghĩa tiếng Việt hoặc collocation trong bộ này..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all tabular-nums ${
                      statusFilter === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Tất cả ({totalCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('unmastered')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all tabular-nums ${
                      statusFilter === 'unmastered'
                        ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Chưa thuộc ({unmasteredCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('mastered')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all tabular-nums ${
                      statusFilter === 'mastered'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Đã thuộc ({masteredCount})
                  </button>
                </div>
              </div>

              {/* Vocabulary Table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 w-44">Từ vựng & Âm thanh</th>
                      <th className="p-3 w-20">Loại từ</th>
                      <th className="p-3 w-48">Nghĩa tiếng Việt</th>
                      <th className="p-3">Ví dụ thực tế & Collocation</th>
                      <th className="p-3 w-16 text-center">Thuộc</th>
                      <th className="p-3 w-12 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {filteredWords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                          {wordSearchQuery
                            ? 'Không tìm thấy từ vựng khớp với từ khóa.'
                            : 'Bộ từ này chưa có từ vựng nào. Hãy nhấn "Nhập JSON hàng loạt & AI Prompt" hoặc "Tạo từ bằng AI" để thêm từ!'}
                        </td>
                      </tr>
                    ) : (
                      filteredWords.map((item, idx) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="p-3 text-center text-slate-400 font-mono tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                                {item.word}
                              </span>
                              <button
                                type="button"
                                onClick={() => playDictionaryAudio(item.word, 'uk')}
                                className="p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors cursor-pointer"
                                title="Nghe phát âm chuẩn Anh-Anh"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {item.phonetic && (
                              <span className="block font-mono text-slate-400 text-[11px] mt-0.5">
                                {item.phonetic}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {item.partOfSpeech || 'word'}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                            {item.meaningVi}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 space-y-1">
                            {item.exampleEn && <p className="italic text-slate-800 dark:text-slate-200">{item.exampleEn}</p>}
                            {item.exampleVi && (
                              <p className="text-slate-500 text-[11px]">{item.exampleVi}</p>
                            )}
                            {(item.collocations || item.note) && (
                              <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                💡 {item.collocations || item.note}
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => onToggleMasterWord(activeDeck.id, item.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center cursor-pointer"
                              title={
                                item.isMastered
                                  ? 'Đã thuộc (Nhấn để đánh dấu chưa thuộc)'
                                  : 'Chưa thuộc (Nhấn để đánh dấu đã thuộc)'
                              }
                            >
                              {item.isMastered ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => onDeleteWord(activeDeck.id, item.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                              title="Xóa từ này khỏi bộ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400">
              Hãy chọn một bộ từ bên trái hoặc tạo bộ từ mới để bắt đầu.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
