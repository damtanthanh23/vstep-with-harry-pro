import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Home,
  Award,
  Headphones,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BarChart3,
  Calendar,
  PenTool,
  Heart,
  BookMarked,
  ShieldCheck,
  AlertTriangle,
  Eye,
  ListFilter,
  MessageSquareWarning,
  GraduationCap,
  Printer,
  FileCheck2,
  TrendingUp,
  PieChart,
  Layers,
  FileText,
  Check,
  QrCode,
  RefreshCw,
  Mic,
  Volume2,
} from 'lucide-react';
import { Question, StimulusCard, getPartRelativeNumber } from '../types/exam';
import {
  calculateExamResults,
  ComprehensiveExamResult,
  evaluateWritingStrictRubric,
  DetailedWritingEvaluation,
  evaluateSpeakingStrictRubric,
  DetailedSpeakingEvaluation,
} from '../utils/scoringEngine';
import { WritingSubmission, WritingTask, SAMPLE_B1_WRITING_TASKS } from '../types/writing';
import {
  SpeakingSubmission,
  SpeakingTask,
  EMPTY_SPEAKING_SUBMISSION,
  SAMPLE_VSTEP_SPEAKING_TASKS,
} from '../types/speaking';
import { generateSmartDiagnosticReport } from '../utils/aiDiagnosticFallback';
import { QuestionStage } from './QuestionStage';
import { WritingSectionStage } from './WritingSectionStage';
import { SpeakingSectionStage } from './SpeakingSectionStage';
import { ImageZoomModal } from './ImageZoomModal';
import { StructuredExplanationBox } from './StructuredExplanationBox';
import { useAuth } from '../context/AuthContext';

interface ResultsViewProps {
  questions: Question[];
  answers: Record<number, string>;
  timeSpentSeconds: number;
  testTitle?: string;
  writingSubmission?: WritingSubmission;
  writingTasks?: WritingTask[];
  writingScores?: { task1Score: number; task2Score: number };
  initialWritingEvaluation?: DetailedWritingEvaluation;
  onWritingGraded?: (
    scores: { task1Score: number; task2Score: number },
    fullEvaluation?: DetailedWritingEvaluation
  ) => void;
  speakingSubmission?: SpeakingSubmission;
  speakingTasks?: SpeakingTask[];
  speakingScores?: {
    part1Score: number;
    part2Score: number;
    part3Score: number;
    overallBand10: number;
  };
  onSpeakingGraded?: (scores: {
    part1Score: number;
    part2Score: number;
    part3Score: number;
    overallBand10: number;
  }) => void;
  initialAiDiagnostic?: AIDiagnosticData | null;
  onAiDiagnosticGenerated?: (report: AIDiagnosticData) => void;
  onRetake: () => void;
  onBackToTests: () => void;
  onOpenFeedback?: () => void;
}

export interface AIDiagnosticData {
  strengths: string[];
  weaknesses: string[];
  writingFeedback?: {
    taskAchievement: string;
    coherence: string;
    lexicalResource: string;
    grammarAccuracy: string;
    overallAdvice: string;
  };
  studyPlan: Array<{
    week: number;
    title: string;
    focusSkills: string;
    tasks: string[];
    grammarPoints: string[];
  }>;
  recommendedResources: string[];
  encouragement: string;
}

const REVIEW_PARTS: Array<{
  id: string;
  label: string;
  section: 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING';
  partNumber: 1 | 2 | 3 | 4;
}> = [
  { id: 'L1', label: 'Listening Part 1 (Q1–8)', section: 'LISTENING', partNumber: 1 },
  { id: 'L2', label: 'Listening Part 2 (Q9–20)', section: 'LISTENING', partNumber: 2 },
  { id: 'L3', label: 'Listening Part 3 (Q21–35)', section: 'LISTENING', partNumber: 3 },
  { id: 'R1', label: 'Reading Passage 1 (Q1–10)', section: 'READING', partNumber: 1 },
  { id: 'R2', label: 'Reading Passage 2 (Q11–20)', section: 'READING', partNumber: 2 },
  { id: 'R3', label: 'Reading Passage 3 (Q21–30)', section: 'READING', partNumber: 3 },
  { id: 'R4', label: 'Reading Passage 4 (Q31–40)', section: 'READING', partNumber: 4 },
  { id: 'W1', label: 'Writing Task 1 (Thư/Email)', section: 'WRITING', partNumber: 1 },
  { id: 'W2', label: 'Writing Task 2 (Bài luận Essay)', section: 'WRITING', partNumber: 2 },
  { id: 'S1', label: 'Speaking Part 1 (Social Interaction)', section: 'SPEAKING', partNumber: 1 },
  { id: 'S2', label: 'Speaking Part 2 (Solution Discussion)', section: 'SPEAKING', partNumber: 2 },
  { id: 'S3', label: 'Speaking Part 3 (Topic Development Mind-map)', section: 'SPEAKING', partNumber: 3 },
];

export const ResultsView: React.FC<ResultsViewProps> = ({
  questions,
  answers,
  timeSpentSeconds,
  testTitle = 'VSTEP B1-B2-C1 - Practice Test 1',
  writingSubmission,
  writingTasks = SAMPLE_B1_WRITING_TASKS,
  writingScores,
  initialWritingEvaluation,
  onWritingGraded,
  speakingSubmission,
  speakingTasks = SAMPLE_VSTEP_SPEAKING_TASKS,
  speakingScores,
  initialAiDiagnostic,
  onAiDiagnosticGenerated,
  onRetake,
  onBackToTests,
  onOpenFeedback,
}) => {
  const { currentUser, isAdmin, canManageExams, signInWithGoogle } = useAuth();

  // Main Tab Navigation: 'certificate' | 'analytics' | 'review'
  const [activeMainTab, setActiveMainTab] = useState<'certificate' | 'analytics' | 'review'>('certificate');

  // Sub-style for Certificate tab: 'certificate' (Trang trọng) vs 'report' (Phiếu điểm chi tiết)
  const [certStyle, setCertStyle] = useState<'certificate' | 'report'>('certificate');

  // Review mode states
  const [reviewDisplayMode, setReviewDisplayMode] = useState<'interactive' | 'list'>('interactive');
  const [selectedReviewPartId, setSelectedReviewPartId] = useState<string>(() => {
    const firstQ = questions[0];
    if (!firstQ) return 'L1';
    return `${firstQ.section === 'LISTENING' ? 'L' : 'R'}${firstQ.partNumber}`;
  });
  const [activeReviewQuestionId, setActiveReviewQuestionId] = useState<number>(
    questions[0]?.id || 1
  );
  const [filter, setFilter] = useState<'all' | 'incorrect' | 'correct'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [zoomCard, setZoomCard] = useState<StimulusCard | null>(null);

  // Strict Writing Evaluation State (Deterministic fallback + Live AI Examiner upgrade)
  const [writingEvaluation, setWritingEvaluation] = useState<DetailedWritingEvaluation>(() =>
    initialWritingEvaluation || evaluateWritingStrictRubric(writingSubmission, writingTasks)
  );
  const [isGradingWritingAi, setIsGradingWritingAi] = useState(false);

  // Strict Speaking Evaluation State (VSTEP 5-criteria rubric on 10-point scale)
  const [speakingEvaluation, setSpeakingEvaluation] = useState<DetailedSpeakingEvaluation>(() =>
    evaluateSpeakingStrictRubric(speakingSubmission, speakingTasks)
  );

  // Keep deterministic rubric in sync if writingSubmission or speakingSubmission changes
  useEffect(() => {
    if (initialWritingEvaluation) {
      setWritingEvaluation(initialWritingEvaluation);
      return;
    }
    const baseEval = evaluateWritingStrictRubric(writingSubmission, writingTasks);
    setWritingEvaluation(baseEval);
  }, [writingSubmission, writingTasks, initialWritingEvaluation]);

  useEffect(() => {
    const baseSpeakEval = evaluateSpeakingStrictRubric(speakingSubmission, speakingTasks);
    setSpeakingEvaluation(baseSpeakEval);
  }, [speakingSubmission, speakingTasks]);

  const handleTriggerAiWritingGrader = async () => {
    if (!writingSubmission) return;
    const hasEssay =
      writingSubmission.task1Text.trim().length > 0 ||
      writingSubmission.task2Text.trim().length > 0;
    if (!hasEssay) return;

    setIsGradingWritingAi(true);
    try {
      const response = await fetch('/api/ai/grade-writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writingSubmission,
          writingTasks,
        }),
      });
      if (response.ok) {
        const aiEval: DetailedWritingEvaluation = await response.json();
        if (
          typeof aiEval.task1Score === 'number' &&
          typeof aiEval.task2Score === 'number' &&
          aiEval.task1Criteria &&
          aiEval.task2Criteria
        ) {
          setWritingEvaluation(aiEval);
          onWritingGraded?.(
            {
              task1Score: aiEval.task1Score,
              task2Score: aiEval.task2Score,
            },
            aiEval
          );
        }
      }
    } catch (err) {
      console.warn('AI Writing Examiner fallback to strict deterministic rubric:', err);
    } finally {
      setIsGradingWritingAi(false);
    }
  };

  // Automatically invoke AI Writing Examiner on mount if candidate submitted writing text and not already graded
  useEffect(() => {
    if (!writingSubmission || initialWritingEvaluation) return;
    const hasEssay =
      writingSubmission.task1Text.trim().length > 0 ||
      writingSubmission.task2Text.trim().length > 0;
    if (hasEssay) {
      handleTriggerAiWritingGrader();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effective writing & speaking scores passed into official VSTEP scaling engine
  const effectiveWritingScores = useMemo(() => {
    if (writingSubmission) {
      return {
        task1Score: writingEvaluation.task1Score,
        task2Score: writingEvaluation.task2Score,
      };
    }
    return writingScores;
  }, [writingSubmission, writingEvaluation.task1Score, writingEvaluation.task2Score, writingScores]);

  const effectiveSpeakingScores = useMemo(() => {
    if (speakingSubmission) {
      return {
        part1Score: speakingEvaluation.part1Score,
        part2Score: speakingEvaluation.part2Score,
        part3Score: speakingEvaluation.part3Score,
        overallBand10: speakingEvaluation.overallBand10,
      };
    }
    return speakingScores;
  }, [
    speakingSubmission,
    speakingEvaluation.part1Score,
    speakingEvaluation.part2Score,
    speakingEvaluation.part3Score,
    speakingEvaluation.overallBand10,
    speakingScores,
  ]);

  // AI Diagnostic State
  const [aiData, setAiData] = useState<AIDiagnosticData | null>(initialAiDiagnostic || null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeAiTab, setActiveAiTab] = useState<
    'strengths' | 'weaknesses' | 'writing' | 'plan' | 'resources'
  >('strengths');

  useEffect(() => {
    if (initialAiDiagnostic) {
      setAiData(initialAiDiagnostic);
    }
  }, [initialAiDiagnostic]);

  const printAreaRef = useRef<HTMLDivElement | null>(null);

  // Compute official VSTEP 4-skill scaled results and CEFR
  const results: ComprehensiveExamResult = calculateExamResults(
    questions,
    answers,
    timeSpentSeconds,
    effectiveWritingScores,
    effectiveSpeakingScores
  );

  const isQuestionCorrect = (q: Question) => {
    const userVal = (answers[q.id] || '').trim().toLowerCase();
    if (!userVal) return false;
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer.some((ans) => userVal === ans.trim().toLowerCase());
    }
    return userVal === q.correctAnswer.trim().toLowerCase();
  };

  const filteredQuestions = questions.filter((q) => {
    if (filter === 'all') return true;
    const correct = isQuestionCorrect(q);
    return filter === 'correct' ? correct : !correct;
  });

  const availableReviewParts = useMemo(() => {
    return REVIEW_PARTS.filter((part) => {
      if (part.section === 'WRITING' || part.section === 'SPEAKING') return true;
      return questions.some(
        (q) => q.section === part.section && q.partNumber === part.partNumber
      );
    });
  }, [questions]);

  const currentReviewPart = useMemo(() => {
    return (
      availableReviewParts.find((p) => p.id === selectedReviewPartId) ||
      availableReviewParts[0] ||
      REVIEW_PARTS[0]
    );
  }, [availableReviewParts, selectedReviewPartId]);

  const currentReviewPartQuestions = useMemo(() => {
    if (currentReviewPart.section === 'WRITING' || currentReviewPart.section === 'SPEAKING') return [];
    return questions.filter(
      (q) =>
        q.section === currentReviewPart.section &&
        q.partNumber === currentReviewPart.partNumber
    );
  }, [questions, currentReviewPart]);

  const getQuestionRelativeDisplay = (q: Question) => {
    const partQs = questions.filter(
      (item) => item.section === q.section && item.partNumber === q.partNumber
    );
    const rel = getPartRelativeNumber(q.id, partQs);
    const secLabel = q.section === 'LISTENING' ? `Listening Part ${q.partNumber}` : `Reading Passage ${q.partNumber}`;
    return `${secLabel} · Câu ${rel}`;
  };

  const isHighPass = results.grade === 'High Pass';
  const isPass = results.grade === 'Pass';

  const formatMinutes = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  // Candidate identifiers
  const candidateName =
    currentUser?.displayName ||
    (currentUser?.email ? currentUser.email.split('@')[0] : 'NGUYỄN ANH ĐIỆP');
  const candidateNumber = 'VSTEP-2026-01714';
  const candidateURN = '96/QĐ_20NLTA05';
  const certificateNumber = '20.01714';

  const now = new Date();
  const examDateStr = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const issueDateStr = new Date(now.getTime() + 7 * 86400000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Calculate 12-part breakdown metrics for Part-by-Part Matrix
  const partMatrixRows = useMemo(() => {
    return REVIEW_PARTS.map((part) => {
      if (part.section === 'WRITING') {
        const taskIdx = part.partNumber - 1;
        const task = writingTasks[taskIdx];
        const taskScore =
          part.partNumber === 1
            ? effectiveWritingScores?.task1Score ?? 0
            : effectiveWritingScores?.task2Score ?? 0;
        const maxMarks = task?.marks || 12;
        const pct = Math.round((taskScore / maxMarks) * 100);
        return {
          id: part.id,
          name: part.label,
          section: 'WRITING',
          total: maxMarks,
          correct: taskScore,
          wrong: maxMarks - taskScore,
          blank: 0,
          percentage: pct,
          statusLabel: pct >= 75 ? 'Xuất sắc (High Pass)' : pct >= 50 ? 'Đạt chuẩn (Pass)' : 'Cần ôn thêm',
        };
      }

      if (part.section === 'SPEAKING') {
        const partScore10 =
          part.partNumber === 1
            ? effectiveSpeakingScores?.part1Score ?? 0
            : part.partNumber === 2
            ? effectiveSpeakingScores?.part2Score ?? 0
            : effectiveSpeakingScores?.part3Score ?? 0;
        const pct = Math.round((partScore10 / 10) * 100);
        return {
          id: part.id,
          name: part.label,
          section: 'SPEAKING',
          total: 10,
          correct: Number(partScore10.toFixed(1)),
          wrong: Number(Math.max(0, 10 - partScore10).toFixed(1)),
          blank: 0,
          percentage: pct,
          statusLabel: pct >= 75 ? 'Xuất sắc (High Pass)' : pct >= 50 ? 'Đạt chuẩn (Pass)' : 'Cần ôn thêm',
        };
      }

      const partQs = questions.filter(
        (q) => q.section === part.section && q.partNumber === part.partNumber
      );
      const total = partQs.length;
      let correct = 0;
      let answered = 0;
      partQs.forEach((q) => {
        const userVal = (answers[q.id] || '').trim();
        if (userVal.length > 0) answered++;
        if (isQuestionCorrect(q)) correct++;
      });
      const wrong = answered - correct;
      const blank = total - answered;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

      return {
        id: part.id,
        name: part.label,
        section: part.section,
        total,
        correct,
        wrong,
        blank,
        percentage: pct,
        statusLabel: pct >= 75 ? 'Xuất sắc (High Pass)' : pct >= 50 ? 'Đạt chuẩn (Pass)' : 'Cần ôn thêm',
      };
    });
  }, [questions, answers, effectiveWritingScores, effectiveSpeakingScores, writingTasks]);

  // Scaled 0-100 values for official VSTEP 10-point scale
  const listeningScale100 = Math.round(results.listening.percentage);
  const readingScale100 = Math.round(results.reading.percentage);
  const writingScale100 = results.writing
    ? Math.round(results.writing.percentage)
    : 0;
  const speakingScale100 = results.speaking
    ? Math.round(results.speaking.percentage)
    : 0;

  const handlePrint = () => {
    window.print();
  };

  // Trigger Gemini AI Diagnostic
  const handleRequestAiDiagnostic = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/ai/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalScore: results.totalScaledScore,
          maxScore: results.maxScaledScore,
          cefrLevel: results.cefr.name,
          grade: results.grade,
          listeningScaled: results.listening.scaledScore,
          readingScaled: results.reading.scaledScore,
          writingScaled: results.writing?.scaledScore,
          partsBreakdown: results.parts,
          writingSubmission,
        }),
      });

      if (response.ok) {
        const data: AIDiagnosticData = await response.json();
        setAiData(data);
        onAiDiagnosticGenerated?.(data);
        return;
      }

      const fallbackData = generateSmartDiagnosticReport({
        totalScore: results.totalScaledScore,
        maxScore: results.maxScaledScore,
        cefrLevel: results.cefr.name,
        grade: results.grade,
        listeningScaled: results.listening.scaledScore,
        readingScaled: results.reading.scaledScore,
        writingScaled: results.writing?.scaledScore,
        partsBreakdown: results.parts,
        writingSubmission,
      });
      setAiData(fallbackData);
      onAiDiagnosticGenerated?.(fallbackData);
    } catch (err: unknown) {
      console.warn('Network issue reaching server AI, falling back to smart diagnostic engine:', err);
      const fallbackData = generateSmartDiagnosticReport({
        totalScore: results.totalScaledScore,
        maxScore: results.maxScaledScore,
        cefrLevel: results.cefr.name,
        grade: results.grade,
        listeningScaled: results.listening.scaledScore,
        readingScaled: results.reading.scaledScore,
        writingScaled: results.writing?.scaledScore,
        partsBreakdown: results.parts,
        writingSubmission,
      });
      setAiData(fallbackData);
      onAiDiagnosticGenerated?.(fallbackData);
    } finally {
      setIsAiLoading(false);
    }
  };

  // SVG Radial / Donut Chart Parameters
  const donutRadius = 54;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutStrokeDashoffset =
    donutCircumference - (donutCircumference * Math.min(100, Math.max(0, results.percentage))) / 100;

  return (
    <div className="min-h-screen bg-slate-100/90 dark:bg-slate-950 py-6 sm:py-8 px-3 sm:px-6 lg:px-8 text-slate-800 dark:text-slate-100 transition-colors">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Bar with Exam Meta & Global CTAs */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white dark:bg-slate-900 p-4 sm:p-5 border-2 border-slate-200 dark:border-slate-800 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#58CC02] border-b-4 border-[#46A302] text-white shadow-sm font-black text-xs">
              VSTEP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-[#3C8C02] dark:text-[#78E014]">
                  VSTEP Tutor · Khung 6 Bậc Việt Nam (B1–B2–C1)
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Thời gian: {formatMinutes(timeSpentSeconds)}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                {testTitle}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onBackToTests}
              className="btn-duo-white px-3.5 py-2 rounded-2xl text-xs"
            >
              <Home className="h-4 w-4 text-[#58CC02]" />
              <span>Kho đề</span>
            </button>

            {onOpenFeedback && !canManageExams && !isAdmin && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#58CC02] border-b-4 border-b-[#46A302] bg-[#D7FFB8]/65 dark:bg-lime-950/60 hover:bg-[#D7FFB8] px-3.5 py-2 text-xs font-black text-[#2B6601] dark:text-[#78E014] active:border-b-0 active:translate-y-1 transition-all cursor-pointer"
              >
                <MessageSquareWarning className="h-4 w-4 text-[#46A302]" />
                <span className="hidden sm:inline">Góp ý đề</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRetake}
              className="btn-duo-green px-4 py-2 rounded-2xl text-xs"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Thi lại</span>
            </button>
          </div>
        </div>

        {/* Guest result notification banner */}
        {!currentUser && (
          <div className="rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/40 p-4 sm:p-5 border-2 border-amber-300 dark:border-amber-800 border-b-4 border-b-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-[#FF9600] border-b-4 border-[#E58700] text-white flex items-center justify-center shrink-0 shadow-xs font-black">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100 flex items-center gap-2">
                  <span>Bài nộp của bạn đã được gửi an toàn lên Cloud Firestore!</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 uppercase font-black tracking-wider">
                    Chế độ Khách
                  </span>
                </h4>
                <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300 font-semibold mt-0.5 leading-relaxed">
                  Để lưu trữ vĩnh viễn vào tài khoản cá nhân, xem biểu đồ tiến trình và được Giáo viên vinh danh trên bảng vàng, hãy đăng nhập bằng tài khoản Google của bạn:
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="btn-duo-green px-5 py-2.5 rounded-2xl text-xs shrink-0"
            >
              <span>Đăng nhập Google để gắn kết bài nộp</span>
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* MAIN 3-TAB NAVIGATION BAR                                           */}
        {/* =================================================================== */}
        <div className="flex items-center gap-2 p-2 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-sm overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveMainTab('certificate')}
            className={`flex items-center gap-2 rounded-2xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
              activeMainTab === 'certificate'
                ? 'bg-[#FF9600] text-white border-2 border-[#FF9600] border-b-4 border-b-[#E58700] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800'
            }`}
          >
            <FileCheck2 className="h-4 w-4" />
            <span>Chứng Chỉ & Phiếu Điểm VSTEP (Thang 10)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('analytics')}
            className={`flex items-center gap-2 rounded-2xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
              activeMainTab === 'analytics'
                ? 'bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-4 border-b-[#46A302] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-lime-50 dark:hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Phân Tích Biểu Đồ Chuyên Sâu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('review')}
            className={`flex items-center gap-2 rounded-2xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
              activeMainTab === 'review'
                ? 'bg-[#1CB0F6] text-white border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-sky-50 dark:hover:bg-slate-800'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span>Xem Lại Chi Tiết Bài Làm ({questions.length} câu)</span>
          </button>
        </div>

        {/* =================================================================== */}
        {/* TAB 1: OFFICIAL CERTIFICATE & TEST REPORT                            */}
        {/* =================================================================== */}
        {activeMainTab === 'certificate' && (
          <div className="space-y-6">
            {/* Certificate Style Selector & Print Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white dark:bg-slate-900 p-3.5 sm:p-4 border-2 border-slate-200 dark:border-slate-800 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">
                  Chọn mẫu hiển thị:
                </span>
                <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 gap-1">
                  <button
                    type="button"
                    onClick={() => setCertStyle('certificate')}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      certStyle === 'certificate'
                        ? 'bg-[#FF9600] text-white border-b-2 border-[#E58700] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    🏆 Mẫu Chứng Chỉ Trang Trọng (Certificate)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCertStyle('report')}
                    className={`rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      certStyle === 'report'
                        ? 'bg-[#58CC02] text-white border-b-2 border-[#46A302] shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    📋 Mẫu Phiếu Báo Điểm (Test Report)
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="btn-duo-blue px-4 py-2 rounded-2xl text-xs"
                  title="In trực tiếp hoặc Lưu dưới dạng file PDF"
                >
                  <Printer className="h-4 w-4" />
                  <span>In / Lưu PDF Chứng Chỉ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMainTab('analytics')}
                  className="btn-duo-green px-4 py-2 rounded-2xl text-xs"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Xem Phân Tích Điểm</span>
                </button>
              </div>
            </div>

            {/* Print Container */}
            <div ref={printAreaRef} className="print-certificate-wrapper">
              {certStyle === 'certificate' ? (
                !results.cefr.eligibleForCertificate ? (
                  /* ========================================================= */
                  /* BELOW 4.0 / 10.0: NO VSTEP CERTIFICATE ISSUED             */
                  /* ========================================================= */
                  <div className="mx-auto max-w-3xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-md border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B] p-8 sm:p-12 text-center space-y-6">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[#FFDADC] dark:bg-rose-950/70 text-[#EA2B2B] dark:text-rose-400 border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B]">
                      <AlertTriangle className="h-10 w-10" />
                    </div>

                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFDADC] dark:bg-rose-950/60 border-2 border-[#FF4B4B] border-b-3 border-b-[#EA2B2B] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#EA2B2B] dark:text-rose-300">
                        Không Xét Bậc VSTEP · Tổng Điểm: {results.overallScore10.toFixed(1)} / 10.0 (Dưới 4.0)
                      </span>
                      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                        Bài thi chưa đạt ngưỡng cấp chứng chỉ VSTEP (Tối thiểu 4.0/10 — Bậc 3 B1)
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
                        Theo quy chế bài thi VSTEP B1–B2–C1 của Bộ Giáo dục và Đào tạo, thí sinh đạt điểm trung bình dưới <strong>4.0 / 10.0</strong> sẽ không được xét bậc (kể cả trình độ A2). Hiện tại điểm tổng kết của bạn là <strong>{results.overallScore10.toFixed(1)} / 10.0</strong>.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-left">
                      <div className="rounded-2xl bg-[#DDF4FF]/60 dark:bg-slate-800/60 border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6] p-3.5">
                        <span className="text-[10px] font-black uppercase text-[#1899D6] block">Listening (Nghe)</span>
                        <span className="font-mono text-base font-black text-[#1899D6] dark:text-sky-400">
                          {results.listeningScore10.toFixed(2)} / 10 ({results.listening.rawScore}/35)
                        </span>
                      </div>
                      <div className="rounded-2xl bg-[#D7FFB8]/60 dark:bg-slate-800/60 border-2 border-[#58CC02] border-b-4 border-b-[#46A302] p-3.5">
                        <span className="text-[10px] font-black uppercase text-[#46A302] block">Reading (Đọc)</span>
                        <span className="font-mono text-base font-black text-[#46A302] dark:text-emerald-400">
                          {results.readingScore10.toFixed(2)} / 10 ({results.reading.rawScore}/40)
                        </span>
                      </div>
                      <div className="rounded-2xl bg-[#F3E5FF]/60 dark:bg-slate-800/60 border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] p-3.5">
                        <span className="text-[10px] font-black uppercase text-[#A560E8] block">Writing (Viết)</span>
                        <span className="font-mono text-base font-black text-[#A560E8] dark:text-purple-400">
                          {results.writing ? `${(results.writingScore10 ?? 0).toFixed(2)} / 10` : 'Chưa nộp'}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-[#FFDADC]/60 dark:bg-slate-800/60 border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B] p-3.5">
                        <span className="text-[10px] font-black uppercase text-[#EA2B2B] block">Speaking (Nói)</span>
                        <span className="font-mono text-base font-black text-[#EA2B2B] dark:text-rose-400">
                          {results.speaking ? `${(results.speakingScore10 ?? 0).toFixed(2)} / 10` : 'Chưa nộp'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setCertStyle('report')}
                        className="btn-duo-blue inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black cursor-pointer"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Xem Phiếu Báo Điểm (Score Card)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveMainTab('review')}
                        className="btn-duo-white inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Eye className="h-4 w-4 text-[#1CB0F6]" />
                        <span>Xem Giải Thích Từng Câu</span>
                      </button>

                      <button
                        type="button"
                        onClick={onRetake}
                        className="btn-duo-green inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black cursor-pointer"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Thi Lại Ngay</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ========================================================= */
                  /* OFFICIAL BILINGUAL VSTEP CERTIFICATE OF PROFICIENCY       */
                  /* (Styled after user's uploaded VSTEP Certificate)          */
                  /* ========================================================= */
                  <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-[#FFFDF5] text-slate-900 shadow-2xl border-8 border-amber-300/90 p-6 sm:p-10 transition-all">
                    {/* Subtle Circular Watermark */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10"
                    >
                      <div className="h-80 w-80 rounded-full border-8 border-amber-500 flex flex-col items-center justify-center">
                        <GraduationCap className="h-28 w-28 text-amber-600" />
                        <span className="text-3xl font-black tracking-widest text-amber-700 mt-1">
                          VSTEP
                        </span>
                      </div>
                    </div>

                    {/* Bilingual Header: SOCIALIST REPUBLIC OF VIETNAM / CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM */}
                    <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 text-center border-b-2 border-amber-200/80 pb-6">
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-800">
                          SOCIALIST REPUBLIC OF VIETNAM
                        </p>
                        <p className="text-xs font-bold underline underline-offset-4 text-slate-700">
                          Independence - Freedom - Happiness
                        </p>
                        <h2 className="text-lg sm:text-xl font-black text-red-600 uppercase tracking-wide pt-3">
                          CERTIFICATE OF PROFICIENCY
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          In: <span className="font-black uppercase">ENGLISH</span>
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          Level:{' '}
                          <span className="font-black text-base text-slate-900">
                            {results.cefr.level === 'C1' ? '5 (C1)' : results.cefr.level === 'B2' ? '4 (B2)' : '3 (B1)'}
                          </span>
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-800">
                          CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                        </p>
                        <p className="text-xs font-bold underline underline-offset-4 text-slate-700">
                          Độc lập - Tự do - Hạnh phúc
                        </p>
                        <h2 className="text-lg sm:text-xl font-black text-red-600 uppercase tracking-wide pt-3">
                          CHỨNG CHỈ NGOẠI NGỮ
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          Ngôn ngữ: <span className="font-black uppercase">TIẾNG ANH</span>
                        </p>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          Bậc:{' '}
                          <span className="font-black text-base text-slate-900">
                            {results.cefr.level === 'C1' ? '5 (C1)' : results.cefr.level === 'B2' ? '4 (B2)' : '3 (B1)'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Bilingual Body */}
                    <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 text-xs sm:text-sm leading-relaxed">
                      <div className="space-y-2">
                        <p className="font-black text-center uppercase text-slate-900 mb-2">
                          VSTEP NATIONAL ASSESSMENT BOARD
                        </p>
                        <p className="text-center font-bold text-slate-600 mb-3">
                          This is to certify that
                        </p>
                        <p>
                          Full name:{' '}
                          <strong className="font-black uppercase text-slate-900 ml-2">
                            {candidateName}
                          </strong>
                        </p>
                        <p className="text-slate-700">
                          Has taken Foreign Language Proficiency Assessment Exam based on the 6-level Foreign Language Proficiency Framework for Vietnam
                        </p>
                        <p>
                          Date of Exam: <strong className="font-bold">{examDateStr}</strong>
                        </p>
                        <p className="text-sm sm:text-base font-bold pt-1">
                          Overall Score:{' '}
                          <strong className="font-black text-red-600 text-lg">
                            {results.overallScore10.toFixed(1)} / 10.0
                          </strong>
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-2 font-mono text-xs bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                          <div>
                            Listening: <strong>{results.listeningScore10.toFixed(2)}</strong>
                          </div>
                          <div>
                            Reading: <strong>{results.readingScore10.toFixed(2)}</strong>
                          </div>
                          <div>
                            Writing: <strong>{results.writing ? (results.writingScore10 ?? 0).toFixed(2) : '—'}</strong>
                          </div>
                          <div>
                            Speaking: <strong>{results.speaking ? (results.speakingScore10 ?? 0).toFixed(2) : '—'}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="font-black text-center uppercase text-slate-900 mb-2">
                          HỘI ĐỒNG KHẢO THÍ VSTEP QUỐC GIA
                        </p>
                        <p className="text-center font-bold text-slate-600 mb-3">
                          Cấp cho
                        </p>
                        <p>
                          Họ và tên:{' '}
                          <strong className="font-black uppercase text-slate-900 ml-2">
                            {candidateName}
                          </strong>
                        </p>
                        <p className="text-slate-700">
                          Đã tham dự kỳ thi đánh giá năng lực ngoại ngữ theo Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam
                        </p>
                        <p>
                          Ngày thi: <strong className="font-bold">{examDateStr}</strong>
                        </p>
                        <p className="text-sm sm:text-base font-bold pt-1">
                          Điểm thi:{' '}
                          <strong className="font-black text-red-600 text-lg">
                            {results.overallScore10.toFixed(1)} / 10.0
                          </strong>
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-2 font-mono text-xs bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                          <div>
                            Nghe: <strong>{results.listeningScore10.toFixed(2)}</strong>
                          </div>
                          <div>
                            Đọc: <strong>{results.readingScore10.toFixed(2)}</strong>
                          </div>
                          <div>
                            Viết: <strong>{results.writing ? (results.writingScore10 ?? 0).toFixed(2) : '—'}</strong>
                          </div>
                          <div>
                            Nói: <strong>{results.speaking ? (results.speakingScore10 ?? 0).toFixed(2) : '—'}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Certificate Footer */}
                    <div className="relative z-10 pt-5 border-t-2 border-amber-200/80 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end text-xs">
                      <div className="space-y-1 font-mono text-slate-700">
                        <p>
                          Số Quyết định / Decision No: <strong>10138/QĐ-VSTEP</strong>
                        </p>
                        <p>
                          Số hiệu / Certificate No:{' '}
                          <strong className="text-red-600 font-black">{certificateNumber}</strong>
                        </p>
                        <p>
                          Số vào sổ / Reference No: <strong>{candidateURN}</strong>
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <p className="italic text-slate-600">Hà Nội, {issueDateStr}</p>
                        <p className="font-black uppercase text-slate-900">
                          CHỦ TỊCH HỘI ĐỒNG KHẢO THÍ
                        </p>
                        <div className="inline-flex items-center gap-2 pt-2">
                          <div className="h-12 w-12 rounded-full border-2 border-red-600 text-red-600 flex items-center justify-center font-black text-[9px] uppercase tracking-tighter rotate-[-12deg]">
                            ĐÃ ĐỐI CHIẾU
                          </div>
                          <div className="text-left">
                            <p className="font-serif italic text-base font-bold text-slate-800">
                              Mr. Harry
                            </p>
                            <p className="text-[10px] font-bold text-slate-600">
                              VSTEP Tutor Academic Director
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                /* ========================================================= */
                /* OFFICIAL VSTEP SCORE REPORT (Thang điểm 10 - B1/B2/C1)    */
                /* ========================================================= */
                <div className="mx-auto max-w-4xl rounded-3xl bg-white text-slate-900 shadow-2xl border-4 border-slate-300 p-6 sm:p-10 space-y-6">
                  {/* Top Bar */}
                  <div className="border-t-8 border-[#58CC02] pt-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#58CC02] text-white font-black text-xs">
                        VSTEP
                      </div>
                      <span className="text-2xl font-black tracking-tight text-slate-900">
                        VSTEP <span className="text-[#58CC02]">TUTOR</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {results.cefr.name} (Thang điểm 10 Bộ GD&ĐT)
                      </span>
                      <h2 className="text-lg font-black text-slate-800">
                        PHIẾU BÁO ĐIỂM KỲ THI VSTEP (SCORE REPORT)
                      </h2>
                    </div>
                  </div>

                  {/* Section: Candidate Information */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                      Thông tin thí sinh (Candidate Information)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 border border-slate-300 rounded-xl overflow-hidden">
                      <div className="md:col-span-9 divide-y divide-slate-200 text-xs">
                        <div className="grid grid-cols-2 p-2.5 bg-slate-50">
                          <span className="font-bold text-slate-600">Họ và tên (Full Name):</span>
                          <span className="font-bold text-slate-900">{candidateName}</span>
                        </div>
                        <div className="grid grid-cols-2 p-2.5">
                          <span className="font-bold text-slate-600">Mã số bài thi (Candidate ID):</span>
                          <span className="font-mono font-bold text-slate-900">{candidateNumber}</span>
                        </div>
                        <div className="grid grid-cols-2 p-2.5 bg-slate-50">
                          <span className="font-bold text-slate-600">Số vào sổ (Reference No):</span>
                          <span className="font-mono text-slate-900">{candidateURN}</span>
                        </div>
                        <div className="grid grid-cols-2 p-2.5">
                          <span className="font-bold text-slate-600">Bậc năng lực đạt được (Achieved Level):</span>
                          <span className="font-bold text-[#EA580C]">{results.cefr.name}</span>
                        </div>
                      </div>

                      <div className="md:col-span-3 border-t md:border-t-0 md:border-l border-slate-300 p-4 flex flex-col items-center justify-center bg-slate-50 text-center">
                        <div className="h-24 w-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-white overflow-hidden shadow-2xs">
                          {currentUser?.photoURL ? (
                            <img
                              src={currentUser.photoURL}
                              alt="Candidate"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="text-center p-1">
                              <GraduationCap className="h-8 w-8 text-slate-400 mx-auto mb-1" />
                              <span className="text-[9px] font-bold text-slate-400 block uppercase leading-tight">
                                VSTEP Verified
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold mt-2">
                          KHUNG 6 BẬC VIỆT NAM
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section: Candidate Results (VSTEP 10-Point Scale) */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                      Kết quả điểm thi theo thang điểm 10 (Làm tròn 0.5 chuẩn VSTEP B1–B2–C1)
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-slate-300">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                          <tr>
                            <th className="p-3 border-r border-slate-300">Kỹ năng (Skill)</th>
                            <th className="p-3 border-r border-slate-300 text-center">Điểm Thang 10</th>
                            <th className="p-3 border-r border-slate-300 text-center">Số câu đúng / Điểm thô</th>
                            <th className="p-3 text-center">Quy đổi năng lực</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-3 font-bold border-r border-slate-200 flex items-center gap-2">
                              <Headphones className="h-4 w-4 text-sky-600" /> Listening (Nghe - 3 Parts)
                            </td>
                            <td className="p-3 font-mono font-black text-center text-sm border-r border-slate-200 text-sky-700">
                              {results.listeningScore10.toFixed(2)} / 10
                            </td>
                            <td className="p-3 font-mono text-center border-r border-slate-200">
                              {results.listening.rawScore} / 35 câu
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-700">
                              {results.listeningScore10 >= 8.5
                                ? 'Bậc 5 (C1)'
                                : results.listeningScore10 >= 6.0
                                ? 'Bậc 4 (B2)'
                                : results.listeningScore10 >= 4.0
                                ? 'Bậc 3 (B1)'
                                : 'Dưới B1 (< 4.0)'}
                            </td>
                          </tr>
                          <tr className="bg-slate-50/60">
                            <td className="p-3 font-bold border-r border-slate-200 flex items-center gap-2">
                              <BookOpen className="h-4 w-4 text-amber-600" /> Reading (Đọc - 4 Passages)
                            </td>
                            <td className="p-3 font-mono font-black text-center text-sm border-r border-slate-200 text-amber-700">
                              {results.readingScore10.toFixed(2)} / 10
                            </td>
                            <td className="p-3 font-mono text-center border-r border-slate-200">
                              {results.reading.rawScore} / 40 câu
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-700">
                              {results.readingScore10 >= 8.5
                                ? 'Bậc 5 (C1)'
                                : results.readingScore10 >= 6.0
                                ? 'Bậc 4 (B2)'
                                : results.readingScore10 >= 4.0
                                ? 'Bậc 3 (B1)'
                                : 'Dưới B1 (< 4.0)'}
                            </td>
                          </tr>
                          {results.writing && (
                            <tr>
                              <td className="p-3 font-bold border-r border-slate-200 flex items-center gap-2">
                                <PenTool className="h-4 w-4 text-emerald-600" /> Writing (Viết - Task 1 & 2)
                              </td>
                              <td className="p-3 font-mono font-black text-center text-sm border-r border-slate-200 text-emerald-700">
                                {(results.writingScore10 ?? 0).toFixed(2)} / 10
                              </td>
                              <td className="p-3 font-mono text-center border-r border-slate-200">
                                {results.writing.rawScore} / 24 (T1 + T2×2)
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-700">
                                {(results.writingScore10 ?? 0) >= 8.5
                                  ? 'Bậc 5 (C1)'
                                  : (results.writingScore10 ?? 0) >= 6.0
                                  ? 'Bậc 4 (B2)'
                                  : (results.writingScore10 ?? 0) >= 4.0
                                  ? 'Bậc 3 (B1)'
                                  : 'Dưới B1 (< 4.0)'}
                              </td>
                            </tr>
                          )}
                          {results.speaking && (
                            <tr className="bg-slate-50/60">
                              <td className="p-3 font-bold border-r border-slate-200 flex items-center gap-2">
                                <Mic className="h-4 w-4 text-rose-600" /> Speaking (Nói - Part 1, 2, 3)
                              </td>
                              <td className="p-3 font-mono font-black text-center text-sm border-r border-slate-200 text-rose-700">
                                {(results.speakingScore10 ?? 0).toFixed(2)} / 10
                              </td>
                              <td className="p-3 font-mono text-center border-r border-slate-200">
                                P1: {effectiveSpeakingScores?.part1Score.toFixed(1)} · P2: {effectiveSpeakingScores?.part2Score.toFixed(1)} · P3: {effectiveSpeakingScores?.part3Score.toFixed(1)}
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-700">
                                {(results.speakingScore10 ?? 0) >= 8.5
                                  ? 'Bậc 5 (C1)'
                                  : (results.speakingScore10 ?? 0) >= 6.0
                                  ? 'Bậc 4 (B2)'
                                  : (results.speakingScore10 ?? 0) >= 4.0
                                  ? 'Bậc 3 (B1)'
                                  : 'Dưới B1 (< 4.0)'}
                              </td>
                            </tr>
                          )}
                          <tr className="bg-lime-50/80 font-black border-t-2 border-lime-300">
                            <td className="p-3.5 text-slate-900 uppercase border-r border-lime-200 text-sm">
                              Điểm trung bình 4 Kỹ năng VSTEP (Làm tròn 0.5)
                            </td>
                            <td className="p-3.5 font-mono text-center text-lg text-[#2B6601] border-r border-lime-200">
                              {results.overallScore10.toFixed(1)} / 10.0
                            </td>
                            <td className="p-3.5 font-mono text-center border-r border-lime-200 text-slate-700">
                              {Math.round(results.percentage)}%
                            </td>
                            <td className="p-3.5 text-center text-sm text-[#EA580C]">
                              {results.cefr.name}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* VSTEP Conversion Reference Table */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-2">
                    <span className="font-black uppercase text-slate-700 block">
                      Bảng quy đổi trình độ VSTEP B1–B2–C1 (Theo quy định của Bộ GD&ĐT):
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                      <div className="rounded-lg bg-white p-2 border border-slate-200">
                        <span className="block font-mono font-black text-rose-600">0.0 – 3.5</span>
                        <span className="text-[11px] font-bold text-slate-600">Không xét bậc</span>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-slate-200">
                        <span className="block font-mono font-black text-sky-600">4.0 – 5.5</span>
                        <span className="text-[11px] font-bold text-slate-600">Bậc 3 (B1)</span>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-slate-200">
                        <span className="block font-mono font-black text-emerald-600">6.0 – 8.0</span>
                        <span className="text-[11px] font-bold text-slate-600">Bậc 4 (B2)</span>
                      </div>
                      <div className="rounded-lg bg-white p-2 border border-slate-200">
                        <span className="block font-mono font-black text-amber-600">8.5 – 10.0</span>
                        <span className="text-[11px] font-bold text-slate-600">Bậc 5 (C1)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: DETAILED ANALYTICS & PERFORMANCE CHARTS                      */}
        {/* =================================================================== */}
        {activeMainTab === 'analytics' && (
          <div className="space-y-6">
            {/* Top Row: Donut Chart + CEFR Level Card */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* SVG Donut Chart Card */}
              <div className="md:col-span-5 rounded-3xl bg-white dark:bg-slate-900 p-6 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-800 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                      Điểm Tổng Kết Thang 10
                    </span>
                    <span className="inline-flex items-center rounded-xl bg-[#D7FFB8] dark:bg-lime-950/60 border-2 border-[#58CC02] border-b-3 border-b-[#46A302] px-2.5 py-0.5 text-[11px] font-black text-[#46A302] dark:text-[#78E014]">
                      Chuẩn VSTEP Bộ GD&ĐT
                    </span>
                  </div>

                  {/* Donut SVG */}
                  <div className="relative flex items-center justify-center my-4">
                    <svg className="h-44 w-44 transform -rotate-90">
                      {/* Background track circle */}
                      <circle
                        cx="88"
                        cy="88"
                        r={donutRadius}
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-slate-100 dark:text-slate-800"
                        fill="transparent"
                      />
                      {/* Animated value arc */}
                      <circle
                        cx="88"
                        cy="88"
                        r={donutRadius}
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeDasharray={donutCircumference}
                        strokeDashoffset={donutStrokeDashoffset}
                        strokeLinecap="round"
                        className="text-[#58CC02] transition-all duration-1000 ease-out"
                        fill="transparent"
                      />
                    </svg>

                    {/* Donut Center Text */}
                    <div className="absolute text-center">
                      <span className="block text-4xl font-mono font-black text-slate-900 dark:text-white">
                        {results.overallScore10.toFixed(1)}
                      </span>
                      <span className="text-xs font-bold text-slate-400">/ 10.0 điểm</span>
                      <span className="mt-1 inline-block text-[11px] font-black uppercase tracking-wider text-[#46A302] dark:text-[#58CC02]">
                        {results.cefr.name}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-[#E5E5E5] dark:border-slate-800 pt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-[#DDF4FF]/60 dark:bg-slate-800/50 border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] p-2">
                    <span className="text-[10px] text-[#1899D6] block font-black">Bậc 3 (B1):</span>
                    <span className="font-mono font-black text-[#1899D6]">4.0 – 5.5</span>
                  </div>
                  <div className="rounded-xl bg-[#D7FFB8]/60 dark:bg-lime-950/30 border-2 border-[#58CC02] border-b-3 border-b-[#46A302] p-2">
                    <span className="text-[10px] text-[#46A302] dark:text-lime-400 block font-black">Bậc 4 (B2):</span>
                    <span className="font-mono font-black text-[#46A302]">6.0 – 8.0</span>
                  </div>
                  <div className="rounded-xl bg-[#FFF5D6] dark:bg-amber-950/30 border-2 border-[#FFC800] border-b-3 border-b-[#E5B400] p-2">
                    <span className="text-[10px] text-[#FF9600] dark:text-amber-400 block font-black">Bậc 5 (C1):</span>
                    <span className="font-mono font-black text-[#FF9600]">8.5 – 10</span>
                  </div>
                </div>
              </div>

              {/* CEFR Level Mapping & Skill Bars */}
              <div className="md:col-span-7 rounded-3xl bg-white dark:bg-slate-900 p-6 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-[#46A302] dark:text-[#78E014]">
                      Khung Năng Lực Ngoại Ngữ 6 Bậc Dùng Cho Việt Nam (VSTEP)
                    </span>
                    <span className="rounded-xl bg-[#D7FFB8] dark:bg-lime-950 text-[#46A302] dark:text-[#78E014] px-3 py-1 text-xs font-black border-2 border-[#58CC02] border-b-3 border-b-[#46A302]">
                      {results.cefr.level}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {results.cefr.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {results.cefr.description}
                  </p>
                </div>

                {/* 4 Skill Comparative Bars */}
                <div className="space-y-3 pt-3 border-t-2 border-[#E5E5E5] dark:border-slate-800">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    Điểm Thành Phần Theo Kỹ Năng (Thang điểm 10):
                  </span>

                  {/* Listening */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-black mb-1">
                      <span className="flex items-center gap-1.5 text-[#1899D6] dark:text-sky-300">
                        <Headphones className="h-3.5 w-3.5" /> Listening ({results.listening.rawScore}/35 câu đúng)
                      </span>
                      <span className="font-mono text-[#1899D6]">{results.listeningScore10.toFixed(2)} / 10</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] dark:border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-[#1CB0F6] rounded-full transition-all duration-700"
                        style={{ width: `${listeningScale100}%` }}
                      />
                    </div>
                  </div>

                  {/* Reading */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-black mb-1">
                      <span className="flex items-center gap-1.5 text-[#46A302] dark:text-emerald-300">
                        <BookOpen className="h-3.5 w-3.5" /> Reading ({results.reading.rawScore}/40 câu đúng)
                      </span>
                      <span className="font-mono text-[#46A302]">{results.readingScore10.toFixed(2)} / 10</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] dark:border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-[#58CC02] rounded-full transition-all duration-700"
                        style={{ width: `${readingScale100}%` }}
                      />
                    </div>
                  </div>

                  {/* Writing */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-black mb-1">
                      <span className="flex items-center gap-1.5 text-[#A560E8] dark:text-purple-300">
                        <PenTool className="h-3.5 w-3.5" /> Writing ({results.writing ? 'Task 1 ×1 + Task 2 ×2' : 'Chưa làm'})
                      </span>
                      <span className="font-mono text-[#A560E8]">{results.writing ? `${(results.writingScore10 ?? 0).toFixed(2)} / 10` : '0.0 / 10'}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] dark:border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-[#CE82FF] rounded-full transition-all duration-700"
                        style={{ width: `${writingScale100}%` }}
                      />
                    </div>
                  </div>

                  {/* Speaking */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-black mb-1">
                      <span className="flex items-center gap-1.5 text-[#EA2B2B] dark:text-rose-300">
                        <Mic className="h-3.5 w-3.5" /> Speaking ({results.speaking ? 'Part 1 + Part 2 + Part 3' : 'Chưa làm'})
                      </span>
                      <span className="font-mono text-[#EA2B2B]">{results.speaking ? `${(results.speakingScore10 ?? 0).toFixed(2)} / 10` : '0.0 / 10'}</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] dark:border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-[#FF4B4B] rounded-full transition-all duration-700"
                        style={{ width: `${speakingScale100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* STRICT VSTEP WRITING EXAMINER RUBRIC CARD (Duolingo 3D Purple/Green)*/}
            {/* =================================================================== */}
            {writingSubmission && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#CE82FF] dark:border-purple-800 border-b-4 border-b-[#A560E8] dark:border-b-purple-950 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b-2 border-[#F3E5FF] dark:border-purple-900/60 bg-gradient-to-r from-[#F3E5FF]/60 via-purple-50/30 to-white dark:from-slate-900 dark:to-purple-950/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CE82FF] border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] text-white shrink-0">
                      <PenTool className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                          Hội Đồng Chấm Writing Theo Rubrics VSTEP Bộ GD&ĐT (4 Tiêu Chí · Thang 10)
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                            writingEvaluation.isAiGraded
                              ? 'bg-[#D7FFB8] dark:bg-emerald-950 text-[#46A302] dark:text-emerald-300 border-2 border-[#58CC02] border-b-3 border-b-[#46A302]'
                              : 'bg-[#FFF5D6] dark:bg-amber-950 text-[#FF9600] dark:text-amber-300 border-2 border-[#FFC800] border-b-3 border-b-[#E5B400]'
                          }`}
                        >
                          <Sparkles className="h-3 w-3" />
                          {isGradingWritingAi
                            ? 'AI Giám khảo đang chấm...'
                            : writingEvaluation.isAiGraded
                            ? 'Đã chấm bởi AI Giám khảo VSTEP'
                            : 'Chấm theo Rubrics Chuẩn VSTEP'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                        Trọng số VSTEP: (Task 1 + Task 2 × 2) / 3 · Task Fulfillment · Organization · Vocabulary · Grammar
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="rounded-2xl bg-white dark:bg-slate-800 border-2 border-[#CE82FF] dark:border-purple-700 border-b-4 border-b-[#A560E8] px-4 py-2 text-right">
                      <span className="block text-[10px] font-black uppercase text-slate-400">Điểm Writing VSTEP</span>
                      <span className="font-mono text-sm font-black text-[#A560E8] dark:text-purple-300">
                        {(results.writingScore10 ?? 0).toFixed(1)} / 10 ({writingEvaluation.task1Score + writingEvaluation.task2Score}/24 raw)
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isGradingWritingAi}
                      onClick={handleTriggerAiWritingGrader}
                      className="btn-duo-green inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`h-4 w-4 ${isGradingWritingAi ? 'animate-spin' : ''}`} />
                      <span>{isGradingWritingAi ? 'Đang chấm...' : 'Chấm lại bằng AI'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {[
                    {
                      partLabel: 'Writing Part 1',
                      task: writingTasks[0],
                      text: writingSubmission.task1Text,
                      wordCount: writingSubmission.task1WordCount,
                      breakdown: writingEvaluation.task1Criteria,
                    },
                    {
                      partLabel: 'Writing Part 2',
                      task: writingTasks[1],
                      text: writingSubmission.task2Text,
                      wordCount: writingSubmission.task2WordCount,
                      breakdown: writingEvaluation.task2Criteria,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-3xl border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-5 space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b-2 border-[#E5E5E5] dark:border-slate-700 pb-3">
                          <div>
                            <span className="text-xs font-black uppercase tracking-wider text-[#A560E8] dark:text-purple-400">
                              {item.partLabel} ({item.wordCount} từ / mục tiêu {item.task?.minWords || 120}–{item.task?.maxWords || 180} từ)
                            </span>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                              {item.task?.title || item.partLabel}
                            </h4>
                          </div>
                          <div className="rounded-2xl bg-[#F3E5FF] dark:bg-purple-950 px-3.5 py-1.5 font-mono text-sm font-black text-[#A560E8] dark:text-purple-200 border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8]">
                            {item.breakdown.total} / 12
                          </div>
                        </div>

                        {/* 4 Criteria Rubric Bars */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {[
                            { label: 'Task Fulfilment', val: item.breakdown.taskFulfilment },
                            { label: 'Grammar Range & Acc.', val: item.breakdown.grammar },
                            { label: 'Vocabulary Range', val: item.breakdown.vocabulary },
                            { label: 'Organization & Cohesion', val: item.breakdown.organization },
                          ].map((crit, cIdx) => (
                            <div
                              key={cIdx}
                              className="rounded-2xl bg-white dark:bg-slate-900 p-3 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-3 border-b-[#CECECE] dark:border-b-slate-800"
                            >
                              <div className="flex items-center justify-between font-black text-[11px] mb-1.5">
                                <span className="text-slate-700 dark:text-slate-200 truncate">{crit.label}</span>
                                <span className="font-mono text-[#A560E8] dark:text-purple-400">{crit.val}/3</span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] dark:border-slate-700 overflow-hidden">
                                <div
                                  className="h-full bg-[#CE82FF] rounded-full transition-all"
                                  style={{ width: `${(crit.val / 3) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Candidate Submitted Essay Preview */}
                        <div className="rounded-2xl bg-white dark:bg-slate-900 p-3.5 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-3 border-b-[#CECECE] dark:border-b-slate-800 text-xs">
                          <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                            Bài làm đã ghi nhận của học sinh:
                          </span>
                          {item.text && item.text.trim().length > 0 ? (
                            <p className="whitespace-pre-line text-slate-700 dark:text-slate-200 font-sans leading-relaxed max-h-36 overflow-y-auto">
                              {item.text}
                            </p>
                          ) : (
                            <p className="italic font-bold text-[#EA2B2B]">Học sinh bỏ trống phần viết này (0 điểm).</p>
                          )}
                        </div>

                        {/* Examiner Commentary */}
                        <div className="rounded-2xl bg-[#D7FFB8]/40 dark:bg-emerald-950/30 border-2 border-[#58CC02] dark:border-emerald-700 border-b-4 border-b-[#46A302] p-3.5 text-xs space-y-1.5">
                          <span className="font-black text-[#46A302] dark:text-emerald-300 block">
                            Nhận xét từ Giám khảo:
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
                            {item.breakdown.feedbackVi}
                          </p>
                          {item.breakdown.improvementsVi && item.breakdown.improvementsVi.length > 0 && (
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300 pt-1">
                              {item.breakdown.improvementsVi.map((imp: string, i: number) => (
                                <li key={i}>{imp}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Corrected Sample / Upgraded Version if available */}
                        {item.breakdown.correctedSample && (
                          <div className="rounded-2xl bg-[#F3E5FF]/50 dark:bg-purple-950/30 border-2 border-[#CE82FF] dark:border-purple-800 border-b-4 border-b-[#A560E8] p-3.5 text-xs space-y-1">
                            <span className="font-black text-[#A560E8] dark:text-purple-300 block">
                              ✨ Bài sửa nâng cấp chuẩn B1 High Pass:
                            </span>
                            <p className="whitespace-pre-line text-slate-700 dark:text-slate-200 leading-relaxed">
                              {item.breakdown.correctedSample}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =================================================================== */}
            {/* VSTEP SPEAKING EXAMINER RUBRIC CARD (5 CRITERIA · THANG 10)          */}
            {/* =================================================================== */}
            {speakingSubmission && (
              <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#FF4B4B] dark:border-rose-800 border-b-4 border-b-[#EA2B2B] dark:border-b-rose-950 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b-2 border-[#FFDADC] dark:border-rose-900/60 bg-gradient-to-r from-[#FFDADC]/60 via-orange-50/30 to-white dark:from-slate-900 dark:to-rose-950/30 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF4B4B] border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B] text-white shrink-0">
                      <Mic className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                          Hội Đồng Chấm Speaking Theo Rubrics VSTEP Bộ GD&ĐT (5 Tiêu Chí · Thang 10)
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-[#FFDADC] dark:bg-rose-950 text-[#EA2B2B] dark:text-rose-300 border-2 border-[#FF4B4B] border-b-3 border-b-[#EA2B2B]">
                          <Sparkles className="h-3 w-3" />
                          Chấm Tự Động Theo 5 Tiêu Chí VSTEP
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                        5 Tiêu chí VSTEP Speaking: Grammar · Vocabulary · Pronunciation · Fluency · Discourse Management
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white dark:bg-slate-800 border-2 border-[#FF4B4B] dark:border-rose-700 border-b-4 border-b-[#EA2B2B] px-4 py-2 text-right">
                    <span className="block text-[10px] font-black uppercase text-slate-400">Điểm Speaking VSTEP</span>
                    <span className="font-mono text-sm font-black text-[#EA2B2B] dark:text-rose-300">
                      {(results.speakingScore10 ?? speakingEvaluation.overallBand10).toFixed(1)} / 10.0
                    </span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {[
                    {
                      partLabel: 'Speaking Part 1 · Social Interaction',
                      task: speakingTasks[0],
                      text: speakingSubmission.part1Text,
                      wordCount: speakingSubmission.part1WordCount,
                      audioUrl: speakingSubmission.part1AudioUrl,
                      durationSec: speakingSubmission.part1DurationSeconds,
                      breakdown: speakingEvaluation.part1Criteria,
                    },
                    {
                      partLabel: 'Speaking Part 2 · Solution Discussion',
                      task: speakingTasks[1],
                      text: speakingSubmission.part2Text,
                      wordCount: speakingSubmission.part2WordCount,
                      audioUrl: speakingSubmission.part2AudioUrl,
                      durationSec: speakingSubmission.part2DurationSeconds,
                      breakdown: speakingEvaluation.part2Criteria,
                    },
                    {
                      partLabel: 'Speaking Part 3 · Topic Development',
                      task: speakingTasks[2],
                      text: speakingSubmission.part3Text,
                      wordCount: speakingSubmission.part3WordCount,
                      audioUrl: speakingSubmission.part3AudioUrl,
                      durationSec: speakingSubmission.part3DurationSeconds,
                      breakdown: speakingEvaluation.part3Criteria,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-3xl border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 sm:p-5 space-y-3.5 flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b-2 border-[#E5E5E5] dark:border-slate-700 pb-3">
                          <div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#EA2B2B] dark:text-rose-400 block">
                              {item.partLabel}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {item.wordCount} từ {item.durationSec ? `· Thu âm ${item.durationSec}s` : ''}
                            </span>
                          </div>
                          <div className="rounded-2xl bg-[#FFDADC] dark:bg-rose-950 px-3 py-1 font-mono text-xs font-black text-[#EA2B2B] dark:text-rose-200 border-2 border-[#FF4B4B] border-b-4 border-b-[#EA2B2B]">
                            {item.breakdown.total10.toFixed(1)} / 10
                          </div>
                        </div>

                        {/* 5 Criteria Rubric Bars */}
                        <div className="space-y-2 text-xs">
                          {[
                            { label: 'Grammar', val: item.breakdown.grammar },
                            { label: 'Vocabulary', val: item.breakdown.vocabulary },
                            { label: 'Pronunciation', val: item.breakdown.pronunciation },
                            { label: 'Fluency', val: item.breakdown.fluency },
                            { label: 'Discourse Mgmt', val: item.breakdown.discourseManagement },
                          ].map((crit, cIdx) => (
                            <div
                              key={cIdx}
                              className="rounded-2xl bg-white dark:bg-slate-900 px-3 py-2 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-3 border-b-[#CECECE] dark:border-b-slate-800"
                            >
                              <div className="flex items-center justify-between font-black text-[11px] mb-1">
                                <span className="text-slate-700 dark:text-slate-200">{crit.label}</span>
                                <span className="font-mono text-[#EA2B2B] dark:text-rose-400">{crit.val}/10</span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] dark:border-slate-700 overflow-hidden">
                                <div
                                  className="h-full bg-[#FF4B4B] rounded-full transition-all"
                                  style={{ width: `${(crit.val / 10) * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Audio playback if recorded */}
                        {item.audioUrl && (
                          <div className="rounded-2xl bg-[#FFDADC]/50 dark:bg-rose-950/30 p-3 border-2 border-[#FF4B4B] dark:border-rose-800 border-b-3 border-b-[#EA2B2B]">
                            <span className="block text-[10px] font-black uppercase text-[#EA2B2B] dark:text-rose-300 mb-1.5">
                              🎙️ Bản thu âm của thí sinh:
                            </span>
                            <audio src={item.audioUrl} controls className="h-8 w-full" />
                          </div>
                        )}

                        {/* Candidate Submitted Transcript */}
                        <div className="rounded-2xl bg-white dark:bg-slate-900 p-3 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-3 border-b-[#CECECE] dark:border-b-slate-800 text-xs">
                          <span className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                            Nội dung bài nói (Transcript):
                          </span>
                          {item.text && item.text.trim().length > 0 ? (
                            <p className="whitespace-pre-line text-slate-700 dark:text-slate-200 leading-relaxed max-h-32 overflow-y-auto">
                              {item.text}
                            </p>
                          ) : (
                            <p className="italic font-bold text-[#EA2B2B]">Chưa có nội dung văn bản cho phần này.</p>
                          )}
                        </div>

                        {/* Examiner Commentary */}
                        <div className="rounded-2xl bg-[#FFDADC]/40 dark:bg-rose-950/30 border-2 border-[#FF4B4B] dark:border-rose-800 border-b-4 border-b-[#EA2B2B] p-3 text-xs space-y-1.5">
                          <span className="font-black text-[#EA2B2B] dark:text-rose-300 block">
                            Nhận xét từ Giám khảo VSTEP:
                          </span>
                          <p className="text-slate-800 dark:text-slate-200 font-semibold leading-relaxed">
                            {item.breakdown.feedbackVi}
                          </p>
                          {item.breakdown.improvementsVi && item.breakdown.improvementsVi.length > 0 && (
                            <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300 pt-1">
                              {item.breakdown.improvementsVi.map((imp: string, i: number) => (
                                <li key={i}>{imp}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Sample Answer */}
                        {item.task?.sampleAnswer && (
                          <div className="rounded-2xl bg-[#FFF5D6] dark:bg-amber-950/30 border-2 border-[#FFC800] dark:border-amber-800 border-b-4 border-b-[#E5B400] p-3 text-xs space-y-1">
                            <span className="font-black text-[#FF9600] dark:text-amber-300 block">
                              ✨ Bài nói mẫu B2–C1:
                            </span>
                            <p className="whitespace-pre-line text-slate-800 dark:text-slate-200 font-medium leading-relaxed max-h-40 overflow-y-auto">
                              {item.task.sampleAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 12-Part Performance Matrix Table (Duolingo 3D Card & Skill Badges) */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-800 shadow-xs overflow-hidden">
              <div className="p-5 border-b-2 border-[#E5E5E5] dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF5D6] dark:bg-amber-950/60 border-2 border-[#FFC800] border-b-3 border-b-[#E5B400] text-[#FF9600]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Bảng Ma Trận Hiệu Suất 12 Phần Thi 4 Kỹ Năng (Part-by-Part Matrix)
                    </h3>
                    <span className="text-xs font-bold text-slate-500">
                      Thống kê L · R · W · S & tỷ lệ hoàn thành từng phần
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider border-b-2 border-[#E5E5E5] dark:border-slate-700">
                    <tr>
                      <th className="p-3.5">Phần Thi</th>
                      <th className="p-3.5">Kỹ Năng</th>
                      <th className="p-3.5 text-center">Tổng Câu / Điểm</th>
                      <th className="p-3.5 text-center">Số Câu Đúng</th>
                      <th className="p-3.5 text-center">Số Câu Sai</th>
                      <th className="p-3.5 text-center">Bỏ Trống</th>
                      <th className="p-3.5 text-center">Tỷ Lệ %</th>
                      <th className="p-3.5 text-right">Đánh Giá Năng Lực</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#F0F0F0] dark:divide-slate-800">
                    {partMatrixRows.map((row) => {
                      const skillBadgeStyle =
                        row.section === 'LISTENING'
                          ? 'bg-[#DDF4FF] text-[#1899D6] border-[#1CB0F6] border-b-[#1899D6]'
                          : row.section === 'READING'
                          ? 'bg-[#D7FFB8] text-[#46A302] border-[#58CC02] border-b-[#46A302]'
                          : row.section === 'WRITING'
                          ? 'bg-[#F3E5FF] text-[#A560E8] border-[#CE82FF] border-b-[#A560E8]'
                          : 'bg-[#FFDADC] text-[#EA2B2B] border-[#FF4B4B] border-b-[#EA2B2B]';

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-black text-slate-900 dark:text-white">
                            {row.name}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 border-b-3 ${skillBadgeStyle}`}
                            >
                              {row.section}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-center font-bold text-slate-700 dark:text-slate-300">
                            {row.total}
                          </td>
                          <td className="p-3.5 font-mono text-center font-black text-[#46A302] dark:text-[#58CC02]">
                            {row.correct}
                          </td>
                          <td className="p-3.5 font-mono text-center font-black text-[#EA2B2B]">
                            {row.wrong}
                          </td>
                          <td className="p-3.5 font-mono text-center font-bold text-slate-400">
                            {row.blank}
                          </td>
                          <td className="p-3.5 font-mono text-center font-black">
                            <div className="flex flex-col items-center gap-1 min-w-[70px]">
                              <span
                                className={
                                  row.percentage >= 75
                                    ? 'text-[#46A302] dark:text-[#58CC02]'
                                    : row.percentage >= 50
                                    ? 'text-[#1899D6] dark:text-[#1CB0F6]'
                                    : 'text-[#EA2B2B]'
                                }
                              >
                                {row.percentage}%
                              </span>
                              <div className="h-2 w-16 rounded-full bg-slate-100 dark:bg-slate-800 border border-[#E5E5E5] dark:border-slate-700 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    row.percentage >= 75
                                      ? 'bg-[#58CC02]'
                                      : row.percentage >= 50
                                      ? 'bg-[#1CB0F6]'
                                      : 'bg-[#FF4B4B]'
                                  }`}
                                  style={{ width: `${row.percentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-right">
                            <span
                              className={`inline-block px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 border-b-3 ${
                                row.percentage >= 75
                                  ? 'bg-[#D7FFB8] text-[#46A302] border-[#58CC02] border-b-[#46A302] dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : row.percentage >= 50
                                  ? 'bg-[#DDF4FF] text-[#1899D6] border-[#1CB0F6] border-b-[#1899D6] dark:bg-sky-950/60 dark:text-sky-300'
                                  : 'bg-[#FFDADC] text-[#EA2B2B] border-[#FF4B4B] border-b-[#EA2B2B] dark:bg-rose-950/60 dark:text-rose-300'
                              }`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Diagnostic CTA & Study Plan (Duolingo 3D Purple Card & Button) */}
            <div className="rounded-3xl border-2 border-[#CE82FF] dark:border-purple-800 border-b-4 border-b-[#A560E8] dark:border-b-purple-950 bg-gradient-to-br from-[#F3E5FF]/50 via-purple-50/30 to-white dark:from-slate-900 dark:to-purple-950/40 p-6 sm:p-8 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-[#CE82FF] border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8] text-white shrink-0">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      AI Diagnostic & Kế Hoạch Ôn Luyện VSTEP B1–B2–C1
                    </h3>
                    <p className="text-xs font-bold text-[#A560E8] dark:text-purple-300 mt-0.5">
                      Chẩn đoán điểm mạnh/yếu, nhận xét bài viết và lên lộ trình học tập cá nhân hóa
                    </p>
                  </div>
                </div>

                {!aiData && (
                  <button
                    type="button"
                    disabled={isAiLoading}
                    onClick={handleRequestAiDiagnostic}
                    className="btn-duo-purple inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{isAiLoading ? 'AI Đang phân tích...' : '✨ Bấm để AI Chẩn đoán chuyên sâu'}</span>
                  </button>
                )}
              </div>

              {aiData && (
                <div className="mt-6 pt-6 border-t-2 border-[#F3E5FF] dark:border-purple-900 space-y-6">
                  <div className="flex overflow-x-auto pb-2 gap-2.5 border-b-2 border-[#F3E5FF] dark:border-purple-900">
                    {[
                      { id: 'strengths', label: 'Điểm mạnh', icon: ShieldCheck },
                      { id: 'weaknesses', label: 'Điểm cần khắc phục', icon: AlertTriangle },
                      { id: 'writing', label: 'Đánh giá bài viết', icon: PenTool },
                      { id: 'plan', label: 'Lộ trình 4 tuần', icon: Calendar },
                      { id: 'resources', label: 'Tài liệu & Động viên', icon: Heart },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveAiTab(tab.id as any)}
                          className={`flex items-center gap-1.5 shrink-0 rounded-2xl px-4 py-2 text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-1 ${
                            activeAiTab === tab.id
                              ? 'bg-[#CE82FF] text-white border-2 border-[#CE82FF] border-b-4 border-b-[#A560E8]'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-900 hover:bg-purple-50/50'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {activeAiTab === 'strengths' && (
                    <div className="space-y-2.5">
                      {aiData.strengths.map((st, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 rounded-2xl border-2 border-[#58CC02] border-b-4 border-b-[#46A302] bg-[#D7FFB8]/40 dark:bg-emerald-950/40 p-3.5 text-xs font-semibold text-slate-800 dark:text-emerald-100"
                        >
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#46A302] mt-0.5" />
                          <span className="leading-relaxed">{st}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeAiTab === 'weaknesses' && (
                    <div className="space-y-2.5">
                      {aiData.weaknesses.map((wk, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 rounded-2xl border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] bg-[#FFF5D6]/60 dark:bg-amber-950/40 p-3.5 text-xs font-semibold text-slate-800 dark:text-amber-100"
                        >
                          <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF9600] mt-0.5" />
                          <span className="leading-relaxed">{wk}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeAiTab === 'writing' && aiData.writingFeedback && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                      <div className="rounded-2xl border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] bg-white dark:bg-slate-900 p-4 space-y-1">
                        <span className="font-black text-[#A560E8] dark:text-purple-300 block">
                          Hoàn thành yêu cầu (Task Achievement):
                        </span>
                        <p className="text-slate-600 dark:text-slate-300">
                          {aiData.writingFeedback.taskAchievement}
                        </p>
                      </div>
                      <div className="rounded-2xl border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] bg-white dark:bg-slate-900 p-4 space-y-1">
                        <span className="font-black text-[#A560E8] dark:text-purple-300 block">
                          Độ mạch lạc (Coherence):
                        </span>
                        <p className="text-slate-600 dark:text-slate-300">
                          {aiData.writingFeedback.coherence}
                        </p>
                      </div>
                      <div className="rounded-2xl border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] bg-white dark:bg-slate-900 p-4 space-y-1">
                        <span className="font-black text-[#A560E8] dark:text-purple-300 block">
                          Vốn từ vựng (Lexical Resource):
                        </span>
                        <p className="text-slate-600 dark:text-slate-300">
                          {aiData.writingFeedback.lexicalResource}
                        </p>
                      </div>
                      <div className="rounded-2xl border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] bg-white dark:bg-slate-900 p-4 space-y-1">
                        <span className="font-black text-[#A560E8] dark:text-purple-300 block">
                          Ngữ pháp & Độ chính xác (Grammar):
                        </span>
                        <p className="text-slate-600 dark:text-slate-300">
                          {aiData.writingFeedback.grammarAccuracy}
                        </p>
                      </div>
                    </div>
                  )}

                  {activeAiTab === 'plan' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                      {aiData.studyPlan.map((p) => (
                        <div
                          key={p.week}
                          className="rounded-2xl border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] bg-white dark:bg-slate-900 p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between border-b-2 border-[#F0F0F0] dark:border-slate-800 pb-2">
                            <span className="font-black text-[#A560E8] dark:text-purple-300">
                              Tuần {p.week}: {p.title}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-400 font-bold">
                            Trọng tâm: {p.focusSkills}
                          </p>
                          <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc pl-4">
                            {p.tasks.map((task, idx) => (
                              <li key={idx}>{task}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeAiTab === 'resources' && (
                    <div className="space-y-4 text-xs">
                      <div className="rounded-2xl border-2 border-[#FFC800] border-b-4 border-b-[#E5B400] bg-[#FFF5D6]/70 dark:bg-amber-950/40 p-4 text-slate-900 dark:text-amber-100 space-y-2">
                        <div className="flex items-center gap-2 font-black text-[#FF9600] dark:text-amber-300">
                          <Heart className="h-4 w-4 text-[#FF4B4B] fill-[#FF4B4B]" />
                          <span>Lời động viên từ Giảng viên AI:</span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-line font-semibold">
                          {aiData.encouragement}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: SMART DETAILED REVIEW SECTION                                */}
        {/* =================================================================== */}
        {activeMainTab === 'review' && (
          <div className="rounded-3xl border-2 border-[#58CC02] dark:border-lime-700 border-b-4 border-b-[#46A302] bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-md space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#E5E5E5] dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#58CC02] border-2 border-[#58CC02] border-b-4 border-b-[#46A302] text-white shrink-0">
                  <Eye className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Xem Lại Toàn Bộ Bài Làm, Bằng Chứng & Bản Dịch Song Ngữ
                  </h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Đối chiếu câu đúng/sai trực tiếp trên giao diện thi chuẩn hoặc danh sách câu hỏi
                  </p>
                </div>
              </div>

              {/* Mode Switcher: Interactive Full Stage vs Summary List */}
              <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1.5 border-2 border-[#E5E5E5] dark:border-slate-700 gap-1.5">
                <button
                  type="button"
                  onClick={() => setReviewDisplayMode('interactive')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-0.5 ${
                    reviewDisplayMode === 'interactive'
                      ? 'bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-3 border-b-[#46A302]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  <span>Xem Trực Quan Theo Part</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewDisplayMode('list')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-0.5 ${
                    reviewDisplayMode === 'list'
                      ? 'bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-3 border-b-[#46A302]'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ListFilter className="h-4 w-4" />
                  <span>Danh Sách Tóm Tắt ({questions.length} câu)</span>
                </button>
              </div>
            </div>

            {reviewDisplayMode === 'interactive' ? (
              <div className="space-y-4">
                {/* Part Selector Bar */}
                <div className="flex items-center gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                  {availableReviewParts.map((part) => {
                    const isSelected = part.id === selectedReviewPartId;
                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => {
                          setSelectedReviewPartId(part.id);
                          if (part.section !== 'WRITING' && part.section !== 'SPEAKING') {
                            const firstInPart = questions.find(
                              (q) => q.section === part.section && q.partNumber === part.partNumber
                            );
                            if (firstInPart) {
                              setActiveReviewQuestionId(firstInPart.id);
                            }
                          }
                        }}
                        className={`rounded-2xl px-4 py-2 text-xs font-black transition-all shrink-0 cursor-pointer active:border-b-0 active:translate-y-1 ${
                          isSelected
                            ? 'bg-[#58CC02] text-white border-2 border-[#58CC02] border-b-4 border-b-[#46A302]'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] dark:border-b-slate-900 hover:bg-slate-200/70'
                        }`}
                      >
                        {part.label}
                      </button>
                    );
                  })}
                </div>

                {/* Question / Writing / Speaking Stage in Review Mode */}
                {currentReviewPart.section === 'WRITING' ? (
                  <WritingSectionStage
                    tasks={writingTasks}
                    activeTaskIndex={(currentReviewPart.partNumber - 1) as 0 | 1}
                    onTaskIndexChange={(idx) =>
                      setSelectedReviewPartId(idx === 1 ? 'W2' : 'W1')
                    }
                    submission={
                      writingSubmission || {
                        task1Text: '',
                        task2Text: '',
                        task1WordCount: 0,
                        task2WordCount: 0,
                      }
                    }
                    isReviewMode={true}
                    onChange={() => {}}
                    onProceedToReview={() => {}}
                  />
                ) : currentReviewPart.section === 'SPEAKING' ? (
                  <SpeakingSectionStage
                    tasks={speakingTasks}
                    activePartIndex={(currentReviewPart.partNumber - 1) as 0 | 1 | 2}
                    onPartIndexChange={(idx) =>
                      setSelectedReviewPartId(idx === 0 ? 'S1' : idx === 1 ? 'S2' : 'S3')
                    }
                    submission={
                      speakingSubmission || {
                        part1Text: '',
                        part2Text: '',
                        part3Text: '',
                        part1WordCount: 0,
                        part2WordCount: 0,
                        part3WordCount: 0,
                      }
                    }
                    isReviewMode={true}
                    onChange={() => {}}
                    onProceedToReview={() => {}}
                  />
                ) : (
                  <QuestionStage
                    questions={currentReviewPartQuestions}
                    activeQuestionId={activeReviewQuestionId}
                    answers={answers}
                    mode="practice"
                    isReviewMode={true}
                    onAnswerChange={() => {}}
                    onSelectQuestion={(qId) => setActiveReviewQuestionId(qId)}
                    onOpenZoomModal={(card) => setZoomCard(card)}
                  />
                )}
              </div>
            ) : (
              /* List Mode */
              <div className="space-y-4">
                {/* Filter buttons */}
                <div className="flex items-center gap-2.5">
                  {(['all', 'incorrect', 'correct'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFilter(mode)}
                      className={`rounded-2xl px-4 py-2 text-xs font-black transition-all cursor-pointer active:border-b-0 active:translate-y-1 ${
                        filter === mode
                          ? 'bg-[#1CB0F6] text-white border-2 border-[#1CB0F6] border-b-4 border-b-[#1899D6]'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-2 border-[#E5E5E5] dark:border-slate-700 border-b-4 border-b-[#CECECE] hover:bg-slate-200'
                      }`}
                    >
                      {mode === 'all'
                        ? `Tất cả (${questions.length})`
                        : mode === 'incorrect'
                        ? 'Chỉ câu sai'
                        : 'Chỉ câu đúng'}
                    </button>
                  ))}
                </div>

                {/* Filtered Questions List */}
                <div className="space-y-3">
                  {filteredQuestions.map((q) => {
                    const isCorrect = isQuestionCorrect(q);
                    const userVal = answers[q.id] || '(Chưa làm)';
                    const isExpanded = expandedId === q.id;

                    return (
                      <div
                        key={q.id}
                        className={`rounded-2xl border-2 border-b-4 p-4 transition-all ${
                          isCorrect
                            ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/25 dark:bg-emerald-950/20'
                            : 'border-[#FF4B4B] border-b-[#EA2B2B] bg-[#FFDADC]/25 dark:bg-rose-950/20'
                        }`}
                      >
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : q.id)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            {isCorrect ? (
                              <CheckCircle2 className="h-5 w-5 text-[#46A302]" />
                            ) : (
                              <XCircle className="h-5 w-5 text-[#EA2B2B]" />
                            )}
                            <span className="text-xs font-black uppercase text-slate-500">
                              {getQuestionRelativeDisplay(q)}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate max-w-md">
                              {q.prompt}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-black">
                              Đã chọn: <span className={isCorrect ? 'text-[#46A302]' : 'text-[#EA2B2B]'}>{userVal}</span>
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t-2 border-[#E5E5E5] dark:border-slate-800 space-y-2 text-xs">
                            <p className="font-bold text-slate-700 dark:text-slate-300">
                              Đáp án chuẩn:{' '}
                              <span className="text-[#46A302] font-black">
                                {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(' / ') : q.correctAnswer}
                              </span>
                            </p>

                            <StructuredExplanationBox
                              explanation={q.explanation}
                              evidenceQuote={q.evidenceQuote}
                              audioScript={q.audioScript}
                              audioScriptTranslation={q.audioScriptTranslation}
                              vietnameseTranslation={q.vietnameseTranslation}
                              questionPrompt={q.prompt}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global Zoom Modal if triggered */}
        {zoomCard && (
          <ImageZoomModal
            card={zoomCard}
            onClose={() => setZoomCard(null)}
          />
        )}
      </div>
    </div>
  );
};
