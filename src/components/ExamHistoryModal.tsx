import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Headphones,
  BookOpen,
  Calendar,
  Award,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Play,
  Eye,
  Filter,
  FileText,
  BarChart3,
  PenTool,
  Mic,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchUserAttempts } from '../services/examService';
import { InProgressAttempt, TestMetadata, UserExamAttempt } from '../types/exam';

interface ExamHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  tests?: TestMetadata[];
  inProgressMap?: Record<string, InProgressAttempt>;
  onResumeTest?: (testId: string) => void;
  onRestartTest?: (testId: string) => void;
  onRetakeTest?: (testId: string) => void;
  onReviewAttempt?: (attempt: UserExamAttempt) => void;
}

export const ExamHistoryModal: React.FC<ExamHistoryModalProps> = ({
  isOpen,
  onClose,
  tests = [],
  inProgressMap = {},
  onResumeTest,
  onRestartTest,
  onRetakeTest,
  onReviewAttempt,
}) => {
  const { currentUser } = useAuth();
  const [attempts, setAttempts] = useState<UserExamAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTestFilter, setSelectedTestFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen) return;

    const loadAttempts = async () => {
      setLoading(true);
      try {
        const uid = currentUser?.uid || 'guest';
        const data = await fetchUserAttempts(uid);
        setAttempts(data);
      } finally {
        setLoading(false);
      }
    };

    loadAttempts();
  }, [isOpen, currentUser]);

  // Group attempts by testId
  const attemptsByTest = useMemo(() => {
    const grouped: Record<string, { testId: string; testTitle: string; list: UserExamAttempt[] }> = {};
    attempts.forEach((a) => {
      if (!grouped[a.testId]) {
        const matchedTest = tests.find((t) => t.id === a.testId);
        grouped[a.testId] = {
          testId: a.testId,
          testTitle: a.testTitle || matchedTest?.title || a.testId,
          list: [],
        };
      }
      grouped[a.testId].list.push(a);
    });

    // Sort each test's attempts chronologically (oldest -> newest) for attempt numbering & chart
    Object.values(grouped).forEach((group) => {
      group.list.sort((a, b) => Number(a.completedAt) - Number(b.completedAt));
    });

    return grouped;
  }, [attempts, tests]);

  // Default chart test selection: if selectedTestFilter is 'ALL', pick the test with the most attempts for the chart
  const chartTestId = useMemo(() => {
    if (selectedTestFilter !== 'ALL' && attemptsByTest[selectedTestFilter]) {
      return selectedTestFilter;
    }
    const groups = Object.values(attemptsByTest);
    if (groups.length === 0) return '';
    const sortedGroups = [...groups].sort((a, b) => b.list.length - a.list.length);
    return sortedGroups[0].testId;
  }, [selectedTestFilter, attemptsByTest]);

  const activeChartGroup = chartTestId ? attemptsByTest[chartTestId] : undefined;

  // Filtered attempts list (newest first for display)
  const displayedAttempts = useMemo(() => {
    const filtered =
      selectedTestFilter === 'ALL'
        ? attempts
        : attempts.filter((a) => a.testId === selectedTestFilter);
    return [...filtered].sort((a, b) => Number(b.completedAt) - Number(a.completedAt));
  }, [attempts, selectedTestFilter]);

  // Helper to get chronological attempt number (Lần 1, Lần 2...) for a specific attempt
  const getAttemptNumber = (attempt: UserExamAttempt): number => {
    const group = attemptsByTest[attempt.testId];
    if (!group) return 1;
    const idx = group.list.findIndex((x) => x.attemptId === attempt.attemptId);
    return idx >= 0 ? idx + 1 : 1;
  };

  const getPreviousAttemptDelta = (attempt: UserExamAttempt): number | null => {
    const group = attemptsByTest[attempt.testId];
    if (!group) return null;
    const idx = group.list.findIndex((x) => x.attemptId === attempt.attemptId);
    if (idx <= 0) return null;
    return attempt.score - group.list[idx - 1].score;
  };

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}p ${secs}s`;
  };

  const formatDateTime = (ts: number | string) => {
    try {
      return new Date(ts).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(ts);
    }
  };

  const inProgressEntries = Object.values(inProgressMap).filter(
    (item) => Object.keys(item.answers || {}).length > 0 || item.elapsedSeconds > 15
  );

  // Compute SVG chart points for activeChartGroup
  const chartAttempts = activeChartGroup?.list || [];
  const svgWidth = 680;
  const svgHeight = 210;
  const padLeft = 42;
  const padRight = 28;
  const padTop = 24;
  const padBottom = 36;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const maxScore = 75;

  const chartPoints = chartAttempts.map((att, idx) => {
    const count = chartAttempts.length;
    const x =
      count === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (count - 1)) * plotW;
    const clampedScore = Math.max(0, Math.min(maxScore, att.score));
    const y = padTop + plotH - (clampedScore / maxScore) * plotH;
    return { x, y, attempt: att, attemptNumber: idx + 1 };
  });

  const polylinePoints = chartPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const areaPoints =
    chartPoints.length > 1
      ? `${chartPoints[0].x},${padTop + plotH} ${polylinePoints} ${
          chartPoints[chartPoints.length - 1].x
        },${padTop + plotH}`
      : '';

  const passLineY = padTop + plotH - (30 / maxScore) * plotH;

  // Trend summary for activeChartGroup
  const firstScore = chartAttempts.length > 0 ? chartAttempts[0].score : 0;
  const latestScore =
    chartAttempts.length > 0 ? chartAttempts[chartAttempts.length - 1].score : 0;
  const bestScore =
    chartAttempts.length > 0 ? Math.max(...chartAttempts.map((a) => a.score)) : 0;
  const overallDelta = chartAttempts.length >= 2 ? latestScore - firstScore : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#58CC02] to-[#46A302] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center border border-white/25 shadow-inner">
              <History className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                Lịch Sử Bài Thi & Phân Tích Tiến Độ
              </h2>
              <p className="text-xs text-white/90 font-bold">
                {currentUser
                  ? `Tài khoản: ${currentUser.displayName || currentUser.email}`
                  : 'Lưu trữ trên trình duyệt này'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/80 space-y-6">
          {/* 1. In-Progress Attempts Section */}
          {inProgressEntries.length > 0 && (
            <div className="bg-amber-50/90 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700/70 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    Bài thi đang làm dở ({inProgressEntries.length})
                  </h3>
                </div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  Đã tự động lưu tiến độ
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {inProgressEntries.map((prog) => {
                  const matchedTest = tests.find((t) => t.id === prog.testId);
                  const answeredCount = Object.keys(prog.answers || {}).length;
                  return (
                    <div
                      key={prog.testId}
                      className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-amber-200 dark:border-amber-800/60 flex flex-col justify-between gap-3 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-black text-slate-900 dark:text-white text-sm truncate">
                            {matchedTest?.title || prog.testId}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[11px] font-black whitespace-nowrap">
                            {answeredCount}/75 câu
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          Đã làm {formatDuration(prog.elapsedSeconds)} · Lưu lúc{' '}
                          {formatDateTime(prog.savedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {onResumeTest && (
                          <button
                            onClick={() => {
                              onClose();
                              onResumeTest(prog.testId);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs shadow-[0_3px_0_#d97706] active:translate-y-0.5 transition-all whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            Làm tiếp
                          </button>
                        )}
                        {onRestartTest && (
                          <button
                            onClick={() => {
                              onClose();
                              onRestartTest(prog.testId);
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Làm lại từ đầu
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 font-bold">
              Đang tải lịch sử bài làm...
            </div>
          ) : attempts.length === 0 ? (
            <div className="py-14 text-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8">
              <Award className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-black text-slate-700 dark:text-slate-200 mb-1">
                Chưa có bài thi nào hoàn thành
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Khi bạn nộp bài thi thử hoặc luyện tập, toàn bộ điểm số, biểu đồ tiến bộ và đáp án chi tiết của từng lần thi sẽ được lưu tại đây.
              </p>
            </div>
          ) : (
            <>
              {/* 2. Test Filter Bar & Line Chart */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#58CC02]/15 text-[#58CC02] flex items-center justify-center">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        Biểu Đồ Xu Hướng Điểm Số Theo Lần Thi
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Theo dõi điểm tăng hay giảm qua từng lần làm lại cùng một đề
                      </p>
                    </div>
                  </div>

                  {/* Filter Selector */}
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                    <select
                      value={selectedTestFilter}
                      onChange={(e) => setSelectedTestFilter(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#58CC02]"
                    >
                      <option value="ALL">
                        Tất cả đề thi ({attempts.length} lần làm)
                      </option>
                      {Object.values(attemptsByTest).map((group) => (
                        <option key={group.testId} value={group.testId}>
                          {group.testTitle} ({group.list.length} lần)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quick test pills when multiple tests exist */}
                {Object.values(attemptsByTest).length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                      onClick={() => setSelectedTestFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                        selectedTestFilter === 'ALL'
                          ? 'bg-[#58CC02] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Tất cả ({attempts.length})
                    </button>
                    {Object.values(attemptsByTest).map((group) => (
                      <button
                        key={group.testId}
                        onClick={() => setSelectedTestFilter(group.testId)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                          selectedTestFilter === group.testId ||
                          (selectedTestFilter === 'ALL' && chartTestId === group.testId)
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-[#46A302] dark:text-[#58CC02] border border-[#58CC02]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {group.testTitle} · {group.list.length} lần
                      </button>
                    ))}
                  </div>
                )}

                {/* Chart Summary Metrics */}
                {activeChartGroup && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Đề đang hiển thị biểu đồ
                      </div>
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate mt-0.5">
                        {activeChartGroup.testTitle}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Tổng số lần làm đề này
                      </div>
                      <div className="text-base font-black text-[#58CC02] mt-0.5">
                        {chartAttempts.length} lần
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Điểm cao nhất / Gần nhất
                      </div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                        {bestScore}/75{' '}
                        <span className="text-xs font-bold text-slate-400">
                          (Gần nhất: {latestScore}/75)
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        Xu hướng so với Lần 1
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {chartAttempts.length < 2 ? (
                          <span className="text-xs font-bold text-slate-400">
                            Cần làm thêm lần 2
                          </span>
                        ) : overallDelta > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-black text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="w-4 h-4" /> +{overallDelta} câu
                          </span>
                        ) : overallDelta < 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-black text-rose-600 dark:text-rose-400">
                            <TrendingDown className="w-4 h-4" /> {overallDelta} câu
                          </span>
                        ) : (
                          <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                            Giữ nguyên ({latestScore}/75)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* SVG Line Chart */}
                {chartPoints.length > 0 && (
                  <div className="w-full overflow-x-auto bg-slate-50/70 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800">
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="w-full h-48 min-w-[460px]"
                    >
                      <defs>
                        <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#58CC02" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#58CC02" stopOpacity="0.02" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Grid Lines (0, 15, 30 Pass B1, 45, 75) */}
                      {[0, 15, 30, 45, 75].map((val) => {
                        const y = padTop + plotH - (val / maxScore) * plotH;
                        const isPassLine = val === 30;
                        return (
                          <g key={val}>
                            <line
                              x1={padLeft}
                              y1={y}
                              x2={svgWidth - padRight}
                              y2={y}
                              stroke={isPassLine ? '#10b981' : '#94a3b8'}
                              strokeOpacity={isPassLine ? 0.6 : 0.2}
                              strokeWidth={isPassLine ? 1.5 : 1}
                              strokeDasharray={isPassLine ? '5 4' : undefined}
                            />
                            <text
                              x={padLeft - 8}
                              y={y + 4}
                              textAnchor="end"
                              className="fill-slate-400 dark:fill-slate-500 text-[10px] font-bold"
                            >
                              {val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Pass threshold label */}
                      <text
                        x={svgWidth - padRight - 4}
                        y={passLineY - 5}
                        textAnchor="end"
                        className="fill-emerald-600 dark:fill-emerald-400 text-[9px] font-black"
                      >
                        Mốc Đạt B1 (4.0/10 ≈ 30/75)
                      </text>

                      {/* Area fill */}
                      {chartPoints.length > 1 && (
                        <polygon points={areaPoints} fill="url(#scoreAreaGrad)" />
                      )}

                      {/* Line path */}
                      {chartPoints.length > 1 && (
                        <polyline
                          fill="none"
                          stroke="#58CC02"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={polylinePoints}
                        />
                      )}

                      {/* Data points */}
                      {chartPoints.map((pt) => {
                        const passed = pt.attempt.grade !== 'Fail' && pt.attempt.percentage >= 50;
                        return (
                          <g key={pt.attempt.attemptId}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={6}
                              className={
                                passed
                                  ? 'fill-[#58CC02] stroke-white dark:stroke-slate-900'
                                  : 'fill-rose-500 stroke-white dark:stroke-slate-900'
                              }
                              strokeWidth={2.5}
                            />
                            {/* Score label above point */}
                            <text
                              x={pt.x}
                              y={pt.y - 11}
                              textAnchor="middle"
                              className="fill-slate-800 dark:fill-slate-100 text-[11px] font-black"
                            >
                              {pt.attempt.score}/{pt.attempt.totalQuestions || 75}
                            </text>
                            {/* Attempt number on X axis */}
                            <text
                              x={pt.x}
                              y={svgHeight - 10}
                              textAnchor="middle"
                              className="fill-slate-500 dark:fill-slate-400 text-[10px] font-extrabold"
                            >
                              Lần {pt.attemptNumber}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                )}
              </div>

              {/* 3. Detailed Attempt History Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Chi Tiết Từng Lần Làm Bài ({displayedAttempts.length} lượt)
                  </h3>
                </div>

                {displayedAttempts.map((attempt) => {
                  const attemptNum = getAttemptNumber(attempt);
                  const totalForTest = attemptsByTest[attempt.testId]?.list.length || 1;
                  const delta = getPreviousAttemptDelta(attempt);
                  const passed = attempt.grade !== 'Fail' && attempt.percentage >= 50;
                  const hasDetailedAnswers =
                    attempt.answers && Object.keys(attempt.answers).length > 0;

                  return (
                    <div
                      key={attempt.attemptId}
                      className="bg-white dark:bg-slate-900 rounded-2xl p-5 border-2 border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-[#58CC02]/60 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#58CC02]/15 text-[#46A302] dark:text-[#58CC02] text-xs font-black">
                              Lần #{attemptNum} / {totalForTest} lần
                            </span>
                            <h4 className="font-black text-slate-900 dark:text-white text-base">
                              {attempt.testTitle}
                            </h4>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                                passed
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              {passed ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              {passed ? `PASS (${attempt.grade})` : 'FAIL (Chưa đạt)'}
                            </span>

                            {delta !== null && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black ${
                                  delta > 0
                                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                    : delta < 0
                                    ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {delta > 0
                                  ? `+${delta} câu so với lần trước`
                                  : delta < 0
                                  ? `${delta} câu so với lần trước`
                                  : 'Bằng điểm lần trước'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              Ngày giờ thi: {formatDateTime(attempt.completedAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Thời gian làm: {formatDuration(attempt.timeSpentSeconds)}
                            </span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <div className="text-2xl font-black text-slate-900 dark:text-white">
                            {typeof attempt.vstepBandScore === 'number'
                              ? `${attempt.vstepBandScore.toFixed(1)} / 10.0`
                              : `${attempt.score}/${attempt.totalQuestions || 75}`}{' '}
                            <span className="text-sm font-black text-[#58CC02]">
                              ({Math.round(attempt.percentage)}%)
                            </span>
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Điểm VSTEP Thang 10 ({attempt.score}/{attempt.totalQuestions || 75} câu)
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
                            <Headphones className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              Listening
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                              {attempt.listeningScore}/35 câu
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              Reading
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                              {attempt.readingScore}/40 câu
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <PenTool className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              Writing
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                              {typeof attempt.writingScore === 'number'
                                ? `${((attempt.writingScore / 24) * 10).toFixed(1)}/10`
                                : '—'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <Mic className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              Speaking
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                              {typeof attempt.speakingScore === 'number'
                                ? `${attempt.speakingScore.toFixed(1)}/10`
                                : '—'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Footer: Review Attempt & Retake Test */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          {hasDetailedAnswers
                            ? `Đã lưu chi tiết ${Object.keys(attempt.answers || {}).length} câu trả lời`
                            : 'Bản ghi điểm tổng hợp'}
                        </div>

                        <div className="flex items-center gap-2">
                          {onReviewAttempt && (
                            <button
                              onClick={() => {
                                onClose();
                                onReviewAttempt(attempt);
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-200 hover:text-[#46A302] dark:hover:text-[#58CC02] font-extrabold text-xs border border-slate-200 dark:border-slate-700 transition-all whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Xem kết quả & Đáp án
                            </button>
                          )}

                          {onRetakeTest && (
                            <button
                              onClick={() => {
                                onClose();
                                onRetakeTest(attempt.testId);
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white font-black text-xs shadow-[0_3px_0_#46A302] active:translate-y-0.5 transition-all whitespace-nowrap"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Làm lại đề này
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Tổng số lần hoàn thành: <strong className="text-slate-900 dark:text-white">{attempts.length}</strong> lượt
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
