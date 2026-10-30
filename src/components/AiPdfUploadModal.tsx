import React, { useState, useRef } from 'react';
import {
  X,
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCheck,
  Headphones,
  KeyRound,
  Loader2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Question, TestMetadata } from '../types/exam';
import { normalizeImportedExamData } from '../services/examService';

interface AiPdfUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamExtracted: (test: TestMetadata, questions: Question[]) => void;
}

export const AiPdfUploadModal: React.FC<AiPdfUploadModalProps> = ({
  isOpen,
  onClose,
  onExamExtracted,
}) => {
  const [examTitle, setExamTitle] = useState('Đề thi VSTEP B1-B2-C1 mới (AI Extracted)');
  const [examFile, setExamFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [transcriptText, setTranscriptText] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const examFileInputRef = useRef<HTMLInputElement>(null);
  const answerFileInputRef = useRef<HTMLInputElement>(null);
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:application/pdf;base64, prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleProcessPdf = async () => {
    if (!examFile && !answerKeyText.trim() && !transcriptText.trim()) {
      setErrorMessage('Vui lòng chọn ít nhất 1 file PDF đề thi.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setLoadingStep('Đang chuẩn bị và nạp file tài liệu...');

      let pdfBase64 = '';
      if (examFile) {
        pdfBase64 = await fileToBase64(examFile);
      }

      let answerKeyPdfBase64 = '';
      if (answerKeyFile) {
        answerKeyPdfBase64 = await fileToBase64(answerKeyFile);
      }

      let transcriptPdfBase64 = '';
      if (transcriptFile) {
        transcriptPdfBase64 = await fileToBase64(transcriptFile);
      }

      setLoadingStep('Gemini AI đang bóc tách câu hỏi, văn bản đọc và audio script...');

      const response = await fetch('/api/ai/parse-exam-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          answerKeyPdfBase64: answerKeyPdfBase64 || undefined,
          answerKeyText: answerKeyText.trim() || undefined,
          transcriptPdfBase64: transcriptPdfBase64 || undefined,
          transcriptText: transcriptText.trim() || undefined,
          examTitle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Lỗi khi trích xuất tài liệu');
      }

      setLoadingStep('Đang hoàn tất đối chiếu bằng chứng & chuẩn hóa cấu trúc đề thi...');
      const data = await response.json();

      const newTestId = `ai-test-${Date.now()}`;
      const normalized = normalizeImportedExamData({
        ...data,
        title: data.title || examTitle,
      });

      const newTestMetadata: TestMetadata = {
        id: newTestId,
        title: normalized.title || examTitle,
        subtitle:
          normalized.subtitle ||
          'Đề thi VSTEP B1-B2-C1 trích xuất tự động qua Gemini AI (35 câu Nghe, 40 câu Đọc & 2 bài Viết)',
        totalQuestions: 75,
        durationMinutes: normalized.durationMinutes || 100,
        isAvailable: true,
        isCustom: true,
        createdAt: Date.now(),
        questions: normalized.questions,
        writingTasks: normalized.writingTasks,
      };

      onExamExtracted(newTestMetadata, normalized.questions);
      onClose();
    } catch (err) {
      console.error('Error parsing exam:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra khi trích xuất PDF.');
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border-4 border-lime-500 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-500 text-white shadow-md">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Tạo Đề Thi Tự Động Bằng AI Từ PDF
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Tự động trích xuất câu hỏi, văn bản đọc, audio script, đáp án & bằng chứng giải thích
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-rose-700 text-sm font-semibold">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Test Title Input */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1.5">
              Tên đề thi mới
            </label>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="VD: Đề thi VSTEP B1-B2-C1 — Practice Test 2"
              className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-base font-bold text-slate-800 placeholder-slate-400 focus:border-lime-500 focus:outline-none transition-colors"
              disabled={isLoading}
            />
          </div>

          {/* 1. Main Exam PDF Upload */}
          <div className="rounded-2xl border-2 border-dashed border-lime-400 bg-lime-50/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-lime-700">
                  <FileText className="h-4 w-4" /> 1. File Đề Thi Chính (PDF) *
                </span>
                <p className="text-xs text-slate-600 mt-0.5">
                  File PDF chứa các câu hỏi phần Nghe và Đọc, có thể gồm văn bản bài đọc và đề bài.
                </p>
              </div>
              <button
                type="button"
                onClick={() => examFileInputRef.current?.click()}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-lime-500 hover:bg-lime-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors border-b-2 border-lime-700 active:translate-y-0.5"
              >
                <Upload className="h-4 w-4" />
                {examFile ? 'Đổi File' : 'Chọn File PDF'}
              </button>
              <input
                ref={examFileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setExamFile(e.target.files[0]);
                  }
                }}
              />
            </div>
            {examFile && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-white px-3 py-2 border border-lime-300 text-xs font-bold text-lime-800">
                <CheckCircle2 className="h-4 w-4 text-lime-600 shrink-0" />
                <span className="truncate">{examFile.name}</span>
                <span className="text-slate-400 font-normal ml-auto">
                  ({(examFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              </div>
            )}
          </div>

          {/* 2. Optional Answer Key */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                  <KeyRound className="h-4 w-4 text-amber-500" /> 2. Đáp Án (Tùy chọn)
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đính kèm file PDF đáp án hoặc dán chuỗi đáp án (VD: 1.A, 2.B, 3.C...). Nếu để trống, AI sẽ tự giải đề.
                </p>
              </div>
              <button
                type="button"
                onClick={() => answerFileInputRef.current?.click()}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-slate-200 hover:bg-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {answerKeyFile ? 'Đổi File' : 'Up PDF Đáp Án'}
              </button>
              <input
                ref={answerFileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setAnswerKeyFile(e.target.files[0]);
                  }
                }}
              />
            </div>
            {answerKeyFile && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{answerKeyFile.name}</span>
              </div>
            )}
            <textarea
              rows={2}
              value={answerKeyText}
              onChange={(e) => setAnswerKeyText(e.target.value)}
              placeholder="Hoặc dán đáp án text tại đây: 1.A 2.C 3.B 4.A 5.B..."
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-700 focus:border-lime-500 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          {/* 3. Optional Transcript */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-5">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                  <Headphones className="h-4 w-4 text-sky-500" /> 3. Audio Transcript (Tùy chọn)
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đính kèm file PDF hoặc dán lời thoại nghe để tạo tính năng highlight bằng chứng chính xác nhất.
                </p>
              </div>
              <button
                type="button"
                onClick={() => transcriptFileInputRef.current?.click()}
                disabled={isLoading}
                className="shrink-0 flex items-center gap-2 rounded-xl bg-slate-200 hover:bg-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {transcriptFile ? 'Đổi File' : 'Up PDF Script'}
              </button>
              <input
                ref={transcriptFileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setTranscriptFile(e.target.files[0]);
                  }
                }}
              />
            </div>
            {transcriptFile && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{transcriptFile.name}</span>
              </div>
            )}
            <textarea
              rows={2}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="Hoặc dán transcript lời thoại tại đây..."
              className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-mono text-slate-700 focus:border-lime-500 focus:outline-none"
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Footer & Action Button */}
        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Sparkles className="h-4 w-4 text-lime-500" />
            <span>Mô hình Gemini 3.8 Flash xử lý bóc tách tài liệu</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 sm:flex-none rounded-2xl border-2 border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleProcessPdf}
              disabled={isLoading || (!examFile && !answerKeyText && !transcriptText)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-2xl bg-lime-500 hover:bg-lime-600 disabled:opacity-50 px-6 py-3 text-sm font-black text-white shadow-md border-b-4 border-lime-700 active:border-b-0 active:translate-y-1 transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{loadingStep || 'Đang xử lý...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  <span>AI Bóc Tách Đề Thi</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
