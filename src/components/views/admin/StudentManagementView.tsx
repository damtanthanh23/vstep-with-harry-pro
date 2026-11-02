import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Layers,
  Activity,
  Flame,
  PlayCircle,
  Target,
  BarChart2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { UserProfile, UserRole } from '../../../types/studentManagement';
import {
  subscribeToStudentDirectory,
  isUserOnline,
  formatRelativeActiveTime,
  formatExactLoginTimestamp,
  resolveTestTitle,
  updateStudentRole,
  DEMO_STUDENTS,
  SUPER_ADMIN_EMAILS,
} from '../../../services/studentManagementService';
import { StudentDetail360Modal } from './StudentDetail360Modal';
import { getZodiacFromBirthDate } from '../ZodiacPixelMascot';

interface StudentManagementViewProps {
  onOpenTest?: (testId: string) => void;
}

type RoleFilterType = 'all' | 'student' | 'co_teacher' | 'admin';
type ActivityFilterType = 'all' | 'online' | 'in_progress' | 'submitted' | 'vocab';

export const StudentManagementView: React.FC<StudentManagementViewProps> = ({ onOpenTest }) => {
  const { currentUser, userProfile, isAdmin, isSuperAdmin, isCoTeacher, canManageExams } = useAuth();
  const [realStudents, setRealStudents] = useState<UserProfile[]>([]);
  const [showDemoStudents, setShowDemoStudents] = useState<boolean>(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<RoleFilterType>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilterType>('all');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  // Real-time synchronization with Cloud Firestore users collection
  useEffect(() => {
    if (!canManageExams) return;

    setIsLoading(true);

    const unsubscribe = subscribeToStudentDirectory(
      (list) => {
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
      () => {
        setIsRealtimeConnected(false);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [canManageExams, userProfile]);

  // Combined student list: real Firestore students, plus optional demo students if toggled
  const allStudents = useMemo(() => {
    if (!showDemoStudents) {
      return realStudents;
    }
    const mergedMap = new Map<string, UserProfile>();
    realStudents.forEach((s) => mergedMap.set(s.uid, s));
    DEMO_STUDENTS.forEach((s) => {
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
      showToast('Đang làm mới dữ liệu học viên từ Cloud Firestore...', 'success');
      // The snapshot listener handles the sync automatically; toggle loading state for feedback
      setTimeout(() => {
        setIsLoading(false);
        showToast('Đã đồng bộ dữ liệu mới nhất!', 'success');
      }, 600);
    } catch {
      setIsLoading(false);
    }
  };

  // Role Assignment Handler
  const handleRoleChange = async (targetUid: string, newRole: UserRole) => {
    try {
      await updateStudentRole(targetUid, newRole, currentUser?.email || 'admin');
      setRealStudents((prev) =>
        prev.map((s) => (s.uid === targetUid ? { ...s, role: newRole } : s))
      );
      if (selectedStudent && selectedStudent.uid === targetUid) {
        setSelectedStudent((prev) => (prev ? { ...prev, role: newRole } : null));
      }
      showToast(
        `Đã phân quyền thành công: ${
          newRole === 'admin' ? 'Giáo viên/Admin' : newRole === 'co_teacher' ? 'Trợ giảng' : 'Học viên'
        }`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Có lỗi khi phân quyền người dùng.', 'error');
      throw err;
    }
  };

  // Count online students
  const onlineCount = useMemo(() => {
    return allStudents.filter((s) => isUserOnline(s, currentUser?.uid)).length;
  }, [allStudents, currentUser]);

  // Filter students based on search, role, and activity
  const filteredStudents = useMemo(() => {
    return allStudents.filter((s) => {
      // 1. Role Filter
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;

      // 2. Activity Filter
      if (activityFilter === 'online' && !isUserOnline(s, currentUser?.uid)) return false;
      if (activityFilter === 'vocab') {
        const hasVocab =
          s.vocabStats && (s.vocabStats.masteredCount > 0 || s.vocabStats.learningCount > 0);
        if (!hasVocab) return false;
      }
      if (activityFilter === 'submitted') {
        const hasAttempts = (s.totalExamAttempts || 0) > 0;
        if (!hasAttempts) return false;
      }
      if (activityFilter === 'in_progress') {
        const hasDraft = Boolean(s.activeDraftSummary && s.activeDraftSummary.testId);
        if (!hasDraft) return false;
      }

      // 3. Search Filter
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
  }, [allStudents, roleFilter, activityFilter, searchTerm, currentUser]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = allStudents.length;
    const withGoals = allStudents.filter(
      (s) => s.targetScores && typeof s.targetScores.overall === 'number'
    ).length;
    const staff = allStudents.filter((s) => s.role === 'admin' || s.role === 'co_teacher').length;
    const studentsOnly = allStudents.filter((s) => s.role === 'student').length;
    return { total, withGoals, staff, studentsOnly };
  }, [allStudents]);

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
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <span>SUPER ADMIN</span>
        </span>
      );
    }
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <span>GIÁO VIÊN</span>
        </span>
      );
    }
    if (role === 'co_teacher') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <span>TRỢ GIẢNG</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
        <span>HỌC VIÊN</span>
      </span>
    );
  };

  // Access Denied Screen for standard students
  if (!canManageExams) {
    return (
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-8 sm:p-12 text-center border-2 border-slate-200 dark:border-slate-800 shadow-sm max-w-lg mx-auto my-12">
        <div className="h-16 w-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
          Khu vực bảo mật Giáo viên &amp; Admin
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          Phân hệ Quản lý học viên &amp; Phân quyền Quản trị 360° chỉ dành riêng cho Giảng viên (Mr.Harry) và Ban trợ giảng được phân quyền. Vui lòng đăng nhập bằng tài khoản quản trị ({SUPER_ADMIN_EMAILS[0]}) để truy cập.
        </p>
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 text-left">
          <strong>Tài khoản hiện tại:</strong> {currentUser?.email || 'Chưa đăng nhập'} (Vai trò: {userProfile?.role || 'student'})
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Banner with Live Counter */}
      <div className="rounded-3xl bg-gradient-to-r from-[#58CC02] via-[#4BB302] to-[#3C8C02] p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wider backdrop-blur-xs">
              <Users className="h-3.5 w-3.5" />
              <span>Quản Lý Học Viên &amp; Phân Quyền 360°</span>
            </div>

            {/* Live Firestore WebSocket status with Online counter */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/25 text-white text-xs font-bold backdrop-blur-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${isRealtimeConnected ? 'bg-lime-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="tabular-nums">
                {isRealtimeConnected
                  ? `Live Firestore: ${realStudents.length} học viên thật · ${onlineCount} đang Online`
                  : 'Đang kết nối Firestore...'}
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Hồ Sơ Học Viên &amp; Tiến Trình Học Tập 360°
          </h1>
          <p className="text-xs sm:text-sm text-lime-100 font-semibold mt-1 max-w-2xl leading-relaxed">
            Giám sát thời gian thực hoạt động online, mục tiêu điểm số 4 kỹ năng VSTEP (Listening, Reading, Writing, Speaking), biểu đồ tiến trình điểm thi và kho từ vựng Anki của từng học viên.
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
            <span>Kết nối Vercel &amp; Domain</span>
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

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng tài khoản &amp; Online</span>
            <Users className="h-4 w-4 text-[#58CC02]" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums flex items-center gap-2">
            <span>{stats.total}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
              {onlineCount} Online
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 mt-0.5 block">
            {realStudents.length} tài khoản thực từ Firestore
          </span>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Đã đặt mục tiêu VSTEP</span>
            <Award className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
            {stats.withGoals}
          </div>
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            Thang điểm 10 (L-R-W-S)
          </span>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Đội ngũ giảng dạy</span>
            <GraduationCap className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
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
      {toastMessage && (
        <div
          className={`rounded-2xl border p-3.5 text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo họ tên, email, biệt danh, hoặc số điện thoại..."
              className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-1 px-1 shrink-0">
              <Filter className="h-3 w-3" />
              <span>Vai trò:</span>
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
                  : 'Giáo viên / Admin'}
              </button>
            ))}
          </div>
        </div>

        {/* Activity Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-400 font-bold flex items-center gap-1 shrink-0">
            <Activity className="h-3.5 w-3.5" />
            <span>Hoạt động:</span>
          </span>

          <button
            type="button"
            onClick={() => setActivityFilter('all')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
              activityFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Tất cả hoạt động
          </button>

          <button
            type="button"
            onClick={() => setActivityFilter('online')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activityFilter === 'online'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Đang Online ({onlineCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActivityFilter('in_progress')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activityFilter === 'in_progress'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
            }`}
          >
            <Clock className="h-3 w-3" />
            <span>Đang làm đề dở</span>
          </button>

          <button
            type="button"
            onClick={() => setActivityFilter('submitted')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activityFilter === 'submitted'
                ? 'bg-sky-600 text-white'
                : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100'
            }`}
          >
            <FileText className="h-3 w-3" />
            <span>Đã nộp bài thi</span>
          </button>

          <button
            type="button"
            onClick={() => setActivityFilter('vocab')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activityFilter === 'vocab'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Đang học từ vựng (SRS)</span>
          </button>
        </div>

        {/* Real Data vs Demo Toggle Row */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-semibold">
            <Radio className="h-3.5 w-3.5 text-[#58CC02] animate-pulse" />
            <span>
              Chế độ hiển thị:{' '}
              <strong>{showDemoStudents ? 'Tài khoản thật + 3 hồ sơ mẫu demo' : '100% Học viên thật từ Cloud Firestore'}</strong>
            </span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-bold px-2.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={showDemoStudents}
              onChange={(e) => setShowDemoStudents(e.target.checked)}
              className="rounded text-[#58CC02] focus:ring-[#58CC02] h-4 w-4 cursor-pointer"
            />
            <span>Bật xem thêm 3 tài khoản mẫu (Demo)</span>
          </label>
        </div>
      </div>

      {/* Student List Grid */}
      {isLoading ? (
        <div className="py-20 text-center">
          <RefreshCw className="h-8 w-8 text-[#58CC02] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">Đang đồng bộ danh sách học viên từ Cloud Firestore...</p>
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#58CC02] text-white text-xs font-black shadow-xs hover:bg-[#46a302] cursor-pointer"
            >
              <HelpCircle className="h-4 w-4" />
              <span>Xem hướng dẫn kết nối Vercel &amp; Firebase</span>
            </button>
            {!showDemoStudents && (
              <button
                type="button"
                onClick={() => setShowDemoStudents(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>Bật 3 tài khoản mẫu demo</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredStudents.map((st) => {
            const goals = st.targetScores;
            const hasGoals = Boolean(goals && typeof goals.overall === 'number');
            const isMe = currentUser?.uid === st.uid;
            const isDemo = st.uid.startsWith('demo_');
            const online = isUserOnline(st, currentUser?.uid);
            const isSuper = Boolean(st.email && SUPER_ADMIN_EMAILS.includes(st.email.toLowerCase()));
            const lastLoginTime = st.lastLoginAt || st.lastActiveAt || st.createdAt;
            const activeDraft = st.activeDraftSummary;
            const attemptsCount = st.totalExamAttempts || 0;
            const bestBand = st.bestVstepBandScore || 0;
            const vocab = st.vocabStats;
            const hasVocabActivity = Boolean(
              vocab && (vocab.masteredCount > 0 || vocab.learningCount > 0)
            );

            return (
              <div
                key={st.uid}
                className={`rounded-[28px] bg-white dark:bg-slate-900 border p-5 shadow-xs transition-all flex flex-col justify-between ${
                  online
                    ? 'border-emerald-300 dark:border-emerald-700/80 shadow-[0_8px_24px_rgba(16,185,129,0.08)]'
                    : isDemo
                    ? 'border-amber-200/80 dark:border-amber-900/40 bg-amber-50/10 dark:bg-amber-950/10'
                    : 'border-indigo-100/90 dark:border-slate-800 hover:border-[#58CC02] dark:hover:border-[#58CC02]'
                }`}
              >
                <div className="space-y-3">
                  {/* 1. Top Header: Avatar + Name/Email + Role Badge */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {st.photoURL ? (
                          <img
                            src={st.photoURL}
                            alt={st.displayName || 'Avatar'}
                            className="h-13 w-13 rounded-2xl object-cover shadow-xs border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="h-13 w-13 rounded-2xl bg-[#005A8D] text-white font-bold text-xl flex items-center justify-center shadow-xs">
                            {(st.displayName || st.email || 'H').charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Status Dot at bottom-right matching screenshot */}
                        {online ? (
                          <span
                            className="absolute -bottom-1 -right-1 flex h-4 w-4"
                            title="Học viên đang Online"
                          >
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900" />
                          </span>
                        ) : (
                          <span
                            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-slate-300 dark:bg-slate-600 border-2 border-white dark:border-slate-900"
                            title="Offline"
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                            {st.displayName || 'Học viên VSTEP'}
                          </h3>
                          {isMe && (
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              (Bạn)
                            </span>
                          )}
                          {isDemo && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                              Demo
                            </span>
                          )}
                        </div>

                        <p
                          className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5"
                          title={st.email || ''}
                        >
                          {st.email || 'Chưa có email'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getRoleBadge(st.role || 'student', st.email)}
                    </div>
                  </div>

                  {/* 2. Online Status & Last Login Box */}
                  <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 p-3 border border-slate-100 dark:border-slate-800 space-y-2">
                    <div>
                      {online ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Đang Online</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-slate-200/75 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          <span>Offline</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <Clock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span>Đăng nhập cuối:</span>
                      <strong className="font-black text-slate-800 dark:text-slate-100 tabular-nums">
                        {formatExactLoginTimestamp(lastLoginTime)}
                      </strong>
                    </div>
                  </div>

                  {/* 3. Phone & BirthDate Pill Row */}
                  <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 px-3.5 py-2.5 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold truncate">
                      <Phone className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                      <span className="truncate">{st.phone || 'Chưa cập nhật'}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold shrink-0 tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span>{st.birthDate || 'Chưa cập nhật'}</span>
                    </div>
                  </div>

                  {/* 4. 3-Row Activity Status Box (Đang làm / Đã nộp / Từ vựng B1) */}
                  <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 p-3.5 border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    {/* Row 1: Đang làm */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        <PlayCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>Đang làm:</span>
                      </span>
                      {activeDraft && activeDraft.testId ? (
                        <span
                          className="font-extrabold text-amber-600 dark:text-amber-400 truncate text-right"
                          title={resolveTestTitle(activeDraft.testId, activeDraft.testTitle)}
                        >
                          {resolveTestTitle(activeDraft.testId, activeDraft.testTitle)} (
                          {activeDraft.answeredCount}/75 câu)
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium text-right">
                          Không có đề làm dở
                        </span>
                      )}
                    </div>

                    {/* Row 2: Đã nộp */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        <FileText className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span>Đã nộp:</span>
                      </span>
                      {attemptsCount > 0 ? (
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400 truncate text-right tabular-nums">
                          {attemptsCount} đề · Cao nhất: {bestBand.toFixed(1)}/10
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium text-right">
                          Chưa nộp đề nào
                        </span>
                      )}
                    </div>

                    {/* Row 3: Từ vựng B1 */}
                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>Từ vựng B1:</span>
                      </span>
                      {hasVocabActivity && vocab ? (
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 truncate text-right tabular-nums">
                          Thuộc {vocab.masteredCount} · Đang học {vocab.learningCount} từ
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium text-right">
                          Chưa ghi nhận học từ vựng
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 5. VSTEP 4-Skill Target Scores Box */}
                  <div className="rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 p-3.5 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="text-xs font-black uppercase tracking-tight text-indigo-950 dark:text-slate-200 flex items-center gap-1.5">
                        <Target className="h-4 w-4 text-[#58CC02] shrink-0" />
                        <span>MỤC TIÊU ĐIỂM SỐ</span>
                      </span>
                      {hasGoals && goals ? (
                        <span className="text-xs font-black text-[#2E7D32] dark:text-[#58CC02] tabular-nums">
                          Overall {goals.overall.toFixed(1)} ({getVstepBandLevel(goals.overall)})
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                          Chưa đặt mục tiêu
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center tabular-nums">
                      <div className="rounded-xl bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 shadow-2xs">
                        <span className="block text-[10px] font-bold text-slate-400 mb-0.5">Nghe</span>
                        <span className="font-black text-xs text-sky-600 dark:text-sky-400">
                          {hasGoals && goals ? goals.listening.toFixed(1) : '--'}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 shadow-2xs">
                        <span className="block text-[10px] font-bold text-slate-400 mb-0.5">Đọc</span>
                        <span className="font-black text-xs text-amber-600 dark:text-amber-400">
                          {hasGoals && goals ? goals.reading.toFixed(1) : '--'}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 shadow-2xs">
                        <span className="block text-[10px] font-bold text-slate-400 mb-0.5">Viết</span>
                        <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                          {hasGoals && goals ? goals.writing.toFixed(1) : '--'}
                        </span>
                      </div>
                      <div className="rounded-xl bg-white dark:bg-slate-900 p-2 border border-slate-100 dark:border-slate-800 shadow-2xs">
                        <span className="block text-[10px] font-bold text-slate-400 mb-0.5">Nói</span>
                        <span className="font-black text-xs text-purple-600 dark:text-purple-400">
                          {hasGoals && goals ? (goals.speaking ?? 6.5).toFixed(1) : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. Bottom Card Actions */}
                <div className="pt-3.5 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  {/* Role selector dropdown for Super Admin & Admins */}
                  {isSuperAdmin || (isAdmin && !isSuper) ? (
                    <select
                      value={st.role || 'student'}
                      onChange={(e) => handleRoleChange(st.uid, e.target.value as UserRole)}
                      className="text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2 focus:border-[#58CC02] focus:outline-none cursor-pointer"
                    >
                      <option value="student">Vai trò: Học viên</option>
                      <option value="co_teacher">Vai trò: Trợ giảng</option>
                      <option value="admin">Vai trò: Giáo viên</option>
                    </select>
                  ) : (
                    <span className="text-xs font-bold text-slate-500 px-2">
                      Vai trò:{' '}
                      {st.role === 'admin'
                        ? 'Giáo viên'
                        : st.role === 'co_teacher'
                        ? 'Trợ giảng'
                        : 'Học viên'}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedStudent(st)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#46B800] hover:bg-[#3da100] text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    <span>Chi tiết &amp; Bài làm</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STUDENT 360° DETAIL MODAL */}
      {selectedStudent && (
        <StudentDetail360Modal
          student={allStudents.find((s) => s.uid === selectedStudent.uid) || selectedStudent}
          isOpen={Boolean(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
          onOpenTest={onOpenTest}
          isCurrentAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          onRoleChange={handleRoleChange}
        />
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
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 pr-1">
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
                  <li>Truy cập <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 underline">Firebase Console</a> &gt; chọn dự án của bạn.</li>
                  <li>Vào mục <strong>Authentication</strong> &gt; chọn tab <strong>Settings</strong> &gt; chọn mục <strong>Authorized domains</strong>.</li>
                  <li>Bấm <strong>Add domain</strong> và dán: <code className="bg-lime-100 dark:bg-lime-950/80 text-lime-800 dark:text-lime-300 px-1.5 py-0.5 rounded font-mono font-bold">vsteppro.vercel.app</code> rồi bấm <strong>Save</strong>.</li>
                </ol>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white mb-1.5">
                  <span className="h-5 w-5 rounded-full bg-[#58CC02] text-white text-[11px] flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Đồng bộ mã nguồn mới nhất lên GitHub để Vercel build lại</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                  Mọi cập nhật sửa lỗi (phân hệ Quản lý học viên 360°, cơ chế Online Heartbeat 90s, biểu đồ tiến trình điểm thi, SRS Vocab tracking) đã sẵn sàng. Bạn hãy commit/push mã nguồn này lên GitHub để Vercel tự động build và triển khai phiên bản mới nhất.
                </p>
              </div>

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
                Cơ sở dữ liệu: <code className="font-mono font-bold text-slate-600 dark:text-slate-300">Cloud Firestore</code>
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
