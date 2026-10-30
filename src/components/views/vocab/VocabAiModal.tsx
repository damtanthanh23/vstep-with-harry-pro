import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  Volume2,
  Check,
  Loader2,
  AlertCircle,
  Plus,
  Upload,
} from 'lucide-react';
import { ExtendedVocabItem, UserVocabDeck } from '../../../types/vocab';
import { B1_OFFICIAL_15_TOPICS } from '../VocabAiPromptModal';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';

interface VocabAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: UserVocabDeck[];
  activeDeckId?: string;
  onAddWordsToDeck: (deckId: string, words: ExtendedVocabItem[]) => void;
  onRequestCreateDeck?: () => void;
}

export const VocabAiModal: React.FC<VocabAiModalProps> = ({
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
  const [activeTab, setActiveTab] = useState<'theme' | 'reading' | 'image'>('theme');
  const [topic, setTopic] = useState('05 Travel And Transport');
  const [customTopic, setCustomTopic] = useState('');
  const [passage, setPassage] = useState('');
  const [wordCount, setWordCount] = useState(10);

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMime, setImageMime] = useState<string>('image/jpeg');

  // AI Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedWords, setGeneratedWords] = useState<ExtendedVocabItem[]>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());

  // Quota tracking
  const [remainingQuota, setRemainingQuota] = useState(98);

  useEffect(() => {
    if (activeDeckId) setSelectedDeckId(activeDeckId);
  }, [activeDeckId]);

  if (!isOpen) return null;

  // Handle image upload / paste
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file hình ảnh (PNG, JPG, WEBP)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
      setImageBase64(result);
      setImageMime(file.type);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (activeTab !== 'image') return;
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setLoading(true);
    setGeneratedWords([]);

    try {
      const payload: any = {
        mode: activeTab,
        count: wordCount,
      };

      if (activeTab === 'theme') {
        payload.topic = customTopic.trim() ? customTopic.trim() : topic;
      } else if (activeTab === 'reading') {
        if (!passage.trim()) {
          throw new Error('Vui lòng dán đoạn văn bản cần trích xuất từ vựng');
        }
        payload.passage = passage.trim();
        payload.topic = 'Reading Passage Vocab';
      } else if (activeTab === 'image') {
        if (!imageBase64) {
          throw new Error('Vui lòng tải lên hoặc dán (Ctrl+V) ảnh chụp tài liệu');
        }
        payload.imageBase64 = imageBase64;
        payload.mimeType = imageMime;
        payload.topic = 'Document OCR Vocab';
      }

      const res = await fetch('/api/ai/generate-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Lỗi máy chủ (${res.status}): Không thể tạo từ vựng.`);
      }

      const data = await res.json();
      const items: ExtendedVocabItem[] = (data.items || []).map((it: any) => ({
        ...it,
        isMastered: false,
      }));

      if (items.length === 0) {
        throw new Error('Không trích xuất được từ vựng nào. Vui lòng thử lại với nội dung rõ hơn.');
      }

      setGeneratedWords(items);
      setSelectedWordIds(new Set(items.map((w) => w.id)));
      setRemainingQuota((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      setError(err.message || 'Đã có lỗi xảy ra khi tạo từ vựng bằng AI.');
    } finally {
      setLoading(false);
    }
  };

  const toggleWordSelection = (id: string) => {
    const next = new Set(selectedWordIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedWordIds(next);
  };

  const selectAll = () => {
    if (selectedWordIds.size === generatedWords.length) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(generatedWords.map((w) => w.id)));
    }
  };

  const handleSaveToDeck = () => {
    if (!selectedDeckId) {
      setError('Vui lòng chọn bộ từ vựng cần lưu');
      return;
    }
    const wordsToAdd = generatedWords.filter((w) => selectedWordIds.has(w.id));
    if (wordsToAdd.length === 0) {
      setError('Vui lòng chọn ít nhất một từ vựng để thêm');
      return;
    }

    onAddWordsToDeck(selectedDeckId, wordsToAdd);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onPaste={handlePaste}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                  Tạo từ vựng với AI
                </h3>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  THƯỜNG | CÒN {remainingQuota}/100 LƯỢT HÔM NAY
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bóc tách và chuẩn hóa từ vựng LanguageCert B1 tự động từ chủ đề, bài đọc hoặc ảnh chụp sách
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Deck selector bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                Lưu vào bộ:
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

          {/* 3 AI Subtabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'theme'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              1. Nhập chủ đề
            </button>
            <button
              onClick={() => setActiveTab('reading')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'reading'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              2. Đọc hiểu (Passage)
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'image'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              3. Ảnh tài liệu (OCR)
            </button>
          </div>

          {/* Tab 1: Theme */}
          {activeTab === 'theme' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Chọn 1 trong 15 chủ đề cốt lõi LanguageCert B1:
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {B1_OFFICIAL_15_TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Hoặc nhập chủ đề / tình huống thi mong muốn (tùy chỉnh):
                </label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="VD: Cụm từ hay gặp trong email phàn nàn dịch vụ (Writing Part 1)"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Số lượng từ cần tạo:
                </span>
                {[5, 10, 15, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setWordCount(num)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      wordCount === num
                        ? 'bg-primary-50 dark:bg-primary-950/50 border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {num} từ
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Reading */}
          {activeTab === 'reading' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Dán bài đọc / đoạn văn bản tiếng Anh:
                </label>
                <textarea
                  rows={6}
                  value={passage}
                  onChange={(e) => setPassage(e.target.value)}
                  placeholder="Dán đoạn văn bản Reading hoặc transcript Listening vào đây để AI tự động lọc ra các từ vựng B1 then chốt..."
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono leading-relaxed"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Số lượng từ cần trích xuất:
                </span>
                {[5, 10, 15].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setWordCount(num)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      wordCount === num
                        ? 'bg-primary-50 dark:bg-primary-950/50 border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    {num} từ
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Image OCR */}
          {activeTab === 'image' && (
            <div className="space-y-4">
              <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center hover:border-primary-500 transition-colors bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center">
                {imagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={imagePreview}
                      alt="Uploaded study sheet"
                      className="max-h-48 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 mx-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setImageBase64('');
                      }}
                      className="text-xs text-red-500 hover:underline font-semibold"
                    >
                      Xóa ảnh & chọn ảnh khác
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-slate-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Kéo thả ảnh tài liệu vào đây hoặc nhấn để tải lên
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Mẹo: Bạn có thể nhấn <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[11px]">Ctrl+V</kbd> để dán ảnh chụp màn hình trực tiếp
                    </p>
                    <label className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white text-xs font-semibold cursor-pointer hover:bg-primary-700 shadow-sm transition-colors">
                      <Upload className="w-3.5 h-3.5" /> Chọn tệp hình ảnh
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
                        }}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Trigger Generate Button */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI đang bóc tách và chuẩn hóa từ vựng...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Bắt đầu tạo từ vựng với AI
                </>
              )}
            </button>
          </div>

          {/* Preview Results Table */}
          {generatedWords.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    Kết quả từ vựng bóc tách ({generatedWords.length} từ)
                  </h4>
                  <span className="text-xs text-slate-500">
                    (Đã chọn {selectedWordIds.size}/{generatedWords.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {selectedWordIds.size === generatedWords.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-inner max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-8 text-center">#</th>
                      <th className="p-2.5">Từ vựng & Phiên âm</th>
                      <th className="p-2.5">Nghĩa tiếng Việt</th>
                      <th className="p-2.5">Ví dụ song ngữ</th>
                      <th className="p-2.5">Ghi chú / Cụm từ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {generatedWords.map((word) => {
                      const isChecked = selectedWordIds.has(word.id);
                      return (
                        <tr
                          key={word.id}
                          onClick={() => toggleWordSelection(word.id)}
                          className={`cursor-pointer transition-colors ${
                            isChecked
                              ? 'bg-primary-50/40 dark:bg-primary-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleWordSelection(word.id)}
                              className="rounded text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-slate-100">
                                {word.word}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                                {word.partOfSpeech}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playDictionaryAudio(word.word, 'uk');
                                }}
                                className="p-1 hover:text-primary-600 rounded text-slate-400"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {word.phonetic}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300 font-medium">
                            {word.meaningVi}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">
                            <p className="line-clamp-1 italic">{word.exampleEn}</p>
                            <p className="line-clamp-1 text-slate-500">{word.exampleVi}</p>
                          </td>
                          <td className="p-2.5 text-slate-500 text-[11px]">
                            {word.collocations || word.note || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
            onClick={handleSaveToDeck}
            disabled={generatedWords.length === 0 || selectedWordIds.size === 0}
            className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Lưu {selectedWordIds.size} từ vào bộ
          </button>
        </div>
      </div>
    </div>
  );
};
