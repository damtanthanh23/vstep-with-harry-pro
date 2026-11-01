import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Check,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Plus,
  Trash2,
  Table,
  ClipboardPaste,
  Upload,
  FileJson,
  Columns,
} from 'lucide-react';
import { ExtendedVocabItem, UserVocabDeck } from '../../../types/vocab';
import { adaptVocabItem, normalizeEnglishText } from '../../../utils/vocabEngine';

export type DuplicateResolutionStrategy = 'skip' | 'keep_both' | 'overwrite';

interface VocabQuickImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: UserVocabDeck[];
  activeDeckId?: string;
  onAddWordsToDeck: (
    deckId: string,
    words: ExtendedVocabItem[],
    duplicateStrategy?: DuplicateResolutionStrategy
  ) => void;
  onRequestCreateDeck?: () => void;
  onOpenJsonModal?: () => void;
}

interface ParsedRowDraft {
  id: string;
  word: string;
  meaningVi: string;
  phonetic: string;
  partOfSpeech: 'n' | 'v' | 'adj' | 'adv' | 'phr';
  exampleEn: string;
  exampleVi: string;
}

/**
 * RFC-4180 compliant CSV / TSV parser supporting quoted fields with commas and newlines
 */
export function parseRfc4180Delimited(text: string, delimiter: ',' | '\t' | ';'): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const len = text.length;
  for (let i = 0; i < len; i++) {
    const ch = text[i];
    const nextCh = i + 1 < len ? text[i + 1] : '';

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"' && currentField.length === 0) {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (ch === '\r' && nextCh === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        if (currentRow.some((cell) => cell.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += ch;
      }
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }
  return rows;
}

type ColumnRole = 'word' | 'meaningVi' | 'phonetic' | 'partOfSpeech' | 'exampleEn' | 'exampleVi' | 'ignore';

export const VocabQuickImportModal: React.FC<VocabQuickImportModalProps> = ({
  isOpen,
  onClose,
  decks,
  activeDeckId,
  onAddWordsToDeck,
  onRequestCreateDeck,
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    activeDeckId || (decks.length > 0 ? decks[0].id : '')
  );
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'grid'>('paste');

  // Paste / CSV state
  const [rawInputText, setRawInputText] = useState<string>('');
  const [delimiter, setDelimiter] = useState<',' | '\t' | ';'>('\t');
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(false);
  const [columnMapping, setColumnMapping] = useState<ColumnRole[]>([
    'word',
    'meaningVi',
    'phonetic',
    'partOfSpeech',
    'exampleEn',
    'exampleVi',
  ]);

  // Parsed & editable preview rows
  const [previewRows, setPreviewRows] = useState<ParsedRowDraft[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateResolutionStrategy>('skip');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeDeckId) {
      setSelectedDeckId(activeDeckId);
    } else if (decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id);
    }
  }, [activeDeckId, decks, selectedDeckId]);

  const currentDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId),
    [decks, selectedDeckId]
  );

  const existingWordSet = useMemo(() => {
    const set = new Set<string>();
    (currentDeck?.items || []).forEach((it) => {
      const norm = normalizeEnglishText(it.word);
      if (norm) set.add(norm);
    });
    return set;
  }, [currentDeck]);

  const duplicateCountInPreview = useMemo(() => {
    let count = 0;
    previewRows.forEach((r) => {
      if (r.word.trim() && existingWordSet.has(normalizeEnglishText(r.word))) {
        count++;
      }
    });
    return count;
  }, [previewRows, existingWordSet]);

  if (!isOpen) return null;

  const buildPreviewFromDelimited = (
    text: string,
    delim: ',' | '\t' | ';',
    skipHeader: boolean,
    mapping: ColumnRole[]
  ) => {
    setError(null);
    const matrix = parseRfc4180Delimited(text, delim);
    const dataMatrix = skipHeader ? matrix.slice(1) : matrix;

    const drafts: ParsedRowDraft[] = dataMatrix.map((cells, idx) => {
      const draft: ParsedRowDraft = {
        id: `row_${Date.now()}_${idx}`,
        word: '',
        meaningVi: '',
        phonetic: '',
        partOfSpeech: 'n',
        exampleEn: '',
        exampleVi: '',
      };

      cells.forEach((val, colIdx) => {
        const role = mapping[colIdx] || 'ignore';
        if (role === 'word') draft.word = val;
        else if (role === 'meaningVi') draft.meaningVi = val;
        else if (role === 'phonetic') draft.phonetic = val;
        else if (role === 'partOfSpeech') {
          const cleanPos = val.trim().toLowerCase();
          if (['n', 'v', 'adj', 'adv', 'phr'].includes(cleanPos)) {
            draft.partOfSpeech = cleanPos as any;
          }
        } else if (role === 'exampleEn') draft.exampleEn = val;
        else if (role === 'exampleVi') draft.exampleVi = val;
      });

      return draft;
    });

    setPreviewRows(drafts);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          const arr = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.items)
            ? parsed.items
            : Array.isArray(parsed.words)
            ? parsed.words
            : [];
          if (arr.length === 0) {
            setError('Tệp JSON không chứa mảng từ vựng hợp lệ.');
            return;
          }
          const drafts: ParsedRowDraft[] = arr.map((item: any, idx: number) => ({
            id: `json_${Date.now()}_${idx}`,
            word: String(item.word || item.headword || '').trim(),
            meaningVi: String(item.meaningVi || item.meaning || '').trim(),
            phonetic: String(item.phonetic || item.ipa || '').trim(),
            partOfSpeech: ['n', 'v', 'adj', 'adv', 'phr'].includes(
              String(item.partOfSpeech || '').toLowerCase()
            )
              ? (String(item.partOfSpeech).toLowerCase() as any)
              : 'n',
            exampleEn: String(item.exampleEn || item.example || '').trim(),
            exampleVi: String(item.exampleVi || '').trim(),
          }));
          setPreviewRows(drafts);
        } catch {
          setError('Không thể đọc tệp JSON. Vui lòng kiểm tra cú pháp JSON.');
        }
      } else {
        const autoDelim: ',' | '\t' = file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',';
        setDelimiter(autoDelim);
        setRawInputText(content);
        buildPreviewFromDelimited(content, autoDelim, hasHeaderRow, columnMapping);
      }
    };
    reader.readAsText(file);
  };

  const handleExportCurrentDeckJson = () => {
    if (!currentDeck) return;
    const blob = new Blob([JSON.stringify(currentDeck, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const rawName = currentDeck.title || currentDeck.name || 'vocab_deck';
    a.download = `${rawName.replace(/[^a-zA-Z0-9_-]/g, '_')}_vocab.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddBlankRow = () => {
    setPreviewRows((prev) => [
      ...prev,
      {
        id: `manual_${Date.now()}_${prev.length}`,
        word: '',
        meaningVi: '',
        phonetic: '',
        partOfSpeech: 'n',
        exampleEn: '',
        exampleVi: '',
      },
    ]);
  };

  const handleImportConfirm = () => {
    if (!selectedDeckId) {
      setError('Vui lòng chọn hoặc tạo một bộ từ trước khi nhập.');
      return;
    }

    const validRows = previewRows.filter(
      (r) => r.word.trim().length > 0 && r.meaningVi.trim().length > 0
    );
    if (validRows.length === 0) {
      setError('Không có dòng từ vựng hợp lệ nào (cần tối thiểu Từ tiếng Anh và Nghĩa tiếng Việt).');
      return;
    }

    const normalizedItems: ExtendedVocabItem[] = validRows.map((r, idx) =>
      adaptVocabItem(
        {
          word: r.word.trim(),
          meaningVi: r.meaningVi.trim(),
          phonetic: r.phonetic.trim(),
          partOfSpeech: r.partOfSpeech,
          exampleEn: r.exampleEn.trim(),
          exampleVi: r.exampleVi.trim(),
          sourceType: 'manual',
        },
        selectedDeckId,
        idx
      )
    );

    onAddWordsToDeck(selectedDeckId, normalizedItems, duplicateStrategy);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Nhập / Xuất Từ Vựng (CSV, TSV, JSON & Bảng thủ công)
              </h2>
              <p className="text-xs text-slate-500">
                Hỗ trợ chuẩn CSV RFC-4180, ánh xạ cột linh hoạt và kiểm soát từ trùng lặp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentDeck && (
              <button
                type="button"
                onClick={handleExportCurrentDeckJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                Xuất JSON bộ từ
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Deck selector & Duplicate Resolution Strategy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bộ từ cá nhân đích:
              </label>
              <div className="flex gap-2">
                {decks.length > 0 ? (
                  <select
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
                  >
                    {decks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.itemCount} từ)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-amber-700 font-medium py-2">
                    Chưa có bộ từ cá nhân.
                  </span>
                )}
                {onRequestCreateDeck && (
                  <button
                    type="button"
                    onClick={onRequestCreateDeck}
                    className="px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold shrink-0"
                  >
                    + Tạo bộ mới
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Khi gặp từ tiếng Anh đã tồn tại trong bộ từ ({duplicateCountInPreview} từ trùng):
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'skip', label: 'Bỏ qua từ trùng' },
                    { id: 'keep_both', label: 'Giữ riêng' },
                    { id: 'overwrite', label: 'Cập nhật từ cũ' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDuplicateStrategy(opt.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition ${
                      duplicateStrategy === opt.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3 Input Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'paste'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Dán CSV / Excel (TSV)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'file'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Tải tệp CSV / TSV / JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('grid');
                if (previewRows.length === 0) handleAddBlankRow();
              }}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'grid'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Nhập bảng trực tiếp</span>
            </button>
          </div>

          {/* Tab 1: Paste CSV/TSV & Column Mapping */}
          {activeTab === 'paste' && (
            <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Ký tự phân cách:</span>
                  {(
                    [
                      { val: '\t', label: 'Tab (Excel/Google Sheets)' },
                      { val: ',', label: 'Dấu phẩy (,)' },
                      { val: ';', label: 'Chấm phẩy (;)' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => {
                        setDelimiter(d.val);
                        if (rawInputText.trim()) {
                          buildPreviewFromDelimited(
                            rawInputText,
                            d.val,
                            hasHeaderRow,
                            columnMapping
                          );
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        delimiter === d.val
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasHeaderRow}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setHasHeaderRow(next);
                      if (rawInputText.trim()) {
                        buildPreviewFromDelimited(rawInputText, delimiter, next, columnMapping);
                      }
                    }}
                    className="rounded-sm text-emerald-600"
                  />
                  Bỏ qua dòng tiêu đề đầu tiên
                </label>
              </div>

              {/* Column Mapping Controls */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Columns className="w-3.5 h-3.5 text-indigo-600" />
                  Thứ tự ánh xạ các cột (Cột 1 → Cột 6):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {columnMapping.map((role, idx) => (
                    <div key={idx}>
                      <span className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        Cột {idx + 1}
                      </span>
                      <select
                        value={role}
                        onChange={(e) => {
                          const nextMap = [...columnMapping];
                          nextMap[idx] = e.target.value as ColumnRole;
                          setColumnMapping(nextMap);
                          if (rawInputText.trim()) {
                            buildPreviewFromDelimited(
                              rawInputText,
                              delimiter,
                              hasHeaderRow,
                              nextMap
                            );
                          }
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                      >
                        <option value="word">Từ tiếng Anh</option>
                        <option value="meaningVi">Nghĩa tiếng Việt</option>
                        <option value="phonetic">Phiên âm IPA</option>
                        <option value="partOfSpeech">Từ loại (n/v/adj...)</option>
                        <option value="exampleEn">Ví dụ tiếng Anh</option>
                        <option value="exampleVi">Dịch ví dụ</option>
                        <option value="ignore">Bỏ qua cột này</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  rows={5}
                  value={rawInputText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRawInputText(val);
                    buildPreviewFromDelimited(val, delimiter, hasHeaderRow, columnMapping);
                  }}
                  placeholder={`Dán danh sách từ vựng từ Excel hoặc CSV vào đây...\nVí dụ:\ndeparture\tkhởi hành\t/dɪˈpɑːtʃə/\tn\tOur departure was delayed.\tChuyến khởi hành của chúng tôi bị hoãn.`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Tab 2: File Upload */}
          {activeTab === 'file' && (
            <div className="p-6 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center space-y-3">
              <FileJson className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  Chọn tệp .CSV, .TSV hoặc .JSON từ máy tính
                </h4>
                <p className="text-xs text-slate-500">
                  Hỗ trợ đầy đủ dấu ngoặc kép chứa dấu phẩy hoặc xuống dòng theo chuẩn RFC-4180.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold cursor-pointer shadow-xs transition">
                <Upload className="w-4 h-4" />
                <span>Chọn tệp để tải lên</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Editable Preview Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                Bảng kiểm tra & Chỉnh sửa trước khi lưu ({previewRows.length} dòng)
              </h3>
              <button
                type="button"
                onClick={handleAddBlankRow}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm dòng trống
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-72 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <th className="py-2.5 px-2.5">Từ tiếng Anh *</th>
                    <th className="py-2.5 px-2.5">Nghĩa tiếng Việt *</th>
                    <th className="py-2.5 px-2.5 w-28">IPA</th>
                    <th className="py-2.5 px-2.5 w-20">Loại từ</th>
                    <th className="py-2.5 px-2.5">Câu ví dụ tiếng Anh</th>
                    <th className="py-2.5 px-2.5 w-10 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Chưa có dữ liệu xem trước. Hãy dán văn bản, tải tệp hoặc nhấn &ldquo;Thêm
                        dòng trống&rdquo;.
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, idx) => {
                      const isDup =
                        row.word.trim().length > 0 &&
                        existingWordSet.has(normalizeEnglishText(row.word));

                      return (
                        <tr key={row.id} className={isDup ? 'bg-amber-50/50' : ''}>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.word}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPreviewRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, word: val } : r))
                                );
                              }}
                              placeholder="Từ vựng..."
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-900"
                            />
                            {isDup && (
                              <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                                Đã có trong bộ từ
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.meaningVi}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPreviewRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, meaningVi: val } : r))
                                );
                              }}
                              placeholder="Nghĩa tiếng Việt..."
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-medium text-slate-800"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.phonetic}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPreviewRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, phonetic: val } : r))
                                );
                              }}
                              placeholder="/.../"
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={row.partOfSpeech}
                              onChange={(e) => {
                                const val = e.target.value as any;
                                setPreviewRows((prev) =>
                                  prev.map((r, i) =>
                                    i === idx ? { ...r, partOfSpeech: val } : r
                                  )
                                );
                              }}
                              className="w-full px-1.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
                            >
                              <option value="n">n</option>
                              <option value="v">v</option>
                              <option value="adj">adj</option>
                              <option value="adv">adv</option>
                              <option value="phr">phr</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={row.exampleEn}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPreviewRows((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, exampleEn: val } : r))
                                );
                              }}
                              placeholder="Ví dụ tiếng Anh..."
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-200"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewRows((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold"
          >
            Hủy
          </button>

          <button
            type="button"
            disabled={previewRows.length === 0 || !selectedDeckId}
            onClick={handleImportConfirm}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs sm:text-sm shadow-sm transition"
          >
            <Check className="w-4 h-4" />
            Xác nhận nhập vào bộ từ
          </button>
        </div>
      </div>
    </div>
  );
};
