import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  FileCode2,
  Upload,
  Headphones,
  CheckCircle2,
  AlertCircle,
  Music,
  Sparkles,
  Eye,
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  FileText,
  Wand2,
  Layers,
  BookOpen,
  Check,
  Volume2,
  Download,
  RotateCcw,
  PenTool,
  Plus,
  Trash2,
  Edit3,
  FilePlus2,
  Tag,
  Mic,
} from 'lucide-react';
import { Question, TestMetadata, StimulusCard, PartAudioMap, VocabItem, getPartRelativeNumber } from '../types/exam';
import { playDictionaryAudio } from '../utils/dictionaryAudio';
import {
  persistExamAudioFile,
  resolvePlayableAudioUrl,
  prepareLocalTestAudioBeforeSave,
  startBackgroundTestAudioCloudSync,
  notifyAudioCloudSyncBanner,
  testFirebaseStorageConnection,
  StorageConnectionTestResult,
  subscribeToFirebaseStorageUrlReady,
  ensureVstepAudioKey,
  patchTestAudioMetadataEverywhere,
  FIREBASE_STORAGE_BUCKET,
  STORAGE_AUDIO_FOLDER,
  APP_SITE_ID,
} from '../utils/audioStorageService';
import { AudioCloudSyncBanner } from './AudioCloudSyncBanner';
import {
  DEFAULT_EXAM_CATEGORIES,
  getCustomExamTags,
  addCustomExamTag,
  renameCustomExamTag,
  subscribeToCustomExamTags,
  getEffectiveTestCategory,
} from '../services/categoryTagService';
import { WritingTask, WritingSubmission, SAMPLE_B1_WRITING_TASKS } from '../types/writing';
import {
  SpeakingTask,
  SpeakingSubmission,
  SAMPLE_VSTEP_SPEAKING_TASKS,
  EMPTY_SPEAKING_SUBMISSION,
} from '../types/speaking';
import { TEST_1_QUESTIONS } from '../data/test1Data';
import { JsonImportModal } from './JsonImportModal';
import { AiPdfUploadModal } from './AiPdfUploadModal';
import { ImageUploaderCard } from './ImageUploaderCard';
import { QuestionStage } from './QuestionStage';
import { WritingSectionStage } from './WritingSectionStage';
import { SpeakingSectionStage } from './SpeakingSectionStage';
import { ImageZoomModal } from './ImageZoomModal';
import { InteractiveTranscriptModal } from './InteractiveTranscriptModal';
import {
  saveTestToFirestore,
  createBlankQuestionsTemplate,
  createBlankWritingTasksTemplate,
  createBlankSpeakingTasksTemplate,
  compactQuestionsForStorage,
} from '../services/examService';
import { useAuth } from '../context/AuthContext';

interface ExamBuilderViewProps {
  initialTest?: TestMetadata | null;
  initialQuestions?: Question[] | null;
  onBack: () => void;
  onTestSaved: (newTest: TestMetadata) => void;
  onSaveProgress?: (updatedTest: TestMetadata) => void;
}

interface PartConfig {
  id: number;
  shortName: string;
  fullName: string;
  section: 'LISTENING' | 'READING' | 'WRITING' | 'SPEAKING' | 'VOCABULARY';
  partNumber: 1 | 2 | 3 | 4;
  rangeLabel: string;
  instruction: string;
  mappingGuide: string;
}

const PART_CONFIGS: PartConfig[] = [
  {
    id: 1,
    shortName: 'L1: Part 1 (Câu 1-8)',
    fullName: 'Listening Part 1: 8 Thông báo & Hướng dẫn ngắn (Câu 1 - 8)',
    section: 'LISTENING',
    partNumber: 1,
    rangeLabel: 'Listening Part 1 · Questions 1-8',
    instruction:
      'In this part, you will hear EIGHT short announcements or instructions. There is one question for each announcement or instruction. For each question, choose the right answer A, B, C or D.',
    mappingGuide:
      'Mỗi câu có 4 lựa chọn A, B, C, D kèm lời thoại Audio Script, bản dịch song ngữ, câu bằng chứng và giải thích chi tiết.',
  },
  {
    id: 2,
    shortName: 'L2: Part 2 (Câu 9-20)',
    fullName: 'Listening Part 2: 3 Đoạn hội thoại · 12 Câu hỏi (Câu 9 - 20)',
    section: 'LISTENING',
    partNumber: 2,
    rangeLabel: 'Listening Part 2 · Questions 9-20',
    instruction:
      'In this part, you will hear THREE conversations. The conversations will not be repeated. There are four questions for each conversation. For each question, choose the correct answer A, B, C or D.',
    mappingGuide:
      'Gồm 3 đoạn hội thoại (Conversation 1: Câu 9–12, Conversation 2: Câu 13–16, Conversation 3: Câu 17–20). Mỗi câu có 4 lựa chọn A, B, C, D.',
  },
  {
    id: 3,
    shortName: 'L3: Part 3 (Câu 21-35)',
    fullName: 'Listening Part 3: 3 Bài thuyết trình / Bài giảng · 15 Câu hỏi (Câu 21 - 35)',
    section: 'LISTENING',
    partNumber: 3,
    rangeLabel: 'Listening Part 3 · Questions 21-35',
    instruction:
      'In this part, you will hear THREE talks or lectures. The talks or lectures will not be repeated. There are five questions for each talk or lecture. For each question, choose the right answer A, B, C or D.',
    mappingGuide:
      'Gồm 3 bài giảng học thuật (Talk 1: Câu 21–25, Talk 2: Câu 26–30, Talk 3: Câu 31–35). Mỗi câu có 4 lựa chọn A, B, C, D.',
  },
  {
    id: 5,
    shortName: 'R1: Passage 1 (Câu 1-10)',
    fullName: 'Reading Passage 1: Bài đọc số 1 · 10 Câu trắc nghiệm A-D (Câu 1 - 10 / Mã #36-45)',
    section: 'READING',
    partNumber: 1,
    rangeLabel: 'Reading Passage 1 · Questions 1-10',
    instruction:
      'Directions: In this section of the test, you will read FOUR different passages, each followed by 10 questions about it. For questions 1-40, you have to choose the best answer A, B, C, or D, to each question.',
    mappingGuide:
      'Cột trái hiển thị Bài đọc 1 chia đoạn [Đoạn 1]..[Đoạn N] có hỗ trợ chữ gạch chân/in đậm <u><b>word</b></u> và ô chèn câu [A] [B] [C] [D]; Cột phải là 10 câu trắc nghiệm (Câu 1–10).',
  },
  {
    id: 6,
    shortName: 'R2: Passage 2 (Câu 11-20)',
    fullName: 'Reading Passage 2: Bài đọc số 2 · 10 Câu trắc nghiệm A-D (Câu 11 - 20 / Mã #46-55)',
    section: 'READING',
    partNumber: 2,
    rangeLabel: 'Reading Passage 2 · Questions 11-20',
    instruction:
      'Read Passage 2 carefully and choose the best answer A, B, C, or D to each question (Questions 11–20).',
    mappingGuide:
      'Cột trái hiển thị Bài đọc 2 chia đoạn [Đoạn 1]..[Đoạn N] có hỗ trợ chữ gạch chân/in đậm <u><b>word</b></u> và ô chèn câu [A] [B] [C] [D]; Cột phải là 10 câu trắc nghiệm (Câu 11–20).',
  },
  {
    id: 7,
    shortName: 'R3: Passage 3 (Câu 21-30)',
    fullName: 'Reading Passage 3: Bài đọc số 3 · 10 Câu trắc nghiệm A-D (Câu 21 - 30 / Mã #56-65)',
    section: 'READING',
    partNumber: 3,
    rangeLabel: 'Reading Passage 3 · Questions 21-30',
    instruction:
      'Read Passage 3 carefully and choose the best answer A, B, C, or D to each question (Questions 21–30).',
    mappingGuide:
      'Cột trái hiển thị Bài đọc 3 chia đoạn [Đoạn 1]..[Đoạn N] có hỗ trợ chữ gạch chân/in đậm <u><b>word</b></u> và ô chèn câu [A] [B] [C] [D]; Cột phải là 10 câu trắc nghiệm (Câu 21–30).',
  },
  {
    id: 8,
    shortName: 'R4: Passage 4 (Câu 31-40)',
    fullName: 'Reading Passage 4: Bài đọc số 4 · 10 Câu trắc nghiệm A-D (Câu 31 - 40 / Mã #66-75)',
    section: 'READING',
    partNumber: 4,
    rangeLabel: 'Reading Passage 4 · Questions 31-40',
    instruction:
      'Read Passage 4 carefully and choose the best answer A, B, C, or D to each question (Questions 31–40).',
    mappingGuide:
      'Cột trái hiển thị Bài đọc 4 chia đoạn [Đoạn 1]..[Đoạn N] có hỗ trợ chữ gạch chân/in đậm <u><b>word</b></u> và ô chèn câu [A] [B] [C] [D]; Cột phải là 10 câu trắc nghiệm (Câu 31–40).',
  },
  {
    id: 9,
    shortName: 'W1: Writing Task 1',
    fullName: 'Writing Task 1: Viết Thư / Email trao đổi (Tối thiểu 120 từ · Trọng số 1/3)',
    section: 'WRITING',
    partNumber: 1,
    rangeLabel: 'Writing Task 1 · ≥ 120 words',
    instruction:
      'You should spend about 20 minutes on this task. Write a letter or email of at least 120 words.',
    mappingGuide:
      'Soạn đề bài Writing Task 1 (Thư thân mật hoặc trang trọng, tối thiểu 120 từ, chiếm 1/3 tổng điểm Writing) kèm bài mẫu B2/C1.',
  },
  {
    id: 10,
    shortName: 'W2: Writing Task 2',
    fullName: 'Writing Task 2: Viết Bài Luận - Essay (Tối thiểu 250 từ · Trọng số 2/3)',
    section: 'WRITING',
    partNumber: 2,
    rangeLabel: 'Writing Task 2 · ≥ 250 words',
    instruction:
      'You should spend about 40 minutes on this task. Write an essay of at least 250 words on the given topic.',
    mappingGuide:
      'Soạn đề bài Writing Task 2 (Bài luận học thuật ≥ 250 từ, chiếm 2/3 tổng điểm Writing) kèm bài mẫu B2/C1.',
  },
  {
    id: 11,
    shortName: 'S1: Speaking Part 1',
    fullName: 'Speaking Part 1: Social Interaction (Giao tiếp xã hội · 3 phút)',
    section: 'SPEAKING',
    partNumber: 1,
    rangeLabel: 'Speaking Part 1 · 3 mins',
    instruction:
      "PART 1: Social Interaction (3'). Answer questions about two familiar topics.",
    mappingGuide:
      'Soạn 2 chủ đề giao tiếp xã hội (VD: Let’s talk about your free time activities & Let’s talk about your neighborhood), mỗi chủ đề 3 câu hỏi kèm bài mẫu.',
  },
  {
    id: 12,
    shortName: 'S2: Speaking Part 2',
    fullName: 'Speaking Part 2: Solution Discussion (Thảo luận giải pháp · 4 phút)',
    section: 'SPEAKING',
    partNumber: 2,
    rangeLabel: 'Speaking Part 2 · 4 mins',
    instruction:
      "PART 2: Solution Discussion (4'). 1 minute to prepare and 2-3 minutes to present.",
    mappingGuide:
      'Soạn tình huống (Situation) và 3 lựa chọn giải pháp để thí sinh chọn phương án tốt nhất và phản biện 2 phương án còn lại.',
  },
  {
    id: 13,
    shortName: 'S3: Speaking Part 3 (Mind-map)',
    fullName: 'Speaking Part 3: Topic Development & Sơ Đồ Tư Duy Mind-map (5 phút)',
    section: 'SPEAKING',
    partNumber: 3,
    rangeLabel: 'Speaking Part 3 · 5 mins',
    instruction:
      "PART 3: Topic Development (5'). Develop the topic using the mind-map and answer follow-up questions.",
    mappingGuide:
      'Soạn chủ đề (Topic), sơ đồ tư duy Mind-map gồm 1 ô trung tâm và 3 ô nhánh xung quanh giống hệt đề gốc VSTEP, cùng 3 câu hỏi thảo luận mở rộng.',
  },
];

export const ExamBuilderView: React.FC<ExamBuilderViewProps> = ({
  initialTest,
  initialQuestions,
  onBack,
  onTestSaved,
  onSaveProgress,
}) => {
  const { currentUser } = useAuth();
  const isEditing = !!initialTest;

  // Initialize with initialTest if editing, or 100% BLANK template when creating a new exam manually (strictly prefixed with vstep-test-)
  const [testId] = useState(initialTest?.id || `vstep-test-${Date.now()}`);
  const [testTitle, setTestTitle] = useState(
    initialTest?.title || ''
  );
  const [testSubtitle, setTestSubtitle] = useState(
    initialTest?.subtitle || ''
  );
  const [durationMinutes, setDurationMinutes] = useState(initialTest?.durationMinutes || 100);

  // Draft vs Published status + Teacher Category Tagging
  const [examStatus, setExamStatus] = useState<'draft' | 'published'>(
    initialTest?.status || (isEditing ? 'published' : 'draft')
  );
  const [categoryTag, setCategoryTag] = useState<string>(() => {
    if (initialTest) return getEffectiveTestCategory(initialTest);
    return 'Đề Nháp';
  });
  const [customTagsList, setCustomTagsList] = useState<string[]>(() => getCustomExamTags());
  const [isCustomTagEditorOpen, setIsCustomTagEditorOpen] = useState<boolean>(false);
  const [customTagInput, setCustomTagInput] = useState<string>('');
  const [editingOldTag, setEditingOldTag] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeToCustomExamTags((tags) => {
      setCustomTagsList(tags);
    });
    return () => unsub();
  }, []);

  // Audio Mode: 'single' (1 file for whole exam) or 'per_part' (4 separate files for Part 1-4)
  const [audioMode, setAudioMode] = useState<'single' | 'per_part'>(
    initialTest?.audioMode || 'single'
  );
  const [audioUrl, setAudioUrl] = useState(initialTest?.audioUrl || '');
  const [audioFileName, setAudioFileName] = useState(initialTest?.audioFileName || '');
  const [partAudioUrls, setPartAudioUrls] = useState<PartAudioMap>(
    initialTest?.partAudioUrls || {}
  );
  const [partAudioFileNames, setPartAudioFileNames] = useState<PartAudioMap>(
    initialTest?.partAudioFileNames || {}
  );
  const [resolvedSinglePlayableUrl, setResolvedSinglePlayableUrl] = useState<string>('');
  const [resolvedPartPlayableUrls, setResolvedPartPlayableUrls] = useState<PartAudioMap>({});
  const [isTestingStorage, setIsTestingStorage] = useState<boolean>(false);
  const [storageTestResult, setStorageTestResult] = useState<StorageConnectionTestResult | null>(
    null
  );

  // Automatically replace idb-audio:// URLs with the direct Firebase Storage CDN URL (`storageUrl`)
  // as soon as background upload to `vstep/exam_audio/vstep_{cleanKey}.mp3` completes,
  // and auto-discover any existing canonical audio on mount if initialTest had no audioUrl yet.
  useEffect(() => {
    const fullKey = ensureVstepAudioKey(`${testId}_full`);
    const p1Key = ensureVstepAudioKey(`${testId}_part1`);
    const p2Key = ensureVstepAudioKey(`${testId}_part2`);
    const p3Key = ensureVstepAudioKey(`${testId}_part3`);
    const p4Key = ensureVstepAudioKey(`${testId}_part4`);

    const unsub = subscribeToFirebaseStorageUrlReady((readyKey, cdnUrl) => {
      if (readyKey === fullKey) {
        setAudioUrl(cdnUrl);
        patchTestAudioMetadataEverywhere({
          testId,
          partScope: 'full',
          audioUrl: cdnUrl,
          audioMode: 'single',
        }).catch(() => {});
      } else if (readyKey === p1Key) {
        setPartAudioUrls((prev) => ({ ...prev, part1: cdnUrl }));
        patchTestAudioMetadataEverywhere({
          testId,
          partScope: 1,
          audioUrl: cdnUrl,
          audioMode: 'per_part',
        }).catch(() => {});
      } else if (readyKey === p2Key) {
        setPartAudioUrls((prev) => ({ ...prev, part2: cdnUrl }));
        patchTestAudioMetadataEverywhere({
          testId,
          partScope: 2,
          audioUrl: cdnUrl,
          audioMode: 'per_part',
        }).catch(() => {});
      } else if (readyKey === p3Key) {
        setPartAudioUrls((prev) => ({ ...prev, part3: cdnUrl }));
        patchTestAudioMetadataEverywhere({
          testId,
          partScope: 3,
          audioUrl: cdnUrl,
          audioMode: 'per_part',
        }).catch(() => {});
      } else if (readyKey === p4Key) {
        setPartAudioUrls((prev) => ({ ...prev, part4: cdnUrl }));
        patchTestAudioMetadataEverywhere({
          testId,
          partScope: 4,
          audioUrl: cdnUrl,
          audioMode: 'per_part',
        }).catch(() => {});
      }
    });

    // Auto-discover server/canonical audio if initialTest had empty fields
    void (async () => {
      try {
        const resp = await fetch(`/api/audio/discover/${encodeURIComponent(testId)}`);
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          full?: { streamUrl?: string; fileName?: string } | null;
          parts?: Record<string, { streamUrl?: string; fileName?: string }>;
        };
        if (data?.full?.streamUrl) {
          setAudioUrl((prev) => prev || `idb-audio://${fullKey}`);
          setAudioFileName((prev) => prev || data.full?.fileName || 'Audio toàn bài.mp3');
        }
        if (data?.parts && Object.keys(data.parts).length > 0) {
          setPartAudioUrls((prev) => {
            const next = { ...prev };
            for (const pNum of [1, 2, 3, 4] as const) {
              const pField = `part${pNum}` as const;
              if (!next[pField] && data.parts?.[pField]?.streamUrl) {
                next[pField] = `idb-audio://${ensureVstepAudioKey(`${testId}_part${pNum}`)}`;
              }
            }
            return next;
          });
          setPartAudioFileNames((prev) => {
            const next = { ...prev };
            for (const pNum of [1, 2, 3, 4] as const) {
              const pField = `part${pNum}` as const;
              if (!next[pField] && data.parts?.[pField]?.fileName) {
                next[pField] = data.parts[pField].fileName;
              }
            }
            return next;
          });
        }
      } catch {
        // Ignore discovery error
      }
    })();

    return () => unsub();
  }, [testId]);

  const handleTestStorageConnection = async () => {
    setIsTestingStorage(true);
    setStorageTestResult(null);
    try {
      const res = await testFirebaseStorageConnection();
      setStorageTestResult(res);
    } finally {
      setIsTestingStorage(false);
    }
  };

  const [questions, setQuestions] = useState<Question[]>(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      return JSON.parse(JSON.stringify(initialQuestions));
    }
    if (initialTest?.questions && initialTest.questions.length > 0) {
      return JSON.parse(JSON.stringify(initialTest.questions));
    }
    if (isEditing) {
      return JSON.parse(JSON.stringify(TEST_1_QUESTIONS));
    }
    // Manual Create Mode -> 100% Blank 52-question template!
    return createBlankQuestionsTemplate();
  });

  const [writingTasks, setWritingTasks] = useState<WritingTask[]>(() => {
    if (initialTest?.writingTasks && initialTest.writingTasks.length >= 2) {
      return JSON.parse(JSON.stringify(initialTest.writingTasks));
    }
    if (isEditing) {
      return JSON.parse(JSON.stringify(SAMPLE_B1_WRITING_TASKS));
    }
    return createBlankWritingTasksTemplate();
  });

  const [speakingTasks, setSpeakingTasks] = useState<SpeakingTask[]>(() => {
    if (initialTest?.speakingTasks && initialTest.speakingTasks.length >= 3) {
      return JSON.parse(JSON.stringify(initialTest.speakingTasks));
    }
    if (isEditing) {
      return JSON.parse(JSON.stringify(SAMPLE_VSTEP_SPEAKING_TASKS));
    }
    return createBlankSpeakingTasksTemplate();
  });

  const [attachedVocabulary, setAttachedVocabulary] = useState<VocabItem[]>(() => {
    if (initialTest?.vocabulary && Array.isArray(initialTest.vocabulary)) {
      return JSON.parse(JSON.stringify(initialTest.vocabulary));
    }
    return [];
  });

  const [previewWritingSubmission, setPreviewWritingSubmission] = useState<WritingSubmission>({
    task1Text: '',
    task2Text: '',
    task1WordCount: 0,
    task2WordCount: 0,
  });

  const [previewSpeakingSubmission, setPreviewSpeakingSubmission] = useState<SpeakingSubmission>(
    EMPTY_SPEAKING_SUBMISSION
  );

  // Active Part (1 to 13) & Active Question in Preview
  const [activeTab, setActiveTab] = useState<number>(1);
  const [previewActiveQuestionId, setPreviewActiveQuestionId] = useState<number>(1);
  const [previewAnswers, setPreviewAnswers] = useState<Record<number, string>>({});
  const [previewMode, setPreviewMode] = useState<'exam' | 'practice'>('practice');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isMetaExpanded, setIsMetaExpanded] = useState<boolean>(true);

  const partAudioInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Quick-fill smart text drawer state
  const [isQuickFillOpen, setIsQuickFillOpen] = useState<boolean>(false);
  const [quickFillText, setQuickFillText] = useState<string>('');
  const [quickFillNotice, setQuickFillNotice] = useState<string | null>(null);

  // Active sub-tab for Reading Part 3 (editing Text A, B, C, D)
  const [activePart3TextId, setActivePart3TextId] = useState<'A' | 'B' | 'C' | 'D'>('A');

  // Expanded question image uploaders
  const [openImagePanels, setOpenImagePanels] = useState<Record<number, boolean>>({});

  // Modals
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isAiPdfModalOpen, setIsAiPdfModalOpen] = useState(false);
  const [zoomCard, setZoomCard] = useState<StimulusCard | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [savingMode, setSavingMode] = useState<'in_place' | 'publish' | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [inPlaceSavedMessage, setInPlaceSavedMessage] = useState<string | null>(null);
  const [lastSavedAtText, setLastSavedAtText] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePartConfig = useMemo(
    () => PART_CONFIGS.find((p) => p.id === activeTab) || PART_CONFIGS[0],
    [activeTab]
  );

  // Filter questions for active part
  const currentQuestions = useMemo(() => {
    return questions.filter(
      (q) =>
        q.section === activePartConfig.section && q.partNumber === activePartConfig.partNumber
    );
  }, [questions, activePartConfig]);

  // Live stats for 52 questions & attached images
  const completedQuestionCount = useMemo(() => {
    return questions.filter((q) => {
      const hasAns = Array.isArray(q.correctAnswer)
        ? q.correctAnswer.some((a) => a.trim().length > 0)
        : String(q.correctAnswer || '').trim().length > 0;
      const hasPromptOrGap =
        q.type === 'gapped_text' ||
        (q.prompt && q.prompt.trim().length > 0) ||
        (q.notesData?.label && q.notesData.label.trim().length > 0);
      return hasAns && hasPromptOrGap;
    }).length;
  }, [questions]);

  const totalImageCount = useMemo(() => {
    let count = 0;
    const seenShared = new Set<string>();
    questions.forEach((q) => {
      if (q.imageUrl) count++;
      if (q.stimulusCard?.imageUrl && q.stimulusCard.imageUrl !== q.imageUrl) count++;
      if (q.gappedArticle?.imageUrl && !seenShared.has('r2')) {
        seenShared.add('r2');
        count++;
      }
      if (q.readingArticle?.imageUrl && !seenShared.has('r4')) {
        seenShared.add('r4');
        count++;
      }
      if (q.multiTextCards && !seenShared.has('r3')) {
        seenShared.add('r3');
        q.multiTextCards.forEach((c) => {
          if (c.imageUrl) count++;
        });
      }
    });
    return count;
  }, [questions]);

  const [isValidatorOpen, setIsValidatorOpen] = useState<boolean>(false);

  // AI Exam Part Generator Modal State
  const [isAiPartGenOpen, setIsAiPartGenOpen] = useState<boolean>(false);
  const [aiGenTargetType, setAiGenTargetType] = useState<
    'READING_PASSAGE' | 'WRITING_TASK' | 'SPEAKING_PART'
  >('READING_PASSAGE');
  const [aiGenPartNum, setAiGenPartNum] = useState<number>(1);
  const [aiGenTopic, setAiGenTopic] = useState<string>(
    'Artificial Intelligence and Digital Learning in Modern Education'
  );
  const [aiGenBand, setAiGenBand] = useState<'B1' | 'B2' | 'C1'>('B2');
  const [isGeneratingAiPart, setIsGeneratingAiPart] = useState<boolean>(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);

  const handleGenerateAiExamPart = async () => {
    const cleanTopic = aiGenTopic.trim();
    if (!cleanTopic) {
      setAiGenError('Vui lòng nhập chủ đề tiếng Anh hoặc tiếng Việt để AI biên soạn đề.');
      return;
    }
    setIsGeneratingAiPart(true);
    setAiGenError(null);
    try {
      const resp = await fetch('/api/ai/generate-exam-part', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: aiGenTargetType,
          partNumber: aiGenPartNum,
          topic: cleanTopic,
          targetBand: aiGenBand,
        }),
      });
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || 'Không thể sinh đề tự động lúc này.');
      }
      const result = await resp.json();
      const data = result.data || {};

      if (aiGenTargetType === 'READING_PASSAGE') {
        const pNum = (Math.min(4, Math.max(1, aiGenPartNum)) as 1 | 2 | 3 | 4);
        const paragraphs: string[] =
          Array.isArray(data.paragraphs) && data.paragraphs.length > 0
            ? data.paragraphs
            : ['Paragraph 1...'];
        const transParagraphs: string[] = Array.isArray(data.translationParagraphs)
          ? data.translationParagraphs
          : [];
        const genQs: any[] = Array.isArray(data.questions) ? data.questions : [];

        setQuestions((prev) => {
          const partQs = prev.filter((q) => q.section === 'READING' && q.partNumber === pNum);
          const partIds = partQs.map((q) => q.id);
          return prev.map((q) => {
            if (q.section !== 'READING' || q.partNumber !== pNum) return q;
            const idxInPart = partIds.indexOf(q.id);
            const gq = genQs[idxInPart];
            const updatedArticle = {
              title:
                data.title ||
                `PASSAGE ${pNum} – ${cleanTopic.toUpperCase()}`,
              paragraphs,
            };
            const updatedTrans =
              transParagraphs.length > 0
                ? {
                    title: `Bản dịch Bài đọc ${pNum}`,
                    paragraphs: transParagraphs,
                  }
                : q.readingArticleTranslation;

            if (!gq) {
              return {
                ...q,
                readingArticle: updatedArticle,
                readingPassage: paragraphs.join('\n\n'),
                readingArticleTranslation: updatedTrans,
              };
            }

            const ansLetter = ['A', 'B', 'C', 'D'].includes(
              String(gq.correctAnswer || '').trim().toUpperCase()
            )
              ? String(gq.correctAnswer).trim().toUpperCase()
              : 'A';

            return {
              ...q,
              readingArticle: updatedArticle,
              readingPassage: paragraphs.join('\n\n'),
              readingArticleTranslation: updatedTrans,
              prompt: gq.prompt || q.prompt,
              options: [
                { id: 'A', text: gq.optionA || 'Option A' },
                { id: 'B', text: gq.optionB || 'Option B' },
                { id: 'C', text: gq.optionC || 'Option C' },
                { id: 'D', text: gq.optionD || 'Option D' },
              ],
              correctAnswer: ansLetter,
              evidenceQuote: gq.evidenceQuote || '',
              explanation: gq.explanation || '',
            };
          });
        });

        handleSelectPartTab(pNum + 4);
        setQuickFillNotice(
          `Đã tự động sinh Reading Passage ${pNum} (Bài đọc + Dịch + 10 câu hỏi A–D chuẩn Band ${aiGenBand}) theo chủ đề "${cleanTopic}"!`
        );
      } else if (aiGenTargetType === 'WRITING_TASK') {
        const wNum = (aiGenPartNum === 2 ? 2 : 1) as 1 | 2;
        handleUpdateWritingTask(wNum, {
          title:
            data.title ||
            (wNum === 1
              ? 'Writing Task 1 · Formal / Informal Letter'
              : 'Writing Task 2 · Academic Essay'),
          instruction:
            data.scenario ||
            (wNum === 1
              ? 'You should spend about 20 minutes on this task. Write a letter or email of at least 120 words.'
              : 'You should spend about 40 minutes on this task. Write an essay of at least 250 words.'),
          stimulusText: data.stimulusText || '',
          bulletPoints: Array.isArray(data.bulletPoints) ? data.bulletPoints : [],
          sampleAnswer: data.sampleB2 || data.sampleAnswer || data.sampleC1 || '',
        });
        handleSelectPartTab(wNum === 1 ? 9 : 10);
        setQuickFillNotice(
          `Đã tự động sinh đề Writing Task ${wNum} kèm bài mẫu chuẩn Band ${aiGenBand} theo chủ đề "${cleanTopic}"!`
        );
      } else {
        const sNum = (Math.min(3, Math.max(1, aiGenPartNum)) as 1 | 2 | 3);
        if (sNum === 1) {
          handleUpdateSpeakingTask(1, {
            title: data.title || `PART 1: Social Interaction (${cleanTopic})`,
            topicClusters: [
              {
                topicTitle: data.topic1Title || `Let's talk about ${cleanTopic}`,
                questions:
                  Array.isArray(data.topic1Questions) && data.topic1Questions.length > 0
                    ? data.topic1Questions
                    : [
                        `How important is ${cleanTopic} in your daily life?`,
                        'What changes have you noticed recently regarding this topic?',
                        'How do you think this trend will develop in the future?',
                      ],
              },
              {
                topicTitle: data.topic2Title || 'Let’s talk about lifestyle & habits',
                questions:
                  Array.isArray(data.topic2Questions) && data.topic2Questions.length > 0
                    ? data.topic2Questions
                    : [
                        'How do people in your community usually spend their weekends?',
                        'What are the benefits of learning new skills regularly?',
                        'Would you prefer studying alone or in a group? Why?',
                      ],
              },
            ],
            sampleAnswer: data.sampleB2 || data.sampleAnswer || data.sampleC1 || '',
          });
        } else if (sNum === 2) {
          handleUpdateSpeakingTask(2, {
            title: data.title || `PART 2: Solution Discussion (${cleanTopic})`,
            situation:
              data.situation ||
              `Situation: You are considering the best approach related to ${cleanTopic}. There are THREE options for you to choose:`,
            options:
              Array.isArray(data.options) && data.options.length >= 3
                ? data.options.slice(0, 3)
                : ['Option 1', 'Option 2', 'Option 3'],
            sampleAnswer: data.sampleB2 || data.sampleAnswer || data.sampleC1 || '',
          });
        } else {
          handleUpdateSpeakingTask(3, {
            title: data.title || `PART 3: Topic Development (${cleanTopic})`,
            topicStatement:
              data.topicStatement || `Topic: ${cleanTopic} plays a vital role in modern life.`,
            mindMap: {
              centralIdea: data.centralIdea || cleanTopic,
              nodes:
                Array.isArray(data.mindMapNodes) && data.mindMapNodes.length >= 3
                  ? [...data.mindMapNodes.slice(0, 3), '[Your own ideas]']
                  : ['Personal growth', 'Economic impact', 'Social connection', '[Your own ideas]'],
            },
            followUpQuestions:
              Array.isArray(data.followUpQuestions) && data.followUpQuestions.length > 0
                ? data.followUpQuestions
                : [
                    `Do you think governments should invest more in ${cleanTopic}?`,
                    'How does this issue affect younger and older generations differently?',
                    'What challenges might arise in the next 10 years?',
                  ],
            sampleAnswer: data.sampleB2 || data.sampleAnswer || data.sampleC1 || '',
          });
        }
        handleSelectPartTab(sNum + 10);
        setQuickFillNotice(
          `Đã tự động sinh đề Speaking Part ${sNum} kèm bài mẫu chuẩn Band ${aiGenBand} theo chủ đề "${cleanTopic}"!`
        );
      }

      setTimeout(() => setQuickFillNotice(null), 4500);
      setIsAiPartGenOpen(false);
    } catch (err: any) {
      setAiGenError(err?.message || 'Có lỗi xảy ra khi gọi AI sinh đề.');
    } finally {
      setIsGeneratingAiPart(false);
    }
  };

  // Automated Exam Quality Validator across all 75 questions + Audio + Writing + Speaking
  const validationReport = useMemo(() => {
    const issues: Array<{
      id: string;
      severity: 'error' | 'warning';
      partTabId: number;
      questionId?: number;
      label: string;
      detail: string;
    }> = [];

    if (!testTitle.trim()) {
      issues.push({
        id: 'meta-title',
        severity: 'error',
        partTabId: 1,
        label: 'Cấu hình chung',
        detail: 'Chưa nhập Tên bộ đề thi.',
      });
    }

    if (audioMode === 'single') {
      if (!audioUrl.trim()) {
        issues.push({
          id: 'audio-single',
          severity: 'warning',
          partTabId: 1,
          label: 'File nghe Listening',
          detail: 'Chưa tải lên file MP3 chung cho phần Nghe (hệ thống sẽ đọc bằng giọng TTS dự phòng).',
        });
      }
    } else {
      ([1, 2, 3] as const).forEach((pNum) => {
        const key = `part${pNum}` as keyof PartAudioMap;
        if (!(partAudioUrls[key] || '').trim()) {
          issues.push({
            id: `audio-p${pNum}`,
            severity: 'warning',
            partTabId: pNum,
            label: `Audio Listening Part ${pNum}`,
            detail: `Chưa có file MP3 riêng cho Listening Part ${pNum}.`,
          });
        }
      });
    }

    // Check Reading Passages 1-4
    ([1, 2, 3, 4] as const).forEach((pNum) => {
      const tabId = pNum + 4; // R1=5, R2=6, R3=7, R4=8
      const sampleQ = questions.find((q) => q.section === 'READING' && q.partNumber === pNum);
      const paras = sampleQ?.readingArticle?.paragraphs || [];
      const joinedLen = paras.join(' ').trim().length;
      if (joinedLen < 40) {
        issues.push({
          id: `reading-passage-${pNum}`,
          severity: 'error',
          partTabId: tabId,
          questionId: sampleQ?.id,
          label: `Reading Passage ${pNum}`,
          detail: `Chưa nhập nội dung văn bản bài đọc cho Passage ${pNum}.`,
        });
      }
    });

    // Check each of the 75 questions
    questions.forEach((q) => {
      const tabId = q.section === 'LISTENING' ? q.partNumber : q.partNumber + 4;
      const relNum = getPartRelativeNumber(q.id, questions);
      const qLabel = `${q.section === 'LISTENING' ? `Listening P${q.partNumber}` : `Reading P${q.partNumber}`} · Câu ${relNum}`;

      const hasPrompt = (q.prompt || q.notesData?.label || '').trim().length > 0;
      if (!hasPrompt) {
        issues.push({
          id: `q-${q.id}-prompt`,
          severity: 'error',
          partTabId: tabId,
          questionId: q.id,
          label: qLabel,
          detail: 'Thiếu nội dung câu hỏi (Prompt đang để trống).',
        });
      }

      const hasAns = Array.isArray(q.correctAnswer)
        ? q.correctAnswer.some((a) => a.trim().length > 0)
        : String(q.correctAnswer || '').trim().length > 0;
      if (!hasAns) {
        issues.push({
          id: `q-${q.id}-ans`,
          severity: 'error',
          partTabId: tabId,
          questionId: q.id,
          label: qLabel,
          detail: 'Chưa chọn đáp án đúng (Correct Answer).',
        });
      }

      if (q.options && q.options.length > 0) {
        const emptyOpts = q.options.filter((o) => !(o.text || '').trim()).map((o) => o.id);
        if (emptyOpts.length > 0) {
          issues.push({
            id: `q-${q.id}-opts`,
            severity: 'error',
            partTabId: tabId,
            questionId: q.id,
            label: qLabel,
            detail: `Phương án ${emptyOpts.join(', ')} đang bị bỏ trống nội dung.`,
          });
        }
      }

      if (q.section === 'LISTENING' && !(q.audioScript || '').trim()) {
        issues.push({
          id: `q-${q.id}-script`,
          severity: 'warning',
          partTabId: tabId,
          questionId: q.id,
          label: qLabel,
          detail: 'Chưa có Audio Script (Lời thoại giải thích).',
        });
      }
    });

    // Check Writing Tasks 1 & 2
    writingTasks.forEach((wt) => {
      const tabId = wt.partNumber === 1 ? 9 : 10;
      if (!(wt.stimulusText || '').trim()) {
        issues.push({
          id: `writing-${wt.partNumber}`,
          severity: 'error',
          partTabId: tabId,
          label: `Writing Task ${wt.partNumber}`,
          detail: `Chưa nhập đề bài (Stimulus Text) cho Writing Task ${wt.partNumber}.`,
        });
      }
    });

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    return { issues, errorCount, warningCount };
  }, [testTitle, audioMode, audioUrl, partAudioUrls, questions, writingTasks]);

  const [confirmClearScope, setConfirmClearScope] = useState<'part' | 'all' | null>(null);

  const handleClearCurrentPart = () => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.section !== activePartConfig.section || q.partNumber !== activePartConfig.partNumber) {
          return q;
        }
        return {
          ...q,
          prompt: q.type === 'gapped_text' ? `Gap ${q.id}` : '',
          evidenceQuote: '',
          audioScript: '',
          audioScriptTranslation: '',
          vietnameseTranslation: '',
          imageUrl: '',
          imageCaption: '',
          ...(q.options
            ? {
                options: q.options.map((o) => ({ ...o, text: '' })),
              }
            : {}),
          ...(q.stimulusCard
            ? {
                stimulusCard: {
                  id: String(q.id),
                  title: `Notice #${q.id}`,
                  tag: 'NOTICE',
                  content: '',
                  imageUrl: '',
                  imageCaption: '',
                },
              }
            : {}),
          ...(q.notesData
            ? {
                notesData: {
                  ...q.notesData,
                  label: '',
                },
              }
            : {}),
        };
      })
    );
    setConfirmClearScope(null);
    setQuickFillNotice(`Đã làm trống nội dung ${activePartConfig.shortName} để bạn nhập mới!`);
    setTimeout(() => setQuickFillNotice(null), 3000);
  };

  const handleClearEntireTest = () => {
    setQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        prompt: q.type === 'gapped_text' ? `Gap ${q.id}` : '',
        evidenceQuote: '',
        audioScript: '',
        audioScriptTranslation: '',
        vietnameseTranslation: '',
        imageUrl: '',
        imageCaption: '',
        ...(q.options
          ? {
              options: q.options.map((o) => ({ ...o, text: '' })),
            }
          : {}),
        ...(q.stimulusCard
          ? {
              stimulusCard: {
                id: String(q.id),
                title: `Notice #${q.id}`,
                tag: 'NOTICE',
                content: '',
                imageUrl: '',
                imageCaption: '',
              },
            }
          : {}),
        ...(q.notesData
          ? {
              notesData: {
                showTitle: 'Notes Completion',
                itemNumber: q.id,
                label: '',
              },
            }
          : {}),
      }))
    );
    setConfirmClearScope(null);
    setQuickFillNotice('Đã làm trống toàn bộ 52 câu hỏi (giữ nguyên cấu trúc 8 Part chuẩn B1)!');
    setTimeout(() => setQuickFillNotice(null), 3500);
  };

  const handleExportJson = () => {
    const exportPayload = {
      id: testId,
      title: testTitle.trim() || 'VSTEP B1-B2-C1 Custom Test',
      subtitle: testSubtitle.trim(),
      durationMinutes: Number(durationMinutes) || 172,
      audioMode,
      audioUrl: audioUrl.trim(),
      audioFileName: audioFileName.trim(),
      partAudioUrls,
      partAudioFileNames,
      questions,
      writingTasks,
      speakingTasks,
      vocabulary: attachedVocabulary,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = (testTitle || 'vstep-4-skills-test')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    link.download = `${safeName}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Switch Part Tab and sync preview question
  const handleSelectPartTab = (tabId: number) => {
    setActiveTab(tabId);
    const cfg = PART_CONFIGS.find((p) => p.id === tabId);
    if (cfg) {
      const partQs = questions.filter(
        (q) => q.section === cfg.section && q.partNumber === cfg.partNumber
      );
      if (partQs.length > 0) {
        setPreviewActiveQuestionId(partQs[0].id);
      }
    }
  };

  // Single question field updater
  const handleUpdateQuestion = (qId: number, field: keyof Question, value: unknown) => {
    setPreviewActiveQuestionId(qId);
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, [field]: value } : q))
    );
  };

  // Option text updater
  const handleUpdateOption = (qId: number, optId: string, newText: string) => {
    setPreviewActiveQuestionId(qId);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId || !q.options) return q;
        return {
          ...q,
          options: q.options.map((opt) =>
            opt.id === optId ? { ...opt, text: newText } : opt
          ),
        };
      })
    );
  };

  // StimulusCard updater for Reading Part 1 (Questions 27-31)
  const handleUpdateStimulusCard = (
    qId: number,
    patch: Partial<StimulusCard>
  ) => {
    setPreviewActiveQuestionId(qId);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const existingCard: StimulusCard = q.stimulusCard || {
          id: String(q.id),
          title: `Notice #${q.id}`,
          content: '',
        };
        return {
          ...q,
          stimulusCard: {
            ...existingCard,
            ...patch,
          },
        };
      })
    );
  };

  // Shared Notes Title updater for Listening Part 3 (Questions 14-20)
  const handleUpdatePart3ShowTitle = (newTitle: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.section === 'LISTENING' && q.partNumber === 3) {
          return {
            ...q,
            notesData: {
              showTitle: newTitle,
              itemNumber: q.notesData?.itemNumber || q.id,
              label: q.notesData?.label || q.prompt || '',
            },
          };
        }
        return q;
      })
    );
  };

  // Individual Notes Label updater for Listening Part 3 (Questions 14-20)
  const handleUpdateNotesLabel = (qId: number, newLabel: string) => {
    setPreviewActiveQuestionId(qId);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        return {
          ...q,
          prompt: newLabel,
          notesData: {
            showTitle: q.notesData?.showTitle || 'Notes Completion',
            itemNumber: q.notesData?.itemNumber || q.id,
            label: newLabel,
          },
        };
      })
    );
  };

  // Shared Gapped Article updater for Reading Part 2 (Questions 32-37)
  const handleUpdateGappedArticle = (
    updater: (
      current: NonNullable<Question['gappedArticle']>
    ) => NonNullable<Question['gappedArticle']>
  ) => {
    setQuestions((prev) => {
      const sampleQ = prev.find((q) => q.section === 'READING' && q.partNumber === 2);
      const baseArticle: NonNullable<Question['gappedArticle']> = sampleQ?.gappedArticle || {
        title: 'Reading Part 2 Article',
        paragraphs: [
          { text: 'Paragraph before gap 32...' },
          { text: '', gapId: 32 },
          { text: 'Paragraph before gap 33...' },
          { text: '', gapId: 33 },
          { text: 'Paragraph before gap 34...' },
          { text: '', gapId: 34 },
          { text: 'Paragraph before gap 35...' },
          { text: '', gapId: 35 },
          { text: 'Paragraph before gap 36...' },
          { text: '', gapId: 36 },
          { text: 'Paragraph before gap 37...' },
          { text: '', gapId: 37 },
        ],
      };
      const updatedArticle = updater(baseArticle);
      return prev.map((q) =>
        q.section === 'READING' && q.partNumber === 2
          ? { ...q, gappedArticle: updatedArticle }
          : q
      );
    });
  };

  // Shared Gapped Options (A-G) updater for Reading Part 2 (Questions 32-37)
  const handleUpdateGappedOption = (optId: string, newText: string) => {
    setQuestions((prev) => {
      const sampleQ = prev.find((q) => q.section === 'READING' && q.partNumber === 2);
      const baseOpts = sampleQ?.gappedOptions || [
        { id: 'A', text: '' },
        { id: 'B', text: '' },
        { id: 'C', text: '' },
        { id: 'D', text: '' },
        { id: 'E', text: '' },
        { id: 'F', text: '' },
        { id: 'G', text: '' },
      ];
      const updatedOpts = baseOpts.map((o) => (o.id === optId ? { ...o, text: newText } : o));
      return prev.map((q) =>
        q.section === 'READING' && q.partNumber === 2
          ? { ...q, gappedOptions: updatedOpts }
          : q
      );
    });
  };

  // Shared 4 Texts (A-D) updater for Reading Part 3 (Questions 38-44)
  const handleUpdateMultiTextCard = (
    cardId: 'A' | 'B' | 'C' | 'D',
    patch: Partial<StimulusCard>
  ) => {
    setQuestions((prev) => {
      const sampleQ = prev.find((q) => q.section === 'READING' && q.partNumber === 3);
      const baseCards: StimulusCard[] = sampleQ?.multiTextCards || [
        { id: 'A', title: 'Text A', content: '' },
        { id: 'B', title: 'Text B', content: '' },
        { id: 'C', title: 'Text C', content: '' },
        { id: 'D', title: 'Text D', content: '' },
      ];
      const updatedCards = baseCards.map((c) =>
        c.id === cardId ? { ...c, ...patch } : c
      );
      return prev.map((q) =>
        q.section === 'READING' && q.partNumber === 3
          ? { ...q, multiTextCards: updatedCards }
          : q
      );
    });
  };

  // Shared Reading Passage updater for ANY VSTEP Reading Passage (Passage 1-4)
  const handleUpdateReadingPassageArticle = (
    targetPartNum: 1 | 2 | 3 | 4,
    patch: Partial<NonNullable<Question['readingArticle']>>,
    translationText?: string
  ) => {
    setQuestions((prev) => {
      const sampleQ = prev.find((q) => q.section === 'READING' && q.partNumber === targetPartNum);
      const baseArticle: NonNullable<Question['readingArticle']> = sampleQ?.readingArticle || {
        title: `PASSAGE ${targetPartNum} – QUESTIONS ${(targetPartNum - 1) * 10 + 1}–${targetPartNum * 10}`,
        paragraphs: ['Paragraph 1...'],
      };
      const updatedArticle = {
        ...baseArticle,
        ...patch,
      };
      const updatedPassageStr = (updatedArticle.paragraphs || []).join('\n\n');
      const parsedTranslation =
        translationText !== undefined
          ? translationText.trim()
            ? {
                title: updatedArticle.title || `Bản dịch Bài đọc ${targetPartNum}`,
                paragraphs: translationText
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean),
              }
            : undefined
          : undefined;

      return prev.map((q) =>
        q.section === 'READING' && q.partNumber === targetPartNum
          ? {
              ...q,
              readingArticle: updatedArticle,
              readingPassage: updatedPassageStr,
              ...(translationText !== undefined
                ? { readingArticleTranslation: parsedTranslation }
                : {}),
            }
          : q
      );
    });
  };

  // Smart Quick-Fill Parser for the current Part
  const handleApplyQuickFill = () => {
    if (!quickFillText.trim()) return;
    const lines = quickFillText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Parse numbered questions or sequential prompts/options (A, B, C, D)
    let updatedCount = 0;
    const partIds = currentQuestions.map((q) => q.id);

    setQuestions((prev) => {
      const clone: Question[] = JSON.parse(JSON.stringify(prev));
      let qPointer = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const optionMatch = line.match(/^([A-D])[.)\s:-]+(.+)$/i);
        if (optionMatch && qPointer > 0) {
          const targetId = partIds[qPointer - 1];
          const targetQ = clone.find((item) => item.id === targetId);
          if (targetQ && targetQ.options) {
            const letter = optionMatch[1].toUpperCase();
            targetQ.options = targetQ.options.map((o) =>
              o.id === letter ? { ...o, text: optionMatch[2].trim() } : o
            );
          }
        } else if (qPointer < partIds.length) {
          const cleanPrompt = line.replace(/^(Question\s*\d+|Câu\s*\d+|\d+)[.)\s:-]+/i, '').trim();
          const targetId = partIds[qPointer];
          const targetQ = clone.find((item) => item.id === targetId);
          if (targetQ && cleanPrompt) {
            targetQ.prompt = cleanPrompt;
            qPointer++;
            updatedCount++;
          }
        }
      }
      return clone;
    });

    setQuickFillNotice(`Đã tự động điền ${updatedCount} câu hỏi (A, B, C, D) vào ${activePartConfig.shortName}!`);
    setTimeout(() => setQuickFillNotice(null), 3500);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so uploading another or the same file always triggers onChange
    e.target.value = '';
    if (!file) return;

    const immediateBlobUrl = URL.createObjectURL(file);
    setAudioFileName(file.name);
    setResolvedSinglePlayableUrl(immediateBlobUrl);
    setIsUploadingAudio(true);

    try {
      const persisted = await persistExamAudioFile(file, testId, 'full');
      setAudioUrl(persisted.persistentUrl);
      setResolvedSinglePlayableUrl(persisted.playableUrl || immediateBlobUrl);
      patchTestAudioMetadataEverywhere({
        testId,
        partScope: 'full',
        audioUrl: persisted.persistentUrl,
        fileName: file.name,
        audioMode: 'single',
      }).catch(() => {});
      setQuickFillNotice(
        `Đã nạp file nghe "${file.name}" và đang tự động đồng bộ lên Cloud cho mọi học sinh!`
      );
      setTimeout(() => setQuickFillNotice(null), 3500);
    } catch (err) {
      console.warn('Fallback to object URL:', err);
      setAudioUrl(immediateBlobUrl);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handlePartAudioUpload = async (
    partNum: 1 | 2 | 3 | 4,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const key = `part${partNum}` as keyof PartAudioMap;
    const immediateBlobUrl = URL.createObjectURL(file);
    setPartAudioFileNames((prev) => ({ ...prev, [key]: file.name }));
    setResolvedPartPlayableUrls((prev) => ({ ...prev, [key]: immediateBlobUrl }));
    setIsUploadingAudio(true);

    try {
      const persisted = await persistExamAudioFile(file, testId, partNum);
      setPartAudioUrls((prev) => ({ ...prev, [key]: persisted.persistentUrl }));
      setResolvedPartPlayableUrls((prev) => ({
        ...prev,
        [key]: persisted.playableUrl || immediateBlobUrl,
      }));
      patchTestAudioMetadataEverywhere({
        testId,
        partScope: partNum,
        audioUrl: persisted.persistentUrl,
        fileName: file.name,
        audioMode: 'per_part',
      }).catch(() => {});
      setQuickFillNotice(
        `Đã nạp MP3 Part ${partNum}: "${file.name}" và đang tự động đồng bộ lên Cloud cho mọi học sinh!`
      );
      setTimeout(() => setQuickFillNotice(null), 3500);
    } catch (err) {
      console.warn('Fallback to object URL:', err);
      setPartAudioUrls((prev) => ({ ...prev, [key]: immediateBlobUrl }));
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handlePartAudioUrlChange = (partNum: 1 | 2 | 3 | 4, url: string) => {
    const key = `part${partNum}` as keyof PartAudioMap;
    setPartAudioUrls((prev) => ({ ...prev, [key]: url }));
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      patchTestAudioMetadataEverywhere({
        testId,
        partScope: partNum,
        audioUrl: trimmed,
        audioMode: 'per_part',
      }).catch(() => {});
    }
  };

  const handleSaveCustomTag = async () => {
    const clean = customTagInput.trim();
    if (!clean) return;
    if (editingOldTag && editingOldTag !== clean) {
      const next = await renameCustomExamTag(editingOldTag, clean);
      setCustomTagsList(next);
    } else {
      const next = await addCustomExamTag(clean);
      setCustomTagsList(next);
    }
    setCategoryTag(clean);
    if (clean === 'Đề Nháp') {
      setExamStatus('draft');
    }
    setIsCustomTagEditorOpen(false);
    setEditingOldTag(null);
    setCustomTagInput('');
  };

  const handleUpdateWritingTask = (
    partNum: 1 | 2,
    patch: Partial<WritingTask>
  ) => {
    setWritingTasks((prev) =>
      prev.map((t) => (t.partNumber === partNum ? { ...t, ...patch } : t))
    );
  };

  const handleUpdateSpeakingTask = (
    partNum: 1 | 2 | 3,
    patch: Partial<SpeakingTask>
  ) => {
    setSpeakingTasks((prev) =>
      prev.map((t) => (t.partNumber === partNum ? { ...t, ...patch } : t))
    );
  };

  const handleLoadSampleDemo = () => {
    setQuestions(JSON.parse(JSON.stringify(TEST_1_QUESTIONS)));
    setWritingTasks(JSON.parse(JSON.stringify(SAMPLE_B1_WRITING_TASKS)));
    setSpeakingTasks(JSON.parse(JSON.stringify(SAMPLE_VSTEP_SPEAKING_TASKS)));
    if (!testTitle.trim()) {
      setTestTitle('VSTEP B1–B2–C1 Demo Test (Mẫu 4 Kỹ năng)');
    }
    setQuickFillNotice('Đã nạp dữ liệu mẫu chuẩn VSTEP 4 Kỹ năng (75 câu + 2 Writing + 3 Speaking Mind-map)!');
    setTimeout(() => setQuickFillNotice(null), 3500);
  };

  const handleImportJson = (data: {
    title: string;
    subtitle: string;
    durationMinutes: number;
    audioUrl?: string;
    audioFileName?: string;
    audioMode?: 'single' | 'per_part';
    partAudioUrls?: PartAudioMap;
    questions: Question[];
    writingTasks?: WritingTask[];
    speakingTasks?: SpeakingTask[];
    vocabulary?: VocabItem[];
  }) => {
    setTestTitle(data.title);
    if (data.subtitle) setTestSubtitle(data.subtitle);
    if (data.durationMinutes) setDurationMinutes(data.durationMinutes);
    if (data.audioUrl) setAudioUrl(data.audioUrl);
    if (data.audioFileName) setAudioFileName(data.audioFileName);
    if (data.audioMode) setAudioMode(data.audioMode);
    if (data.partAudioUrls && Object.keys(data.partAudioUrls).length > 0) {
      setPartAudioUrls(data.partAudioUrls);
    }
    if (data.questions && data.questions.length > 0) {
      setQuestions(data.questions);
    }
    if (data.writingTasks && data.writingTasks.length > 0) {
      setWritingTasks(data.writingTasks);
    }
    if (data.speakingTasks && data.speakingTasks.length > 0) {
      setSpeakingTasks(data.speakingTasks);
    }
    if (data.vocabulary && data.vocabulary.length > 0) {
      setAttachedVocabulary(data.vocabulary);
    }
    setQuickFillNotice(
      `Đã nhập thành công bộ đề 4 Kỹ năng "${data.title}" (${data.questions.length} câu hỏi, ${
        data.writingTasks?.length || 2
      } bài Writing & ${data.speakingTasks?.length || 3} Part Speaking)!`
    );
    setTimeout(() => setQuickFillNotice(null), 4000);
  };

  // Save exam data:
  // - exitAfterSave = false ("Lưu Bản Nháp / Sao lưu"): saves with status='draft' and stays in builder
  // - exitAfterSave = true ("Xuất Bản Đề Thi"): saves with status='published' and exits to test list
  const handleSaveExam = async (
    exitAfterSave: boolean = true,
    explicitStatus?: 'draft' | 'published'
  ) => {
    const targetStatus: 'draft' | 'published' =
      explicitStatus || (exitAfterSave ? 'published' : 'draft');

    const effectiveTitle =
      testTitle.trim() ||
      (!exitAfterSave ? `Đề nháp đang soạn (${new Date().toLocaleDateString('vi-VN')})` : '');

    if (!effectiveTitle) {
      setSaveError('Vui lòng nhập tên bộ đề thi ở mục Cấu hình trước khi xuất bản.');
      setIsMetaExpanded(true);
      return;
    }

    if (!testTitle.trim() && !exitAfterSave) {
      setTestTitle(effectiveTitle);
    }

    const resolvedCategoryTag =
      targetStatus === 'draft'
        ? categoryTag || 'Đề Nháp'
        : categoryTag === 'Đề Nháp'
        ? 'Đề thi minh họa'
        : categoryTag || 'Đề thi minh họa';

    setExamStatus(targetStatus);
    setCategoryTag(resolvedCategoryTag);

    setIsSaving(true);
    setSavingMode(exitAfterSave ? 'publish' : 'in_place');
    setSaveError(null);
    if (exitAfterSave) {
      setSaveSuccess(false);
    } else {
      setInPlaceSavedMessage(null);
    }

    const trimmedAudioUrl = audioUrl.trim();
    const trimmedAudioFileName = audioFileName.trim();
    const nowTs = Date.now();

    // 1. Instant local IndexedDB preparation (<50ms, zero network blocking)
    const localPrep = await prepareLocalTestAudioBeforeSave({
      testId,
      audioMode,
      audioUrl: trimmedAudioUrl,
      audioFileName: trimmedAudioFileName,
      partAudioUrls,
      partAudioFileNames,
    });

    const finalAudioUrl = (localPrep.audioUrl ?? trimmedAudioUrl).trim();
    const finalPartAudioUrls = localPrep.partAudioUrls || partAudioUrls;

    if (finalAudioUrl !== trimmedAudioUrl) {
      setAudioUrl(finalAudioUrl);
    }
    setPartAudioUrls(finalPartAudioUrls);

    const payload: TestMetadata & {
      isCustom: boolean;
      questions: Question[];
      createdAt: number;
      updatedAt: number;
      creatorId: string;
      creatorEmail: string;
    } = {
      id: testId,
      title: effectiveTitle,
      subtitle:
        testSubtitle.trim() ||
        'Đề thi VSTEP B1–B2–C1 4 Kỹ năng (Listening, Reading, Writing & Speaking)',
      description:
        testSubtitle.trim() ||
        'Đề thi VSTEP B1–B2–C1 4 Kỹ năng (Listening, Reading, Writing & Speaking)',
      totalQuestions: questions.length,
      durationMinutes: Number(durationMinutes) || 172,
      isAvailable: true,
      isCustom: true,
      status: targetStatus,
      categoryTag: resolvedCategoryTag,
      createdAt: initialTest?.createdAt || nowTs,
      updatedAt: nowTs,
      creatorId: initialTest?.creatorId || currentUser?.uid || 'anonymous-admin',
      creatorEmail: initialTest?.creatorEmail || currentUser?.email || 'admin@vstep.vn',
      audioMode,
      ...(finalAudioUrl ? { audioUrl: finalAudioUrl } : {}),
      ...(trimmedAudioFileName ? { audioFileName: trimmedAudioFileName } : {}),
      partAudioUrls: finalPartAudioUrls,
      partAudioFileNames,
      questions,
      writingTasks,
      speakingTasks,
      ...(attachedVocabulary.length > 0 ? { vocabulary: attachedVocabulary } : {}),
    };

    const timeStr = new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    try {
      // 2. Save exam metadata FIRST to Server (/api/tests) + Firestore (~0.2 - 1s)
      const { syncedToCloud } = await saveTestToFirestore(payload);
      setLastSavedAtText(syncedToCloud ? `Đã đồng bộ Cloud ${timeStr}` : `Sao lưu máy ${timeStr}`);
      if (onSaveProgress) {
        onSaveProgress(payload);
      }

      // 3. Kick off non-blocking background MP3 Cloud sync with live % progress bar
      if (localPrep.localItemsToSync.length > 0) {
        startBackgroundTestAudioCloudSync(effectiveTitle, localPrep.localItemsToSync);
      } else if (localPrep.unreadableSlotLabels.length > 0) {
        notifyAudioCloudSyncBanner({
          active: true,
          status: 'error',
          testTitle: effectiveTitle,
          currentFileName: localPrep.unreadableSlotLabels.join(', '),
          percent: 0,
          completedFiles: 0,
          totalFiles: localPrep.unreadableSlotLabels.length,
          message: `Bấm "Chọn lại MP3" cho ${localPrep.unreadableSlotLabels.join(', ')} (file phiên cũ đã hết hạn đọc)`,
        });
        setIsMetaExpanded(true);
      }

      if (!syncedToCloud && currentUser) {
        setSaveError(
          'Cảnh báo: Đề thi mới chỉ lưu tạm trên trình duyệt này, chưa đồng bộ lên Cloud. Vui lòng kiểm tra kết nối mạng.'
        );
      }

      if (exitAfterSave) {
        setSaveSuccess(true);
        setTimeout(() => {
          onTestSaved(payload);
        }, 350);
      } else {
        setInPlaceSavedMessage(
          syncedToCloud
            ? `Đã lưu bộ đề (${resolvedCategoryTag}) lên Cloud lúc ${timeStr}!`
            : `Đã lưu tạm Bản Nháp trên trình duyệt này lúc ${timeStr} (Chưa đồng bộ Cloud).`
        );
        setTimeout(() => setInPlaceSavedMessage(null), 4000);
      }
    } catch (err: unknown) {
      console.error('Error saving to Firestore:', err);
      setLastSavedAtText(`Sao lưu máy ${timeStr}`);
      if (onSaveProgress) {
        onSaveProgress(payload);
      }

      if (!currentUser) {
        if (exitAfterSave) {
          setSaveSuccess(true);
          setTimeout(() => {
            onTestSaved(payload);
          }, 700);
        } else {
          setInPlaceSavedMessage(`Đã sao lưu Bản Nháp vào bộ nhớ trình duyệt lúc ${timeStr}!`);
          setTimeout(() => setInPlaceSavedMessage(null), 3500);
        }
      } else {
        const msg = err instanceof Error ? err.message : 'Lỗi khi lưu đề thi vào Cloud Firestore.';
        setSaveError(msg);
      }
    } finally {
      setIsSaving(false);
      setSavingMode(null);
    }
  };

  const firstQuestionOfPart = currentQuestions[0];
  const activeWritingTask = useMemo(() => {
    if (activePartConfig.section !== 'WRITING') return null;
    return (
      writingTasks.find((t) => t.partNumber === activePartConfig.partNumber) ||
      writingTasks[activePartConfig.partNumber - 1] ||
      createBlankWritingTasksTemplate()[activePartConfig.partNumber - 1]
    );
  }, [activePartConfig, writingTasks]);

  const activeSpeakingTask = useMemo(() => {
    if (activePartConfig.section !== 'SPEAKING') return null;
    const pNum = activePartConfig.partNumber as 1 | 2 | 3;
    return (
      speakingTasks.find((t) => t.partNumber === pNum) ||
      speakingTasks[pNum - 1] ||
      createBlankSpeakingTasksTemplate()[pNum - 1]
    );
  }, [activePartConfig, speakingTasks]);

  useEffect(() => {
    let cancelled = false;
    if (!audioUrl.trim()) {
      setResolvedSinglePlayableUrl('');
      return;
    }
    resolvePlayableAudioUrl(audioUrl, audioFileName).then((resolved) => {
      if (!cancelled) {
        setResolvedSinglePlayableUrl(resolved || '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [audioUrl, audioFileName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextMap: PartAudioMap = {};
      for (const pNum of [1, 2, 3, 4] as const) {
        const key = `part${pNum}` as keyof PartAudioMap;
        const raw = partAudioUrls[key] || '';
        const fName = partAudioFileNames[key];
        if (raw.trim()) {
          const resolved = await resolvePlayableAudioUrl(raw, fName);
          if (resolved) nextMap[key] = resolved;
        }
      }
      if (!cancelled) {
        setResolvedPartPlayableUrls(nextMap);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [partAudioUrls, partAudioFileNames]);

  const activePreviewAudioUrl = useMemo(() => {
    if (activePartConfig.section !== 'LISTENING') return '';
    if (audioMode === 'per_part') {
      const key = `part${activePartConfig.partNumber}` as keyof PartAudioMap;
      return resolvedPartPlayableUrls[key] || resolvedSinglePlayableUrl || '';
    }
    return resolvedSinglePlayableUrl || '';
  }, [activePartConfig, audioMode, resolvedPartPlayableUrls, resolvedSinglePlayableUrl]);

  const activePreviewAudioName = useMemo(() => {
    if (activePartConfig.section !== 'LISTENING') return '';
    if (audioMode === 'per_part') {
      const key = `part${activePartConfig.partNumber}` as keyof PartAudioMap;
      return (
        partAudioFileNames[key] ||
        `Listening Part ${activePartConfig.partNumber} Audio`
      );
    }
    return audioFileName || 'Full Listening Audio Track';
  }, [activePartConfig, audioMode, partAudioFileNames, audioFileName]);

  const isDraftMode = examStatus === 'draft' || categoryTag === 'Đề Nháp';

  return (
    <div className="force-light min-h-screen bg-slate-100 flex flex-col text-slate-800">
      {/* Top Studio Bar with Explicit Draft vs Published Visual Distinction */}
      <header
        className={`sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b-2 px-4 sm:px-6 py-3 shadow-xs ${
          isDraftMode
            ? 'border-amber-400 bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-white'
            : isEditing
            ? 'border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-white'
            : 'border-lime-300 bg-gradient-to-r from-lime-50/80 via-white to-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại</span>
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {isDraftMode ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-2xs">
                  <Edit3 className="h-3 w-3" /> CHẾ ĐỘ BẢN NHÁP (CHƯA XUẤT BẢN)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-2xs">
                  <CheckCircle2 className="h-3 w-3" /> ĐÃ XUẤT BẢN CHÍNH THỨC
                </span>
              )}

              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-extrabold text-indigo-800">
                <Tag className="h-3 w-3 text-indigo-600" />
                <span>Nhãn: {categoryTag}</span>
              </span>

              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                {testTitle ? testTitle : 'Đề Thi VSTEP Mới (Đang soạn Bản Nháp)'}
              </h2>
              <span className="rounded-lg bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                {completedQuestionCount}/75 câu · {writingTasks.filter((w) => (w.stimulusText || '').trim().length > 0).length}/2 Writing · {speakingTasks.length}/3 Speaking
              </span>
              {attachedVocabulary.length > 0 && (
                <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                  {attachedVocabulary.length} từ vựng
                </span>
              )}
              {totalImageCount > 0 && (
                <span className="rounded-lg bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> {totalImageCount} ảnh
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isEditing && (
            <button
              type="button"
              onClick={handleLoadSampleDemo}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer"
              title="Nạp dữ liệu mẫu Test 1 nếu bạn muốn xem ví dụ tham khảo"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-600" />
              <span>Nạp đề mẫu Demo</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMetaExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <Music className="h-3.5 w-3.5 text-sky-600" />
            <span>Cấu hình Tên, Nhãn & Audio ({audioMode === 'per_part' ? '3 File Part' : '1 File chung'})</span>
            {isMetaExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAiPdfModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-[#58CC02] hover:bg-[#46a302] px-3.5 py-1.5 text-xs font-black text-white shadow-xs border-b-2 border-[#3c8c02] active:translate-y-0.5 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Tải PDF (Gemini AI)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAiGenError(null);
              setIsAiPartGenOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-purple-600 hover:bg-purple-700 px-3.5 py-1.5 text-xs font-black text-white shadow-xs border-b-2 border-purple-800 active:translate-y-0.5 transition-all cursor-pointer"
            title="Dùng Gemini AI tự động biên soạn mới 1 Bài đọc hiểu 10 câu hoặc Đề Viết/Nói theo chủ đề bất kỳ"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>AI Sinh Đề Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-lime-500 transition-colors cursor-pointer"
            title="Nhập đề từ cấu trúc JSON"
          >
            <FileCode2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Nhập JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-sky-500 transition-colors cursor-pointer"
            title="Tải file JSON sao lưu bộ đề này về máy"
          >
            <Download className="h-3.5 w-3.5 text-sky-600" />
            <span>Xuất JSON</span>
          </button>

          {/* Automated Exam Quality Validator Button */}
          <button
            type="button"
            onClick={() => setIsValidatorOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-2xl border-2 px-3 py-1.5 text-xs font-black transition-all cursor-pointer tabular-nums ${
              validationReport.errorCount > 0
                ? 'border-rose-400 bg-rose-50 text-rose-800 hover:bg-rose-100'
                : validationReport.warningCount > 0
                ? 'border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
            title="Tự động rà soát thiếu đáp án, câu hỏi trống, thiếu bài đọc, transcript hoặc audio"
          >
            {validationReport.errorCount > 0 ? (
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            )}
            <span>
              Kiểm lỗi đề (
              {validationReport.errorCount > 0
                ? `${validationReport.errorCount} lỗi`
                : validationReport.warningCount > 0
                ? `${validationReport.warningCount} lưu ý`
                : 'Chuẩn 100%'}
              )
            </span>
          </button>

          {/* Save Draft in-place Button */}
          <button
            type="button"
            disabled={isSaving || isUploadingAudio}
            onClick={() => handleSaveExam(false, 'draft')}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-amber-500 bg-amber-50 hover:bg-amber-100 px-3.5 py-2 text-xs font-black text-amber-900 shadow-2xs active:translate-y-0.5 transition-all disabled:opacity-50 cursor-pointer"
            title="Lưu bộ đề ở chế độ Bản Nháp trên hệ thống (chỉ Giáo viên & Admin thấy)"
          >
            <Save className="h-4 w-4 text-amber-700" />
            <span>
              {isSaving && savingMode === 'in_place'
                ? 'Đang lưu nháp...'
                : lastSavedAtText
                ? `Lưu Bản Nháp (${lastSavedAtText})`
                : 'Lưu Bản Nháp'}
            </span>
          </button>

          {/* Official Publish Button */}
          <button
            type="button"
            disabled={isSaving || isUploadingAudio}
            onClick={() => handleSaveExam(true, 'published')}
            className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-black text-white shadow-md border-b-4 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 cursor-pointer bg-[#58CC02] hover:bg-[#46a302] border-[#3c8c02]"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {isSaving && savingMode === 'publish'
                ? 'Đang xuất bản...'
                : 'Xuất Bản Chính Thức'}
            </span>
          </button>
        </div>
      </header>

      {/* Save Status Banner */}
      {inPlaceSavedMessage && (
        <div className="bg-amber-600 text-white px-6 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="h-4 w-4" />
          <span>{inPlaceSavedMessage} (Chỉ Giáo viên và Admin nhìn thấy đề Bản Nháp này)</span>
        </div>
      )}
      {saveSuccess && (
        <div className="bg-emerald-500 text-white px-6 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Đã lưu và xuất bản bộ đề thi chính thức thành công! Đang chuyển về kho đề...</span>
        </div>
      )}
      {saveError && (
        <div className="bg-rose-500 text-white px-6 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Automated Exam Quality Validator Drawer */}
      {isValidatorOpen && (
        <div className="border-b-2 border-slate-300 bg-white px-4 sm:px-6 py-4 shadow-sm">
          <div className="mx-auto max-w-[1600px] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#58CC02]" />
                <span className="text-xs sm:text-sm font-black text-slate-900">
                  Bộ Kiểm Định Chất Lượng Đề Thi Tự Động (75 Câu Hỏi + 2 Writing + 3 Speaking + Audio)
                </span>
                <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-[11px] font-black text-rose-800 tabular-nums">
                  {validationReport.errorCount} lỗi thiếu dữ liệu
                </span>
                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800 tabular-nums">
                  {validationReport.warningCount} lưu ý bổ sung
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsValidatorOpen(false)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Đóng bảng kiểm lỗi
              </button>
            </div>

            {validationReport.issues.length === 0 ? (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Tuyệt vời! Toàn bộ 75 câu hỏi, 4 bài đọc, Audio Script và đề Writing/Speaking đều đã đầy đủ dữ liệu chuẩn VSTEP.
                </span>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pr-1">
                {validationReport.issues.slice(0, 60).map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => {
                      handleSelectPartTab(issue.partTabId);
                      if (issue.questionId) {
                        setPreviewActiveQuestionId(issue.questionId);
                        setTimeout(() => {
                          const el = document.getElementById(`builder-q-${issue.questionId}`);
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 80);
                      }
                    }}
                    className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-left text-xs transition-all cursor-pointer ${
                      issue.severity === 'error'
                        ? 'border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-950'
                        : 'border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-950'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-black">{issue.label}</div>
                      <div className="text-[11px] font-medium opacity-85 truncate">
                        {issue.detail}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-[10px] font-black border border-slate-200 text-slate-700">
                      Tới sửa →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Exam Metadata, Category Tag & Audio Setup Drawer */}
      {isMetaExpanded && (
        <div className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4 shadow-2xs space-y-4">
          <div className="mx-auto max-w-[1600px] grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
            <div className="lg:col-span-5">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tên bộ đề thi <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Nhập tên bộ đề thi mới (VD: LanguageCert B1 Practice Test 7)..."
                className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-900 outline-hidden focus:border-[#58CC02] focus:bg-white"
              />
            </div>

            <div className="lg:col-span-5">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Mô tả phụ / Ghi chú bộ đề
              </label>
              <input
                type="text"
                value={testSubtitle}
                onChange={(e) => setTestSubtitle(e.target.value)}
                placeholder="VD: Đề luyện thi chuẩn cấu trúc PeopleCert (Listening, Reading & Writing)"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Thời gian chuẩn (Phút)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
              />
            </div>
          </div>

          {/* Teacher Category Tagging Bar ("Đề thi minh họa", "Đề Nháp", "Đề thi thật", + "Mục khác") */}
          <div className="mx-auto max-w-[1600px] rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-indigo-600" />
                <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                  Phân Loại Nhãn Đề Thi (Hiển thị trên thanh lọc Trang chủ & Kho đề)
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">
                Đề gắn nhãn <strong className="text-amber-700">Đề Nháp</strong> hoặc đang ở chế độ Bản Nháp sẽ chỉ hiển thị với Giáo viên & Admin
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {DEFAULT_EXAM_CATEGORIES.map((builtinTag) => {
                const isSelected = categoryTag === builtinTag;
                const isDraftTag = builtinTag === 'Đề Nháp';
                return (
                  <button
                    key={builtinTag}
                    type="button"
                    onClick={() => {
                      setCategoryTag(builtinTag);
                      if (isDraftTag) {
                        setExamStatus('draft');
                      }
                    }}
                    className={`rounded-xl px-3.5 py-2 text-xs font-black transition-all cursor-pointer border-2 flex items-center gap-1.5 ${
                      isSelected
                        ? isDraftTag
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>{builtinTag}</span>
                  </button>
                );
              })}

              {/* Teacher Custom Tags */}
              {customTagsList.map((cTag) => {
                const isSelected = categoryTag === cTag;
                return (
                  <div
                    key={cTag}
                    className={`inline-flex items-center rounded-xl border-2 overflow-hidden transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                        : 'bg-white text-slate-700 border-purple-200 hover:border-purple-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCategoryTag(cTag)}
                      className="px-3 py-2 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      <span>{cTag}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOldTag(cTag);
                        setCustomTagInput(cTag);
                        setIsCustomTagEditorOpen(true);
                      }}
                      className={`px-2 py-2 border-l text-xs cursor-pointer ${
                        isSelected
                          ? 'border-purple-500 hover:bg-purple-700 text-white'
                          : 'border-purple-100 hover:bg-purple-50 text-purple-600'
                      }`}
                      title={`Đổi tên mục phân loại "${cTag}"`}
                    >
                      <Edit3 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}

              {/* "+ Mục khác" Button */}
              <button
                type="button"
                onClick={() => {
                  setEditingOldTag(null);
                  setCustomTagInput('');
                  setIsCustomTagEditorOpen((prev) => !prev);
                }}
                className="rounded-xl px-3.5 py-2 text-xs font-black border-2 border-dashed border-indigo-400 bg-white hover:bg-indigo-50 text-indigo-700 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Mục khác (Tự đặt nhãn mới)</span>
              </button>
            </div>

            {isCustomTagEditorOpen && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-200/60">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveCustomTag();
                    }
                  }}
                  placeholder={
                    editingOldTag
                      ? `Đổi tên mục "${editingOldTag}" thành...`
                      : 'Nhập tên mục phân loại mới (VD: Đề Thi Thử Tháng 11, Đề Trọng Điểm)...'
                  }
                  maxLength={40}
                  className="flex-1 min-w-[240px] rounded-xl border-2 border-indigo-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 outline-hidden focus:border-indigo-600"
                />
                <button
                  type="button"
                  onClick={handleSaveCustomTag}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-1.5 text-xs font-black text-white shadow-2xs cursor-pointer"
                >
                  {editingOldTag ? 'Lưu tên mới' : 'Tạo & Gán nhãn này'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomTagEditorOpen(false);
                    setEditingOldTag(null);
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>

          {/* Audio Configuration Section: 1 File vs 4 Separate Part Files */}
          <div className="mx-auto max-w-[1600px] rounded-2xl border-2 border-sky-200 bg-sky-50/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Headphones className="h-4 w-4 text-sky-600" />
                <span className="text-xs font-black text-sky-950 uppercase tracking-wide">
                  Cấu Hình File Nghe (Firebase Cloud Storage: {STORAGE_AUDIO_FOLDER}/)
                </span>
                <span className="rounded-lg bg-sky-100 border border-sky-300 px-2 py-0.5 text-[10px] font-black text-sky-900">
                  Bucket: {FIREBASE_STORAGE_BUCKET} · Site: {APP_SITE_ID}
                </span>
                {isUploadingAudio && (
                  <span className="text-[11px] font-bold text-amber-700 animate-pulse">
                    Đang đồng bộ hóa file âm thanh...
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Storage Connection Diagnostic Button */}
                <button
                  type="button"
                  disabled={isTestingStorage}
                  onClick={handleTestStorageConnection}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-500 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-900 shadow-2xs transition-all disabled:opacity-60 cursor-pointer"
                  title={`Ghi thử file ${STORAGE_AUDIO_FOLDER}/_connection_test.txt lên bucket ${FIREBASE_STORAGE_BUCKET} và lấy link CDN`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>
                    {isTestingStorage
                      ? 'Đang kiểm tra Storage...'
                      : 'Kiểm tra kết nối Storage'}
                  </span>
                </button>

                {/* Segmented Option Toggle */}
                <div className="inline-flex rounded-xl bg-white p-1 border border-sky-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setAudioMode('single')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      audioMode === 'single'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    1 File nghe cho toàn bài (Part 1–3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudioMode('per_part')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      audioMode === 'per_part'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Mỗi Part 1 file nghe riêng biệt (3 Files VSTEP)
                  </button>
                </div>
              </div>
            </div>

            {/* Storage Connection Diagnostic Result Banner */}
            {storageTestResult && (
              <div
                className={`rounded-xl border-2 p-3 text-xs ${
                  storageTestResult.ok
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                    : 'border-amber-400 bg-amber-50 text-amber-950'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    {storageTestResult.ok ? (
                      <>
                        <div className="font-black text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>
                            Kết nối Firebase Cloud Storage thành công! ({storageTestResult.testedAt})
                          </span>
                        </div>
                        <div className="text-[11px] font-medium text-emerald-900">
                          Đã ghi thử file{' '}
                          <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold border border-emerald-200">
                            {storageTestResult.storagePath}
                          </code>{' '}
                          trên bucket{' '}
                          <code className="rounded bg-white px-1.5 py-0.5 font-mono font-bold border border-emerald-200">
                            {storageTestResult.bucket}
                          </code>{' '}
                          (Tách biệt hoàn toàn với TOEIC &amp; LanguageCert).
                        </div>
                        {storageTestResult.downloadUrl && (
                          <div className="text-[11px] font-mono truncate text-emerald-700">
                            CDN URL:{' '}
                            <a
                              href={storageTestResult.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline font-bold hover:text-emerald-900"
                            >
                              {storageTestResult.downloadUrl}
                            </a>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="font-black text-amber-900 flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>
                            Chưa ghi được vào {storageTestResult.storagePath} ({storageTestResult.errorCode}) — Hệ thống đang tự động dùng chế độ Fallback (Server/Firestore Chunks)
                          </span>
                        </div>
                        <div className="text-[11px] text-amber-800">
                          Chi tiết: {storageTestResult.errorMessage}
                        </div>
                        <div className="text-[11px] text-slate-700 bg-white rounded-lg p-2 border border-amber-200 font-mono leading-relaxed">
                          Để mở quyền đọc/ghi riêng cho thư mục VSTEP trên Firebase Console &rarr; Storage &rarr; Rules (bucket{' '}
                          <strong>{storageTestResult.bucket}</strong>), hãy thêm nhánh:
                          <br />
                          <code>
                            match /vstep/exam_audio/&#123;allPaths=**&#125; &#123; allow read, write: if true; &#125;
                          </code>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStorageTestResult(null)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 shrink-0 cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}

            {audioMode === 'single' ? (
              <div className="flex flex-col gap-2.5 bg-white rounded-xl p-3 border border-sky-200">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[11px] font-bold mb-1 ${
                        audioFileName && !resolvedSinglePlayableUrl
                          ? 'text-amber-700'
                          : 'text-sky-900'
                      }`}
                    >
                      {audioFileName
                        ? resolvedSinglePlayableUrl
                          ? `✓ Đã nạp & đồng bộ file nghe: ${audioFileName}`
                          : `⚠️ File "${audioFileName}" từ phiên cũ cần bấm "Chọn lại MP3" bên phải để tải lên Server`
                        : 'Đường dẫn MP3 hoặc tải file nghe cho toàn bộ 35 câu Listening (Part 1–3):'}
                    </div>
                    <input
                      type="text"
                      value={audioUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAudioUrl(val);
                        const trimmed = val.trim();
                        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                          patchTestAudioMetadataEverywhere({
                            testId,
                            partScope: 'full',
                            audioUrl: trimmed,
                            audioMode: 'single',
                          }).catch(() => {});
                        }
                      }}
                      placeholder="Dán link MP3 (Google Drive / Cloud / URL) hoặc bấm Chọn MP3..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono text-slate-700 outline-hidden focus:border-sky-500 focus:bg-white"
                    />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-2xs cursor-pointer ${
                      audioFileName && !resolvedSinglePlayableUrl
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-sky-600 hover:bg-sky-700'
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    <span>
                      {audioFileName
                        ? resolvedSinglePlayableUrl
                          ? 'Đổi File MP3 Khác'
                          : 'Chọn lại MP3'
                        : 'Chọn File MP3 Chung'}
                    </span>
                  </button>
                </div>
                {resolvedSinglePlayableUrl && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-sky-100">
                    <span className="text-[11px] font-bold text-emerald-700 truncate">
                      Nghe kiểm tra ngay ({audioFileName || 'Audio toàn bài'}):
                    </span>
                    <audio
                      key={resolvedSinglePlayableUrl}
                      controls
                      src={resolvedSinglePlayableUrl}
                      className="h-8 w-full max-w-md"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {([1, 2, 3] as const).map((partNum) => {
                  const key = `part${partNum}` as keyof PartAudioMap;
                  const pUrl = partAudioUrls[key] || '';
                  const pName = partAudioFileNames[key] || '';
                  const pPlayable = resolvedPartPlayableUrls[key] || '';
                  const isExpiredLocalSlot = Boolean((pName || pUrl) && !pPlayable);
                  const partMeta: Record<number, { title: string; range: string; desc: string }> = {
                    1: {
                      title: 'Listening Part 1',
                      range: 'Câu 1 – 8',
                      desc: '8 thông báo & hướng dẫn ngắn',
                    },
                    2: {
                      title: 'Listening Part 2',
                      range: 'Câu 9 – 20',
                      desc: '3 đoạn hội thoại (mỗi đoạn 4 câu)',
                    },
                    3: {
                      title: 'Listening Part 3',
                      range: 'Câu 21 – 35',
                      desc: '3 bài thuyết trình / bài giảng (mỗi bài 5 câu)',
                    },
                  };
                  const meta = partMeta[partNum];
                  return (
                    <div
                      key={partNum}
                      className={`rounded-2xl bg-white border-2 p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs transition-all ${
                        isExpiredLocalSlot
                          ? 'border-amber-400 hover:border-amber-500'
                          : 'border-sky-200 hover:border-sky-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-black text-sky-900">
                            <Music className="h-3.5 w-3.5 text-sky-600" />
                            <span>{meta.title}</span>
                          </span>
                          <span className="text-[11px] font-black text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                            {meta.range}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {meta.desc}
                        </div>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-sky-100">
                        {pName && pPlayable && (
                          <div className="text-[11px] font-bold text-emerald-700 truncate bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            ✓ Đã sẵn sàng: {pName}
                          </div>
                        )}
                        {isExpiredLocalSlot && (
                          <div
                            className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-300 leading-snug"
                            title="File MP3 từ phiên làm việc trước chưa được đẩy lên Server. Vui lòng bấm nút Chọn lại MP3 bên dưới để tải lên 100%."
                          >
                            ⚠️ {pName || `Part ${partNum}`} (Phiên cũ hết hạn đọc file — Hãy bấm{' '}
                            <strong>Chọn lại MP3</strong> bên dưới)
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pUrl}
                            onChange={(e) => handlePartAudioUrlChange(partNum, e.target.value)}
                            placeholder={`Link MP3 Part ${partNum}...`}
                            className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-mono text-slate-700 outline-hidden focus:border-sky-500 focus:bg-white"
                          />
                          <input
                            ref={(el) => {
                              partAudioInputRefs.current[partNum] = el;
                            }}
                            type="file"
                            accept="audio/*"
                            onChange={(e) => handlePartAudioUpload(partNum, e)}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => partAudioInputRefs.current[partNum]?.click()}
                            className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black text-white cursor-pointer shrink-0 shadow-2xs ${
                              isExpiredLocalSlot
                                ? 'bg-amber-600 hover:bg-amber-700'
                                : 'bg-sky-600 hover:bg-sky-700'
                            }`}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>
                              {isExpiredLocalSlot
                                ? 'Chọn lại MP3'
                                : pName
                                ? 'Đổi MP3'
                                : 'Up MP3'}
                            </span>
                          </button>
                        </div>
                        {pPlayable && (
                          <audio
                            key={pPlayable}
                            controls
                            src={pPlayable}
                            className="h-7 w-full mt-1"
                          />
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

      {/* 12-Part Navigation Bar with Live Status (Listening 1-3, Reading 1-4, Writing 1-2, Speaking 1-3) */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 shadow-2xs">
        <div className="mx-auto max-w-[1600px] flex items-center gap-2 overflow-x-auto no-scrollbar">
          {PART_CONFIGS.map((tab) => {
            const isWritingTab = tab.section === 'WRITING';
            const isSpeakingTab = tab.section === 'SPEAKING';
            const partQs = questions.filter(
              (q) => q.section === tab.section && q.partNumber === tab.partNumber
            );
            const hasImages =
              !isWritingTab &&
              !isSpeakingTab &&
              partQs.some(
                (q) =>
                  q.imageUrl ||
                  q.stimulusCard?.imageUrl ||
                  q.gappedArticle?.imageUrl ||
                  q.readingArticle?.imageUrl ||
                  q.multiTextCards?.some((c) => c.imageUrl)
              );
            const isSelected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectPartTab(tab.id)}
                className={`shrink-0 flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
                  isSelected
                    ? isWritingTab
                      ? 'bg-purple-600 text-white shadow-sm border-b-2 border-purple-800'
                      : isSpeakingTab
                      ? 'bg-rose-600 text-white shadow-sm border-b-2 border-rose-800'
                      : 'bg-[#58CC02] text-white shadow-sm border-b-2 border-[#3c8c02]'
                    : isWritingTab
                    ? 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
                    : isSpeakingTab
                    ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {isWritingTab && <PenTool className="h-3.5 w-3.5" />}
                {isSpeakingTab && <Mic className="h-3.5 w-3.5" />}
                <span>{tab.shortName}</span>
                {hasImages && (
                  <ImageIcon
                    className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-lime-600'}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* SPLIT-SCREEN WORKSPACE: Left Editor (50%) | Right Live Authentic Exam Preview (50%) */}
      <div className="mx-auto w-full max-w-[1640px] flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN (6 COLS): STRUCTURED PART & QUESTION EDITOR             */}
        {/* =================================================================== */}
        <div className="lg:col-span-6 space-y-5">
          {/* Active Part Structural Mapping Card & Smart Quick-Fill */}
          <div className="rounded-3xl border-2 border-lime-300 bg-gradient-to-br from-lime-50 to-white p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#58CC02] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  <Layers className="h-3 w-3" /> Tương quan 1:1 với Giao diện Thi
                </span>
                <h3 className="mt-1.5 text-sm sm:text-base font-black text-slate-900">
                  {activePartConfig.fullName}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-600 leading-relaxed">
                  {activePartConfig.mappingGuide}
                </p>
              </div>

              {activePartConfig.section !== 'WRITING' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsQuickFillOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white border-2 border-lime-400 px-3 py-1.5 text-xs font-black text-[#46a302] hover:bg-lime-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>{isQuickFillOpen ? 'Đóng Điền Nhanh' : '⚡ Dán Nhanh Văn Bản'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmClearScope(confirmClearScope === 'part' ? null : 'part')
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-amber-400 hover:text-amber-700 transition-colors cursor-pointer"
                    title="Xóa nội dung của Part này để nhập từ đầu"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Làm trống Part này</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmClearScope(confirmClearScope === 'all' ? null : 'all')
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:border-rose-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Xóa trắng cả 52 câu (giữ nguyên khung đề)"
                  >
                    <span>Làm trống cả đề</span>
                  </button>
                </div>
              )}
            </div>

            {confirmClearScope && (
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-amber-950">
                  {confirmClearScope === 'part'
                    ? `Bạn muốn xóa trắng nội dung của ${activePartConfig.shortName} để nhập mới?`
                    : 'Bạn muốn xóa trắng toàn bộ 52 câu hỏi (giữ nguyên khung 8 Part)?'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmClearScope(null)}
                    className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={
                      confirmClearScope === 'part'
                        ? handleClearCurrentPart
                        : handleClearEntireTest
                    }
                    className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1 font-black text-white cursor-pointer"
                  >
                    Xác nhận làm trống
                  </button>
                </div>
              </div>
            )}

            {quickFillNotice && !isQuickFillOpen && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span>{quickFillNotice}</span>
              </div>
            )}

            {isQuickFillOpen && activePartConfig.section !== 'WRITING' && (
              <div className="mt-3 rounded-2xl border border-lime-300 bg-white p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Dán nội dung câu hỏi / phương án A, B, C hoặc đoạn văn cho {activePartConfig.shortName}:
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={quickFillText}
                  onChange={(e) => setQuickFillText(e.target.value)}
                  placeholder={
                    activeTab === 8
                      ? 'Dòng 1: Tiêu đề bài báo\n\nĐoạn văn 1...\n\nĐoạn văn 2...'
                      : '1. Câu hỏi hoặc tình huống mở đầu\nA. Lựa chọn A\nB. Lựa chọn B\nC. Lựa chọn C'
                  }
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-mono text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
                />
                <div className="flex items-center justify-between gap-2">
                  {quickFillNotice ? (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> {quickFillNotice}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500">
                      Tự động bóc tách vào các ô nhập liệu và cập nhật màn hình thi bên phải.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleApplyQuickFill}
                    className="rounded-xl bg-[#58CC02] hover:bg-[#46a302] px-4 py-1.5 text-xs font-black text-white shadow-xs cursor-pointer"
                  >
                    Áp dụng ngay
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* WRITING TASK EDITOR (WHEN TAB 9 OR 10 IS SELECTED)              */}
          {/* =============================================================== */}
          {activePartConfig.section === 'WRITING' && activeWritingTask && (
            <div className="rounded-3xl border-2 border-purple-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <PenTool className="h-5 w-5 text-purple-600" />
                  <h4 className="text-base font-black text-slate-900">
                    Soạn Đề Thi {activeWritingTask.title}
                  </h4>
                </div>
                <span className="rounded-lg bg-purple-100 px-2.5 py-1 text-xs font-black text-purple-800">
                  {activeWritingTask.minWords} – {activeWritingTask.maxWords} words
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tiêu đề phần viết:
                  </label>
                  <input
                    type="text"
                    value={activeWritingTask.title}
                    onChange={(e) =>
                      handleUpdateWritingTask(activeWritingTask.partNumber, {
                        title: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-hidden focus:border-purple-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số từ tối thiểu (Min Words):
                  </label>
                  <input
                    type="number"
                    value={activeWritingTask.minWords}
                    onChange={(e) =>
                      handleUpdateWritingTask(activeWritingTask.partNumber, {
                        minWords: Number(e.target.value) || 70,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-hidden focus:border-purple-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Số từ tối đa (Max Words):
                  </label>
                  <input
                    type="number"
                    value={activeWritingTask.maxWords}
                    onChange={(e) =>
                      handleUpdateWritingTask(activeWritingTask.partNumber, {
                        maxWords: Number(e.target.value) || 100,
                      })
                    }
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 outline-hidden focus:border-purple-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Câu lệnh hướng dẫn (Instruction):
                </label>
                <textarea
                  rows={2}
                  value={activeWritingTask.instruction}
                  onChange={(e) =>
                    handleUpdateWritingTask(activeWritingTask.partNumber, {
                      instruction: e.target.value,
                    })
                  }
                  placeholder="VD: Read the advertisement below and write an email..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-800 outline-hidden focus:border-purple-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Văn bản tình huống / Đề bài gốc (Stimulus Text / Email / Notice):
                </label>
                <textarea
                  rows={5}
                  value={activeWritingTask.stimulusText}
                  onChange={(e) =>
                    handleUpdateWritingTask(activeWritingTask.partNumber, {
                      stimulusText: e.target.value,
                    })
                  }
                  placeholder="Nhập nội dung bức thư, thông báo hoặc tình huống đề bài tại đây..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-800 outline-hidden focus:border-purple-500 focus:bg-white"
                />
              </div>

              <ImageUploaderCard
                label={`Ảnh đề bài / Thông báo minh họa cho Writing Part ${activeWritingTask.partNumber} (Tùy chọn)`}
                subLabel="Tải ảnh chụp đề bài từ máy, bấm Ctrl+V để dán hoặc nhập URL ảnh"
                imageUrl={activeWritingTask.imageUrl}
                caption={activeWritingTask.imageCaption}
                onImageChange={(url) =>
                  handleUpdateWritingTask(activeWritingTask.partNumber, { imageUrl: url })
                }
                onCaptionChange={(cap) =>
                  handleUpdateWritingTask(activeWritingTask.partNumber, { imageCaption: cap })
                }
              />

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-800">
                    Các ý bắt buộc cần triển khai (Bullet Points):
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateWritingTask(activeWritingTask.partNumber, {
                        bulletPoints: [...(activeWritingTask.bulletPoints || []), ''],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-bold text-purple-700 hover:bg-purple-100 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm ý
                  </button>
                </div>

                {(activeWritingTask.bulletPoints || []).map((bp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-black text-purple-700">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={bp}
                      onChange={(e) => {
                        const updated = [...activeWritingTask.bulletPoints];
                        updated[idx] = e.target.value;
                        handleUpdateWritingTask(activeWritingTask.partNumber, {
                          bulletPoints: updated,
                        });
                      }}
                      placeholder={`Nhập yêu cầu số ${idx + 1}...`}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 outline-hidden focus:border-purple-500 focus:bg-white"
                    />
                    {activeWritingTask.bulletPoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = activeWritingTask.bulletPoints.filter(
                            (_, i) => i !== idx
                          );
                          handleUpdateWritingTask(activeWritingTask.partNumber, {
                            bulletPoints: updated,
                          });
                        }}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-700 mb-1">
                  Bài viết mẫu chuẩn B2–C1 (Sample Answer — Hiển thị khi học sinh Xem lời giải):
                </label>
                <textarea
                  rows={6}
                  value={activeWritingTask.sampleAnswer || ''}
                  onChange={(e) =>
                    handleUpdateWritingTask(activeWritingTask.partNumber, {
                      sampleAnswer: e.target.value,
                    })
                  }
                  placeholder="Nhập bài viết mẫu chuẩn B2/C1 để học sinh đối chiếu sau khi nộp bài..."
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 text-xs leading-relaxed text-slate-800 outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* SPEAKING TASK EDITOR (WHEN TAB 11, 12 OR 13 IS SELECTED)        */}
          {/* =============================================================== */}
          {activePartConfig.section === 'SPEAKING' && activeSpeakingTask && (
            <div className="rounded-3xl border-2 border-rose-200 bg-white p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-rose-600" />
                  <h4 className="text-base font-black text-slate-900">
                    Soạn Đề Thi {activeSpeakingTask.title} ({activeSpeakingTask.subtitle})
                  </h4>
                </div>
                <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-800">
                  {activeSpeakingTask.durationLabel}
                </span>
              </div>

              {/* PART 1: 2 Topic Clusters */}
              {activeSpeakingTask.partNumber === 1 && (
                <div className="space-y-4">
                  {(activeSpeakingTask.topicClusters || []).map((cluster, cIdx) => (
                    <div
                      key={cIdx}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                    >
                      <div>
                        <label className="block text-xs font-black text-slate-800 mb-1">
                          Chủ đề #{cIdx + 1} (Topic Header — VD: Let&apos;s talk about your free time activities.):
                        </label>
                        <input
                          type="text"
                          value={cluster.topicTitle}
                          onChange={(e) => {
                            const nextClusters = [...(activeSpeakingTask.topicClusters || [])];
                            nextClusters[cIdx] = { ...cluster, topicTitle: e.target.value };
                            handleUpdateSpeakingTask(1, { topicClusters: nextClusters });
                          }}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-hidden focus:border-rose-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700">
                          Các câu hỏi trong chủ đề #{cIdx + 1} (Mỗi dòng 1 câu hỏi):
                        </label>
                        <textarea
                          rows={4}
                          value={(cluster.questions || []).join('\n')}
                          onChange={(e) => {
                            const nextClusters = [...(activeSpeakingTask.topicClusters || [])];
                            nextClusters[cIdx] = {
                              ...cluster,
                              questions: e.target.value.split('\n'),
                            };
                            handleUpdateSpeakingTask(1, { topicClusters: nextClusters });
                          }}
                          placeholder="What do you often do in your free time?&#10;Do you watch TV?..."
                          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-800 outline-hidden focus:border-rose-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PART 2: Situation & 3 Options */}
              {activeSpeakingTask.partNumber === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Tình huống thảo luận (Situation — Hiển thị đúng định dạng đề gốc VSTEP):
                    </label>
                    <textarea
                      rows={4}
                      value={activeSpeakingTask.situation || ''}
                      onChange={(e) =>
                        handleUpdateSpeakingTask(2, { situation: e.target.value })
                      }
                      placeholder="VD: A group of people is planning a trip from Hanoi to Sapa. Three means of transport are suggested: by train, by plane, and by coach. Which means of transport do you think is the best choice?"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-900 outline-hidden focus:border-rose-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      3 Phương án gợi ý (Options — Mỗi dòng 1 lựa chọn):
                    </label>
                    <textarea
                      rows={3}
                      value={(activeSpeakingTask.options || []).join('\n')}
                      onChange={(e) =>
                        handleUpdateSpeakingTask(2, {
                          options: e.target.value.split('\n'),
                        })
                      }
                      placeholder="by train&#10;by plane&#10;by coach"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-800 outline-hidden focus:border-rose-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              {/* PART 3: Topic + Mind-Map Diagram Nodes + Follow-up Questions */}
              {activeSpeakingTask.partNumber === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-800 mb-1">
                      Chủ đề phát triển (Topic Statement — VD: Travelling has a lot of benefits):
                    </label>
                    <input
                      type="text"
                      value={activeSpeakingTask.topicStatement || ''}
                      onChange={(e) =>
                        handleUpdateSpeakingTask(3, { topicStatement: e.target.value })
                      }
                      placeholder="VD: Travelling has a lot of benefits"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-900 outline-hidden focus:border-rose-500 focus:bg-white"
                    />
                  </div>

                  {/* Mind-Map Editor Box */}
                  <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-rose-900">
                        Sơ Đồ Tư Duy (Mind-Map Diagram — Giống 100% Đề Thi Gốc)
                      </span>
                      <span className="text-[11px] font-bold text-rose-700">
                        Tự động vẽ khung nối bên màn hình thi
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ô Trung Tâm (Central Node — In đậm ở giữa sơ đồ):
                      </label>
                      <input
                        type="text"
                        value={activeSpeakingTask.mindMap?.centerTopic || ''}
                        onChange={(e) =>
                          handleUpdateSpeakingTask(3, {
                            mindMap: {
                              centerTopic: e.target.value,
                              nodes: activeSpeakingTask.mindMap?.nodes || ['', '', ''],
                            },
                          })
                        }
                        placeholder="VD: Travelling"
                        className="w-full rounded-xl border-2 border-rose-300 bg-white px-3.5 py-2 text-xs font-black text-slate-900 outline-hidden focus:border-rose-600"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { idx: 0, label: 'Ô Nhánh Trái (Left Node)' },
                        { idx: 1, label: 'Ô Nhánh Phải (Right Node)' },
                        { idx: 2, label: 'Ô Nhánh Dưới (Bottom Node)' },
                      ].map((branch) => (
                        <div key={branch.idx}>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            {branch.label}:
                          </label>
                          <input
                            type="text"
                            value={activeSpeakingTask.mindMap?.nodes?.[branch.idx] || ''}
                            onChange={(e) => {
                              const baseNodes = [
                                ...(activeSpeakingTask.mindMap?.nodes || ['', '', '']),
                              ];
                              while (baseNodes.length < 3) baseNodes.push('');
                              baseNodes[branch.idx] = e.target.value;
                              handleUpdateSpeakingTask(3, {
                                mindMap: {
                                  centerTopic:
                                    activeSpeakingTask.mindMap?.centerTopic || 'Topic',
                                  nodes: baseNodes,
                                },
                              });
                            }}
                            placeholder={`Ý nhánh ${branch.idx + 1}...`}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-hidden focus:border-rose-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      3 Câu hỏi thảo luận mở rộng bên dưới sơ đồ (Follow-up Questions — Mỗi dòng 1 câu):
                    </label>
                    <textarea
                      rows={4}
                      value={(activeSpeakingTask.followUpQuestions || []).join('\n')}
                      onChange={(e) =>
                        handleUpdateSpeakingTask(3, {
                          followUpQuestions: e.target.value.split('\n'),
                        })
                      }
                      placeholder="What are the differences in the way to travel between your generation and your grandparents?..."
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800 outline-hidden focus:border-rose-500 focus:bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-emerald-700 mb-1">
                  Bài nói mẫu chuẩn B2–C1 (Sample Answer — Hiển thị khi học viên luyện tập / xem kết quả):
                </label>
                <textarea
                  rows={6}
                  value={activeSpeakingTask.sampleAnswer || ''}
                  onChange={(e) =>
                    handleUpdateSpeakingTask(activeSpeakingTask.partNumber, {
                      sampleAnswer: e.target.value,
                    })
                  }
                  placeholder="Nhập bài nói mẫu chuẩn B2/C1 cho phần này..."
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 text-xs leading-relaxed text-slate-800 outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* VSTEP READING PASSAGE 1–4 UNIFIED EDITOR WITH RICH-TEXT TOOLBAR */}
          {/* =============================================================== */}
          {activePartConfig.section === 'READING' && firstQuestionOfPart && (
            <div className="rounded-3xl border-2 border-emerald-300 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#58CC02]" />
                  <h4 className="text-sm font-black text-slate-900">
                    Văn Bản Bài Đọc VSTEP — Reading Passage {activePartConfig.partNumber} (Câu {(activePartConfig.partNumber - 1) * 10 + 1}–{activePartConfig.partNumber * 10})
                  </h4>
                </div>
                <span className="rounded-lg bg-lime-100 px-2.5 py-0.5 text-[11px] font-bold text-lime-800">
                  Hiển thị ở Cột Trái (Chia đoạn tự động)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tiêu đề bài đọc (Passage Title):
                </label>
                <input
                  type="text"
                  value={firstQuestionOfPart.readingArticle?.title || ''}
                  onChange={(e) =>
                    handleUpdateReadingPassageArticle(activePartConfig.partNumber, {
                      title: e.target.value,
                    })
                  }
                  placeholder={`VD: PASSAGE ${activePartConfig.partNumber} – QUESTIONS ${(activePartConfig.partNumber - 1) * 10 + 1}–${activePartConfig.partNumber * 10}`}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-black text-slate-900 outline-hidden focus:border-[#58CC02] focus:bg-white"
                />
              </div>

              <ImageUploaderCard
                label={`Hình ảnh minh họa cho Reading Passage ${activePartConfig.partNumber} (Tùy chọn)`}
                subLabel="Tải ảnh, dán Ctrl+V hoặc nhập link ảnh"
                imageUrl={firstQuestionOfPart.readingArticle?.imageUrl}
                caption={firstQuestionOfPart.readingArticle?.imageCaption}
                onImageChange={(url) =>
                  handleUpdateReadingPassageArticle(activePartConfig.partNumber, { imageUrl: url })
                }
                onCaptionChange={(cap) =>
                  handleUpdateReadingPassageArticle(activePartConfig.partNumber, { imageCaption: cap })
                }
              />

              {/* Rich-Text Helper Toolbar for VSTEP Underlined Words & Insertion Squares */}
              <div className="rounded-2xl bg-amber-50/80 border border-amber-200 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-amber-950 uppercase tracking-wide">
                    Công cụ định dạng đặc thù VSTEP Reading (Click để chèn vào cuối bài đọc):
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = (firstQuestionOfPart.readingArticle?.paragraphs || []).join('\n\n');
                        const next = `${cur} <u><b>từ_gạch_chân</b></u>`;
                        handleUpdateReadingPassageArticle(activePartConfig.partNumber, {
                          paragraphs: next.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
                        });
                      }}
                      className="rounded-lg bg-white border border-amber-300 px-2.5 py-1 text-[11px] font-black text-slate-800 hover:bg-amber-100 cursor-pointer shadow-2xs"
                    >
                      + <u><b>Gạch chân &amp; In đậm</b></u> (&lt;u&gt;&lt;b&gt;...&lt;/b&gt;&lt;/u&gt;)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = (firstQuestionOfPart.readingArticle?.paragraphs || []).join('\n\n');
                        const next = `${cur} <mark>từ_highlight</mark>`;
                        handleUpdateReadingPassageArticle(activePartConfig.partNumber, {
                          paragraphs: next.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
                        });
                      }}
                      className="rounded-lg bg-yellow-100 border border-amber-300 px-2.5 py-1 text-[11px] font-black text-amber-950 hover:bg-yellow-200 cursor-pointer shadow-2xs"
                    >
                      + Highlight vàng (&lt;mark&gt;...&lt;/mark&gt;)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = (firstQuestionOfPart.readingArticle?.paragraphs || []).join('\n\n');
                        const next = `${cur} [A] ... [B] ... [C] ... [D]`;
                        handleUpdateReadingPassageArticle(activePartConfig.partNumber, {
                          paragraphs: next.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
                        });
                      }}
                      className="rounded-lg bg-slate-900 text-white px-2.5 py-1 text-[11px] font-mono font-black hover:bg-slate-700 cursor-pointer shadow-2xs"
                    >
                      + Ô chèn câu [A] [B] [C] [D]
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Mẹo: Bọc từ vựng hoặc đại từ quy chiếu trong cặp thẻ <code className="font-mono font-bold">&lt;u&gt;&lt;b&gt;word&lt;/b&gt;&lt;/u&gt;</code> hoặc <code className="font-mono font-bold">__word__</code> để hiển thị chữ gạch chân &amp; in đậm giống hệt đề thi VSTEP thật. Mỗi đoạn văn cách nhau 1 dòng trống (Enter 2 lần) sẽ tự động đánh nhãn <strong>[Đoạn 1], [Đoạn 2]...</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung toàn bài đọc (Mỗi đoạn cách nhau 1 dòng trống — hỗ trợ &lt;u&gt;&lt;b&gt;từ&lt;/b&gt;&lt;/u&gt; và [A] [B] [C] [D]):
                </label>
                <textarea
                  rows={10}
                  value={(firstQuestionOfPart.readingArticle?.paragraphs || []).join('\n\n')}
                  onChange={(e) =>
                    handleUpdateReadingPassageArticle(activePartConfig.partNumber, {
                      paragraphs: e.target.value
                        .split(/\n\s*\n/)
                        .map((p) => p.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Nhập các đoạn văn của bài đọc (cách nhau 1 dòng trống)..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-700 mb-1">
                  Bản dịch tiếng Việt toàn bài đọc (Hiển thị song ngữ theo từng đoạn ở chế độ Luyện tập / Xem giải):
                </label>
                <textarea
                  rows={6}
                  value={
                    typeof firstQuestionOfPart.readingArticleTranslation === 'object' &&
                    firstQuestionOfPart.readingArticleTranslation
                      ? (firstQuestionOfPart.readingArticleTranslation.paragraphs || []).join('\n\n')
                      : typeof firstQuestionOfPart.readingArticleTranslation === 'string'
                      ? firstQuestionOfPart.readingArticleTranslation
                      : ''
                  }
                  onChange={(e) =>
                    handleUpdateReadingPassageArticle(
                      activePartConfig.partNumber,
                      {},
                      e.target.value
                    )
                  }
                  placeholder="Nhập bản dịch tiếng Việt tương ứng với từng đoạn văn (mỗi đoạn cách nhau 1 dòng trống)..."
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 text-xs leading-relaxed text-emerald-950 outline-hidden focus:border-emerald-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* INDIVIDUAL QUESTION EDITOR CARDS FOR CURRENT PART               */}
          {/* =============================================================== */}
          {activePartConfig.section !== 'WRITING' && activePartConfig.section !== 'SPEAKING' && (
            <div className="space-y-4">
              {currentQuestions.map((q) => {
                const relNum = getPartRelativeNumber(q.id, currentQuestions);
                const isFocused = previewActiveQuestionId === q.id;
                const isImagePanelOpen = !!openImagePanels[q.id] || !!q.imageUrl;
                const convBanner =
                  activePartConfig.section === 'LISTENING' && activePartConfig.partNumber === 2
                    ? q.id === 9
                      ? 'Đoạn hội thoại 1 (Conversation 1: Câu 9 – 12)'
                      : q.id === 13
                      ? 'Đoạn hội thoại 2 (Conversation 2: Câu 13 – 16)'
                      : q.id === 17
                      ? 'Đoạn hội thoại 3 (Conversation 3: Câu 17 – 20)'
                      : null
                    : activePartConfig.section === 'LISTENING' && activePartConfig.partNumber === 3
                    ? q.id === 21
                      ? 'Bài nói / Bài giảng 1 (Talk / Lecture 1: Câu 21 – 25)'
                      : q.id === 26
                      ? 'Bài nói / Bài giảng 2 (Talk / Lecture 2: Câu 26 – 30)'
                      : q.id === 31
                      ? 'Bài nói / Bài giảng 3 (Talk / Lecture 3: Câu 31 – 35)'
                      : null
                    : null;

                return (
                  <React.Fragment key={q.id}>
                    {convBanner && (
                      <div className="pt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-sky-100 border border-sky-200 px-3 py-1 text-xs font-black text-sky-900">
                          <Headphones className="h-3.5 w-3.5 text-sky-600" />
                          <span>{convBanner}</span>
                        </span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                    )}
                    <div
                      onClick={() => setPreviewActiveQuestionId(q.id)}
                      className={`rounded-3xl border-2 bg-white p-5 transition-all ${
                        isFocused
                          ? 'border-[#58CC02] shadow-md ring-2 ring-lime-100'
                          : 'border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      {/* Question Card Top Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-mono font-black transition-colors ${
                              isFocused
                                ? 'bg-[#58CC02] text-white shadow-xs'
                                : 'bg-lime-100 text-[#46a302]'
                            }`}
                          >
                            {relNum}
                          </span>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                              <span>
                                Câu {relNum} ({q.section} Part {q.partNumber} · Mã #{q.id})
                              </span>
                              {isFocused && (
                                <span className="rounded-md bg-lime-100 px-2 py-0.5 text-[10px] font-black text-[#46a302]">
                                  Đang hiển thị bên phải →
                                </span>
                              )}
                            </h4>
                          </div>
                        </div>

                        {/* Correct Answer Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Đáp án đúng:</span>
                          {q.type === 'multi_text_match' ? (
                            <select
                              value={typeof q.correctAnswer === 'string' ? q.correctAnswer : 'A'}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, 'correctAnswer', e.target.value)
                              }
                              className="rounded-xl border-2 border-[#58CC02] bg-lime-50 px-3 py-1 text-xs font-black text-lime-950 outline-hidden cursor-pointer"
                            >
                              {['A', 'B', 'C', 'D'].map((letter) => (
                                <option key={letter} value={letter}>
                                  Text {letter}
                                </option>
                              ))}
                            </select>
                          ) : q.type === 'gapped_text' ? (
                            <select
                              value={typeof q.correctAnswer === 'string' ? q.correctAnswer : 'A'}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, 'correctAnswer', e.target.value)
                              }
                              className="rounded-xl border-2 border-[#58CC02] bg-lime-50 px-3 py-1 text-xs font-black text-lime-950 outline-hidden cursor-pointer"
                            >
                              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((letter) => (
                                <option key={letter} value={letter}>
                                  Câu {letter}
                                </option>
                              ))}
                            </select>
                          ) : typeof q.correctAnswer === 'string' && q.options ? (
                            <select
                              value={q.correctAnswer}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, 'correctAnswer', e.target.value)
                              }
                              className="rounded-xl border-2 border-[#58CC02] bg-lime-50 px-3 py-1 text-xs font-black text-lime-950 outline-hidden cursor-pointer"
                            >
                              {q.options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  Phương án {opt.id}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={
                                Array.isArray(q.correctAnswer)
                                  ? q.correctAnswer.join(', ')
                                  : q.correctAnswer
                              }
                              onChange={(e) =>
                                handleUpdateQuestion(
                                  q.id,
                                  'correctAnswer',
                                  e.target.value.includes(',')
                                    ? e.target.value.split(',').map((s) => s.trim())
                                    : e.target.value
                                )
                              }
                              placeholder="Đáp án (phân cách bằng dấu phẩy)"
                              className="rounded-xl border-2 border-[#58CC02] bg-lime-50 px-3 py-1 text-xs font-black text-lime-950 outline-hidden"
                            />
                          )}
                        </div>
                      </div>

                      {/* Prompt / Question Stem */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-slate-700">
                              Nội dung câu hỏi (Prompt — hỗ trợ &lt;u&gt;&lt;b&gt;từ gạch chân&lt;/b&gt;&lt;/u&gt;):
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenImagePanels((prev) => ({
                                  ...prev,
                                  [q.id]: !prev[q.id],
                                }))
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#46a302] hover:underline cursor-pointer"
                            >
                              <ImageIcon className="h-3.5 w-3.5" />
                              <span>
                                {isImagePanelOpen ? 'Ẩn khung chèn ảnh' : '+ Chèn ảnh cho câu này'}
                              </span>
                            </button>
                          </div>

                          <input
                            type="text"
                            value={q.prompt || ''}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, 'prompt', e.target.value)
                            }
                            placeholder="Nhập câu hỏi (VD: The word <u><b>they</b></u> in paragraph 2 refers to...)..."
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
                          />
                        </div>

                        {/* Question-level Image Uploader (for non-R1 questions when toggled) */}
                        {activeTab !== 5 && isImagePanelOpen && (
                          <ImageUploaderCard
                            label={`Hình ảnh minh họa cho Câu ${relNum}`}
                            subLabel="Hỗ trợ kéo thả file, bấm Ctrl+V để dán ảnh chụp màn hình, hoặc dán URL"
                            imageUrl={q.imageUrl}
                            caption={q.imageCaption}
                            onImageChange={(url) => handleUpdateQuestion(q.id, 'imageUrl', url)}
                            onCaptionChange={(cap) => handleUpdateQuestion(q.id, 'imageCaption', cap)}
                          />
                        )}

                        {/* MCQ Options A, B, C */}
                        {q.options && q.type === 'mcq' && (
                          <div className="space-y-2">
                            <label className="block text-xs font-bold text-slate-600">
                              Các phương án lựa chọn (Click chữ cái để đặt làm đáp án đúng):
                            </label>
                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt) => {
                                const isCorrectOpt = q.correctAnswer === opt.id;
                                return (
                                  <div
                                    key={opt.id}
                                    className={`flex items-center gap-2.5 rounded-xl border-2 p-2 transition-all ${
                                      isCorrectOpt
                                        ? 'border-[#58CC02] bg-lime-50/70'
                                        : 'border-slate-200 bg-slate-50'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateQuestion(q.id, 'correctAnswer', opt.id)
                                      }
                                      title="Click để chọn làm đáp án đúng"
                                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-colors cursor-pointer ${
                                        isCorrectOpt
                                          ? 'bg-[#58CC02] text-white shadow-2xs'
                                          : 'bg-white text-slate-700 border border-slate-200 hover:border-lime-400'
                                      }`}
                                    >
                                      {opt.id}
                                    </button>
                                    <input
                                      type="text"
                                      value={opt.text}
                                      onChange={(e) =>
                                        handleUpdateOption(q.id, opt.id, e.target.value)
                                      }
                                      className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-hidden"
                                      placeholder={`Nhập nội dung phương án ${opt.id}...`}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Audio Script & Script Translation (for Listening section) */}
                        {q.section === 'LISTENING' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                Lời thoại băng nghe theo người nói A, B, C (Audio Script):
                              </label>
                              <textarea
                                rows={3}
                                value={q.audioScript || ''}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, 'audioScript', e.target.value)
                                }
                                placeholder={'A: Lời thoại người A (có thể nhiều câu)...\nB: Lời thoại người B...'}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 outline-hidden focus:border-[#58CC02] focus:bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                                Bản dịch lời thoại theo lượt A, B, C (Script Translation):
                              </label>
                              <textarea
                                rows={3}
                                value={q.audioScriptTranslation || ''}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, 'audioScriptTranslation', e.target.value)
                                }
                                placeholder={'A: Bản dịch lượt thoại A...\nB: Bản dịch lượt thoại B...'}
                                className="w-full rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-1.5 text-xs text-emerald-950 outline-hidden focus:border-emerald-500 focus:bg-white"
                              />
                            </div>
                          </div>
                        )}

                        {/* Question & Options Vietnamese Translation + Evidence Quote + Detailed Explanation */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                              Bản dịch câu hỏi &amp; đáp án A, B, C, D (Vietnamese Translation):
                            </label>
                            <textarea
                              rows={2}
                              value={q.vietnameseTranslation || ''}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, 'vietnameseTranslation', e.target.value)
                              }
                              placeholder="Dịch nghĩa câu hỏi và 4 phương án A, B, C, D..."
                              className="w-full rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-1.5 text-xs text-emerald-950 outline-hidden focus:border-emerald-500 focus:bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-amber-700 mb-1">
                              Câu bằng chứng nguyên văn (Evidence Quote — Tự động tô vàng):
                            </label>
                            <textarea
                              rows={2}
                              value={q.evidenceQuote || ''}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, 'evidenceQuote', e.target.value)
                              }
                              placeholder="Trích dẫn nguyên văn câu chứa đáp án trong Script / Bài đọc..."
                              className="w-full rounded-xl border border-amber-300 bg-amber-50/50 px-3 py-1.5 text-xs text-amber-950 font-mono outline-hidden focus:border-amber-500 focus:bg-white"
                            />
                          </div>
                        </div>

                        <div className="pt-1">
                          <label className="block text-[11px] font-bold text-sky-700 mb-1">
                            Giải thích chi tiết vì sao chọn đáp án đúng (Detailed Explanation):
                          </label>
                          <textarea
                            rows={2}
                            value={q.explanation || ''}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, 'explanation', e.target.value)
                            }
                            placeholder="Giải thích rõ tại sao đáp án này đúng dựa trên bằng chứng..."
                            className="w-full rounded-xl border border-sky-200 bg-sky-50/40 px-3 py-1.5 text-xs text-sky-950 outline-hidden focus:border-sky-500 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN (6 COLS): STICKY LIVE EXAM PREVIEW & THUMBNAIL MAP     */}
        {/* =================================================================== */}
        <div className="lg:col-span-6 lg:sticky lg:top-16 space-y-4">
          <div className="rounded-3xl border-2 border-slate-300 bg-white shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-5.5rem)]">
            {/* Top Preview Control Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#58CC02]" />
                </span>
                <Eye className="h-4 w-4 text-[#58CC02]" />
                <span className="text-xs font-black tracking-wide uppercase">
                  Giao Diện Thi Thực Tế (Live Preview)
                </span>
              </div>

              {/* Mode & Viewport Switchers */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl bg-slate-800 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('exam')}
                    className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                      previewMode === 'exam'
                        ? 'bg-[#58CC02] text-white font-black'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Thi thật
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('practice')}
                    className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                      previewMode === 'practice'
                        ? 'bg-[#58CC02] text-white font-black'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Có lời giải
                  </button>
                </div>

                <div className="flex items-center rounded-xl bg-slate-800 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('desktop')}
                    title="Xem giao diện Máy tính"
                    className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                      previewDevice === 'desktop'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice('mobile')}
                    title="Xem giao diện Điện thoại"
                    className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                      previewDevice === 'mobile'
                        ? 'bg-white text-slate-900'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Thumbnail Strip for Current Part */}
            {activePartConfig.section !== 'WRITING' && activePartConfig.section !== 'SPEAKING' && (
              <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-black uppercase text-slate-500">
                    Câu hỏi trong Part {activePartConfig.partNumber}:
                  </span>
                  {currentQuestions.map((q) => {
                    const relNum = getPartRelativeNumber(q.id, currentQuestions);
                    const isCurrent = previewActiveQuestionId === q.id;
                    const hasImg = !!(q.imageUrl || q.stimulusCard?.imageUrl);
                    const hasPrompt = !!(q.prompt && q.prompt.trim().length > 0);

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setPreviewActiveQuestionId(q.id)}
                        className={`group relative flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-mono font-black transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#58CC02] text-white shadow-xs scale-105'
                            : hasPrompt
                            ? 'bg-white text-slate-700 border border-slate-200 hover:border-lime-400'
                            : 'bg-amber-50 text-amber-800 border border-amber-300'
                        }`}
                      >
                        <span>Câu {relNum}</span>
                        {hasImg && (
                          <ImageIcon
                            className={`h-3 w-3 ${isCurrent ? 'text-white' : 'text-lime-600'}`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <span className="text-[11px] font-semibold text-slate-500 shrink-0 hidden sm:inline">
                  Đánh số theo chuẩn VSTEP Bộ GD&ĐT
                </span>
              </div>
            )}

            {/* Simulated Exam Viewport Container */}
            <div className="force-light flex-1 overflow-y-auto bg-slate-200/70 p-3 sm:p-4">
              <div
                className={`mx-auto transition-all duration-300 rounded-2xl overflow-hidden border border-slate-300 bg-[#F7F9FA] text-slate-800 shadow-inner ${
                  previewDevice === 'mobile' ? 'max-w-[390px]' : 'w-full'
                }`}
              >
                {/* Simulated ExamHeader */}
                <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="rounded-lg bg-[#58CC02] px-2 py-0.5 text-[10px] font-black text-white uppercase">
                      {activePartConfig.section}
                    </span>
                    <span className="text-xs font-black text-slate-800 truncate">
                      {testTitle || 'Đề thi VSTEP 4 Kỹ năng'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-700">
                      {activePartConfig.rangeLabel}
                    </span>
                  </div>
                </div>

                {/* Simulated Official Part Instruction Banner */}
                <div className="bg-lime-50/90 border-b border-lime-200 px-4 py-2.5 flex items-start gap-2">
                  <Volume2 className="h-4 w-4 text-[#58CC02] shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {activePartConfig.instruction}
                  </p>
                </div>

                {/* Simulated Audio Bar if Listening and audio exists */}
                {activePartConfig.section === 'LISTENING' && activePreviewAudioUrl && (
                  <div className="bg-sky-50 border-b border-sky-200 px-4 py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 truncate">
                      <Headphones className="h-4 w-4 text-sky-600 shrink-0" />
                      <span className="truncate">{activePreviewAudioName}</span>
                    </div>
                    <audio
                      key={activePreviewAudioUrl}
                      controls
                      src={activePreviewAudioUrl}
                      className="h-7 w-48 sm:w-60"
                    />
                  </div>
                )}

                {/* LIVE RENDERED QUESTION, WRITING OR SPEAKING STAGE */}
                <div className="max-h-[65vh] overflow-y-auto">
                  {activePartConfig.section === 'WRITING' ? (
                    <WritingSectionStage
                      tasks={writingTasks}
                      activeTaskIndex={activePartConfig.partNumber === 2 ? 1 : 0}
                      onTaskIndexChange={(idx) => handleSelectPartTab(idx === 1 ? 10 : 9)}
                      submission={previewWritingSubmission}
                      onChange={setPreviewWritingSubmission}
                      onProceedToReview={() => {}}
                      isReviewMode={previewMode === 'practice'}
                    />
                  ) : activePartConfig.section === 'SPEAKING' ? (
                    <SpeakingSectionStage
                      tasks={speakingTasks}
                      activePartIndex={(activePartConfig.partNumber - 1) as 0 | 1 | 2}
                      onPartIndexChange={(idx) => handleSelectPartTab(idx === 0 ? 11 : idx === 1 ? 12 : 13)}
                      submission={previewSpeakingSubmission}
                      onChange={setPreviewSpeakingSubmission}
                      onProceedToReview={() => {}}
                      isReviewMode={previewMode === 'practice'}
                    />
                  ) : (
                    <QuestionStage
                      questions={currentQuestions}
                      activeQuestionId={previewActiveQuestionId}
                      answers={previewAnswers}
                      mode={previewMode}
                      onAnswerChange={(qId, val) =>
                        setPreviewAnswers((prev) => ({ ...prev, [qId]: val }))
                      }
                      onSelectQuestion={(qId) => setPreviewActiveQuestionId(qId)}
                      onOpenZoomModal={(card) => setZoomCard(card)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Import Modal */}
      <JsonImportModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        onImport={handleImportJson}
      />

      {/* AI PDF Extraction Modal */}
      <AiPdfUploadModal
        isOpen={isAiPdfModalOpen}
        onClose={() => setIsAiPdfModalOpen(false)}
        onExamExtracted={(newTest, newQuestions) => {
          setTestTitle(newTest.title);
          if (newTest.subtitle) setTestSubtitle(newTest.subtitle);
          if (newQuestions && newQuestions.length > 0) {
            setQuestions(newQuestions);
          }
          if (newTest.writingTasks && newTest.writingTasks.length >= 2) {
            setWritingTasks(newTest.writingTasks);
          }
        }}
      />

      {/* Image / Stimulus Zoom Modal for Preview */}
      <ImageZoomModal card={zoomCard} onClose={() => setZoomCard(null)} />

      {/* AI Exam Part Generator Modal */}
      {isAiPartGenOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white border-2 border-purple-200 border-b-4 border-b-purple-400 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Wand2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black">
                    AI Tự Động Sinh Đề Thi VSTEP Theo Chủ Đề
                  </h3>
                  <p className="text-[11px] font-semibold text-purple-100">
                    Biên soạn mới Bài đọc 10 câu A–D (kèm bản dịch &amp; giải thích) hoặc Đề Writing / Speaking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isGeneratingAiPart && setIsAiPartGenOpen(false)}
                className="rounded-xl bg-white/15 hover:bg-white/25 px-2.5 py-1 text-xs font-black cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Target Skill Type */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-2">
                  1. Chọn Phần Đề Thi Muốn AI Biên Soạn
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'READING_PASSAGE', label: '📖 Bài Đọc (10 câu)' },
                    { id: 'WRITING_TASK', label: '✍️ Đề Viết (Task 1/2)' },
                    { id: 'SPEAKING_PART', label: '🎙️ Đề Nói (Part 1/2/3)' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setAiGenTargetType(
                          item.id as 'READING_PASSAGE' | 'WRITING_TASK' | 'SPEAKING_PART'
                        );
                        setAiGenPartNum(1);
                      }}
                      className={`rounded-2xl border-2 p-2.5 text-xs font-black transition-all cursor-pointer ${
                        aiGenTargetType === item.id
                          ? 'border-purple-600 bg-purple-50 text-purple-900 shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Part Number & Target Band */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    2. Chọn Vị Trí Part Nhận Đề
                  </label>
                  <select
                    value={aiGenPartNum}
                    onChange={(e) => setAiGenPartNum(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-hidden focus:border-purple-500"
                  >
                    {aiGenTargetType === 'READING_PASSAGE' && (
                      <>
                        <option value={1}>Reading Passage 1 (Câu 1–10)</option>
                        <option value={2}>Reading Passage 2 (Câu 11–20)</option>
                        <option value={3}>Reading Passage 3 (Câu 21–30)</option>
                        <option value={4}>Reading Passage 4 (Câu 31–40)</option>
                      </>
                    )}
                    {aiGenTargetType === 'WRITING_TASK' && (
                      <>
                        <option value={1}>Writing Task 1 (Viết Thư / Email ≥ 120 từ)</option>
                        <option value={2}>Writing Task 2 (Viết Luận Essay ≥ 250 từ)</option>
                      </>
                    )}
                    {aiGenTargetType === 'SPEAKING_PART' && (
                      <>
                        <option value={1}>Speaking Part 1 (Social Interaction)</option>
                        <option value={2}>Speaking Part 2 (Solution Discussion)</option>
                        <option value={3}>Speaking Part 3 (Topic Mind-map)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">
                    3. Độ Khó Chuẩn Khung VSTEP
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['B1', 'B2', 'C1'] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setAiGenBand(b)}
                        className={`rounded-xl border-2 py-2 text-xs font-black cursor-pointer ${
                          aiGenBand === b
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Band {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Topic Input & Presets */}
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  4. Chủ Đề Muốn Biên Soạn (Tiếng Anh hoặc Tiếng Việt)
                </label>
                <input
                  type="text"
                  value={aiGenTopic}
                  onChange={(e) => setAiGenTopic(e.target.value)}
                  placeholder="VD: Renewable Energy, Remote Work, Preserving Cultural Heritage..."
                  className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-hidden focus:border-purple-600 focus:bg-white"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {[
                    'Artificial Intelligence in Education',
                    'Green Tourism & Environment',
                    'Work-Life Balance & Remote Work',
                    'Preserving Traditional Culture',
                    'Public Transport in Big Cities',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAiGenTopic(preset)}
                      className="rounded-lg bg-slate-100 hover:bg-purple-50 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-purple-700 cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              {aiGenError && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700">
                  {aiGenError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isGeneratingAiPart}
                  onClick={() => setIsAiPartGenOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isGeneratingAiPart}
                  onClick={handleGenerateAiExamPart}
                  className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 hover:bg-purple-700 px-5 py-2.5 text-xs font-black text-white shadow-md border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Wand2 className={`h-4 w-4 ${isGeneratingAiPart ? 'animate-spin' : ''}`} />
                  <span>
                    {isGeneratingAiPart
                      ? 'AI đang biên soạn đề & đáp án (10-15s)...'
                      : 'Tự Động Sinh Đề & Điền Vào Builder'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Non-blocking Background Audio Cloud Sync Progress Bar */}
      <AudioCloudSyncBanner />
    </div>
  );
};
