import React, { useState, useEffect } from 'react';
import {
  MessageSquareWarning,
  X,
  Send,
  CheckCircle2,
  MapPin,
  Sparkles,
  User,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  FeedbackCategory,
  FEEDBACK_CATEGORY_LABELS,
  submitFeedbackReport,
} from '../services/feedbackService';

export interface FeedbackContextData {
  contextScreen?: string;
  testId?: string;
  testTitle?: string;
  section?: string;
  partNumber?: number;
  questionNumber?: number;
}

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextData?: FeedbackContextData;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  contextData,
}) => {
  const { currentUser } = useAuth();
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [category, setCategory] = useState<FeedbackCategory>('question_error');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setUserName(currentUser?.displayName || '');
      setUserEmail(currentUser?.email || '');
      setCategory(
        contextData?.testId ? 'question_error' : 'general_suggestion'
      );
      setMessage('');
      setSubmittedSuccess(false);
      setErrorMsg('');
    }
  }, [isOpen, currentUser, contextData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3) {
      setErrorMsg('Vui lòng nhập nội dung báo lỗi hoặc góp ý chi tiết hơn (tối thiểu 3 ký tự).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await submitFeedbackReport({
        userName: userName.trim() || currentUser?.displayName || 'Học viên LanguageCert',
        userEmail: userEmail.trim() || currentUser?.email || '',
        category,
        message: message.trim(),
        contextScreen: contextData?.contextScreen || 'landing',
        testId: contextData?.testId,
        testTitle: contextData?.testTitle,
        section: contextData?.section,
        partNumber: contextData?.partNumber,
        questionNumber: contextData?.questionNumber,
      });
      setSubmittedSuccess(true);
    } catch {
      setErrorMsg('Có lỗi xảy ra khi gửi phản hồi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 text-slate-900 shadow-2xl border-2 border-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#58CC02] text-white shadow-sm border-b-3 border-[#3C8C02]">
              <MessageSquareWarning className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Báo Lỗi Đề Thi &amp; Góp Ý Hệ Thống
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Gửi trực tiếp tới{' '}
                <strong className="text-slate-800">
                  Mr.Harry (English Lecturer and Instructor)
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {submittedSuccess ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-lime-100 text-[#3C8C02]">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xl font-black text-slate-900">
                Đã gửi báo lỗi / góp ý thành công!
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Cảm ơn bạn đã đóng góp! Thông báo của bạn đã được chuyển trực tiếp vào Hòm thư Quản trị của{' '}
                <strong className="text-slate-900">Mr.Harry (English Lecturer and Instructor)</strong> để kiểm tra và cập nhật sớm nhất.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#58CC02] hover:bg-[#46A302] px-7 py-3 text-xs sm:text-sm font-black text-white shadow-md border-b-4 border-[#3C8C02] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span>Quay lại tiếp tục học</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Auto-detected Context Banner */}
            {(contextData?.testTitle || contextData?.section || contextData?.questionNumber) && (
              <div className="rounded-2xl bg-lime-50/80 border border-lime-200 p-3.5 text-xs flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-[#3C8C02] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-black text-slate-800">
                    Vị trí đang ghi nhận tự động:
                  </div>
                  <div className="text-slate-600 font-semibold">
                    {contextData.testTitle && <span>{contextData.testTitle}</span>}
                    {contextData.section && <span> · {contextData.section}</span>}
                    {contextData.partNumber && <span> Part {contextData.partNumber}</span>}
                    {contextData.questionNumber && <span> · Câu {contextData.questionNumber}</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                1. Phân loại vấn đề
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(FEEDBACK_CATEGORY_LABELS) as FeedbackCategory[]).map((catKey) => {
                  const selected = category === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setCategory(catKey)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        selected
                          ? 'border-[#58CC02] bg-[#E5F9D6]/70 text-[#2B6601] ring-2 ring-[#58CC02]/25'
                          : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {FEEDBACK_CATEGORY_LABELS[catKey]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên của bạn (Tùy chọn)
                </label>
                <div className="relative">
                  <User className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="VD: Minh Anh (Lớp B1)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#58CC02] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email / Liên hệ (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Để nhận phản hồi khi sửa xong"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-[#58CC02] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Detailed Message */}
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1.5">
                2. Nội dung chi tiết cần báo lỗi hoặc góp ý <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mô tả cụ thể lỗi bạn gặp phải (ví dụ: Câu 3 Part 2 đáp án đúng phải là B, hoặc file nghe bị nhỏ, hoặc đề xuất thêm tính năng mới...)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#58CC02] focus:bg-white focus:outline-none leading-relaxed"
              />
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-[#58CC02]" />
                <span>Phản hồi tức thì tới Admin</span>
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#58CC02] hover:bg-[#46A302] disabled:opacity-50 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md border-b-4 border-[#3C8C02] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{isSubmitting ? 'Đang gửi...' : 'Gửi Báo Lỗi / Góp Ý'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
