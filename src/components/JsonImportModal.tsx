import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Upload,
  FileCode2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import {
  getSampleTestJsonTemplate,
  getAiExtractionMasterPromptText,
  normalizeImportedExamData,
} from '../services/examService';
import { Question, PartAudioMap, VocabItem } from '../types/exam';
import { WritingTask } from '../types/writing';

interface JsonImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: {
    title: string;
    subtitle: string;
    durationMinutes: number;
    audioUrl?: string;
    audioFileName?: string;
    audioMode?: 'single' | 'per_part';
    partAudioUrls?: PartAudioMap;
    questions: Question[];
    writingTasks?: WritingTask[];
    vocabulary?: VocabItem[];
  }) => void;
}

export const JsonImportModal: React.FC<JsonImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const templateStr = getSampleTestJsonTemplate();
    const blob = new Blob([templateStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'VSTEP_B1_B2_C1_AI_Master_Guide_And_Template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyAiPrompt = async () => {
    try {
      const promptText = getAiExtractionMasterPromptText();
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setJsonText(content);
        validateAndImport(content, false);
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const cleanJsonInput = (raw: string): string => {
    let cleaned = raw.trim();
    // Strip markdown code fences if user copied directly from ChatGPT / Claude / Gemini
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    return cleaned;
  };

  const validateAndImport = (text: string, execute: boolean = true) => {
    setError(null);
    setPreviewSummary(null);
    try {
      const cleaned = cleanJsonInput(text);
      if (!cleaned) {
        setError('Vui lòng dán nội dung JSON hoặc chọn file .json từ máy.');
        return;
      }

      const parsed = JSON.parse(cleaned);
      const normalized = normalizeImportedExamData(parsed);

      const validQuestions = normalized.questions.filter(
        (q) =>
          (q.prompt && q.prompt.trim().length > 0) ||
          q.type === 'gapped_text' ||
          (q.notesData?.label && q.notesData.label.trim().length > 0)
      ).length;

      const validTrans = normalized.questions.filter(
        (q) =>
          (q.vietnameseTranslation && q.vietnameseTranslation.trim().length > 0) ||
          (q.audioScriptTranslation && q.audioScriptTranslation.trim().length > 0)
      ).length;

      const vocabCount = Array.isArray(normalized.vocabulary) ? normalized.vocabulary.length : 0;
      setPreviewSummary(
        `Đã nhận diện đề "${normalized.title}": ${validQuestions}/75 câu hỏi có nội dung · ${validTrans}/75 câu có bản dịch song ngữ · ${normalized.writingTasks.length} bài Writing · ${vocabCount} từ vựng kèm theo.`
      );

      if (execute) {
        onImport({
          title: normalized.title,
          subtitle: normalized.subtitle,
          durationMinutes: normalized.durationMinutes,
          audioUrl: normalized.audioUrl,
          audioFileName: normalized.audioFileName,
          audioMode: normalized.audioMode,
          partAudioUrls: normalized.partAudioUrls,
          questions: normalized.questions,
          writingTasks: normalized.writingTasks,
          vocabulary: normalized.vocabulary || [],
        });
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Cú pháp JSON không hợp lệ';
      setError(
        `Lỗi định dạng JSON: ${msg}. Hãy đảm bảo copy trọn vẹn dấu ngoặc nhọn { ... } từ AI.`
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-2xs">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Nhập Đề Thi Từ JSON & Quy Tắc Chuẩn Cho AI (ChatGPT / Claude / Gemini)
              </h3>
              <p className="text-xs text-slate-500">
                Tải file JSON chứa bộ quy tắc Master để đính kèm cùng PDF sách lên bất kỳ AI nào
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* AI Workflow Guide Box */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-lime-50/70 to-white p-4 border-2 border-emerald-200/90 space-y-3">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-5 w-5 text-[#16A34A] shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700 leading-relaxed">
                <p className="font-black text-slate-900 text-sm mb-1">
                  Cách dùng với ChatGPT, Claude hoặc Gemini để bóc tách 100% sách PDF:
                </p>
                <ol className="list-decimal list-inside space-y-1 font-medium">
                  <li>
                    Bấm nút{' '}
                    <span className="font-black text-emerald-800">
                      "Tải File Quy Tắc & Mẫu JSON Cho AI (.json)"
                    </span>{' '}
                    bên dưới.
                  </li>
                  <li>
                    Đính kèm file <code className="font-mono font-bold">.json</code> đó cùng{' '}
                    <span className="font-bold">
                      file PDF đề thi + Đáp án (Answer Key) + Lời thoại (Audio Script)
                    </span>{' '}
                    lên AI.
                  </li>
                  <li>
                    Bấm <span className="font-black text-indigo-700">"Copy Lệnh Prompt Mẫu"</span>{' '}
                    và gửi cho AI — AI sẽ tự động hiểu toàn bộ quy tắc đánh số 75 câu VSTEP (35 câu Nghe + 40 câu Đọc với 4 lựa chọn A/B/C/D), giữ nguyên chữ gạch chân/in đậm{' '}
                    <code className="font-mono font-bold">&lt;u&gt;&lt;b&gt;word&lt;/b&gt;&lt;/u&gt;</code> và các ô chèn câu{' '}
                    <code className="font-mono font-bold">[A] [B] [C] [D]</code> trong bài đọc, gom lời thoại theo từng người nói{' '}
                    <code className="font-mono font-bold">Man:, Woman:, Narrator:</code>, trích dẫn{' '}
                    <code className="font-mono font-bold">evidenceQuote</code> nguyên văn + giải thích chi tiết <code className="font-mono font-bold">explanation</code> và trả về JSON chuẩn!
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 py-2 text-xs font-black text-white hover:bg-[#15803D] active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Tải File Quy Tắc & Mẫu JSON Cho AI (.json)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyAiPrompt}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-black text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                {copiedPrompt ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-lime-300" />
                    <span>Đã Copy Lệnh Prompt!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy Lệnh Prompt Gửi Kèm Cho AI</span>
                  </>
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-2xs cursor-pointer"
              >
                <Upload className="h-4 w-4 text-sky-600" />
                <span>Tải Lên File .json Đã Có</span>
              </button>
            </div>
          </div>

          {/* Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-black text-slate-700">
                Dán nội dung JSON do AI tạo (hoặc từ file .json) vào đây:
              </label>
              <button
                type="button"
                onClick={() => validateAndImport(jsonText, false)}
                className="text-[11px] font-bold text-[#16A34A] hover:underline cursor-pointer flex items-center gap-1"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Kiểm tra cấu trúc JSON</span>
              </button>
            </div>
            <textarea
              rows={11}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setError(null);
              }}
              placeholder='{\n  "title": "VSTEP B1-B2-C1 Practice Test 2",\n  "durationMinutes": 100,\n  "questions": [ ... 75 câu hỏi VSTEP (ID 1..35 Listening, ID 36..75 Reading) kèm readingPassage có <u><b>từ gạch chân</b></u>, vietnameseTranslation, explanation & evidenceQuote ... ],\n  "writingTasks": [ ... 2 bài Writing (Task 1 Thư/Email ≥120 từ, Task 2 Essay ≥250 từ) ... ]\n}'
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-3.5 font-mono text-xs text-slate-800 outline-hidden focus:border-[#16A34A] focus:bg-white transition-all resize-none"
            />
          </div>

          {previewSummary && !error && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{previewSummary}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Đóng lại
          </button>
          <button
            type="button"
            onClick={() => validateAndImport(jsonText, true)}
            className="rounded-xl bg-[#16A34A] px-6 py-2.5 text-xs font-black text-white shadow-sm hover:bg-[#15803D] active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Xác Nhận & Nạp Toàn Bộ Đề Vào Trình Soạn Thảo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
