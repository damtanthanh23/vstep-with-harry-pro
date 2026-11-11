import React, { useState, useEffect } from 'react';
import {
  StickyNote,
  Highlighter,
  X,
  Trash2,
  Copy,
  Check,
  Plus,
  Keyboard,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ExamSection, ExamUserHighlight, ExamScratchpadNotesMap } from '../types/exam';

interface ExamScratchpadDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: ExamSection;
  testTitle: string;
  notesMap: ExamScratchpadNotesMap;
  onChangeNotesMap: React.Dispatch<React.SetStateAction<ExamScratchpadNotesMap>>;
  userHighlights: ExamUserHighlight[];
  onRemoveHighlight: (id: string) => void;
  onClearAllHighlights: () => void;
}

const SKILL_TABS: Array<{
  key: ExamSection | 'GENERAL';
  label: string;
  shortLabel: string;
  placeholder: string;
  quickTemplates: string[];
}> = [
  {
    key: 'LISTENING',
    label: 'Nghe (Listening)',
    shortLabel: 'Nghe (L)',
    placeholder:
      'Tốc ký từ khóa, tên riêng, con số, thời gian hoặc ý chính khi nghe Audio Part 1, 2, 3...',
    quickTemplates: [
      '• Từ khóa câu hỏi: ',
      '• Thời gian / Địa điểm / Số liệu: ',
      '• Quan điểm người nói (Nam / Nữ): ',
      '• Đáp án nghi ngờ cần loại trừ: ',
    ],
  },
  {
    key: 'READING',
    label: 'Đọc (Reading)',
    shortLabel: 'Đọc (R)',
    placeholder:
      'Ghi chú ý chính từng đoạn [Đoạn 1..4], từ đồng nghĩa hoặc câu dẫn chứng quan trọng...',
    quickTemplates: [
      '• Ý chính (Main Idea) của bài: ',
      '• Đoạn 1: \n• Đoạn 2: \n• Đoạn 3: ',
      '• Từ vựng / Đại từ quy chiếu: ',
      '• Phương án bẫy đã loại trừ: ',
    ],
  },
  {
    key: 'WRITING',
    label: 'Viết (Writing)',
    shortLabel: 'Viết (W)',
    placeholder:
      'Lập dàn ý nhanh cho bức thư (Task 1) và bài luận Essay (Task 2), liệt kê từ vựng B2–C1...',
    quickTemplates: [
      '📋 DÀN Ý TASK 1 (Thư/Email):\n- Mục đích thư:\n- Ý 1:\n- Ý 2:\n- Kết thư:\n',
      '📋 DÀN Ý TASK 2 (Essay):\n- Mở bài (Paraphrase + Thesis):\n- Thân bài 1 (Luận điểm + Ví dụ):\n- Thân bài 2 (Luận điểm + Ví dụ):\n- Kết bài:\n',
      '• Cụm từ học thuật B2–C1 cần dùng: ',
    ],
  },
  {
    key: 'SPEAKING',
    label: 'Nói (Speaking)',
    shortLabel: 'Nói (S)',
    placeholder:
      'Chuẩn bị ý tưởng nhanh cho Part 1 (Social), Part 2 (Solution Discussion) & Part 3 (Mind-map)...',
    quickTemplates: [
      '🎙️ PART 2 (Solution Discussion):\n- Phương án chọn: \n- 2 Lý do chính: \n- Phản biện 2 phương án còn lại: \n',
      '🎙️ PART 3 (Topic Development):\n- Câu chủ đề: \n- Nhánh 1: \n- Nhánh 2: \n- Nhánh 3: \n',
      '• Từ nối & Idiom ghi điểm: ',
    ],
  },
  {
    key: 'GENERAL',
    label: 'Ghi chú chung',
    shortLabel: 'Chung',
    placeholder: 'Ghi chú chiến thuật phân bổ thời gian, các câu đang phân vân cần kiểm tra lại...',
    quickTemplates: [
      '⏰ Các câu cần kiểm tra lại trước khi nộp: ',
      '📌 Lưu ý quan trọng: ',
    ],
  },
];

export const ExamScratchpadDrawer: React.FC<ExamScratchpadDrawerProps> = ({
  isOpen,
  onClose,
  activeSection,
  testTitle,
  notesMap,
  onChangeNotesMap,
  userHighlights,
  onRemoveHighlight,
  onClearAllHighlights,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'highlights'>('notes');
  const [selectedSkillKey, setSelectedSkillKey] = useState<ExamSection | 'GENERAL'>(activeSection);
  const [colorFilter, setColorFilter] = useState<'all' | 'yellow' | 'green' | 'pink'>('all');
  const [copied, setCopied] = useState(false);

  // Sync active skill tab when user switches exam section
  useEffect(() => {
    if (activeSection) {
      setSelectedSkillKey(activeSection);
    }
  }, [activeSection]);

  if (!isOpen) return null;

  const currentTabConfig =
    SKILL_TABS.find((t) => t.key === selectedSkillKey) || SKILL_TABS[0];
  const currentNoteText = notesMap[selectedSkillKey] || '';

  const wordCount = currentNoteText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const handleUpdateCurrentNote = (val: string) => {
    onChangeNotesMap((prev) => ({
      ...prev,
      [selectedSkillKey]: val,
    }));
  };

  const handleInsertTemplate = (tpl: string) => {
    onChangeNotesMap((prev) => {
      const existing = prev[selectedSkillKey] || '';
      const prefix = existing.trim().length > 0 ? `${existing.trimEnd()}\n` : '';
      return {
        ...prev,
        [selectedSkillKey]: `${prefix}${tpl}`,
      };
    });
  };

  const handleCopyNote = () => {
    if (!currentNoteText.trim()) return;
    navigator.clipboard?.writeText(currentNoteText).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const filteredHighlights = userHighlights.filter((h) =>
    colorFilter === 'all' ? true : h.color === colorFilter
  );

  const formatPartLabel = (partKey: string) => {
    if (partKey.startsWith('LISTENING_')) {
      return `Listening Part ${partKey.replace('LISTENING_', '')}`;
    }
    if (partKey.startsWith('READING_')) {
      return `Reading Passage ${partKey.replace('READING_', '')}`;
    }
    return partKey;
  };

  return (
    <aside
      className="fixed right-3 sm:right-5 bottom-16 z-40 w-[360px] sm:w-[415px] max-w-[94vw] rounded-3xl border-2 border-slate-300 dark:border-slate-700 border-b-6 border-b-slate-400 dark:border-b-slate-950 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden select-none animate-in fade-in slide-in-from-bottom-3 duration-150"
      style={{ maxHeight: 'calc(100vh - 148px)' }}
    >
      {/* Top Header */}
      <div className="bg-[#FFC800] dark:bg-amber-500 px-4 py-3 border-b-2 border-[#E5B400] flex items-center justify-between gap-2 text-amber-950">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/90 text-[#D97706] shadow-2xs border border-amber-300">
            <StickyNote className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-black tracking-tight truncate">
                Sổ Ghi Chú Nháp Phòng Thi
              </h4>
              <kbd className="rounded bg-amber-950/15 px-1.5 py-0.5 font-mono text-[10px] font-black">
                Phím N
              </kbd>
            </div>
            <p className="text-[10px] font-bold text-amber-900/80 truncate">
              {testTitle} · Tự động lưu vào bài làm dở
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-amber-950/10 hover:bg-amber-950/20 p-1.5 text-amber-950 transition-colors cursor-pointer shrink-0"
          title="Đóng sổ nháp (Phím tắt: N)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Mode Switcher: Notes vs Highlights */}
      <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-black transition-all cursor-pointer ${
            activeTab === 'notes'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <StickyNote className="h-3.5 w-3.5 text-[#D97706]" />
          <span>Tốc ký 4 Kỹ năng</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('highlights')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-black transition-all cursor-pointer ${
            activeTab === 'highlights'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Highlighter className="h-3.5 w-3.5 text-[#58CC02]" />
          <span>Vết tô sáng</span>
          <span className="rounded-md bg-lime-100 dark:bg-lime-950 px-1.5 py-0.2 text-[10px] font-mono font-black text-[#2B6600] dark:text-lime-300 tabular-nums">
            {userHighlights.length}
          </span>
        </button>
      </div>

      {/* TAB 1: SCRATCHPAD NOTES */}
      {activeTab === 'notes' ? (
        <div className="flex-1 flex flex-col min-h-0 p-3.5 space-y-3 overflow-y-auto">
          {/* Skill Sub-Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {SKILL_TABS.map((tab) => {
              const isSelected = selectedSkillKey === tab.key;
              const hasContent = Boolean((notesMap[tab.key] || '').trim().length > 0);
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setSelectedSkillKey(tab.key)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-black border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-amber-50 dark:bg-amber-950/70 border-[#FFC800] text-amber-900 dark:text-amber-200 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {tab.key === 'LISTENING' && <Headphones className="h-3 w-3 text-[#1CB0F6]" />}
                  {tab.key === 'READING' && <BookOpen className="h-3 w-3 text-[#58CC02]" />}
                  {tab.key === 'WRITING' && <PenTool className="h-3 w-3 text-[#A560E8]" />}
                  {tab.key === 'SPEAKING' && <Mic className="h-3 w-3 text-[#FF4B4B]" />}
                  {tab.key === 'GENERAL' && <FileText className="h-3 w-3 text-amber-500" />}
                  <span>{tab.shortLabel}</span>
                  {hasContent && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#58CC02]" title="Đã có ghi chú" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Insert Structure Chips */}
          <div className="space-y-1">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Chèn nhanh khung dàn ý ({currentTabConfig.label}):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {currentTabConfig.quickTemplates.map((tpl, idx) => {
                const chipLabel = tpl.split(':')[0].replace(/^[•📋🎙️⏰📌]\s*/, '').trim();
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleInsertTemplate(tpl)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 border border-slate-200 dark:border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                  >
                    <Plus className="h-2.5 w-2.5 text-[#D97706]" />
                    <span className="truncate max-w-[165px]">{chipLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Textarea */}
          <div className="flex-1 flex flex-col">
            <textarea
              value={currentNoteText}
              onChange={(e) => handleUpdateCurrentNote(e.target.value)}
              placeholder={currentTabConfig.placeholder}
              rows={8}
              className="w-full flex-1 min-h-[180px] rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-amber-50/35 dark:bg-slate-950/70 p-3.5 text-xs sm:text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#FFC800] focus:outline-none resize-y select-text"
            />
          </div>

          {/* Footer Bar: Word count + Copy + Clear */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <span className="font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              {wordCount} từ · {currentNoteText.length} ký tự
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyNote}
                disabled={!currentNoteText.trim()}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 px-2.5 py-1.5 font-black text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#58CC02]" />
                    <span className="text-[#58CC02]">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>

              {currentNoteText.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => handleUpdateCurrentNote('')}
                  className="inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 px-2.5 py-1.5 font-black text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                  title="Xóa nội dung trang nháp hiện tại"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Xóa</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: HIGHLIGHTED PASSAGES & QUESTION STEMS */
        <div className="flex-1 flex flex-col min-h-0 p-3.5 space-y-3 overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'yellow', label: 'Vàng', dot: 'bg-yellow-300 border-yellow-500' },
                  { id: 'green', label: 'Xanh', dot: 'bg-lime-400 border-lime-600' },
                  { id: 'pink', label: 'Hồng', dot: 'bg-pink-300 border-pink-500' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setColorFilter(f.id)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black border transition-all cursor-pointer ${
                    colorFilter === f.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {'dot' in f && <span className={`h-2 w-2 rounded-full border ${f.dot}`} />}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            {userHighlights.length > 0 && (
              <button
                type="button"
                onClick={onClearAllHighlights}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>Xóa hết</span>
              </button>
            )}
          </div>

          {filteredHighlights.length === 0 ? (
            <div className="py-10 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-2">
              <Highlighter className="h-7 w-7 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                Chưa có đoạn tô sáng nào
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Hãy bôi đen bất kỳ từ khóa nào trong bài đọc hoặc câu hỏi rồi nhấn phím{' '}
                <kbd className="rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 font-mono font-black text-slate-700 dark:text-slate-200">
                  H
                </kbd>{' '}
                hoặc chọn màu bút tô sáng.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {filteredHighlights.map((hl) => {
                const badgeStyle =
                  hl.color === 'green'
                    ? 'bg-lime-100 dark:bg-lime-950/70 border-lime-300 dark:border-lime-800 text-lime-950 dark:text-lime-200'
                    : hl.color === 'pink'
                    ? 'bg-pink-100 dark:bg-pink-950/70 border-pink-300 dark:border-pink-800 text-pink-950 dark:text-pink-200'
                    : 'bg-yellow-100/90 dark:bg-yellow-950/70 border-yellow-300 dark:border-yellow-800 text-amber-950 dark:text-yellow-100';

                return (
                  <div
                    key={hl.id}
                    className={`rounded-2xl border p-3 text-xs space-y-2 ${badgeStyle}`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-bold opacity-80">
                      <span>
                        {formatPartLabel(hl.partKey)}
                        {hl.targetType === 'question' ? ' · Câu hỏi' : ' · Bài đọc'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const targetKey: ExamSection | 'GENERAL' = hl.partKey.startsWith(
                              'LISTENING'
                            )
                              ? 'LISTENING'
                              : hl.partKey.startsWith('READING')
                              ? 'READING'
                              : selectedSkillKey;
                            onChangeNotesMap((prev) => {
                              const cur = prev[targetKey] || '';
                              const prefix = cur.trim().length > 0 ? `${cur.trimEnd()}\n` : '';
                              return {
                                ...prev,
                                [targetKey]: `${prefix}• "${hl.text}"`,
                              };
                            });
                            setSelectedSkillKey(targetKey);
                            setActiveTab('notes');
                          }}
                          className="rounded-md bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 font-black text-slate-800 dark:text-slate-200 hover:bg-white cursor-pointer"
                          title="Chuyển đoạn trích này sang Sổ ghi chú nháp"
                        >
                          + Sang sổ nháp
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveHighlight(hl.id)}
                          className="rounded-md bg-white/80 dark:bg-slate-900/80 p-1 text-rose-600 hover:bg-rose-100 cursor-pointer"
                          title="Xóa vết tô sáng này"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <p className="font-bold leading-snug select-text">“{hl.text}”</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

interface ExamShortcutsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExamShortcutsGuideModal: React.FC<ExamShortcutsGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutItems = [
    {
      keys: ['A', 'B', 'C', 'D'],
      altKeys: ['1', '2', '3', '4'],
      title: 'Chọn nhanh đáp án trắc nghiệm',
      desc: 'Áp dụng cho câu hỏi đang được chọn trong phần Listening & Reading.',
    },
    {
      keys: ['←', '→'],
      title: 'Chuyển sang câu hỏi Trước / Tiếp theo',
      desc: 'Tự động cuộn mượt mà đến thẻ câu hỏi tương ứng.',
    },
    {
      keys: ['F'],
      title: 'Gắn cờ / Bỏ cờ câu hỏi đang phân vân',
      desc: 'Đánh dấu màu vàng trên thanh câu hỏi bên dưới để dễ dàng kiểm tra lại trước khi nộp.',
    },
    {
      keys: ['H'],
      title: 'Tô sáng (Highlight) từ khóa nhanh',
      desc: 'Bôi đen từ khóa trong bài đọc hoặc câu hỏi rồi nhấn H để tô sáng tức thì (hoặc bật/tắt bút dạ quang).',
    },
    {
      keys: ['N'],
      title: 'Bật / Tắt Sổ Ghi Chú Nháp Phòng Thi',
      desc: 'Mở khung tốc ký 4 kỹ năng Listening, Reading, Writing, Speaking và danh sách các câu đã tô sáng.',
    },
    {
      keys: ['Space'],
      title: 'Phát / Tạm dừng Audio Listening',
      desc: 'Điều khiển nhanh thanh phát âm thanh khi đang ở phần thi Nghe.',
    },
    {
      keys: ['Chuột phải'],
      title: 'Gạch loại trừ phương án nhiễu (Strikethrough)',
      desc: 'Nhấn chuột phải (hoặc bấm nút Loại trừ) vào phương án A, B, C, D sai để thu hẹp lựa chọn.',
    },
    {
      keys: ['Bôi đen từ'],
      title: 'Tra từ điển AI theo ngữ cảnh & Lưu SRS / Sổ nháp',
      desc: 'Bôi đen bất kỳ từ hoặc cụm từ nào để nghe phát âm, xem nghĩa tiếng Việt, lưu Flashcard SRS hoặc chèn vào Sổ nháp.',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 text-slate-800 dark:text-slate-100 shadow-2xl border-2 border-slate-200 dark:border-slate-700 border-b-8 border-b-slate-300 dark:border-b-slate-950 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#D7FFB8] dark:bg-emerald-950 text-[#46A302] dark:text-lime-300 border-2 border-[#58CC02]">
              <Keyboard className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-[#46A302] dark:text-lime-400">
                <Sparkles className="h-3 w-3" />
                Công cụ làm bài thông minh VSTEP CBT
              </span>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                Bảng Tra Cứu Phím Tắt &amp; Thao Tác Nhanh
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
          {shortcutItems.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-3.5 space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {item.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded-lg bg-white dark:bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 border-b-2 shadow-2xs"
                  >
                    {k}
                  </kbd>
                ))}
                {item.altKeys && (
                  <>
                    <span className="text-[11px] font-bold text-slate-400">hoặc</span>
                    {item.altKeys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded-lg bg-white dark:bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 border-b-2 shadow-2xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </>
                )}
              </div>
              <div className="text-xs font-black text-slate-900 dark:text-white">
                {item.title}
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Mẹo: Mọi vết tô sáng, phương án gạch loại trừ và ghi chú nháp đều được tự động lưu theo đề thi.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-[#58CC02] hover:bg-[#46a302] px-5 py-2.5 text-xs font-black text-white shadow-md border-b-3 border-[#3c8c02] cursor-pointer shrink-0"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
