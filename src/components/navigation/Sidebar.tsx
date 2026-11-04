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
  isAdminFeedbackOpen?: boolean;
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
  isAdminFeedbackOpen = false,
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
      iconColor: 'text-[#58CC02]',
    },
    {
      id: 'tests' as NavTabType,
      label: 'Luyện đề',
      icon: BookOpen,
      iconColor: 'text-[#58CC02]',
    },
    {
      id: 'listening' as NavTabType,
      label: 'Luyện nghe',
      icon: Headphones,
      iconColor: 'text-[#1CB0F6]',
    },
    {
      id: 'reading' as NavTabType,
      label: 'Luyện đọc',
      icon: FileText,
      iconColor: 'text-[#FF9600]',
    },
    {
      id: 'vocab' as NavTabType,
      label: 'Từ vựng VSTEP',
      icon: BookmarkCheck,
      iconColor: 'text-[#CE82FF]',
    },
    {
      id: 'leaderboard' as NavTabType,
      label: 'Xếp hạng',
      icon: Trophy,
      iconColor: 'text-[#FFC800]',
    },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col justify-between shrink-0 h-screen sticky top-0 bg-white dark:bg-slate-900 border-r-2 border-slate-200 dark:border-slate-800 transition-all duration-300 z-30 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Brand Logo */}
      <div className="p-4 border-b-2 border-slate-100 dark:border-slate-800/60">
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
              <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
                VSTEP <span className="text-[#58CC02]">Tutor</span>
              </span>
              <span className="text-[10px] font-extrabold text-[#3C8C02] dark:text-[#58CC02] truncate">
                by Mr.Harry (Lecturer)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 scrollbar-thin">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold uppercase tracking-wide transition-all relative group cursor-pointer ${
                isActive
                  ? 'bg-[#D7FFB8]/65 dark:bg-emerald-950/70 text-[#3C8C02] dark:text-[#58CC02] border-2 border-[#58CC02] border-b-4 border-b-[#46A302]'
                  : 'text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 hover:border-b-4 hover:border-b-slate-300 dark:hover:border-b-slate-950 active:translate-y-0.5'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title={item.label}
            >
              <Icon
                className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${
                  isActive ? 'text-[#58CC02]' : item.iconColor
                }`}
              />

              {!isCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* Quick Link back to Redesigned Landing Page + Student Feedback (Hidden for Admin) */}
        <div className="pt-2.5 mt-2.5 border-t-2 border-slate-100 dark:border-slate-800/80 space-y-2">
          {onBackToLanding && (
            <button
              type="button"
              onClick={onBackToLanding}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 hover:border-b-4 hover:border-b-slate-300 dark:hover:border-b-slate-950 active:translate-y-0.5 transition-all cursor-pointer group ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
              title="Xem Trang giới thiệu (Landing Page)"
            >
              <Globe className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-[#58CC02] group-hover:scale-110 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Trang giới thiệu</span>
              )}
            </button>
          )}

          {onOpenFeedback && !canManageExams && !isAdmin && (
            <button
              type="button"
              onClick={onOpenFeedback}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 hover:border-b-4 hover:border-b-slate-300 dark:hover:border-b-slate-950 active:translate-y-0.5 transition-all cursor-pointer group ${
                isCollapsed ? 'justify-center px-2' : ''
              }`}
              title="Báo lỗi câu hỏi hoặc góp ý hệ thống"
            >
              <MessageSquareWarning className="h-5 w-5 shrink-0 text-[#FF9600] group-hover:scale-110 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left whitespace-nowrap">Báo lỗi / Góp ý</span>
              )}
            </button>
          )}
        </div>

        {/* Admin Management Tab & Notification Inbox - Gated to Admins & Teachers */}
        {canManageExams && (
          <div className="pt-3 mt-3 border-t-2 border-slate-100 dark:border-slate-800/80 space-y-2">
            {/* Quản lý học viên */}
            <button
              type="button"
              onClick={() => onSelectTab('students')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all group cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-[#D7FFB8]/65 dark:bg-emerald-950/70 text-[#3C8C02] dark:text-[#58CC02] border-2 border-[#58CC02] border-b-4 border-b-[#46A302]'
                  : 'text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 hover:border-b-4 hover:border-b-slate-300 dark:hover:border-b-slate-950 active:translate-y-0.5'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title="Quản lý học viên & Tiến trình VSTEP"
            >
              <Users className="h-5 w-5 shrink-0 text-[#1CB0F6] group-hover:scale-110 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Quản lý học viên</span>
              )}
              {!isCollapsed && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-[#DDF4FF] text-[#1899D6] dark:bg-sky-900/60 dark:text-sky-300 px-1.5 py-0.5 rounded-lg border border-[#1CB0F6]/40">
                  Học viên
                </span>
              )}
            </button>

            {onOpenAdminFeedback && (
              <button
                type="button"
                onClick={onOpenAdminFeedback}
                className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all cursor-pointer group ${
                  isAdminFeedbackOpen
                    ? 'bg-[#D7FFB8]/65 dark:bg-emerald-950/70 text-[#3C8C02] dark:text-[#58CC02] border-2 border-[#58CC02] border-b-4 border-b-[#46A302]'
                    : 'text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 hover:border-b-4 hover:border-b-slate-300 dark:hover:border-b-slate-950 active:translate-y-0.5'
                } ${isCollapsed ? 'justify-center px-2' : ''}`}
                title="Hòm thư Báo lỗi & Góp ý của học viên"
              >
                <div className="relative shrink-0">
                  <Bell
                    className={`h-5 w-5 transition-transform group-hover:scale-110 ${
                      isAdminFeedbackOpen
                        ? 'text-[#58CC02]'
                        : 'text-slate-500 group-hover:text-[#58CC02]'
                    }`}
                  />
                  {unreadFeedbackCount > 0 && isCollapsed && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[#FF4B4B]" />
                  )}
                </div>
                {!isCollapsed && (
                  <span className="truncate flex-1 text-left">Hòm thư Góp ý</span>
                )}
                {!isCollapsed && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                      unreadFeedbackCount > 0
                        ? 'bg-[#FF4B4B] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
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
              className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-xs font-extrabold transition-all group cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[#D7FFB8]/65 dark:bg-emerald-950/70 text-[#3C8C02] dark:text-[#58CC02] border-2 border-[#58CC02] border-b-4 border-b-[#46A302]'
                  : 'text-slate-600 dark:text-slate-400 border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-200 dark:hover:border-slate-700 hover:border-b-4 hover:border-b-slate-300 dark:hover:border-b-slate-950 active:translate-y-0.5'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
              title="Quản lý đề & AI Studio"
            >
              <Settings className="h-5 w-5 shrink-0 text-[#CE82FF] group-hover:rotate-45 transition-transform" />
              {!isCollapsed && (
                <span className="truncate flex-1 text-left">Quản lý đề thi</span>
              )}
              {!isCollapsed && (
                <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 px-1.5 py-0.5 rounded-lg border border-amber-300">
                  {isSuperAdmin ? 'Super Admin' : isCoTeacher ? 'Trợ giảng' : 'Admin'}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Author Signature Card in Sidebar */}
        {!isCollapsed && (
          <div className="mt-4 p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200 truncate">
                Mr.Harry
              </span>
            </div>
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              English Lecturer and Instructor
            </p>
          </div>
        )}
      </div>

      {/* Bottom Area: Collapse button, Profile & Settings */}
      <div className="p-3 border-t-2 border-slate-100 dark:border-slate-800/80 space-y-2">
        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all border-2 border-transparent cursor-pointer"
          title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Thu gọn menu</span>
            </div>
          )}
        </button>

        {/* User Profile Card & Sign Out Button */}
        {currentUser ? (
          <div className="space-y-2">
            <div
              onClick={onOpenHistory}
              className={`flex items-center gap-2.5 p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-all border-2 border-transparent ${
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
                  <div className="h-9 w-9 rounded-full bg-[#58CC02] flex items-center justify-center text-white font-black">
                    <User className="h-4 w-4" />
                  </div>
                )}
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#58CC02] ring-2 ring-white dark:ring-slate-900" />
              </div>

              {!isCollapsed && (
                <div className="overflow-hidden flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">
                    {userProfile?.nickname || currentUser.displayName || 'Học viên VSTEP'}
                  </div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                    {currentUser.email || 'Xem hồ sơ'}
                  </div>
                </div>
              )}
            </div>

            {/* Dedicated Sign Out Button */}
            <button
              type="button"
              onClick={() => signOutUser()}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-xs font-black text-white bg-[#FF4B4B] hover:bg-[#ff5e5e] border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B] active:border-b-0 active:translate-y-1 transition-all cursor-pointer ${
                isCollapsed ? 'px-1.5' : ''
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
              className={`btn-duo-green w-full flex items-center justify-center gap-2 p-2.5 text-white ${
                isCollapsed ? 'p-2' : ''
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
            <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-500 dark:text-slate-400 px-1">
              <span>Giao diện hiển thị</span>
              <span className="text-[#FF9600] font-black">⚡ {userPoints} XP</span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  themeMode === 'light'
                    ? 'bg-white text-slate-900 shadow-2xs border-b-2 border-slate-300'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Giao diện Sáng"
              >
                <Sun className="h-3 w-3 text-[#FF9600] shrink-0" />
                <span>Sáng</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  themeMode === 'dark'
                    ? 'bg-slate-900 text-white shadow-2xs border-b-2 border-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="Giao diện Tối"
              >
                <Moon className="h-3 w-3 text-[#CE82FF] shrink-0" />
                <span>Tối</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  themeMode === 'system'
                    ? 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#46A302]'
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
              className="p-2 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 text-slate-700 dark:text-slate-300 active:border-b-0 active:translate-y-1"
              title={`Chế độ hiện tại: ${themeMode === 'system' ? 'Theo hệ thống' : theme === 'dark' ? 'Tối' : 'Sáng'}`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#FFC800]" />
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
