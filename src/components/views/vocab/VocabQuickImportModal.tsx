import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Plus,
  Trash2,
  Table,
  ClipboardPaste,
  Upload,
} from 'lucide-react';
import { ExtendedVocabItem, UserVocabDeck } from '../../../types/vocab';

interface VocabQuickImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: UserVocabDeck[];
  activeDeckId?: string;
  onAddWordsToDeck: (deckId: string, words: ExtendedVocabItem[]) => void;
  onRequestCreateDeck?: () => void;
  onOpenJsonModal?: () => void;
}

interface ManualRow {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  note: string;
}

export const VocabQuickImportModal: React.FC<VocabQuickImportModalProps> = ({
  isOpen,
  onClose,
  decks,
  activeDeckId,
  onAddWordsToDeck,
  onRequestCreateDeck,
  onOpenJsonModal,
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    activeDeckId || (decks.length > 0 ? decks[0].id : '')
  );
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'grid'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual grid rows
  const [manualRows, setManualRows] = useState<ManualRow[]>([
    {
      id: 'row_1',
      word: '',
      phonetic: '',
      partOfSpeech: 'n',
      meaningVi: '',
      exampleEn: '',
      exampleVi: '',
      note: '',
    },
    {
      id: 'row_2',
      word: '',
      phonetic: '',
      partOfSpeech: 'v',
      meaningVi: '',
      exampleEn: '',
      exampleVi: '',
      note: '',
    },
  ]);

  if (!isOpen) return null;

  const chatGptPrompt = `Bạn là chuyên gia từ vựng tiếng Anh LanguageCert B1.
Hãy tạo danh sách 20 từ vựng cốt lõi chuẩn B1 theo chủ đề [CHỦ ĐỀ CỦA BẠN].
Mỗi dòng là một từ, các trường cách nhau chính xác bằng dấu gạch đứng | theo quy cách sau (không đánh số thứ tự đầu dòng, không có tiêu đề cột):
từ vựng | /phiên âm/ | loại từ (n/v/adj/adv/phr) | nghĩa tiếng Việt | ví dụ tiếng Anh | bản dịch ví dụ tiếng Việt | ghi chú hoặc collocation

Ví dụ:
accommodate | /əˈkɒm.ə.deɪt/ | v | cung cấp chỗ ở | The hotel can accommodate 500 guests. | Khách sạn có thể chứa 500 khách. | Thường gặp trong Reading Part 1`;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(chatGptPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const parsePastedLines = (text: string): ExtendedVocabItem[] => {
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const results: ExtendedVocabItem[] = [];

    lines.forEach((line, idx) => {
      // Split by pipe | or tab \t
      const delimiter = line.includes('|') ? '|' : '\t';
      const parts = line.split(delimiter).map((p) => p.trim());
      if (parts.length >= 2 && parts[0]) {
        const word = parts[0];
        const phonetic = parts[1]?.startsWith('/') ? parts[1] : '';
        const partOfSpeechRaw = (parts[2] || 'n').toLowerCase();
        const pos = ['n', 'v', 'adj', 'adv', 'phr'].includes(partOfSpeechRaw)
          ? (partOfSpeechRaw as any)
          : 'n';
        const meaningVi = parts[3] || parts[1] || '';
        const exampleEn = parts[4] || '';
        const exampleVi = parts[5] || '';
        const note = parts[6] || '';

        results.push({
          id: `imp_${Date.now()}_${idx}`,
          word,
          phonetic: phonetic || `/.../`,
          partOfSpeech: pos,
          meaningVi: meaningVi || 'Đang cập nhật nghĩa',
          exampleEn: exampleEn || `Example for ${word}.`,
          exampleVi: exampleVi || `Ví dụ cho ${word}.`,
          topic: 'Nhập nhanh',
          cefr: 'B1',
          collocations: note,
          note,
          isMastered: false,
        });
      }
    });

    return results;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawContent = (event.target?.result as string) || '';
      if (!rawContent) return;

      const trimmed = rawContent.trim();
      // Auto-detect JSON file or JSON payload
      if (file.name.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          let parsed = JSON.parse(trimmed);
          if (!Array.isArray(parsed) && parsed.words && Array.isArray(parsed.words)) {
            parsed = parsed.words;
          }
          if (Array.isArray(parsed)) {
            const formatted = parsed
              .map((item: any) => {
                const word = item.word || item.term || '';
                const phonetic = item.phonetic || item.ipa || '';
                const pos = item.partOfSpeech || item.pos || 'n';
                const vi = item.meaningVi || item.meaning || item.definition || '';
                const exEn = item.exampleEn || item.example || '';
                const exVi = item.exampleVi || item.exampleMeaning || '';
                const note = item.collocations || item.note || item.topic || '';
                return `${word} | ${phonetic} | ${pos} | ${vi} | ${exEn} | ${exVi} | ${note}`;
              })
              .filter((l: string) => l.split('|')[0].trim().length > 0)
              .join('\n');

            setPasteText(formatted);
            setActiveTab('paste');
            setError(null);
            return;
          }
        } catch {
          // If JSON parse fails, treat as normal text
        }
      }

      setPasteText(rawContent);
      setActiveTab('paste');
      setError(null);
    };
    reader.readAsText(file);
  };

  const downloadSampleCsv = () => {
    const sampleData = `word,phonetic,partOfSpeech,meaningVi,exampleEn,exampleVi,note
accommodate,/əˈkɒm.ə.deɪt/,v,cung cấp chỗ ở,The hotel can accommodate 500 guests.,Khách sạn có thể chứa 500 khách.,Reading Part 1
destination,/ˌdes.tɪˈneɪ.ʃən/,n,điểm đến,Paris is a popular destination.,Paris là điểm đến nổi tiếng.,Travel & Transport
postpone,/pəʊstˈpəʊn/,v,hoãn lại,The match was postponed due to rain.,Trận đấu bị hoãn do mưa.,Listening Part 2`;

    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_vocab_b1_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddManualRow = () => {
    setManualRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}`,
        word: '',
        phonetic: '',
        partOfSpeech: 'n',
        meaningVi: '',
        exampleEn: '',
        exampleVi: '',
        note: '',
      },
    ]);
  };

  const handleRemoveManualRow = (id: string) => {
    setManualRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateManualRow = (id: string, field: keyof ManualRow, value: string) => {
    setManualRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = () => {
    if (!selectedDeckId) {
      setError('Vui lòng chọn bộ từ vựng đích');
      return;
    }

    let wordsToAdd: ExtendedVocabItem[] = [];

    if (activeTab === 'paste' || activeTab === 'file') {
      wordsToAdd = parsePastedLines(pasteText);
      if (wordsToAdd.length === 0) {
        setError('Không tìm thấy dòng từ vựng hợp lệ. Vui lòng kiểm tra lại định dạng dấu | hoặc tab');
        return;
      }
    } else {
      // Manual grid
      const validRows = manualRows.filter((r) => r.word.trim() && r.meaningVi.trim());
      if (validRows.length === 0) {
        setError('Vui lòng điền ít nhất 1 dòng có từ vựng và nghĩa tiếng Việt');
        return;
      }
      wordsToAdd = validRows.map((r, idx) => ({
        id: `manual_${Date.now()}_${idx}`,
        word: r.word.trim(),
        phonetic: r.phonetic.trim() || `/${r.word.trim()}/`,
        partOfSpeech: (['n', 'v', 'adj', 'adv', 'phr'].includes(r.partOfSpeech)
          ? r.partOfSpeech
          : 'n') as any,
        meaningVi: r.meaningVi.trim(),
        exampleEn: r.exampleEn.trim() || `Example with ${r.word.trim()}.`,
        exampleVi: r.exampleVi.trim() || `Ví dụ với ${r.word.trim()}.`,
        topic: 'Nhập thủ công',
        cefr: 'B1',
        note: r.note.trim(),
        collocations: r.note.trim(),
        isMastered: false,
      }));
    }

    onAddWordsToDeck(selectedDeckId, wordsToAdd);
    onClose();
  };

  const previewCount = parsePastedLines(pasteText).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                Thêm nhiều từ vựng vào bộ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập nhanh danh sách từ qua định dạng Paste (|), tệp CSV hoặc bảng điền trực tiếp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* JSON tool promo banner if available */}
          {onOpenJsonModal && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start sm:items-center gap-2.5 text-amber-950 dark:text-amber-200">
                <span className="text-xl">📁</span>
                <div>
                  <div className="font-extrabold text-amber-900 dark:text-amber-200">
                    Bạn có file dữ liệu .JSON hoặc muốn dùng Master Prompt AI?
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Hỗ trợ tải tệp JSON từ máy tính, dán trực tiếp và sao chép Prompt 15 chủ đề trích xuất từ vựng B1.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenJsonModal}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shrink-0 transition-colors shadow-sm cursor-pointer self-start sm:self-auto"
              >
                Mở công cụ JSON & AI Prompt &rarr;
              </button>
            </div>
          )}

          {/* Target Deck selector */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                Bộ từ nhận dữ liệu:
              </span>
              <select
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
                className="flex-1 sm:w-64 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.icon} {d.name} ({d.itemCount} từ)
                  </option>
                ))}
              </select>
            </div>

            {onRequestCreateDeck && (
              <button
                type="button"
                onClick={onRequestCreateDeck}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tạo bộ từ mới
              </button>
            )}
          </div>

          {/* Tab selector */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'paste'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ClipboardPaste className="w-4 h-4" />
              1. Thêm nhanh (Paste với |)
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'file'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Upload className="w-4 h-4" />
              2. Nhập file (CSV / Text)
            </button>
            <button
              onClick={() => setActiveTab('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'grid'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Table className="w-4 h-4" />
              3. Bảng thủ công
            </button>
          </div>

          {/* TAB 1: PASTE WITH PIPE */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-900/50">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
                    Quy cách dòng phân tách bằng dấu gạch đứng (|):
                  </span>
                  <p className="text-xs text-blue-700 dark:text-blue-400 font-mono">
                    từ vựng | /phiên âm/ | loại từ | nghĩa | ví dụ tiếng Anh | dịch ví dụ | ghi chú
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Đã sao chép prompt!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Sao chép Prompt ChatGPT
                    </>
                  )}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Dán văn bản vào đây:
                  </label>
                  {previewCount > 0 && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                      Nhận diện được {previewCount} từ hợp lệ
                    </span>
                  )}
                </div>
                <textarea
                  rows={8}
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    setError(null);
                  }}
                  placeholder={`accommodate | /əˈkɒm.ə.deɪt/ | v | cung cấp chỗ ở | The hotel can accommodate 500 guests. | Khách sạn có thể chứa 500 khách. | Reading Part 1\ndestination | /ˌdes.tɪˈneɪ.ʃən/ | n | điểm đến | Paris is a popular destination. | Paris là điểm đến nổi tiếng. | Travel`}
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center">
                <FileSpreadsheet className="w-12 h-12 text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Tải lên tệp CSV, Text (.txt) hoặc JSON (.json) chứa danh sách từ vựng
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Hệ thống tự động nhận diện cấu trúc JSON mảng từ vựng, hoặc các cột ngăn cách bởi dấu phẩy, tab, dấu gạch đứng (|).
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer hover:bg-blue-700 shadow-sm transition-colors">
                    <Upload className="w-4 h-4" /> Chọn tệp CSV / TXT / JSON
                    <input
                      type="file"
                      accept=".csv,.txt,.json"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={downloadSampleCsv}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                  >
                    <Download className="w-4 h-4" /> Tải tệp CSV mẫu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL GRID */}
          {activeTab === 'grid' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Nhập trực tiếp danh sách từ vào bảng bên dưới:
                </span>
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm dòng
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2 w-32">Từ vựng *</th>
                      <th className="p-2 w-24">Phiên âm</th>
                      <th className="p-2 w-20">Loại từ</th>
                      <th className="p-2 w-44">Nghĩa tiếng Việt *</th>
                      <th className="p-2">Ví dụ câu & Dịch</th>
                      <th className="p-2 w-28">Ghi chú</th>
                      <th className="p-2 w-10 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {manualRows.map((row) => (
                      <tr key={row.id}>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.word}
                            onChange={(e) => updateManualRow(row.id, 'word', e.target.value)}
                            placeholder="convenient"
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.phonetic}
                            onChange={(e) => updateManualRow(row.id, 'phonetic', e.target.value)}
                            placeholder="/.../"
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                        <td className="p-1.5">
                          <select
                            value={row.partOfSpeech}
                            onChange={(e) => updateManualRow(row.id, 'partOfSpeech', e.target.value)}
                            className="w-full px-1.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          >
                            <option value="n">n</option>
                            <option value="v">v</option>
                            <option value="adj">adj</option>
                            <option value="adv">adv</option>
                            <option value="phr">phr</option>
                          </select>
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.meaningVi}
                            onChange={(e) => updateManualRow(row.id, 'meaningVi', e.target.value)}
                            placeholder="tiện lợi"
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.exampleEn}
                            onChange={(e) => updateManualRow(row.id, 'exampleEn', e.target.value)}
                            placeholder="Public transport is convenient."
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.note}
                            onChange={(e) => updateManualRow(row.id, 'note', e.target.value)}
                            placeholder="Reading P1"
                            className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveManualRow(row.id)}
                            className="p-1 text-slate-400 hover:text-red-500 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-colors"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Lưu từ vựng vào bộ
          </button>
        </div>
      </div>
    </div>
  );
};
