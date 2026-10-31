import React, { useState, useEffect } from 'react';
import { Trophy, Flame, ShieldCheck, RefreshCw, Users, Award } from 'lucide-react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  getStreakStatus,
  STREAK_UPDATED_EVENT,
  ComputedStreakStatus,
} from '../../services/streakService';
import { UserExamAttempt } from '../../types/exam';

interface LeaderboardEntry {
  uid: string;
  name: string;
  email: string;
  avatar: string;
  vstepBand10: number;
  bestRawScore: number;
  totalQuestions: number;
  levelLabel: string;
  streak: number;
  attemptsCount: number;
  isCurrentUser: boolean;
}

function computeVstepLevelLabel(score10: number): string {
  if (score10 >= 8.5) return 'Bậc 5 (C1)';
  if (score10 >= 6.0) return 'Bậc 4 (B2)';
  if (score10 >= 4.0) return 'Bậc 3 (B1)';
  if (score10 > 0) return 'Đang ôn B1';
  return 'Học viên mới';
}

export const LeaderboardView: React.FC = () => {
  const { currentUser } = useAuth();
  const [userStreak, setUserStreak] = useState<number>(() => getStreakStatus().currentStreak);
  const [learners, setLearners] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    setUserStreak(getStreakStatus().currentStreak);
    const handleStreakUpdate = (e: Event) => {
      const ce = e as CustomEvent<ComputedStreakStatus>;
      setUserStreak(ce.detail ? ce.detail.currentStreak : getStreakStatus().currentStreak);
    };
    window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const usersCol = collection(db, 'users');

    const unsub = onSnapshot(
      usersCol,
      async (snapshot) => {
        try {
          const rawUsers: Array<Record<string, any> & { id: string }> = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Record<string, any>),
          }));

          const entries: LeaderboardEntry[] = await Promise.all(
            rawUsers.map(async (u) => {
              const uid = u.uid || u.id;
              let bestBand10 = 0;
              let bestRaw = 0;
              let totalQs = 75;
              let attemptsCount = 0;

              try {
                const attSnap = await getDocs(collection(db, `users/${uid}/attempts`));
                attemptsCount = attSnap.size;
                attSnap.forEach((docSnap) => {
                  const att = docSnap.data() as UserExamAttempt;
                  const raw = Number(att.score) || 0;
                  const tot = Number(att.totalQuestions) || 75;
                  const band =
                    typeof att.vstepBandScore === 'number' && att.vstepBandScore > 0
                      ? att.vstepBandScore
                      : Math.round(((raw / Math.max(1, tot)) * 10) * 2) / 2;

                  if (band > bestBand10 || (band === bestBand10 && raw > bestRaw)) {
                    bestBand10 = band;
                    bestRaw = raw;
                    totalQs = tot;
                  }
                });
              } catch {
                // fallback if subcollection read fails
              }

              const isMe = !!(currentUser && currentUser.uid === uid);
              const streakVal = isMe
                ? Math.max(Number(u.currentStreak) || 0, userStreak)
                : Number(u.currentStreak) || 0;

              return {
                uid,
                name:
                  u.displayName ||
                  (u.email ? String(u.email).split('@')[0] : 'Học viên VSTEP'),
                email: u.email || '',
                avatar: u.photoURL || '',
                vstepBand10: bestBand10,
                bestRawScore: bestRaw,
                totalQuestions: totalQs,
                levelLabel: computeVstepLevelLabel(bestBand10),
                streak: streakVal,
                attemptsCount,
                isCurrentUser: isMe,
              };
            })
          );

          // Sort by highest VSTEP Band Score (10-point scale), then attemptsCount, then streak
          entries.sort((a, b) => {
            if (b.vstepBand10 !== a.vstepBand10) return b.vstepBand10 - a.vstepBand10;
            if (b.bestRawScore !== a.bestRawScore) return b.bestRawScore - a.bestRawScore;
            if (b.attemptsCount !== a.attemptsCount) return b.attemptsCount - a.attemptsCount;
            return b.streak - a.streak;
          });

          setLearners(entries);
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser, userStreak]);

  const myRankIndex = learners.findIndex((l) => l.isCurrentUser);
  const myRankDisplay = myRankIndex >= 0 ? `#${myRankIndex + 1}` : '—';

  return (
    <div className="space-y-6 pb-20">
      {/* Top Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white font-black text-xs mb-2 backdrop-blur-xs">
            <Trophy className="h-3.5 w-3.5" />
            <span>BẢNG VINH DANH HỌC VIÊN THẬT TRÊN HỆ THỐNG CLOUD FIRESTORE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Bảng Xếp Hạng VSTEP B1–B2–C1 (Thang Điểm 10)
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-amber-100 max-w-xl">
            Xếp hạng trực tiếp dựa trên kết quả làm đề thi 4 kỹ năng (Nghe · Đọc · Viết · Nói) và chuỗi ngày học tập (Streak) của các học viên đã đăng nhập hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/15 rounded-2xl px-4 py-3 text-center min-w-[100px] border border-white/20">
            <span className="block text-2xl font-black">{myRankDisplay}</span>
            <span className="text-[11px] text-amber-100 font-bold">Hạng của bạn</span>
          </div>
          <div className="bg-white/15 rounded-2xl px-4 py-3 text-center min-w-[100px] border border-white/20">
            <span className="block text-2xl font-black">{learners.length}</span>
            <span className="text-[11px] text-amber-100 font-bold">Tổng học viên</span>
          </div>
        </div>
      </div>

      {/* VSTEP Scale Standards Card */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-lime-100 dark:bg-emerald-950/60 flex items-center justify-center text-[#3C8C02] dark:text-[#58CC02]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-800 dark:text-white">
              Thang điểm chuẩn VSTEP B1–B2–C1 Bộ GD&ĐT (Thang 10.0 điểm · Làm tròn 0.5)
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              Trung bình cộng 4 kỹ năng: Listening · Reading · Writing · Speaking
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Bậc 5 (C1): 8.5 – 10.0
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Bậc 4 (B2): 6.0 – 8.0
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Bậc 3 (B1): 4.0 – 5.5
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Users className="h-4 w-4 text-amber-500" />
            <span>Danh Sách Học Viên Thực Tế ({learners.length} học viên)</span>
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            ● Đồng bộ Real-time từ Cloud Firestore
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs font-bold text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
            <span>Đang tải dữ liệu học viên và điểm thi thật từ Firestore...</span>
          </div>
        ) : learners.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Award className="h-10 w-10 text-slate-300 mx-auto" />
            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
              Chưa có học viên nào được ghi nhận trên bảng xếp hạng
            </p>
            <p className="text-xs text-slate-500">
              Hãy đăng nhập và hoàn thành bài thi thử VSTEP đầu tiên để xuất hiện trên bảng vinh danh!
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {learners.map((item, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={item.uid}
                  className={`flex items-center justify-between p-4 transition-colors ${
                    item.isCurrentUser
                      ? 'bg-lime-50/70 dark:bg-emerald-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {/* Rank & User Info */}
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-7 text-center">
                      {rank === 1 ? (
                        <span className="text-xl">🥇</span>
                      ) : rank === 2 ? (
                        <span className="text-xl">🥈</span>
                      ) : rank === 3 ? (
                        <span className="text-xl">🥉</span>
                      ) : (
                        <span className="text-xs font-black text-slate-400 dark:text-slate-500">
                          #{rank}
                        </span>
                      )}
                    </div>

                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white shrink-0 flex items-center justify-center font-black text-sm">
                      {item.avatar ? (
                        <img
                          src={item.avatar}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{(item.name || 'H')[0].toUpperCase()}</span>
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.isCurrentUser && (
                          <span className="text-[10px] bg-[#58CC02] text-white font-black px-1.5 py-0.5 rounded-md">
                            Bạn
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1 text-orange-500 font-bold">
                          <Flame className="h-3 w-3 fill-orange-500" />
                          {item.streak} ngày streak
                        </span>
                        <span>·</span>
                        <span>Đã thi {item.attemptsCount} lượt</span>
                      </div>
                    </div>
                  </div>

                  {/* Score & VSTEP Level Badge */}
                  <div className="text-right">
                    <div className="font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                      {item.vstepBand10 > 0
                        ? `${item.vstepBand10.toFixed(1)} / 10.0`
                        : 'Chưa có điểm thi'}
                    </div>
                    <div className="mt-0.5 flex items-center justify-end gap-1.5">
                      {item.bestRawScore > 0 && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({item.bestRawScore}/{item.totalQuestions} câu)
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          item.vstepBand10 >= 8.5
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                            : item.vstepBand10 >= 6.0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : item.vstepBand10 >= 4.0
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {item.levelLabel}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
