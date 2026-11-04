import React, { useState, useRef, useEffect } from 'react';
import { LogOut, History, PlusCircle, ChevronDown, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LoginModal } from './LoginModal';

interface UserMenuProps {
  onOpenHistory: () => void;
  onOpenAdmin: () => void;
  onOpenProfile?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenHistory, onOpenAdmin, onOpenProfile }) => {
  const { currentUser, userProfile, isAdmin, isSuperAdmin, isCoTeacher, canManageExams, signInWithGoogle, signOutUser, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showFallbackLoginModal, setShowFallbackLoginModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch {
      // If popup was blocked or closed, open LoginModal so the user can retry, open in new tab, or use Email/Password
      setShowFallbackLoginModal(true);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
    );
  }

  if (!currentUser) {
    return (
      <>
        <div className="flex items-center gap-2">
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
              title="Thông tin cá nhân & Đổi Nickname"
            >
              <User className="h-3.5 w-3.5 text-[#58CC02]" />
              <span className="hidden sm:inline">Hồ sơ</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 px-3.5 py-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:border-[#1CB0F6] hover:border-b-[#1899D6] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
          >
            {/* Google G icon */}
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isSigningIn ? 'Đang kết nối...' : 'Đăng nhập Google'}</span>
          </button>
        </div>

        <LoginModal
          isOpen={showFallbackLoginModal}
          onClose={() => setShowFallbackLoginModal(false)}
        />
      </>
    );
  }

  const displayName = userProfile?.nickname || userProfile?.displayName || currentUser.displayName || 'Học viên';
  const fullName = userProfile?.displayName || currentUser.displayName || 'Học viên';
  const photoURL = userProfile?.photoURL || currentUser.photoURL;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 p-1.5 pr-3 hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt={displayName}
            className="h-7 w-7 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#58CC02] text-xs font-black text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="hidden sm:block text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[120px]">
              {fullName}
            </span>
            {isSuperAdmin ? (
              <span className="rounded-md bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 text-[10px] font-black text-amber-800 dark:text-amber-300">
                Super Admin
              </span>
            ) : isCoTeacher ? (
              <span className="rounded-md bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                Trợ giảng
              </span>
            ) : isAdmin ? (
              <span className="rounded-md bg-sky-100 dark:bg-sky-950 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                Admin
              </span>
            ) : null}
          </div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-3xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 p-2.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="border-b border-slate-100 dark:border-slate-700/60 p-2.5">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{fullName}</p>
            {userProfile?.nickname && (
              <p className="text-[11px] font-bold text-[#16A34A] dark:text-[#58CC02] truncate">
                Nickname: {userProfile.nickname}
              </p>
            )}
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
            {isSuperAdmin && (
              <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                Tài khoản Quản trị Tối cao (Super Admin)
              </p>
            )}
          </div>

          <div className="py-1 space-y-0.5">
            {onOpenProfile && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenProfile();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <User className="h-4 w-4 text-sky-500" />
                <span>Thông tin cá nhân</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenHistory();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <History className="h-4 w-4 text-[#58CC02]" />
              <span>Lịch sử làm bài thi</span>
            </button>

            {canManageExams && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAdmin();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <PlusCircle className="h-4 w-4 text-amber-600" />
                <span>Quản trị & Tạo đề thi mới</span>
              </button>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700/60 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                signOutUser();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
