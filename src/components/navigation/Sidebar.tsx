import React from 'react';
import {
  Home,
  BookOpen,
  Headphones,
  FileText,
  BookmarkCheck,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Sparkles,
  User,
  Zap,
  Globe,
  MessageSquareWarning,
  Bell,
  GraduationCap,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { UkFlagLogo } from '../UkFlagLogo';

export type NavTabType =
  | 'home'
  | 'tests'
  | 'listening'
  | 'reading'
  | 'vocab'
  | 'leaderboard'
  | 'students'
  | 'admin';

interface SidebarProps {
  activeTab: NavTabType;
  onSelectTab: (tab: NavTabType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenHistory: () => void;
  onOpenLogin: () => void;
  onOpenAiPdf: () => void;
  onBackToLanding?: () => void;
  onOpenFeedback?: () => void;
  onOpenAdminFeedback?: () => void;
  unreadFeedbackCount?: number;
  userPoints?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  onOpenHistory,
  onOpenLogin,
  onOpenAiPdf,
  onBackToLanding,
  onOpenFeedback,
  onOpenAdminFeedback,
  unreadFeedbackCount = 0,
  userPoints = 650,
}) => {
  const { currentUser, userProfile, isAdmin, isSuperAdmin, isCoTeacher, canManageExams, signOutUser } = useAuth();
  const { theme, themeMode, setThemeMode, toggleTheme } = useTheme();

  const navItems = [
    {
      id: 'home' as NavTabType,
      label: 'Trang chủ',
      icon: Home,
    },
    {
      id: 'tests' as NavTabType,
      label: 'Luyện đề',
      icon: BookOpen,
    },
    {
      id: 'listening' as NavTabType,
      label: 'Luyện nghe',
      icon: Headphones,
    },
    {
      id: 'reading' as NavTabType,
      label: 'Luyện đọc',
      icon: FileText,
    },
    {
      id: 'vocab' as NavTabType,
      label: 'Từ vựng VSTEP',
      icon: BookmarkCheck,
    },
    {
      id: 'leaderboard' as NavTabType,
      label: 'Xếp hạng',
      icon: Trophy,
    },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col justify-between shrink-0 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Brand Logo */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/60">
        <div
          onClick={() => onSelectTab('home')}
          className={`flex items-center gap-3 cursor-pointer group ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title="VSTEP Tutor B1-B2-C1 · Created by Mr.Harry"
        >
          <UkFlagLogo
            size="md"
            className="group-hover:scale-105 transition-transform"
          />
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white truncate">
                VSTEP <span className="text-[#58CC02]">Tutor</span>
              </span>
              <span className="text-[10px] font-bold text-[#3C8C02] dark:text-[#58CC02] truncate">
                by Mr.Harry (Lecturer)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all relative group ${
                isActive
                  ? 'bg-[#E5F9D6] dark:bg-emerald-950/60 text-[#3C8C02] dark:text-[#58CC02] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-200'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title={item.label}
            >
              <Icon
                className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                  isActive
                    ? 'text-[#3C8C02] dark:text-[#58CC02]'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              />

              {!isCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}

              {isActive && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#58CC02]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}

        {/* Quick Link back to Redesigned Landing Page + Student Feedback (Hidden for Admin) */}
        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
          {onBackToLanding && (
            <button
              type="button"
              onClick={onBackToLanding}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800/50 transition-all cursor-pointer group ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
              title="Xem Trang giới thiệu (Landing Page)"
            >
              <Globe className="h-5 w-5 shrink-0 text-[#58CC02] group-hover:scale-110 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Trang giới thiệu</span>
              )}
            </button>
          )}

          {onOpenFeedback && !canManageExams && !isAdmin && (
            <button
              type="button"
              onClick={onOpenFeedback}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-lime-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-all cursor-pointer group ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
              title="Báo lỗi câu hỏi hoặc góp ý hệ thống"
            >
              <MessageSquareWarning className="h-5 w-5 shrink-0 text-[#58CC02] group-hover:scale-110 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left whitespace-nowrap">Báo lỗi / Góp ý</span>
              )}
            </button>
          )}
        </div>

        {/* Admin Management Tab & Notification Inbox - Gated to Admins & Teachers */}
        {canManageExams && (
          <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
            {/* Quản lý học viên */}
            <button
              type="button"
              onClick={() => onSelectTab('students')}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all group ${
                activeTab === 'students'
                  ? 'bg-[#E5F9D6] dark:bg-emerald-950/60 text-[#3C8C02] dark:text-[#58CC02] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title="Quản lý học viên & Tiến trình VSTEP"
            >
              <Users className="h-5 w-5 shrink-0 text-[#3C8C02] dark:text-[#58CC02] group-hover:scale-110 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Quản lý học viên</span>
              )}
              {!isCollapsed && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                  Học viên
                </span>
              )}
            </button>

            {onOpenAdminFeedback && (
              <button
                type="button"
                onClick={onOpenAdminFeedback}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-black bg-lime-50 dark:bg-emerald-950/50 text-[#2B6601] dark:text-lime-300 border border-lime-200 dark:border-emerald-800 hover:bg-lime-100 transition-all cursor-pointer group ${
                  isCollapsed ? 'justify-center px-2' : ''
                }`}
                title="Hòm thư Báo lỗi & Góp ý của học viên"
              >
                <div className="relative shrink-0">
                  <Bell className="h-5 w-5 text-[#3C8C02] dark:text-[#58CC02]" />
                  {unreadFeedbackCount > 0 && isCollapsed && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-600" />
                  )}
                </div>
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">Hòm thư Góp ý</span>
                )}
                {!isCollapsed && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                      unreadFeedbackCount > 0
                        ? 'bg-rose-600 text-white'
                        : 'bg-white text-slate-600'
                    }`}
                  >
                    {unreadFeedbackCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onSelectTab('admin')}
              className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all group ${
                activeTab === 'admin'
                  ? 'bg-[#E5F9D6] dark:bg-emerald-950/60 text-[#3C8C02] dark:text-[#58CC02]'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title="Quản lý đề & AI Studio"
            >
              <Settings className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400 group-hover:rotate-45 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Quản lý đề thi</span>
              )}
              {!isCollapsed && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 px-1.5 py-0.5 rounded">
                  {isSuperAdmin ? 'Super Admin' : isCoTeacher ? 'Trợ giảng' : 'Admin'}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Author Signature Card in Sidebar */}
        {!isCollapsed && (
          <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-[#58CC02] shrink-0" />
              <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate">
                Mr.Harry
              </span>
            </div>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              English Lecturer and Instructor
            </p>
          </div>
        )}
      </div>

      {/* Bottom Area: Collapse button, Profile & Settings */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-800"
          title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Thu gọn</span>
            </div>
          )}
        </button>

        {/* User Profile Card & Sign Out Button */}
        {currentUser ? (
          <div className="space-y-1.5">
            <div
              onClick={onOpenHistory}
              className={`flex items-center gap-2.5 p-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors border border-slate-200/80 dark:border-slate-800 ${
                isCollapsed ? 'justify-center p-1.5' : ''
              }`}
              title="Nhấn để xem hồ sơ & lịch sử thi"
            >
              <div className="relative shrink-0">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Avatar"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-[#58CC02]"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                    <User className="h-4 w-4" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#58CC02] ring-2 ring-white dark:ring-slate-900" />
              </div>

              {!isCollapsed && (
                <div className="overflow-hidden flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {userProfile?.nickname || currentUser.displayName || 'Học viên VSTEP'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.email || 'Xem hồ sơ'}
                  </div>
                </div>
              )}
            </div>

            {/* Dedicated Sign Out Button */}
            <button
              type="button"
              onClick={() => signOutUser()}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50/90 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-200/80 dark:border-rose-900/50 transition-all cursor-pointer ${
                isCollapsed ? 'justify-center px-1.5' : ''
              }`}
              title="Đăng xuất khỏi tài khoản"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!isCollapsed && <span>Đăng xuất</span>}
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onOpenLogin}
              className={`w-full flex items-center gap-2 p-2.5 rounded-2xl bg-[#58CC02] hover:bg-[#46a302] text-white cursor-pointer transition-all shadow-xs ${
                isCollapsed ? 'justify-center p-2' : ''
              }`}
              title="Đăng nhập tài khoản"
            >
              <User className="h-4 w-4 shrink-0" />
              {!isCollapsed && (
                <span className="text-xs font-black truncate">Đăng nhập tài khoản</span>
              )}
            </button>
          </div>
        )}

        {/* 3-Mode Theme Switcher (Sáng / Tối / Hệ thống) */}
        {!isCollapsed ? (
          <div className="pt-1 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1">
              <span>Giao diện hiển thị</span>
              <span className="text-[#58CC02] font-black">{userPoints} XP</span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  themeMode === 'light'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Giao diện Sáng"
              >
                <Sun className="h-3 w-3 text-amber-500 shrink-0" />
                <span>Sáng</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  themeMode === 'dark'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Giao diện Tối"
              >
                <Moon className="h-3 w-3 text-indigo-400 shrink-0" />
                <span>Tối</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  themeMode === 'system'
                    ? 'bg-[#58CC02] text-white shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Tự động theo hệ thống"
              >
                <span>Hệ thống</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              title={`Chế độ hiện tại: ${themeMode === 'system' ? 'Theo hệ thống' : theme === 'dark' ? 'Tối' : 'Sáng'}`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
