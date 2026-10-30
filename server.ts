import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

import { generateSmartDiagnosticReport } from './src/utils/aiDiagnosticFallback.ts';

// Initialize Google Gen AI with server-side API Key
const ai = new GoogleGenAI(process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY } : {});

/**
 * Robust Gemini generation with fallback across models and timeout protection
 */
async function generateGeminiSafe(options: {
  contents: any;
  config?: any;
  preferredModels?: string[];
  timeoutMs?: number;
}) {
  const models = options.preferredModels || [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];
  const timeoutMs = options.timeoutMs || 35000;
  let lastError: any = null;

  for (const model of models) {
    try {
      const genPromise = ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout calling model ${model}`)), timeoutMs)
      );

      const response = (await Promise.race([genPromise, timeoutPromise])) as any;
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`[Gemini Safe] Model ${model} failed or timed out:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('Không thể kết nối đến các mô hình AI.');
}

/**
 * AI PDF Exam Ingestion Endpoint
 * Takes PDF Base64 (and optional answer key / transcript) and extracts complete LanguageCert exam structure
 */
app.post('/api/ai/parse-exam-pdf', async (req, res) => {
  try {
    const {
      pdfBase64,
      answerKeyPdfBase64,
      answerKeyText,
      transcriptPdfBase64,
      transcriptText,
      examTitle = 'Đề thi LanguageCert B1 mới',
    } = req.body;

    if (!pdfBase64 && !answerKeyText && !transcriptText) {
      return res.status(400).json({ error: 'Vui lòng cung cấp file PDF đề thi hoặc nội dung đề.' });
    }

    const contents: any[] = [];

    // Attach exam PDF
    if (pdfBase64) {
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      });
    }

    // Attach answer key PDF if provided
    if (answerKeyPdfBase64) {
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: answerKeyPdfBase64,
        },
      });
    }

    // Attach transcript PDF if provided
    if (transcriptPdfBase64) {
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: transcriptPdfBase64,
        },
      });
    }

    const promptText = `Bạn là Trợ lý AI Khảo thí Ngôn ngữ Quốc tế chuyên trích xuất và số hóa tài liệu luyện thi LanguageCert International ESOL (IESOL B1 Achiever).

HÃY BÓC TÁCH VÀ CHUYỂN ĐỔI FILE PDF THÀNH CẤU TRÚC ĐỀ THI ĐẦY ĐỦ CẢ 3 KỸ NĂNG (LISTENING, READING, WRITING):
1. Cấu trúc chuẩn 52 câu hỏi + 2 bài viết:
   - PHẦN NGHE (LISTENING - Câu 1 đến 26):
     * Part 1 (id: 1..7, partNumber: 1, section: "LISTENING", type: "mcq"): 7 câu trắc nghiệm A, B, C.
     * Part 2 (id: 8..13, partNumber: 2, section: "LISTENING", type: "mcq"): 3 đoạn hội thoại (mỗi đoạn 2 câu), kèm contextTitle (ví dụ: "Conversation 1 (Questions 1-2)").
     * Part 3 (id: 14..20, partNumber: 3, section: "LISTENING", type: "notes"): Điền từ vào phiếu ghi chú (tối đa 3 từ). Gắn "notesData": { "title": "Tiêu đề bảng ghi chú", "items": [{ "label": "Nhãn mục", "prefix": "Văn bản trước ô trống", "questionId": 14, "suffix": "Văn bản sau ô trống" }] } vào câu số 14.
     * Part 4 (id: 21..26, partNumber: 4, section: "LISTENING", type: "mcq"): 6 câu trắc nghiệm A, B, C.
   - PHẦN ĐỌC (READING - Câu 27 đến 52 - BẮT BUỘC TRÍCH XUẤT ĐẦY ĐỦ TỪ PDF):
     * Part 1 (id: 27..31, partNumber: 1, section: "READING", type: "mcq"): 5 văn bản ngắn/biển báo/email. MỖI CÂU (27..31) PHẢI CÓ "stimulusCard": { "header": "Tiêu đề/Loại biển báo", "body": "Nội dung văn bản trong khung", "footer": "Ghi chú cuối nếu có" } và 3 lựa chọn A, B, C.
     * Part 2 (id: 32..37, partNumber: 2, section: "READING", type: "gapped_text"): Bài đọc đục lỗ 6 câu (câu 32 đến 37, tương ứng lỗ trống 1 đến 6 trong bài). Câu số 32 PHẢI CHỨA:
       - "gappedArticle": { "title": "Tiêu đề bài đọc Part 2", "paragraphs": ["Đoạn văn có chứa {{32}}, {{33}}, {{34}}, {{35}}, {{36}}, {{37}} ngay tại vị trí các ô trống trong bài đọc"] }
       - "gappedOptions": [{ "id": "A", "text": "Câu A..." }, { "id": "B", "text": "Câu B..." }, ..., { "id": "G", "text": "Câu G..." }] (7 câu A-G).
     * Part 3 (id: 38..44, partNumber: 3, section: "READING", type: "matching"): Đọc 4 đoạn văn A, B, C, D và nối với 7 câu hỏi (38..44). Câu số 38 PHẢI CHỨA:
       - "multiTextCards": [{ "id": "A", "title": "Text A", "content": "Toàn bộ nội dung đoạn A", "vietnameseTranslation": "Bản dịch tiếng Việt hoàn chỉnh của đoạn A..." }, { "id": "B", "title": "Text B", "content": "...", "vietnameseTranslation": "Bản dịch tiếng Việt đoạn B..." }, { "id": "C", "title": "Text C", "content": "...", "vietnameseTranslation": "Bản dịch tiếng Việt đoạn C..." }, { "id": "D", "title": "Text D", "content": "...", "vietnameseTranslation": "Bản dịch tiếng Việt đoạn D..." }]
       - BẮT BUỘC DỊCH TOÀN BỘ 4 ĐOẠN VĂN A-D TRỰC TIẾP VÀO TRƯỜNG "vietnameseTranslation" của từng card.
       - Mỗi câu 38..44 có "prompt": "Which text..." và options A, B, C, D.
     * Part 4 (id: 45..52, partNumber: 4, section: "READING", type: "short_answer"): Bài đọc dài trả lời ngắn (tối đa 3 từ). Câu số 45 PHẢI CHỨA:
       - "readingArticle": { "title": "Tiêu đề bài báo Part 4", "paragraphs": ["Đoạn 1...", "Đoạn 2...", "Đoạn 3..."] }
       - "readingArticleTranslation": { "title": "Tiêu đề tiếng Việt", "paragraphs": ["Bản dịch đoạn 1...", "Bản dịch đoạn 2...", "Bản dịch đoạn 3..."] } chứa bản dịch tiếng Việt trọn vẹn của toàn bộ bài đọc.
       - Mỗi câu 45..52 có câu hỏi "prompt" và "correctAnswer" là cụm từ ngắn.
   - PHẦN VIẾT (WRITING - 2 Tasks):
     * Trích xuất mảng "writingTasks" gồm 2 phần tử cho Writing Part 1 (70-100 từ) và Writing Part 2 (100-120 từ) nếu có trong PDF (hoặc tạo đề Writing B1 sát chủ đề đề thi nếu PDF không đính kèm trang Writing).

2. YÊU CẦU CHẤT LƯỢNG:
   - TUYỆT ĐỐI KHÔNG BỎ SÓT PHẦN READING (Câu 27 đến 52). Phải trích xuất đầy đủ cả 52 câu hỏi (1-26 Listening, 27-52 Reading).
   - BẮT BUỘC DỊCH SẴN TOÀN BỘ: Reading Part 3 (4 đoạn A, B, C, D vào multiTextCards.vietnameseTranslation) và Reading Part 4 (toàn bài đọc vào readingArticleTranslation) để học viên xem bản dịch tức thì không phải chờ dịch thủ công bằng AI.
   - Cung cấp đáp án đúng ("correctAnswer"), trích dẫn câu bằng chứng nguyên văn ("evidenceQuote") cho các câu ở Listening Part 2, 3, 4 và Reading Part 2, 3, 4 (riêng Listening Part 1 không cần evidenceQuote), bản dịch tiếng Việt ("vietnameseTranslation" - riêng Reading Part 2 dịch đoạn văn ngay phía trước ô trống), cùng lời thoại gom theo người nói A:, B:, C: ("audioScript" và "audioScriptTranslation").

Dữ liệu bổ sung nếu có:
${answerKeyText ? `[ĐÁP ÁN ĐÍNH KÈM]:\n${answerKeyText}\n` : ''}
${transcriptText ? `[TRANSCRIPT ĐÍNH KÈM]:\n${transcriptText}\n` : ''}

Trả về DUY NHẤT một JSON hợp lệ với cấu trúc:
{
  "title": "${examTitle}",
  "subtitle": "Đề thi LanguageCert B1 đầy đủ Listening, Reading & Writing",
  "totalQuestions": 52,
  "durationMinutes": 90,
  "writingTasks": [
    {
      "id": "writing-part-1",
      "partNumber": 1,
      "title": "Writing Part 1",
      "instruction": "Read the email/notice below and write a response...",
      "stimulusText": "Nội dung văn bản/email gợi ý của đề...",
      "bulletPoints": ["Ý yêu cầu 1", "Ý yêu cầu 2", "Ý yêu cầu 3"],
      "minWords": 70,
      "maxWords": 100,
      "sampleAnswer": "Bài viết mẫu chuẩn B1..."
    },
    {
      "id": "writing-part-2",
      "partNumber": 2,
      "title": "Writing Part 2",
      "instruction": "Write a letter / composition...",
      "stimulusText": "Ngữ cảnh đề bài...",
      "bulletPoints": ["Ý yêu cầu 1", "Ý yêu cầu 2"],
      "minWords": 100,
      "maxWords": 120,
      "sampleAnswer": "Bài viết mẫu chuẩn B1..."
    }
  ],
  "questions": [
    {
      "id": 1,
      "partNumber": 1,
      "section": "LISTENING",
      "type": "mcq",
      "instruction": "Listen and choose the best reply.",
      "prompt": "...",
      "options": [{ "id": "A", "text": "..." }, { "id": "B", "text": "..." }, { "id": "C", "text": "..." }],
      "correctAnswer": "A",
      "evidenceQuote": "...",
      "vietnameseTranslation": "Dịch câu hỏi | A. Dịch A | B. Dịch B | C. Dịch C",
      "audioScript": "A: ...\nB: ...",
      "audioScriptTranslation": "A: ...\nB: ..."
    }
  ]
}`;

    contents.push({ text: promptText });

    const response = await generateGeminiSafe({
      preferredModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
      contents,
      config: {
        systemInstruction:
          'Bạn là chuyên gia số hóa đề thi LanguageCert B1 IESOL. Bắt buộc trích xuất đầy đủ cả phần LISTENING (1-26), phần READING (27-52 kèm toàn bộ văn bản đọc stimulusCard, gappedArticle, gappedOptions, multiTextCards, readingArticle) và phần WRITING (writingTasks). Chỉ trả về JSON hợp lệ.',
        responseMimeType: 'application/json',
      },
      timeoutMs: 90000,
    });

    const text = response.text || '{}';
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanJson);
    return res.json(result);
  } catch (error: unknown) {
    console.error('Error parsing exam PDF with Gemini:', error);
    const msg = error instanceof Error ? error.message : 'Lỗi khi trích xuất đề thi từ PDF';
    return res.status(500).json({ error: msg });
  }
});

/**
 * AI Bilingual Translation Endpoint
 * Translates individual sentences or full reading articles/transcripts into Vietnamese
 */
app.post('/api/ai/translate', async (req, res) => {
  try {
    const { text, context = '' } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Thiếu văn bản cần dịch' });
    }

    const prompt = `Dịch đoạn văn bản tiếng Anh sau sang tiếng Việt tự nhiên, chuẩn xác, phục vụ học tập luyện thi LanguageCert B1:
${context ? `Ngữ cảnh: ${context}\n` : ''}
Văn bản tiếng Anh:
"""
${text}
"""

Chỉ trả về bản dịch tiếng Việt, không kèm lời dẫn hay giải thích thêm.`;

    const response = await generateGeminiSafe({
      preferredModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
      contents: prompt,
      timeoutMs: 15000,
    });

    return res.json({ translation: (response.text || '').trim() });
  } catch (error: unknown) {
    console.error('Error translating text:', error);
    const msg = error instanceof Error ? error.message : 'Lỗi khi dịch thuật';
    return res.status(500).json({ error: msg });
  }
});

/**
 * AI Vocabulary Generation Endpoint
 * Supports 3 modes:
 * - 'theme': Generates curated B1 vocabulary items based on a topic / prompt
 * - 'reading': Extracts and contextualizes key B1 vocabulary from a reading passage
 * - 'image': Extracts vocabulary from uploaded study materials / textbook photos (OCR)
 */
app.post('/api/ai/generate-vocab', async (req, res) => {
  try {
    const { mode = 'theme', topic = '', passage = '', imageBase64 = '', mimeType = 'image/jpeg', count = 12 } = req.body;

    const systemInstruction = `Bạn là Trưởng ban Khảo thí Tiếng Anh LanguageCert B1 IESOL Achiever.
Nhiệm vụ của bạn là bóc tách hoặc tạo danh sách từ vựng chuẩn CEFR B1 tiếng Anh phục vụ trực tiếp cho kỳ thi LanguageCert B1 (Listening & Reading).
Mỗi từ vựng phải chính xác, có phiên âm IPA chuẩn, từ loại (n, v, adj, adv, phr), định nghĩa tiếng Việt chuẩn sư phạm, câu ví dụ tiếng Anh thực tế kèm bản dịch tiếng Việt, và cụm từ/collocation đi kèm nếu có.
Chỉ trả về JSON hợp lệ theo định dạng danh sách mảng đối tượng:
[
  {
    "word": "accommodate",
    "phonetic": "/əˈkɒm.ə.deɪt/",
    "partOfSpeech": "v",
    "meaningVi": "cung cấp chỗ ở, đáp ứng sức chứa",
    "exampleEn": "The new hotel can accommodate up to 500 guests.",
    "exampleVi": "Khách sạn mới có thể cung cấp chỗ ở cho tối đa 500 khách.",
    "collocations": "accommodate needs, accommodate guests",
    "note": "Xuất hiện phổ biến trong Reading Part 1 & Part 3"
  }
]`;

    let contents: any[] = [];

    if (mode === 'image' && imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      contents = [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text: `Đọc và bóc tách tối đa ${count} từ vựng tiếng Anh quan trọng nhất (ưu tiên cấp độ B1) từ hình ảnh tài liệu/sách này. Trả về đúng JSON mảng các từ vựng.`,
        },
      ];
    } else if (mode === 'reading' && passage) {
      contents = [
        {
          text: `Trích xuất ${count} từ vựng cốt lõi cấp độ B1 từ bài đọc sau, giải nghĩa chuẩn xác theo ngữ cảnh bài đọc và đưa ví dụ song ngữ:
Bài đọc:
"""
${passage}
"""`,
        },
      ];
    } else {
      // Default: theme mode
      const selectedTopic = topic || 'Daily Communication & Workplace';
      contents = [
        {
          text: `Hãy tạo danh sách ${count} từ vựng tiêu biểu nhất cấp độ B1 cho chủ đề: "${selectedTopic}". Từ vựng cần sát với đề thi LanguageCert B1.`,
        },
      ];
    }

    const response = await generateGeminiSafe({
      preferredModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
      timeoutMs: 35000,
    });

    const text = response.text || '[]';
    const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(cleanJson);
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
        parsed = (parsed as any).items || (parsed as any).vocab || (parsed as any).words || [];
      }
    } catch {
      parsed = [];
    }

    // Standardize IDs and cefr level
    const standardized = (parsed || []).map((item, idx) => ({
      id: `ai_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      word: String(item.word || '').trim(),
      phonetic: String(item.phonetic || '').trim(),
      partOfSpeech: (['n', 'v', 'adj', 'adv', 'phr'].includes(item.partOfSpeech) ? item.partOfSpeech : 'n'),
      meaningVi: String(item.meaningVi || item.meaning || '').trim(),
      exampleEn: String(item.exampleEn || item.example || '').trim(),
      exampleVi: String(item.exampleVi || item.translation || '').trim(),
      topic: topic || 'AI Generated',
      cefr: 'B1',
      collocations: Array.isArray(item.collocations) ? item.collocations.join(', ') : (item.collocations || ''),
      note: item.note || '',
    })).filter(it => it.word.length > 0);

    return res.json({ items: standardized, count: standardized.length });
  } catch (error: unknown) {
    console.error('Error generating vocab with AI:', error);
    // Graceful fallback with standard B1 items matching topic
    const fallbackTopic = (req.body?.topic || 'General B1').toLowerCase();
    const fallbackItems = [
      {
        id: `ai_fallback_${Date.now()}_1`,
        word: 'convenient',
        phonetic: '/kənˈviː.ni.ənt/',
        partOfSpeech: 'adj',
        meaningVi: 'tiện lợi, thuận tiện',
        exampleEn: 'The office is located near the station, which is very convenient.',
        exampleVi: 'Văn phòng nằm gần nhà ga, rất thuận tiện.',
        topic: req.body?.topic || 'General B1',
        cefr: 'B1',
        collocations: 'convenient time, convenient location',
        note: 'Hay gặp trong Reading Part 1 & Listening Part 2'
      },
      {
        id: `ai_fallback_${Date.now()}_2`,
        word: 'recommendation',
        phonetic: '/ˌrek.ə.menˈdeɪ.ʃən/',
        partOfSpeech: 'n',
        meaningVi: 'sự giới thiệu, lời khuyên, đề xuất',
        exampleEn: 'I followed my doctor’s recommendation and rested.',
        exampleVi: 'Tôi đã nghe theo lời khuyên của bác sĩ và nghỉ ngơi.',
        topic: req.body?.topic || 'General B1',
        cefr: 'B1',
        collocations: 'give a recommendation, strong recommendation',
        note: 'Xuất hiện trong Writing Part 2'
      },
      {
        id: `ai_fallback_${Date.now()}_3`,
        word: 'participate',
        phonetic: '/pɑːˈtɪs.ɪ.peɪt/',
        partOfSpeech: 'v',
        meaningVi: 'tham gia, dự phần',
        exampleEn: 'All students are encouraged to participate in sports.',
        exampleVi: 'Tất cả học sinh được khuyến khích tham gia thể thao.',
        topic: req.body?.topic || 'General B1',
        cefr: 'B1',
        collocations: 'participate in activities',
        note: 'Thường đi với giới từ in'
      }
    ];
    return res.json({ items: fallbackItems, count: fallbackItems.length, fallback: true });
  }
});

/**
 * AI Diagnostic & Personalized Study Plan Endpoint
 */
app.post('/api/ai/diagnostic', async (req, res) => {
  const {
    totalScore = 0,
    maxScore = 50,
    cefrLevel = 'B1',
    grade = 'Pass',
    listeningScaled = 0,
    readingScaled = 0,
    writingScaled,
    partsBreakdown = [],
    writingSubmission,
  } = req.body || {};

  try {
    const partsSummary = (partsBreakdown || [])
      .map(
        (p: { name: string; correct: number; total: number; percentage: number }) =>
          `- ${p.name}: ${p.correct}/${p.total} (${Math.round(p.percentage)}%)`
      )
      .join('\n');

    let writingContext = 'Thí sinh không làm phần thi Viết (Writing).';
    if (writingSubmission && (writingSubmission.task1Text || writingSubmission.task2Text)) {
      writingContext = `
Bài Viết Task 1 (${writingSubmission.task1WordCount || 0} từ):
${writingSubmission.task1Text || '(Chưa nộp)'}

Bài Viết Task 2 (${writingSubmission.task2WordCount || 0} từ):
${writingSubmission.task2Text || '(Chưa nộp)'}
`;
    }

    const systemInstruction = `Bạn là một Chuyên gia Khảo thí và Giảng viên cấp cao về chứng chỉ tiếng Anh LanguageCert International ESOL (IESOL B1 Achiever) và LTE (LanguageCert Test of English).
Nhiệm vụ của bạn là phân tích kết quả bài thi của học viên, chỉ ra điểm mạnh cụ thể, các điểm yếu/bẫy đề thi cần khắc phục theo syllabus LanguageCert, chấm nhận xét bài viết (nếu có), đề xuất lộ trình ôn tập 4 tuần thiết thực và gửi lời động viên chân thành.
Sử dụng tiếng Việt chuẩn mực, ấm áp, mang tính sư phạm cao. Các thuật ngữ chuyên môn hoặc tên sách có thể kèm tiếng Anh.`;

    const prompt = `Phân tích kết quả thi LanguageCert B1 của học viên:
- Tổng điểm Scaled Score: ${totalScore}/${maxScore}
- Bậc CEFR quy đổi: ${cefrLevel}
- Xếp loại kết quả: ${grade}
- Điểm Nghe (Listening Scaled): ${listeningScaled}/50
- Điểm Đọc (Reading Scaled): ${readingScaled}/50
- Điểm Viết (Writing Scaled): ${writingScaled !== undefined ? `${writingScaled}/50` : 'Không thi'}

Chi tiết từng phần thi:
${partsSummary}

Dữ liệu bài thi Viết:
${writingContext}

Hãy trả về kết quả định dạng JSON với cấu trúc:
1. strengths: Mảng các điểm mạnh cụ thể dựa trên các phần làm tốt nhất.
2. weaknesses: Mảng các điểm yếu và bẫy đề thi cần tránh (dựa trên các phần sai nhiều).
3. writingFeedback: Nhận xét chi tiết bài viết (nếu có nộp) theo 4 tiêu chí LanguageCert: Hoàn thành nhiệm vụ (Task Fulfillment), Mạch lạc liên kết (Cohesion), Vốn từ (Lexis), Ngữ pháp (Grammar). Nếu không nộp bài viết thì tóm tắt yêu cầu chuẩn B1.
4. studyPlan: Lộ trình 4 tuần cải thiện điểm số (Tuần 1 đến 4), mỗi tuần nêu rõ kỹ năng trọng tâm, bài tập khuyến nghị và điểm ngữ pháp cần nắm.
5. recommendedResources: Danh mục sách và tài nguyên học tập chuẩn (như English Vocabulary in Use, Business Grammar Builder, BBC 6 Minute English).
6. encouragement: Lời động viên truyền cảm hứng và mẹo kiểm soát tâm lý, phân bổ thời gian trong phòng thi.`;

    const response = await generateGeminiSafe({
      preferredModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
      contents: prompt,
      timeoutMs: 20000,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Danh sách 3-4 điểm mạnh nổi bật',
            },
            weaknesses: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Danh sách 3-4 điểm yếu cần khắc phục',
            },
            writingFeedback: {
              type: Type.OBJECT,
              properties: {
                taskAchievement: { type: Type.STRING },
                coherence: { type: Type.STRING },
                lexicalResource: { type: Type.STRING },
                grammarAccuracy: { type: Type.STRING },
                overallAdvice: { type: Type.STRING },
              },
              required: ['taskAchievement', 'coherence', 'lexicalResource', 'grammarAccuracy', 'overallAdvice'],
            },
            studyPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  week: { type: Type.NUMBER },
                  title: { type: Type.STRING },
                  focusSkills: { type: Type.STRING },
                  tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                  grammarPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['week', 'title', 'focusSkills', 'tasks', 'grammarPoints'],
              },
              description: 'Kế hoạch học tập 4 tuần',
            },
            recommendedResources: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            encouragement: {
              type: Type.STRING,
              description: 'Lời động viên tâm lý và chiến thuật làm bài',
            },
          },
          required: ['strengths', 'weaknesses', 'writingFeedback', 'studyPlan', 'recommendedResources', 'encouragement'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text || '{}');
    return res.json(parsedJson);
  } catch (error: unknown) {
    console.warn('Gemini diagnostic call encountered issue, deploying pedagogical fallback:', error);
    // Intelligent fallback guaranteed to succeed with deep pedagogical accuracy
    const fallback = generateSmartDiagnosticReport({
      totalScore,
      maxScore,
      cefrLevel,
      grade,
      listeningScaled,
      readingScaled,
      writingScaled,
      partsBreakdown,
      writingSubmission,
    });
    return res.json(fallback);
  }
});

/**
 * Strict AI Writing Examiner Endpoint (/api/ai/grade-writing)
 * Evaluates Writing Part 1 & Part 2 strictly against the official LanguageCert B1 4-criteria rubric
 * (Task Fulfilment, Accuracy & Range of Grammar, Accuracy & Range of Vocabulary, Organization & Cohesion; 0-3 each = 12 marks/task)
 */
app.post('/api/ai/grade-writing', async (req, res) => {
  const { writingSubmission, writingTasks = [] } = req.body || {};
  const task1Text = String(writingSubmission?.task1Text || '').trim();
  const task2Text = String(writingSubmission?.task2Text || '').trim();
  const task1Words = Number(writingSubmission?.task1WordCount || 0);
  const task2Words = Number(writingSubmission?.task2WordCount || 0);

  const task1Prompt = writingTasks[0] || {
    title: 'Writing Part 1',
    instruction: 'Respond to the notice/email covering all 3 bullet points (70-100 words).',
    bulletPoints: [],
    minWords: 70,
    maxWords: 100,
  };
  const task2Prompt = writingTasks[1] || {
    title: 'Writing Part 2',
    instruction: 'Write an informal letter/email covering the required functions (100-120 words).',
    bulletPoints: [],
    minWords: 100,
    maxWords: 120,
  };

  // If both tasks are completely empty, return 0 immediately
  if (!task1Text && !task2Text) {
    return res.json({
      task1Score: 0,
      task2Score: 0,
      task1Criteria: {
        taskFulfilment: 0,
        grammar: 0,
        vocabulary: 0,
        organization: 0,
        total: 0,
        feedbackVi: 'Thí sinh bỏ trống hoàn toàn Writing Part 1 (0/12 điểm).',
        strengthsVi: [],
        improvementsVi: ['Cần viết tối thiểu 70–100 từ và trả lời đủ 3 ý yêu cầu của đề bài.'],
        correctedSample: task1Prompt.sampleAnswer || '',
      },
      task2Criteria: {
        taskFulfilment: 0,
        grammar: 0,
        vocabulary: 0,
        organization: 0,
        total: 0,
        feedbackVi: 'Thí sinh bỏ trống hoàn toàn Writing Part 2 (0/12 điểm).',
        strengthsVi: [],
        improvementsVi: ['Cần viết tối thiểu 100–120 từ và hoàn thành đủ 2 mục đích giao tiếp của đề bài.'],
        correctedSample: task2Prompt.sampleAnswer || '',
      },
      overallBandComment: 'Thí sinh chưa nộp bài viết cho cả 2 phần Writing Part 1 và Part 2 (0/24 điểm).',
      isAiGraded: true,
    });
  }

  try {
    const systemInstruction = `Bạn là Giám khảo Chấm thi Chính thức (Chief Writing Examiner) của Hội đồng Khảo thí Quốc tế PeopleCert / LanguageCert International ESOL (IESOL B1 Achiever).
Nhiệm vụ của bạn là chấm điểm NGHIÊM NGẶT, KHÁCH QUAN và CHÍNH XÁC tuyệt đối cho bài thi Writing Part 1 và Writing Part 2 của thí sinh theo đúng Barem 4 Tiêu chí chính thức của LanguageCert:
1. Task Fulfilment (Hoàn thành nhiệm vụ: 0 - 3 điểm):
   - 3 điểm: Trả lời đầy đủ, rõ ràng tất cả các ý bắt buộc (bullet points), đúng văn phong (trang trọng/thân mật), số từ nằm trong khoảng chuẩn (Part 1: 70-100 từ; Part 2: 100-120 từ).
   - 2 điểm: Trả lời được hầu hết các ý nhưng còn sơ sài 1 ý, hoặc số từ thiếu/vượt nhẹ.
   - 1 điểm: Bỏ sót nhiều ý quan trọng, lạc đề một phần, hoặc bài viết quá ngắn (< 45 từ cho Part 1 hoặc < 65 từ cho Part 2).
   - 0 điểm: Bỏ trống, viết dưới 15 từ, chép lại đề bài, viết tiếng Việt hoặc hoàn toàn lạc đề.
2. Accuracy & Range of Grammar (Ngữ pháp: 0 - 3 điểm):
   - Đánh giá độ đa dạng cấu trúc câu chuẩn B1 (câu ghép, mệnh đề quan hệ, câu điều kiện, các thì hoàn thành/tương lai) và mức độ chính xác.
3. Accuracy & Range of Vocabulary (Từ vựng: 0 - 3 điểm):
   - Đánh giá vốn từ vựng theo chủ đề, collocations và chính tả. Trừ điểm nghiêm khắc nếu lặp từ hoặc sai chính tả nhiều.
4. Organization & Cohesion (Bố cục & Liên kết: 0 - 3 điểm):
   - Đánh giá việc chia đoạn văn rõ ràng (Mở bài - Thân bài - Kết thư), lời chào đầu thư/cuối thư và sử dụng từ nối (however, therefore, furthermore, in addition, regarding...).

QUY TẮC NGHIÊM NGẶT:
- Nếu phần nào thí sinh bỏ trống (0 từ), BẮT BUỘC chấm 0 điểm cho cả 4 tiêu chí của phần đó (total = 0).
- Tuyệt đối KHÔNG chấm điểm nương tay theo kiểu đếm số từ. Nếu viết đủ số từ nhưng sai ngữ pháp nặng, lạc đề hoặc viết vô nghĩa thì vẫn bị điểm thấp (1-4/12).
- Tổng điểm mỗi Task (total) PHẢI bằng tổng của (taskFulfilment + grammar + vocabulary + organization) trên thang 0..12.`;

    const prompt = `HÃY CHẤM BÀI THI WRITING LANGUAGECERT B1 SAU ĐÂY THEO BAREM NGHIÊM NGẶT:

=== WRITING PART 1 (Yêu cầu ${task1Prompt.minWords || 70}–${task1Prompt.maxWords || 100} từ, tối đa 12 điểm) ===
- Đề bài: ${task1Prompt.instruction || ''}
- Ngữ cảnh: ${task1Prompt.stimulusText || ''}
- Các ý bắt buộc: ${(task1Prompt.bulletPoints || []).join(' | ')}
- Bài làm của thí sinh (${task1Words} từ):
"""
${task1Text || '(THÍ SINH BỎ TRỐNG PHẦN NÀY)'}
"""

=== WRITING PART 2 (Yêu cầu ${task2Prompt.minWords || 100}–${task2Prompt.maxWords || 120} từ, tối đa 12 điểm) ===
- Đề bài: ${task2Prompt.instruction || ''}
- Ngữ cảnh: ${task2Prompt.stimulusText || ''}
- Các ý bắt buộc: ${(task2Prompt.bulletPoints || []).join(' | ')}
- Bài làm của thí sinh (${task2Words} từ):
"""
${task2Text || '(THÍ SINH BỎ TRỐNG PHẦN NÀY)'}
"""

Hãy trả về JSON theo đúng cấu trúc yêu cầu.`;

    const criterionSchema = {
      type: Type.OBJECT,
      properties: {
        taskFulfilment: { type: Type.NUMBER, description: 'Điểm tiêu chí Task Fulfilment (0-3)' },
        grammar: { type: Type.NUMBER, description: 'Điểm tiêu chí Grammar (0-3)' },
        vocabulary: { type: Type.NUMBER, description: 'Điểm tiêu chí Vocabulary (0-3)' },
        organization: { type: Type.NUMBER, description: 'Điểm tiêu chí Organization & Cohesion (0-3)' },
        total: { type: Type.NUMBER, description: 'Tổng điểm Task (0-12)' },
        feedbackVi: { type: Type.STRING, description: 'Nhận xét chi tiết từng tiêu chí bằng tiếng Việt' },
        strengthsVi: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Các điểm tốt trong bài viết của học sinh',
        },
        improvementsVi: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Các lỗi sai cụ thể (ngữ pháp, từ vựng, ý thiếu) kèm cách sửa chi tiết',
        },
        correctedSample: {
          type: Type.STRING,
          description: 'Bài viết đã được AI nâng cấp và sửa lỗi hoàn chỉnh lên chuẩn B1 High Pass',
        },
      },
      required: [
        'taskFulfilment',
        'grammar',
        'vocabulary',
        'organization',
        'total',
        'feedbackVi',
        'strengthsVi',
        'improvementsVi',
        'correctedSample',
      ],
    };

    const response = await generateGeminiSafe({
      preferredModels: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'],
      contents: prompt,
      timeoutMs: 25000,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            task1Criteria: criterionSchema,
            task2Criteria: criterionSchema,
            overallBandComment: {
              type: Type.STRING,
              description: 'Tổng kết đánh giá năng lực Viết chung và lời khuyên chiến thuật phòng thi',
            },
          },
          required: ['task1Criteria', 'task2Criteria', 'overallBandComment'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');

    const normalizeCriteria = (c: any, isEmpty: boolean) => {
      if (isEmpty || !c) {
        return {
          taskFulfilment: 0,
          grammar: 0,
          vocabulary: 0,
          organization: 0,
          total: 0,
          feedbackVi: 'Thí sinh bỏ trống phần viết này (0/12 điểm).',
          strengthsVi: [],
          improvementsVi: ['Cần hoàn thành bài viết đầy đủ theo yêu cầu đề bài.'],
          correctedSample: '',
        };
      }
      const tf = Math.max(0, Math.min(3, Math.round(Number(c.taskFulfilment) || 0)));
      const gr = Math.max(0, Math.min(3, Math.round(Number(c.grammar) || 0)));
      const vc = Math.max(0, Math.min(3, Math.round(Number(c.vocabulary) || 0)));
      const og = Math.max(0, Math.min(3, Math.round(Number(c.organization) || 0)));
      const tot = tf + gr + vc + og;
      return {
        taskFulfilment: tf,
        grammar: gr,
        vocabulary: vc,
        organization: og,
        total: tot,
        feedbackVi: String(c.feedbackVi || ''),
        strengthsVi: Array.isArray(c.strengthsVi) ? c.strengthsVi : [],
        improvementsVi: Array.isArray(c.improvementsVi) ? c.improvementsVi : [],
        correctedSample: String(c.correctedSample || ''),
      };
    };

    const c1 = normalizeCriteria(parsed.task1Criteria, !task1Text);
    const c2 = normalizeCriteria(parsed.task2Criteria, !task2Text);

    return res.json({
      task1Score: c1.total,
      task2Score: c2.total,
      task1Criteria: c1,
      task2Criteria: c2,
      overallBandComment:
        parsed.overallBandComment ||
        `Tổng điểm Writing đạt ${c1.total + c2.total}/24 điểm raw (${Math.round(((c1.total + c2.total) / 24) * 50)}/50 điểm quy đổi).`,
      isAiGraded: true,
    });
  } catch (err) {
    console.warn('Error in /api/ai/grade-writing, returning strict rubric evaluation:', err);
    return res.status(500).json({ error: 'Không thể kết nối AI chấm bài lúc này.' });
  }
});

// Setup Vite middlewares for dev or static serving for prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LanguageCert B1 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

