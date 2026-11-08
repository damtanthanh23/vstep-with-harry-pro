import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Gauge,
  Headphones,
  Upload,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { examAudioManager } from '../utils/audioManager';

interface InteractiveAudioPlayerProps {
  onUploadFile?: (file: File) => void;
  customAudioName?: string;
  audioBadgeLabel?: string;
  isCompact?: boolean;
}

export const InteractiveAudioPlayer: React.FC<InteractiveAudioPlayerProps> = ({
  onUploadFile,
  customAudioName,
  audioBadgeLabel,
  isCompact = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(examAudioManager.isPlaying());
  const [isLoadingAudio, setIsLoadingAudio] = useState(examAudioManager.isLoadingAudio());
  const [hasMissingAudioError, setHasMissingAudioError] = useState(
    examAudioManager.hasMissingAudioError()
  );
  const [currentTime, setCurrentTime] = useState(examAudioManager.getCurrentTime());
  const [duration, setDuration] = useState(examAudioManager.getDuration());
  const [playbackRate, setPlaybackRate] = useState(examAudioManager.getPlaybackRate());
  const [volume, setVolume] = useState(examAudioManager.getVolume());
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsubscribe = examAudioManager.subscribe(() => {
      setIsPlaying(examAudioManager.isPlaying());
      setIsLoadingAudio(examAudioManager.isLoadingAudio());
      setHasMissingAudioError(examAudioManager.hasMissingAudioError());
      setCurrentTime(examAudioManager.getCurrentTime());
      setDuration(examAudioManager.getDuration());
      setPlaybackRate(examAudioManager.getPlaybackRate());
      setVolume(examAudioManager.getVolume());
    });
    return unsubscribe;
  }, []);

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (speedMenuRef.current && !speedMenuRef.current.contains(event.target as Node)) {
        setIsSpeedMenuOpen(false);
      }
    };
    if (isSpeedMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSpeedMenuOpen]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoadingAudio || hasMissingAudioError) return;
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    examAudioManager.seek(val);
  };

  const handleSpeedSelect = (rate: number) => {
    examAudioManager.setPlaybackRate(rate);
    setPlaybackRate(rate);
    setIsSpeedMenuOpen(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
    // Always reset input value so uploading another or the same file triggers onChange reliably
    e.target.value = '';
  };

  // Speed options with 0.1x steps
  const SPEED_OPTIONS = [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];

  return (
    <div
      className={`relative flex items-center gap-2 sm:gap-2.5 rounded-2xl bg-white/95 px-3 py-1.5 shadow-sm border-2 border-b-4 ${
        hasMissingAudioError
          ? 'border-[#FF9600] border-b-[#E58700]'
          : 'border-[#46A302] border-b-[#2B6600]'
      } text-slate-800 ${isCompact ? 'text-xs' : 'text-sm'}`}
    >
      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={() => examAudioManager.togglePlay()}
        disabled={isLoadingAudio}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white border-2 border-b-4 active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer ${
          isLoadingAudio
            ? 'bg-[#1CB0F6] border-[#1899D6] border-b-[#0E74A5] opacity-85 cursor-wait'
            : hasMissingAudioError
            ? 'bg-[#FF9600] hover:bg-[#FFA826] border-[#E58700] border-b-[#B86B00]'
            : 'bg-[#58CC02] hover:bg-[#61E002] border-[#46A302] border-b-[#2B6600]'
        }`}
        title={
          isLoadingAudio
            ? 'Đang tải file MP3 từ Cloud...'
            : hasMissingAudioError
            ? 'Chưa tải được file MP3 (Bấm để thử tải lại từ Cloud)'
            : isPlaying
            ? 'Tạm dừng audio'
            : 'Phát audio'
        }
      >
        {isLoadingAudio ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 ml-0.5" />
        )}
      </button>

      {/* Audio Track Mode Badge (if per-part or named) */}
      {(audioBadgeLabel || customAudioName) && (
        <span
          className="hidden xl:inline-flex items-center gap-1 rounded-lg bg-[#D7FFB8]/60 border border-[#58CC02] px-2 py-0.5 text-[10px] font-black text-[#2B6600] max-w-[125px] truncate"
          title={customAudioName || audioBadgeLabel}
        >
          <Headphones className="h-3 w-3 shrink-0 text-[#58CC02]" />
          <span className="truncate">{customAudioName || audioBadgeLabel}</span>
        </span>
      )}

      {/* Status Notice when Loading from Cloud or Missing on Cloud */}
      {isLoadingAudio ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-[#DDF4FF] border border-[#1CB0F6] px-2.5 py-1 text-[11px] font-black text-[#1899D6]">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-[#1CB0F6]" />
          <span className="truncate">Đang tải MP3 từ Cloud...</span>
        </div>
      ) : hasMissingAudioError ? (
        <div
          className="flex items-center gap-1.5 rounded-lg bg-[#FFF4E5] border border-[#FF9600] px-2.5 py-1 text-[11px] font-bold text-amber-900"
          title="Chưa tìm thấy file Audio MP3 cho phần thi này trên Cloud. Giáo viên có thể tải file MP3 hoặc dán link ngoài trong mục Quản lý đề thi."
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#FF9600]" />
          <span className="truncate max-w-[180px] sm:max-w-[250px]">
            Chưa có file Audio MP3 cho phần thi này
          </span>
          <button
            type="button"
            onClick={() => examAudioManager.retryLoadAudio(true)}
            className="btn-duo-orange inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black cursor-pointer shrink-0"
            title="Thử dò tìm và tải lại file MP3 từ Cloud/Server"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            <span>Tải lại</span>
          </button>
        </div>
      ) : (
        <>
          {/* Replay 5s */}
          <button
            type="button"
            onClick={() => examAudioManager.seekRelative(-5)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-lime-50 hover:text-[#46A302] transition-colors cursor-pointer"
            title="Lùi 5 giây"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Forward 5s */}
          <button
            type="button"
            onClick={() => examAudioManager.seekRelative(5)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-lime-50 hover:text-[#46A302] transition-colors cursor-pointer"
            title="Tiến 5 giây"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>

          {/* Progress Bar & Time */}
          <div className="flex flex-1 items-center gap-2 min-w-[110px] max-w-[240px]">
            <span className="font-mono text-[11px] font-black text-slate-600 shrink-0">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={!duration}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-[#58CC02] disabled:opacity-50"
              title="Tua thanh tiến trình"
            />
            <span className="font-mono text-[11px] font-bold text-slate-400 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </>
      )}

      {/* Speed Selector opening DOWNWARD */}
      <div className="relative" ref={speedMenuRef}>
        <button
          type="button"
          onClick={() => setIsSpeedMenuOpen((prev) => !prev)}
          className="flex items-center gap-1 rounded-xl bg-[#D7FFB8]/60 hover:bg-[#D7FFB8] px-2.5 py-1 text-xs font-black text-[#2B6600] border-2 border-[#58CC02] border-b-3 border-b-[#46A302] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer"
          title="Tốc độ phát (bước nhảy 0.1x)"
        >
          <Gauge className="h-3 w-3" />
          <span>{playbackRate.toFixed(1)}x</span>
        </button>

        {isSpeedMenuOpen && (
          <div className="absolute right-0 top-full mt-2 z-[80] w-32 rounded-2xl bg-white p-1.5 shadow-2xl border-2 border-[#58CC02] border-b-4 border-b-[#46A302] flex flex-col gap-0.5 max-h-72 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 mb-1">
              Tốc độ nghe (±0.1)
            </div>
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleSpeedSelect(rate)}
                className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-black transition-colors cursor-pointer ${
                  Math.abs(playbackRate - rate) < 0.01
                    ? 'bg-[#58CC02] text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-lime-50'
                }`}
              >
                <span>{rate.toFixed(1)}x</span>
                {rate === 1.0 && <span className="text-[10px] opacity-85">Chuẩn</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Volume Icon Quick Mute */}
      <button
        type="button"
        onClick={() => examAudioManager.setVolume(volume > 0 ? 0 : 0.8)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors hidden sm:flex cursor-pointer"
        title="Bật / Tắt âm thanh"
      >
        {volume === 0 ? (
          <VolumeX className="h-4 w-4 text-[#FF4B4B]" />
        ) : (
          <Volume2 className="h-4 w-4 text-slate-600" />
        )}
      </button>

      {/* Quick Upload Local Audio File Button */}
      {onUploadFile && (
        <>
          <input
            ref={uploadInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#DDF4FF] hover:bg-sky-100 text-[#1899D6] border border-[#1CB0F6] transition-colors cursor-pointer"
            title="Mạng yếu / lỗi kết nối? Chọn file MP3 có sẵn trên máy tính để nghe tạm thời ở mục này (không thay đổi bộ audio gốc của đề)"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
};
