import React, { useState, useEffect, useRef } from 'react';
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
  Trash2,
  Edit3,
  FileText,
  Highlighter,
} from 'lucide-react';
import { ExtendedVocabItem, UserVocabDeck } from '../../../types/vocab';
import { B1_OFFICIAL_15_TOPICS } from '../VocabAiPromptModal';
import { playDictionaryAudio } from '../../../utils/dictionaryAudio';
import { adaptVocabItem } from '../../../utils/vocabEngine';

interface VocabAiModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks: UserVocabDeck[];
  activeDeckId?: string;
  userId?: string | null;
  onAddWordsToDeck: (deckId: string, words: ExtendedVocabItem[]) => void;
  onRequestCreateDeck?: () => void;
}

export const VocabAiModal: React.FC<VocabAiModalProps> = ({
  isOpen,
  onClose,
  decks,
  activeDeckId,
  userId = 'guest',
  onAddWordsToDeck,
  onRequestCreateDeck,
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(
    activeDeckId || (decks.length > 0 ? decks[0].id : '')
  );
  const [activeTab, setActiveTab] = useState<'theme' | 'reading' | 'image'>('theme');

  // Tab 1: Theme / Passage
  const [topic, setTopic] = useState('05 Travel And Transport');
  const [customTopic, setCustomTopic] = useState('');
  const [cefrLevel, setCefrLevel] = useState<'A2' | 'B1' | 'B2' | 'C1'>('B1');
  const [wordCount, setWordCount] = useState(10);

  // Tab 2: Reading Passage & Interactive Phrase Selection
  const [passage, setPassage] = useState('');
  const [selectedPhrases, setSelectedPhrases] = useState<string[]>([]);
  const [manualPhraseInput, setManualPhraseInput] = useState('');

  // Tab 3: Image OCR
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string>('');
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [ocrText, setOcrText] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);
  const [ocrCompleted, setOcrCompleted] = useState<boolean>(false);

  // AI Generation & Draft Preview state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generatedWords, setGeneratedWords] = useState<ExtendedVocabItem[]>([]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [editingWordId, setEditingWordId] = useState<string | null>(null);

  // Quota tracking (100/day in Asia/Ho_Chi_Minh)
  const [quotaRemaining, setQuotaRemaining] = useState<number>(100);
  const [quotaLimit, setQuotaLimit] = useState<number>(100);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (activeDeckId) {
      setSelectedDeckId(activeDeckId);
    } else if (decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(decks[0].id);
    }
  }, [activeDeckId, decks, selectedDeckId]);

  // Fetch real quota on open
  useEffect(() => {
    if (!isOpen) return;
    const safeUser = userId || 'guest';
    fetch(`/api/ai/vocab-quota?userId=${encodeURIComponent(safeUser)}`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.remaining === 'number') setQuotaRemaining(data.remaining);
        if (typeof data.limit === 'number') setQuotaLimit(data.limit);
      })
      .catch(() => {
        // Keep current quota display if offline
      });
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(file.type)) {
      setError('Chỉ hỗ trợ định dạng ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Dung lượng ảnh vượt quá giới hạn 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    setError(null);
    setImageMime(file.type);
    setOcrCompleted(false);
    setOcrText('');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      const base64Part = dataUrl.split(',')[1] || '';
      setImageBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleRunOcrPreview = async () => {
    if (!imageBase64) {
      setError('Vui lòng tải ảnh lên trước khi quét văn bản OCR.');
      return;
    }
    setOcrLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/ocr-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageMime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể trích xuất văn bản từ ảnh.');
      }
      setOcrText(data.ocrText || '');
      setOcrCompleted(true);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi quét OCR.');
    } finally {
      setOcrLoading(false);
    }
  };

  // Handle text selection in Reading tab (Desktop mouseup / Mobile selection)
  const handlePassageMouseUp = () => {
    const selection = window.getSelection()?.toString().trim() || '';
    if (selection.length >= 2 && selection.length <= 60) {
      const cleaned = selection.replace(/^[.,;!?()"']+|[.,;!?()"']+$/g, '').trim();
      if (cleaned && !selectedPhrases.includes(cleaned)) {
        setSelectedPhrases((prev) => [...prev, cleaned]);
      }
    }
  };

  const handleAddManualPhrase = () => {
    const cleaned = manualPhraseInput.trim();
    if (!cleaned) return;
    if (!selectedPhrases.includes(cleaned)) {
      setSelectedPhrases((prev) => [...prev, cleaned]);
    }
    setManualPhraseInput('');
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const handleGenerate = async () => {
    setError(null);
    setWarnings([]);

    if (activeTab === 'theme') {
      const targetText = customTopic.trim() || topic;
      if (!targetText) {
        setError('Vui lòng chọn hoặc nhập chủ đề / đoạn văn.');
        return;
      }
      if (targetText.length > 2000) {
        setError('Nội dung đầu vào vượt quá giới hạn 2.000 ký tự.');
        return;
      }
    } else if (activeTab === 'reading') {
      if (!passage.trim() && selectedPhrases.length === 0) {
        setError('Vui lòng nhập đoạn văn tiếng Anh hoặc chọn ít nhất 1 từ/cụm từ.');
        return;
      }
      if (passage.length > 2000) {
        setError('Đoạn văn vượt quá giới hạn 2.000 ký tự.');
        return;
      }
    } else if (activeTab === 'image') {
      if (!imageBase64 && !ocrText.trim()) {
        setError('Vui lòng tải ảnh lên hoặc nhập văn bản OCR.');
        return;
      }
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);

    try {
      const response = await fetch('/api/ai/generate-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          userId: userId || 'guest',
          requestId,
          mode: activeTab,
          topic: customTopic.trim() || topic,
          passage: passage.trim(),
          selectedPhrases,
          imageBase64: activeTab === 'image' ? imageBase64 : undefined,
          mimeType: activeTab === 'image' ? imageMime : undefined,
          ocrText: activeTab === 'image' ? ocrText.trim() : undefined,
          count: Math.min(50, Math.max(1, wordCount)),
          cefr: cefrLevel,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.quota) {
          setQuotaRemaining(data.quota.remaining);
          setQuotaLimit(data.quota.limit);
        }
        throw new Error(data.error || 'Không thể tạo từ vựng lúc này.');
      }

      if (data.quota) {
        setQuotaRemaining(data.quota.remaining);
        setQuotaLimit(data.quota.limit);
      }
      if (Array.isArray(data.warnings)) {
        setWarnings(data.warnings);
      }

      const rawWords: any[] = Array.isArray(data.words) ? data.words : [];
      const targetDeckId = selectedDeckId || 'temp_ai_deck';
      const normalized = rawWords.map((w, idx) =>
        adaptVocabItem(
          {
            ...w,
            cefr: w.cefr || cefrLevel,
            sourceType:
              activeTab === 'reading'
                ? 'ai_passage'
                : activeTab === 'image'
                ? 'ai_ocr'
                : 'ai_generated',
          },
          targetDeckId,
          idx
        )
      );

      setGeneratedWords(normalized);
      setSelectedWordIds(new Set(normalized.map((w) => w.id)));
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Đã hủy yêu cầu tạo từ vựng.');
      } else {
        setError(err.message || 'Lỗi kết nối máy chủ khi tạo từ vựng.');
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSaveSelectedToDeck = () => {
    if (!selectedDeckId) {
      setError('Vui lòng chọn hoặc tạo một bộ từ cá nhân để lưu.');
      return;
    }
    const chosen = generatedWords.filter((w) => selectedWordIds.has(w.id));
    if (chosen.length === 0) {
      setError('Vui lòng tích chọn ít nhất 1 từ vựng để lưu vào bộ từ.');
      return;
    }
    onAddWordsToDeck(selectedDeckId, chosen);
    onClose();
  };

  const updateDraftField = (
    wordId: string,
    field: keyof ExtendedVocabItem,
    value: string
  ) => {
    setGeneratedWords((prev) =>
      prev.map((w) => (w.id === wordId ? { ...w, [field]: value } : w))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Tạo Từ Vựng Thông Minh (3 Chế độ)
              </h2>
              <p className="text-xs text-slate-600">
                Hạn mức hôm nay (Asia/Ho_Chi_Minh):{' '}
                <strong className="text-indigo-700">
                  {quotaRemaining}/{quotaLimit} lượt
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Destination Deck Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Lưu từ vựng vào bộ từ cá nhân:
              </label>
              {decks.length > 0 ? (
                <select
                  value={selectedDeckId}
                  onChange={(e) => setSelectedDeckId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-800"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.itemCount} từ)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-amber-700 font-medium">
                  Bạn chưa có bộ từ cá nhân nào. Hãy tạo bộ từ trước khi lưu.
                </div>
              )}
            </div>
            {onRequestCreateDeck && (
              <button
                type="button"
                onClick={onRequestCreateDeck}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold self-start sm:self-end transition"
              >
                <Plus className="w-4 h-4" />
                Tạo bộ từ mới
              </button>
            )}
          </div>

          {/* 3 Mode Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('theme')}
              className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'theme'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>1. Chủ đề / Đoạn văn</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reading')}
              className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'reading'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>2. Đọc hiểu (Chọn cụm từ)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('image')}
              className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition ${
                activeTab === 'image'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>3. Hình ảnh (OCR)</span>
            </button>
          </div>

          {/* Tab 1: Theme / Passage */}
          {activeTab === 'theme' && (
            <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chủ đề gợi ý chuẩn VSTEP / LanguageCert:
                  </label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    {B1_OFFICIAL_15_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Trình độ CEFR & Số từ:
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={cefrLevel}
                      onChange={(e) => setCefrLevel(e.target.value as any)}
                      className="px-2.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-bold text-indigo-700"
                    >
                      <option value="A2">A2</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                    </select>
                    <select
                      value={wordCount}
                      onChange={(e) => setWordCount(Number(e.target.value))}
                      className="flex-1 px-2.5 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                    >
                      <option value={5}>5 từ</option>
                      <option value={10}>10 từ</option>
                      <option value={15}>15 từ</option>
                      <option value={20}>20 từ</option>
                      <option value={30}>30 từ</option>
                      <option value={50}>50 từ (Tối đa)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Hoặc nhập chủ đề riêng / đoạn văn cần rút từ (Tối đa 2.000 ký tự):
                  </label>
                  <span
                    className={`text-[11px] font-semibold ${
                      customTopic.length > 2000 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {customTopic.length}/2000
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Ví dụ: Environmental pollution and renewable energy solutions..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Reading Passage & Interactive Word/Phrase Selection */}
          {activeTab === 'reading' && (
            <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Highlighter className="w-3.5 h-3.5 text-indigo-600" />
                    Dán đoạn văn tiếng Anh (Bôi đen từ/cụm từ trong bài đọc để chọn ngay):
                  </label>
                  <span
                    className={`text-[11px] font-semibold ${
                      passage.length > 2000 ? 'text-rose-600' : 'text-slate-400'
                    }`}
                  >
                    {passage.length}/2000
                  </span>
                </div>
                <textarea
                  rows={5}
                  value={passage}
                  onChange={(e) => setPassage(e.target.value)}
                  onMouseUp={handlePassageMouseUp}
                  onKeyUp={handlePassageMouseUp}
                  placeholder="Paste your English reading passage here. Select/highlight any word or collocation to add it to your extraction list..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {/* Interactive token tap helper for mobile + manual phrase input */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualPhraseInput}
                    onChange={(e) => setManualPhraseInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddManualPhrase();
                      }
                    }}
                    placeholder="Hoặc gõ thêm từ/cụm từ cần giải nghĩa trong ngữ cảnh bài đọc..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualPhrase}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900"
                  >
                    + Thêm cụm từ
                  </button>
                </div>

                {selectedPhrases.length > 0 && (
                  <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900">
                        Cụm từ đã chọn ({selectedPhrases.length}):
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedPhrases([])}
                        className="text-[11px] text-rose-600 font-semibold hover:underline"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPhrases.map((phr) => (
                        <span
                          key={phr}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-xs font-bold text-indigo-800"
                        >
                          {phr}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPhrases((prev) => prev.filter((p) => p !== phr))
                            }
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Image Upload & OCR Review Step */}
          {activeTab === 'image' && (
            <div className="space-y-4 bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                    Tải lên ảnh trang sách, đề thi hoặc bảng từ vựng (JPG, PNG, WEBP &le; 5MB)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Hệ thống hỗ trợ quét OCR để bạn kiểm tra và sửa văn bản trước khi trích xuất từ
                    vựng.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer transition shrink-0">
                  <Upload className="w-4 h-4" />
                  <span>Chọn ảnh (&le; 5MB)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {imagePreview && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-600">Ảnh đã tải lên:</div>
                    <img
                      src={imagePreview}
                      alt="OCR Preview"
                      className="max-h-52 w-full object-contain rounded-xl border border-slate-200 bg-slate-50"
                    />
                    <button
                      type="button"
                      disabled={ocrLoading}
                      onClick={handleRunOcrPreview}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold disabled:opacity-50 transition"
                    >
                      {ocrLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Đang nhận diện chữ trên ảnh (OCR)...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          {ocrCompleted ? 'Quét lại OCR từ ảnh' : 'Bước 1: Quét văn bản OCR để duyệt'}
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-600">
                      Văn bản OCR (Có thể chỉnh sửa trước khi tạo từ):
                    </div>
                    <textarea
                      rows={7}
                      value={ocrText}
                      onChange={(e) => setOcrText(e.target.value)}
                      placeholder="Nhấn 'Quét văn bản OCR' bên trái hoặc gõ/dán nội dung từ ảnh vào đây..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generate Button / Cancel */}
          <div className="flex items-center justify-end gap-3">
            {loading ? (
              <button
                type="button"
                onClick={handleCancelGeneration}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 font-bold text-xs sm:text-sm"
              >
                <X className="w-4 h-4" />
                Hủy yêu cầu đang chạy
              </button>
            ) : null}

            <button
              type="button"
              disabled={loading || quotaRemaining <= 0}
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-sm transition"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang phân tích & tạo từ vựng...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Phân tích & Tạo bảng từ nháp
                </>
              )}
            </button>
          </div>

          {/* Error & Warnings */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
              <div className="font-bold">Lưu ý kiểm duyệt dữ liệu tự động:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {warnings.slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Editable Draft Preview List */}
          {generatedWords.length > 0 && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">
                  Bảng xem trước & Chỉnh sửa ({selectedWordIds.size}/{generatedWords.length} từ được
                  chọn)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedWordIds.size === generatedWords.length) {
                      setSelectedWordIds(new Set());
                    } else {
                      setSelectedWordIds(new Set(generatedWords.map((w) => w.id)));
                    }
                  }}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  {selectedWordIds.size === generatedWords.length
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả'}
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {generatedWords.map((item) => {
                  const isChecked = selectedWordIds.has(item.id);
                  const isEditing = editingWordId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition ${
                        isChecked
                          ? 'bg-indigo-50/40 border-indigo-200'
                          : 'bg-slate-50 border-slate-200 opacity-65'
                      }`}
                    >
                      {!isEditing ? (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedWordIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              className="mt-1 rounded-sm text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-extrabold text-sm text-slate-900">
                                  {item.word}
                                </span>
                                {item.phonetic && (
                                  <span className="text-xs font-mono text-slate-500">
                                    {item.phonetic}
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold uppercase text-slate-600">
                                  {item.partOfSpeech}
                                </span>
                                <span className="text-xs font-bold text-indigo-700">
                                  — {item.meaningVi}
                                </span>
                              </div>
                              {item.exampleEn && (
                                <p className="text-xs text-slate-600 italic mt-0.5">
                                  &ldquo;{item.exampleEn}&rdquo;
                                  {item.exampleVi ? ` (${item.exampleVi})` : ''}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => playDictionaryAudio(item.word)}
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-100"
                              title="Nghe phát âm"
                            >
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingWordId(item.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
                              title="Chỉnh sửa từ này"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGeneratedWords((prev) => prev.filter((w) => w.id !== item.id));
                                setSelectedWordIds((prev) => {
                                  const next = new Set(prev);
                                  next.delete(item.id);
                                  return next;
                                });
                              }}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <input
                              type="text"
                              value={item.word}
                              onChange={(e) => updateDraftField(item.id, 'word', e.target.value)}
                              placeholder="Từ tiếng Anh"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                            />
                            <input
                              type="text"
                              value={item.phonetic}
                              onChange={(e) =>
                                updateDraftField(item.id, 'phonetic', e.target.value)
                              }
                              placeholder="Phiên âm IPA"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                            />
                            <select
                              value={item.partOfSpeech}
                              onChange={(e) =>
                                updateDraftField(item.id, 'partOfSpeech', e.target.value)
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white"
                            >
                              <option value="n">n (Danh từ)</option>
                              <option value="v">v (Động từ)</option>
                              <option value="adj">adj (Tính từ)</option>
                              <option value="adv">adv (Trạng từ)</option>
                              <option value="phr">phr (Cụm từ)</option>
                            </select>
                            <input
                              type="text"
                              value={item.meaningVi}
                              onChange={(e) =>
                                updateDraftField(item.id, 'meaningVi', e.target.value)
                              }
                              placeholder="Nghĩa tiếng Việt"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={item.exampleEn}
                              onChange={(e) =>
                                updateDraftField(item.id, 'exampleEn', e.target.value)
                              }
                              placeholder="Câu ví dụ tiếng Anh"
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={item.exampleVi}
                                onChange={(e) =>
                                  updateDraftField(item.id, 'exampleVi', e.target.value)
                                }
                                placeholder="Dịch nghĩa ví dụ"
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setEditingWordId(null)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                              >
                                Xong
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold"
          >
            Đóng
          </button>

          {generatedWords.length > 0 && (
            <button
              type="button"
              disabled={selectedWordIds.size === 0 || !selectedDeckId}
              onClick={handleSaveSelectedToDeck}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold text-xs sm:text-sm shadow-sm transition"
            >
              <Check className="w-4 h-4" />
              Lưu {selectedWordIds.size} từ vào bộ từ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
