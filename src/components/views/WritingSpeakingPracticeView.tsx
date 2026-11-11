import React, { useState, useRef } from 'react';
import {
  PenTool,
  Mic,
  Play,
  BookOpen,
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  BookmarkPlus,
  Volume2,
  Award,
  Layers,
  Send,
  Square,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { TestMetadata, ExamSection } from '../../types/exam';
import { SAMPLE_B1_WRITING_TASKS, WritingTask } from '../../types/writing';
import { SAMPLE_VSTEP_SPEAKING_TASKS, SpeakingTask } from '../../types/speaking';
import { examAudioManager } from '../../utils/audioManager';
import { QuickSaveVocabModal, QuickSaveVocabPayload } from '../QuickSaveVocabModal';
import { GlobalSelectionDictionaryPopover } from '../GlobalSelectionDictionaryPopover';
import { recordStudyActivity } from '../../services/streakService';
import { useAuth } from '../../context/AuthContext';

interface WritingSpeakingPracticeViewProps {
  tests: TestMetadata[];
  onStartTest: (testId: string, initialSection?: ExamSection, initialPart?: 1 | 2 | 3 | 4) => void;
  onSelectMode: (mode: 'exam' | 'practice') => void;
}

const WRITING_BOOST_PHRASES = [
  {
    phrase: 'I am writing this letter in response to your email regarding...',
    meaningVi: 'Tôi viết bức thư này để phản hồi email của bạn liên quan đến...',
    tag: 'Task 1 · Mở thư trang trọng / bán trang trọng',
  },
  {
    phrase: 'I would really appreciate it if you could provide further details on...',
    meaningVi: 'Tôi sẽ rất cảm kích nếu bạn có thể cung cấp thêm thông tin chi tiết về...',
    tag: 'Task 1 · Hỏi thông tin lịch sự (B2)',
  },
  {
    phrase: 'In recent years, there has been a growing debate over whether...',
    meaningVi: 'Trong những năm gần đây, ngày càng có nhiều cuộc tranh luận xoay quanh việc liệu...',
    tag: 'Task 2 · Mở bài Essay học thuật (B2–C1)',
  },
  {
    phrase: 'On the one hand, proponents argue that... On the other hand, critics point out that...',
    meaningVi: 'Một mặt, những người ủng hộ lập luận rằng... Mặt khác, giới phê bình chỉ ra rằng...',
    tag: 'Task 2 · Đối sánh 2 chiều (Discussion Essay)',
  },
  {
    phrase: 'Taking everything into consideration, I firmly believe that the benefits outweigh the drawbacks.',
    meaningVi: 'Xét trên mọi khía cạnh, tôi hoàn toàn tin rằng lợi ích vượt trội hơn hẳn những bất cập.',
    tag: 'Task 2 · Kết bài khẳng định quan điểm',
  },
];

const SPEAKING_BOOST_PHRASES = [
  {
    phrase: 'Well, to be honest, when it comes to this topic, the first thing that springs to mind is...',
    meaningVi: 'Thật lòng mà nói, khi nhắc đến chủ đề này, điều đầu tiên nảy ra trong đầu tôi là...',
    tag: 'Part 1 · Mở đầu phản xạ tự nhiên',
  },
  {
    phrase: 'Considering the three options given, I strongly believe that the optimal choice would be...',
    meaningVi: 'Xét cả ba phương án được đưa ra, tôi tin chắc rằng lựa chọn tối ưu nhất sẽ là...',
    tag: 'Part 2 · Chọn phương án tối ưu (Solution Discussion)',
  },
  {
    phrase: 'While the other two options have their own merits, they are less practical because...',
    meaningVi: 'Mặc dù hai lựa chọn còn lại đều có ưu điểm riêng, chúng kém thực tế hơn bởi vì...',
    tag: 'Part 2 · Phản biện 2 phương án còn lại (B2–C1)',
  },
  {
    phrase: 'Looking at the mind map, there are three compelling reasons why this issue is of great significance.',
    meaningVi: 'Nhìn vào sơ đồ tư duy, có ba lý do thuyết phục giải thích vì sao vấn đề này lại có ý nghĩa lớn.',
    tag: 'Part 3 · Mở bài phát triển chủ đề Mind-map',
  },
];

export const WritingSpeakingPracticeView: React.FC<WritingSpeakingPracticeViewProps> = ({
  tests,
  onStartTest,
  onSelectMode,
}) => {
  const { currentUser } = useAuth();
  const [activeSkillTab, setActiveSkillTab] = useState<'writing' | 'speaking'>('writing');
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0]?.id || 'test-1');
  const [selectedSubPart, setSelectedSubPart] = useState<number>(0); // 0 = all
  const [expandedSampleIds, setExpandedSampleIds] = useState<Record<string, boolean>>({});
  const [quickSavePayload, setQuickSavePayload] = useState<QuickSaveVocabPayload | null>(null);

  // In-Place Quick AI Sandbox states keyed by `${skill}-${testId}-${partNumber}`
  const [openSandboxKeys, setOpenSandboxKeys] = useState<Record<string, boolean>>({});
  const [sandboxTexts, setSandboxTexts] = useState<Record<string, string>>({});
  const [sandboxLoading, setSandboxLoading] = useState<Record<string, boolean>>({});
  const [sandboxResults, setSandboxResults] = useState<Record<string, any>>({});
  const [sandboxErrors, setSandboxErrors] = useState<Record<string, string>>({});
  const [sandboxSampleTab, setSandboxSampleTab] = useState<Record<string, 'B1' | 'B2' | 'C1'>>({});

  // Speech recognition & audio recording for Speaking Sandbox
  const [recordingKey, setRecordingKey] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const activeTestObj = tests.find((t) => t.id === selectedTestId) || tests[0];
  const writingTasks: WritingTask[] =
    activeTestObj?.writingTasks && activeTestObj.writingTasks.length > 0
      ? activeTestObj.writingTasks
      : SAMPLE_B1_WRITING_TASKS;
  const speakingTasks: SpeakingTask[] =
    activeTestObj?.speakingTasks && activeTestObj.speakingTasks.length > 0
      ? activeTestObj.speakingTasks
      : SAMPLE_VSTEP_SPEAKING_TASKS;

  const toggleSampleExpand = (key: string) => {
    setExpandedSampleIds((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSandbox = (key: string) => {
    setOpenSandboxKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLaunchSkillPart = (
    section: 'WRITING' | 'SPEAKING',
    partNumber: 1 | 2 | 3,
    mode: 'practice' | 'exam'
  ) => {
    onSelectMode(mode);
    onStartTest(selectedTestId, section, partNumber);
  };

  const countWords = (text: string) => {
    const trimmed = (text || '').trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  };

  const handleStartSpeechDictation = (sandboxKey: string) => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSandboxErrors((prev) => ({
        ...prev,
        [sandboxKey]:
          'Trình duyệt hiện tại không hỗ trợ nhận diện giọng nói trực tiếp. Bạn có thể nhập hoặc dán nội dung bài nói vào ô bên dưới để chấm AI.',
      }));
      return;
    }

    if (recordingKey === sandboxKey && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setRecordingKey(null);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (event: any) => {
        let transcriptChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcriptChunk += event.results[i][0].transcript + ' ';
          }
        }
        if (transcriptChunk.trim()) {
          setSandboxTexts((prev) => ({
            ...prev,
            [sandboxKey]: ((prev[sandboxKey] || '') + ' ' + transcriptChunk.trim()).trim(),
          }));
        }
      };
      rec.onerror = () => {
        setRecordingKey(null);
      };
      rec.onend = () => {
        setRecordingKey(null);
      };
      recognitionRef.current = rec;
      rec.start();
      setRecordingKey(sandboxKey);
      setSandboxErrors((prev) => ({ ...prev, [sandboxKey]: '' }));
    } catch {
      setRecordingKey(null);
    }
  };

  const handleRunWritingAiSandbox = async (task: WritingTask, sandboxKey: string) => {
    const text = (sandboxTexts[sandboxKey] || '').trim();
    const words = countWords(text);
    if (words < 10) {
      setSandboxErrors((prev) => ({
        ...prev,
        [sandboxKey]: 'Vui lòng viết tối thiểu 10 từ tiếng Anh để Giám khảo AI phân tích và sửa lỗi chi tiết.',
      }));
      return;
    }

    setSandboxLoading((prev) => ({ ...prev, [sandboxKey]: true }));
    setSandboxErrors((prev) => ({ ...prev, [sandboxKey]: '' }));

    try {
      const resp = await fetch('/api/ai/writing-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber: task.partNumber,
          title: task.title,
          stimulusText: task.stimulusText,
          bulletPoints: task.bulletPoints,
          minWords: task.minWords || (task.partNumber === 1 ? 120 : 250),
          studentText: text,
        }),
      });
      if (!resp.ok) {
        throw new Error('Không thể kết nối máy chủ chấm AI lúc này.');
      }
      const data = await resp.json();
      setSandboxResults((prev) => ({ ...prev, [sandboxKey]: data }));
      recordStudyActivity(`Luyện viết tại chỗ & chấm AI: ${task.title}`, currentUser?.uid);
    } catch (err: any) {
      setSandboxErrors((prev) => ({
        ...prev,
        [sandboxKey]: err?.message || 'Có lỗi khi gọi Giám khảo AI. Vui lòng thử lại.',
      }));
    } finally {
      setSandboxLoading((prev) => ({ ...prev, [sandboxKey]: false }));
    }
  };

  const handleRunSpeakingAiSandbox = async (task: SpeakingTask, sandboxKey: string) => {
    const text = (sandboxTexts[sandboxKey] || '').trim();
    const words = countWords(text);
    if (words < 8) {
      setSandboxErrors((prev) => ({
        ...prev,
        [sandboxKey]: 'Vui lòng thu âm hoặc nhập tối thiểu 8 từ tiếng Anh để Giám khảo AI chấm điểm và sửa lỗi.',
      }));
      return;
    }

    setSandboxLoading((prev) => ({ ...prev, [sandboxKey]: true }));
    setSandboxErrors((prev) => ({ ...prev, [sandboxKey]: '' }));

    try {
      const promptSummary =
        task.partNumber === 1
          ? (task.topicClusters || [])
              .map((c) => `${c.topicTitle}: ${(c.questions || []).join('; ')}`)
              .join(' | ')
          : task.partNumber === 2
          ? `${task.situation || ''} Options: ${(task.options || []).join(', ')}`
          : `${task.topicStatement || task.mindMap?.centralIdea || ''} Nodes: ${(
              task.mindMap?.nodes || []
            ).join(', ')}`;

      const resp = await fetch('/api/ai/speaking-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partNumber: task.partNumber,
          title: task.title,
          promptText: promptSummary,
          studentTranscript: text,
        }),
      });
      if (!resp.ok) {
        throw new Error('Không thể kết nối máy chủ chấm AI Speaking lúc này.');
      }
      const data = await resp.json();
      setSandboxResults((prev) => ({ ...prev, [sandboxKey]: data }));
      recordStudyActivity(`Luyện nói tại chỗ & chấm AI: ${task.title}`, currentUser?.uid);
    } catch (err: any) {
      setSandboxErrors((prev) => ({
        ...prev,
        [sandboxKey]: err?.message || 'Có lỗi khi gọi Giám khảo AI Speaking. Vui lòng thử lại.',
      }));
    } finally {
      setSandboxLoading((prev) => ({ ...prev, [sandboxKey]: false }));
    }
  };

  const visibleWritingTasks = writingTasks.filter(
    (t) => selectedSubPart === 0 || t.partNumber === selectedSubPart
  );
  const visibleSpeakingTasks = speakingTasks.filter(
    (t) => selectedSubPart === 0 || t.partNumber === selectedSubPart
  );

  return (
    <div className="space-y-6 pb-20">
      <GlobalSelectionDictionaryPopover
        sourceLabel={activeSkillTab === 'writing' ? 'Luyện Viết VSTEP' : 'Luyện Nói VSTEP'}
        testId={selectedTestId}
        testTitle={activeTestObj?.title}
      />

      {/* Top Hero Banner with Skill Switcher */}
      <div
        className={`rounded-3xl p-6 text-white shadow-md border-2 border-b-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
          activeSkillTab === 'writing'
            ? 'bg-gradient-to-r from-[#A560E8] to-[#8B3FD9] border-[#8B3FD9] border-b-[#6929B0]'
            : 'bg-gradient-to-r from-[#FF4B4B] to-[#EA2B2B] border-[#EA2B2B] border-b-[#B81D1D]'
        }`}
      >
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/20 text-white font-black text-xs mb-2">
            {activeSkillTab === 'writing' ? (
              <>
                <PenTool className="h-3.5 w-3.5" />
                <span>CHUYÊN MỤC LUYỆN VIẾT VSTEP (TASK 1 &amp; TASK 2)</span>
              </>
            ) : (
              <>
                <Mic className="h-3.5 w-3.5" />
                <span>CHUYÊN MỤC LUYỆN NÓI VSTEP (PART 1, PART 2 &amp; PART 3)</span>
              </>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            {activeSkillTab === 'writing'
              ? 'Luyện Viết Thư & Luận Học Thuật Chấm Chữa AI'
              : 'Phòng Luyện Nói & Phản Xạ Sơ Đồ Tư Duy Mind-map'}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-white/90 max-w-2xl leading-relaxed">
            {activeSkillTab === 'writing'
              ? 'Rèn kỹ năng viết Thư/Email (Task 1 ≥ 120 từ) và Bài luận Essay (Task 2 ≥ 250 từ) ngay tại chỗ hoặc trong phòng thi, kèm Giám khảo AI sửa từng câu và bài mẫu B1–B2–C1.'
              : 'Luyện thu âm trực tiếp hoặc nhập ý tưởng cho 3 phần thi Nói VSTEP ngay tại thẻ bài tập, chấm điểm 5 tiêu chí và đối chiếu bài nói mẫu B1–B2–C1.'}
          </p>
        </div>

        {/* Segmented Switcher: Writing vs Speaking */}
        <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveSkillTab('writing');
              setSelectedSubPart(0);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeSkillTab === 'writing'
                ? 'bg-white text-[#8B3FD9] shadow-sm'
                : 'text-white/90 hover:bg-white/10'
            }`}
          >
            <PenTool className="h-4 w-4" />
            <span>Luyện Viết (Writing)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSkillTab('speaking');
              setSelectedSubPart(0);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeSkillTab === 'speaking'
                ? 'bg-white text-[#EA2B2B] shadow-sm'
                : 'text-white/90 hover:bg-white/10'
            }`}
          >
            <Mic className="h-4 w-4" />
            <span>Luyện Nói (Speaking)</span>
          </button>
        </div>
      </div>

      {/* Test Picker & Sub-Part Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-3xl bg-white dark:bg-slate-800 p-3.5 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 shadow-2xs">
        <div className="flex items-center gap-2">
          <BookOpen
            className={`h-4 w-4 shrink-0 ${
              activeSkillTab === 'writing' ? 'text-[#A560E8]' : 'text-[#FF4B4B]'
            }`}
          />
          <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 shrink-0">
            Chọn bộ đề:
          </span>
          <select
            value={selectedTestId}
            onChange={(e) => setSelectedTestId(e.target.value)}
            className="rounded-xl border-2 border-slate-200 dark:border-slate-600 border-b-4 border-b-slate-300 dark:border-b-slate-950 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs font-black text-slate-900 dark:text-white outline-hidden focus:border-[#CE82FF] cursor-pointer"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} {t.isCustom ? '(Đề giáo viên / AI)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-Part Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedSubPart(0)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border-2 border-b-4 active:border-b-0 active:translate-y-1 transition-all cursor-pointer ${
              selectedSubPart === 0
                ? 'bg-[#58CC02] text-white border-[#58CC02] border-b-[#46A302]'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 border-b-slate-300 dark:border-b-slate-900'
            }`}
          >
            Tất cả {activeSkillTab === 'writing' ? '2 Task Viết' : '3 Part Nói'}
          </button>

          {activeSkillTab === 'writing'
            ? [
                { num: 1, label: 'Task 1: Thư / Email (≥120 từ)' },
                { num: 2, label: 'Task 2: Bài luận Essay (≥250 từ)' },
              ].map((item) => (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => setSelectedSubPart(item.num)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border-2 border-b-4 active:border-b-0 active:translate-y-1 transition-all cursor-pointer ${
                    selectedSubPart === item.num
                      ? 'bg-[#CE82FF] text-white border-[#CE82FF] border-b-[#A560E8]'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 border-b-slate-300 dark:border-b-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))
            : [
                { num: 1, label: 'Part 1: Social Interaction' },
                { num: 2, label: 'Part 2: Solution Discussion' },
                { num: 3, label: 'Part 3: Topic Mind-map' },
              ].map((item) => (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => setSelectedSubPart(item.num)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap border-2 border-b-4 active:border-b-0 active:translate-y-1 transition-all cursor-pointer ${
                    selectedSubPart === item.num
                      ? 'bg-[#FF4B4B] text-white border-[#FF4B4B] border-b-[#EA2B2B]'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 border-b-slate-300 dark:border-b-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* WRITING TASKS CARDS                                                 */}
      {/* =================================================================== */}
      {activeSkillTab === 'writing' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {visibleWritingTasks.map((task) => {
              const sampleKey = `w-${selectedTestId}-${task.partNumber}`;
              const sandboxKey = `w-sandbox-${selectedTestId}-${task.partNumber}`;
              const isSampleOpen = !!expandedSampleIds[sampleKey];
              const isSandboxOpen = !!openSandboxKeys[sandboxKey];
              const isTask1 = task.partNumber === 1;
              const minWords = task.minWords || (isTask1 ? 120 : 250);
              const currentText = sandboxTexts[sandboxKey] || '';
              const wordCount = countWords(currentText);
              const aiRes = sandboxResults[sandboxKey];
              const isLoadingAi = !!sandboxLoading[sandboxKey];
              const errorMsg = sandboxErrors[sandboxKey];
              const activeBandTab = sandboxSampleTab[sandboxKey] || 'B2';

              return (
                <div
                  key={task.id}
                  className="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-4 hover:border-[#CE82FF] transition-all"
                >
                  <div className="space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#F3E5FF] dark:bg-purple-950/70 text-[#8B3FD9] dark:text-purple-300 border-2 border-[#CE82FF] border-b-3 border-b-[#A560E8] text-xs font-black">
                        <PenTool className="h-3.5 w-3.5" />
                        <span>
                          {isTask1
                            ? 'WRITING TASK 1 · THƯ / EMAIL (TRỌNG SỐ 1/3)'
                            : 'WRITING TASK 2 · BÀI LUẬN ESSAY (TRỌNG SỐ 2/3)'}
                        </span>
                      </span>

                      <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-[#A560E8]" />
                        <span>{isTask1 ? '20 phút' : '40 phút'}</span>
                        <span>·</span>
                        <span>≥ {minWords} từ</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 dark:text-white leading-snug">
                      {task.title}
                    </h3>

                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {task.instruction}
                    </p>

                    {/* Stimulus Prompt Box */}
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-4 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-line">
                      {task.stimulusText}
                    </div>

                    {/* Bullet points */}
                    {task.bulletPoints && task.bulletPoints.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Yêu cầu trọng tâm cần giải quyết:
                        </span>
                        <ul className="space-y-1">
                          {task.bulletPoints.map((bp, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-300"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#58CC02] shrink-0 mt-0.5" />
                              <span>{bp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Collapsible Sample Answer & Outline */}
                    {task.sampleAnswer && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleSampleExpand(sampleKey)}
                          className="inline-flex items-center gap-1.5 text-xs font-black text-[#8B3FD9] dark:text-purple-300 hover:underline cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>
                            {isSampleOpen
                              ? 'Ẩn bài viết mẫu tham khảo chuẩn VSTEP B2–C1'
                              : 'Xem bài viết mẫu tham khảo chuẩn VSTEP B2–C1'}
                          </span>
                          {isSampleOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {isSampleOpen && (
                          <div className="mt-2.5 rounded-2xl bg-[#F3E5FF]/40 dark:bg-purple-950/30 p-4 border border-[#CE82FF]/60 text-xs text-slate-800 dark:text-slate-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-black text-[#8B3FD9] dark:text-purple-300 uppercase text-[11px]">
                                Bài mẫu Band B2–C1 tham khảo:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const sel = window.getSelection()?.toString().trim() || '';
                                  setQuickSavePayload({
                                    initialWord: sel.length >= 2 && sel.length <= 75 ? sel : '',
                                    contextSentence: task.sampleAnswer?.slice(0, 280),
                                    sourceLabel: `Bài mẫu Writing Task ${task.partNumber}`,
                                    testId: selectedTestId,
                                    testTitle: activeTestObj?.title,
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-[#CE82FF] px-2 py-0.5 text-[10px] font-black text-[#8B3FD9] dark:text-purple-300 cursor-pointer"
                              >
                                <BookmarkPlus className="h-3 w-3" />
                                <span>+ Lưu cụm từ vào SRS</span>
                              </button>
                            </div>
                            <p className="leading-relaxed whitespace-pre-line font-medium">
                              {task.sampleAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* IN-PLACE AI WRITING SANDBOX */}
                    {isSandboxOpen && (
                      <div className="mt-3 rounded-2xl bg-purple-50/50 dark:bg-slate-900/90 border-2 border-[#CE82FF] p-4 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#8B3FD9] dark:text-purple-300 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4" />
                            <span>Khung Luyện Viết &amp; Chấm Sửa Lỗi AI Tại Chỗ</span>
                          </span>
                          <span
                            className={`font-mono text-xs font-black tabular-nums px-2.5 py-0.5 rounded-lg ${
                              wordCount >= minWords
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {wordCount}/{minWords} từ tối thiểu
                          </span>
                        </div>

                        <textarea
                          rows={6}
                          value={currentText}
                          onChange={(e) =>
                            setSandboxTexts((prev) => ({ ...prev, [sandboxKey]: e.target.value }))
                          }
                          placeholder={
                            isTask1
                              ? 'Dear ..., \nI am writing this letter to...'
                              : 'In recent years, there has been a growing debate over...'
                          }
                          className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:border-[#A560E8] focus:outline-none leading-relaxed"
                        />

                        {errorMsg && (
                          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{errorMsg}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleSandbox(sandboxKey)}
                            className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          >
                            Thu gọn khung viết
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunWritingAiSandbox(task, sandboxKey)}
                            disabled={isLoadingAi}
                            className="btn-duo-purple px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {isLoadingAi ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Đang chấm &amp; sửa lỗi từng câu...</span>
                              </>
                            ) : (
                              <>
                                <Send className="h-3.5 w-3.5" />
                                <span>Chấm Điểm &amp; Sửa Lỗi AI Ngay</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* AI Evaluation Result Box */}
                        {aiRes && (
                          <div className="pt-3 border-t border-purple-200 dark:border-slate-700 space-y-3 text-xs">
                            <div className="flex items-center justify-between gap-2 flex-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-purple-200 dark:border-slate-700">
                              <div>
                                <span className="text-[10px] font-black uppercase text-slate-400 block">
                                  Điểm VSTEP Writing AI Chấm
                                </span>
                                <span className="text-xl font-black text-[#8B3FD9] dark:text-purple-300 tabular-nums">
                                  {aiRes.overallScore ?? aiRes.score ?? 6.5}/10
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold tabular-nums">
                                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                                  Task: <strong>{aiRes.criteria?.taskFulfillment ?? 6.5}</strong>
                                </span>
                                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                                  Mạch lạc: <strong>{aiRes.criteria?.organization ?? 6.5}</strong>
                                </span>
                                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                                  Từ vựng: <strong>{aiRes.criteria?.vocabulary ?? 6.5}</strong>
                                </span>
                                <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                                  Ngữ pháp: <strong>{aiRes.criteria?.grammar ?? 6.5}</strong>
                                </span>
                              </div>
                            </div>

                            {aiRes.overallFeedbackVi && (
                              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 leading-relaxed">
                                <strong className="text-[#8B3FD9] dark:text-purple-300">
                                  Nhận xét Giám khảo:{' '}
                                </strong>
                                {aiRes.overallFeedbackVi}
                              </div>
                            )}

                            {/* Sentence-by-Sentence Corrections */}
                            {Array.isArray(aiRes.sentenceCorrections) &&
                              aiRes.sentenceCorrections.length > 0 && (
                                <div className="space-y-2">
                                  <span className="font-black uppercase text-[11px] text-slate-600 dark:text-slate-300 block">
                                    Sửa lỗi chi tiết từng câu ({aiRes.sentenceCorrections.length} điểm cần nâng cấp):
                                  </span>
                                  {aiRes.sentenceCorrections.slice(0, 5).map((corr: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1"
                                    >
                                      <div className="line-through text-rose-600 dark:text-rose-400 font-semibold">
                                        ✗ {corr.original}
                                      </div>
                                      <div className="text-emerald-700 dark:text-emerald-400 font-black">
                                        ✓ {corr.improved}
                                      </div>
                                      {corr.explanationVi && (
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                          💡 {corr.explanationVi}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                            {/* B1 / B2 / C1 Sample Tabs */}
                            {(aiRes.sampleB1 || aiRes.sampleB2 || aiRes.sampleC1) && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-black uppercase text-[11px] text-slate-600 dark:text-slate-300">
                                    Bài mẫu nâng cấp theo 3 Band:
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {(['B1', 'B2', 'C1'] as const).map((band) => (
                                      <button
                                        key={band}
                                        type="button"
                                        onClick={() =>
                                          setSandboxSampleTab((prev) => ({
                                            ...prev,
                                            [sandboxKey]: band,
                                          }))
                                        }
                                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black cursor-pointer ${
                                          activeBandTab === band
                                            ? 'bg-[#8B3FD9] text-white'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}
                                      >
                                        Band {band}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-slate-700 whitespace-pre-line leading-relaxed text-slate-800 dark:text-slate-200">
                                  {activeBandTab === 'B1'
                                    ? aiRes.sampleB1 || aiRes.sampleB2
                                    : activeBandTab === 'C1'
                                    ? aiRes.sampleC1 || aiRes.sampleB2
                                    : aiRes.sampleB2 || aiRes.sampleB1}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Launch Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/70">
                    <button
                      type="button"
                      onClick={() => toggleSandbox(sandboxKey)}
                      className="btn-duo-green py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{isSandboxOpen ? 'Đóng Khung Viết' : 'Viết & Chấm AI Tại Chỗ'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchSkillPart('WRITING', task.partNumber as 1 | 2, 'practice')
                      }
                      className="btn-duo-purple py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Phòng Luyện Viết</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchSkillPart('WRITING', task.partNumber as 1 | 2, 'exam')
                      }
                      className="btn-duo-white py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      <Clock className="h-3.5 w-3.5 text-[#8B3FD9]" />
                      <span>Thi Thử Bấm Giờ</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* High-Scoring VSTEP Writing Linking Phrases Bank */}
          <div className="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[#A560E8]" />
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Ngân Hàng Cấu Trúc Câu &amp; Từ Nối Ăn Điểm VSTEP Writing (Band B2–C1)
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Bấm "+ Lưu SRS" để nạp cấu trúc câu vào Flashcard ôn tập hàng ngày
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {WRITING_BOOST_PHRASES.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-3.5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#8B3FD9] dark:text-purple-300">
                        {item.tag}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => examAudioManager.speakText(item.phrase)}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                          title="Nghe phát âm mẫu câu"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuickSavePayload({
                              initialWord: item.phrase.slice(0, 75),
                              contextSentence: item.phrase,
                              sourceLabel: item.tag,
                              testId: selectedTestId,
                              testTitle: activeTestObj?.title,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-[#F3E5FF] dark:bg-purple-950/80 border border-[#CE82FF] px-2 py-0.5 text-[10px] font-black text-[#8B3FD9] dark:text-purple-300 hover:bg-purple-200 cursor-pointer"
                        >
                          <BookmarkPlus className="h-3 w-3" />
                          <span>+ Lưu SRS</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      "{item.phrase}"
                    </p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      → {item.meaningVi}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* SPEAKING PARTS 1-3 CARDS                                            */
        /* =================================================================== */
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {visibleSpeakingTasks.map((task) => {
              const sampleKey = `s-${selectedTestId}-${task.partNumber}`;
              const sandboxKey = `s-sandbox-${selectedTestId}-${task.partNumber}`;
              const isSampleOpen = !!expandedSampleIds[sampleKey];
              const isSandboxOpen = !!openSandboxKeys[sandboxKey];
              const currentText = sandboxTexts[sandboxKey] || '';
              const wordCount = countWords(currentText);
              const aiRes = sandboxResults[sandboxKey];
              const isLoadingAi = !!sandboxLoading[sandboxKey];
              const errorMsg = sandboxErrors[sandboxKey];
              const activeBandTab = sandboxSampleTab[sandboxKey] || 'B2';
              const isRecordingThis = recordingKey === sandboxKey;

              return (
                <div
                  key={task.id}
                  className="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 p-5 sm:p-6 shadow-xs flex flex-col justify-between gap-4 hover:border-[#FF4B4B] transition-all"
                >
                  <div className="space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FFDFE0] dark:bg-rose-950/70 text-[#EA2B2B] dark:text-rose-300 border-2 border-[#FF4B4B] border-b-3 border-b-[#EA2B2B] text-xs font-black">
                        <Mic className="h-3.5 w-3.5" />
                        <span>SPEAKING PART {task.partNumber}</span>
                      </span>

                      <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-[#FF4B4B]" />
                        <span>
                          {task.prepSeconds > 0 ? `${task.prepSeconds}s chuẩn bị · ` : ''}
                          {Math.round(task.speakSeconds / 60)} phút nói
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-snug">
                      {task.title}
                    </h3>

                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {task.instruction}
                    </p>

                    {/* Part 1 Topics */}
                    {task.partNumber === 1 && (
                      <div className="space-y-2.5">
                        {(task.topicClusters || []).map((cluster, cIdx) => (
                          <div
                            key={cIdx}
                            className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-3 border border-slate-200 dark:border-slate-700 space-y-1"
                          >
                            <span
                              className={`text-xs font-black block ${
                                cIdx === 0
                                  ? 'text-[#EA2B2B] dark:text-rose-400'
                                  : 'text-[#1CB0F6] dark:text-sky-400'
                              }`}
                            >
                              {cluster.topicTitle}
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {(cluster.questions || []).map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Part 2 Situation & 3 Options */}
                    {task.partNumber === 2 && (
                      <div className="space-y-2.5">
                        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 p-3.5 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                          {task.situation}
                        </div>
                        {task.options && task.options.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 block">
                              3 Phương án lựa chọn:
                            </span>
                            {task.options.map((opt, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                              >
                                {idx + 1}. {opt}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Part 3 Mind-map */}
                    {task.partNumber === 3 && (
                      <div className="space-y-2.5">
                        <div className="rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 p-3.5 border-2 border-[#FFC800] text-center">
                          <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300 block">
                            Chủ đề trung tâm (Mind-map)
                          </span>
                          <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                            {task.topicStatement || task.mindMap?.centralIdea || task.mindMap?.centerTopic}
                          </p>
                        </div>
                        {task.mindMap?.nodes && task.mindMap.nodes.length > 0 && (
                          <div className="grid grid-cols-1 gap-1.5">
                            {task.mindMap.nodes.map((node, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"
                              >
                                <Layers className="h-3.5 w-3.5 text-[#58CC02] shrink-0" />
                                <span>
                                  Nhánh {idx + 1}: {node}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sample Answer */}
                    {task.sampleAnswer && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleSampleExpand(sampleKey)}
                          className="inline-flex items-center gap-1.5 text-xs font-black text-[#EA2B2B] dark:text-rose-400 hover:underline cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>
                            {isSampleOpen
                              ? 'Ẩn bài nói mẫu chuẩn VSTEP B2'
                              : 'Xem bài nói mẫu & Nghe phát âm AI'}
                          </span>
                          {isSampleOpen ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>

                        {isSampleOpen && (
                          <div className="mt-2 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 p-3.5 border border-rose-200 dark:border-rose-800 text-xs text-slate-800 dark:text-slate-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => examAudioManager.speakText(task.sampleAnswer || '')}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#FF4B4B] text-white px-2.5 py-1 text-[10px] font-black cursor-pointer"
                              >
                                <Volume2 className="h-3 w-3" />
                                <span>Nghe mẫu AI</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const sel = window.getSelection()?.toString().trim() || '';
                                  setQuickSavePayload({
                                    initialWord: sel.length >= 2 && sel.length <= 75 ? sel : '',
                                    contextSentence: task.sampleAnswer?.slice(0, 280),
                                    sourceLabel: `Bài mẫu Speaking Part ${task.partNumber}`,
                                    testId: selectedTestId,
                                    testTitle: activeTestObj?.title,
                                  });
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-[#CE82FF] px-2 py-0.5 text-[10px] font-black text-[#8B3FD9] dark:text-purple-300 cursor-pointer"
                              >
                                <BookmarkPlus className="h-3 w-3" />
                                <span>+ Lưu SRS</span>
                              </button>
                            </div>
                            <p className="leading-relaxed whitespace-pre-line font-medium">
                              {task.sampleAnswer}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* IN-PLACE AI SPEAKING SANDBOX */}
                    {isSandboxOpen && (
                      <div className="mt-3 rounded-2xl bg-rose-50/50 dark:bg-slate-900/90 border-2 border-[#FF4B4B] p-3.5 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-black text-[#EA2B2B] dark:text-rose-400 flex items-center gap-1.5">
                            <Mic className="h-3.5 w-3.5" />
                            <span>Thu Âm / Nhập Bài Nói &amp; Chấm AI Tại Chỗ</span>
                          </span>
                          <span className="font-mono text-[11px] font-black tabular-nums px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {wordCount} từ
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartSpeechDictation(sandboxKey)}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border-b-3 transition-all cursor-pointer ${
                              isRecordingThis
                                ? 'bg-rose-600 text-white border-rose-800 animate-pulse'
                                : 'bg-white dark:bg-slate-800 text-[#EA2B2B] dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50'
                            }`}
                          >
                            {isRecordingThis ? (
                              <>
                                <Square className="h-3.5 w-3.5 fill-current" />
                                <span>Đang nghe giọng nói... (Bấm để dừng)</span>
                              </>
                            ) : (
                              <>
                                <Mic className="h-3.5 w-3.5" />
                                <span>Bấm Mic Nói Tiếng Anh (Tự chuyển thành chữ)</span>
                              </>
                            )}
                          </button>
                        </div>

                        <textarea
                          rows={4}
                          value={currentText}
                          onChange={(e) =>
                            setSandboxTexts((prev) => ({ ...prev, [sandboxKey]: e.target.value }))
                          }
                          placeholder="Nội dung bạn nói qua Mic sẽ hiện tại đây, hoặc bạn có thể tự gõ câu trả lời Speaking để AI chấm và nâng cấp câu..."
                          className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs font-medium text-slate-900 dark:text-white focus:border-[#FF4B4B] focus:outline-none leading-relaxed"
                        />

                        {errorMsg && (
                          <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 text-[11px] font-bold flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{errorMsg}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSandbox(sandboxKey)}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            Thu gọn
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRunSpeakingAiSandbox(task, sandboxKey)}
                            disabled={isLoadingAi}
                            className="btn-duo-red px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                          >
                            {isLoadingAi ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Đang chấm AI...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Chấm Điểm &amp; Sửa Lỗi Ngay</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* AI Speaking Result */}
                        {aiRes && (
                          <div className="pt-2.5 border-t border-rose-200 dark:border-slate-700 space-y-2.5 text-xs">
                            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-rose-200 dark:border-slate-700">
                              <span className="font-black text-slate-600 dark:text-slate-300">
                                Điểm Speaking AI:
                              </span>
                              <span className="text-lg font-black text-[#EA2B2B] dark:text-rose-400 tabular-nums">
                                {aiRes.overallScore ?? aiRes.score ?? 6.5}/10
                              </span>
                            </div>

                            {aiRes.overallFeedbackVi && (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
                                <strong className="text-[#EA2B2B]">Nhận xét: </strong>
                                {aiRes.overallFeedbackVi}
                              </div>
                            )}

                            {Array.isArray(aiRes.sentenceCorrections) &&
                              aiRes.sentenceCorrections.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="font-black text-[11px] text-slate-600 dark:text-slate-300 block">
                                    Sửa lỗi diễn đạt ({aiRes.sentenceCorrections.length}):
                                  </span>
                                  {aiRes.sentenceCorrections.slice(0, 3).map((corr: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] space-y-0.5"
                                    >
                                      <div className="line-through text-rose-500">{corr.original}</div>
                                      <div className="font-black text-emerald-600 dark:text-emerald-400">
                                        → {corr.improved}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                            {(aiRes.sampleB1 || aiRes.sampleB2 || aiRes.sampleC1) && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-black text-[10px] uppercase text-slate-500">
                                    Bài nói mẫu theo Band:
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {(['B1', 'B2', 'C1'] as const).map((b) => (
                                      <button
                                        key={b}
                                        type="button"
                                        onClick={() =>
                                          setSandboxSampleTab((prev) => ({
                                            ...prev,
                                            [sandboxKey]: b,
                                          }))
                                        }
                                        className={`px-2 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                                          activeBandTab === b
                                            ? 'bg-[#EA2B2B] text-white'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                        }`}
                                      >
                                        {b}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-slate-700 text-[11px] leading-relaxed text-slate-800 dark:text-slate-200">
                                  {activeBandTab === 'B1'
                                    ? aiRes.sampleB1 || aiRes.sampleB2
                                    : activeBandTab === 'C1'
                                    ? aiRes.sampleC1 || aiRes.sampleB2
                                    : aiRes.sampleB2 || aiRes.sampleB1}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Launch Buttons */}
                  <div className="grid grid-cols-1 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/70">
                    <button
                      type="button"
                      onClick={() => toggleSandbox(sandboxKey)}
                      className="btn-duo-green py-2 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{isSandboxOpen ? 'Đóng Khung Thu Âm Tại Chỗ' : 'Nói & Chấm AI Ngay Tại Chỗ'}</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleLaunchSkillPart('SPEAKING', task.partNumber as 1 | 2 | 3, 'practice')
                        }
                        className="btn-duo-red py-2 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Mic className="h-3.5 w-3.5" />
                        <span>Phòng Thu AI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleLaunchSkillPart('SPEAKING', task.partNumber as 1 | 2 | 3, 'exam')
                        }
                        className="btn-duo-white py-2 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-200 cursor-pointer"
                      >
                        <Clock className="h-3.5 w-3.5 text-[#FF4B4B]" />
                        <span>Thi Bấm Giờ</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Speaking Discourse Markers & Signposting Phrases */}
          <div className="rounded-3xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 border-b-4 border-b-slate-300 dark:border-b-slate-950 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-[#FF4B4B]" />
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Cụm Từ Dẫn Dắt Phản Xạ Nói VSTEP (Speaking Signposting Phrases B2–C1)
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Bấm loa để luyện ngữ điệu hoặc "+ Lưu SRS" để ghi nhớ
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SPEAKING_BOOST_PHRASES.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-50 dark:bg-slate-900/70 p-3.5 border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#EA2B2B] dark:text-rose-400">
                        {item.tag}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => examAudioManager.speakText(item.phrase)}
                          className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                          title="Nghe phát âm mẫu câu"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setQuickSavePayload({
                              initialWord: item.phrase.slice(0, 75),
                              contextSentence: item.phrase,
                              sourceLabel: item.tag,
                              testId: selectedTestId,
                              testTitle: activeTestObj?.title,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-[#F3E5FF] dark:bg-purple-950/80 border border-[#CE82FF] px-2 py-0.5 text-[10px] font-black text-[#8B3FD9] dark:text-purple-300 hover:bg-purple-200 cursor-pointer"
                        >
                          <BookmarkPlus className="h-3 w-3" />
                          <span>+ Lưu SRS</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      "{item.phrase}"
                    </p>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      → {item.meaningVi}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <QuickSaveVocabModal
        isOpen={Boolean(quickSavePayload)}
        onClose={() => setQuickSavePayload(null)}
        payload={quickSavePayload}
      />
    </div>
  );
};
