import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Clock,
  Volume2,
  Trash2,
  Languages,
  Info,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  SpeakingTask,
  SpeakingSubmission,
  SAMPLE_VSTEP_SPEAKING_TASKS,
} from '../types/speaking';
import {
  persistSpeakingAudioBlob,
  resolvePlayableAudioUrl,
} from '../utils/audioStorageService';

interface SpeakingSectionStageProps {
  tasks?: SpeakingTask[];
  submission: SpeakingSubmission;
  activePartIndex?: 0 | 1 | 2;
  onPartIndexChange?: (idx: 0 | 1 | 2) => void;
  isReviewMode?: boolean;
  isPracticeMode?: boolean;
  mode?: 'exam' | 'practice';
  onChange: (submission: SpeakingSubmission) => void;
  onProceedToSubmit?: () => void;
  onProceedToReview?: () => void;
}

export const SpeakingSectionStage: React.FC<SpeakingSectionStageProps> = ({
  tasks = SAMPLE_VSTEP_SPEAKING_TASKS,
  submission,
  activePartIndex: controlledIndex,
  onPartIndexChange,
  isReviewMode = false,
  isPracticeMode = false,
  mode = isPracticeMode ? 'practice' : 'exam',
  onChange,
  onProceedToSubmit,
  onProceedToReview,
}) => {
  const handleProceed = onProceedToSubmit || onProceedToReview || (() => {});
  const [internalPartIndex, setInternalPartIndex] = useState<0 | 1 | 2>(0);
  const [showSampleAnswer, setShowSampleAnswer] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // Recording & Speech-to-Text state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sttSupported, setSttSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);

  // VSTEP Part Prep / Speak Timer
  const [timerPhase, setTimerPhase] = useState<'idle' | 'prep' | 'speak'>('idle');
  const [phaseSecondsLeft, setPhaseSecondsLeft] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecRef = useRef<any>(null);
  const recordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submissionRef = useRef<SpeakingSubmission>(submission);

  useEffect(() => {
    submissionRef.current = submission;
  }, [submission]);

  const activePartIndex =
    controlledIndex !== undefined ? controlledIndex : internalPartIndex;

  const setActivePartIndex = (idx: 0 | 1 | 2) => {
    if (isRecording) {
      stopRecordingSession();
    }
    setTimerPhase('idle');
    setInternalPartIndex(idx);
    onPartIndexChange?.(idx);
  };

  const activeTasks =
    tasks && tasks.length >= 3 ? tasks : SAMPLE_VSTEP_SPEAKING_TASKS;
  const task = activeTasks[activePartIndex] || activeTasks[0];

  const currentText =
    activePartIndex === 0
      ? submission.part1Text
      : activePartIndex === 1
      ? submission.part2Text
      : submission.part3Text;

  const currentWordCount =
    activePartIndex === 0
      ? submission.part1WordCount
      : activePartIndex === 1
      ? submission.part2WordCount
      : submission.part3WordCount;

  const currentAudioUrl =
    activePartIndex === 0
      ? submission.part1AudioUrl
      : activePartIndex === 1
      ? submission.part2AudioUrl
      : submission.part3AudioUrl;

  const currentAudioDataUrl =
    activePartIndex === 0
      ? submission.part1AudioDataUrl
      : activePartIndex === 1
      ? submission.part2AudioDataUrl
      : submission.part3AudioDataUrl;

  const [resolvedAudioSrc, setResolvedAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const rawSource = currentAudioUrl || currentAudioDataUrl || '';
    if (!rawSource) {
      setResolvedAudioSrc(null);
      return;
    }
    resolvePlayableAudioUrl(rawSource).then((playable) => {
      if (!cancelled) {
        setResolvedAudioSrc(playable || rawSource);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activePartIndex, currentAudioUrl, currentAudioDataUrl]);

  const currentDurationSec =
    activePartIndex === 0
      ? submission.part1DurationSec
      : activePartIndex === 1
      ? submission.part2DurationSec
      : submission.part3DurationSec;

  const countWords = (text: string): number => {
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  };

  const updateCurrentPartSubmission = (
    partial: Partial<{
      text: string;
      audioUrl: string | undefined;
      audioDataUrl: string | undefined;
      durationSec: number;
    }>
  ) => {
    const latest = submissionRef.current;
    const nextText = partial.text !== undefined ? partial.text : currentText;
    const nextWords = countWords(nextText);
    const nextAudio =
      'audioUrl' in partial ? partial.audioUrl : currentAudioUrl;
    const nextAudioDataUrl =
      'audioDataUrl' in partial ? partial.audioDataUrl : currentAudioDataUrl;
    const nextDur =
      partial.durationSec !== undefined
        ? partial.durationSec
        : currentDurationSec || 0;

    if (activePartIndex === 0) {
      onChange({
        ...latest,
        part1Text: nextText,
        part1WordCount: nextWords,
        part1AudioUrl: nextAudio,
        part1AudioDataUrl: nextAudioDataUrl,
        part1DurationSec: nextDur,
      });
    } else if (activePartIndex === 1) {
      onChange({
        ...latest,
        part2Text: nextText,
        part2WordCount: nextWords,
        part2AudioUrl: nextAudio,
        part2AudioDataUrl: nextAudioDataUrl,
        part2DurationSec: nextDur,
      });
    } else {
      onChange({
        ...latest,
        part3Text: nextText,
        part3WordCount: nextWords,
        part3AudioUrl: nextAudio,
        part3AudioDataUrl: nextAudioDataUrl,
        part3DurationSec: nextDur,
      });
    }
  };

  // Phase countdown timer (Prep 1m / Speak 3-4m)
  useEffect(() => {
    if (timerPhase === 'idle') return;
    const interval = setInterval(() => {
      setPhaseSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerPhase === 'prep') {
            setTimerPhase('speak');
            return task.speakSeconds || 180;
          }
          setTimerPhase('idle');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerPhase, task.speakSeconds]);

  // Cleanup on unmount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttSupported(false);
    }
    return () => {
      stopRecordingSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecordingSession = async () => {
    if (isReviewMode) return;
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      let recorderOptions: MediaRecorderOptions | undefined = undefined;
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          recorderOptions = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24000 };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          recorderOptions = { mimeType: 'audio/webm', audioBitsPerSecond: 24000 };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          recorderOptions = { mimeType: 'audio/mp4', audioBitsPerSecond: 24000 };
        }
      }
      const mediaRecorder = recorderOptions
        ? new MediaRecorder(stream, recorderOptions)
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      let elapsed = 0;
      setRecordingSeconds(0);
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = setInterval(() => {
        elapsed += 1;
        setRecordingSeconds(elapsed);
      }, 1000);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (recordIntervalRef.current) {
          clearInterval(recordIntervalRef.current);
          recordIntervalRef.current = null;
        }
        if (audioChunksRef.current.length > 0) {
          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const { playableUrl, persistentDataUrl } = await persistSpeakingAudioBlob(
            blob,
            task.partNumber
          );
          updateCurrentPartSubmission({
            audioUrl: playableUrl,
            audioDataUrl: persistentDataUrl,
            durationSec: Math.max(1, elapsed),
          });
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start Web Speech API live Speech-to-Text if available
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          let newTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              newTranscript += event.results[i][0].transcript + ' ';
            }
          }
          if (newTranscript.trim()) {
            const currentVal =
              activePartIndex === 0
                ? submissionRef.current.part1Text
                : activePartIndex === 1
                ? submissionRef.current.part2Text
                : submissionRef.current.part3Text;
            const combined = (currentVal ? currentVal.trim() + ' ' : '') + newTranscript.trim();
            updateCurrentPartSubmission({ text: combined });
          }
        };

        recognition.onerror = () => {
          // Keep audio recording running even if STT encounters a pause
        };

        try {
          recognition.start();
          speechRecRef.current = recognition;
        } catch {
          // Ignore duplicate start
        }
      }
    } catch (err) {
      console.warn('Microphone access error:', err);
      setMicError(
        'Không thể truy cập Micro. Vui lòng cấp quyền Micro trên trình duyệt hoặc nhập trực tiếp câu trả lời vào khung văn bản bên dưới.'
      );
      setIsRecording(false);
    }
  };

  const stopRecordingSession = () => {
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // Ignore
      }
      speechRecRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    setIsRecording(false);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const partSubtitleLabel =
    task.partNumber === 1
      ? "Social Interaction (3')"
      : task.partNumber === 2
      ? "Solution Discussion (4')"
      : "Topic Development (5')";

  const targetMinWords =
    task.partNumber === 1 ? 50 : task.partNumber === 2 ? 80 : 110;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      {/* Official VSTEP Speaking Paper Header Banner */}
      <div className="mb-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <div className="inline-block border-y-2 border-slate-800 dark:border-slate-200 px-8 py-1 mb-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-[0.2em] text-slate-900 dark:text-white uppercase">
              SPEAKING
            </h2>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-extrabold text-slate-700 dark:text-slate-300">
            <span>Time allotted: 12 minutes</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Number of parts: 3</span>
          </div>
        </div>

        {/* Part 1 / Part 2 / Part 3 Selector Tabs */}
        <div className="flex flex-col sm:items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {activeTasks.map((t, idx) => {
              const pIdx = idx as 0 | 1 | 2;
              const words =
                pIdx === 0
                  ? submission.part1WordCount
                  : pIdx === 1
                  ? submission.part2WordCount
                  : submission.part3WordCount;
              const hasAudio =
                pIdx === 0
                  ? Boolean(submission.part1AudioUrl || submission.part1AudioDataUrl)
                  : pIdx === 1
                  ? Boolean(submission.part2AudioUrl || submission.part2AudioDataUrl)
                  : Boolean(submission.part3AudioUrl || submission.part3AudioDataUrl);
              const done = words > 0 || hasAudio;

              return (
                <button
                  key={t.id || idx}
                  type="button"
                  onClick={() => setActivePartIndex(pIdx)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition-all cursor-pointer ${
                    activePartIndex === pIdx
                      ? 'bg-[#2E7D32] text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>
                    Part {t.partNumber} ({t.durationMinutes}&apos;)
                  </span>
                  {done && (
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        activePartIndex === pIdx ? 'text-lime-200' : 'text-emerald-500'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <Info className="h-3.5 w-3.5 text-[#58CC02]" />
            <span>
              Chấm tự động thang 10 VSTEP (Grammar · Vocabulary · Pronunciation · Fluency · Discourse)
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Authentic VSTEP Speaking Paper Prompt & Mind-Map Diagram */}
        <div className="lg:col-span-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-[#FCFDFD] dark:bg-slate-900 p-6 shadow-xs space-y-5">
          {/* Official VSTEP Book Part Pill Header (Matches uploaded image: [ PART (1) | Social Interaction (3') ]) */}
          <div className="flex items-center justify-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="inline-flex items-center">
              <div className="flex items-center rounded-l-full border-2 border-slate-700 bg-white dark:bg-slate-800 pl-3.5 pr-2 py-1 text-xs font-black tracking-wider text-slate-900 dark:text-white uppercase">
                PART
              </div>
              <div className="-ml-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-800 bg-slate-800 text-white font-black text-sm shadow-xs">
                {task.partNumber}
              </div>
              <div className="-ml-2 flex items-center rounded-r-full bg-slate-700 pl-4 pr-4 py-1 text-xs font-bold text-white shadow-xs">
                {partSubtitleLabel}
              </div>
            </div>

            {task.vietnameseTranslation && (
              <button
                type="button"
                onClick={() => setShowTranslation((prev) => !prev)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              >
                <Languages className="h-3.5 w-3.5 text-emerald-600" />
                <span>{showTranslation ? 'Ẩn dịch đề' : 'Dịch đề bài'}</span>
              </button>
            )}
          </div>

          {/* PART 1: Social Interaction (2 Topic Clusters) */}
          {task.partNumber === 1 && (
            <div className="space-y-5 font-serif text-slate-900 dark:text-slate-100">
              {(task.topicClusters || []).map((cluster, cIdx) => (
                <div
                  key={cIdx}
                  className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/60 p-4 space-y-2.5 shadow-2xs"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {cluster.topicTitle}
                  </h3>
                  <ul className="space-y-2 pl-2 text-sm text-slate-800 dark:text-slate-200">
                    {(cluster.questions || [])
                      .filter((q) => q.trim().length > 0)
                      .map((q, qIdx) => (
                        <li key={qIdx} className="flex items-start gap-2.5 leading-relaxed">
                          <span className="font-bold text-slate-500 select-none">-</span>
                          <span>{q}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* PART 2: Solution Discussion (Situation + 3 Options) */}
          {task.partNumber === 2 && (
            <div className="space-y-4 font-serif text-slate-900 dark:text-slate-100">
              <div className="rounded-2xl border-2 border-dashed border-slate-400 dark:border-slate-600 bg-slate-50/90 dark:bg-slate-800/70 p-5 text-sm leading-relaxed">
                <span className="font-black underline mr-1.5">Situation:</span>
                <span>{task.situation}</span>
              </div>

              {task.options && task.options.some((o) => o.trim().length > 0) && (
                <div className="space-y-2 font-sans">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ba phương án thảo luận (Three suggested options):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {task.options
                      .filter((o) => o.trim().length > 0)
                      .map((opt, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-center"
                        >
                          <span className="block text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">
                            Option {idx + 1}
                          </span>
                          <span className="mt-0.5 block text-xs font-black text-slate-900 dark:text-white">
                            {opt}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PART 3: Topic Development + Authentic VSTEP Mind-Map Diagram + Follow-up Questions */}
          {task.partNumber === 3 && (
            <div className="space-y-5 font-serif text-slate-900 dark:text-slate-100">
              {/* Topic Statement */}
              <div className="text-base sm:text-lg text-slate-900 dark:text-white">
                <span className="font-black">Topic: </span>
                <span className="font-medium">{task.topicStatement}</span>
              </div>

              {/* Authentic VSTEP Mind-Map Diagram matching uploaded textbook scan */}
              {task.mindMap && (
                <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-4 sm:p-6 font-sans shadow-inner">
                  {/* Top Row: Left Node — Horizontal Line — Central Node — Horizontal Line — Right Node */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-0">
                    {/* Left Branch Node (Node 0) */}
                    <div className="w-full sm:w-44 min-h-[64px] flex items-center justify-center rounded-2xl border-2 border-slate-400 dark:border-slate-500 bg-[#F8FAF5] dark:bg-slate-800 px-3.5 py-2.5 text-center text-xs sm:text-sm font-bold text-slate-900 dark:text-white shadow-2xs">
                      {task.mindMap.nodes[0] || 'Idea 1'}
                    </div>

                    {/* Connector Line */}
                    <div className="h-5 w-0.5 sm:h-0.5 sm:w-8 bg-slate-700 dark:bg-slate-400 shrink-0" />

                    {/* Central Topic Box */}
                    <div className="w-full sm:w-48 min-h-[68px] flex items-center justify-center rounded-2xl border-2 border-slate-700 dark:border-emerald-400 bg-[#F1F6EC] dark:bg-emerald-950/70 px-4 py-3 text-center text-sm sm:text-base font-black text-slate-950 dark:text-lime-200 shadow-xs">
                      {task.mindMap.centralIdea || task.mindMap.centerTopic || 'Central Topic'}
                    </div>

                    {/* Connector Line */}
                    <div className="h-5 w-0.5 sm:h-0.5 sm:w-8 bg-slate-700 dark:bg-slate-400 shrink-0" />

                    {/* Right Branch Node (Node 1) */}
                    <div className="w-full sm:w-44 min-h-[64px] flex items-center justify-center rounded-2xl border-2 border-slate-400 dark:border-slate-500 bg-[#F8FAF5] dark:bg-slate-800 px-3.5 py-2.5 text-center text-xs sm:text-sm font-bold text-slate-900 dark:text-white shadow-2xs">
                      {task.mindMap.nodes[1] || 'Idea 2'}
                    </div>
                  </div>

                  {/* Bottom Branch Node(s) connected vertically from the Central Topic Box */}
                  {task.mindMap.nodes.length >= 3 && (
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-6 w-0.5 bg-slate-700 dark:bg-slate-400" />
                      <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="w-full sm:w-48 min-h-[64px] flex items-center justify-center rounded-2xl border-2 border-slate-400 dark:border-slate-500 bg-[#F8FAF5] dark:bg-slate-800 px-4 py-2.5 text-center text-xs sm:text-sm font-bold text-slate-900 dark:text-white shadow-2xs">
                          {task.mindMap.nodes[2] || 'Idea 3'}
                        </div>
                        {task.mindMap.nodes[3] && task.mindMap.nodes[3].trim().length > 0 && (
                          <div className="w-full sm:w-44 min-h-[64px] flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-center text-xs font-bold italic text-slate-600 dark:text-slate-300">
                            {task.mindMap.nodes[3]}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Follow-up Discussion Questions */}
              {task.followUpQuestions &&
                task.followUpQuestions.some((q) => q.trim().length > 0) && (
                  <div className="space-y-2.5 pt-1">
                    <ul className="space-y-2.5 pl-2 text-sm text-slate-800 dark:text-slate-200">
                      {task.followUpQuestions
                        .filter((q) => q.trim().length > 0)
                        .map((fq, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                            <span className="font-bold text-slate-500 select-none">-</span>
                            <span>{fq}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* Vietnamese Translation Box */}
          {showTranslation && task.vietnameseTranslation && (
            <div className="rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50/70 dark:bg-sky-950/40 p-4 text-xs text-sky-950 dark:text-sky-200 whitespace-pre-line leading-relaxed">
              <div className="font-black uppercase tracking-wider text-[11px] text-sky-700 dark:text-sky-300 mb-1">
                Bản dịch tiếng Việt đề Speaking Part {task.partNumber}:
              </div>
              {task.vietnameseTranslation}
            </div>
          )}

          {/* Sample Answer Toggle in Practice Mode & Review Mode */}
          {(isReviewMode || mode === 'practice') && task.sampleAnswer && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSampleAnswer((prev) => !prev)}
                className="w-full inline-flex items-center justify-between rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-black text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    {showSampleAnswer
                      ? 'Ẩn bài nói mẫu'
                      : `Xem bài nói mẫu Part ${task.partNumber} chuẩn B2–C1 (Sample Answer)`}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 underline">
                  {showSampleAnswer ? 'Thu gọn' : 'Bấm để xem'}
                </span>
              </button>

              {showSampleAnswer && (
                <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/95 dark:bg-emerald-950/60 p-4 text-xs text-emerald-950 dark:text-emerald-100 space-y-2 shadow-xs">
                  <div className="flex items-center justify-between font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Bài nói mẫu gợi ý chuẩn VSTEP Part {task.partNumber}
                    </span>
                    <span className="rounded-md bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 text-[10px] font-mono text-emerald-900 dark:text-emerald-100">
                      B2 – C1 Band
                    </span>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed font-medium bg-white/80 dark:bg-slate-900/70 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    {task.sampleAnswer}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Interactive Recording Studio + Speech-to-Text + Text Input */}
        <div className="lg:col-span-6 rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            {/* Studio Header & VSTEP Countdown Timers */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-[#2E7D32] dark:text-lime-300">
                  <Mic className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-xs font-black text-slate-900 dark:text-white">
                    Phòng thu Speaking Part {task.partNumber} (Micro + Speech-to-Text)
                  </span>
                  <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Thu âm giọng nói kết hợp chuyển giọng nói thành văn bản để chấm tự động
                  </span>
                </div>
              </div>

              <span
                className={`rounded-xl px-3 py-1 font-mono text-xs font-black ${
                  currentWordCount >= targetMinWords || Boolean(currentAudioUrl)
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {currentWordCount} / khuyến nghị ≥{targetMinWords} từ
              </span>
            </div>

            {/* VSTEP Preparation (1m) & Speaking (3-4m) Timer Bar */}
            {!isReviewMode && (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Clock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  {timerPhase === 'idle' ? (
                    <span>
                      Đồng hồ luyện phản xạ:{' '}
                      {task.prepSeconds > 0
                        ? `1 phút chuẩn bị + ${ Math.round(task.speakSeconds / 60) } phút nói`
                        : `${task.durationMinutes} phút trả lời trực tiếp`}
                    </span>
                  ) : (
                    <span className="font-black text-indigo-700 dark:text-indigo-300">
                      {timerPhase === 'prep'
                        ? `⏳ Thời gian chuẩn bị dàn ý: ${formatTimer(phaseSecondsLeft)}`
                        : `🎙️ Thời gian trình bày bài nói: ${formatTimer(phaseSecondsLeft)}`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {task.prepSeconds > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setTimerPhase('prep');
                        setPhaseSecondsLeft(task.prepSeconds);
                      }}
                      className="rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer"
                    >
                      Bấm giờ Chuẩn bị (1&apos;)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTimerPhase('speak');
                      setPhaseSecondsLeft(task.speakSeconds || 180);
                    }}
                    className="rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-900 px-2.5 py-1 text-[11px] font-black transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    <span>Bấm giờ Nói ({Math.round((task.speakSeconds || 180) / 60)}&apos;)</span>
                  </button>
                  {timerPhase !== 'idle' && (
                    <button
                      type="button"
                      onClick={() => setTimerPhase('idle')}
                      className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 text-[11px] font-bold cursor-pointer"
                      title="Đặt lại đồng hồ"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Microphone Record Button & Live Audio Player */}
            {!isReviewMode && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecordingSession}
                    className="flex-1 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 px-5 py-3.5 text-xs sm:text-sm font-black text-white shadow-md border-b-3 border-rose-800 active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    <Mic className="h-4 w-4" />
                    <span>
                      Bắt đầu Ghi âm Giọng nói {sttSupported ? '& Speech-to-Text' : ''}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecordingSession}
                    className="flex-1 inline-flex items-center justify-center gap-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 px-5 py-3.5 text-xs sm:text-sm font-black text-white shadow-md animate-pulse cursor-pointer"
                  >
                    <Square className="h-4 w-4 fill-rose-500 text-rose-500" />
                    <span>
                      Đang thu âm ({formatTimer(recordingSeconds)}) — Bấm để Dừng & Lưu
                    </span>
                  </button>
                )}
              </div>
            )}

            {micError && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                {micError}
              </div>
            )}

            {/* Recorded Audio Playback Bar */}
            {(resolvedAudioSrc || currentAudioUrl || currentAudioDataUrl) && (
              <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-900 dark:text-emerald-200">
                  <Volume2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    Bản ghi âm Part {task.partNumber}{' '}
                    {currentDurationSec ? `(${currentDurationSec}s)` : ''}
                  </span>
                  {currentAudioDataUrl && (
                    <span className="rounded-md bg-emerald-200/80 dark:bg-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:text-emerald-100">
                      Đã đồng bộ Cloud
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <audio
                    controls
                    src={resolvedAudioSrc || currentAudioUrl || currentAudioDataUrl}
                    className="h-9 w-full max-w-xs"
                  />
                  {!isReviewMode && (
                    <button
                      type="button"
                      onClick={() =>
                        updateCurrentPartSubmission({
                          audioUrl: undefined,
                          audioDataUrl: undefined,
                          durationSec: 0,
                        })
                      }
                      className="rounded-xl p-2 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                      title="Xóa bản thu âm này"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Speech-to-Text Transcript & Manual Response Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
                Nội dung bài nói (Tự động điền từ Giọng nói hoặc nhập/chỉnh sửa trực tiếp):
              </label>
              <textarea
                rows={11}
                readOnly={isReviewMode}
                value={currentText}
                onChange={(e) =>
                  updateCurrentPartSubmission({ text: e.target.value })
                }
                placeholder={
                  activePartIndex === 0
                    ? "Bấm 'Bắt đầu Ghi âm' và trả lời bằng tiếng Anh, hoặc nhập câu trả lời của bạn tại đây...\nVí dụ: In my free time, I enjoy reading books and jogging in the park because..."
                    : activePartIndex === 1
                    ? "Trình bày giải pháp bạn chọn và lý do không chọn 2 phương án còn lại...\nVí dụ: Among the three means of transport to Sapa, I think travelling by coach is the best choice because..."
                    : "Phát triển chủ đề theo sơ đồ tư duy (Mind-map) bên trái và trả lời 3 câu hỏi phụ...\nVí dụ: I strongly agree that travelling brings many benefits to our lives. First of all, it helps us relax..."
                }
                className="w-full rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 p-4 font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-100 outline-hidden transition-all focus:border-[#58CC02] focus:bg-white dark:focus:bg-slate-900 resize-none"
              />
            </div>
          </div>

          {/* Bottom Part Navigation Buttons */}
          {!isReviewMode && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              {activePartIndex > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setActivePartIndex((activePartIndex - 1) as 0 | 1 | 2)
                  }
                  className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Quay lại Speaking Part {activePartIndex}
                </button>
              ) : (
                <div />
              )}

              {activePartIndex < 2 ? (
                <button
                  type="button"
                  onClick={() =>
                    setActivePartIndex((activePartIndex + 1) as 0 | 1 | 2)
                  }
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-[#58CC02] px-5 py-2.5 text-xs font-black text-white shadow-xs hover:bg-[#46a302] active:scale-95 transition-all cursor-pointer"
                >
                  <span>Chuyển sang Speaking Part {activePartIndex + 2}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (isRecording) stopRecordingSession();
                    handleProceed();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-[#2E7D32] px-6 py-2.5 text-xs font-black text-white shadow-xs hover:bg-[#1B5E20] active:scale-95 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Nộp bài & Chấm điểm 4 Kỹ năng VSTEP</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
