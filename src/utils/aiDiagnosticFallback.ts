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

interface DiagnosticInput {
  totalScore: number;
  maxScore: number;
  cefrLevel: string;
  grade: string;
  listeningScaled: number;
  readingScaled: number;
  writingScaled?: number;
  speakingScaled?: number;
  partsBreakdown?: Array<{
    name: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
  writingSubmission?: {
    task1Text?: string;
    task1WordCount?: number;
    task2Text?: string;
    task2WordCount?: number;
  };
}

export function generateSmartDiagnosticReport(input: DiagnosticInput): AIDiagnosticData {
  const parts = input.partsBreakdown || [];
  // Normalize scores to VSTEP 10-point scale if legacy 50-point values are passed
  const toScale10 = (val?: number, max = 10) => {
    if (val === undefined || val === null) return 0;
    if (max > 10 || val > 10) return Number(((val / (max > 10 ? max : 50)) * 10).toFixed(1));
    return Number(val.toFixed(1));
  };

  const overall10 = toScale10(input.totalScore, input.maxScore || 10);
  const listening10 = toScale10(input.listeningScaled, 10);
  const reading10 = toScale10(input.readingScaled, 10);
  const isPass = overall10 >= 4.0 || input.grade === 'Pass' || input.grade === 'High Pass';

  // Sort parts by percentage
  const sortedParts = [...parts].sort((a, b) => b.percentage - a.percentage);
  const bestParts = sortedParts.slice(0, 2);
  const weakestParts = sortedParts.slice(-2);

  // 1. Identify Strengths (Chuẩn VSTEP Bộ GD&ĐT Thang điểm 10)
  const strengths: string[] = [];
  if (isPass) {
    strengths.push(
      `Đạt chuẩn trình độ VSTEP ${input.cefrLevel} theo Khung năng lực ngoại ngữ 6 bậc dùng cho Việt Nam (Điểm tổng kết: ${overall10.toFixed(1)}/10.0 · Xếp loại: ${input.grade}).`
    );
  } else {
    strengths.push(
      `Hoàn thành bài thi trọn vẹn theo cấu trúc VSTEP 4 kỹ năng của Bộ GD&ĐT (Điểm tổng kết hiện tại: ${overall10.toFixed(1)}/10.0). Nắm được định dạng câu hỏi trắc nghiệm và tự luận.`
    );
  }

  if (bestParts.length > 0 && bestParts[0].percentage > 0) {
    bestParts.forEach((p) => {
      if (p.percentage >= 60) {
        strengths.push(
          `Kỹ năng xử lý tốt ở "${p.name}" (đạt ${p.correct}/${p.total} — ${Math.round(p.percentage)}%), phản xạ bắt từ khóa đồng nghĩa (paraphrasing) và nắm bắt ý chính chắc chắn.`
        );
      }
    });
  }

  if (listening10 >= 6.0) {
    strengths.push(
      `Kỹ năng Nghe (Listening) đạt ${listening10.toFixed(1)}/10.0 điểm (Chuẩn B2+): Khả năng nhận diện thông tin chi tiết và loại trừ bẫy phương án nhiễu (distractors) trong hội thoại và bài giảng học thuật rất tốt.`
    );
  } else if (listening10 >= 4.0) {
    strengths.push(
      `Kỹ năng Nghe (Listening) đạt ${listening10.toFixed(1)}/10.0 điểm (Đạt ngưỡng B1): Nắm bắt được thông báo ngắn ở Part 1 và ý chính hội thoại ở Part 2.`
    );
  }

  if (reading10 >= 6.0) {
    strengths.push(
      `Kỹ năng Đọc (Reading) đạt ${reading10.toFixed(1)}/10.0 điểm (Chuẩn B2+): Kỹ năng Skimming & Scanning hiệu quả qua 4 bài đọc dài (40 câu), xử lý tốt câu hỏi từ vựng ngữ cảnh và quy chiếu.`
    );
  } else if (reading10 >= 4.0) {
    strengths.push(
      `Kỹ năng Đọc (Reading) đạt ${reading10.toFixed(1)}/10.0 điểm (Đạt ngưỡng B1): Xử lý ổn định các câu hỏi tìm thông tin trực tiếp (Explicit details) trong văn bản.`
    );
  }

  if (strengths.length < 2) {
    strengths.push(
      'Duy trì được sự tập trung và phân bổ thời gian làm bài xuyên suốt các phần thi VSTEP.'
    );
  }

  // 2. Identify Weaknesses & VSTEP Test Traps
  const weaknesses: string[] = [];
  if (weakestParts.length > 0) {
    weakestParts.forEach((p) => {
      if (p.percentage < 60) {
        if (p.name.includes('Listening Part 1')) {
          weaknesses.push(
            `Điểm số ở "${p.name}" còn khiêm tốn (${p.correct}/${p.total}): Thường bị nhiễu bởi các thông tin sửa đổi giờ giấc, giá tiền hoặc địa điểm ở cuối câu thông báo.`
          );
        } else if (p.name.includes('Listening Part 2')) {
          weaknesses.push(
            `Cần cải thiện "${p.name}" (${p.correct}/${p.total}): Chưa theo kịp mạch hội thoại dài giữa 2 người nói và các từ chuyển ý (Actually, On second thought, However).`
          );
        } else if (p.name.includes('Listening Part 3')) {
          weaknesses.push(
            `Thách thức ở "${p.name}" (${p.correct}/${p.total}): Các bài giảng học thuật (Talks/Lectures) chứa nhiều thuật ngữ chuyên ngành và cấu trúc paraphrase phức tạp.`
          );
        } else {
          weaknesses.push(
            `Cần rèn luyện thêm ở "${p.name}" (${p.correct}/${p.total} — ${Math.round(p.percentage)}%): Chú ý rèn kỹ năng giải quyết câu hỏi suy luận (Inference), tìm vị trí chèn câu [A][B][C][D] và đoán nghĩa từ in đậm.`
          );
        }
      }
    });
  }

  if (listening10 < 4.0) {
    weaknesses.push(
      `Kỹ năng Nghe đạt ${listening10.toFixed(1)}/10.0 (Dưới ngưỡng B1 4.0): Cần luyện đọc trước câu hỏi 30 giây để gạch chân từ khóa và luyện nghe nối âm (connected speech) mỗi ngày.`
    );
  }
  if (reading10 < 4.0) {
    weaknesses.push(
      `Kỹ năng Đọc đạt ${reading10.toFixed(1)}/10.0 (Dưới ngưỡng B1 4.0): Cần mở rộng vốn từ vựng học thuật B1–B2 và quản lý thời gian tối đa 15 phút cho mỗi Passage (4 Passages = 60 phút).`
    );
  }

  if (weaknesses.length === 0) {
    weaknesses.push(
      'Để bứt phá lên Bậc 5 (C1 — từ 8.5/10 trở lên), cần nâng cấp độ tinh tế trong câu hỏi suy luận thái độ tác giả ở Reading Passage 3–4 và sử dụng cấu trúc đảo ngữ/câu phức nâng cao ở Writing Task 2.'
    );
  }

  // 3. VSTEP Writing Feedback (Task 1 ≥ 120 words weight 1/3, Task 2 ≥ 250 words weight 2/3)
  const sub = input.writingSubmission;
  const hasWriting =
    sub &&
    ((sub.task1Text && sub.task1Text.trim().length > 10) ||
      (sub.task2Text && sub.task2Text.trim().length > 10));

  let writingFeedback;
  if (hasWriting) {
    const t1Words = sub.task1WordCount || 0;
    const t2Words = sub.task2WordCount || 0;
    const t1Ok = t1Words >= 120;
    const t2Ok = t2Words >= 250;

    writingFeedback = {
      taskAchievement:
        t1Ok && t2Ok
          ? `Độ dài đáp ứng tốt chuẩn VSTEP Bộ GD&ĐT (Task 1 Thư/Email: ${t1Words} từ [chuẩn ≥ 120 từ]; Task 2 Bài luận Essay: ${t2Words} từ [chuẩn ≥ 250 từ]). Trả lời đầy đủ các yêu cầu đề bài với bố cục 3 phần rõ ràng.`
          : `Lưu ý kiểm soát dung lượng từ chuẩn VSTEP: Task 1 đạt ${t1Words} từ (yêu cầu tối thiểu 120 từ, chiếm 1/3 tổng điểm Viết), Task 2 đạt ${t2Words} từ (yêu cầu tối thiểu 250 từ, chiếm 2/3 tổng điểm Viết). Hãy đảm bảo giải quyết trọn vẹn mọi câu hỏi phụ trong đề.`,
      coherence:
        'Bố cục chia đoạn hợp lý (Mở bài - Các đoạn Thân bài - Kết luận). Cần sử dụng linh hoạt hơn các cụm từ nối học thuật chuẩn B2–C1 (Furthermore, Consequently, On the other hand, Taking everything into consideration).',
      lexicalResource:
        'Vốn từ vựng đáp ứng tốt yêu cầu giao tiếp và nghị luận xã hội. Khuyến khích sử dụng thêm các cụm từ cố định (Academic Collocations) và tránh lặp lại từ vựng của đề bài bằng kỹ thuật Paraphrasing.',
      grammarAccuracy:
        'Kiểm soát ổn định các cấu trúc câu đơn và câu ghép. Để đạt điểm 7.0–8.5+ thang 10 VSTEP, hãy lồng ghép mệnh đề quan hệ, câu điều kiện, cấu trúc bị động khách quan và kiểm tra kỹ sự hòa hợp chủ ngữ - động từ.',
      overallAdvice:
        'Trong 60 phút làm bài Writing VSTEP, hãy phân bổ chuẩn 20 phút cho Task 1 (Thư/Email ≥ 120 từ) và 40 phút cho Task 2 (Essay ≥ 250 từ vì Task 2 nhân hệ số 2). Dành 3 phút cuối rà soát lỗi chính tả.',
    };
  } else {
    writingFeedback = {
      taskAchievement:
        'Thí sinh chưa nộp bài viết cho lượt thi này. Cấu trúc VSTEP Writing (60 phút) gồm Task 1: Viết thư/email tối thiểu 120 từ (trọng số 1/3) và Task 2: Viết bài luận Essay tối thiểu 250 từ (trọng số 2/3).',
      coherence:
        'Cần nắm vững khung dàn ý chuẩn VSTEP: Task 1 (Greeting → Opening → Body trả lời đủ các ý → Closing → Sign-off) và Task 2 (Introduction → Body Paragraph 1 & 2 → Conclusion).',
      lexicalResource:
        'Tích lũy từ vựng theo 10 chủ đề trọng tâm VSTEP: Giáo dục, Công nghệ, Môi trường, Y tế, Giao thông, Việc làm, Gia đình, Du lịch và Văn hóa.',
      grammarAccuracy:
        'Ôn luyện cách kết hợp câu đơn thành câu phức (Although, Despite, Whereas, Not only... but also) để tối ưu điểm tiêu chí Grammar Range & Accuracy.',
      overallAdvice:
        'Hãy luyện viết bấm giờ ít nhất 2 đề Writing mỗi tuần và sử dụng tính năng "AI Giám khảo VSTEP" để được chấm chi tiết 4 tiêu chí trên thang điểm 10.',
    };
  }

  // 4. Structured 4-week VSTEP B1-B2-C1 study plan
  const studyPlan = [
    {
      week: 1,
      title: 'Tuần 1: Làm chủ Listening Part 1–2 & Reading Passage 1–2 chuẩn VSTEP',
      focusSkills: 'Listening (Thông báo ngắn & Hội thoại) + Reading (Skimming & Scanning)',
      tasks: [
        'Luyện nghe 20 thông báo ngắn (Part 1) và 6 đoạn hội thoại (Part 2), tập trung bắt từ khóa chỉ thời gian, địa điểm, mục đích và sự thay đổi quyết định.',
        'Thực hành kỹ thuật đọc lướt (Skimming) tìm ý chính và đọc quét (Scanning) tìm từ khóa cho Reading Passage 1 & 2 trong giới hạn 12 phút/bài.',
        'Học 100 từ vựng VSTEP B1–B2 theo ngữ cảnh kèm Flashcard & Spaced Repetition ngay trên hệ thống.',
      ],
      grammarPoints: [
        'Các thì hiện tại, quá khứ, tương lai và dấu hiệu nhận biết sự thay đổi thông tin trong bài nghe.',
        'Đại từ quy chiếu (it, they, this, those, which, who) phục vụ câu hỏi Reference trong Reading.',
      ],
    },
    {
      week: 2,
      title: 'Tuần 2: Bứt phá Viết Thư Task 1 (≥ 120 từ) & Giao tiếp Nói Part 1–2',
      focusSkills: 'Writing Task 1 (Formal/Informal Letter) & Speaking Part 1–2 (Social & Solution)',
      tasks: [
        'Nắm vững cấu trúc 4 loại thư VSTEP Task 1: Thư cảm ơn, Thư xin lỗi, Thư hỏi/cung cấp thông tin, Thư phàn nàn (đảm bảo ≥ 120 từ trong 20 phút).',
        'Luyện trả lời Speaking Part 1 (Social Interaction): mở rộng mỗi câu trả lời lên 3–4 câu bằng công thức Direct Answer + Reason + Example.',
        'Thực hành Speaking Part 2 (Solution Discussion): trình bày rõ lý do chọn 1 giải pháp tối ưu và phản biện 2 lựa chọn còn lại.',
      ],
      grammarPoints: [
        'Cấu trúc câu lịch sự trong viết thư trang trọng (I am writing to inquire about..., I would appreciate it if you could...).',
        'Cấu trúc đưa lời khuyên và so sánh giải pháp (If I were in this situation, I would opt for... because...).',
      ],
    },
    {
      week: 3,
      title: 'Tuần 3: Chinh phục Listening Part 3, Reading Passage 3–4 & Essay Task 2 (≥ 250 từ)',
      focusSkills: 'Listening Lectures, Reading Inference/Insertion & Writing Essay Task 2',
      tasks: [
        'Luyện nghe bài giảng học thuật Listening Part 3 (Câu 21–35) kết hợp đọc đối chiếu Transcript song ngữ và Evidence Quote.',
        'Rèn kỹ năng xử lý câu hỏi chèn câu vào ô vuông [A][B][C][D] và câu hỏi suy luận thái độ tác giả ở Reading Passage 3 & 4.',
        'Viết hoàn chỉnh 3 bài luận VSTEP Task 2 (≥ 250 từ): dạng Opinion, Discussion, Problem-Solution và Advantage-Disadvantage.',
      ],
      grammarPoints: [
        'Mệnh đề trạng ngữ chỉ sự nhượng bộ và nguyên nhân - kết quả (Although, Despite the fact that, Consequently, Therefore).',
        'Cấu trúc câu bị động khách quan trong bài luận học thuật (It is widely believed that..., Many people argue that...).',
      ],
    },
    {
      week: 4,
      title: 'Tuần 4: Phát triển Chủ đề Mind-map Speaking Part 3 & Tổng duyệt Thi thử 4 Kỹ năng',
      focusSkills: 'Speaking Part 3 (Topic Development) & Full VSTEP Mock Test (172 phút)',
      tasks: [
        'Luyện phát triển sơ đồ tư duy (Mind-map) Speaking Part 3 trong 5 phút và trả lời câu hỏi mở rộng (Follow-up questions).',
        'Thực hiện 2 bài Thi thử (Full 4 kỹ năng L-R-W-S · 172 phút) bấm giờ nghiêm ngặt như phòng thi thật.',
        'Phân tích chi tiết bảng chấm AI Writing, AI Speaking và ôn lại toàn bộ các câu đã gắn cờ (Flag) trong quá trình làm đề.',
      ],
      grammarPoints: [
        'Câu điều kiện hỗn hợp, cấu trúc nhấn mạnh (Cleft sentences: It is... that...) và liên từ học thuật C1.',
        'Tổng rà soát lỗi chính tả, mạo từ (a/an/the) và sự hòa hợp chủ ngữ - động từ.',
      ],
    },
  ];

  // 5. Recommended Resources for VSTEP B1–B2–C1
  const recommendedResources = [
    'Định dạng đề thi Đánh giá năng lực Tiếng Anh bậc 3–5 (VSTEP B1–B2–C1) theo Quyết định số 729/QĐ-BGDĐT của Bộ GD&ĐT',
    'Kho đề thi VSTEP 4 Kỹ năng & Bộ Flashcard Từ vựng SM-2 tích hợp sẵn trên hệ thống VSTEP Tutor',
    'Cambridge English Vocabulary in Use: Upper-Intermediate & Advanced (B2–C1)',
    'Academic Writing for VSTEP B1–B2–C1: Chiến thuật viết Thư (≥120 từ) & Bài luận (≥250 từ)',
    'TED-Ed & BBC Learning English (6 Minute English) — Luyện phản xạ Nghe bài giảng Part 3',
  ];

  // 6. Encouragement
  const encouragement = isPass
    ? `Chúc mừng bạn đã đạt kết quả rất khả quan (${overall10.toFixed(1)}/10.0 — ${input.cefrLevel})! Với nền tảng hiện tại, bạn hoàn toàn tự tin chinh phục kỳ thi VSTEP chính thức và hướng tới bậc cao hơn (B2/C1). Hãy duy trì chuỗi ngày học (Streak) đều đặn 30–45 phút mỗi ngày theo lộ trình 4 tuần trên nhé!`
    : `Đừng nản lòng nhé! Bài thi lần này (${overall10.toFixed(1)}/10.0) đã giúp bạn định vị chính xác những phần kỹ năng cần bồi đắp để vượt mốc 4.0 (B1) và 6.0 (B2). Chỉ cần bám sát lộ trình 4 tuần, luyện kỹ các câu sai qua Transcript song ngữ và rèn viết/nói cùng AI Giám khảo VSTEP, điểm số của bạn chắc chắn sẽ bứt phá!`;

  return {
    strengths,
    weaknesses,
    writingFeedback,
    studyPlan,
    recommendedResources,
    encouragement,
  };
}
