import React, { useState, useEffect, useRef } from 'react';
import {
  Headphones,
  Mic,
  Volume2,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  X,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface EquipmentCheckModalProps {
  isOpen: boolean;
  testTitle: string;
  mode: 'exam' | 'practice';
  needsListening: boolean;
  needsSpeaking: boolean;
  onClose: () => void;
  onConfirmEnterRoom: (skipFutureChecksInSession: boolean) => void;
}

export const EquipmentCheckModal: React.FC<EquipmentCheckModalProps> = ({
  isOpen,
  testTitle,
  mode,
  needsListening,
  needsSpeaking,
  onClose,
  onConfirmEnterRoom,
}) => {
  const [speakerPlaying, setSpeakerPlaying] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(85);
  const [speakerVerified, setSpeakerVerified] = useState(false);

  const [micStatus, setMicStatus] = useState<'idle' | 'recording' | 'recorded' | 'error'>('idle');
  const [micErrorMsg, setMicErrorMsg] = useState<string>('');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [micRecordSeconds, setMicRecordSeconds] = useState<number>(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [isReplayingMic, setIsReplayingMic] = useState<boolean>(false);
  const [micVerified, setMicVerified] = useState<boolean>(false);
  const [rememberInSession, setRememberInSession] = useState<boolean>(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const replayAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakerOscTimerRef = useRef<number | null>(null);

  const cleanupMedia = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (speakerOscTimerRef.current) {
      window.clearTimeout(speakerOscTimerRef.current);
      speakerOscTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // Ignore
      }
      audioCtxRef.current = null;
    }
    if (replayAudioRef.current) {
      replayAudioRef.current.pause();
      replayAudioRef.current = null;
    }
    setSpeakerPlaying(false);
    setIsReplayingMic(false);
  };

  useEffect(() => {
    if (!isOpen) {
      cleanupMedia();
      return;
    }
    setSpeakerPlaying(false);
    setMicStatus('idle');
    setMicErrorMsg('');
    setMicLevel(0);
    setMicRecordSeconds(0);
    return () => {
      cleanupMedia();
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (recordedAudioUrl) {
        URL.revokeObjectURL(recordedAudioUrl);
      }
    };
  }, [recordedAudioUrl]);

  if (!isOpen) return null;

  // Play a clean harmonic VSTEP test chime using Web Audio API so it works 100% offline/online without external file dependency
  const handleTestSpeaker = () => {
    if (speakerPlaying) {
      if (speakerOscTimerRef.current) {
        window.clearTimeout(speakerOscTimerRef.current);
        speakerOscTimerRef.current = null;
      }
      setSpeakerPlaying(false);
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5]; // C5 - E5 - G5 - C6
      const gainScale = Math.max(0.05, speakerVolume / 100) * 0.25;

      setSpeakerPlaying(true);
      setSpeakerVerified(true);

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.32);

        gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.32);
        gain.gain.exponentialRampToValueAtTime(gainScale, ctx.currentTime + idx * 0.32 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.32 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + idx * 0.32);
        osc.stop(ctx.currentTime + idx * 0.32 + 0.3);
      });

      speakerOscTimerRef.current = window.setTimeout(() => {
        setSpeakerPlaying(false);
        try {
          ctx.close();
        } catch {
          // Ignore
        }
      }, notes.length * 320 + 150);
    } catch {
      setSpeakerPlaying(false);
      setSpeakerVerified(true);
    }
  };

  // Start 5-second Microphone Recording & Live WebAudio Analyser
  const handleStartMicTest = async () => {
    if (micStatus === 'recording') {
      handleStopMicTest();
      return;
    }

    setMicErrorMsg('');
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
      setRecordedAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 140) * 100));
        setMicLevel(normalized);
        if (normalized > 8) {
          setMicVerified(true);
        }
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      animFrameRef.current = requestAnimationFrame(updateMeter);

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedAudioUrl(url);
        }
        setMicStatus('recorded');
        setMicVerified(true);
        setMicLevel(0);
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
      };

      recorder.start();
      setMicStatus('recording');
      setMicRecordSeconds(5);

      recordTimerRef.current = window.setInterval(() => {
        setMicRecordSeconds((prev) => {
          if (prev <= 1) {
            handleStopMicTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      setMicStatus('error');
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Trình duyệt đang chặn quyền Micro. Vui lòng cấp quyền Micro trên thanh địa chỉ trình duyệt hoặc bấm "Bỏ qua kiểm tra" nếu chưa thi Speaking.'
          : 'Không tìm thấy thiết bị Micro trên máy tính của bạn.';
      setMicErrorMsg(message);
    }
  };

  const handleStopMicTest = () => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore
      }
    }
  };

  const handleReplayRecordedMic = () => {
    if (!recordedAudioUrl) return;
    if (isReplayingMic && replayAudioRef.current) {
      replayAudioRef.current.pause();
      setIsReplayingMic(false);
      return;
    }
    const audio = new Audio(recordedAudioUrl);
    replayAudioRef.current = audio;
    setIsReplayingMic(true);
    audio.onended = () => setIsReplayingMic(false);
    audio.onerror = () => setIsReplayingMic(false);
    audio.play().catch(() => setIsReplayingMic(false));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-2xl border-2 border-[#E5E5E5] border-b-8 border-b-[#CECECE] dark:border-slate-700 dark:border-b-slate-950 my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b-2 border-[#F0F0F0] dark:border-slate-800">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#DDF4FF] dark:bg-sky-950 text-[#1899D6] dark:text-sky-300 border-2 border-[#1CB0F6] border-b-3 border-b-[#1899D6] text-[11px] font-black mb-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              KIỂM TRA THIẾT BỊ CHUẨN PHÒNG THI VSTEP
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-[#3C3C3C] dark:text-white">
              Kiểm tra Tai nghe &amp; Micro trước giờ thi
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Đề thi: <span className="text-slate-800 dark:text-slate-200">{testTitle}</span> · Chế độ:{' '}
              {mode === 'exam' ? 'Thi thử bấm giờ' : 'Luyện tập'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              cleanupMedia();
              onClose();
            }}
            className="btn-duo-white p-2 rounded-xl text-slate-500 hover:text-slate-800 cursor-pointer"
            title="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1 & Step 2 Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1: Headphone / Speaker Check */}
          <div
            className={`rounded-2xl border-2 border-b-4 p-4 transition-all flex flex-col justify-between ${
              speakerVerified
                ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/25 dark:bg-emerald-950/30'
                : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/70 dark:bg-slate-800/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1CB0F6] text-white shadow-2xs">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      Bước 1 · Tai nghe / Loa
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {needsListening ? 'Bắt buộc cho phần Listening' : 'Khuyến nghị kiểm tra'}
                    </div>
                  </div>
                </div>
                {speakerVerified && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#58CC02] px-2 py-0.5 text-[10px] font-black text-white">
                    <CheckCircle2 className="h-3 w-3" /> Đã nghe rõ
                  </span>
                )}
              </div>

              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                Đeo tai nghe hoặc bật loa, sau đó bấm nút bên dưới để nghe âm thanh kiểm tra tần số chuẩn.
              </p>

              {/* Volume Control */}
              <div className="mt-3.5 rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1">
                    <Volume2 className="h-3.5 w-3.5 text-[#1CB0F6]" />
                    Âm lượng kiểm tra
                  </span>
                  <span className="font-mono tabular-nums">{speakerVolume}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={speakerVolume}
                  onChange={(e) => setSpeakerVolume(Number(e.target.value))}
                  aria-label="Âm lượng kiểm tra"
                  className="w-full accent-[#1CB0F6] cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={handleTestSpeaker}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all cursor-pointer ${
                  speakerPlaying
                    ? 'bg-amber-500 border-amber-600 text-white'
                    : 'bg-[#1CB0F6] hover:bg-[#1899D6] border-[#1899D6] text-white'
                }`}
              >
                {speakerPlaying ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>Đang phát âm thanh mẫu...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-white" />
                    <span>Phát âm thanh kiểm tra Loa</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Microphone & Waveform Check */}
          <div
            className={`rounded-2xl border-2 border-b-4 p-4 transition-all flex flex-col justify-between ${
              micVerified
                ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/25 dark:bg-emerald-950/30'
                : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-slate-50/70 dark:bg-slate-800/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF4B4B] text-white shadow-2xs">
                    <Mic className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                      Bước 2 · Micro thu âm
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {needsSpeaking ? 'Dành cho phần thi Speaking' : 'Tùy chọn kiểm tra'}
                    </div>
                  </div>
                </div>
                {micVerified && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[#58CC02] px-2 py-0.5 text-[10px] font-black text-white">
                    <CheckCircle2 className="h-3 w-3" /> Mic hoạt động tốt
                  </span>
                )}
              </div>

              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                Bấm thu thử 5 giây và nói <span className="font-bold italic">"Hello VSTEP, testing 1 2 3"</span> để kiểm tra sóng âm Micro.
              </p>

              {/* Live Audio Level Meter */}
              <div className="mt-3.5 rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  <span>Cường độ tín hiệu Micro</span>
                  <span className="font-mono tabular-nums text-[#58CC02]">
                    {micStatus === 'recording' ? `${micLevel}% (${micRecordSeconds}s)` : micVerified ? 'Tốt' : '0%'}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                  <div
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                    className={`h-full rounded-full transition-all duration-75 ${
                      micLevel > 60
                        ? 'bg-[#58CC02]'
                        : micLevel > 15
                        ? 'bg-[#1CB0F6]'
                        : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  />
                </div>
              </div>

              {micErrorMsg && (
                <div className="mt-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 p-2.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{micErrorMsg}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartMicTest}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border-2 border-b-4 active:border-b-2 active:translate-y-0.5 transition-all cursor-pointer ${
                  micStatus === 'recording'
                    ? 'bg-[#FF4B4B] border-[#EA2B2B] text-white'
                    : 'bg-white dark:bg-slate-800 hover:border-[#FF4B4B] border-slate-200 dark:border-slate-700 border-b-slate-300 text-slate-800 dark:text-white'
                }`}
              >
                {micStatus === 'recording' ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>Dừng thu ({micRecordSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5 text-[#FF4B4B]" />
                    <span>{recordedAudioUrl ? 'Thu thử lại' : 'Thử Micro (5s)'}</span>
                  </>
                )}
              </button>

              {recordedAudioUrl && (
                <button
                  type="button"
                  onClick={handleReplayRecordedMic}
                  className="py-2.5 px-3 rounded-xl text-xs font-black bg-[#58CC02] hover:bg-[#46A302] text-white border-2 border-[#46A302] border-b-4 active:border-b-2 active:translate-y-0.5 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {isReplayingMic ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang phát...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-white" />
                      <span>Nghe lại</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Remember in session option & Actions */}
        <div className="mt-5 pt-4 border-t-2 border-[#F0F0F0] dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberInSession}
              onChange={(e) => setRememberInSession(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#58CC02] focus:ring-[#58CC02] cursor-pointer"
            />
            <span>Không hỏi lại bước kiểm tra này trong phiên làm việc hiện tại</span>
          </label>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => {
                cleanupMedia();
                onConfirmEnterRoom(rememberInSession);
              }}
              className="btn-duo-white px-4 py-3 rounded-2xl text-xs font-black text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap"
            >
              Bỏ qua kiểm tra
            </button>

            <button
              type="button"
              onClick={() => {
                cleanupMedia();
                onConfirmEnterRoom(rememberInSession);
              }}
              className="btn-duo-green px-6 py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-4 w-4" />
              <span>Đã sẵn sàng · Vào phòng thi</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
