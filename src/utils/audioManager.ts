// Bulletproof Real-Audio Manager supporting uploaded MP3 files (IndexedDB + Firebase Storage CDN + Server + Cloud Chunks),
// external links (Google Drive, Dropbox, direct MP3 with automatic proxy fallback), and Canonical Test Audio Auto-Discovery.
// Strictly disables automatic TTS script narration during Listening exams so students ONLY hear real audio files.

import {
  resolvePlayableAudioUrl,
  resolveStudentExamAudioUrl,
  saveAudioToIndexedDB,
} from './audioStorageService';

export interface LoadExamPartAudioParams {
  testId: string;
  partNum: number;
  audioMode?: 'single' | 'per_part';
  configuredUrl?: string;
  configuredFileName?: string;
  partAudioUrls?: { part1?: string; part2?: string; part3?: string; part4?: string };
  partAudioFileNames?: { part1?: string; part2?: string; part3?: string; part4?: string };
  autoPlayWhenReady?: boolean;
  forceReload?: boolean;
  onResolvedLabel?: (label: string) => void;
}

class AudioManager {
  private audio: HTMLAudioElement | null = null;
  private rawSourceKey: string | null = null;
  private customAudioUrl: string | null = null;
  private fallbackFileName: string | undefined = undefined;
  private volume: number = 0.85;
  private playbackRate: number = 1.0;
  private isSpeechActive: boolean = false;
  private pendingAutoPlay: boolean = false;
  private isResolvingUrl: boolean = false;
  private audioLoadFailed: boolean = false;
  private isExpectingRealFile: boolean = true;
  private triedProxyFallback: boolean = false;
  private lastRequestedRawUrl: string = '';
  private lastRequestedFileName: string | undefined = undefined;
  private lastExamPartParams: LoadExamPartAudioParams | null = null;
  private unlockGestureHandler: (() => void) | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.volume = this.volume;

      const handleReadyToPlay = () => {
        this.audioLoadFailed = false;
        if (this.pendingAutoPlay && this.audio && this.audio.paused) {
          this.pendingAutoPlay = false;
          this.safeTriggerHtmlAudioPlay();
        }
        this.notifyListeners();
      };

      this.audio.addEventListener('timeupdate', () => this.notifyListeners());
      this.audio.addEventListener('play', () => this.notifyListeners());
      this.audio.addEventListener('playing', () => {
        this.audioLoadFailed = false;
        this.notifyListeners();
      });
      this.audio.addEventListener('pause', () => this.notifyListeners());
      this.audio.addEventListener('ended', () => {
        this.pendingAutoPlay = false;
        this.notifyListeners();
      });
      this.audio.addEventListener('loadedmetadata', () => this.notifyListeners());
      this.audio.addEventListener('loadeddata', handleReadyToPlay);
      this.audio.addEventListener('canplay', handleReadyToPlay);
      this.audio.addEventListener('canplaythrough', handleReadyToPlay);
      this.audio.addEventListener('error', () => {
        // Ignore empty src reset events
        if (!this.customAudioUrl) return;

        // Automatic Server Proxy Fallback for external HTTP/HTTPS links (e.g., CORS-blocked MP3 or Google Drive)
        if (
          !this.triedProxyFallback &&
          (this.customAudioUrl.startsWith('http://') ||
            this.customAudioUrl.startsWith('https://')) &&
          !this.customAudioUrl.includes('/api/audio-proxy')
        ) {
          this.triedProxyFallback = true;
          const proxiedUrl = `/api/audio-proxy?url=${encodeURIComponent(this.customAudioUrl)}`;
          this.customAudioUrl = proxiedUrl;
          if (this.audio) {
            this.audio.src = proxiedUrl;
            this.audio.playbackRate = this.playbackRate;
            this.audio.volume = this.volume;
            this.audio.load();
          }
          this.notifyListeners();
          return;
        }

        this.audioLoadFailed = true;
        this.pendingAutoPlay = false;
        this.notifyListeners();
      });
    }
  }

  public subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  private clearGestureUnlock() {
    if (this.unlockGestureHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.unlockGestureHandler);
      window.removeEventListener('keydown', this.unlockGestureHandler);
      this.unlockGestureHandler = null;
    }
  }

  private registerGestureUnlock(action: () => void) {
    this.clearGestureUnlock();
    if (typeof window === 'undefined') return;
    this.unlockGestureHandler = () => {
      this.clearGestureUnlock();
      action();
    };
    window.addEventListener('pointerdown', this.unlockGestureHandler, { once: true });
    window.addEventListener('keydown', this.unlockGestureHandler, { once: true });
  }

  /**
   * No-op kept for backward API compatibility — automatic TTS fallback in Listening exams is disabled
   * so students strictly hear real MP3 audio files.
   */
  public setPartScriptFallback(_scriptText: string, _partKey: string) {
    // Intentionally disabled: never replace real exam MP3 playback with synthetic speechSynthesis
  }

  /**
   * Immediately loads and plays a newly uploaded File without waiting for async storage,
   * while saving to IndexedDB in the background.
   */
  public async setCustomAudio(file: File, autoPlay = true) {
    this.cancelAnySpeechSynthesis();
    this.clearGestureUnlock();
    this.audioLoadFailed = false;
    this.isResolvingUrl = false;
    this.isExpectingRealFile = true;
    this.triedProxyFallback = false;
    this.lastRequestedRawUrl = '';
    this.lastRequestedFileName = file.name;

    const directObjUrl = URL.createObjectURL(file);
    const uniqueKey = `session_upload_${file.name}_${file.size}_${file.lastModified}_${Date.now()}`;

    this.rawSourceKey = uniqueKey;
    this.customAudioUrl = directObjUrl;
    this.fallbackFileName = file.name;
    this.pendingAutoPlay = autoPlay;

    if (this.audio) {
      this.audio.pause();
      this.audio.src = directObjUrl;
      this.audio.currentTime = 0;
      this.audio.playbackRate = this.playbackRate;
      this.audio.volume = this.volume;
      this.audio.load();

      if (autoPlay && this.audio.readyState >= 2) {
        this.pendingAutoPlay = false;
        this.safeTriggerHtmlAudioPlay();
      }
    }
    this.notifyListeners();

    const storageKey = `session_upload_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    saveAudioToIndexedDB(storageKey, file, file.name).catch(() => {});
  }

  /**
   * Canonical Exam Part Audio Loader:
   * Resolves the real MP3 file or external link for `(testId, partNum)` across all storage layers
   * (Configured URL -> Local IDB -> Server Discovery -> Firebase Storage CDN -> Firestore Test Doc -> Cloud Chunks).
   * Never falls back to synthetic TTS voice.
   */
  public async loadExamPartAudio(params: LoadExamPartAudioParams) {
    this.lastExamPartParams = params;
    const cleanUrl = (params.configuredUrl || '').trim();
    const compositeKey = `exam::${params.testId}::mode=${params.audioMode || 'single'}::part=${
      params.audioMode === 'per_part' ? params.partNum : 'full'
    }::url=${cleanUrl}::file=${params.configuredFileName || ''}`;

    this.lastRequestedRawUrl = cleanUrl;
    this.lastRequestedFileName = params.configuredFileName;

    if (
      !params.forceReload &&
      this.rawSourceKey === compositeKey &&
      this.customAudioUrl &&
      this.audio &&
      this.audio.src &&
      !this.audioLoadFailed
    ) {
      if (params.autoPlayWhenReady && !this.isPlaying()) {
        this.play();
      }
      return;
    }

    this.rawSourceKey = compositeKey;
    this.fallbackFileName = params.configuredFileName;
    this.isExpectingRealFile = true;
    this.audioLoadFailed = false;
    this.triedProxyFallback = false;
    this.isResolvingUrl = true;
    this.pendingAutoPlay = Boolean(params.autoPlayWhenReady);
    this.cancelAnySpeechSynthesis();

    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    this.notifyListeners();

    const { playableUrl, resolvedLabel } = await resolveStudentExamAudioUrl({
      testId: params.testId,
      partNum: params.partNum,
      audioMode: params.audioMode,
      configuredUrl: cleanUrl,
      configuredFileName: params.configuredFileName,
      partAudioUrls: params.partAudioUrls,
      partAudioFileNames: params.partAudioFileNames,
    });

    if (this.rawSourceKey !== compositeKey) return;
    this.isResolvingUrl = false;

    if (resolvedLabel && params.onResolvedLabel) {
      params.onResolvedLabel(resolvedLabel);
    }

    if (playableUrl && this.audio) {
      this.audioLoadFailed = false;
      this.customAudioUrl = playableUrl;
      this.audio.pause();
      this.audio.src = playableUrl;
      this.audio.currentTime = 0;
      this.audio.playbackRate = this.playbackRate;
      this.audio.volume = this.volume;
      this.audio.load();

      if (this.pendingAutoPlay && this.audio.readyState >= 2) {
        this.pendingAutoPlay = false;
        this.safeTriggerHtmlAudioPlay();
      }
    } else {
      this.customAudioUrl = null;
      this.audioLoadFailed = true;
      this.pendingAutoPlay = false;
      if (this.audio) {
        this.audio.pause();
        this.audio.removeAttribute('src');
      }
    }

    this.notifyListeners();
  }

  public async setCustomAudioUrl(
    url: string,
    fileName?: string,
    autoPlayWhenReady = false,
    forceReload = false
  ) {
    const cleanUrl = (url || '').trim();
    const compositeKey = `${cleanUrl}::${fileName || ''}`;

    this.lastRequestedRawUrl = cleanUrl;
    this.lastRequestedFileName = fileName;
    this.lastExamPartParams = null;

    if (
      !forceReload &&
      this.rawSourceKey === compositeKey &&
      this.customAudioUrl &&
      this.audio &&
      this.audio.src &&
      !this.audioLoadFailed
    ) {
      if (autoPlayWhenReady && !this.isPlaying()) {
        this.play();
      }
      return;
    }

    this.rawSourceKey = compositeKey;
    this.fallbackFileName = fileName;
    this.audioLoadFailed = false;
    this.triedProxyFallback = false;
    this.isExpectingRealFile = true;
    this.cancelAnySpeechSynthesis();

    if (!cleanUrl && !fileName) {
      this.customAudioUrl = null;
      this.audioLoadFailed = true;
      this.pendingAutoPlay = false;
      if (this.audio) {
        this.audio.pause();
        this.audio.removeAttribute('src');
      }
      this.notifyListeners();
      return;
    }

    this.isResolvingUrl = true;
    this.pendingAutoPlay = autoPlayWhenReady;
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    this.notifyListeners();

    const resolvedUrl = await resolvePlayableAudioUrl(cleanUrl, fileName);
    this.isResolvingUrl = false;

    if (this.rawSourceKey !== compositeKey) return;

    if (resolvedUrl && this.audio) {
      this.audioLoadFailed = false;
      this.customAudioUrl = resolvedUrl;
      this.audio.pause();
      this.audio.src = resolvedUrl;
      this.audio.currentTime = 0;
      this.audio.playbackRate = this.playbackRate;
      this.audio.volume = this.volume;
      this.audio.load();

      if (this.pendingAutoPlay && this.audio.readyState >= 2) {
        this.pendingAutoPlay = false;
        this.safeTriggerHtmlAudioPlay();
      }
    } else {
      this.customAudioUrl = null;
      this.audioLoadFailed = true;
      this.pendingAutoPlay = false;
    }

    this.notifyListeners();
  }

  public async retryLoadAudio(autoPlay = true) {
    if (this.lastExamPartParams) {
      await this.loadExamPartAudio({
        ...this.lastExamPartParams,
        autoPlayWhenReady: autoPlay,
        forceReload: true,
      });
      return;
    }
    if (!this.lastRequestedRawUrl && !this.lastRequestedFileName) return;
    await this.setCustomAudioUrl(
      this.lastRequestedRawUrl,
      this.lastRequestedFileName,
      autoPlay,
      true
    );
  }

  private safeTriggerHtmlAudioPlay() {
    if (!this.audio || !this.audio.src) return;
    this.audio.volume = this.volume;
    this.audio.playbackRate = this.playbackRate;

    const playPromise = this.audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.audioLoadFailed = false;
          this.clearGestureUnlock();
          this.notifyListeners();
        })
        .catch((err: Error) => {
          if (err.name === 'NotAllowedError') {
            this.registerGestureUnlock(() => {
              this.play();
            });
          } else if (err.name === 'AbortError') {
            this.pendingAutoPlay = true;
          } else {
            if (this.audio?.error) {
              this.audioLoadFailed = true;
              this.pendingAutoPlay = false;
            } else {
              this.pendingAutoPlay = true;
            }
          }
          this.notifyListeners();
        });
    }
  }

  public play() {
    this.cancelAnySpeechSynthesis();

    if (this.isResolvingUrl) {
      this.pendingAutoPlay = true;
      this.notifyListeners();
      return;
    }

    if (!this.customAudioUrl || this.audioLoadFailed) {
      this.retryLoadAudio(true);
      return;
    }

    if (this.audio) {
      if (this.audio.readyState >= 2) {
        this.pendingAutoPlay = false;
        this.safeTriggerHtmlAudioPlay();
      } else {
        this.pendingAutoPlay = true;
        if (this.audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
          this.audio.load();
        }
      }
      this.notifyListeners();
    }
  }

  public autoPlayForListeningPart(_fallbackScript?: string, _partKey?: string) {
    if (this.isPlaying()) return;
    this.play();
  }

  private cancelAnySpeechSynthesis() {
    this.isSpeechActive = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  public pause() {
    this.pendingAutoPlay = false;
    this.clearGestureUnlock();
    if (this.audio) {
      this.audio.pause();
    }
    this.cancelAnySpeechSynthesis();
    this.notifyListeners();
  }

  public togglePlay() {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  public isPlaying(): boolean {
    if (this.isSpeechActive) return true;
    return !!(this.audio && !this.audio.paused && !this.audio.ended);
  }

  public isLoadingAudio(): boolean {
    return this.isResolvingUrl;
  }

  public hasMissingAudioError(): boolean {
    return this.isExpectingRealFile && this.audioLoadFailed && !this.isResolvingUrl;
  }

  public getCurrentTime(): number {
    if (this.audio && this.customAudioUrl && !this.audioLoadFailed && !this.isResolvingUrl) {
      return this.audio.currentTime || 0;
    }
    return 0;
  }

  public getDuration(): number {
    if (
      this.audio &&
      this.customAudioUrl &&
      !this.audioLoadFailed &&
      !this.isResolvingUrl &&
      !isNaN(this.audio.duration) &&
      this.audio.duration > 0
    ) {
      return this.audio.duration;
    }
    return 0;
  }

  public seek(seconds: number) {
    const maxDur = this.getDuration() || 0;
    if (maxDur <= 0) return;
    const clamped = Math.max(0, Math.min(maxDur, seconds));

    if (this.audio && this.customAudioUrl && !this.audioLoadFailed) {
      try {
        this.audio.currentTime = clamped;
      } catch {
        // Ignore seek before metadata ready
      }
      this.notifyListeners();
    }
  }

  public seekRelative(deltaSeconds: number) {
    const target = this.getCurrentTime() + deltaSeconds;
    this.seek(target);
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public setPlaybackRate(rate: number) {
    const sanitized = Math.round(Math.max(0.5, Math.min(2.0, rate)) * 10) / 10;
    this.playbackRate = sanitized;
    if (this.audio) {
      this.audio.playbackRate = sanitized;
    }
    this.notifyListeners();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    this.notifyListeners();
  }

  public increaseVolume(step = 0.1) {
    this.setVolume(this.volume + step);
  }

  public decreaseVolume(step = 0.1) {
    this.setVolume(this.volume - step);
  }

  public hasAudioSource(): boolean {
    return !!(this.customAudioUrl && !this.audioLoadFailed);
  }

  public playExamChime() {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.01, 0.25 * this.volume),
        ctx.currentTime + 0.05
      );
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  public speakText(text: string, onEnd?: () => void, speakerLabel?: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    this.cancelAnySpeechSynthesis();
    this.playExamChime();

    const cleanedSpeechText = text
      .replace(
        /^(?:Speaker\s+)?([A-Z]|Man|Woman|Male|Female|Boy|Girl|Host|Radio Host|Interviewer|Receptionist|Customer|Clerk|Narrator)(?:\s*\d+)?\s*[:.-]\s*/gim,
        ''
      )
      .trim();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(cleanedSpeechText || text);
      utterance.lang = 'en-GB';
      utterance.volume = this.volume;
      utterance.rate = 0.95 * this.playbackRate;

      const normSpeaker = (speakerLabel || '').trim().toUpperCase();
      if (
        normSpeaker === 'B' ||
        normSpeaker.includes('MAN') ||
        normSpeaker.includes('MALE') ||
        normSpeaker.includes('BOY')
      ) {
        utterance.pitch = 0.88;
      } else if (
        normSpeaker === 'A' ||
        normSpeaker.includes('WOMAN') ||
        normSpeaker.includes('FEMALE') ||
        normSpeaker.includes('GIRL')
      ) {
        utterance.pitch = 1.1;
      } else if (normSpeaker === 'C' || normSpeaker.includes('HOST')) {
        utterance.pitch = 1.02;
      } else {
        utterance.pitch = 1.0;
      }

      const voices = window.speechSynthesis.getVoices();
      const ukVoices = voices.filter(
        (v) => v.lang === 'en-GB' || v.lang === 'en_GB'
      );
      if (
        ukVoices.length > 1 &&
        (normSpeaker === 'B' || normSpeaker.includes('MAN'))
      ) {
        utterance.voice = ukVoices[1] || ukVoices[0];
      } else {
        const ukVoice =
          ukVoices[0] || voices.find((v) => v.lang.startsWith('en'));
        if (ukVoice) {
          utterance.voice = ukVoice;
        }
      }

      this.isSpeechActive = true;
      this.notifyListeners();

      utterance.onend = () => {
        this.isSpeechActive = false;
        this.notifyListeners();
        onEnd?.();
      };

      utterance.onerror = () => {
        this.isSpeechActive = false;
        this.notifyListeners();
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    }, 300);
  }
}

export const examAudioManager = new AudioManager();
