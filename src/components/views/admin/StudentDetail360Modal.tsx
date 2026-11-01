import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Award,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  Calendar,
  Clock,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Sparkles,
  Layers,
  BarChart2,
  RefreshCw,
  Flame,
  Radio,
  Eye,
  ShieldCheck,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  UserExamAttempt,
  UserTargetScores,
  InProgressAttempt,
} from '../../../types/studentManagement';
import {
  resolveTestTitle,
  isUserOnline,
  formatRelativeActiveTime,
  subscribeToStudentAttempts,
  fetchStudentInProgressMap,
  DEMO_ATTEMPTS,
  DEMO_IN_PROGRESS,
  SUPER_ADMIN_EMAILS,
} from '../../../services/studentManagementService';
import { getZodiacFromBirthDate } from '../ZodiacPixelMascot';

interface StudentDetail360ModalProps {
  student: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpenTest?: (testId: string) => void;
  isCurrentAdmin: boolean;
  isSuperAdmin: boolean;
  onRoleChange?: (targetUid: string, newRole: UserRole) => Promise<void>;
}

export const StudentDetail360Modal: React.FC<StudentDetail360ModalProps> = ({
  student,
  isOpen,
  onClose,
  onOpenTest,
  isCurrentAdmin,
  isSuperAdmin,
  onRoleChange,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'history' | 'vocab'>('analytics');
  const [attempts, setAttempts] = useState<UserExamAttempt[]>([]);
  const [inProgressMap, setInProgressMap] = useState<Record<string, InProgressAttempt>>({});
  const [isLoadingAttempts, setIsLoadingAttempts] = useState<boolean>(true);
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState<UserExamAttempt | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>(student.role || 'student');
  const [roleChangeNotice, setRoleChangeNotice] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  // Sync role when student changes
  useEffect(() => {
    setSelectedRole(student.role || 'student');
  }, [student]);

  // Load attempts & in-progress
  useEffect(() => {
    if (!isOpen || !student) return;

    setIsLoadingAttempts(true);

    if (student.uid.startsWith('demo_')) {
      const demoList = DEMO_ATTEMPTS[student.uid] || [];
      setAttempts(demoList);
      const demoInProg = DEMO_IN_PROGRESS[student.uid];
      setInProgressMap(demoInProg ? { [demoInProg.testId]: demoInProg } : {});
      setIsLoadingAttempts(false);
      return;
    }

    const unsubAttempts = subscribeToStudentAttempts(
      student.uid,
      (loaded: UserExamAttempt[]) => {
        setAttempts(loaded);
        setIsLoadingAttempts(false);
      },
      () => {
        setIsLoadingAttempts(false);
      }
    );

    fetchStudentInProgressMap(student.uid)
      .then((map: Record<string, InProgressAttempt>) => {
        setInProgressMap(map);
      })
      .catch(() => {});

    return () => {
      unsubAttempts();
    };
  }, [isOpen, student]);

  if (!isOpen) return null;

  const zodiac = student.birthDate ? getZodiacFromBirthDate(student.birthDate) : null;
  const isOnline = isUserOnline(student);
  const goals: UserTargetScores = student.targetScores || {
    overall: 6.5,
    listening: 6.5,
    reading: 6.5,
    writing: 6.5,
    speaking: 6.5,
  };

  // Compute analytics
  const analytics = useMemo(() => {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        avgScore: 0,
        avgPercentage: 0,
        passRate: 0,
        highPassRate: 0,
        avgListening: 0,
        avgReading: 0,
        avgWriting: 0,
        avgSpeaking: 0,
        maxListening: 0,
        maxReading: 0,
        maxWriting: 0,
        maxSpeaking: 0,
        totalStudySeconds: 0,
      };
    }

    let totalScore = 0;
    let totalPercentage = 0;
    let passCount = 0;
    let highPassCount = 0;
    let totalListen = 0;
    let countListen = 0;
    let maxListen = 0;
    let totalRead = 0;
    let countRead = 0;
    let maxRead = 0;
    let totalWrite = 0;
    let countWrite = 0;
    let maxWrite = 0;
    let totalSpeak = 0;
    let countSpeak = 0;
    let maxSpeak = 0;
    let totalSec = 0;

    attempts.forEach((a) => {
      totalScore += a.score;
      totalPercentage += a.percentage || 0;
      totalSec += a.timeSpentSeconds || 0;
      if (a.percentage >= 50 || a.grade === 'Pass' || a.grade === 'High Pass') passCount++;
      if (a.percentage >= 75 || a.grade === 'High Pass') highPassCount++;

      if (typeof a.listeningScore === 'number') {
        totalListen += a.listeningScore;
        countListen++;
        if (a.listeningScore > maxListen) maxListen = a.listeningScore;
      }
      if (typeof a.readingScore === 'number') {
        totalRead += a.readingScore;
        countRead++;
        if (a.readingScore > maxRead) maxRead = a.readingScore;
      }
      if (typeof a.writingScore === 'number') {
        totalWrite += a.writingScore;
        countWrite++;
        if (a.writingScore > maxWrite) maxWrite = a.writingScore;
      }
      if (typeof a.speakingScore === 'number') {
        totalSpeak += a.speakingScore;
        countSpeak++;
        if (a.speakingScore > maxSpeak) maxSpeak = a.speakingScore;
      }
    });

    const len = attempts.length;
    return {
      totalAttempts: len,
      avgScore: Math.round((totalScore / len) * 10) / 10,
      avgPercentage: Math.round((totalPercentage / len) * 10) / 10,
      passRate: Math.round((passCount / len) * 100),
      highPassRate: Math.round((highPassCount / len) * 100),
      avgListening: countListen > 0 ? Math.round((totalListen / countListen) * 10) / 10 : 0,
      avgReading: countRead > 0 ? Math.round((totalRead / countRead) * 10) / 10 : 0,
      avgWriting: countWrite > 0 ? Math.round((totalWrite / countWrite) * 10) / 10 : 0,
      avgSpeaking: countSpeak > 0 ? Math.round((totalSpeak / countSpeak) * 10) / 10 : 0,
      maxListening: maxListen,
      maxReading: maxRead,
      maxWriting: maxWrite,
      maxSpeaking: maxSpeak,
      totalStudySeconds: totalSec,
    };
  }, [attempts]);

  // Attempt items sorted chronologically for line chart
  const chartAttempts = useMemo(() => {
    return [...attempts]
      .sort((a, b) => a.completedAt - b.completedAt)
      .slice(-10); // recent 10 attempts
  }, [attempts]);

  const activeDraft = useMemo(() => {
    const list = Object.values(inProgressMap);
    return list.length > 0 ? list[0] : null;
  }, [inProgressMap]);

  const handleApplyRole = async (newRole: UserRole) => {
    if (!onRoleChange || isUpdatingRole) return;
    setIsUpdatingRole(true);
    setRoleChangeNotice(null);
    try {
      await onRoleChange(student.uid, newRole);
      setSelectedRole(newRole);
      setRoleChangeNotice(`Đã cập nhật vai trò thành: ${newRole === 'admin' ? 'Giáo viên/Admin' : newRole === 'co_teacher' ? 'Trợ giảng' : 'Học viên'}`);
      setTimeout(() => setRoleChangeNotice(null), 3000);
    } catch (err: any) {
      setRoleChangeNotice(`Lỗi: ${err?.message || 'Không thể đổi vai trò'}`);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const isSuperAdminEmail = Boolean(
    student.email && SUPER_ADMIN_EMAILS.includes(student.email.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL TOP HEADER */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              {student.photoURL ? (
                <img
                  src={student.photoURL}
                  alt={student.displayName || 'Avatar'}
                  className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover shadow-sm border-2 border-white dark:border-slate-700"
                />
              ) : (
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-tr from-[#58CC02] to-emerald-400 text-white font-black text-2xl flex items-center justify-center shadow-sm">
                  {(student.displayName || student.email || 'H').charAt(0).toUpperCase()}
                </div>
              )}
              {isOnline ? (
                <span
                  className="absolute -top-1 -right-1 flex h-4 w-4"
                  title="Đang Online trên hệ thống"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </span>
              ) : (
                <span
                  className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900"
                  title="Offline"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                  {student.displayName || 'Học viên VSTEP'}
                </h2>
                {student.nickname && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                    @{student.nickname}
                  </span>
                )}
                {isSuperAdminEmail ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Super Admin</span>
                  </span>
                ) : student.role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                    <GraduationCap className="h-3 w-3" />
                    <span>Giáo viên</span>
                  </span>
                ) : student.role === 'co_teacher' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Award className="h-3 w-3" />
                    <span>Trợ giảng</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <UserCheck className="h-3 w-3" />
                    <span>Học viên</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{student.email || 'Chưa có email'}</span>
                </span>
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{student.phone}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                  <Radio className={`h-3 w-3 ${isOnline ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                  <span>{isOnline ? 'Đang Online' : formatRelativeActiveTime(student.lastActiveAt)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center shrink-0">
            {/* Quick role change for Admin */}
            {(isSuperAdmin || (isCurrentAdmin && !isSuperAdminEmail)) && onRoleChange && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-extrabold text-slate-500 pl-1.5">Vai trò:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => handleApplyRole(e.target.value as UserRole)}
                  disabled={isUpdatingRole}
                  className="text-xs font-black rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2.5 py-1 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#58CC02] cursor-pointer"
                >
                  <option value="student">Học viên</option>
                  <option value="co_teacher">Trợ giảng</option>
                  <option value="admin">Giáo viên / Admin</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ROLE NOTICE IF ANY */}
        {roleChangeNotice && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{roleChangeNotice}</span>
          </div>
        )}

        {/* TAB NAVIGATION STRIP */}
        <div className="px-6 pt-3 bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-2xl border-t-2 border-x-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-white dark:bg-slate-900 text-[#2E7D32] dark:text-[#58CC02] border-[#58CC02] shadow-xs -mb-[2px] z-10'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>1. Biểu đồ &amp; Thống kê điểm số</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-2xl border-t-2 border-x-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-900 text-[#2E7D32] dark:text-[#58CC02] border-[#58CC02] shadow-xs -mb-[2px] z-10'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>2. Đang làm &amp; Lịch sử bài thi ({attempts.length})</span>
            {activeDraft && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vocab')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-2xl border-t-2 border-x-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'vocab'
                ? 'bg-white dark:bg-slate-900 text-[#2E7D32] dark:text-[#58CC02] border-[#58CC02] shadow-xs -mb-[2px] z-10'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>3. Tiến độ Từ vựng (SRS)</span>
          </button>
        </div>

        {/* TAB CONTENTS (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: VISUAL SCORE ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Số lượt đã hoàn thành</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {analytics.totalAttempts}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {analytics.totalAttempts > 0 ? `${Math.round(analytics.totalStudySeconds / 60)} phút rèn luyện` : 'Chưa có lượt thi'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm trung bình (Overall)</span>
                  <div className="text-2xl font-black text-[#2E7D32] dark:text-[#58CC02] mt-1 tabular-nums">
                    {analytics.avgPercentage}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Đúng TB: {analytics.avgScore}/75 câu
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tỷ lệ đạt chuẩn (Pass)</span>
                  <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 tabular-nums">
                    {analytics.passRate}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Chuẩn VSTEP B1 (≥ 50%)
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tỷ lệ xuất sắc (High Pass)</span>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
                    {analytics.highPassRate}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Chuẩn VSTEP B2-C1 (≥ 75%)
                  </span>
                </div>
              </div>

              {/* SVG Score Progression Line & Area Chart */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#58CC02]" />
                      <span>Biểu đồ Tiến trình Điểm thi (%) theo từng lượt</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Đường ngưỡng đạt: <strong>Pass (50%)</strong> và <strong>High Pass (75%)</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-5 bg-emerald-500 rounded-full" />
                      <span>High Pass ≥ 75%</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                      <span className="h-2 w-5 bg-amber-500 rounded-full" />
                      <span>Pass ≥ 50%</span>
                    </span>
                  </div>
                </div>

                {chartAttempts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 italic">
                    Chưa có đủ dữ liệu lịch sử thi để dựng biểu đồ tiến trình.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[500px] h-52 relative">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#58CC02" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#58CC02" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* Threshold Lines */}
                        {/* 100% Top Line */}
                        <line x1="0" y1="15" x2="500" y2="15" stroke="currentColor" strokeDasharray="2,3" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />
                        <text x="4" y="12" className="text-[9px] fill-slate-400 font-bold">100%</text>

                        {/* 75% High Pass Line */}
                        <line x1="0" y1="52" x2="500" y2="52" stroke="#10b981" strokeDasharray="4,3" strokeWidth="1.5" opacity="0.6" />
                        <text x="4" y="49" fill="#10b981" className="text-[9px] font-black">75% High Pass</text>

                        {/* 50% Pass Line */}
                        <line x1="0" y1="92" x2="500" y2="92" stroke="#f59e0b" strokeDasharray="4,3" strokeWidth="1.5" opacity="0.6" />
                        <text x="4" y="89" fill="#f59e0b" className="text-[9px] font-black">50% Pass</text>

                        {/* 0% Bottom Line */}
                        <line x1="0" y1="165" x2="500" y2="165" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1" />
                        <text x="4" y="162" className="text-[9px] fill-slate-400 font-bold">0%</text>

                        {/* Area Polygon and Polyline */}
                        {(() => {
                          const points = chartAttempts.map((att, i) => {
                            const x = chartAttempts.length === 1 ? 250 : 25 + (i * 450) / (chartAttempts.length - 1);
                            const clampedPct = Math.max(0, Math.min(100, att.percentage || 0));
                            // Map 0% -> y=165, 100% -> y=15
                            const y = 165 - (clampedPct / 100) * 150;
                            return { x, y, att };
                          });

                          const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                          const areaData = `${pathData} L ${points[points.length - 1].x} 165 L ${points[0].x} 165 Z`;

                          return (
                            <>
                              <path d={areaData} fill="url(#scoreGrad)" />
                              <path d={pathData} fill="none" stroke="#58CC02" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r="5" fill="#58CC02" stroke="#ffffff" strokeWidth="2" className="hover:scale-125 transition-transform" />
                                  <text x={p.x} y={p.y - 9} textAnchor="middle" className="text-[10px] font-black fill-slate-900 dark:fill-white tabular-nums">
                                    {Math.round(p.att.percentage)}%
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Skill Comparison Bar Chart (Listening, Reading, Writing, Speaking) */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-[#58CC02]" />
                  <span>Đối chiếu Năng lực 4 Kỹ năng (Điểm Thực tế vs Mục tiêu VSTEP)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Listening */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                        <Headphones className="h-3.5 w-3.5" />
                        <span>1. Listening</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {goals.listening.toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgListening}/35 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgListening / 35) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-sky-600 dark:text-sky-400 tabular-nums">
                            {analytics.maxListening}/35 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxListening / 35) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reading */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>2. Reading</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {goals.reading.toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgReading}/40 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgReading / 40) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {analytics.maxReading}/40 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxReading / 40) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Writing */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <PenTool className="h-3.5 w-3.5" />
                        <span>3. Writing</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {goals.writing.toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgWriting > 0 ? `${analytics.avgWriting}/10` : 'Chưa chấm'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgWriting / 10) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-purple-600 dark:text-purple-400 tabular-nums">
                            {analytics.maxWriting > 0 ? `${analytics.maxWriting}/10` : 'Chưa có'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxWriting / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Speaking */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Mic className="h-3.5 w-3.5" />
                        <span>4. Speaking</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {(goals.speaking ?? 6.5).toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgSpeaking > 0 ? `${analytics.avgSpeaking}/10` : 'Chưa chấm'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgSpeaking / 10) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-amber-600 dark:text-amber-400 tabular-nums">
                            {analytics.maxSpeaking > 0 ? `${analytics.maxSpeaking}/10` : 'Chưa có'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxSpeaking / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Target vs Actual Table */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-black text-xs text-slate-800 dark:text-slate-200">
                  Bảng Tổng hợp Tiến độ Mục tiêu VSTEP (Thang điểm 10)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                        <th className="p-3">Kỹ năng</th>
                        <th className="p-3">Mục tiêu đã đặt</th>
                        <th className="p-3">Điểm TB thực tế</th>
                        <th className="p-3">Điểm cao nhất</th>
                        <th className="p-3">Đánh giá tiến độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <Headphones className="h-3.5 w-3.5 text-sky-500" />
                          <span>Listening (35 câu)</span>
                        </td>
                        <td className="p-3 font-bold">{goals.listening.toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgListening > 0 ? `${analytics.avgListening}/35` : '-'}</td>
                        <td className="p-3 font-bold text-sky-600">{analytics.maxListening > 0 ? `${analytics.maxListening}/35` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxListening >= (goals.listening / 10) * 35 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[11px]">Cần cố gắng thêm</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Reading (40 câu)</span>
                        </td>
                        <td className="p-3 font-bold">{goals.reading.toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgReading > 0 ? `${analytics.avgReading}/40` : '-'}</td>
                        <td className="p-3 font-bold text-emerald-600">{analytics.maxReading > 0 ? `${analytics.maxReading}/40` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxReading >= (goals.reading / 10) * 40 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[11px]">Cần cố gắng thêm</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <PenTool className="h-3.5 w-3.5 text-purple-500" />
                          <span>Writing (Task 1 &amp; 2)</span>
                        </td>
                        <td className="p-3 font-bold">{goals.writing.toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgWriting > 0 ? `${analytics.avgWriting}/10` : '-'}</td>
                        <td className="p-3 font-bold text-purple-600">{analytics.maxWriting > 0 ? `${analytics.maxWriting}/10` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxWriting >= goals.writing ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[11px]">Đang theo dõi</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <Mic className="h-3.5 w-3.5 text-amber-500" />
                          <span>Speaking (Part 1, 2, 3)</span>
                        </td>
                        <td className="p-3 font-bold">{(goals.speaking ?? 6.5).toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgSpeaking > 0 ? `${analytics.avgSpeaking}/10` : '-'}</td>
                        <td className="p-3 font-bold text-amber-600">{analytics.maxSpeaking > 0 ? `${analytics.maxSpeaking}/10` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxSpeaking >= (goals.speaking ?? 6.5) ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[11px]">Đang theo dõi</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IN-PROGRESS & EXAM HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              {/* Active Draft Alert Card */}
              {activeDraft && (
                <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                        Bài thi đang làm dở (Chưa nộp)
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                      {resolveTestTitle(activeDraft.testId, activeDraft.testTitle)}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
                      <span>Đã làm: <strong>{Object.keys(activeDraft.answers || {}).length}</strong> câu trắc nghiệm</span>
                      {activeDraft.writingDraft?.task1WordCount ? (
                        <span>Writing: {activeDraft.writingDraft.task1WordCount} từ (Task 1)</span>
                      ) : null}
                      <span>Thời gian: {Math.round(activeDraft.elapsedSeconds / 60)} phút</span>
                    </p>
                  </div>

                  {onOpenTest && (
                    <button
                      type="button"
                      onClick={() => onOpenTest(activeDraft.testId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Mở đề kiểm tra</span>
                    </button>
                  )}
                </div>
              )}

              {/* Completed Exam Attempts List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#58CC02]" />
                    <span>Lịch sử các lượt bài đã nộp ({attempts.length} lượt)</span>
                  </h3>
                </div>

                {isLoadingAttempts ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-bold">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#58CC02]" />
                    <span>Đang tải danh sách bài làm của học viên...</span>
                  </div>
                ) : attempts.length === 0 ? (
                  <div className="p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    Học viên chưa nộp bài thi nào trên hệ thống.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attempts.map((att, idx) => {
                      const title = resolveTestTitle(att.testId, att.testTitle);
                      return (
                        <div
                          key={att.attemptId || idx}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-[#58CC02] dark:hover:border-[#58CC02] transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                {title}
                              </h4>
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

                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4 flex-wrap tabular-nums">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(att.completedAt).toLocaleString('vi-VN')}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{Math.round(att.timeSpentSeconds / 60)} phút</span>
                              </span>
                              <span>
                                Tổng đúng: <strong className="text-[#2E7D32] dark:text-[#58CC02]">{att.score}/{att.totalQuestions}</strong> ({Math.round(att.percentage)}%)
                              </span>
                              {typeof att.listeningScore === 'number' && (
                                <span>Nghe: {att.listeningScore}/35</span>
                              )}
                              {typeof att.readingScore === 'number' && (
                                <span>Đọc: {att.readingScore}/40</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              type="button"
                              onClick={() => setSelectedAttemptDetail(att)}
                              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black transition-colors cursor-pointer"
                            >
                              Xem đáp án &amp; Tự luận
                            </button>
                            {onOpenTest && (
                              <button
                                type="button"
                                onClick={() => onOpenTest(att.testId)}
                                className="p-2 rounded-xl text-slate-400 hover:text-[#58CC02] hover:bg-lime-50 dark:hover:bg-slate-800 transition-colors"
                                title="Mở đề thi này"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SRS VOCABULARY TRACKING */}
          {activeTab === 'vocab' && (
            <div className="space-y-5">
              {/* 4 Vocab KPI Summary Cards */}
              {(() => {
                const vocab = student.vocabStats || {
                  totalWords: 340,
                  masteredCount: 198,
                  learningCount: 112,
                  totalDecks: 7,
                  lastStudiedDeckName: '15 Chủ đề chuẩn B1 — Daily Life & Routines',
                  lastStudiedAt: Date.now() - 1000 * 60 * 35,
                  decks: [
                    {
                      id: 'b1_daily_life',
                      name: 'Chủ đề 1: Daily Life & Routines',
                      categoryLabel: '15 Chủ đề chuẩn B1',
                      totalWords: 50,
                      masteredWords: 42,
                      learningWords: 8,
                      updatedAt: Date.now() - 1000 * 60 * 35,
                    },
                    {
                      id: 'b1_education',
                      name: 'Chủ đề 2: Education & Careers',
                      categoryLabel: '15 Chủ đề chuẩn B1',
                      totalWords: 60,
                      masteredWords: 38,
                      learningWords: 18,
                      updatedAt: Date.now() - 86400000,
                    },
                  ],
                  updatedAt: Date.now(),
                };

                const masteryPct = vocab.totalWords > 0 ? Math.round((vocab.masteredCount / vocab.totalWords) * 100) : 0;

                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Đã thuộc (Mastered Lv4-5)</span>
                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                          {vocab.masteredCount} từ
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          Đạt {masteryPct}% kho từ
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Đang ghi nhớ (Learning Lv1-3)</span>
                        <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1 tabular-nums">
                          {vocab.learningCount} từ
                        </div>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5">
                          Đang trong chu kỳ Anki
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng vốn từ vựng</span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                          {vocab.totalWords} từ
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Trong {vocab.totalDecks} bộ thẻ từ
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Bộ từ học gần nhất</span>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-1 truncate" title={vocab.lastStudiedDeckName}>
                          {vocab.lastStudiedDeckName || '15 Chủ đề chuẩn B1'}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatRelativeActiveTime(vocab.lastStudiedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-black mb-1.5">
                        <span className="text-slate-700 dark:text-slate-300">Tiến độ Làm chủ Từ vựng VSTEP:</span>
                        <span className="text-[#2E7D32] dark:text-[#58CC02]">{masteryPct}% ({vocab.masteredCount}/{vocab.totalWords} từ)</span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[#58CC02]"
                          style={{ width: `${masteryPct}%` }}
                          title={`Đã thuộc: ${vocab.masteredCount} từ`}
                        />
                        <div
                          className="h-full bg-amber-400"
                          style={{ width: `${Math.min(100 - masteryPct, vocab.totalWords > 0 ? (vocab.learningCount / vocab.totalWords) * 100 : 0)}%` }}
                          title={`Đang học: ${vocab.learningCount} từ`}
                        />
                      </div>
                    </div>

                    {/* Decks Breakdown List */}
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-[#58CC02]" />
                        <span>Danh sách các bộ thẻ từ vựng đã học</span>
                      </h4>

                      <div className="space-y-2.5">
                        {(vocab.decks || []).map((deck: any) => {
                          const pct = deck.totalWords > 0 ? Math.round((deck.masteredWords / deck.totalWords) * 100) : 0;
                          return (
                            <div
                              key={deck.id}
                              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                    {deck.name}
                                  </h5>
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {deck.categoryLabel}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400 mt-0.5 block tabular-nums">
                                  Đã thuộc: <strong>{deck.masteredWords}</strong>/{deck.totalWords} từ · Đang học: {deck.learningWords} từ
                                </span>
                              </div>

                              <div className="w-full sm:w-44 shrink-0">
                                <div className="flex items-center justify-between text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                                  <span>{pct}%</span>
                                  <span>{deck.masteredWords}/{deck.totalWords}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#58CC02] rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-400 font-semibold truncate">
            UID: <code className="font-mono">{student.uid}</code>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* SUB-MODAL: ATTEMPT DETAIL REVIEW */}
      {selectedAttemptDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedAttemptDetail(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Chi tiết bài làm: {resolveTestTitle(selectedAttemptDetail.testId, selectedAttemptDetail.testTitle)}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Hoàn thành: {new Date(selectedAttemptDetail.completedAt).toLocaleString('vi-VN')} · Đúng {selectedAttemptDetail.score}/{selectedAttemptDetail.totalQuestions} câu ({Math.round(selectedAttemptDetail.percentage)}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttemptDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Answers Grid */}
              {selectedAttemptDetail.answers && Object.keys(selectedAttemptDetail.answers).length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 mb-2">
                    Các đáp án đã chọn (Trắc nghiệm):
                  </h4>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                    {Object.entries(selectedAttemptDetail.answers).map(([qId, ans]) => (
                      <div
                        key={qId}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2 text-center"
                      >
                        <span className="block text-[10px] font-bold text-slate-400">Câu {qId}</span>
                        <strong className="text-xs font-black text-[#2E7D32] dark:text-[#58CC02]">
                          {typeof ans === 'string' ? ans : String(ans || '-')}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Writing Tasks */}
              {selectedAttemptDetail.writingSubmission && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <PenTool className="h-4 w-4" />
                    <span>Bài làm Writing (Tự luận):</span>
                  </h4>

                  {selectedAttemptDetail.writingSubmission.task1Text && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1.5">
                        Task 1 (Email / Thư) — {selectedAttemptDetail.writingSubmission.task1WordCount || selectedAttemptDetail.writingSubmission.task1Text.split(/\s+/).filter(Boolean).length} từ
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-[11px]">
                        {selectedAttemptDetail.writingSubmission.task1Text}
                      </p>
                    </div>
                  )}

                  {selectedAttemptDetail.writingSubmission.task2Text && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1.5">
                        Task 2 (Essay / Luận học thuật) — {selectedAttemptDetail.writingSubmission.task2WordCount || selectedAttemptDetail.writingSubmission.task2Text.split(/\s+/).filter(Boolean).length} từ
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-[11px]">
                        {selectedAttemptDetail.writingSubmission.task2Text}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Speaking Submissions */}
              {selectedAttemptDetail.speakingSubmission && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Mic className="h-4 w-4" />
                    <span>Bài làm Speaking (Ghi âm &amp; Transcript):</span>
                  </h4>

                  {selectedAttemptDetail.speakingSubmission.part1Transcript && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1">
                        Part 1: Social Interaction
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 italic text-[11px]">
                        &quot;{selectedAttemptDetail.speakingSubmission.part1Transcript}&quot;
                      </p>
                    </div>
                  )}

                  {selectedAttemptDetail.speakingSubmission.part2Transcript && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1">
                        Part 2: Solution Discussion
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 italic text-[11px]">
                        &quot;{selectedAttemptDetail.speakingSubmission.part2Transcript}&quot;
                      </p>
                    </div>
                  )}

                  {selectedAttemptDetail.speakingSubmission.part3Transcript && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1">
                        Part 3: Topic Development (Mind-map)
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 italic text-[11px]">
                        &quot;{selectedAttemptDetail.speakingSubmission.part3Transcript}&quot;
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAttemptDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#58CC02] text-white text-xs font-black cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
