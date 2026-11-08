import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Headphones,
  FileText,
  RotateCcw,
  Sparkles,
  Volume2,
  Languages,
  Trash2,
  Filter,
  Play,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Award,
  BookmarkPlus,
  Cloud,
} from 'lucide-react';
import { TestMetadata, Question, getPartRelativeNumber } from '../../types/exam';
import {
  MistakeRecord,
  MISTAKES_UPDATED_EVENT,
  getMistakeRecords,
  markMistakeMastered,
  removeMistakeRecord,
  syncMistakesFromHistoricalAttempts,
  syncMistakesWithCloud,
} from '../../services/mistakeService';
import { fetchUserAttempts } from '../../services/examService';
import { useAuth } from '../../context/AuthContext';
import { examAudioManager } from '../../utils/audioManager';
import { StructuredExplanationBox } from '../StructuredExplanationBox';
import { QuickSaveVocabModal, QuickSaveVocabPayload } from '../QuickSaveVocabModal';
import { recordStudyActivity } from '../../services/streakService';

interface MistakeNotebookViewProps {
  tests: TestMetadata[];
  customQuestionsMap?: Record<string, Question[]>;
  onStartTest: (testId: string, section?: 'LISTENING' | 'READING', part?: 1 | 2 | 3 | 4) => void;
}

export const MistakeNotebookView: React.FC<MistakeNotebookViewProps> = ({
  tests,
  customQuestionsMap = {},
  onStartTest,
}) => {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || 'guest';

  const [records, setRecords] = useState<MistakeRecord[]>(() => getMistakeRecords(uid));
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Filters
  const [skillFilter, setSkillFilter] = useState<'ALL' | 'LISTENING' | 'READING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'NEED_REVIEW' | 'MASTERED' | 'ALL'>('NEED_REVIEW');
  const [testFilter, setTestFilter] = useState<string>('ALL');

  // Redo answers state per mistake key (`${testId}_${questionId}`)
  const [redoAnswers, setRedoAnswers] = useState<Record<string, string>>({});
  const [expandedPassages, setExpandedPassages] = useState<Record<string, boolean>>({});
  const [showTranslations, setShowTranslations] = useState<Record<string, boolean>>({});

  // Focused Sprint Mode state
  const [isSprintMode, setIsSprintMode] = useState<boolean>(false);
  const [sprintIndex, setSprintIndex] = useState<number>(0);

  // Quick Save Vocab SRS Modal & Cloud sync state
  const [quickSavePayload, setQuickSavePayload] = useState<QuickSaveVocabPayload | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);

  // Sync from historical attempts & Cloud Firestore on mount
  useEffect(() => {
    setRecords(getMistakeRecords(uid));
    let active = true;
    setIsLoadingHistory(true);
    Promise.all([
      fetchUserAttempts(uid).catch(() => []),
      syncMistakesWithCloud({ uid, tests, customQuestionsMap }).catch(() => getMistakeRecords(uid)),
    ])
      .then(([attempts]) => {
        if (!active) return;
        const synced = syncMistakesFromHistoricalAttempts({
          uid,
          attempts,
          tests,
          customQuestionsMap,
        });
        setRecords(synced);
        if (uid && uid !== 'guest') {
          setIsCloudSynced(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingHistory(false);
      });

    const handleUpdated = () => {
      if (active) setRecords(getMistakeRecords(uid));
    };
    window.addEventListener(MISTAKES_UPDATED_EVENT, handleUpdated);
    return () => {
      active = false;
      window.removeEventListener(MISTAKES_UPDATED_EVENT, handleUpdated);
    };
  }, [uid, tests, customQuestionsMap]);

  const stats = useMemo(() => {
    const total = records.length;
    const mastered = records.filter((r) => r.mastered).length;
    const needReview = total - mastered;
    const listeningCount = records.filter((r) => r.section === 'LISTENING' && !r.mastered).length;
    const readingCount = records.filter((r) => r.section === 'READING' && !r.mastered).length;
    const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, needReview, listeningCount, readingCount, masteryPct };
  }, [records]);

  const availableTestsInMistakes = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => {
      if (!map.has(r.testId)) {
        map.set(r.testId, r.testTitle || `Đề ${r.testId}`);
      }
    });
    return Array.from(map.entries());
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (skillFilter !== 'ALL' && r.section !== skillFilter) return false;
      if (statusFilter === 'NEED_REVIEW' && r.mastered) return false;
      if (statusFilter === 'MASTERED' && !r.mastered) return false;
      if (testFilter !== 'ALL' && r.testId !== testFilter) return false;
      return true;
    });
  }, [records, skillFilter, statusFilter, testFilter]);

  const checkAnswerCorrect = (q: Question, ans: string): boolean => {
    const trimmed = (ans || '').trim().toLowerCase();
    if (!trimmed) return false;
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer.some((a) => a.trim().toLowerCase() === trimmed);
    }
    return String(q.correctAnswer || '').trim().toLowerCase() === trimmed;
  };

  const handleSelectRedoOption = (record: MistakeRecord, selectedValue: string) => {
    setRedoAnswers((prev) => ({ ...prev, [record.key]: selectedValue }));
    const isRight = checkAnswerCorrect(record.questionSnapshot, selectedValue);
    if (isRight && !record.mastered) {
      const updated = markMistakeMastered(record.key, true, uid);
      setRecords(updated);
      recordStudyActivity(`Khắc phục câu sai: ${record.testTitle}`, currentUser?.uid);
    }
  };

  const handleResetRedoQuestion = (key: string) => {
    setRedoAnswers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const updated = markMistakeMastered(key, false, uid);
    setRecords(updated);
  };

  const handleDeleteRecord = (key: string) => {
    const updated = removeMistakeRecord(key, uid);
    setRecords(updated);
  };

  const renderMistakeCard = (record: MistakeRecord, indexLabel?: string) => {
    const q = record.questionSnapshot;
    const relNum = getPartRelativeNumber(record.questionId);
    const currentRedoVal = redoAnswers[record.key] || '';
    const hasAnsweredRedo = currentRedoVal.trim().length > 0;
    const isRedoCorrect = hasAnsweredRedo && checkAnswerCorrect(q, currentRedoVal);
    const isPassageExpanded = !!expandedPassages[record.key];
    const isTranslated = !!showTranslations[record.key];

    const options =
      q.options && q.options.length > 0
        ? q.options
        : q.type === 'multi_text_match'
        ? [
            { id: 'A', text: 'Text A' },
            { id: 'B', text: 'Text B' },
            { id: 'C', text: 'Text C' },
            { id: 'D', text: 'Text D' },
          ]
        : [];

    return (
      <div
        key={record.key}
        className={`rounded-3xl border-2 border-b-4 p-5 sm:p-6 transition-all bg-white dark:bg-slate-900 ${
          record.mastered
            ? 'border-[#58CC02] border-b-[#46A302]'
            : 'border-slate-200 dark:border-slate-800 border-b-slate-300 dark:border-b-slate-950'
        }`}
      >
        {/* Top Metadata Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {indexLabel && (
              <span className="font-mono font-black text-slate-500 dark:text-slate-400">
                {indexLabel} ·
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 font-black ${
                record.section === 'LISTENING'
                  ? 'text-[#1CB0F6]'
                  : 'text-[#FF9600]'
              }`}
            >
              {record.section === 'LISTENING' ? (
                <Headphones className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span>
                {record.section === 'LISTENING' ? 'Listening' : 'Reading'} Part {record.partNumber}
              </span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-black text-slate-800 dark:text-slate-200">
              Câu {relNum} (Mã #{record.questionId})
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-bold text-slate-500 dark:text-slate-400">
              {record.testTitle}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              Đã sai {record.wrongCount} lần (Chọn nhầm: {record.userWrongAnswer})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const cleanPrompt = (q.prompt || q.notesData?.label || '').replace(
                  /<\/?(?:u|b|strong|mark)>/gi,
                  ''
                );
                const contextSent =
                  (q.evidenceQuote || cleanPrompt || q.audioScript || '')
                    .replace(/<\/?(?:u|b|strong|mark)>/gi, '')
                    .slice(0, 300);
                setQuickSavePayload({
                  initialWord: '',
                  contextSentence: contextSent,
                  sourceLabel: `Sổ tay câu sai · ${
                    record.section === 'LISTENING' ? 'Listening' : 'Reading'
                  } Part ${record.partNumber} (Câu ${relNum})`,
                  testId: record.testId,
                  testTitle: record.testTitle,
                });
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 px-2.5 py-1 text-xs font-black text-[#A560E8] dark:text-purple-300 border border-[#CE82FF] cursor-pointer"
              title="Lưu từ vựng từ câu hỏi này vào Kho Flashcard & Lịch ôn SRS"
            >
              <BookmarkPlus className="h-3.5 w-3.5 text-[#CE82FF]" />
              <span>+ Lưu từ SRS</span>
            </button>

            {record.mastered ? (
              <span className="inline-flex items-center gap-1 rounded-xl bg-[#D7FFB8] dark:bg-emerald-950/80 px-3 py-1 text-xs font-black text-[#2B6600] dark:text-emerald-300 border border-[#58CC02]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#58CC02]" />
                Đã khắc phục
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 px-3 py-1 text-xs font-black text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-[#FF9600]" />
                Cần làm lại
              </span>
            )}

            {hasAnsweredRedo && (
              <button
                type="button"
                onClick={() => handleResetRedoQuestion(record.key)}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                title="Thử làm lại từ đầu"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Làm lại</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDeleteRecord(record.key)}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Xóa câu này khỏi sổ tay"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Context: Reading Passage Excerpt or Listening Script Helper */}
        {(q.readingArticle || q.stimulusCard || q.audioScript) && (
          <div className="mt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              {(q.readingArticle || q.stimulusCard) && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedPassages((prev) => ({
                      ...prev,
                      [record.key]: !prev[record.key],
                    }))
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <BookOpen className="h-3.5 w-3.5 text-[#58CC02]" />
                  <span>
                    {isPassageExpanded
                      ? 'Thu gọn ngữ cảnh bài đọc'
                      : 'Xem bài đọc / ngữ cảnh của câu hỏi'}
                  </span>
                </button>
              )}

              {q.audioScript && (
                <button
                  type="button"
                  onClick={() => examAudioManager.speakText(q.audioScript!)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#DDF4FF]/70 dark:bg-sky-950/60 hover:bg-[#DDF4FF] px-3 py-1.5 text-xs font-black text-[#1899D6] dark:text-sky-300 cursor-pointer"
                >
                  <Volume2 className="h-3.5 w-3.5 text-[#1CB0F6]" />
                  <span>Nghe lại đoạn hội thoại</span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  onStartTest(record.testId, record.section, record.partNumber)
                }
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1CB0F6] hover:underline cursor-pointer ml-auto"
              >
                <span>Mở đề gốc ({record.testTitle}) →</span>
              </button>
            </div>

            {isPassageExpanded && q.readingArticle && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200 space-y-2.5">
                <div className="font-black text-slate-900 dark:text-white">
                  {q.readingArticle.title}
                </div>
                {q.readingArticle.paragraphs.map((p, i) => (
                  <p key={i} className="text-justify">
                    <span className="font-mono text-[11px] font-black text-slate-400 mr-1.5">
                      [Đoạn {i + 1}]
                    </span>
                    {p.replace(/<\/?(?:u|b|strong|mark)>/gi, '')}
                  </p>
                ))}
              </div>
            )}

            {isPassageExpanded && q.stimulusCard && (
              <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 p-4 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {q.stimulusCard.title && (
                  <div className="font-black text-slate-900 dark:text-white mb-1">
                    {q.stimulusCard.title}
                  </div>
                )}
                <p className="whitespace-pre-line">{q.stimulusCard.content}</p>
              </div>
            )}
          </div>
        )}

        {/* Question Prompt */}
        <div className="mt-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-7 min-w-7 px-1.5 shrink-0 items-center justify-center rounded-xl bg-[#58CC02] font-mono text-xs font-black text-white shadow-2xs border-b-2 border-[#3C8C02]">
            {relNum}
          </span>
          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
            {(q.prompt || q.notesData?.label || `Question ${relNum}`).replace(
              /<\/?(?:u|b|strong|mark)>/gi,
              ''
            )}
          </div>
        </div>

        {/* Options Grid for Redo */}
        {options.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {options.map((opt) => {
              const isSelected = currentRedoVal === opt.id;
              const isRightOpt =
                String(q.correctAnswer).trim().toUpperCase() === opt.id.toUpperCase();

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectRedoOption(record, opt.id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 border-b-4 p-3.5 text-left text-xs sm:text-sm font-bold transition-all active:border-b-2 active:translate-y-0.5 cursor-pointer ${
                    hasAnsweredRedo && isRightOpt
                      ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/65 dark:bg-emerald-950/60 text-[#2B6600] dark:text-emerald-200'
                      : hasAnsweredRedo && isSelected && !isRightOpt
                      ? 'border-[#FF4B4B] border-b-[#EA2B2B] bg-[#FFDFE0]/70 dark:bg-rose-950/60 text-rose-950 dark:text-rose-200'
                      : isSelected
                      ? 'border-[#58CC02] border-b-[#46A302] bg-lime-50 dark:bg-lime-950/40'
                      : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[#58CC02]'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-b-2 text-xs font-black ${
                      hasAnsweredRedo && isRightOpt
                        ? 'bg-[#58CC02] border-[#46A302] text-white'
                        : hasAnsweredRedo && isSelected && !isRightOpt
                        ? 'bg-[#FF4B4B] border-[#EA2B2B] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.id}
                  </div>
                  <span className="flex-1">
                    {opt.text.replace(/<\/?(?:u|b|strong|mark)>/gi, '')}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Short Answer / Notes Input Redo */
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Nhập lại câu trả lời đúng..."
              value={currentRedoVal}
              onChange={(e) => handleSelectRedoOption(record, e.target.value)}
              className="flex-1 min-w-[220px] rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
            />
          </div>
        )}

        {/* Instant Explanation & Audio Script after Redo Selection */}
        {hasAnsweredRedo && (
          <div className="mt-4 rounded-2xl bg-lime-50/90 dark:bg-lime-950/40 p-4 border-2 border-lime-300 dark:border-lime-800 text-xs space-y-2.5 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isRedoCorrect ? (
                  <CheckCircle2 className="h-4 w-4 text-[#58CC02]" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#FF4B4B]" />
                )}
                <span
                  className={`font-black text-sm ${
                    isRedoCorrect
                      ? 'text-[#2B6600] dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {isRedoCorrect
                    ? 'Chính xác! Câu hỏi đã được đánh dấu Đã khắc phục.'
                    : `Chưa đúng — Đáp án chuẩn là: ${record.correctAnswer}`}
                </span>
              </div>

              {q.vietnameseTranslation && (
                <button
                  type="button"
                  onClick={() =>
                    setShowTranslations((prev) => ({
                      ...prev,
                      [record.key]: !prev[record.key],
                    }))
                  }
                  className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span>{isTranslated ? 'Ẩn dịch nghĩa' : 'Xem dịch nghĩa'}</span>
                </button>
              )}
            </div>

            {q.audioScript && (
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 p-3 border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="font-black text-[11px] uppercase tracking-wider text-slate-500">
                  Audio Script (Lời thoại):
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 whitespace-pre-line">
                  {q.audioScript}
                </p>
                {q.audioScriptTranslation && (
                  <p className="text-xs italic text-emerald-700 dark:text-emerald-300 pt-1 border-t border-slate-100 dark:border-slate-800">
                    “{q.audioScriptTranslation}”
                  </p>
                )}
              </div>
            )}

            <StructuredExplanationBox
              explanation={q.explanation}
              evidenceQuote={q.evidenceQuote}
              vietnameseTranslation={q.vietnameseTranslation}
              questionPrompt={q.prompt}
              options={q.options}
              hideInlineScript={true}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Summary */}
      <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 border-b-6 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-900 p-6 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-[#FF9600]">
                SỔ TAY KHẮC PHỤC LỖI SAI CÁ NHÂN HÓA
              </span>
              {isCloudSynced && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[11px] font-black text-[#46A302] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Cloud className="h-3 w-3" />
                  Đã đồng bộ Cloud
                </span>
              )}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Kho Câu Hỏi Hay Sai &amp; Làm Lại
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Hệ thống tự động thu thập mọi câu Listening &amp; Reading bạn từng làm sai qua các lần luyện đề để bạn ôn tập lại và lưu trực tiếp từ mới vào kho Flashcard SRS.
            </p>
          </div>

          {filteredRecords.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSprintIndex(0);
                setIsSprintMode((prev) => !prev);
              }}
              className={`${
                isSprintMode ? 'btn-duo-white' : 'btn-duo-green'
              } px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shrink-0 cursor-pointer`}
            >
              {isSprintMode ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  <span>Xem dạng danh sách đầy đủ</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Luyện chuỗi câu đang lọc ({filteredRecords.length} câu)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* 4 KPI Metrics */}
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              Tổng câu từng sai
            </div>
            <div className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-slate-900 dark:text-white">
              {stats.total}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
              Listening: {stats.listeningCount} · Reading: {stats.readingCount} cần ôn
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-4">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Cần làm lại ngay
            </div>
            <div className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-[#FF9600]">
              {stats.needReview}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-amber-700/80 dark:text-amber-400">
              Chọn đúng để chuyển sang Đã khắc phục
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4">
            <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Đã khắc phục
            </div>
            <div className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-[#58CC02]">
              {stats.mastered}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-emerald-700/80 dark:text-emerald-400">
              Đã tự trả lời đúng khi làm lại
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/60 dark:bg-sky-950/30 p-4">
            <div className="text-xs font-bold text-sky-800 dark:text-sky-300">
              Tỉ lệ khắc phục lỗi
            </div>
            <div className="mt-1 font-mono text-2xl sm:text-3xl font-black tabular-nums text-[#1CB0F6]">
              {stats.masteryPct}%
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-sky-700/80 dark:text-sky-400">
              Mục tiêu: Đạt 100% trước ngày thi
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white dark:bg-slate-900 p-4 border-2 border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-500 flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5" /> Kỹ năng:
          </span>
          {(
            [
              { id: 'ALL', label: 'Tất cả kỹ năng' },
              { id: 'LISTENING', label: 'Listening' },
              { id: 'READING', label: 'Reading' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSkillFilter(tab.id);
                setSprintIndex(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                skillFilter === tab.id
                  ? 'bg-[#58CC02] text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'NEED_REVIEW', label: `Cần ôn lại (${stats.needReview})` },
              { id: 'MASTERED', label: `Đã khắc phục (${stats.mastered})` },
              { id: 'ALL', label: `Tất cả (${stats.total})` },
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => {
                setStatusFilter(st.id);
                setSprintIndex(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === st.id
                  ? 'bg-[#1CB0F6] text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}

          {availableTestsInMistakes.length > 1 && (
            <select
              value={testFilter}
              onChange={(e) => {
                setTestFilter(e.target.value);
                setSprintIndex(0);
              }}
              aria-label="Lọc theo bộ đề"
              className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-700 dark:text-slate-200 focus:border-[#58CC02] focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả bộ đề</option>
              {availableTestsInMistakes.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredRecords.length === 0 ? (
        <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D7FFB8]/60 dark:bg-emerald-950/60 text-[#58CC02] border-2 border-[#58CC02]">
            <Award className="h-8 w-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {isLoadingHistory
              ? 'Đang đồng bộ dữ liệu câu hỏi từ lịch sử làm bài...'
              : statusFilter === 'NEED_REVIEW' && stats.total > 0
              ? 'Tuyệt vời! Bạn đã khắc phục toàn bộ các câu hỏi từng làm sai!'
              : 'Chưa có câu hỏi sai nào trong danh mục này'}
          </h3>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {statusFilter === 'NEED_REVIEW' && stats.total > 0
              ? 'Bạn có thể chuyển bộ lọc sang tab "Đã khắc phục" hoặc "Tất cả" để ôn tập lại bất cứ lúc nào.'
              : 'Khi bạn làm bài ở Chế độ Luyện tập hoặc Thi thử, các câu trả lời chưa chính xác sẽ tự động được lưu vào đây kèm giải thích chi tiết.'}
          </p>
        </div>
      ) : isSprintMode ? (
        /* Focused 1-by-1 Redo Sprint Mode */
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-slate-900 text-white px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
              <Sparkles className="h-4 w-4 text-[#FFC800]" />
              <span>
                Chế độ Luyện Chuỗi Câu Sai · Câu {Math.min(sprintIndex + 1, filteredRecords.length)} /{' '}
                {filteredRecords.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={sprintIndex <= 0}
                onClick={() => setSprintIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 text-xs font-black cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Câu trước
              </button>
              <button
                type="button"
                disabled={sprintIndex >= filteredRecords.length - 1}
                onClick={() =>
                  setSprintIndex((i) => Math.min(filteredRecords.length - 1, i + 1))
                }
                className="inline-flex items-center gap-1 rounded-xl bg-[#58CC02] hover:bg-[#46A302] disabled:opacity-40 px-3 py-1.5 text-xs font-black text-white cursor-pointer"
              >
                Câu tiếp <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {renderMistakeCard(
            filteredRecords[Math.min(sprintIndex, filteredRecords.length - 1)],
            `#${Math.min(sprintIndex + 1, filteredRecords.length)}`
          )}
        </div>
      ) : (
        /* Full Mistake Cards List */
        <div className="space-y-4">
          {filteredRecords.map((rec, idx) => renderMistakeCard(rec, `#${idx + 1}`))}
        </div>
      )}

      {/* Quick Save Vocab SRS Modal */}
      <QuickSaveVocabModal
        isOpen={Boolean(quickSavePayload)}
        onClose={() => setQuickSavePayload(null)}
        payload={quickSavePayload}
      />
    </div>
  );
};
