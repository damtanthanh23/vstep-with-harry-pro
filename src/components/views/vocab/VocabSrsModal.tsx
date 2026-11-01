import React, { useState, useMemo } from 'react';
import {
  X,
  Settings,
  Volume2,
  Play,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react';
import { NormalizedVocabItem } from '../../../utils/vocabEngine';
import {
  UserVocabPartitionState,
  SrsLevelNumber,
  SrsTransitionKey,
  SrsStepMode,
  Lv5CycleOption,
  DEFAULT_SRS_SETTINGS,
  VocabSrsSettings,
  adjustSrsLevelManually,
  toggleSuspendSrsWord,
  enrollWordInSrsManual,
  updateSrsSettingsAndLv5Schedule,
} from '../../../services/vocabStorageService';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';

export interface SrsDeckOption {
  id: string;
  title: string;
}

export interface VocabSrsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scopeType: 'roadmap' | 'personal-decks' | 'deck';
  scopeId: string;
  scopeTitle: string;
  availableDecks: SrsDeckOption[];
  scopeItems: NormalizedVocabItem[];
  vocabState: UserVocabPartitionState;
  onVocabStateChange: (nextState: UserVocabPartitionState) => void;
  onStartSrsSession: (params: {
    items: NormalizedVocabItem[];
    isEarlyPractice: boolean;
    scopeTitle: string;
  }) => void;
}

const LEVEL_COLORS: Record<SrsLevelNumber, { bar: string; badge: string; text: string; label: string }> = {
  0: {
    bar: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    text: 'text-rose-600',
    label: 'Lv0 • Mới / Học lại',
  },
  1: {
    bar: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    text: 'text-amber-600',
    label: 'Lv1 • Nhớ sơ bộ (+1 ngày)',
  },
  2: {
    bar: 'bg-yellow-500',
    badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    text: 'text-yellow-600',
    label: 'Lv2 • Đang củng cố (+3 ngày)',
  },
  3: {
    bar: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    text: 'text-sky-600',
    label: 'Lv3 • Nhớ khá vững (+7 ngày)',
  },
  4: {
    bar: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    text: 'text-indigo-600',
    label: 'Lv4 • Nhớ sâu (+14 ngày)',
  },
  5: {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'text-emerald-600',
    label: 'Lv5 • Thành thạo dài hạn',
  },
};

const TRANSITION_ROWS: { key: SrsTransitionKey; label: string; isHighLevel: boolean }[] = [
  { key: '0_1', label: 'Lv0 → Lv1 (+1 ngày)', isHighLevel: false },
  { key: '1_2', label: 'Lv1 → Lv2 (+3 ngày)', isHighLevel: false },
  { key: '2_3', label: 'Lv2 → Lv3 (+7 ngày)', isHighLevel: true },
  { key: '3_4', label: 'Lv3 → Lv4 (+14 ngày)', isHighLevel: true },
  { key: '4_5', label: 'Lv4 → Lv5 (Thành thạo)', isHighLevel: true },
];

const MODE_OPTIONS: { value: SrsStepMode; label: string }[] = [
  { value: 'flashcard', label: 'Thẻ' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'spell', label: 'Gõ' },
  { value: 'dictation', label: 'Nghe' },
];

const LV5_CYCLE_OPTIONS: { value: Lv5CycleOption; label: string }[] = [
  { value: null, label: 'Không ôn lại' },
  { value: 15, label: '15 ngày' },
  { value: 30, label: '30 ngày' },
  { value: 45, label: '45 ngày' },
  { value: 60, label: '60 ngày' },
];

function formatDueStatus(dueAt: number | null, srsLevel: SrsLevelNumber, now: number): {
  text: string;
  isDue: boolean;
  className: string;
} {
  if (dueAt === null) {
    if (srsLevel === 5) {
      return {
        text: 'Hoàn tất (Không hẹn lại)',
        isDue: false,
        className: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      };
    }
    return {
      text: 'Chưa có lịch hẹn',
      isDue: false,
      className: 'text-slate-500 bg-slate-100 border-slate-200',
    };
  }

  if (dueAt <= now) {
    return {
      text: 'Đến hạn ôn ngay',
      isDue: true,
      className: 'text-rose-700 bg-rose-50 border-rose-200 font-bold',
    };
  }

  const diffMs = dueAt - now;
  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) {
    return {
      text: `Hẹn sau ${diffMins} phút`,
      isDue: false,
      className: 'text-amber-700 bg-amber-50 border-amber-200',
    };
  }
  const diffHours = Math.ceil(diffMins / 60);
  if (diffHours < 24) {
    return {
      text: `Hẹn sau ${diffHours} giờ`,
      isDue: false,
      className: 'text-sky-700 bg-sky-50 border-sky-200',
    };
  }
  const dateStr = new Date(dueAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return {
    text: `Hẹn: ${dateStr}`,
    isDue: false,
    className: 'text-slate-600 bg-slate-50 border-slate-200',
  };
}

export const VocabSrsModal: React.FC<VocabSrsModalProps> = ({
  isOpen,
  onClose,
  scopeTitle,
  availableDecks,
  scopeItems,
  vocabState,
  onVocabStateChange,
  onStartSrsSession,
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<
    'ALL' | '0' | '1' | '2' | '3' | '4' | '5' | 'SUSPENDED' | 'NOT_ENROLLED'
  >('ALL');
  const [batchSize, setBatchSize] = useState<number>(20);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState<VocabSrsSettings>(vocabState.srsSettings);
  const [pendingLevelChange, setPendingLevelChange] = useState<{
    item: NormalizedVocabItem;
    newLevel: SrsLevelNumber;
  } | null>(null);
  const [earlyPracticeConfirmItem, setEarlyPracticeConfirmItem] = useState<NormalizedVocabItem | null>(
    null
  );

  const pageSize = 25;
  const now = Date.now();

  // Deduplicate scope items by wordKey, filtered by shared deck selector
  const deckFilteredItems = useMemo(() => {
    const map = new Map<string, NormalizedVocabItem>();
    scopeItems.forEach((item) => {
      if (selectedDeckId !== 'ALL' && item.deckId !== selectedDeckId) return;
      if (!map.has(item.wordKey)) {
        map.set(item.wordKey, item);
      }
    });
    return Array.from(map.values());
  }, [scopeItems, selectedDeckId]);

  // Compute SRS Level Distribution (only enrolled && !suspended items in deckFilteredItems)
  const distribution = useMemo(() => {
    const counts: Record<SrsLevelNumber, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalActiveEnrolled = 0;
    let suspendedCount = 0;
    let notEnrolledCount = 0;

    deckFilteredItems.forEach((item) => {
      const rec = vocabState.srsMap[item.wordKey];
      if (!rec || !rec.enrolled) {
        notEnrolledCount++;
        return;
      }
      if (rec.suspended) {
        suspendedCount++;
        return;
      }
      const lv = rec.srsLevel;
      counts[lv] = (counts[lv] || 0) + 1;
      totalActiveEnrolled++;
    });

    const maxCount = Math.max(1, ...Object.values(counts));
    return {
      counts,
      maxCount,
      totalActiveEnrolled,
      suspendedCount,
      notEnrolledCount,
    };
  }, [deckFilteredItems, vocabState.srsMap]);

  // Compute Due Queue (strictly enrolled && !suspended && dueAt != null && dueAt <= now)
  // Note: Table searchQuery & levelFilter do NOT alter the due queue
  const { dueQueue, earliestFutureDueAt, activeEnrolledItems } = useMemo(() => {
    const due: { item: NormalizedVocabItem; dueAt: number; level: SrsLevelNumber }[] = [];
    const activeAll: NormalizedVocabItem[] = [];
    let earliestFuture: number | null = null;

    deckFilteredItems.forEach((item) => {
      const rec = vocabState.srsMap[item.wordKey];
      if (!rec || !rec.enrolled || rec.suspended) return;
      activeAll.push(item);

      if (rec.dueAt !== null) {
        if (rec.dueAt <= now) {
          due.push({ item, dueAt: rec.dueAt, level: rec.srsLevel });
        } else if (earliestFuture === null || rec.dueAt < earliestFuture) {
          earliestFuture = rec.dueAt;
        }
      }
    });

    // Prioritize most overdue first, then lower level first
    due.sort((a, b) => {
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      return a.level - b.level;
    });

    return {
      dueQueue: due.map((d) => d.item),
      earliestFutureDueAt: earliestFuture,
      activeEnrolledItems: activeAll,
    };
  }, [deckFilteredItems, vocabState.srsMap, now]);

  // Table filtered items (searchQuery + levelFilter)
  const tableItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return deckFilteredItems.filter((item) => {
      const rec = vocabState.srsMap[item.wordKey];
      if (levelFilter === 'NOT_ENROLLED') {
        if (rec && rec.enrolled) return false;
      } else if (levelFilter === 'SUSPENDED') {
        if (!rec || !rec.enrolled || !rec.suspended) return false;
      } else if (levelFilter !== 'ALL') {
        const targetLv = Number(levelFilter) as SrsLevelNumber;
        if (!rec || !rec.enrolled || rec.suspended || rec.srsLevel !== targetLv) return false;
      }

      if (q) {
        const matchWord = item.word.toLowerCase().includes(q);
        const matchMeaning = item.meaningVi.toLowerCase().includes(q);
        if (!matchWord && !matchMeaning) return false;
      }
      return true;
    });
  }, [deckFilteredItems, vocabState.srsMap, searchQuery, levelFilter]);

  const totalPages = Math.max(1, Math.ceil(tableItems.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return tableItems.slice(start, start + pageSize);
  }, [tableItems, safePage]);

  if (!isOpen) return null;

  const deckTitleMap = new Map<string, string>(availableDecks.map((d) => [d.id, d.title]));

  const handleOpenSettings = () => {
    setDraftSettings(vocabState.srsSettings);
    setIsSettingsOpen(true);
  };

  const handleSaveSettings = () => {
    const updated = updateSrsSettingsAndLv5Schedule(vocabState, draftSettings);
    onVocabStateChange(updated);
    setIsSettingsOpen(false);
  };

  const handleResetDefaultSettings = () => {
    setDraftSettings({
      ...DEFAULT_SRS_SETTINGS,
      updatedAt: Date.now(),
    });
  };

  const handleConfirmManualLevelChange = () => {
    if (!pendingLevelChange) return;
    const nextState = adjustSrsLevelManually(
      vocabState,
      pendingLevelChange.item.deckId,
      pendingLevelChange.item.id,
      pendingLevelChange.newLevel
    );
    onVocabStateChange(nextState);
    setPendingLevelChange(null);
  };

  const handleStartDueBatch = () => {
    if (dueQueue.length === 0) return;
    const count = batchSize === 0 ? dueQueue.length : Math.min(batchSize, dueQueue.length);
    const selected = dueQueue.slice(0, count);
    onStartSrsSession({
      items: selected,
      isEarlyPractice: false,
      scopeTitle: `${scopeTitle} (Ôn SRS đến hạn)`,
    });
  };

  const handleStartEarlyBatch = () => {
    const pool = activeEnrolledItems.length > 0 ? activeEnrolledItems : deckFilteredItems;
    if (pool.length === 0) return;
    const count = batchSize === 0 ? pool.length : Math.min(batchSize, pool.length);
    const selected = pool.slice(0, count);
    onStartSrsSession({
      items: selected,
      isEarlyPractice: true,
      scopeTitle: `${scopeTitle} (Luyện trước hạn)`,
    });
  };

  const handleReviewSingleNow = (item: NormalizedVocabItem) => {
    const rec = vocabState.srsMap[item.wordKey];
    const isCurrentlyDue =
      rec && rec.enrolled && !rec.suspended && rec.dueAt !== null && rec.dueAt <= Date.now();
    if (isCurrentlyDue) {
      onStartSrsSession({
        items: [item],
        isEarlyPractice: false,
        scopeTitle: `Ôn SRS: ${item.word}`,
      });
    } else {
      setEarlyPracticeConfirmItem(item);
    }
  };

  const confirmSingleEarlyReview = () => {
    if (!earlyPracticeConfirmItem) return;
    const item = earlyPracticeConfirmItem;
    setEarlyPracticeConfirmItem(null);
    onStartSrsSession({
      items: [item],
      isEarlyPractice: true,
      scopeTitle: `Luyện sớm: ${item.word}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm">
                SRS
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Ôn tập ngắt quãng (Spaced Repetition)
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              Phạm vi: <span className="font-semibold text-slate-800">{scopeTitle}</span> • Tổng{' '}
              <span className="font-semibold text-indigo-600">
                {distribution.totalActiveEnrolled}
              </span>{' '}
              từ đang theo dõi SRS
              {distribution.suspendedCount > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  ({distribution.suspendedCount} tạm dừng)
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenSettings}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold shadow-2xs transition"
            >
              <Settings className="w-4 h-4 text-indigo-600" />
              Cài đặt SRS
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Level Distribution Bar Chart (Lv0 - Lv5) */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Phân bổ cấp độ ghi nhớ (Lv0 – Lv5)
                </h3>
                <p className="text-xs text-slate-500">
                  Tổng số cột bằng đúng {distribution.totalActiveEnrolled} từ đang kích hoạt trong
                  phạm vi bộ từ đang chọn.
                </p>
              </div>
              <div className="text-xs text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                Chu kỳ Lv5:{' '}
                <span className="font-bold text-indigo-600">
                  {vocabState.srsSettings.lv5CycleDays === null
                    ? 'Không ôn lại'
                    : `${vocabState.srsSettings.lv5CycleDays} ngày`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end pt-4 pb-1 px-2 bg-white rounded-xl border border-slate-200/70">
              {([0, 1, 2, 3, 4, 5] as SrsLevelNumber[]).map((lv) => {
                const count = distribution.counts[lv] || 0;
                const heightPx =
                  count === 0 ? 4 : Math.max(12, Math.round((count / distribution.maxCount) * 96));
                const cfg = LEVEL_COLORS[lv];
                const isSelected = levelFilter === String(lv);

                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => {
                      setLevelFilter(isSelected ? 'ALL' : (String(lv) as any));
                      setCurrentPage(1);
                    }}
                    className={`group flex flex-col items-center p-2 rounded-xl transition ${
                      isSelected ? 'bg-indigo-50/70 ring-2 ring-indigo-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-xs sm:text-sm font-extrabold mb-1.5 ${cfg.text}`}>
                      {count}
                    </span>
                    <div className="w-full max-w-[48px] h-24 flex items-end justify-center bg-slate-100/70 rounded-lg overflow-hidden px-1">
                      <div
                        style={{ height: `${heightPx}px` }}
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          count === 0 ? 'bg-slate-300' : cfg.bar
                        }`}
                      />
                    </div>
                    <span className="mt-2 text-xs font-bold text-slate-800">Lv{lv}</span>
                    <span className="text-[10px] text-slate-500 hidden sm:inline text-center line-clamp-1">
                      {lv === 0
                        ? 'Mới/Học lại'
                        : lv === 1
                        ? '+1 ngày'
                        : lv === 2
                        ? '+3 ngày'
                        : lv === 3
                        ? '+7 ngày'
                        : lv === 4
                        ? '+14 ngày'
                        : 'Thành thạo'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm kiếm từ tiếng Anh hoặc nghĩa tiếng Việt trong bảng..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {availableDecks.length > 1 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                    Bộ từ:
                  </label>
                  <select
                    value={selectedDeckId}
                    onChange={(e) => {
                      setSelectedDeckId(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 text-xs sm:text-sm font-medium border border-slate-300 rounded-xl bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">Tất cả bộ từ ({availableDecks.length} bộ)</option>
                    {availableDecks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Level Filter Chips */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: `Tất cả (${deckFilteredItems.length})` },
                    { id: '0', label: `Lv0 (${distribution.counts[0]})` },
                    { id: '1', label: `Lv1 (${distribution.counts[1]})` },
                    { id: '2', label: `Lv2 (${distribution.counts[2]})` },
                    { id: '3', label: `Lv3 (${distribution.counts[3]})` },
                    { id: '4', label: `Lv4 (${distribution.counts[4]})` },
                    { id: '5', label: `Lv5 (${distribution.counts[5]})` },
                    { id: 'SUSPENDED', label: `Tạm dừng (${distribution.suspendedCount})` },
                    { id: 'NOT_ENROLLED', label: `Chưa vào SRS (${distribution.notEnrolledCount})` },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setLevelFilter(chip.id);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      levelFilter === chip.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Bộ lọc tìm kiếm/cấp độ chỉ lọc bảng hiển thị, không làm hẹp hàng đợi từ đến hạn.
              </p>
            </div>
          </div>

          {/* Word Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3 w-10 text-center">Loa</th>
                    <th className="py-3 px-3">Từ vựng & Phiên âm</th>
                    <th className="py-3 px-3">Nghĩa tiếng Việt</th>
                    <th className="py-3 px-3">Cấp độ & Lịch hẹn</th>
                    <th className="py-3 px-3 text-right">Thao tác SRS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">
                        Không có từ vựng nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((item) => {
                      const rec = vocabState.srsMap[item.wordKey];
                      const isEnrolled = Boolean(rec?.enrolled);
                      const isSuspended = Boolean(rec?.suspended);
                      const srsLevel: SrsLevelNumber = rec?.srsLevel ?? 0;
                      const dueInfo = isEnrolled
                        ? formatDueStatus(rec.dueAt, srsLevel, now)
                        : null;

                      return (
                        <tr
                          key={item.wordKey}
                          className={`hover:bg-slate-50/80 transition ${
                            isSuspended ? 'opacity-60 bg-slate-50/40' : ''
                          }`}
                        >
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                playDictionaryAudio(item.word, {
                                  customAudioUrl: item.audioUrl,
                                  volumePercent: vocabState.audioVolumePercent,
                                })
                              }
                              className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-bold text-slate-900">{item.word}</span>
                              {item.phonetic && (
                                <span className="text-xs text-slate-500 font-mono">
                                  {item.phonetic}
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-md bg-slate-100 text-slate-600">
                                {item.partOfSpeech}
                              </span>
                            </div>
                            {availableDecks.length > 1 && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Bộ: {deckTitleMap.get(item.deckId) || item.deckId}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-700 font-medium">
                            {item.meaningVi}
                          </td>
                          <td className="py-3 px-3">
                            {!isEnrolled ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Chưa đưa vào SRS
                              </span>
                            ) : isSuspended ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <PauseCircle className="w-3.5 h-3.5" />
                                Đang tạm dừng (Lv{srsLevel})
                              </span>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${LEVEL_COLORS[srsLevel].badge}`}
                                >
                                  Lv{srsLevel}
                                </span>
                                {dueInfo && (
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs border ${dueInfo.className}`}
                                  >
                                    {dueInfo.text}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                              {!isEnrolled ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = enrollWordInSrsManual(
                                      vocabState,
                                      item.deckId,
                                      item.id,
                                      item.contentVersion
                                    );
                                    onVocabStateChange(next);
                                  }}
                                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                                >
                                  + Đưa vào SRS
                                </button>
                              ) : (
                                <>
                                  <select
                                    value={srsLevel}
                                    onChange={(e) => {
                                      const newLv = Number(e.target.value) as SrsLevelNumber;
                                      if (newLv !== srsLevel) {
                                        setPendingLevelChange({ item, newLevel: newLv });
                                      }
                                    }}
                                    aria-label="Đổi cấp độ SRS"
                                    className="px-2 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 hover:border-slate-300"
                                  >
                                    {([0, 1, 2, 3, 4, 5] as SrsLevelNumber[]).map((lv) => (
                                      <option key={lv} value={lv}>
                                        Lv{lv}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = toggleSuspendSrsWord(vocabState, item.wordKey);
                                      onVocabStateChange(next);
                                    }}
                                    className={`p-1.5 rounded-lg border text-xs transition ${
                                      isSuspended
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                    title={
                                      isSuspended ? 'Tiếp tục theo dõi SRS' : 'Tạm dừng ôn từ này'
                                    }
                                  >
                                    {isSuspended ? (
                                      <PlayCircle className="w-4 h-4" />
                                    ) : (
                                      <PauseCircle className="w-4 h-4" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleReviewSingleNow(item)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
                                  >
                                    <Play className="w-3 h-3" />
                                    Ôn ngay
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Hiển thị {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, tableItems.length)} trong số {tableItems.length} từ
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold px-2">
                    Trang {safePage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Due count, batch size, and start button */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {dueQueue.length > 0 ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-100 text-rose-700 font-extrabold text-xs">
                  {dueQueue.length}
                </span>
                <div>
                  <span className="font-bold text-slate-900">
                    Có {dueQueue.length} từ đến hạn cần ôn tập
                  </span>
                  <p className="text-xs text-slate-500">
                    Ưu tiên các từ quá hạn lâu nhất và cấp độ thấp trước
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800">Chưa có từ đến hạn</span>
                  {earliestFutureDueAt ? (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Lượt đến hạn sớm nhất:{' '}
                      <span className="font-semibold text-slate-700">
                        {new Date(earliestFutureDueAt).toLocaleString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Hãy đánh dấu &ldquo;Đã thuộc&rdquo; hoặc nhấn &ldquo;+ Đưa vào SRS&rdquo; để
                      bắt đầu lịch ôn.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Số từ/lượt:</label>
              <select
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-xl bg-white text-slate-800"
              >
                <option value={10}>10 từ</option>
                <option value={20}>20 từ (Mặc định)</option>
                <option value={30}>30 từ</option>
                <option value={50}>50 từ</option>
                <option value={0}>Toàn bộ</option>
              </select>
            </div>

            {dueQueue.length > 0 ? (
              <button
                type="button"
                onClick={handleStartDueBatch}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Bắt đầu ôn tập (
                {batchSize === 0 ? dueQueue.length : Math.min(batchSize, dueQueue.length)} từ)
              </button>
            ) : (
              <button
                type="button"
                disabled={deckFilteredItems.length === 0}
                onClick={handleStartEarlyBatch}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs sm:text-sm disabled:opacity-40 transition"
              >
                <Sparkles className="w-4 h-4" />
                Luyện trước hạn (Không đổi lịch SRS)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-modal: Confirm Manual Level Adjustment */}
      {pendingLevelChange && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Xác nhận đổi cấp độ SRS thủ công?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Bạn đang chuyển từ{' '}
                  <span className="font-bold text-slate-900">
                    &ldquo;{pendingLevelChange.item.word}&rdquo;
                  </span>{' '}
                  sang <span className="font-bold text-indigo-600">Lv{pendingLevelChange.newLevel}</span>.
                  Lịch hẹn ôn tập tiếp theo của từ này sẽ được tính lại tương ứng với cấp độ mới.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingLevelChange(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmManualLevelChange}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                Xác nhận đổi sang Lv{pendingLevelChange.newLevel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Early Single Item Review Confirmation */}
      {earlyPracticeConfirmItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-6 h-6 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Luyện sớm từ &ldquo;{earlyPracticeConfirmItem.word}&rdquo;?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Từ này hiện chưa đến hạn ôn tập. Lượt luyện sớm này giúp bạn củng cố kiến thức và
                  nhận điểm thưởng nhưng <strong>không làm thay đổi cấp độ hay lịch hẹn SRS</strong>{' '}
                  hiện tại.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEarlyPracticeConfirmItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={confirmSingleEarlyReview}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                Bắt đầu luyện sớm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modal: Cài đặt SRS (Section 15) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Cài đặt chế độ Ôn tập Ngắt quãng (SRS)
                </h3>
                <p className="text-xs text-slate-500">
                  Tùy chỉnh hình thức kiểm tra cho từng bước chuyển cấp độ nhớ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* All-Flashcards Override Toggle */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900">
                  Ôn tập toàn bộ bằng thẻ từ (Flashcard)
                </div>
                <p className="text-xs text-slate-600">
                  Khi bật, tất cả các cấp độ sẽ dùng Thẻ từ (nhưng cấu hình từng cấp bên dưới vẫn
                  được lưu giữ).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draftSettings.reviewPresentation === 'all-flashcards'}
                onClick={() =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    reviewPresentation:
                      prev.reviewPresentation === 'all-flashcards' ? 'per-level' : 'all-flashcards',
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                  draftSettings.reviewPresentation === 'all-flashcards'
                    ? 'bg-indigo-600'
                    : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                    draftSettings.reviewPresentation === 'all-flashcards'
                      ? 'translate-x-5'
                      : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* 5 Transition Rows */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Hình thức kiểm tra theo bước chuyển cấp
                </span>
                {draftSettings.reviewPresentation === 'all-flashcards' && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Đang ghi đè bởi chế độ Ôn toàn bộ bằng Flashcard
                  </span>
                )}
              </div>

              <div
                className={`space-y-2 transition ${
                  draftSettings.reviewPresentation === 'all-flashcards' ? 'opacity-50' : ''
                }`}
              >
                {TRANSITION_ROWS.map((row) => {
                  const currentMode = draftSettings.transitions[row.key];
                  return (
                    <div
                      key={row.key}
                      className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-800">
                          {row.label}
                        </span>
                        {row.isHighLevel && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/80 text-slate-700"
                            title="Khóa gợi ý chữ cái, dịch nghĩa và âm thanh đáp án trước khi chấm"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            Không gợi ý
                          </span>
                        )}
                      </div>

                      <div className="inline-flex rounded-lg bg-white p-0.5 border border-slate-200">
                        {MODE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            disabled={draftSettings.reviewPresentation === 'all-flashcards'}
                            onClick={() =>
                              setDraftSettings((prev) => ({
                                ...prev,
                                transitions: {
                                  ...prev.transitions,
                                  [row.key]: opt.value,
                                },
                              }))
                            }
                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                              currentMode === opt.value
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-800 flex items-start gap-2">
                <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Ở các bước chuyển cấp cao (<strong>Lv2→Lv3, Lv3→Lv4, Lv4→Lv5</strong>), hệ thống
                  tự động khóa gợi ý chữ cái, dịch nghĩa câu ví dụ và âm thanh đáp án trước khi
                  chấm để đảm bảo trí nhớ chủ động.
                </span>
              </div>
            </div>

            {/* Chu kỳ Lv5 */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Chu kỳ ôn lại khi đạt Lv5 (Thành thạo)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {LV5_CYCLE_OPTIONS.map((opt) => {
                  const active = draftSettings.lv5CycleDays === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          lv5CycleDays: opt.value,
                        }))
                      }
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500">
                Khi đổi chu kỳ Lv5, hệ thống sẽ tính lại lịch hẹn của các từ đang ở Lv5 dựa trên mốc
                ôn gần nhất của từng từ.
              </p>
            </div>

            {/* Settings Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResetDefaultSettings}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Mặc định
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  Lưu cài đặt SRS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
