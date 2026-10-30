import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Phone,
  Mail,
  Calendar,
  Award,
  BookOpen,
  Headphones,
  FileText,
  PenTool,
  Mic,
  Clock,
  ChevronRight,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Sparkles,
  Lock,
  HelpCircle,
  Radio,
} from 'lucide-react';
import { collection, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth, SUPER_ADMIN_EMAILS } from '../../../context/AuthContext';
import { UserProfile, UserExamAttempt, UserTargetScores } from '../../../types/exam';
import { fetchUserAttempts } from '../../../services/examService';
import { ZodiacPixelMascot, getZodiacFromBirthDate } from '../ZodiacPixelMascot';

// Sample students for demonstration and offline preview
const MOCK_STUDENTS: UserProfile[] = [
  {
    uid: 'demo_student_1',
    displayName: 'Nguyễn Thu Trang',
    nickname: 'Trang Candy',
    email: 'thutrang.nguyen@example.com',
    phone: '0983 124 567',
    birthDate: '2001-05-14',
    address: 'Cầu Giấy, Hà Nội',
    role: 'student',
    targetScores: {
      overall: 6.5,
      listening: 6.5,
      reading: 7.0,
      writing: 6.0,
      speaking: 6.5,
      updatedAt: Date.now() - 86400000 * 2,
    },
    createdAt: Date.now() - 86400000 * 45,
  },
  {
    uid: 'demo_student_2',
    displayName: 'Trần Minh Hoàng',
    nickname: 'Hoàng Master',
    email: 'hoang.tran99@example.com',
    phone: '0912 345 678',
    birthDate: '1999-08-22',
    address: 'Quận 1, TP. Hồ Chí Minh',
    role: 'student',
    targetScores: {
      overall: 8.0,
      listening: 8.5,
      reading: 8.0,
      writing: 7.5,
      speaking: 8.0,
      updatedAt: Date.now() - 86400000 * 5,
    },
    createdAt: Date.now() - 86400000 * 60,
  },
  {
    uid: 'demo_student_3',
    displayName: 'Lê Thảo My',
    nickname: 'My Trợ Giảng',
    email: 'thaomy.ta@example.com',
    phone: '0977 888 999',
    birthDate: '2000-11-03',
    address: 'Đống Đa, Hà Nội',
    role: 'co_teacher',
    targetScores: {
      overall: 8.5,
      listening: 9.0,
      reading: 8.5,
      writing: 8.0,
      speaking: 8.5,
      updatedAt: Date.now() - 86400000 * 10,
    },
    createdAt: Date.now() - 86400000 * 90,
  },
];

interface StudentManagementViewProps {
  onOpenTest?: (testId: string) => void;
}

export const StudentManagementView: React.FC<StudentManagementViewProps> = ({ onOpenTest }) => {
  const { currentUser, userProfile, isAdmin, isSuperAdmin, isCoTeacher, canManageExams, assignUserRole } = useAuth();
  const [realStudents, setRealStudents] = useState<UserProfile[]>([]);
  const [showDemoStudents, setShowDemoStudents] = useState<boolean>(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'co_teacher' | 'admin'>('all');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentAttempts, setStudentAttempts] = useState<UserExamAttempt[]>([]);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState<boolean>(false);
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState<UserExamAttempt | null>(null);
  const [roleChangeSuccess, setRoleChangeSuccess] = useState<string | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);

  // Real-time synchronization with Cloud Firestore users collection
  useEffect(() => {
    if (!canManageExams) return;

    setIsLoading(true);
    const usersCol = collection(db, 'users');

    const unsubscribe = onSnapshot(
      usersCol,
      (snap) => {
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          const data = d.data() as UserProfile;
          list.push({ ...data, uid: d.id });
        });

        // Ensure current active admin user is present if network latency delayed sync
        if (userProfile && !list.some((u) => u.uid === userProfile.uid)) {
          list.unshift(userProfile);
        }

        const sorted = list.sort((a, b) => {
          if (a.email && SUPER_ADMIN_EMAILS.includes(a.email.toLowerCase())) return -1;
          if (b.email && SUPER_ADMIN_EMAILS.includes(b.email.toLowerCase())) return 1;
          const aTime = a.lastActiveAt || a.createdAt || 0;
          const bTime = b.lastActiveAt || b.createdAt || 0;
          return bTime - aTime;
        });

        setRealStudents(sorted);
        setIsRealtimeConnected(true);
        setIsLoading(false);
      },
      async (err) => {
        console.warn('Real-time snapshot error, fallback to getDocs:', err);
        setIsRealtimeConnected(false);
        try {
          const snap = await getDocs(usersCol);
          const list: UserProfile[] = [];
          snap.forEach((d) => {
            const data = d.data() as UserProfile;
            list.push({ ...data, uid: d.id });
          });
          if (userProfile && !list.some((u) => u.uid === userProfile.uid)) {
            list.unshift(userProfile);
          }
          setRealStudents(list);
        } catch (fetchErr) {
          console.warn('Direct fetch also failed:', fetchErr);
          if (userProfile) setRealStudents([userProfile]);
        } finally {
          setIsLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [canManageExams, userProfile]);

  // Combined student list: ONLY real Firestore students by default, plus optional demo students if toggled
  const students = useMemo(() => {
    if (!showDemoStudents) {
      return realStudents;
    }
    const mergedMap = new Map<string, UserProfile>();
    realStudents.forEach((s) => mergedMap.set(s.uid, s));
    MOCK_STUDENTS.forEach((s) => {
      if (!mergedMap.has(s.uid)) mergedMap.set(s.uid, s);
    });
    return Array.from(mergedMap.values()).sort((a, b) => {
      if (a.email && SUPER_ADMIN_EMAILS.includes(a.email.toLowerCase())) return -1;
      if (b.email && SUPER_ADMIN_EMAILS.includes(b.email.toLowerCase())) return 1;
      return (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0);
    });
  }, [realStudents, showDemoStudents]);

  // Manual refresh trigger
  const handleManualRefresh = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as UserProfile;
        list.push({ ...data, uid: d.id });
      });
      if (userProfile && !list.some((u) => u.uid === userProfile.uid)) {
        list.unshift(userProfile);
      }
      setRealStudents(list);
      setIsRealtimeConnected(true);
    } catch (err) {
      console.warn('Manual refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load exam attempts when student modal opens
  useEffect(() => {
    if (!selectedStudent) {
      setStudentAttempts([]);
      return;
    }

    let isMounted = true;
    setIsLoadingAttempts(true);

    fetchUserAttempts(selectedStudent.uid)
      .then((attempts) => {
        if (!isMounted) return;
        if (attempts.length === 0 && selectedStudent.uid.startsWith('demo_')) {
          // Provide sample mock attempts for demo students
          setStudentAttempts([
            {
              attemptId: 'mock_att_1',
              testId: 'vstep_test_1',
              testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
              mode: 'exam',
              score: 28,
              totalQuestions: 35,
              percentage: 80,
              grade: 'High Pass',
              listeningScore: 28,
              readingScore: 32,
              timeSpentSeconds: 2150,
              completedAt: Date.now() - 86400000 * 2,
              answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'A', 5: 'D' },
            },
            {
              attemptId: 'mock_att_2',
              testId: 'vstep_test_1',
              testTitle: 'VSTEP B1-B2-C1 — Bài thi mẫu — Test 1',
              mode: 'practice',
              score: 24,
              totalQuestions: 35,
              percentage: 68,
              grade: 'Pass',
              listeningScore: 24,
              readingScore: 26,
              timeSpentSeconds: 1840,
              completedAt: Date.now() - 86400000 * 6,
              answers: { 1: 'A', 2: 'C', 3: 'C', 4: 'B' },
            },
          ]);
        } else {
          setStudentAttempts(attempts);
        }
      })
      .catch((err) => {
        console.error('Lỗi tải lịch sử thi của học viên:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingAttempts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStudent]);

  // Role Assignment Handler
  const handleRoleChange = async (targetUid: string, newRole: 'student' | 'co_teacher' | 'admin') => {
    setRoleChangeSuccess(null);
    setRoleChangeError(null);
    try {
      await assignUserRole(targetUid, newRole);
      setRealStudents((prev) =>
        prev.map((s) => (s.uid === targetUid ? { ...s, role: newRole } : s))
      );
      if (selectedStudent && selectedStudent.uid === targetUid) {
        setSelectedStudent((prev) => (prev ? { ...prev, role: newRole } : null));
      }
      setRoleChangeSuccess(`Đã cập nhật vai trò thành: ${newRole === 'admin' ? 'Giáo viên/Admin' : newRole === 'co_teacher' ? 'Trợ giảng' : 'Học viên'}`);
      setTimeout(() => setRoleChangeSuccess(null), 3500);
    } catch (err: any) {
      setRoleChangeError(err?.message || 'Có lỗi khi phân quyền người dùng.');
      setTimeout(() => setRoleChangeError(null), 4000);
    }
  };

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const name = (s.displayName || '').toLowerCase();
      const nickname = (s.nickname || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      return (
        name.includes(term) ||
        nickname.includes(term) ||
        email.includes(term) ||
        phone.includes(term)
      );
    });
  }, [students, roleFilter, searchTerm]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = students.length;
    const withGoals = students.filter(
      (s) => s.targetScores && typeof s.targetScores.overall === 'number'
    ).length;
    const staff = students.filter((s) => s.role === 'admin' || s.role === 'co_teacher').length;
    const studentsOnly = students.filter((s) => s.role === 'student').length;
    return { total, withGoals, staff, studentsOnly };
  }, [students]);

  const getVstepBandLevel = (score: number) => {
    if (score >= 8.5) return 'Bậc 5 (C1)';
    if (score >= 6.0) return 'Bậc 4 (B2)';
    if (score >= 4.0) return 'Bậc 3 (B1)';
    return 'Dưới chuẩn B1';
  };

  const getRoleBadge = (role: string, email?: string) => {
    const isSuper = email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
    if (isSuper) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
          <ShieldCheck className="h-3 w-3" />
          <span>Super Admin</span>
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
          <GraduationCap className="h-3 w-3" />
          <span>Giáo viên</span>
        </span>
      );
    }
    if (role === 'co_teacher') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
          <Award className="h-3 w-3" />
          <span>Trợ giảng</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
        <UserCheck className="h-3 w-3" />
        <span>Học viên</span>
      </span>
    );
  };

  if (!canManageExams) {
    return (
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-8 text-center border-2 border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto my-12">
        <div className="h-16 w-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
          Khu vực bảo mật Giáo viên &amp; Admin
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
          Trang Quản lý học viên chỉ dành riêng cho Giảng viên (Mr.Harry) và Ban trợ giảng được phân quyền. Vui lòng đăng nhập bằng tài khoản quản trị để truy cập.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#58CC02] to-[#3C8C02] p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wider">
              <Users className="h-3.5 w-3.5" />
              <span>Hệ Thống Quản Lý Học Viên VSTEP</span>
            </div>

            {/* Live Firestore WebSocket status */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/25 text-white text-xs font-bold backdrop-blur-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${isRealtimeConnected ? 'bg-lime-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>
                {isRealtimeConnected
                  ? `Live Firestore: ${realStudents.length} học viên thật`
                  : 'Đang kết nối Firestore...'}
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Quản Lý Hồ Sơ &amp; Tiến Trình Học Tập
          </h1>
          <p className="text-xs sm:text-sm text-lime-100 font-semibold mt-1 max-w-2xl">
            Theo dõi chi tiết thông tin cá nhân, mục tiêu điểm số 4 kỹ năng VSTEP (Listening, Reading, Writing, Speaking), và xem lại toàn bộ bài thi đã nộp của từng học viên.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDiagnosticModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs backdrop-blur-xs transition-all cursor-pointer border border-white/20"
            title="Xem hướng dẫn kết nối học viên từ trang web Vercel"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Kết nối Vercel</span>
          </button>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white text-[#3C8C02] hover:bg-lime-50 font-black text-xs shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng tài khoản</span>
            <Users className="h-4 w-4 text-[#58CC02]" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.total}
          </div>
          <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block">
            {realStudents.length} tài khoản thực từ Firestore
          </span>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Đã đặt mục tiêu</span>
            <Award className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.withGoals}
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            Thang điểm 10 VSTEP
          </span>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Đội ngũ giảng dạy</span>
            <GraduationCap className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {stats.staff}
          </div>
          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 mt-0.5 block">
            Giáo viên &amp; Trợ giảng
          </span>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tiêu chuẩn quy chiếu</span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-sm font-black text-slate-900 dark:text-white mt-2">
            B1 ≥ 4.0 · B2 ≥ 6.0
          </div>
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-0.5 block">
            C1 ≥ 8.5 (Bộ GD&amp;ĐT)
          </span>
        </div>
      </div>

      {/* Notification Toast */}
      {roleChangeSuccess && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 p-3.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{roleChangeSuccess}</span>
        </div>
      )}
      {roleChangeError && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 p-3.5 text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{roleChangeError}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo họ tên, email, biệt danh, hoặc số điện thoại..."
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 px-1 shrink-0">
              <Filter className="h-3 w-3" />
              <span>Lọc:</span>
            </span>
            {(['all', 'student', 'co_teacher', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  roleFilter === r
                    ? 'bg-[#58CC02] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {r === 'all'
                  ? 'Tất cả'
                  : r === 'student'
                  ? 'Học viên'
                  : r === 'co_teacher'
                  ? 'Trợ giảng'
                  : 'Giáo viên'}
              </button>
            ))}
          </div>
        </div>

        {/* Real Data vs Demo Toggle Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-semibold">
            <Radio className="h-3.5 w-3.5 text-[#58CC02] animate-pulse" />
            <span>
              Chế độ hiển thị: <strong>{showDemoStudents ? 'Tài khoản thật + 3 hồ sơ mẫu' : '100% Học viên thật từ Cloud Firestore'}</strong>
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-bold px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={showDemoStudents}
              onChange={(e) => setShowDemoStudents(e.target.checked)}
              className="rounded text-[#58CC02] focus:ring-[#58CC02] h-3.5 w-3.5 cursor-pointer"
            />
            <span>Bật xem thêm 3 tài khoản mẫu (Demo)</span>
          </label>
        </div>
      </div>

      {/* Student List Grid */}
      {isLoading ? (
        <div className="py-16 text-center">
          <RefreshCw className="h-8 w-8 text-[#58CC02] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">Đang đồng bộ danh sách học viên...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-8 sm:p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
          <div className="h-16 w-16 rounded-2xl bg-lime-50 dark:bg-lime-950/60 text-[#58CC02] flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Users className="h-8 w-8" />
          </div>
          <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">
            {realStudents.length === 0
              ? 'Chưa có tài khoản học viên nào được đồng bộ từ Firestore'
              : 'Không tìm thấy học viên phù hợp với bộ lọc'}
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed mb-5">
            {realStudents.length === 0
              ? 'Khi học viên đăng nhập (qua Google hoặc Email) trên web Vercel (https://vsteppro.vercel.app), Firestore sẽ tự động ghi nhận hồ sơ và hiển thị trực tiếp tại đây ngay lập tức theo thời gian thực.'
              : 'Hãy thử tìm kiếm với từ khóa khác hoặc chuyển bộ lọc sang mục "Tất cả".'}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowDiagnosticModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#58CC02] text-white text-xs font-black shadow-xs hover:bg-[#46a302] cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Xem hướng dẫn kết nối Vercel &amp; Firebase</span>
            </button>
            {!showDemoStudents && (
              <button
                type="button"
                onClick={() => setShowDemoStudents(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Xem 3 tài khoản mẫu demo</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudents.map((st) => {
            const zodiac = st.birthDate ? getZodiacFromBirthDate(st.birthDate) : null;
            const goals = st.targetScores;
            const isMe = currentUser?.uid === st.uid;
            const isDemo = st.uid.startsWith('demo_');

            return (
              <div
                key={st.uid}
                className={`rounded-3xl bg-white dark:bg-slate-900 border p-5 shadow-xs transition-all flex flex-col justify-between ${
                  isDemo
                    ? 'border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200/90 dark:border-slate-800 hover:border-[#58CC02] dark:hover:border-[#58CC02]'
                }`}
              >
                <div>
                  {/* Top: Avatar/Zodiac + Name + Role */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {st.photoURL ? (
                          <img
                            src={st.photoURL}
                            alt={st.displayName || 'Avatar'}
                            className="h-12 w-12 rounded-2xl object-cover shadow-xs border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#58CC02] to-emerald-400 text-white font-black text-lg flex items-center justify-center shadow-xs">
                            {(st.displayName || st.email || 'H').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {isMe && (
                          <span
                            className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
                            title="Tài khoản của bạn"
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                            {st.displayName || 'Chưa đặt tên'}
                          </h3>
                          {st.nickname && (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              ({st.nickname})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{st.email || 'Chưa có email'}</span>
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {isDemo ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-dashed border-amber-300 dark:border-amber-700">
                              Mẫu Demo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-tight bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Tài khoản thật
                            </span>
                          )}
                          {st.lastActiveAt && (
                            <span className="text-[10px] text-slate-400">
                              · {new Date(st.lastActiveAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getRoleBadge(st.role || 'student', st.email)}
                    </div>
                  </div>

                  {/* Personal Contact Details */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800 mb-3.5">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="h-3 w-3" />
                        <span>SĐT:</span>
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {st.phone || 'Chưa cập nhật'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="h-3 w-3" />
                        <span>Ngày sinh:</span>
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {st.birthDate ? `${st.birthDate} (${zodiac?.branchName || ''})` : 'Chưa cập nhật'}
                      </span>
                    </div>
                  </div>

                  {/* VSTEP 4-Skill Target Scores */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Award className="h-3.5 w-3.5 text-[#58CC02]" />
                        <span>Mục tiêu VSTEP:</span>
                      </span>
                      {goals && typeof goals.overall === 'number' ? (
                        <span className="text-xs font-black text-[#3C8C02] dark:text-[#58CC02]">
                          Overall: {goals.overall.toFixed(1)}/10 · {getVstepBandLevel(goals.overall)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 italic">
                          Chưa thiết lập mục tiêu
                        </span>
                      )}
                    </div>

                    {goals && typeof goals.overall === 'number' ? (
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-1.5">
                          <span className="block text-[10px] font-bold text-slate-500">Nghe</span>
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {goals.listening.toFixed(1)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-1.5">
                          <span className="block text-[10px] font-bold text-slate-500">Đọc</span>
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {goals.reading.toFixed(1)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-1.5">
                          <span className="block text-[10px] font-bold text-slate-500">Viết</span>
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {goals.writing.toFixed(1)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-1.5">
                          <span className="block text-[10px] font-bold text-slate-500">Nói</span>
                          <span className="font-black text-xs text-slate-900 dark:text-white">
                            {(goals.speaking ?? 6.5).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-2 text-center border border-dashed border-slate-200 dark:border-slate-800">
                        Mặc định chuẩn B2: 6.5/10 (Listening, Reading, Writing, Speaking)
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {/* Role selector dropdown */}
                  {isSuperAdmin ? (
                    <select
                      value={st.role || 'student'}
                      onChange={(e) =>
                        handleRoleChange(st.uid, e.target.value as 'student' | 'co_teacher' | 'admin')
                      }
                      className="text-[11px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-1.5 focus:border-[#58CC02] focus:outline-none cursor-pointer"
                    >
                      <option value="student">Học viên</option>
                      <option value="co_teacher">Trợ giảng</option>
                      <option value="admin">Giáo viên / Admin</option>
                    </select>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400">
                      Vai trò: {st.role === 'admin' ? 'Giáo viên' : st.role === 'co_teacher' ? 'Trợ giảng' : 'Học viên'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedStudent(st)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Xem bài làm</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STUDENT PROFILE & EXAM HISTORY MODAL */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 sm:p-7 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-lime-100 dark:bg-emerald-950/60 text-[#3C8C02] dark:text-[#58CC02] flex items-center justify-center font-black text-xl border border-lime-300 dark:border-emerald-800">
                  {(selectedStudent.displayName || selectedStudent.email || 'H').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {selectedStudent.displayName || 'Chưa đặt tên'}
                    </h3>
                    {getRoleBadge(selectedStudent.role || 'student', selectedStudent.email)}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Email: <strong>{selectedStudent.email || 'Chưa có email'}</strong> · UID: {selectedStudent.uid.slice(0, 10)}...
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
              {/* 1. Student Personal Information Card */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 p-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-[#58CC02]" />
                  <span>1. Thông tin cá nhân học viên</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Họ và tên:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedStudent.displayName || 'Chưa cập nhật'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Biệt danh / Nickname:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedStudent.nickname || 'Chưa đặt'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Số điện thoại:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedStudent.phone || 'Chưa cập nhật'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Ngày sinh &amp; Con giáp:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedStudent.birthDate
                        ? `${selectedStudent.birthDate} (${getZodiacFromBirthDate(selectedStudent.birthDate).branchName})`
                        : 'Chưa cập nhật'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Địa chỉ / Khu vực:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedStudent.address || 'Chưa cập nhật'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-0.5">Ngày tham gia:</span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {selectedStudent.createdAt
                        ? new Date(selectedStudent.createdAt).toLocaleDateString('vi-VN')
                        : 'Gần đây'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* 2. VSTEP 4 Skills Target Score Card */}
              <div className="rounded-2xl bg-gradient-to-br from-lime-50 to-emerald-50 dark:from-slate-800 dark:to-emerald-950/30 border border-lime-200 dark:border-emerald-800/60 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-[#58CC02]" />
                    <span>2. Mục tiêu điểm số VSTEP (Thang điểm 10)</span>
                  </h4>
                  {selectedStudent.targetScores?.overall && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[#58CC02] text-white text-[11px] font-black shadow-xs">
                      Mục tiêu Overall: {selectedStudent.targetScores.overall.toFixed(1)}/10 ({getVstepBandLevel(selectedStudent.targetScores.overall)})
                    </span>
                  )}
                </div>

                {selectedStudent.targetScores ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-lime-200 dark:border-slate-700 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Headphones className="h-3 w-3 text-[#58CC02]" />
                          <span>Listening</span>
                        </span>
                        <span className="text-slate-900 dark:text-white font-black">
                          {selectedStudent.targetScores.listening.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#58CC02] rounded-full"
                          style={{ width: `${(selectedStudent.targetScores.listening / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-lime-200 dark:border-slate-700 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <BookOpen className="h-3 w-3 text-sky-500" />
                          <span>Reading</span>
                        </span>
                        <span className="text-slate-900 dark:text-white font-black">
                          {selectedStudent.targetScores.reading.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-sky-500 rounded-full"
                          style={{ width: `${(selectedStudent.targetScores.reading / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-lime-200 dark:border-slate-700 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <PenTool className="h-3 w-3 text-emerald-500" />
                          <span>Writing</span>
                        </span>
                        <span className="text-slate-900 dark:text-white font-black">
                          {selectedStudent.targetScores.writing.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(selectedStudent.targetScores.writing / 10) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-lime-200 dark:border-slate-700 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Mic className="h-3 w-3 text-amber-500" />
                          <span>Speaking</span>
                        </span>
                        <span className="text-slate-900 dark:text-white font-black">
                          {(selectedStudent.targetScores.speaking ?? 6.5).toFixed(1)}/10
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${((selectedStudent.targetScores.speaking ?? 6.5) / 10) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Học viên chưa cập nhật bảng mục tiêu 4 kỹ năng VSTEP.
                  </p>
                )}
              </div>

              {/* 3. Exam Attempt History and Submissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-[#58CC02]" />
                    <span>3. Lịch sử làm bài thi &amp; Kết quả chi tiết ({studentAttempts.length} lượt)</span>
                  </h4>
                </div>

                {isLoadingAttempts ? (
                  <div className="py-8 text-center text-xs font-bold text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#58CC02]" />
                    <span>Đang tải các lượt làm bài của học viên...</span>
                  </div>
                ) : studentAttempts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
                    Học viên này chưa hoàn thành lượt thi nào trên hệ thống.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {studentAttempts.map((att, idx) => (
                      <div
                        key={att.attemptId || idx}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs hover:border-[#58CC02] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {att.testTitle || `Bài thi ${att.testId}`}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                att.mode === 'exam'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                  : 'bg-lime-100 text-[#2B6601] dark:bg-emerald-950/70 dark:text-lime-300'
                              }`}
                            >
                              {att.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                att.grade === 'High Pass'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : att.grade === 'Pass'
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                              }`}
                            >
                              {att.grade || 'Pass'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(att.completedAt).toLocaleString('vi-VN')}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{Math.round(att.timeSpentSeconds / 60)} phút</span>
                            </span>
                            <span>
                              Điểm: <strong className="text-[#3C8C02] dark:text-[#58CC02]">{att.score}/{att.totalQuestions}</strong> ({att.percentage}%)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {att.answers && (
                            <button
                              type="button"
                              onClick={() => setSelectedAttemptDetail(att)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Xem câu trả lời
                            </button>
                          )}
                          {onOpenTest && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudent(null);
                                onOpenTest(att.testId);
                              }}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-[#58CC02] hover:bg-lime-50 dark:hover:bg-slate-800 transition-colors"
                              title="Mở đề thi này"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-400 font-semibold">
                Dữ liệu đồng bộ trực tiếp từ Cloud Firestore
              </span>

              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-6 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ATTEMPT ANSWERS / WRITING DETAIL MODAL */}
      {selectedAttemptDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setSelectedAttemptDetail(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Chi tiết bài làm: {selectedAttemptDetail.testTitle}
                </h3>
                <span className="text-xs text-slate-500">
                  Hoàn thành: {new Date(selectedAttemptDetail.completedAt).toLocaleString('vi-VN')} · Đúng {selectedAttemptDetail.score}/{selectedAttemptDetail.totalQuestions} câu
                </span>
              </div>
              <button
                onClick={() => setSelectedAttemptDetail(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Trắc nghiệm Answers Grid */}
              {selectedAttemptDetail.answers && Object.keys(selectedAttemptDetail.answers).length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 mb-2">
                    Các đáp án đã chọn:
                  </h4>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                    {Object.entries(selectedAttemptDetail.answers).map(([qId, ans]) => (
                      <div
                        key={qId}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2 text-center"
                      >
                        <span className="block text-[10px] font-bold text-slate-400">Câu {qId}</span>
                        <strong className="text-xs font-black text-[#3C8C02] dark:text-[#58CC02]">
                          {ans || '-'}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Writing Submission If Exists */}
              {selectedAttemptDetail.writingSubmission && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <PenTool className="h-4 w-4" />
                    <span>Bài làm Writing (Tự luận):</span>
                  </h4>

                  {selectedAttemptDetail.writingSubmission.task1Text && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1">
                        Task 1 (Email / Thư) — {selectedAttemptDetail.writingSubmission.task1WordCount || selectedAttemptDetail.writingSubmission.task1Text.split(/\s+/).filter(Boolean).length} từ
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-[11px]">
                        {selectedAttemptDetail.writingSubmission.task1Text}
                      </p>
                    </div>
                  )}

                  {selectedAttemptDetail.writingSubmission.task2Text && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1">
                        Task 2 (Essay / Luận học thuật) — {selectedAttemptDetail.writingSubmission.task2WordCount || selectedAttemptDetail.writingSubmission.task2Text.split(/\s+/).filter(Boolean).length} từ
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-[11px]">
                        {selectedAttemptDetail.writingSubmission.task2Text}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedAttemptDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#58CC02] text-white text-xs font-black"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic & Integration Guide Modal */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-lime-100 dark:bg-lime-950/70 text-[#3C8C02] dark:text-[#58CC02] flex items-center justify-center">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Hướng dẫn kết nối học viên từ trang Vercel
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Đảm bảo tài khoản đăng nhập từ https://vsteppro.vercel.app xuất hiện đầy đủ
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 pr-1">
              {/* Step 1 */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-[#58CC02] text-white text-[11px] flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Thêm tên miền Authorized Domains vào Firebase Console</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 mb-2">
                  Khi học viên đăng nhập bằng Google trên tên miền Vercel, Firebase yêu cầu tên miền đó phải được cấp phép trong Console:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300 font-semibold pl-1">
                  <li>Truy cập <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline">Firebase Console</a> &gt; chọn dự án <strong>harrytoeicbackup</strong>.</li>
                  <li>Vào mục <strong>Authentication</strong> &gt; chọn tab <strong>Settings</strong> &gt; chọn mục <strong>Authorized domains</strong>.</li>
                  <li>Bấm <strong>Add domain</strong> và dán: <code className="bg-lime-100 dark:bg-lime-950/80 text-lime-800 dark:text-lime-300 px-1.5 py-0.5 rounded font-mono font-bold">vsteppro.vercel.app</code> rồi bấm <strong>Save</strong>.</li>
                </ol>
              </div>

              {/* Step 2 */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-[#58CC02] text-white text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Đồng bộ mã nguồn mới nhất lên GitHub để Vercel build lại</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Mọi cập nhật sửa lỗi (sửa lỗi lưu mục tiêu VSTEP, bổ sung tab Quản lý học viên, cơ chế đồng bộ profile tự động vào Firestore) đang chạy tại AI Studio. Bạn hãy commit/push mã nguồn này lên GitHub để Vercel tự động build và triển khai phiên bản mới nhất.
                </p>
              </div>

              {/* Step 3 */}
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-[#58CC02] text-white text-[11px] flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>Học viên bấm Đăng nhập (Google hoặc Email)</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Chỉ cần học viên đăng nhập thành công một lần, hệ thống sẽ tự động tạo hồ sơ học viên trên Firestore. Nhờ kết nối thời gian thực (Real-time listener), tài khoản học viên sẽ tự động nhảy số và xuất hiện trên bảng này ngay lập tức!
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400">
                Cơ sở dữ liệu: <code className="font-mono font-bold text-slate-600 dark:text-slate-300">harrytoeicbackup</code>
              </span>
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-5 py-2 rounded-xl bg-[#58CC02] text-white text-xs font-black hover:bg-[#46a302] cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
