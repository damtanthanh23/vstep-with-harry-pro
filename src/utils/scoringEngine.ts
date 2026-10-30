import { Question, ExamSection } from '../types/exam';
import { WritingSubmission, WritingTask, SAMPLE_B1_WRITING_TASKS } from '../types/writing';

export interface CEFRLevelInfo {
  level: 'Below A1' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  name: string;
  description: string;
  color: string;
  badgeBg: string;
  eligibleForCertificate: boolean;
  qualificationTitle: string;
  awardTitle: string;
  vstepScore10?: number;
  vstepGradeLabel?: string;
}

export interface WritingCriterionScore {
  taskFulfilment: number; // 0-3 (or scaled 0-2.5)
  grammar: number; // 0-3
  vocabulary: number; // 0-3
  organization: number; // 0-3
  total: number; // 0-12 (mapped to 10-point scale via (total/12)*10 or direct 0-10)
  score10?: number; // 0-10 scale
  feedbackVi: string;
  strengthsVi?: string[];
  improvementsVi?: string[];
  correctedSample?: string;
}

export interface DetailedWritingEvaluation {
  task1Score: number; // 0-12 internal rubric (or 0-10)
  task2Score: number; // 0-12 internal rubric (or 0-10)
  task1Score10?: number; // 0-10 VSTEP scale
  task2Score10?: number; // 0-10 VSTEP scale
  vstepWritingScore10?: number; // Official VSTEP formula: (Task1 + Task2 * 2) / 3
  task1Criteria: WritingCriterionScore;
  task2Criteria: WritingCriterionScore;
  overallBandComment: string;
  isAiGraded?: boolean;
}

export interface SkillScoreReport {
  rawScore: number;
  maxRawScore: number;
  scaledScore: number; // 0 to 10 (VSTEP 10-point scale, e.g., 7.5)
  score10: number; // 0 to 10 (rounded to 0.5)
  percentage: number;
}

export interface PartPerformance {
  partNumber: number;
  section: ExamSection | 'WRITING';
  name: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface ComprehensiveExamResult {
  totalScaledScore: number; // VSTEP Overall Score on 10-point scale (rounded to nearest 0.5, e.g. 6.5)
  overallScore10: number; // VSTEP Overall Score on 10-point scale (rounded to nearest 0.5)
  listeningScore10: number; // Listening score on 10-point scale (e.g. (correct/35)*10)
  readingScore10: number; // Reading score on 10-point scale (e.g. (correct/40)*10)
  writingScore10: number; // Writing score on 10-point scale (e.g. (Task1 + Task2*2)/3)
  maxScaledScore: number; // 10
  normalizedScore100: number; // Equivalent 0-100 scale
  percentage: number;
  grade: 'High Pass' | 'Pass' | 'Fail';
  cefr: CEFRLevelInfo;
  listening: SkillScoreReport;
  reading: SkillScoreReport;
  writing?: SkillScoreReport;
  parts: PartPerformance[];
  timeSpentSeconds: number;
}

/**
 * Helper to round a 0-10 score to the nearest 0.5 according to official VSTEP rules
 */
export function roundToHalf(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 2) / 2;
}

/**
 * Maps a score (either 0-10 VSTEP scale or 0-100 normalized scale) to official VSTEP B1-B2-C1 levels
 * Official Ministry of Education & Training (Bộ GD&ĐT) VSTEP Scale:
 * - 0.0 – 3.5 (< 4.0): Không xét bậc (Chưa đạt B1)
 * - 4.0 – 5.5: Bậc 3 (B1)
 * - 6.0 – 8.0: Bậc 4 (B2)
 * - 8.5 – 10.0: Bậc 5 (C1)
 */
export function mapScoreToCEFR(scoreInput: number, directScore10?: number): CEFRLevelInfo {
  // Support both 0-10 VSTEP score and 0-100 percentage input seamlessly
  const raw10 =
    typeof directScore10 === 'number'
      ? directScore10
      : scoreInput <= 10
      ? scoreInput
      : scoreInput / 10;
  const vstep10 = roundToHalf(raw10);

  if (vstep10 < 4.0) {
    return {
      level: 'Below A1',
      name: `Dưới 4.0 (${vstep10.toFixed(1)}/10) · Không xét bậc VSTEP`,
      description:
        'Điểm tổng kết dưới 4.0/10 nên chưa đủ điều kiện công nhận trình độ Bậc 3 (B1) theo quy chế thi VSTEP. Hãy tập trung ôn lại từ vựng cốt lõi và luyện kỹ năng đọc lướt (skimming/scanning).',
      color: 'text-rose-600',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
      eligibleForCertificate: false,
      qualificationTitle: 'Chưa đủ điều kiện cấp chứng chỉ VSTEP (Dưới 4.0/10)',
      awardTitle: '(Không xét bậc - Below VSTEP Level 3 / B1)',
      vstepScore10: vstep10,
      vstepGradeLabel: 'Không xét bậc (< 4.0)',
    };
  }

  if (vstep10 <= 5.5) {
    return {
      level: 'B1',
      name: `VSTEP Bậc 3 (B1) · ${vstep10.toFixed(1)}/10 điểm`,
      description:
        'Đạt chuẩn Bậc 3 (B1) theo Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam: Nắm được ý chính của đoạn văn, bài phát biểu quen thuộc; viết được thư/email và bài luận cơ bản; đáp ứng chuẩn đầu ra Đại học, Cao học và thi công chức.',
      color: 'text-sky-600',
      badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
      eligibleForCertificate: true,
      qualificationTitle: 'CHỨNG CHỈ NGOẠI NGỮ TIẾNG ANH BẬC 3 (VSTEP B1)',
      awardTitle: 'Level 3 / Bậc 3 (CEFR B1 - Đạt chuẩn)',
      vstepScore10: vstep10,
      vstepGradeLabel: 'Bậc 3 (B1)',
    };
  }

  if (vstep10 <= 8.0) {
    return {
      level: 'B2',
      name: `VSTEP Bậc 4 (B2) · ${vstep10.toFixed(1)}/10 điểm`,
      description:
        'Đạt chuẩn Bậc 4 (B2) theo Khung năng lực ngoại ngữ 6 bậc Việt Nam: Hiểu rõ văn bản phức tạp và chuyên ngành; giao tiếp và lập luận trôi chảy, mạch lạc; đáp ứng chuẩn đầu ra Nghiên cứu sinh, Giáo viên và Chuyên viên cao cấp.',
      color: 'text-emerald-600',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      eligibleForCertificate: true,
      qualificationTitle: 'CHỨNG CHỈ NGOẠI NGỮ TIẾNG ANH BẬC 4 (VSTEP B2)',
      awardTitle: 'Level 4 / Bậc 4 (CEFR B2 - Khá Giỏi)',
      vstepScore10: vstep10,
      vstepGradeLabel: 'Bậc 4 (B2)',
    };
  }

  return {
    level: 'C1',
    name: `VSTEP Bậc 5 (C1) · ${vstep10.toFixed(1)}/10 điểm`,
    description:
      'Đạt chuẩn Bậc 5 (C1) cao nhất của bài thi VSTEP B1-B2-C1: Làm chủ văn bản học thuật dài và phức tạp, sử dụng cấu trúc ngữ pháp và từ vựng linh hoạt, lập luận sắc bén và chặt chẽ.',
    color: 'text-indigo-600',
    badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    eligibleForCertificate: true,
    qualificationTitle: 'CHỨNG CHỈ NGOẠI NGỮ TIẾNG ANH BẬC 5 (VSTEP C1)',
    awardTitle: 'Level 5 / Bậc 5 (CEFR C1 - Xuất Sắc)',
    vstepScore10: vstep10,
    vstepGradeLabel: 'Bậc 5 (C1)',
  };
}

/**
 * Evaluates a single VSTEP Writing Task (0-12 internal rubric mapped to 0-10 VSTEP scale)
 * based on the 4 official VSTEP Writing criteria:
 * 1. Task Fulfillment (Hoàn thành nhiệm vụ)
 * 2. Organization & Coherence (Bố cục & Mạch lạc)
 * 3. Vocabulary / Lexical Resource (Từ vựng)
 * 4. Grammar / Grammatical Range & Accuracy (Ngữ pháp)
 */
function scoreSingleWritingTaskStrict(
  text: string,
  task: WritingTask
): WritingCriterionScore {
  const clean = (text || '').trim();
  if (!clean) {
    return {
      taskFulfilment: 0,
      grammar: 0,
      vocabulary: 0,
      organization: 0,
      total: 0,
      score10: 0,
      feedbackVi: 'Thí sinh bỏ trống phần viết này (0/10 điểm).',
    };
  }

  const words = clean
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z']/g, '').toLowerCase())
    .filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount < 20) {
    return {
      taskFulfilment: 0,
      grammar: 0,
      vocabulary: 1,
      organization: 0,
      total: 1,
      score10: 1.0,
      feedbackVi: `Bài viết quá ngắn (${wordCount} từ, yêu cầu tối thiểu ${task.minWords} từ). Chưa triển khai được yêu cầu đề bài VSTEP.`,
    };
  }

  const uniqueWords = new Set(words);
  const lexicalRatio = uniqueWords.size / Math.max(1, wordCount);

  if (lexicalRatio < 0.25) {
    return {
      taskFulfilment: 0,
      grammar: 0,
      vocabulary: 1,
      organization: 0,
      total: 1,
      score10: 1.0,
      feedbackVi: 'Bài viết lặp từ bất thường hoặc chưa có cấu trúc câu tiếng Anh hợp lệ.',
    };
  }

  // 1. Task Fulfilment (0-3)
  let taskFulfilment = 1;
  const meetsFullMinWords = wordCount >= task.minWords * 0.9;
  const meetsPartialWords = wordCount >= task.minWords * 0.65;

  const promptText = `${task.instruction} ${task.stimulusText || ''} ${(task.bulletPoints || []).join(' ')}`.toLowerCase();
  const promptKeywords = Array.from(
    new Set(
      promptText
        .split(/\W+/)
        .filter(
          (w) =>
            w.length >= 4 &&
            !['write', 'email', 'letter', 'essay', 'your', 'with', 'that', 'this', 'from', 'have', 'what', 'would', 'about', 'should', 'spend', 'minutes', 'task'].includes(w)
        )
    )
  );
  const matchedKeywords = promptKeywords.filter((kw) => clean.toLowerCase().includes(kw));

  if (meetsFullMinWords && matchedKeywords.length >= 3) {
    taskFulfilment = 3;
  } else if (meetsPartialWords && matchedKeywords.length >= 1) {
    taskFulfilment = 2;
  }

  // 2. Organization & Cohesion (0-3)
  const paragraphs = clean.split(/\n+/).filter((p) => p.trim().length > 0);
  const connectors = [
    'because',
    'however',
    'therefore',
    'although',
    'furthermore',
    'moreover',
    'addition',
    'finally',
    'firstly',
    'secondly',
    'first',
    'second',
    'conclusion',
    'regarding',
    'while',
    'since',
    'besides',
    'consequently',
  ];
  const usedConnectors = connectors.filter((c) =>
    new RegExp(`\\b${c}\\b`, 'i').test(clean)
  );

  let organization = 1;
  if (paragraphs.length >= 3 && usedConnectors.length >= 3) {
    organization = 3;
  } else if (paragraphs.length >= 2 && usedConnectors.length >= 1) {
    organization = 2;
  }

  // 3. Vocabulary (0-3)
  const academicWords = words.filter((w) => w.length >= 7);
  let vocabulary = 1;
  if (uniqueWords.size >= 60 && academicWords.length >= 12) {
    vocabulary = 3;
  } else if (uniqueWords.size >= 38 && academicWords.length >= 6) {
    vocabulary = 2;
  }

  // 4. Grammar (0-3)
  const sentences = clean.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const complexMarkers = [
    'which',
    'who',
    'where',
    'when',
    'if',
    'unless',
    'would',
    'could',
    'should',
    'have been',
    'not only',
    'although',
    'while',
  ];
  const usedComplex = complexMarkers.filter((m) =>
    new RegExp(`\\b${m}\\b`, 'i').test(clean)
  );

  let grammar = 1;
  if (sentences.length >= 6 && usedComplex.length >= 3 && wordCount >= task.minWords * 0.85) {
    grammar = 3;
  } else if (sentences.length >= 4 && usedComplex.length >= 1) {
    grammar = 2;
  }

  const total = taskFulfilment + grammar + vocabulary + organization; // 0-12
  const score10 = Math.round(((total / 12) * 10) * 2) / 2;

  return {
    taskFulfilment,
    grammar,
    vocabulary,
    organization,
    total,
    score10,
    feedbackVi: `Đánh giá theo Rubrics VSTEP 4 tiêu chí (${wordCount}/${task.minWords} từ tối thiểu · Quy đổi ${score10.toFixed(1)}/10): Hoàn thành nhiệm vụ ${taskFulfilment}/3 · Bố cục & Mạch lạc ${organization}/3 · Từ vựng ${vocabulary}/3 · Ngữ pháp ${grammar}/3.`,
  };
}

export function evaluateWritingStrictRubric(
  submission?: WritingSubmission,
  tasks: WritingTask[] = SAMPLE_B1_WRITING_TASKS
): DetailedWritingEvaluation {
  const safeSub: WritingSubmission = submission || {
    task1Text: '',
    task1WordCount: 0,
    task2Text: '',
    task2WordCount: 0,
  };
  const t1 = tasks[0] || SAMPLE_B1_WRITING_TASKS[0];
  const t2 = tasks[1] || SAMPLE_B1_WRITING_TASKS[1];

  const c1 = scoreSingleWritingTaskStrict(safeSub.task1Text, t1);
  const c2 = scoreSingleWritingTaskStrict(safeSub.task2Text, t2);

  const t1Score10 = c1.score10 ?? (c1.total / 12) * 10;
  const t2Score10 = c2.score10 ?? (c2.total / 12) * 10;
  // Official VSTEP Writing Formula: (Task 1 + Task 2 * 2) / 3
  const vstepWritingScore10 = roundToHalf((t1Score10 + t2Score10 * 2) / 3);

  return {
    task1Score: c1.total,
    task2Score: c2.total,
    task1Score10: t1Score10,
    task2Score10: t2Score10,
    vstepWritingScore10,
    task1Criteria: c1,
    task2Criteria: c2,
    overallBandComment:
      vstepWritingScore10 >= 6.0
        ? `Điểm Writing VSTEP đạt ${vstepWritingScore10.toFixed(1)}/10 (Trọng số: [Task 1 + Task 2 × 2] / 3) — Đạt ngưỡng Bậc 4 (B2) trở lên.`
        : vstepWritingScore10 >= 4.0
        ? `Điểm Writing VSTEP đạt ${vstepWritingScore10.toFixed(1)}/10 (Trọng số: [Task 1 + Task 2 × 2] / 3) — Đạt ngưỡng Bậc 3 (B1). Cần mở rộng từ vựng học thuật ở Task 2 để bứt phá lên B2.`
        : `Điểm Writing VSTEP đạt ${vstepWritingScore10.toFixed(1)}/10 — Chưa đạt ngưỡng 4.0 (B1). Hãy đảm bảo viết đủ tối thiểu 120 từ cho Task 1 và 250 từ cho Task 2.`,
    isAiGraded: false,
  };
}

/**
 * Calculates official VSTEP B1-B2-C1 exam results on the 10-point scale:
 * - Listening: (correct / 35) * 10
 * - Reading: (correct / 40) * 10
 * - Writing: ((Task1_10 + Task2_10 * 2) / 3)
 * - Overall VSTEP Score: Average of tested skills rounded to nearest 0.5
 */
export function calculateExamResults(
  questions: Question[],
  answers: Record<number, string>,
  timeSpentSeconds: number,
  writingScores?: { task1Score: number; task2Score: number }
): ComprehensiveExamResult {
  let listeningRaw = 0;
  let readingRaw = 0;
  let listeningTotal = 0;
  let readingTotal = 0;

  const partStats: Record<string, { correct: number; total: number; name: string }> = {
    L1: { correct: 0, total: 0, name: 'Listening Part 1 (8 Thông báo/Hướng dẫn ngắn · Câu 1–8)' },
    L2: { correct: 0, total: 0, name: 'Listening Part 2 (3 Hội thoại × 4 câu · Câu 9–20)' },
    L3: { correct: 0, total: 0, name: 'Listening Part 3 (3 Bài giảng/Thuyết trình × 5 câu · Câu 21–35)' },
    L4: { correct: 0, total: 0, name: 'Listening Part 4' },
    R1: { correct: 0, total: 0, name: 'Reading Passage 1 (Đọc hiểu văn bản 1 · Câu 1–10)' },
    R2: { correct: 0, total: 0, name: 'Reading Passage 2 (Đọc hiểu văn bản 2 · Câu 11–20)' },
    R3: { correct: 0, total: 0, name: 'Reading Passage 3 (Đọc hiểu văn bản 3 · Câu 21–30)' },
    R4: { correct: 0, total: 0, name: 'Reading Passage 4 (Đọc hiểu văn bản 4 · Câu 31–40)' },
  };

  questions.forEach((q) => {
    const key = `${q.section === 'LISTENING' ? 'L' : 'R'}${q.partNumber}`;
    if (partStats[key]) {
      partStats[key].total += 1;
    }

    if (q.section === 'LISTENING') listeningTotal += 1;
    else if (q.section === 'READING') readingTotal += 1;

    const userAns = (answers[q.id] || '').trim().toLowerCase();
    let isCorrect = false;

    if (Array.isArray(q.correctAnswer)) {
      isCorrect = q.correctAnswer.some(
        (ans) => ans.trim().toLowerCase() === userAns
      );
    } else {
      isCorrect = q.correctAnswer.trim().toLowerCase() === userAns;
    }

    if (isCorrect) {
      if (q.section === 'LISTENING') listeningRaw += 1;
      else readingRaw += 1;

      if (partStats[key]) {
        partStats[key].correct += 1;
      }
    }
  });

  const safeListeningMax = listeningTotal > 0 ? listeningTotal : 35;
  const safeReadingMax = readingTotal > 0 ? readingTotal : 40;

  // VSTEP 10-point skill scores rounded to 0.5 (or 1 decimal place)
  const listeningExact10 = (listeningRaw / safeListeningMax) * 10;
  const readingExact10 = (readingRaw / safeReadingMax) * 10;
  const listeningScore10 = roundToHalf(listeningExact10);
  const readingScore10 = roundToHalf(readingExact10);

  const partsList: PartPerformance[] = [
    { partNumber: 1, section: 'LISTENING', name: partStats['L1'].name, correct: partStats['L1'].correct, total: partStats['L1'].total, percentage: partStats['L1'].total > 0 ? (partStats['L1'].correct / partStats['L1'].total) * 100 : 0 },
    { partNumber: 2, section: 'LISTENING', name: partStats['L2'].name, correct: partStats['L2'].correct, total: partStats['L2'].total, percentage: partStats['L2'].total > 0 ? (partStats['L2'].correct / partStats['L2'].total) * 100 : 0 },
    { partNumber: 3, section: 'LISTENING', name: partStats['L3'].name, correct: partStats['L3'].correct, total: partStats['L3'].total, percentage: partStats['L3'].total > 0 ? (partStats['L3'].correct / partStats['L3'].total) * 100 : 0 },
    ...(partStats['L4'].total > 0
      ? [{ partNumber: 4, section: 'LISTENING' as const, name: partStats['L4'].name, correct: partStats['L4'].correct, total: partStats['L4'].total, percentage: (partStats['L4'].correct / partStats['L4'].total) * 100 }]
      : []),
    { partNumber: 1, section: 'READING', name: partStats['R1'].name, correct: partStats['R1'].correct, total: partStats['R1'].total, percentage: partStats['R1'].total > 0 ? (partStats['R1'].correct / partStats['R1'].total) * 100 : 0 },
    { partNumber: 2, section: 'READING', name: partStats['R2'].name, correct: partStats['R2'].correct, total: partStats['R2'].total, percentage: partStats['R2'].total > 0 ? (partStats['R2'].correct / partStats['R2'].total) * 100 : 0 },
    { partNumber: 3, section: 'READING', name: partStats['R3'].name, correct: partStats['R3'].correct, total: partStats['R3'].total, percentage: partStats['R3'].total > 0 ? (partStats['R3'].correct / partStats['R3'].total) * 100 : 0 },
    { partNumber: 4, section: 'READING', name: partStats['R4'].name, correct: partStats['R4'].correct, total: partStats['R4'].total, percentage: partStats['R4'].total > 0 ? (partStats['R4'].correct / partStats['R4'].total) * 100 : 0 },
  ];

  let writingReport: SkillScoreReport | undefined = undefined;
  const skillScores10: number[] = [];
  if (listeningTotal > 0) skillScores10.push(listeningExact10);
  if (readingTotal > 0) skillScores10.push(readingExact10);

  if (writingScores) {
    // task1Score & task2Score are 0-12 from rubric; convert each to 0-10 and apply VSTEP weight (T1 + 2*T2)/3
    const t1_10 = (writingScores.task1Score / 12) * 10;
    const t2_10 = (writingScores.task2Score / 12) * 10;
    const writingExact10 = (t1_10 + t2_10 * 2) / 3;
    const writingScore10 = roundToHalf(writingExact10);
    const writingRaw = writingScores.task1Score + writingScores.task2Score;

    writingReport = {
      rawScore: writingRaw,
      maxRawScore: 24,
      scaledScore: writingScore10,
      score10: writingScore10,
      percentage: writingExact10 * 10,
    };
    skillScores10.push(writingExact10);

    partsList.push(
      { partNumber: 1, section: 'WRITING', name: 'Writing Task 1 (Viết Thư/Email ≥ 120 từ · Trọng số 1/3)', correct: writingScores.task1Score, total: 12, percentage: (writingScores.task1Score / 12) * 100 },
      { partNumber: 2, section: 'WRITING', name: 'Writing Task 2 (Viết Bài luận Essay ≥ 250 từ · Trọng số 2/3)', correct: writingScores.task2Score, total: 12, percentage: (writingScores.task2Score / 12) * 100 }
    );
  }

  const avgExact10 =
    skillScores10.length > 0
      ? skillScores10.reduce((acc, v) => acc + v, 0) / skillScores10.length
      : 0;
  const overallVstep10 = roundToHalf(avgExact10);
  const overallPercent = overallVstep10 * 10;

  let grade: 'High Pass' | 'Pass' | 'Fail' = 'Fail';
  if (overallVstep10 >= 6.0) {
    grade = 'High Pass'; // B2 or C1
  } else if (overallVstep10 >= 4.0) {
    grade = 'Pass'; // B1
  }

  const cefr = mapScoreToCEFR(overallVstep10);

  return {
    totalScaledScore: overallVstep10,
    overallScore10: overallVstep10,
    listeningScore10: listeningExact10,
    readingScore10: readingExact10,
    writingScore10: writingReport ? writingReport.score10 : 0,
    maxScaledScore: 10,
    normalizedScore100: Math.round(overallPercent),
    percentage: overallPercent,
    grade,
    cefr,
    listening: {
      rawScore: listeningRaw,
      maxRawScore: safeListeningMax,
      scaledScore: listeningScore10,
      score10: listeningScore10,
      percentage: (listeningRaw / safeListeningMax) * 100,
    },
    reading: {
      rawScore: readingRaw,
      maxRawScore: safeReadingMax,
      scaledScore: readingScore10,
      score10: readingScore10,
      percentage: (readingRaw / safeReadingMax) * 100,
    },
    writing: writingReport,
    parts: partsList,
    timeSpentSeconds,
  };
}
