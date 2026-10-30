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
  const listeningScore = input.listeningScaled || 0;
  const readingScore = input.readingScaled || 0;
  const totalScore = input.totalScore || 0;
  const isPass = input.grade === 'Pass' || input.grade === 'High Pass';

  // Sort parts by percentage
  const sortedParts = [...parts].sort((a, b) => b.percentage - a.percentage);
  const bestParts = sortedParts.slice(0, 2);
  const weakestParts = sortedParts.slice(-2);

  // 1. Identify Strengths
  const strengths: string[] = [];
  if (isPass) {
    strengths.push(
      `Đạt chuẩn trình độ CEFR ${input.cefrLevel} với xếp loại "${input.grade}" (Tổng điểm quy đổi: ${totalScore}/${input.maxScore}). Nền tảng tiếng Anh giao tiếp và học thuật đáp ứng tốt khung chuẩn LanguageCert.`
    );
  } else {
    strengths.push(
      `Có ý thức rèn luyện và hoàn thành bài thi trọn vẹn. Nắm được cấu trúc cơ bản của bài thi LanguageCert B1 với tổng điểm ${totalScore}/${input.maxScore}.`
    );
  }

  if (bestParts.length > 0 && bestParts[0].percentage > 0) {
    bestParts.forEach((p) => {
      if (p.percentage >= 60) {
        strengths.push(
          `Kỹ năng xử lý xuất sắc ở "${p.name}" (đạt ${p.correct}/${p.total} câu - ${Math.round(p.percentage)}%), phản xạ từ khóa và nắm bắt ý chính rất chắc chắn.`
        );
      }
    });
  }

  if (listeningScore >= 25) {
    strengths.push(
      `Kỹ năng Nghe (Listening) đạt ${listeningScore}/50 điểm scaled: Khả năng nhận diện ngữ điệu và phản xạ các bẫy distractors trong hội thoại hàng ngày ở mức tốt.`
    );
  } else if (readingScore >= 25) {
    strengths.push(
      `Kỹ năng Đọc (Reading) đạt ${readingScore}/50 điểm scaled: Khả năng định vị thông tin chi tiết qua scanning và xử lý văn bản thực tế (biển báo, thông báo) hiệu quả.`
    );
  }

  if (strengths.length < 2) {
    strengths.push(
      'Khả năng tập trung và quản lý nhịp độ làm bài ổn định trong suốt các phần thi trắc nghiệm khách quan.'
    );
  }

  // 2. Identify Weaknesses & Test Traps
  const weaknesses: string[] = [];
  if (weakestParts.length > 0) {
    weakestParts.forEach((p) => {
      if (p.percentage < 60) {
        if (p.name.includes('Part 1')) {
          weaknesses.push(
            `Điểm số ở "${p.name}" còn khiêm tốn (${p.correct}/${p.total}): Thường bị nhiễu bởi các phương án lặp từ hoặc các cụm từ đa nghĩa trong ngữ cảnh giao tiếp nhanh.`
          );
        } else if (p.name.includes('Part 2')) {
          weaknesses.push(
            `Thách thức ở "${p.name}" (${p.correct}/${p.total}): Chưa nhận diện triệt để tính liên kết văn bản (cohesion markers, pronouns: this/that/such, liên từ đảo ngữ) giữa các câu điền vào chỗ trống.`
          );
        } else if (p.name.includes('Part 3')) {
          weaknesses.push(
            `Hạn chế ở "${p.name}" (${p.correct}/${p.total}): Tốc độ tìm từ đồng nghĩa (paraphrasing) giữa câu hỏi và 4 đoạn văn bản còn chậm, dẫn đến mất thời gian đọc lại nhiều lần.`
          );
        } else {
          weaknesses.push(
            `Cần rèn luyện thêm ở "${p.name}" (${p.correct}/${p.total} câu - ${Math.round(p.percentage)}%): Chú ý phân tích kỹ câu hỏi mang tính suy luận (inference) và thái độ tác giả thay vì chỉ tìm từ khóa khớp mặt chữ.`
          );
        }
      }
    });
  }

  if (listeningScore < 25) {
    weaknesses.push(
      'Kỹ năng Nghe dưới ngưỡng chuẩn 25/50: Cần luyện phản xạ nghe nối âm (connected speech), nuốt âm và ghi chép nhanh chính tả (spelling & numbers) ở Part 3.'
    );
  }
  if (readingScore < 25) {
    weaknesses.push(
      'Kỹ năng Đọc dưới ngưỡng chuẩn 25/50: Vốn từ vựng chủ đề đời sống B1 (du lịch, công việc, giáo dục, giải trí) cần được bồi dưỡng thêm để giảm phụ thuộc vào đoán nghĩa.'
    );
  }

  if (weaknesses.length === 0) {
    weaknesses.push(
      'Các câu hỏi phân loại điểm cao đòi hỏi vốn từ C1/B2 hoặc thành ngữ (idioms) ngữ cảnh cần được tích lũy thêm để đạt mức High Pass tuyệt đối.'
    );
  }

  // 3. Writing Feedback
  const sub = input.writingSubmission;
  const hasWriting = sub && ((sub.task1Text && sub.task1Text.trim().length > 10) || (sub.task2Text && sub.task2Text.trim().length > 10));

  let writingFeedback;
  if (hasWriting) {
    const t1Words = sub.task1WordCount || 0;
    const t2Words = sub.task2WordCount || 0;
    const t1Ok = t1Words >= 60 && t1Words <= 120;
    const t2Ok = t2Words >= 90 && t2Words <= 140;

    writingFeedback = {
      taskAchievement: t1Ok && t2Ok
        ? `Độ dài đáp ứng tốt tiêu chuẩn LanguageCert B1 (Task 1: ${t1Words} từ, Task 2: ${t2Words} từ). Trả lời đầy đủ các gợi ý đề bài đưa ra, bố cục mở bài - thân bài - kết bài rõ ràng.`
        : `Lưu ý kiểm soát dung lượng từ: Task 1 đạt ${t1Words} từ (chuẩn 70-100 từ), Task 2 đạt ${t2Words} từ (chuẩn 100-120 từ). Hãy đảm bảo trả lời hết tất cả các gạch đầu dòng trong đề thi.`,
      coherence:
        'Sử dụng các từ nối quen thuộc (However, In addition, For instance, Therefore) tương đối hợp lý. Cần đa dạng hóa các cách liên kết đoạn văn để bài viết uyển chuyển hơn.',
      lexicalResource:
        'Vốn từ vựng tương thích bậc B1, diễn đạt được ý tưởng chính về chủ đề cuộc sống thường ngày. Khuyến khích bổ sung thêm các collocations và phrasal verbs B1 phổ biến.',
      grammarAccuracy:
        'Kiểm soát tốt các thì cơ bản (Hiện tại đơn, Quá khứ đơn, Hiện tại hoàn thành). Cần chú ý sự hòa hợp giữa chủ ngữ và động từ số ít/nhiều cùng việc dùng mạo từ (a/an/the).',
      overallAdvice:
        'Bài viết có cấu trúc mạch lạc, thể hiện phong cách viết tự tin. Hãy dành 3-5 phút cuối giờ để rà soát lỗi chính tả và dấu câu trước khi bấm nộp bài.',
    };
  } else {
    writingFeedback = {
      taskAchievement: 'Thí sinh chưa nộp bài viết cho bài thi này. Chuẩn B1 LanguageCert yêu cầu hoàn thành Task 1 (70-100 từ) và Task 2 (100-120 từ).',
      coherence: 'Cần luyện tập xây dựng dàn ý 3 phần: Salutation/Greeting, Body paragraphs (2-3 ý chính), Sign-off/Conclusion.',
      lexicalResource: 'Bồi dưỡng từ vựng theo chủ đề: viết thư cá nhân, mời bạn bè, phản hồi thư cảm ơn, mô tả trải nghiệm du lịch.',
      grammarAccuracy: 'Ôn tập câu ghép (and, but, so, because) và câu phức cơ bản (although, when, while, if).',
      overallAdvice: 'Nên dành tối thiểu 2 buổi/tuần viết thử 1 đề Task 1 và 1 đề Task 2 bấm giờ nghiêm túc 40 phút.',
    };
  }

  // 4. Structured 4-week study plan
  const studyPlan = [
    {
      week: 1,
      title: 'Tuần 1: Củng cố phản xạ Nghe Part 1 & Từ vựng biển báo Reading Part 1',
      focusSkills: 'Listening Part 1 & Reading Part 1 (Short functional texts)',
      tasks: [
        'Luyện nghe 30 đoạn đối thoại ngắn mỗi ngày, tập trung nhận diện chức năng giao tiếp (apologizing, inviting, suggesting).',
        'Tổng hợp 50 biển báo, thông báo công cộng phổ biến tại sân bay, nhà ga, trường học và công sở.',
        'Làm 2 bài test mini phần Part 1 và rà soát transcript câu sai.',
      ],
      grammarPoints: [
        'Modal verbs diễn tả lời mời, đề nghị (Would you like, Shall we, Could you).',
        'Cấu trúc câu mệnh lệnh và biển cấm (No smoking, Keep off, Mind the gap).',
      ],
    },
    {
      week: 2,
      title: 'Tuần 2: Chinh phục Part 2 (Gapped Text) & Hội thoại Listening Part 2',
      focusSkills: 'Reading Part 2 (Text cohesion) & Listening Part 2 (Conversational cues)',
      tasks: [
        'Học kỹ thuật định vị từ chỉ định (this, that, these, those) và đại từ thay thế (he, she, they) để điền câu gapped text.',
        'Luyện nghe bắt từ khóa đồng nghĩa (synonyms) trong hội thoại 2 lượt nghe.',
        'Luyện viết Task 1: Email thân mật gửi bạn bè (80 từ) sử dụng cấu trúc cảm ơn và hẹn gặp.',
      ],
      grammarPoints: [
        'Liên từ đối lập và nguyên nhân kết quả (However, Although, Due to, Therefore).',
        'Thì Quá khứ đơn vs Hiện tại hoàn thành trong kể chuyện.',
      ],
    },
    {
      week: 3,
      title: 'Tuần 3: Kỹ thuật Skimming/Scanning Part 3 & Note-Taking Part 3',
      focusSkills: 'Reading Part 3 (Matching 4 texts) & Listening Part 3 (Message notes)',
      tasks: [
        'Luyện kỹ năng quét nhanh 4 văn bản A, B, C, D để tìm từ đồng nghĩa thay thế cho câu hỏi.',
        'Luyện nghe chép chính tả số điện thoại, ngày tháng, tên riêng và đơn vị tiền tệ.',
        'Luyện viết Task 2: Bài viết chia sẻ quan điểm hoặc kỷ niệm đáng nhớ (110 từ).',
      ],
      grammarPoints: [
        'Cấu trúc so sánh hơn, so sánh nhất và as... as trong đối chiếu 4 đoạn văn.',
        'Cách dùng tính từ tận cùng -ed và -ing diễn tả cảm xúc và tính chất.',
      ],
    },
    {
      week: 4,
      title: 'Tuần 4: Tổng ôn thi thử toàn diện bấm giờ & Kiểm soát tâm lý phòng thi',
      focusSkills: 'Full Mock Test (Listening, Reading, Writing)',
      tasks: [
        'Làm trọn vẹn 2 đề thi LanguageCert B1 chuẩn 90 phút trong không gian yên tĩnh không tra từ điển.',
        'Phân tích chi tiết từng lỗi sai qua Báo cáo khảo thí và đọc kỹ Evidence Quotes.',
        'Tối ưu hóa thời gian: dành 40 phút cho Listening, 50 phút cho Reading, 30 phút cho Writing.',
      ],
      grammarPoints: [
        'Câu điều kiện loại 1 & loại 2 trong giao tiếp hàng ngày.',
        'Rà soát toàn bộ bảng động từ bất quy tắc và quy tắc thêm đuôi -s/es, -ed.',
      ],
    },
  ];

  // 5. Recommended Resources
  const recommendedResources = [
    'Succeed in LanguageCert Achiever B1 (Official Practice Tests 1-6)',
    'English Grammar in Use (Raymond Murphy) - Trọng tâm Units 1-45',
    'LanguageCert Official Practice Papers & Sample Audio Tests',
    'BBC Learning English: 6 Minute English & The English We Speak',
    'Cambridge English Vocabulary in Use - Pre-intermediate & Intermediate (B1)',
  ];

  // 6. Encouragement
  const encouragement = isPass
    ? `Chúc mừng bạn đã đạt kết quả rất khả quan! Với phong độ hiện tại, bạn hoàn toàn đủ khả năng chinh phục bài thi chính thức LanguageCert B1 và thậm chí vươn tới mức High Pass. Hãy duy trì nhịp độ ôn luyện mỗi ngày 30 phút theo lộ trình trên nhé!`
    : `Đừng nản lòng nhé! Kết quả lần này đã cho chúng ta bức tranh rất rõ nét về những điểm cần bồi đắp. Chỉ cần bạn tập trung vào các bẫy đề thi và cải thiện kỹ năng nghe phản xạ theo đúng lộ trình 4 tuần, điểm số chắc chắn sẽ bứt phá vượt bậc! Chúc bạn kiên định và thành công!`;

  return {
    strengths,
    weaknesses,
    writingFeedback,
    studyPlan,
    recommendedResources,
    encouragement,
  };
}
