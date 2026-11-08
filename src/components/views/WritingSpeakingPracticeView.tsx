import React, { useState } from 'react';
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
} from 'lucide-react';
import { TestMetadata, ExamSection } from '../../types/exam';
import { SAMPLE_B1_WRITING_TASKS, WritingTask } from '../../types/writing';
import { SAMPLE_VSTEP_SPEAKING_TASKS, SpeakingTask } from '../../types/speaking';
import { examAudioManager } from '../../utils/audioManager';
import { QuickSaveVocabModal, QuickSaveVocabPayload } from '../QuickSaveVocabModal';

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
  const [activeSkillTab, setActiveSkillTab] = useState<'writing' | 'speaking'>('writing');
  const [selectedTestId, setSelectedTestId] = useState<string>(tests[0]?.id || 'test-1');
  const [selectedSubPart, setSelectedSubPart] = useState<number>(0); // 0 = all
  const [expandedSampleIds, setExpandedSampleIds] = useState<Record<string, boolean>>({});
  const [quickSavePayload, setQuickSavePayload] = useState<QuickSaveVocabPayload | null>(null);

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

  const handleLaunchSkillPart = (
    section: 'WRITING' | 'SPEAKING',
    partNumber: 1 | 2 | 3,
    mode: 'practice' | 'exam'
  ) => {
    onSelectMode(mode);
    onStartTest(selectedTestId, section, partNumber);
  };

  const visibleWritingTasks = writingTasks.filter(
    (t) => selectedSubPart === 0 || t.partNumber === selectedSubPart
  );
  const visibleSpeakingTasks = speakingTasks.filter(
    (t) => selectedSubPart === 0 || t.partNumber === selectedSubPart
  );

  return (
    <div className="space-y-6 pb-20">
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
              ? 'Rèn kỹ năng viết Thư/Email (Task 1 ≥ 120 từ, hệ số 1) và Bài luận Essay (Task 2 ≥ 250 từ, hệ số 2) kèm dàn ý mẫu B1–B2–C1 và Giám khảo AI chấm 4 tiêu chí Bộ GD&ĐT.'
              : 'Luyện thu âm trực tiếp 3 phần thi Nói VSTEP (Social Interaction, Solution Discussion & Topic Development), tự động nhận diện giọng nói và chấm điểm phát âm - từ vựng - ngữ pháp.'}
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
              const isSampleOpen = !!expandedSampleIds[sampleKey];
              const isTask1 = task.partNumber === 1;

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
                        <span>≥ {task.minWords || (isTask1 ? 120 : 250)} từ</span>
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
                  </div>

                  {/* Launch Buttons */}
                  <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/70">
                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchSkillPart('WRITING', task.partNumber as 1 | 2, 'practice')
                      }
                      className="btn-duo-purple py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Vào Viết &amp; Chấm AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchSkillPart('WRITING', task.partNumber as 1 | 2, 'exam')
                      }
                      className="btn-duo-white py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-200"
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
              const isSampleOpen = !!expandedSampleIds[sampleKey];

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
                  </div>

                  {/* Launch Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/70">
                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchSkillPart('SPEAKING', task.partNumber as 1 | 2 | 3, 'practice')
                      }
                      className="btn-duo-red py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Vào Phòng Thu AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleLaunchSkillPart('SPEAKING', task.partNumber as 1 | 2 | 3, 'exam')
                      }
                      className="btn-duo-white py-2.5 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 text-slate-700 dark:text-slate-200"
                    >
                      <Clock className="h-3.5 w-3.5 text-[#FF4B4B]" />
                      <span>Thi Thử Bấm Giờ</span>
                    </button>
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
