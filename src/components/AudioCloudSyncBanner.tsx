import React, { useEffect, useState } from 'react';
import { CloudUpload, CheckCircle2, AlertTriangle, X, Loader2, RefreshCw } from 'lucide-react';
import {
  AudioCloudSyncState,
  getAudioCloudSyncState,
  subscribeToAudioCloudSync,
  dismissAudioCloudSyncBanner,
  retryLastAudioCloudSync,
} from '../utils/audioStorageService';

export const AudioCloudSyncBanner: React.FC = () => {
  const [syncState, setSyncState] = useState<AudioCloudSyncState>(getAudioCloudSyncState());

  useEffect(() => {
    return subscribeToAudioCloudSync((nextState) => {
      setSyncState({ ...nextState });
    });
  }, []);

  if (!syncState.active || syncState.status === 'idle') {
    return null;
  }

  const isCompleted = syncState.status === 'completed';
  const isError = syncState.status === 'error';

  return (
    <div className="fixed bottom-4 right-4 z-[120] w-[340px] sm:w-[390px] rounded-2xl bg-white/95 backdrop-blur-md p-3.5 shadow-2xl border-2 border-indigo-200 text-slate-800 transition-all duration-300">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ${
              isCompleted
                ? 'bg-emerald-500'
                : isError
                ? 'bg-amber-500'
                : 'bg-indigo-600'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isError ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CloudUpload className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <span className="text-xs font-black uppercase tracking-wide text-indigo-950 truncate">
                {isCompleted
                  ? 'Đồng bộ MP3 Hoàn tất'
                  : isError
                  ? 'Thông báo Đồng bộ MP3'
                  : 'Đồng bộ MP3 chạy ngầm'}
              </span>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-600 truncate" title={syncState.message}>
              {syncState.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isError && (
            <button
              type="button"
              onClick={retryLastAudioCloudSync}
              className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-indigo-700 transition-colors cursor-pointer shadow-xs"
              title="Đồng bộ lại ngay"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Thử lại</span>
            </button>
          )}
          <button
            type="button"
            onClick={dismissAudioCloudSyncBanner}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            title="Ẩn thông báo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[11px] font-bold mb-1">
          <span className="text-slate-500 truncate max-w-[230px]">
            {syncState.testTitle ? `${syncState.testTitle} · ` : ''}
            {syncState.currentFileName}
          </span>
          <span
            className={`font-mono font-black ${
              isCompleted
                ? 'text-emerald-600'
                : isError
                ? 'text-amber-600'
                : 'text-indigo-600'
            }`}
          >
            {syncState.percent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/80">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isCompleted
                ? 'bg-emerald-500'
                : isError
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500'
            }`}
            style={{ width: `${Math.max(4, Math.min(100, syncState.percent))}%` }}
          />
        </div>
      </div>
    </div>
  );
};

