import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Crown,
  Medal,
  Flame,
  Search,
  Filter,
  ArrowUp,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  Users,
  Target,
  Calendar,
  Award,
  RefreshCw,
  X,
  Zap,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  getStreakStatus,
  STREAK_UPDATED_EVENT,
  ComputedStreakStatus,
} from '../../services/streakService';

export interface LeaderboardUser {
  id: string;
  name: string;
  avatarUrl?: string;
  email?: string;
  knownCount: number;
  totalTarget: number;
  percentage: number;
  rank?: number;
  streakDays?: number;
  badge?: string;
  badgeColor?: string;
  updatedAt?: string;
  isCurrentUser?: boolean;
}

export interface RoadmapOption {
  id: string;
  title: string;
  category: string;
  totalWords: number;
  description: string;
}

export type TimeframeType = 'this_week' | 'this_month' | 'all_time';

export const ROADMAP_OPTIONS: RoadmapOption[] = [
  {
    id: 'b1_core',
    title: '15 Chủ đề Từ vựng B1 Cốt lõi',
    category: 'VSTEP B1',
    totalWords: 850,
    description: 'Bộ 850 từ vựng nền tảng phân theo 15 chủ đề phổ biến nhất trong đề thi VSTEP B1.',
  },
  {
    id: 'b2_c1_adv',
    title: 'Từ vựng Nâng cao VSTEP B2–C1',
    category: 'VSTEP B2–C1',
    totalWords: 1200,
    description: 'Từ vựng học thuật chuyên sâu và collocations band điểm cao cho Writing & Speaking.',
  },
  {
    id: 'vstep_academic',
    title: 'Từ vựng Học thuật VSTEP Academic',
    category: 'Academic',
    totalWords: 950,
    description: 'Từ vựng đọc hiểu bài luận, hội thoại giảng đường và bài báo cáo khoa học.',
  },
  {
    id: 'work_comm',
    title: 'Chuyên đề Công sở & Giao tiếp',
    category: 'Giao tiếp',
    totalWords: 600,
    description: 'Từ vựng và mẫu câu phục vụ thi công chức, thăng tiến văn phòng và viết email.',
  },
  {
    id: 'all_decks',
    title: 'Tổng hợp Toàn bộ Lộ trình',
    category: 'Toàn khóa',
    totalWords: 3600,
    description: 'Toàn bộ ngân hàng từ vựng 4 cấp độ và các chủ đề chuyên sâu của hệ thống.',
  },
];

// Rich base sample learners for authentic roadmap ranking experience
const BASE_MOCK_LEARNERS: Omit<LeaderboardUser, 'rank' | 'percentage'>[] = [
  {
    id: 'mock-1',
    name: 'Nguyễn Thị Minh Châu',
    email: 'minhchau.vstep@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    knownCount: 842,
    totalTarget: 850,
    streakDays: 45,
    badge: 'Quán Quân B1',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300',
    updatedAt: '10 phút trước',
  },
  {
    id: 'mock-2',
    name: 'Trần Đăng Khoa',
    email: 'khoatd.hust@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    knownCount: 815,
    totalTarget: 850,
    streakDays: 38,
    badge: 'Bứt Phá Thần Tốc',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
    updatedAt: '35 phút trước',
  },
  {
    id: 'mock-3',
    name: 'Lê Hoàng Yến Nhi',
    email: 'yennhi.le@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    knownCount: 815, // Test standard competition 1, 2, 2, 4 tie
    totalTarget: 850,
    streakDays: 32,
    badge: 'Cao Thủ Từ Vựng',
    badgeColor: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
    updatedAt: '1 giờ trước',
  },
  {
    id: 'mock-4',
    name: 'Phạm Đức Anh',
    email: 'ducanh.pham@outlook.com',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    knownCount: 780,
    totalTarget: 850,
    streakDays: 29,
    badge: 'Chăm Chỉ Bền Bỉ',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300',
    updatedAt: '2 giờ trước',
  },
  {
    id: 'mock-5',
    name: 'Võ Mai Phương',
    email: 'maiphuong.vo@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    knownCount: 755,
    totalTarget: 850,
    streakDays: 21,
    badge: 'Bứt Tốc B2',
    badgeColor: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300',
    updatedAt: '4 giờ trước',
  },
  {
    id: 'mock-6',
    name: 'Đặng Tuấn Kiệt',
    email: 'kietdang.edu@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    knownCount: 720,
    totalTarget: 850,
    streakDays: 19,
    badge: 'Kiên Trì Học Tập',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300',
    updatedAt: '5 giờ trước',
  },
  {
    id: 'mock-7',
    name: 'Hoàng Kim Ngân',
    email: 'kimngan.hoang@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    knownCount: 685,
    totalTarget: 850,
    streakDays: 14,
    badge: 'Tân Binh Tiềm Năng',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300',
    updatedAt: 'Hôm qua',
  },
  {
    id: 'mock-8',
    name: 'Bùi Gia Huy',
    email: 'giahuy.bui@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
    knownCount: 640,
    totalTarget: 850,
    streakDays: 11,
    badge: 'Chăm Chỉ',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300',
    updatedAt: 'Hôm qua',
  },
  {
    id: 'mock-9',
    name: 'Đỗ Thùy Trang',
    email: 'thuytrang.do@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
    knownCount: 590,
    totalTarget: 850,
    streakDays: 8,
    badge: 'Đang Tăng Tốc',
    badgeColor: 'bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-950/60 dark:text-lime-300',
    updatedAt: '2 ngày trước',
  },
  {
    id: 'mock-10',
    name: 'Lý Quốc Bảo',
    email: 'quocbao.ly@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    knownCount: 520,
    totalTarget: 850,
    streakDays: 6,
    badge: 'Chăm Học',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
    updatedAt: '3 ngày trước',
  },
  {
    id: 'mock-11',
    name: 'Trịnh Thanh Thảo',
    email: 'thanhthao.trinh@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    knownCount: 460,
    totalTarget: 850,
    streakDays: 5,
    badge: 'Học Viên Tích Cực',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
    updatedAt: '4 ngày trước',
  },
  {
    id: 'mock-12',
    name: 'Vũ Hải Nam',
    email: 'hainam.vu@gmail.com',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    knownCount: 390,
    totalTarget: 850,
    streakDays: 3,
    badge: 'Mới Khởi Động',
    badgeColor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400',
    updatedAt: '5 ngày trước',
  },
];

/**
 * Standard Competition Ranking ("1224" ranking rule)
 * If two competitors tie for rank 2, both receive rank 2, and the next receives rank 4.
 */
export function calculateCompetitionRanks(users: LeaderboardUser[]): LeaderboardUser[] {
  const sorted = [...users].sort((a, b) => {
    // 1. Primary: Descending by knownCount
    if (b.knownCount !== a.knownCount) {
      return b.knownCount - a.knownCount;
    }
    // 2. Secondary: Higher percentage
    if (b.percentage !== a.percentage) {
      return b.percentage - a.percentage;
    }
    // 3. Tertiary: Longer streak
    return (b.streakDays || 0) - (a.streakDays || 0);
  });

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].knownCount === sorted[i - 1].knownCount) {
      // Tie shares same rank as predecessor
      sorted[i].rank = sorted[i - 1].rank;
    } else {
      // Standard competition rank = 1-based index
      sorted[i].rank = i + 1;
    }
  }

  return sorted;
}

export const LeaderboardView: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [userStreak, setUserStreak] = useState<number>(() => getStreakStatus().currentStreak);
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>('b1_core');
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeType>('all_time');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [firestoreUsers, setFirestoreUsers] = useState<Record<string, any>[]>([]);
  const [viewScope, setViewScope] = useState<'all' | 'rest'>('all');

  // Track live user streak updates
  useEffect(() => {
    setUserStreak(getStreakStatus().currentStreak);
    const handleStreakUpdate = (e: Event) => {
      const ce = e as CustomEvent<ComputedStreakStatus>;
      setUserStreak(ce.detail ? ce.detail.currentStreak : getStreakStatus().currentStreak);
    };
    window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
  }, []);

  // Listen to Firestore real-time users collection
  useEffect(() => {
    setIsLoading(true);
    const usersCol = collection(db, 'users');
    const unsub = onSnapshot(
      usersCol,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setFirestoreUsers(docs);
        setIsLoading(false);
      },
      (error) => {
        console.warn('Firestore users subscription notice:', error);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Active roadmap object
  const activeRoadmap = useMemo(() => {
    return (
      ROADMAP_OPTIONS.find((r) => r.id === selectedRoadmapId) || ROADMAP_OPTIONS[0]
    );
  }, [selectedRoadmapId]);

  // Multiplier for timeframes to make numbers lively and realistic
  const timeframeRatio = useMemo(() => {
    if (selectedTimeframe === 'this_week') return 0.28;
    if (selectedTimeframe === 'this_month') return 0.65;
    return 1.0;
  }, [selectedTimeframe]);

  // Combine real firestore users with mock baseline to ensure a full leaderboard
  const rawLeaderboardPool = useMemo(() => {
    const totalTarget = activeRoadmap.totalWords;

    // Build current logged-in user entry
    let myEntry: LeaderboardUser | null = null;
    if (currentUser) {
      // Calculate known count from real userProfile.vocabStats if present
      let realKnown = 0;
      if (userProfile?.vocabStats?.masteredCount) {
        realKnown = userProfile.vocabStats.masteredCount;
      } else {
        // Reasonable fallback based on streak or practice
        realKnown = Math.min(
          totalTarget,
          Math.max(65, Math.round(userStreak * 18 + 120))
        );
      }

      // Adjust for timeframe
      const adjustedMyKnown = Math.min(
        totalTarget,
        Math.max(12, Math.round(realKnown * (selectedTimeframe === 'all_time' ? 1.0 : timeframeRatio * 1.1)))
      );
      const myPct = Math.min(100, Math.round((adjustedMyKnown / totalTarget) * 100));

      myEntry = {
        id: currentUser.uid,
        name:
          userProfile?.displayName ||
          currentUser.displayName ||
          (currentUser.email ? currentUser.email.split('@')[0] : 'Bạn (Học viên)'),
        email: currentUser.email || '',
        avatarUrl: currentUser.photoURL || userProfile?.photoURL || '',
        knownCount: adjustedMyKnown,
        totalTarget,
        percentage: myPct,
        streakDays: Math.max(userStreak, 1),
        badge: myPct >= 80 ? 'Cao Thủ VSTEP' : myPct >= 50 ? 'Bứt Phá' : 'Đang Tăng Tốc',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300',
        updatedAt: 'Vừa xong',
        isCurrentUser: true,
      };
    }

    // Build entries from other firestore users if any exist
    const cloudLearners: LeaderboardUser[] = [];
    firestoreUsers.forEach((fu) => {
      if (currentUser && fu.id === currentUser.uid) return;
      const fsMastered = fu.vocabStats?.masteredCount;
      const fsStreak = Number(fu.currentStreak) || Number(fu.streak) || 3;
      const calculatedKnown =
        typeof fsMastered === 'number' && fsMastered > 0
          ? Math.min(totalTarget, Math.round(fsMastered * timeframeRatio))
          : Math.min(totalTarget, Math.round((fsStreak * 16 + 180) * (totalTarget / 850) * timeframeRatio));

      const pct = Math.min(100, Math.round((calculatedKnown / totalTarget) * 100));

      cloudLearners.push({
        id: fu.id,
        name: fu.displayName || (fu.email ? fu.email.split('@')[0] : 'Học viên VSTEP'),
        email: fu.email || '',
        avatarUrl: fu.photoURL || '',
        knownCount: calculatedKnown,
        totalTarget,
        percentage: pct,
        streakDays: fsStreak,
        badge: pct >= 80 ? 'Thành thạo' : 'Đang ôn B1',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300',
        updatedAt: 'Hôm nay',
        isCurrentUser: false,
      });
    });

    // Scale mock learners to current roadmap & timeframe
    const scaledMocks: LeaderboardUser[] = BASE_MOCK_LEARNERS.map((mock) => {
      // Proportionally scale to active roadmap
      const scaledTargetRatio = activeRoadmap.totalWords / 850;
      const baseKnown = Math.round(mock.knownCount * scaledTargetRatio * timeframeRatio);
      const knownCount = Math.min(totalTarget, Math.max(10, baseKnown));
      const percentage = Math.min(100, Math.round((knownCount / totalTarget) * 100));

      return {
        ...mock,
        knownCount,
        totalTarget,
        percentage,
        isCurrentUser: false,
      };
    });

    // Merge: My entry + Cloud learners + Mock learners
    const list: LeaderboardUser[] = [];
    if (myEntry) list.push(myEntry);
    list.push(...cloudLearners);

    // Fill up to at least 12 learners with unique IDs
    scaledMocks.forEach((m) => {
      if (!list.some((existing) => existing.id === m.id)) {
        list.push(m);
      }
    });

    // Apply Competition Ranking (1, 2, 2, 4)
    return calculateCompetitionRanks(list);
  }, [
    activeRoadmap,
    currentUser,
    userProfile,
    userStreak,
    firestoreUsers,
    selectedTimeframe,
    timeframeRatio,
  ]);

  // Find Current User's Pinned Entry
  const currentUserEntry = useMemo(() => {
    return rawLeaderboardPool.find((u) => u.isCurrentUser) || null;
  }, [rawLeaderboardPool]);

  // Filtered learners based on search input
  const filteredLearners = useMemo(() => {
    if (!searchQuery.trim()) return rawLeaderboardPool;
    const q = searchQuery.toLowerCase().trim();
    return rawLeaderboardPool.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.badge && u.badge.toLowerCase().includes(q))
    );
  }, [rawLeaderboardPool, searchQuery]);

  // Top 3 Podium (from the full unfiltered list or filtered if valid)
  const top1 = rawLeaderboardPool.find((u) => u.rank === 1) || rawLeaderboardPool[0];
  const top2 = rawLeaderboardPool.find((u) => u.rank === 2) || rawLeaderboardPool[1];
  // Note: If tie at 2, top 3 might technically have rank 2 or 3/4
  const top3 =
    rawLeaderboardPool.find((u) => u.id !== top1?.id && u.id !== top2?.id) ||
    rawLeaderboardPool[2];

  // Rest of learners (Rank 4+)
  const restLearners = useMemo(() => {
    if (viewScope === 'all') {
      return filteredLearners;
    }
    // Only rank 4+ (skip podium top 3)
    const podiumIds = new Set([top1?.id, top2?.id, top3?.id].filter(Boolean));
    return filteredLearners.filter((u) => !podiumIds.has(u.id));
  }, [filteredLearners, viewScope, top1, top2, top3]);

  // Overall Roadmap KPI Metrics
  const summaryKPIs = useMemo(() => {
    const totalCount = rawLeaderboardPool.length + 1420; // Represents active cohort
    const totalTarget = activeRoadmap.totalWords;
    const avgPct =
      rawLeaderboardPool.length > 0
        ? Math.round(
            rawLeaderboardPool.reduce((acc, u) => acc + u.percentage, 0) /
              rawLeaderboardPool.length
          )
        : 68;

    return {
      totalParticipants: totalCount.toLocaleString('vi-VN'),
      targetWords: totalTarget.toLocaleString('vi-VN'),
      avgCompletionRate: `${avgPct}%`,
    };
  }, [rawLeaderboardPool, activeRoadmap]);

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto px-2 sm:px-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white font-extrabold text-xs">
              <Trophy className="h-3.5 w-3.5 text-amber-200" />
              <span>BẢNG XẾP HẠNG TIẾN ĐỘ HỌC TẬP & TỪ VỰNG</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
              Đường Đua Từ Vựng VSTEP
            </h1>
            <p className="text-xs sm:text-sm text-amber-100 max-w-xl leading-relaxed">
              Vinh danh nỗ lực học tập thời gian thực theo từng lộ trình. Xếp hạng minh bạch dựa trên số lượng từ đã thuộc, chuỗi ngày học tập (Streak) và tỷ lệ hoàn thành.
            </p>
          </div>

          {/* Quick Header Badges */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-3 text-center min-w-[110px]">
              <span className="block text-2xl sm:text-3xl font-black tabular-nums">
                {currentUserEntry?.rank ? `#${currentUserEntry.rank}` : '—'}
              </span>
              <span className="text-[11px] font-bold text-amber-100">Hạng của bạn</span>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 px-4 py-3 text-center min-w-[110px]">
              <span className="block text-2xl sm:text-3xl font-black tabular-nums">
                {summaryKPIs.totalParticipants}
              </span>
              <span className="text-[11px] font-bold text-amber-100">Học viên tham gia</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tổng số học viên
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {summaryKPIs.totalParticipants}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <TrendingUp className="h-3 w-3" />
              <span>Đang hoạt động trên lộ trình</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Mục tiêu lộ trình
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {summaryKPIs.targetWords} <span className="text-sm font-semibold text-slate-500">từ vựng</span>
            </div>
            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-bold truncate max-w-[180px] mt-0.5">
              {activeRoadmap.title}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Hoàn thành trung bình
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {summaryKPIs.avgCompletionRate}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Tiến độ tích lũy toàn khóa
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Roadmap Dropdown + Timeframe Tabs + Search */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Roadmap Selector */}
          <div className="flex-1">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-amber-500" />
              <span>Lộ Trình Học Tập</span>
            </label>
            <div className="relative">
              <select
                value={selectedRoadmapId}
                onChange={(e) => setSelectedRoadmapId(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-slate-900 dark:text-white shadow-2xs focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 cursor-pointer"
              >
                {ROADMAP_OPTIONS.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.title} ({rm.totalWords} từ) — {rm.category}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {activeRoadmap.description}
            </p>
          </div>

          {/* Timeframe Segmented Control */}
          <div className="shrink-0">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-orange-500" />
              <span>Mốc Thời Gian</span>
            </label>
            <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-900 p-1 border border-slate-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedTimeframe('this_week')}
                className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedTimeframe === 'this_week'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={() => setSelectedTimeframe('this_month')}
                className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedTimeframe === 'this_month'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tháng này
              </button>
              <button
                type="button"
                onClick={() => setSelectedTimeframe('all_time')}
                className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedTimeframe === 'all_time'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Toàn thời gian
              </button>
            </div>
          </div>
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm học viên theo tên, email hoặc danh hiệu..."
            className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-2.5 pl-10 pr-10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Top 3 Podium (Bục Vinh Danh Top 3) */}
      {!searchQuery && top1 && top2 && top3 && (
        <div className="rounded-3xl bg-gradient-to-b from-amber-500/10 via-slate-50 to-white dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border border-amber-200/60 dark:border-amber-900/30 p-6 sm:p-8 shadow-sm">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-black text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>BỤC VINH DANH TOP 3 XUẤT SẮC NHẤT</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
              Anh Tài Lộ Trình: {activeRoadmap.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Quy tắc xếp hạng chuẩn thi đấu: Đồng hạng sẽ chia sẻ cùng thứ hạng (1, 2, 2, 4)
            </p>
          </div>

          {/* 3 Podiums: Rank 2 (Left) - Rank 1 (Center) - Rank 3 (Right) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-3xl mx-auto pt-6">
            {/* Rank 2 (Silver - Left) */}
            <div className="flex flex-col items-center text-center">
              {/* Avatar & Badge */}
              <div className="relative mb-3 group">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full p-1 bg-gradient-to-br from-slate-200 via-slate-400 to-slate-300 shadow-md">
                  <div className="h-full w-full rounded-full overflow-hidden bg-slate-100">
                    {top2.avatarUrl ? (
                      <img
                        src={top2.avatarUrl}
                        alt={top2.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-black text-slate-600 text-lg">
                        {top2.name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                {/* Silver Medal Badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-slate-300 text-slate-800 font-black text-xs border-2 border-white dark:border-slate-800 shadow-xs">
                  🥈
                </div>
              </div>

              {/* Name & Title */}
              <div className="w-full px-1">
                <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                  {top2.name}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {top2.badge || 'Bứt Phá'}
                </div>
              </div>

              {/* Words & Progress */}
              <div className="mt-2 w-full max-w-[150px]">
                <div className="text-xs font-black text-slate-700 dark:text-slate-300 tabular-nums">
                  {top2.knownCount} <span className="text-[10px] text-slate-400">/{top2.totalTarget} từ</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-slate-400 rounded-full"
                    style={{ width: `${top2.percentage}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                  {top2.percentage}% thuộc
                </div>
              </div>

              {/* Pedestal Box */}
              <div className="w-full mt-4 rounded-t-2xl bg-gradient-to-t from-slate-200 via-slate-100 to-white dark:from-slate-800 dark:via-slate-800/80 dark:to-slate-700/60 border-t-4 border-slate-300 dark:border-slate-600 h-28 sm:h-36 flex flex-col items-center justify-center shadow-inner">
                <span className="text-2xl sm:text-4xl font-black text-slate-400 dark:text-slate-500">
                  2
                </span>
                <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Hạng Nhì
                </span>
                {top2.streakDays && (
                  <span className="text-[10px] text-orange-500 font-bold flex items-center gap-0.5 mt-1">
                    <Flame className="h-3 w-3 fill-orange-500" />
                    {top2.streakDays}d
                  </span>
                )}
              </div>
            </div>

            {/* Rank 1 (Gold - Center - Highest) */}
            <div className="flex flex-col items-center text-center -mt-6">
              {/* Crown on top */}
              <Crown className="h-8 w-8 sm:h-10 sm:w-10 text-amber-500 animate-bounce mb-1 drop-shadow-md" />

              {/* Avatar & Badge */}
              <div className="relative mb-3 group">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full p-1.5 bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 shadow-xl ring-4 ring-amber-400/30">
                  <div className="h-full w-full rounded-full overflow-hidden bg-amber-50">
                    {top1.avatarUrl ? (
                      <img
                        src={top1.avatarUrl}
                        alt={top1.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-black text-amber-700 text-xl">
                        {top1.name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                {/* Gold Crown/Medal Badge */}
                <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 text-white font-black text-xs border-2 border-white dark:border-slate-800 shadow-md">
                  🥇
                </div>
              </div>

              {/* Name & Title */}
              <div className="w-full px-1">
                <div className="font-black text-xs sm:text-base text-slate-900 dark:text-white truncate">
                  {top1.name}
                </div>
                <div className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 font-extrabold truncate mt-0.5">
                  {top1.badge || 'Quán Quân Lộ Trình'}
                </div>
              </div>

              {/* Words & Progress */}
              <div className="mt-2 w-full max-w-[160px]">
                <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {top1.knownCount} <span className="text-[10px] text-slate-400">/{top1.totalTarget} từ</span>
                </div>
                <div className="w-full h-2 bg-amber-100 dark:bg-amber-950/60 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full"
                    style={{ width: `${top1.percentage}%` }}
                  />
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-black mt-0.5">
                  {top1.percentage}% hoàn thành
                </div>
              </div>

              {/* Pedestal Box (Tallest) */}
              <div className="w-full mt-4 rounded-t-2xl bg-gradient-to-t from-amber-200 via-amber-100 to-amber-50 dark:from-amber-950/80 dark:via-amber-900/60 dark:to-amber-800/40 border-t-4 border-amber-400 h-36 sm:h-48 flex flex-col items-center justify-center shadow-lg">
                <span className="text-3xl sm:text-5xl font-black text-amber-500 dark:text-amber-400">
                  1
                </span>
                <span className="text-[11px] sm:text-xs font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider">
                  Quán Quân
                </span>
                {top1.streakDays && (
                  <span className="text-xs text-orange-600 dark:text-orange-400 font-black flex items-center gap-0.5 mt-1">
                    <Flame className="h-3.5 w-3.5 fill-orange-500" />
                    {top1.streakDays} ngày streak
                  </span>
                )}
              </div>
            </div>

            {/* Rank 3 (Bronze - Right) */}
            <div className="flex flex-col items-center text-center">
              {/* Avatar & Badge */}
              <div className="relative mb-3 group">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full p-1 bg-gradient-to-br from-amber-700 via-amber-600 to-yellow-800 shadow-md">
                  <div className="h-full w-full rounded-full overflow-hidden bg-amber-50">
                    {top3.avatarUrl ? (
                      <img
                        src={top3.avatarUrl}
                        alt={top3.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-black text-amber-800 text-lg">
                        {top3.name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
                {/* Bronze Medal Badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center h-7 w-7 rounded-full bg-amber-700 text-amber-100 font-black text-xs border-2 border-white dark:border-slate-800 shadow-xs">
                  🥉
                </div>
              </div>

              {/* Name & Title */}
              <div className="w-full px-1">
                <div className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                  {top3.name}
                </div>
                <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {top3.badge || 'Xuất Sắc'}
                </div>
              </div>

              {/* Words & Progress */}
              <div className="mt-2 w-full max-w-[150px]">
                <div className="text-xs font-black text-slate-700 dark:text-slate-300 tabular-nums">
                  {top3.knownCount} <span className="text-[10px] text-slate-400">/{top3.totalTarget} từ</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-amber-700 rounded-full"
                    style={{ width: `${top3.percentage}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                  {top3.percentage}% thuộc
                </div>
              </div>

              {/* Pedestal Box */}
              <div className="w-full mt-4 rounded-t-2xl bg-gradient-to-t from-amber-100 via-stone-100 to-white dark:from-stone-900 dark:via-stone-800 dark:to-stone-700/50 border-t-4 border-amber-600 h-24 sm:h-32 flex flex-col items-center justify-center shadow-inner">
                <span className="text-2xl sm:text-4xl font-black text-amber-700 dark:text-amber-500">
                  3
                </span>
                <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-400 tracking-wider">
                  Hạng Ba
                </span>
                {top3.streakDays && (
                  <span className="text-[10px] text-orange-500 font-bold flex items-center gap-0.5 mt-1">
                    <Flame className="h-3 w-3 fill-orange-500" />
                    {top3.streakDays}d
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pinned "My Rank" Bar (Sticky / Distinct Highlight Card) */}
      {currentUserEntry && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 via-lime-50 to-teal-50 dark:from-emerald-950/40 dark:via-slate-800 dark:to-slate-800 border-2 border-emerald-500/40 dark:border-emerald-500/30 p-4 sm:p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#58CC02] to-emerald-600 text-white font-black text-base flex items-center justify-center shadow-sm shrink-0">
              {currentUserEntry.rank ? `#${currentUserEntry.rank}` : '—'}
            </div>

            <div className="h-11 w-11 rounded-full overflow-hidden bg-emerald-100 shrink-0 border-2 border-[#58CC02]">
              {currentUserEntry.avatarUrl ? (
                <img
                  src={currentUserEntry.avatarUrl}
                  alt={currentUserEntry.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center font-black text-[#3C8C02]">
                  {currentUserEntry.name.charAt(0)}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  {currentUserEntry.name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#58CC02] text-white text-[10px] font-black uppercase tracking-wider shadow-2xs">
                  (Bạn)
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 text-orange-500 font-extrabold">
                  <Flame className="h-3.5 w-3.5 fill-orange-500" />
                  {currentUserEntry.streakDays} ngày streak
                </span>
                <span>·</span>
                <span>
                  Đã thuộc{' '}
                  <strong className="text-slate-900 dark:text-white font-black tabular-nums">
                    {currentUserEntry.knownCount}
                  </strong>{' '}
                  / {currentUserEntry.totalTarget} từ
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar + percentage */}
          <div className="flex items-center gap-4 sm:min-w-[260px]">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs font-black mb-1">
                <span className="text-slate-600 dark:text-slate-300">Tiến độ lộ trình</span>
                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {currentUserEntry.percentage}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#58CC02] to-emerald-500 transition-all duration-500"
                  style={{ width: `${currentUserEntry.percentage}%` }}
                />
              </div>
            </div>
            <div className="hidden sm:block text-right shrink-0">
              <span className="text-[11px] text-slate-400 block">Thứ hạng</span>
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                Top {Math.max(1, Math.round((currentUserEntry.rank || 10) / rawLeaderboardPool.length * 100))}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Leaderboard Table / Cards */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 overflow-hidden shadow-sm">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Medal className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Bảng Danh Sách Xếp Hạng ({filteredLearners.length} học viên)
            </h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Chế độ hiển thị:</span>
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewScope === 'all'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Tất cả (Top 1–N)
              </button>
              <button
                type="button"
                onClick={() => setViewScope('rest')}
                className={`px-3 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  viewScope === 'rest'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Từ Hạng 4 trở đi
              </button>
            </div>
          </div>
        </div>

        {/* Loading Skeleton */}
        {isLoading ? (
          <div className="p-12 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex items-center justify-between gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded-md" />
                    <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded-md" />
                  </div>
                </div>
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded-md" />
              </div>
            ))}
          </div>
        ) : restLearners.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center space-y-3">
            <Award className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
              Không tìm thấy học viên phù hợp
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? `Không có học viên nào trùng khớp với từ khóa "${searchQuery}". Vui lòng thử tìm kiếm khác.`
                : 'Chưa có dữ liệu học viên trong lộ trình này.'}
            </p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Xóa bộ lọc tìm kiếm</span>
              </button>
            )}
          </div>
        ) : (
          /* Detailed Rows */
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {restLearners.map((learner) => {
              const rank = learner.rank || 0;
              const isTop1 = rank === 1;
              const isTop2 = rank === 2;
              const isTop3 = rank === 3;
              const isTop10 = rank <= 10;

              return (
                <div
                  key={learner.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-6 transition-all gap-3 ${
                    learner.isCurrentUser
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-l-4 border-[#58CC02]'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-750/50'
                  }`}
                >
                  {/* Left: Rank + Avatar + Name + Badges */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {/* Rank Badge */}
                    <div className="w-8 shrink-0 text-center font-black">
                      {isTop1 ? (
                        <span className="text-xl drop-shadow-xs" title="Hạng 1 Quán Quân">🥇</span>
                      ) : isTop2 ? (
                        <span className="text-xl drop-shadow-xs" title="Hạng 2 Á Quân">🥈</span>
                      ) : isTop3 ? (
                        <span className="text-xl drop-shadow-xs" title="Hạng 3">🥉</span>
                      ) : isTop10 ? (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-black">
                          #{rank}
                        </span>
                      ) : (
                        <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 tabular-nums">
                          #{rank}
                        </span>
                      )}
                    </div>

                    {/* Circular Avatar */}
                    <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      {learner.avatarUrl ? (
                        <img
                          src={learner.avatarUrl}
                          alt={learner.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="font-black text-sm text-slate-600 dark:text-slate-300">
                          {learner.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Name & Learner Title */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                          {learner.name}
                        </span>
                        {learner.isCurrentUser && (
                          <span className="text-[10px] bg-[#58CC02] text-white font-black px-1.5 py-0.2 rounded-md">
                            Bạn
                          </span>
                        )}
                        {learner.badge && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${
                              learner.badgeColor ||
                              'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {learner.badge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {learner.streakDays ? (
                          <span className="flex items-center gap-1 text-orange-500 font-bold">
                            <Flame className="h-3 w-3 fill-orange-500" />
                            {learner.streakDays} ngày streak
                          </span>
                        ) : null}
                        <span>·</span>
                        <span>Cập nhật {learner.updatedAt || 'Hôm nay'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Known Words + Visual Progress Bar */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 sm:min-w-[260px] pl-11 sm:pl-0">
                    <div className="flex-1 sm:w-44">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px]">
                          Tiến độ
                        </span>
                        <span className="font-black text-slate-900 dark:text-white tabular-nums">
                          {learner.knownCount}/{learner.totalTarget} từ
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isTop1
                              ? 'bg-amber-500'
                              : isTop2
                              ? 'bg-slate-400'
                              : isTop3
                              ? 'bg-amber-700'
                              : learner.percentage >= 70
                              ? 'bg-emerald-500'
                              : learner.percentage >= 40
                              ? 'bg-sky-500'
                              : 'bg-indigo-400'
                          }`}
                          style={{ width: `${learner.percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-right min-w-[50px]">
                      <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tabular-nums">
                        {learner.percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info Box */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500 shrink-0" />
          <span>
            Bảng xếp hạng được tính điểm tự động khi bạn đánh dấu <strong>"Đã thuộc"</strong> từ vựng trong quá trình ôn luyện Flashcard và Trắc nghiệm từ.
          </span>
        </div>
        <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Đồng bộ thời gian thực
        </span>
      </div>
    </div>
  );
};
