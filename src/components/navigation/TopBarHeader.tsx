import React from 'react';
import {
  Sparkles,
  PlusCircle,
  Flame,
  Sun,
  Moon,
  Monitor,
  ArrowLeft,
  MessageSquareWarning,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { UserMenu } from '../UserMenu';
import { UkFlagLogo } from '../UkFlagLogo';

interface TopBarHeaderProps {
  title: string;
  subtitle?: string;
  onOpenAiPdf: () => void;
  onOpenCreateExam: () => void;
  onOpenHistory: () => void;
  onOpenProfile?: () => void;
  onNavigateBack?: () => void;
  backTargetLabel?: string;
  breadcrumbTrail?: string[];
  onBackToLanding?: () => void;
  onOpenFeedback?: () => void;
  onOpenAdminFeedback?: () => void;
  isAdminFeedbackOpen?: boolean;
  unreadFeedbackCount?: number;
  streakDays?: number;
}

export const TopBarHeader: React.FC<TopBarHeaderProps> = ({
  title,
  subtitle,
  onOpenAiPdf,
  onOpenCreateExam,
  onOpenHistory,
  onOpenProfile,
  onNavigateBack,
  backTargetLabel,
  breadcrumbTrail = [],
  onBackToLanding,
  onOpenFeedback,
  onOpenAdminFeedback,
  isAdminFeedbackOpen = false,
  unreadFeedbackCount = 0,
  streakDays = 1,
}) => {
  const { themeMode, setThemeMode } = useTheme();
  const { canManageExams, isAdmin } = useAuth();

  const handleBack = onNavigateBack || onBackToLanding;

  return (
    <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b-2 border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Hierarchical Back button & View title */}
        <div className="flex items-center gap-3 min-w-0">
          {handleBack && (
            <button
              type="button"
              onClick={handleBack}
              className="group flex items-center gap-1.5 rounded-2xl bg-white hover:bg-[#E5F9D6] dark:bg-slate-800 dark:hover:bg-emerald-950/60 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-0 active:translate-y-1 px-3.5 py-1.5 text-xs font-extrabold text-slate-700 hover:text-[#2B6601] dark:text-slate-200 dark:hover:text-[#58CC02] transition-all cursor-pointer whitespace-nowrap shrink-0"
              title={
                backTargetLabel
                  ? `Quay lại: ${backTargetLabel}`
                  : 'Quay lại thư mục / trang liền trước'
              }
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5 text-[#58CC02]" />
              <span>Quay lại</span>
              {backTargetLabel && (
                <span className="hidden md:inline text-[11px] font-bold text-slate-400 dark:text-slate-400 group-hover:text-[#3C8C02] dark:group-hover:text-lime-300">
                  ({backTargetLabel})
                </span>
              )}
            </button>
          )}

          {/* Mobile Brand indicator */}
          <div className="lg:hidden flex items-center gap-2 shrink-0">
            <UkFlagLogo size="sm" />
            <span className="font-black text-sm text-slate-900 dark:text-white whitespace-nowrap">
              VSTEP <span className="text-[#58CC02]">Tutor</span>
            </span>
          </div>

          {/* Desktop Title, Breadcrumb Folder Path & Subtitle */}
          <div className="hidden lg:block min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {breadcrumbTrail.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-extrabold text-slate-400 dark:text-slate-500 shrink-0">
                  {breadcrumbTrail.map((crumb, idx) => (
                    <React.Fragment key={idx}>
                      <span className="truncate max-w-[140px]">{crumb}</span>
                      <span>/</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white truncate">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Streak, Theme Switcher, Quick Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Student Report Bug / Feedback Button — Strictly hidden when in Admin mode */}
          {onOpenFeedback && !canManageExams && !isAdmin && (
            <button
              type="button"
              onClick={onOpenFeedback}
              className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 hover:border-[#58CC02] hover:border-b-[#46A302] active:border-b-0 active:translate-y-1 px-3 py-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-200 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Báo lỗi đề thi hoặc Góp ý cho Mr.Harry"
            >
              <MessageSquareWarning className="h-3.5 w-3.5 text-[#FF9600] shrink-0" />
              <span className="hidden md:inline whitespace-nowrap">Báo lỗi / Góp ý</span>
            </button>
          )}

          {/* Admin Notification Inbox Button */}
          {canManageExams && onOpenAdminFeedback && (
            <button
              type="button"
              onClick={onOpenAdminFeedback}
              className={`relative group inline-flex items-center gap-1.5 rounded-2xl border-2 px-3 py-1.5 text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isAdminFeedbackOpen
                  ? 'border-[#58CC02] border-b-4 border-b-[#46A302] bg-[#E5F9D6] dark:bg-emerald-950/60 text-[#2B6601] dark:text-lime-300'
                  : 'border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-[#58CC02] hover:border-b-[#46A302] hover:bg-lime-50/50 hover:text-[#2B6601] active:border-b-0 active:translate-y-1'
              }`}
              title="Hòm thư thông báo Báo lỗi & Góp ý của học viên"
            >
              <Bell
                className={`h-3.5 w-3.5 shrink-0 transition-transform group-hover:scale-110 ${
                  isAdminFeedbackOpen
                    ? 'text-[#3C8C02] dark:text-[#58CC02]'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-[#58CC02]'
                }`}
              />
              <span className="hidden xl:inline whitespace-nowrap">Thông báo</span>
              {unreadFeedbackCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF4B4B] px-1 text-[10px] font-black text-white tabular-nums">
                  {unreadFeedbackCount}
                </span>
              )}
            </button>
          )}

          {/* 3-Mode Theme Switcher (Sáng / Tối / Hệ thống) */}
          <div
            className="hidden sm:inline-flex items-center gap-0.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shrink-0"
            role="group"
            aria-label="Chọn giao diện Sáng, Tối hoặc Theo hệ thống"
          >
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                themeMode === 'light'
                  ? 'bg-white text-slate-900 shadow-2xs border-b-2 border-slate-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Giao diện Sáng"
            >
              <Sun className="h-3.5 w-3.5 text-[#FF9600] shrink-0" />
              <span className="hidden xl:inline">Sáng</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                themeMode === 'dark'
                  ? 'bg-slate-900 text-white shadow-2xs border-b-2 border-black'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Giao diện Tối"
            >
              <Moon className="h-3.5 w-3.5 text-[#CE82FF] shrink-0" />
              <span className="hidden xl:inline">Tối</span>
            </button>
            <button
              type="button"
              onClick={() => setThemeMode('system')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                themeMode === 'system'
                  ? 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#46A302]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Theo hệ thống"
            >
              <Monitor className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xl:inline">Hệ thống</span>
            </button>
          </div>

          {/* Streak Flame Pill (Duolingo 3D Badge) */}
          <div
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-[#FFF3D6] dark:bg-orange-950/50 border-2 border-[#FF9600] border-b-4 border-b-[#E58700] shrink-0"
            title={`Chuỗi học tập liên tục ${streakDays} ngày`}
          >
            <Flame className="h-4 w-4 fill-[#FF9600] text-[#FF9600]" />
            <span className="text-xs font-black text-[#E58700] dark:text-orange-400 tabular-nums">
              {streakDays}
            </span>
          </div>

          {/* User Profile Menu */}
          <UserMenu
            onOpenHistory={onOpenHistory}
            onOpenAdmin={onOpenCreateExam}
            onOpenProfile={onOpenProfile}
          />
        </div>
      </div>
    </header>
  );
};
