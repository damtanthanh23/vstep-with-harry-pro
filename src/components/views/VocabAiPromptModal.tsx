import React, { useState, useRef, useMemo } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  FileCode2,
  Download,
  AlertCircle,
  Upload,
  BookOpen,
  FolderPlus,
  Layers,
  FileText,
  Tag,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  UserVocabDeck,
  ExtendedVocabItem,
  VocabDeckCategoryType,
} from '../../types/vocab';
import { TestMetadata } from '../../types/exam';

export const B1_OFFICIAL_15_TOPICS = [
  '01 Personal Identification',
  '02 House, Home And Local Area',
  '03 Daily Life',
  '04 Free Time And Entertainment',
  '05 Travel And Transport',
  '06 Relations With Other People',
  '07 Health And Body Care',
  '08 Shopping',
  '09 Food And Drink',
  '10 Services',
  '11 Places',
  '12 Language',
  '13 Weather',
  '14 Measures And Shapes',
  '15 Education',
];

export interface BatchImportInstruction {
  mode: 'auto_15_topics' | 'auto_deck' | '15_topics' | 'exam_test' | 'custom_topic' | 'existing_deck' | 'untagged';
  targetOfficialTopic?: string;
  targetTestId?: string;
  targetTestTitle?: string;
  customDeckName?: string;
  customTopicTag?: string;
  targetExistingDeckId?: string;
  items: ExtendedVocabItem[];
  rawDecks?: Array<{
    name: string;
    description?: string;
    categoryType?: VocabDeckCategoryType;
    officialTopicCode?: string;
    linkedTestId?: string;
    linkedTestTitle?: string;
    customTopicTag?: string;
    items: ExtendedVocabItem[];
  }>;
}

interface VocabAiPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  decks?: UserVocabDeck[];
  tests?: TestMetadata[];
  activeDeckId?: string;
  onAddWordsToDeck: (deckId: string, words: ExtendedVocabItem[]) => void;
  onCreateDeckWithWords?: (
    deckName: string,
    description: string,
    words: ExtendedVocabItem[],
    meta?: {
      categoryType?: VocabDeckCategoryType;
      officialTopicCode?: string;
      linkedTestId?: string;
      linkedTestTitle?: string;
      customTopicTag?: string;
    }
  ) => void;
  onBatchImportVocab?: (payload: BatchImportInstruction) => void;
  currentSelectedTopic?: string;
}

export const VocabAiPromptModal: React.FC<VocabAiPromptModalProps> = ({
  isOpen,
  onClose,
  decks = [],
  tests = [],
  activeDeckId,
  onAddWordsToDeck,
  onCreateDeckWithWords,
  onBatchImportVocab,
  currentSelectedTopic = '01 Personal Identification',
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'prompt'>('import');
  const [promptSubMode, setPromptSubMode] = useState<'exam_pdf' | 'excel_raw'>('exam_pdf');
  const [copied, setCopied] = useState(false);

  // Target Relationship / Routing Mode
  const [routingMode, setRoutingMode] = useState<
    'auto_15_topics' | '15_topics' | 'exam_test' | 'custom_topic' | 'existing_deck' | 'untagged'
  >('auto_15_topics');

  const [selectedTopic, setSelectedTopic] = useState<string>(
    B1_OFFICIAL_15_TOPICS.includes(currentSelectedTopic)
      ? currentSelectedTopic
      : B1_OFFICIAL_15_TOPICS[0]
  );

  const [selectedTestId, setSelectedTestId] = useState<string>(
    tests[0]?.id || 'test-1'
  );

  const [selectedExistingDeckId, setSelectedExistingDeckId] = useState<string>(
    activeDeckId || (decks.length > 0 ? decks[0].id : '')
  );

  const [customDeckName, setCustomDeckName] = useState<string>('Từ Vựng B1 Tinh Tuyển');
  const [customTopicTag, setCustomTopicTag] = useState<string>('Chủ đề mở rộng');

  // Prompt customization state
  const [promptExamName, setPromptExamName] = useState<string>(
    tests[0]?.title || 'LanguageCert B1 Practice Test'
  );
  const [promptWordCount, setPromptWordCount] = useState<number>(35);

  // JSON Input & Preview state
  const [jsonInput, setJsonInput] = useState('');
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [parsedPreview, setParsedPreview] = useState<ExtendedVocabItem[] | null>(null);
  const [detectedJsonMeta, setDetectedJsonMeta] = useState<{
    title?: string;
    testTitle?: string;
    categoryType?: VocabDeckCategoryType;
    topicSummary: Record<string, number>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build AI Prompt for PDF Exam + Script Extraction
  const examPdfExtractionPrompt = useMemo(() => {
    return `Bạn là Chuyên gia Khảo thí Quốc tế PeopleCert & Giảng viên Từ vựng CEFR B1 (LanguageCert Achiever).
Tôi đính kèm file PDF ĐỀ THI (Reading Parts 1-4) và/hoặc LỜI THOẠI AUDIO SCRIPT (Listening Parts 1-4) của bộ đề: "${promptExamName}".

NHIỆM VỤ CỦA BẠN:
Hãy đọc kỹ toàn bộ bài đọc Reading và lời thoại Listening Script trong PDF, sau đó trích xuất danh sách ${promptWordCount} TỪ VỰNG & CỤM TỪ (COLLOCATIONS / PARAPHRASES) THIẾT YẾU NHẤT quyết định đáp án đúng của đề thi này.

YÊU CẦU BẮT BUỘC CHO TỪNG MỤC TỪ VỰNG:
1. "word": Từ vựng hoặc cụm động từ/thành ngữ cốt lõi (nguyên mẫu, viết thường).
2. "phonetic": Phiên âm quốc tế IPA chuẩn Oxford (ví dụ: "/əˈkɒm.ə.deɪt/").
3. "partOfSpeech": Chỉ dùng 1 trong 5 nhãn: "n", "v", "adj", "adv", "phr".
4. "meaningVi": Nghĩa tiếng Việt sát nhất với ngữ cảnh trong bài thi.
5. "collocations": Các cụm từ đi kèm hoặc từ đồng nghĩa (paraphrase) xuất hiện giữa câu hỏi và bài đọc/script (ví dụ: "book in advance = reserve early").
6. "exampleEn": Trích dẫn NGUYÊN VĂN (hoặc biên tập ngắn gọn) câu chứa từ đó trong bài Reading hoặc Listening Script.
7. "exampleVi": Bản dịch tiếng Việt tự nhiên của câu ví dụ trên.
8. "note": Ghi rõ vị trí xuất hiện trong đề để học viên đối chiếu (ví dụ: "Listening Part 2 - Câu 9" hoặc "Reading Part 3 - Text B").
9. "topic": Tự động phân loại từ đó vào ĐÚNG 1 trong 15 Chủ đề chuẩn B1 dưới đây (nếu không thuộc chủ đề nào thì ghi "General B1"):
   - "01 Personal Identification"
   - "02 House, Home And Local Area"
   - "03 Daily Life"
   - "04 Free Time And Entertainment"
   - "05 Travel And Transport"
   - "06 Relations With Other People"
   - "07 Health And Body Care"
   - "08 Shopping"
   - "09 Food And Drink"
   - "10 Services"
   - "11 Places"
   - "12 Language"
   - "13 Weather"
   - "14 Measures And Shapes"
   - "15 Education"

ĐỊNH DẠNG JSON ĐẦU RA BẮT BUỘC (Trả về DUY NHẤT 1 khối code JSON hợp lệ để tôi nạp thẳng vào hệ thống):
{
  "title": "Từ vựng trọng tâm - ${promptExamName}",
  "testTitle": "${promptExamName}",
  "categoryType": "exam_test",
  "vocabulary": [
    {
      "word": "postpone",
      "phonetic": "/pəʊstˈpəʊn/",
      "partOfSpeech": "v",
      "meaningVi": "trì hoãn, dời lịch sang thời điểm khác",
      "collocations": "postpone a meeting = put off / delay",
      "exampleEn": "The outdoor concert had to be postponed until Sunday due to heavy rain.",
      "exampleVi": "Buổi hòa nhạc ngoài trời đã phải hoãn lại đến Chủ nhật do mưa lớn.",
      "note": "Listening Part 2 - Câu 10 (Paraphrase của 'delayed')",
      "topic": "04 Free Time And Entertainment",
      "cefr": "B1"
    }
  ]
}`;
  }, [promptExamName, promptWordCount]);

  // Build AI Prompt for Excel / Raw list
  const excelRawPrompt = useMemo(() => {
    return `Bạn là Trợ lý AI Khảo thí Tiếng Anh chuyên xử lý và số hóa tài liệu từ vựng theo Khung Chuẩn CEFR B1 (LanguageCert Achiever).

HÃY BÓC TÁCH DỮ LIỆU TỪ VỰNG TỪ BẢNG EXCEL / DANH SÁCH THÔ ĐÍNH KÈM SANG ĐỊNH DẠNG JSON CHUẨN:
1. Nếu từ tiếng Anh có ký hiệu "#" ở cuối (ví dụ: name#, address#), hãy tự động bỏ "#" để lấy từ gốc sạch.
2. Tự động xác định từ loại ("n", "v", "adj", "adv", "phr"), phiên âm IPA, nghĩa tiếng Việt, cụm từ ghép ("collocations"), câu ví dụ tiếng Anh ("exampleEn") và dịch câu ví dụ sang tiếng Việt ("exampleVi").
3. Tự động gán trường "topic" vào đúng 1 trong 15 Chủ đề chuẩn B1:
   ${B1_OFFICIAL_15_TOPICS.map((t) => `"${t}"`).join(', ')}.

Trả về DUY NHẤT một JSON hợp lệ theo mẫu:
{
  "title": "Bộ từ vựng B1 - ${selectedTopic}",
  "categoryType": "15_topics",
  "vocabulary": [
    {
      "word": "accommodation",
      "phonetic": "/əˌkɒm.əˈdeɪ.ʃən/",
      "partOfSpeech": "n",
      "meaningVi": "chỗ ở, nơi lưu trú",
      "collocations": "hotel accommodation, rent accommodation",
      "exampleEn": "Hotel accommodation is included in the price of your holiday package.",
      "exampleVi": "Chỗ ở khách sạn đã được bao gồm trong giá gói kỳ nghỉ của bạn.",
      "note": "Reading Part 1 & Part 3",
      "topic": "${selectedTopic}",
      "cefr": "B1"
    }
  ]
}`;
  }, [selectedTopic]);

  if (!isOpen) return null;

  const activePromptText =
    promptSubMode === 'exam_pdf' ? examPdfExtractionPrompt : excelRawPrompt;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(activePromptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download Sample JSON for Exam + Script Extraction
  const handleDownloadExamVocabSampleJson = () => {
    const sample = {
      _AI_EXTRACTION_GUIDE:
        'Đính kèm file JSON mẫu này cùng PDF Đề thi và PDF Audio Script cho ChatGPT/Claude/Gemini để AI trích xuất từ vựng chuẩn cấu trúc.',
      title: `Từ vựng thiết yếu - ${promptExamName}`,
      testTitle: promptExamName,
      categoryType: 'exam_test',
      vocabulary: [
        {
          word: 'accommodate',
          phonetic: '/əˈkɒm.ə.deɪt/',
          partOfSpeech: 'v',
          meaningVi: 'cung cấp chỗ ở, đáp ứng sức chứa',
          collocations: 'accommodate up to 50 guests, accommodate needs',
          exampleEn: 'Local families will be able to offer accommodation to students while they are studying here.',
          exampleVi: 'Các gia đình địa phương sẽ có thể cung cấp chỗ ở cho học sinh trong thời gian các em theo học tại đây.',
          note: 'Reading Part 3 - Text A',
          topic: '02 House, Home And Local Area',
          cefr: 'B1',
        },
        {
          word: 'intensive',
          phonetic: '/ɪnˈten.sɪv/',
          partOfSpeech: 'adj',
          meaningVi: 'chuyên sâu, cấp tốc, tập trung cao độ',
          collocations: 'intensive course, intensive training',
          exampleEn: 'The company paid for me to do an intensive Spanish course for a month.',
          exampleVi: 'Công ty đã tài trợ cho tôi tham gia một khóa học tiếng Tây Ban Nha cấp tốc trong một tháng.',
          note: 'Reading Part 3 - Text C',
          topic: '15 Education',
          cefr: 'B1',
        },
        {
          word: 'appointment',
          phonetic: '/əˈpɔɪnt.mənt/',
          partOfSpeech: 'n',
          meaningVi: 'cuộc hẹn, lịch hẹn (bác sĩ, công việc)',
          collocations: 'make an appointment, cancel an appointment',
          exampleEn: "I'd like to change my dental appointment from Tuesday morning to Thursday afternoon.",
          exampleVi: 'Tôi muốn đổi lịch khám nha khoa từ sáng thứ Ba sang chiều thứ Năm.',
          note: 'Listening Part 1 - Câu 3',
          topic: '07 Health And Body Care',
          cefr: 'B1',
        },
        {
          word: 'departure',
          phonetic: '/dɪˈpɑː.tʃər/',
          partOfSpeech: 'n',
          meaningVi: 'sự khởi hành, giờ xuất phát',
          collocations: 'departure lounge, departure time',
          exampleEn: 'Passengers are requested to check the departure board for gate updates.',
          exampleVi: 'Hành khách được yêu cầu kiểm tra bảng thông tin khởi hành để cập nhật cửa ra máy bay.',
          note: 'Reading Part 1 - Câu 31',
          topic: '05 Travel And Transport',
          cefr: 'B1',
        },
      ],
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LanguageCert_B1_Exam_Script_Vocab_Sample.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to normalize an array of raw word items
  const normalizeWordItems = (
    rawList: any[],
    fallbackTopic: string,
    fallbackTestTitle?: string
  ): ExtendedVocabItem[] => {
    const normalized: ExtendedVocabItem[] = [];
    rawList.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      const rawWord = String(item.word || item.headword || item.term || '')
        .replace(/[#]/g, '')
        .trim();
      if (!rawWord) return;

      const partOfSpeechRaw = String(item.partOfSpeech || item.pos || 'n')
        .replace(/\./g, '')
        .trim()
        .toLowerCase();
      const pos = ['n', 'v', 'adj', 'adv', 'phr'].includes(partOfSpeechRaw)
        ? (partOfSpeechRaw as any)
        : 'n';

      // Match official 15 B1 topic if prefixes like "01", "05", or partial English title match
      let resolvedTopic = String(item.topic || fallbackTopic || 'General B1').trim();
      const matchedOfficial = B1_OFFICIAL_15_TOPICS.find(
        (t) =>
          t.toLowerCase() === resolvedTopic.toLowerCase() ||
          (resolvedTopic.length >= 2 &&
            t.slice(0, 2) === resolvedTopic.slice(0, 2) &&
            /^\d{2}/.test(resolvedTopic)) ||
          t.slice(3).toLowerCase() === resolvedTopic.toLowerCase()
      );
      if (matchedOfficial) {
        resolvedTopic = matchedOfficial;
      }

      normalized.push({
        id:
          item.id ||
          `vocab_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        word: rawWord,
        phonetic: String(item.phonetic || item.ipa || `/${rawWord}/`).trim(),
        partOfSpeech: pos,
        meaningVi: String(
          item.meaningVi || item.meaning || item.definitionVi || 'Đang cập nhật'
        ).trim(),
        exampleEn:
          String(item.exampleEn || item.example || '')
            .replace(/;$/, '')
            .trim() || `Example sentence with ${rawWord}.`,
        exampleVi:
          String(item.exampleVi || item.exampleTranslation || item.translation || '').trim() ||
          `Câu ví dụ với từ ${rawWord}.`,
        topic: resolvedTopic,
        cefr: 'B1',
        collocations: Array.isArray(item.collocations)
          ? item.collocations.join(', ')
          : String(item.collocations || item.collocation || '').trim(),
        note: String(item.note || item.examPart || item.source || '').trim(),
        linkedTestTitle: item.testTitle || fallbackTestTitle || undefined,
        isMastered: Boolean(item.isMastered),
      });
    });
    return normalized;
  };

  // Parse single or combined JSON string
  const parseJsonData = (rawText: string) => {
    setErrorMsg(null);
    setParsedPreview(null);
    setDetectedJsonMeta(null);

    if (!rawText.trim()) {
      setErrorMsg('Vui lòng chọn file JSON hoặc dán mã JSON từ AI vào ô bên dưới.');
      return;
    }

    try {
      const clean = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      const parsed = JSON.parse(clean);
      let allNormalized: ExtendedVocabItem[] = [];
      let detectedTitle: string | undefined;
      let detectedTestTitle: string | undefined;
      let detectedCategory: VocabDeckCategoryType | undefined;

      if (Array.isArray(parsed)) {
        allNormalized = normalizeWordItems(parsed, selectedTopic);
      } else if (parsed && typeof parsed === 'object') {
        detectedTitle = parsed.title || parsed.name || parsed.deckName;
        detectedTestTitle = parsed.testTitle || parsed.examTitle;
        detectedCategory = parsed.categoryType;

        if (Array.isArray(parsed.decks)) {
          parsed.decks.forEach((d: any) => {
            const list = d.vocabulary || d.items || d.words || [];
            if (Array.isArray(list)) {
              const items = normalizeWordItems(
                list,
                d.topic || d.officialTopicCode || d.name || selectedTopic,
                d.testTitle || detectedTestTitle
              );
              allNormalized.push(...items);
            }
          });
        } else {
          const rawList =
            parsed.vocabulary || parsed.items || parsed.words || parsed.data || [];
          if (!Array.isArray(rawList)) {
            throw new Error(
              'Không tìm thấy mảng từ vựng. JSON cần là mảng [ {...} ] hoặc chứa trường "vocabulary" / "items" / "decks".'
            );
          }
          allNormalized = normalizeWordItems(
            rawList,
            parsed.topic || selectedTopic,
            detectedTestTitle
          );
        }

        if (detectedTitle) {
          setCustomDeckName(detectedTitle);
        }
        if (detectedTestTitle && tests.length > 0) {
          const matchedTest = tests.find(
            (t) =>
              t.title.toLowerCase().includes(detectedTestTitle!.toLowerCase()) ||
              detectedTestTitle!.toLowerCase().includes(t.title.toLowerCase())
          );
          if (matchedTest) {
            setSelectedTestId(matchedTest.id);
          }
        }
      }

      if (allNormalized.length === 0) {
        throw new Error('Không tìm thấy mục từ vựng hợp lệ nào có trường "word" trong JSON.');
      }

      // Compute topic breakdown summary
      const topicSummary: Record<string, number> = {};
      allNormalized.forEach((w) => {
        const key = w.topic || 'Chưa phân loại';
        topicSummary[key] = (topicSummary[key] || 0) + 1;
      });

      setDetectedJsonMeta({
        title: detectedTitle,
        testTitle: detectedTestTitle,
        categoryType: detectedCategory,
        topicSummary,
      });
      setParsedPreview(allNormalized);
    } catch (err: any) {
      setErrorMsg(
        err.message || 'Cú pháp JSON không hợp lệ. Vui lòng kiểm tra lại dấu ngoặc hoặc dấu phẩy.'
      );
    }
  };

  // Multi-file upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files: File[] = Array.from(fileList);
    setUploadedFileNames(files.map((f) => f.name));

    if (files.length === 1) {
      const text = await files[0].text();
      setJsonInput(text);
      parseJsonData(text);
      return;
    }

    // Multiple JSON files merged into a single batch
    try {
      const mergedWords: any[] = [];
      for (const f of files) {
        const text = await f.text();
        const clean = text
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) {
          mergedWords.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          const list = parsed.vocabulary || parsed.items || parsed.words || [];
          if (Array.isArray(list)) mergedWords.push(...list);
        }
      }
      const combinedJson = JSON.stringify(
        {
          title: `Bộ từ gộp (${files.length} file JSON)`,
          vocabulary: mergedWords,
        },
        null,
        2
      );
      setJsonInput(combinedJson);
      parseJsonData(combinedJson);
    } catch (err: any) {
      setErrorMsg(`Lỗi khi gộp nhiều file JSON: ${err.message || 'Cú pháp không hợp lệ'}`);
    }
  };

  // Execute Final Import
  const handleConfirmImport = () => {
    if (!parsedPreview || parsedPreview.length === 0) return;

    const targetTestObj = tests.find((t) => t.id === selectedTestId);

    if (onBatchImportVocab) {
      onBatchImportVocab({
        mode: routingMode,
        targetOfficialTopic: selectedTopic,
        targetTestId: selectedTestId,
        targetTestTitle: targetTestObj?.title || detectedJsonMeta?.testTitle || 'Đề thi B1',
        customDeckName:
          customDeckName.trim() ||
          detectedJsonMeta?.title ||
          `Bộ từ mới (${parsedPreview.length} từ)`,
        customTopicTag: customTopicTag.trim() || 'Chủ đề tự tạo',
        targetExistingDeckId: selectedExistingDeckId,
        items: parsedPreview,
      });
      onClose();
      return;
    }

    // Fallback if legacy callbacks are used
    if (routingMode === 'existing_deck' && selectedExistingDeckId) {
      onAddWordsToDeck(selectedExistingDeckId, parsedPreview);
    } else if (onCreateDeckWithWords) {
      onCreateDeckWithWords(
        customDeckName.trim() || `Bộ từ mới (${parsedPreview.length} từ)`,
        `Nhập từ file JSON (${parsedPreview.length} từ vựng chuẩn B1)`,
        parsedPreview
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-slate-950 shadow-sm">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                Nhập JSON Từ Vựng Hàng Loạt & AI Bóc Tách Đề Thi / Script PDF
              </h3>
              <p className="text-xs text-slate-300">
                Hỗ trợ tự động phân vào 15 Chủ đề B1, gắn vào Đề thi trong Web, tạo Chủ đề mới hoặc Bộ từ độc lập
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2 Mode Tabs */}
        <div className="grid grid-cols-2 gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 py-2.5">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-[#58CC02] text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>1. Nhập File JSON & Gán Nhãn ({parsedPreview ? `${parsedPreview.length} từ` : 'Tải file / Dán mã'})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-black transition-all cursor-pointer ${
              activeTab === 'prompt'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>2. Lấy Prompt AI & JSON Mẫu (Bóc từ Đề thi & Script PDF)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'prompt' ? (
            <div className="space-y-5">
              {/* Sub-mode selector: Exam + Script PDF vs Excel */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-100 dark:bg-slate-800/70 p-3 border border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPromptSubMode('exam_pdf')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      promptSubMode === 'exam_pdf'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
                    }`}
                  >
                    📄 Prompt AI: Lấy từ vựng từ Đề thi & Audio Script PDF (Khuyên dùng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptSubMode('excel_raw')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      promptSubMode === 'excel_raw'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
                    }`}
                  >
                    📊 Prompt AI: Chuyển đổi từ Bảng Excel / Danh sách thô
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadExamVocabSampleJson}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-black shadow-xs transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải File JSON Mẫu Chuẩn</span>
                </button>
              </div>

              {/* Prompt Customization Parameters */}
              {promptSubMode === 'exam_pdf' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1">
                      Tên Đề thi bạn muốn AI trích xuất từ vựng:
                    </label>
                    <input
                      type="text"
                      value={promptExamName}
                      onChange={(e) => setPromptExamName(e.target.value)}
                      placeholder="VD: Succeed in LanguageCert B1 - Test 2"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1">
                      Số lượng từ vựng cần lấy:
                    </label>
                    <select
                      value={promptWordCount}
                      onChange={(e) => setPromptWordCount(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value={20}>20 từ trọng tâm nhất</option>
                      <option value={35}>35 từ (Chuẩn 1 đề thi đầy đủ)</option>
                      <option value={50}>50 từ (Chi tiết cả Reading & Script)</option>
                      <option value={80}>80 từ (Toàn diện mọi Part)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    Chọn Chủ đề B1 mặc định cho danh sách Excel:
                  </label>
                  <select
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    className="w-full sm:w-96 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    {B1_OFFICIAL_15_TOPICS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step-by-step guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 bg-white dark:bg-slate-900">
                  <span className="font-black text-amber-600 dark:text-amber-400">BƯỚC 1</span>
                  <p className="mt-1 font-bold text-slate-800 dark:text-slate-100">
                    Sao chép Prompt AI bên dưới
                  </p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    Mở ChatGPT, Claude hoặc Gemini, đính kèm file PDF Đề thi + Audio Script của bạn.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 bg-white dark:bg-slate-900">
                  <span className="font-black text-emerald-600 dark:text-emerald-400">BƯỚC 2</span>
                  <p className="mt-1 font-bold text-slate-800 dark:text-slate-100">
                    AI xuất ra khối mã JSON chuẩn
                  </p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    AI sẽ tự lọc từ vựng chứa đáp án, phiên âm, câu ví dụ trong đề và gán sẵn chủ đề B1.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 bg-white dark:bg-slate-900">
                  <span className="font-black text-blue-600 dark:text-blue-400">BƯỚC 3</span>
                  <p className="mt-1 font-bold text-slate-800 dark:text-slate-100">
                    Dán JSON vào Tab 1 & Chọn nơi gắn
                  </p>
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                    Gắn vào 15 Topics, gắn vào Đề thi trong web, tạo Chủ đề mới hoặc để Độc lập.
                  </p>
                </div>
              </div>

              {/* Prompt Box */}
              <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-950 p-4 text-slate-100 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-amber-400">
                    Nội dung Prompt gửi cho AI (ChatGPT / Claude / Gemini):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Đã sao chép Prompt!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Sao chép Prompt AI</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-200">
                  {activePromptText}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* STEP 1: UPLOAD FILE OR PASTE JSON */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left 5 cols: Upload & Paste Input */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      1. Tải file JSON hoặc Dán mã JSON từ AI
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Chọn file .JSON (Hỗ trợ nhiều file)</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {uploadedFileNames.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>Đã nạp: {uploadedFileNames.join(', ')}</span>
                    </div>
                  )}

                  <textarea
                    value={jsonInput}
                    onChange={(e) => {
                      setJsonInput(e.target.value);
                      parseJsonData(e.target.value);
                    }}
                    rows={9}
                    placeholder={`Dán trực tiếp khối JSON từ AI vào đây...\nVí dụ:\n{\n  "title": "Từ vựng Test 1",\n  "vocabulary": [\n    { "word": "postpone", "meaningVi": "hoãn lại", "topic": "04 Free Time And Entertainment" }\n  ]\n}`}
                    className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3.5 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#58CC02]"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => parseJsonData(jsonInput)}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-black hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Kiểm tra & Phân tích JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadExamVocabSampleJson}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Tải file JSON mẫu</span>
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </div>

                {/* Right 7 cols: Relationship & Tagging Selector */}
                <div className="lg:col-span-7 space-y-3">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    2. Chọn cách gắn kết & phân loại cho lô từ vựng này
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Option 1: Auto route into 15 Official Topics based on AI JSON tags */}
                    <button
                      type="button"
                      onClick={() => setRoutingMode('auto_15_topics')}
                      className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                        routingMode === 'auto_15_topics'
                          ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-[#58CC02]" />
                          <span>Tự động theo nhãn AI (15 Chủ đề)</span>
                        </span>
                        {routingMode === 'auto_15_topics' && (
                          <Check className="h-4 w-4 text-[#58CC02]" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Tự động chia từng từ vào đúng 15 Chủ đề B1 dựa theo trường "topic" AI đã gán trong JSON.
                      </p>
                    </button>

                    {/* Option 2: Attach to an Exam Test in Web */}
                    <button
                      type="button"
                      onClick={() => setRoutingMode('exam_test')}
                      className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                        routingMode === 'exam_test'
                          ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>Gắn vào Bộ đề thi trong Web</span>
                        </span>
                        {routingMode === 'exam_test' && (
                          <Check className="h-4 w-4 text-[#58CC02]" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Liên kết bộ từ này với một Đề thi cụ thể để học trước khi bấm làm bài thi đó.
                      </p>
                    </button>

                    {/* Option 3: Attach to a single chosen B1 Topic */}
                    <button
                      type="button"
                      onClick={() => setRoutingMode('15_topics')}
                      className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                        routingMode === '15_topics'
                          ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4 text-emerald-600" />
                          <span>Gộp vào 1 Chủ đề B1 cố định</span>
                        </span>
                        {routingMode === '15_topics' && (
                          <Check className="h-4 w-4 text-[#58CC02]" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Đưa toàn bộ từ vựng vừa nạp vào 1 chủ đề bạn chọn trong 15 chủ đề chuẩn B1.
                      </p>
                    </button>

                    {/* Option 4: Create a New Custom Topic */}
                    <button
                      type="button"
                      onClick={() => setRoutingMode('custom_topic')}
                      className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                        routingMode === 'custom_topic'
                          ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FolderPlus className="h-4 w-4 text-amber-500" />
                          <span>Tạo Chủ đề mới (Người dùng tạo)</span>
                        </span>
                        {routingMode === 'custom_topic' && (
                          <Check className="h-4 w-4 text-[#58CC02]" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Tạo một bộ từ mới mang tên và nhãn chủ đề riêng do bạn tự đặt.
                      </p>
                    </button>

                    {/* Option 5: Untagged Standalone Deck */}
                    <button
                      type="button"
                      onClick={() => setRoutingMode('untagged')}
                      className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                        routingMode === 'untagged'
                          ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Layers className="h-4 w-4 text-slate-500" />
                          <span>Không gắn tag nào cả (Độc lập)</span>
                        </span>
                        {routingMode === 'untagged' && (
                          <Check className="h-4 w-4 text-[#58CC02]" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Lưu thành bộ từ vựng độc lập, không phụ thuộc 15 chủ đề hay đề thi nào.
                      </p>
                    </button>

                    {/* Option 6: Merge into an existing deck */}
                    <button
                      type="button"
                      onClick={() => setRoutingMode('existing_deck')}
                      className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer ${
                        routingMode === 'existing_deck'
                          ? 'border-[#58CC02] bg-lime-50/70 dark:bg-emerald-950/40'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Tag className="h-4 w-4 text-purple-600" />
                          <span>Cộng dồn vào Bộ từ có sẵn</span>
                        </span>
                        {routingMode === 'existing_deck' && (
                          <Check className="h-4 w-4 text-[#58CC02]" />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Thêm nối tiếp danh sách từ này vào một bộ từ đã có trong Kho của bạn.
                      </p>
                    </button>
                  </div>

                  {/* Dynamic Sub-Controls based on selected routingMode */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-3">
                    {routingMode === 'auto_15_topics' && (
                      <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                        <p className="font-bold text-slate-900 dark:text-white">
                          Cơ chế Tự động phân loại thông minh:
                        </p>
                        <p>
                          • Các từ có nhãn <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">topic</code> thuộc 15 Chủ đề chuẩn B1 sẽ được gộp thẳng vào đúng chủ đề đó (tự động lọc trùng).
                        </p>
                        <p>
                          • Nếu file JSON có trường <code className="font-mono bg-slate-200 dark:bg-slate-700 px-1 rounded">testTitle</code>, hệ thống đồng thời tạo bộ từ gắn với đề thi đó để bạn tiện ôn theo cả 2 cách!
                        </p>
                      </div>
                    )}

                    {routingMode === '15_topics' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Chọn Chủ đề chuẩn B1 để nhận từ vựng:
                        </label>
                        <select
                          value={selectedTopic}
                          onChange={(e) => setSelectedTopic(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                        >
                          {B1_OFFICIAL_15_TOPICS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {routingMode === 'exam_test' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Chọn Bộ đề thi trong Web:
                          </label>
                          <select
                            value={selectedTestId}
                            onChange={(e) => {
                              setSelectedTestId(e.target.value);
                              const found = tests.find((t) => t.id === e.target.value);
                              if (found) {
                                setCustomDeckName(`Từ vựng - ${found.title}`);
                              }
                            }}
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                          >
                            {tests.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Tên hiển thị của Bộ từ đề thi:
                          </label>
                          <input
                            type="text"
                            value={customDeckName}
                            onChange={(e) => setCustomDeckName(e.target.value)}
                            placeholder="VD: Từ vựng trọng tâm Test 1"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}

                    {routingMode === 'custom_topic' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Tên Bộ từ mới:
                          </label>
                          <input
                            type="text"
                            value={customDeckName}
                            onChange={(e) => setCustomDeckName(e.target.value)}
                            placeholder="VD: Cụm động từ & Paraphrase B1"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                            Nhãn Chủ đề mới (Tag):
                          </label>
                          <input
                            type="text"
                            value={customTopicTag}
                            onChange={(e) => setCustomTopicTag(e.target.value)}
                            placeholder="VD: Phrasal Verbs / Bẫy Listening"
                            className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}

                    {routingMode === 'untagged' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Tên Bộ từ độc lập (Không gắn tag):
                        </label>
                        <input
                          type="text"
                          value={customDeckName}
                          onChange={(e) => setCustomDeckName(e.target.value)}
                          placeholder="VD: Danh sách từ tổng hợp"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    {routingMode === 'existing_deck' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                          Chọn Bộ từ hiện có trong Kho:
                        </label>
                        <select
                          value={selectedExistingDeckId}
                          onChange={(e) => setSelectedExistingDeckId(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                        >
                          {decks.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.icon} {d.name} ({d.items?.length || 0} từ)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* STEP 3: PREVIEW PARSED WORDS */}
              {parsedPreview && parsedPreview.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Xem trước danh sách ({parsedPreview.length} từ vựng hợp lệ)
                      </span>
                      {detectedJsonMeta?.testTitle && (
                        <span className="text-xs font-semibold text-slate-500">
                          · Nguồn đề: {detectedJsonMeta.testTitle}
                        </span>
                      )}
                    </div>

                    {detectedJsonMeta && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>Phân bổ chủ đề trong JSON:</span>
                        {Object.entries(detectedJsonMeta.topicSummary)
                          .slice(0, 4)
                          .map(([tp, cnt]) => (
                            <span
                              key={tp}
                              className="font-semibold text-slate-700 dark:text-slate-300"
                            >
                              {tp} ({cnt}) ·
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="p-2.5 w-10 text-center">#</th>
                          <th className="p-2.5">Từ vựng</th>
                          <th className="p-2.5">IPA & Từ loại</th>
                          <th className="p-2.5">Nghĩa tiếng Việt</th>
                          <th className="p-2.5">Chủ đề / Vị trí đề</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {parsedPreview.slice(0, 50).map((item, idx) => (
                          <tr key={item.id}>
                            <td className="p-2.5 text-center font-mono text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="p-2.5 font-black text-slate-900 dark:text-white">
                              {item.word}
                            </td>
                            <td className="p-2.5 font-mono text-slate-500">
                              {item.phonetic} ({item.partOfSpeech})
                            </td>
                            <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200">
                              {item.meaningVi}
                            </td>
                            <td className="p-2.5 text-slate-500">
                              {item.topic}
                              {item.note ? ` · ${item.note}` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Đóng cửa sổ
          </button>

          {activeTab === 'import' ? (
            <button
              type="button"
              disabled={!parsedPreview || parsedPreview.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 rounded-xl bg-[#58CC02] hover:bg-[#46a302] disabled:opacity-40 px-6 py-2.5 text-xs sm:text-sm font-black text-white shadow-md transition-all cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>
                Hoàn tất nhập {parsedPreview ? `${parsedPreview.length} từ vựng` : 'JSON'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('import')}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-xs font-black transition-all cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              <span>Chuyển sang bước Dán JSON & Nhập từ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
