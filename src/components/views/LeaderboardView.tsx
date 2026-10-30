import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Flame, Star, Award, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getStreakStatus,
  STREAK_UPDATED_EVENT,
  ComputedStreakStatus,
} from '../../services/streakService';

export const LeaderboardView: React.FC = () => {
  const { currentUser } = useAuth();
  const [userStreak, setUserStreak] = useState<number>(() => getStreakStatus().currentStreak);

  useEffect(() => {
    setUserStreak(getStreakStatus().currentStreak);
    const handleStreakUpdate = (e: Event) => {
      const ce = e as CustomEvent<ComputedStreakStatus>;
      setUserStreak(ce.detail ? ce.detail.currentStreak : getStreakStatus().currentStreak);
    };
    window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
  }, []);

  const topLearners = [
    {
      rank: 1,
      name: 'Nguyễn Minh Tuấn',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      score: '48/50',
      grade: 'High Pass',
      streak: 18,
      xp: 2450,
    },
    {
      rank: 2,
      name: 'Trần Thảo Linh',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop&crop=faces',
      score: '46/50',
      grade: 'High Pass',
      streak: 14,
      xp: 1980,
    },
    {
      rank: 3,
      name: 'Lê Hoàng Nam',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
      score: '44/50',
      grade: 'High Pass',
      streak: 11,
      xp: 1720,
    },
    {
      rank: 4,
      name: currentUser?.displayName ? `${currentUser.displayName} (Bạn)` : 'Đàm Tấn Thành (Bạn)',
      avatar: currentUser?.photoURL || '',
      score: '42/50',
      grade: 'High Pass',
      streak: userStreak,
      xp: 1450,
      isCurrentUser: true,
    },
    {
      rank: 5,
      name: 'Vũ Ngọc Hân',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
      score: '39/50',
      grade: 'High Pass',
      streak: 9,
      xp: 1390,
    },
    {
      rank: 6,
      name: 'Phạm Đức Duy',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
      score: '36/50',
      grade: 'Pass',
      streak: 5,
      xp: 1120,
    },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-black text-xs mb-2 backdrop-blur-xs">
            <Trophy className="h-3.5 w-3.5" />
            <span>BẢNG VINH DANH HỌC VIÊN XUẤT SẮC</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Bảng Xếp Hạng LanguageCert B1
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-amber-100 max-w-xl">
            Tích lũy điểm thi thử, duy trì chuỗi học tập (Streak) và đạt chuẩn bậc CEFR để thăng hạng trong cộng đồng.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white/10 rounded-2xl p-3 text-center min-w-[90px]">
            <span className="block text-2xl font-black">#4</span>
            <span className="text-[11px] text-amber-100">Hạng của bạn</span>
          </div>
        </div>
      </div>

      {/* CEFR Scale Standards Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-lime-100 dark:bg-emerald-950/60 flex items-center justify-center text-[#3C8C02] dark:text-[#58CC02]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-800 dark:text-white">
              Thang điểm chuẩn LanguageCert B1 Achiever (50 điểm / kỹ năng)
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Quy chuẩn quốc tế của Hội đồng Khảo thí LanguageCert
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              High Pass: ≥ 38/50
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Pass: ≥ 25/50
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="text-slate-500 dark:text-slate-400">
              Fail: &lt; 25/50
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Top Học Viên Tuần Này
          </span>
          <span className="text-xs text-slate-400">Cập nhật mỗi 24h</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {topLearners.map((item) => (
            <div
              key={item.rank}
              className={`flex items-center justify-between p-4 transition-colors ${
                item.isCurrentUser
                  ? 'bg-lime-50/70 dark:bg-emerald-950/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {/* Rank & User Info */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-7 text-center">
                  {item.rank === 1 ? (
                    <span className="text-xl">🥇</span>
                  ) : item.rank === 2 ? (
                    <span className="text-xl">🥈</span>
                  ) : item.rank === 3 ? (
                    <span className="text-xl">🥉</span>
                  ) : (
                    <span className="text-xs font-black text-slate-400 dark:text-slate-500">
                      #{item.rank}
                    </span>
                  )}
                </div>

                <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                  {item.avatar ? (
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center font-bold text-slate-500">
                      {item.name[0]}
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                    <span>{item.name}</span>
                    {item.isCurrentUser && (
                      <span className="text-[10px] bg-[#58CC02] text-white font-black px-1.5 py-0.2 rounded-md">
                        Bạn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1 text-orange-500 font-bold">
                      <Flame className="h-3 w-3 fill-orange-500" />
                      {item.streak} ngày streak
                    </span>
                    <span>·</span>
                    <span>{item.xp} XP</span>
                  </div>
                </div>
              </div>

              {/* Score & CEFR Grade Badge */}
              <div className="text-right">
                <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                  {item.score}
                </div>
                <div className="mt-0.5">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      item.grade === 'High Pass'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                    }`}
                  >
                    {item.grade}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
