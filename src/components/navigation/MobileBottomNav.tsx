import React from 'react';
import { Home, BookOpen, Headphones, FileText, Trophy, BookmarkCheck } from 'lucide-react';
import { NavTabType } from './Sidebar';

interface MobileBottomNavProps {
  activeTab: NavTabType;
  onSelectTab: (tab: NavTabType) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const items = [
    { id: 'home' as NavTabType, label: 'Trang chủ', icon: Home },
    { id: 'tests' as NavTabType, label: 'Luyện đề', icon: BookOpen },
    { id: 'listening' as NavTabType, label: 'Nghe', icon: Headphones },
    { id: 'reading' as NavTabType, label: 'Đọc', icon: FileText },
    { id: 'vocab' as NavTabType, label: 'Từ vựng', icon: BookmarkCheck },
    { id: 'leaderboard' as NavTabType, label: 'Xếp hạng', icon: Trophy },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 safe-area-pb shadow-lg"
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[50px] ${
                isActive
                  ? 'text-[#3C8C02] dark:text-[#58CC02] font-black'
                  : 'text-slate-500 dark:text-slate-400 font-medium hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div
                className={`relative p-1 rounded-xl transition-all ${
                  isActive ? 'bg-[#E5F9D6] dark:bg-emerald-950/60' : ''
                }`}
              >
                <Icon className="h-5 w-5" />
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#58CC02]" />
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[54px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
