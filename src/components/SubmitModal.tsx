import React, { useState } from 'react';
import { AlertTriangle, UserCheck, LogIn, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SubmitModalProps {
  isOpen: boolean;
  timeRemainingSeconds: number;
  onContinue: () => void;
  onSubmit: (guestInfo?: { name?: string; email?: string }) => void;
}

export const SubmitModal: React.FC<SubmitModalProps> = ({
  isOpen,
  timeRemainingSeconds,
  onContinue,
  onSubmit,
}) => {
  const { currentUser, signInWithGoogle } = useAuth();
  const [guestName, setGuestName] = useState<string>(() => {
    return localStorage.getItem('vstep_guest_student_name') || '';
  });
  const [guestEmail, setGuestEmail] = useState<string>(() => {
    return localStorage.getItem('vstep_guest_student_email') || '';
  });
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string | null>(null);

  if (!isOpen) return null;

  const minutes = Math.floor(timeRemainingSeconds / 60);
  const seconds = timeRemainingSeconds % 60;

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.warn('Google sign in error in submit modal:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleConfirm = () => {
    if (!currentUser) {
      const trimmed = guestName.trim();
      if (!trimmed) {
        setNameError('Vui lòng nhập Họ & Tên để Giáo viên ghi nhận bài nộp của bạn!');
        return;
      }
      try {
        localStorage.setItem('vstep_guest_student_name', trimmed);
        if (guestEmail.trim()) {
          localStorage.setItem('vstep_guest_student_email', guestEmail.trim());
        }
      } catch {
        // Ignore
      }
      onSubmit({ name: trimmed, email: guestEmail.trim() || undefined });
    } else {
      onSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 text-center shadow-2xl border-2 border-[#E5E5E5] border-b-8 border-b-[#CECECE] dark:border-slate-700 dark:border-b-slate-950">
        {/* Warning Icon Badge */}
        <div className="mx-auto mb-4 flex h-15 w-15 items-center justify-center rounded-2xl bg-[#FFF4E5] dark:bg-amber-950/60 text-[#FF9600] border-2 border-[#FF9600] border-b-4 border-b-[#E58700]">
          <AlertTriangle className="h-8 w-8" />
        </div>

        {/* Message */}
        <h3 className="mb-1 text-xl font-black text-[#3C3C3C] dark:text-white">
          Thời gian còn {minutes}m {seconds.toString().padStart(2, '0')}s
        </h3>
        <p className="mb-5 text-xs font-bold text-[#777777] dark:text-slate-400">
          Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?
        </p>

        {/* Student Identification Section */}
        {currentUser ? (
          <div className="mb-6 p-3.5 rounded-2xl bg-[#D7FFB8]/45 dark:bg-emerald-950/40 border-2 border-[#58CC02] border-b-4 border-b-[#46A302] text-left flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#58CC02] border-b-2 border-[#46A302] text-white font-black flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <span className="font-black text-[#46A302] dark:text-emerald-300 block">
                Nộp bài với tài khoản:
              </span>
              <strong className="text-[#3C3C3C] dark:text-white font-black truncate block">
                {currentUser.displayName || currentUser.email}
              </strong>
              <span className="text-[#777777] text-[11px] font-bold truncate block">
                {currentUser.email}
              </span>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] dark:border-slate-700 text-left space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-[#FF9600]">
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>Định danh học viên để gửi bài cho Giáo viên</span>
            </div>

            <p className="text-[11px] font-bold text-[#777777] dark:text-slate-400 leading-relaxed">
              Bạn đang làm bài với tư cách Khách. Hãy đăng nhập Google hoặc nhập tên để Giáo viên nhận được bài làm của bạn:
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="btn-duo-blue w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>{isSigningIn ? 'Đang kết nối Google...' : 'Đăng nhập Google (Nhanh nhất)'}</span>
            </button>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
              <span className="flex-shrink mx-2 text-[10px] font-black text-slate-400 uppercase">Hoặc nhập tên</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
            </div>

            <div>
              <label className="block text-[11px] font-black text-[#3C3C3C] dark:text-slate-300 mb-1">
                Họ và tên của bạn <span className="text-[#FF4B4B]">*</span>
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => {
                  setGuestName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Ví dụ: Nguyễn Thị Thu Uyên, Hoàng Nam..."
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] bg-white dark:bg-slate-900 text-xs text-[#3C3C3C] dark:text-white font-bold focus:outline-hidden focus:border-[#58CC02]"
              />
              {nameError && (
                <p className="text-[11px] font-black text-[#FF4B4B] mt-1">{nameError}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-black text-[#3C3C3C] dark:text-slate-300 mb-1">
                Email hoặc SĐT <span className="text-slate-400 font-bold">(tùy chọn)</span>
              </label>
              <input
                type="text"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="uyen@gmail.com hoặc 090..."
                className="w-full px-3 py-2.5 rounded-xl border-2 border-[#E5E5E5] border-b-4 border-b-[#CECECE] bg-white dark:bg-slate-900 text-xs text-[#3C3C3C] dark:text-white font-bold focus:outline-hidden focus:border-[#58CC02]"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="btn-duo-white flex-1 rounded-2xl py-3.5 px-4 text-xs sm:text-sm font-black cursor-pointer"
          >
            Làm tiếp
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn-duo-green flex-1 rounded-2xl py-3.5 px-4 text-xs sm:text-sm font-black cursor-pointer"
          >
            Nộp bài ngay
          </button>
        </div>
      </div>
    </div>
  );
};
