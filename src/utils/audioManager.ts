// Bulletproof Audio Manager supporting uploaded MP3 files (IndexedDB + Cloud Chunks + URL),
// instant playback when switching/uploading different audio files, and British English Script Narration fallback.

import {
  resolvePlayableAudioUrl,
  saveAudioToIndexedDB,
} from './audioStorageService';

interface ScriptUtteranceSegment {
  speaker: string;
  text: string;
  startSec: number;
  durationSec: number;
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
  private unlockGestureHandler: (() => void) | null = null;
  private listeners: Set<() => void> = new Set();

  // Fallback Script Narration Engine state (used ONLY when no MP3 is uploaded or MP3 URL is missing)
  private fallbackScriptText: string = '';
  private fallbackPartKey: string = '';
  private scriptSegments: ScriptUtteranceSegment[] = [];
  private isScriptNarrationPlaying: boolean = false;
  private scriptSimTime: number = 0;
  private scriptSimDuration: number = 0;
  private scriptTimerId: number | null = null;
  private activeSegmentIndex: number = -1;

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
        this.audioLoadFailed = true;
        if (this.pendingAutoPlay && this.fallbackScriptText.trim().length > 0) {
          this.pendingAutoPlay = false;
          this.startScriptNarration();
        }
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
   * Registers the current Listening Part's transcript so if no external MP3 is attached,
   * the player can still play British English narration with a progress bar.
   */
  public setPartScriptFallback(scriptText: string, partKey: string) {
    const cleanScript = (scriptText || '').trim();
    if (this.fallbackPartKey === partKey && this.fallbackScriptText === cleanScript) {
      return;
    }

    if (this.fallbackPartKey !== partKey && this.isScriptNarrationPlaying) {
      this.stopScriptNarration(true);
    }

    this.fallbackPartKey = partKey;
    this.fallbackScriptText = cleanScript;
    this.buildScriptSegments(cleanScript);
    this.notifyListeners();
  }

  private buildScriptSegments(rawScript: string) {
    if (!rawScript) {
      this.scriptSegments = [];
      this.scriptSimDuration = 0;
      this.scriptSimTime = 0;
      return;
    }

    const lines = rawScript
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const segments: ScriptUtteranceSegment[] = [];
    let cursorSec = 0;

    lines.forEach((line) => {
      const speakerMatch = line.match(
        /^(?:Speaker\s+)?([A-Z]|Man|Woman|Male|Female|Boy|Girl|Host|Radio Host|Interviewer|Narrator)(?:\s*\d+)?\s*[:.-]\s*(.+)$/i
      );
      const speaker = speakerMatch ? speakerMatch[1].toUpperCase() : 'NARRATOR';
      const spokenText = speakerMatch ? speakerMatch[2].trim() : line;
      const wordCount = Math.max(1, spokenText.split(/\s+/).length);
      const durationSec = Math.max(2, Math.round((wordCount / 2.4 + 0.8) * 10) / 10);

      segments.push({
        speaker,
        text: spokenText,
        startSec: cursorSec,
        durationSec,
      });
      cursorSec += durationSec;
    });

    this.scriptSegments = segments;
    this.scriptSimDuration = Math.max(15, Math.ceil(cursorSec));
    this.scriptSimTime = 0;
  }

  /**
   * Immediately loads and plays a newly uploaded File without waiting for async storage,
   * while saving to IndexedDB in the background.
   */
  public async setCustomAudio(file: File, autoPlay = true) {
    this.stopScriptNarration(true);
    this.clearGestureUnlock();
    this.audioLoadFailed = false;
    this.isResolvingUrl = false;

    // Create direct Object URL immediately from the uploaded File so there is zero latency or stale cache
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

    // Persist to IndexedDB in background for recovery
    const storageKey = `session_upload_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    saveAudioToIndexedDB(storageKey, file, file.name).catch(() => {});
  }

  public async setCustomAudioUrl(
    url: string,
    fileName?: string,
    autoPlayWhenReady = false
  ) {
    const cleanUrl = (url || '').trim();
    const compositeKey = `${cleanUrl}::${fileName || ''}`;

    // Avoid resetting audio.src ONLY if the exact same versioned audio track is already loaded and healthy
    if (
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

    if (!cleanUrl && !fileName) {
      this.customAudioUrl = null;
      if (this.audio) {
        this.audio.pause();
        this.audio.removeAttribute('src');
      }
      if (autoPlayWhenReady && this.fallbackScriptText.trim().length > 0) {
        this.startScriptNarration();
      }
      this.notifyListeners();
      return;
    }

    this.isResolvingUrl = true;
    this.pendingAutoPlay = autoPlayWhenReady;
    this.stopScriptNarration(true);
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
    this.notifyListeners();

    const resolvedUrl = await resolvePlayableAudioUrl(cleanUrl, fileName);
    this.isResolvingUrl = false;

    // Ensure rawSourceKey didn't change while resolving
    if (this.rawSourceKey !== compositeKey) return;

    if (resolvedUrl && this.audio) {
      this.stopScriptNarration(true);
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
      if (this.pendingAutoPlay && this.fallbackScriptText.trim().length > 0) {
        this.pendingAutoPlay = false;
        this.startScriptNarration();
      }
    }

    this.notifyListeners();
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
            // Browser blocked autoplay before user gesture: unlock immediately on first click/tap
            this.registerGestureUnlock(() => {
              this.play();
            });
          } else if (err.name === 'AbortError') {
            // Interrupted while new track is loading: queue play for `canplay` / `loadeddata`
            this.pendingAutoPlay = true;
          } else {
            // Only fall back to Script Narration if no custom audio is available or if media element truly errored
            if (this.audio?.error) {
              this.audioLoadFailed = true;
              if (this.fallbackScriptText.trim().length > 0) {
                this.startScriptNarration();
              }
            } else {
              this.pendingAutoPlay = true;
            }
          }
          this.notifyListeners();
        });
    }
  }

  public play() {
    if (this.isResolvingUrl) {
      this.pendingAutoPlay = true;
      this.notifyListeners();
      return;
    }

    // 1. If we have an uploaded/configured HTML5 audio track, ALWAYS prioritize playing it!
    if (this.audio && this.customAudioUrl) {
      this.stopScriptNarration(false);

      // If a previous attempt had marked audioLoadFailed, reset and reload once when user clicks Play
      if (this.audioLoadFailed) {
        this.audioLoadFailed = false;
        this.pendingAutoPlay = true;
        this.audio.src = this.customAudioUrl;
        this.audio.load();
        this.notifyListeners();
        return;
      }

      if (this.audio.readyState >= 2) {
        this.pendingAutoPlay = false;
        this.safeTriggerHtmlAudioPlay();
      } else {
        // Wait for `loadeddata` / `canplay` event to call `safeTriggerHtmlAudioPlay()` cleanly
        this.pendingAutoPlay = true;
        if (this.audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
          this.audio.load();
        }
      }
      this.notifyListeners();
      return;
    }

    // 2. Otherwise (when no MP3 file is attached), play the British English Script Narration fallback
    if (this.fallbackScriptText.trim().length > 0) {
      this.startScriptNarration();
    }
  }

  /**
   * Automatically starts audio when entering the Listening section or switching Listening Parts
   */
  public autoPlayForListeningPart(fallbackScript?: string, partKey?: string) {
    if (fallbackScript !== undefined && partKey !== undefined) {
      this.setPartScriptFallback(fallbackScript, partKey);
    }
    if (this.isPlaying()) return;
    this.play();
  }

  private startScriptNarration() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.scriptSegments.length === 0 && this.fallbackScriptText) {
      this.buildScriptSegments(this.fallbackScriptText);
    }
    if (this.scriptSegments.length === 0) return;

    this.isScriptNarrationPlaying = true;
    if (this.scriptSimTime >= this.scriptSimDuration) {
      this.scriptSimTime = 0;
      this.activeSegmentIndex = -1;
    }

    this.speakSegmentAtCurrentTime();

    if (this.scriptTimerId) {
      window.clearInterval(this.scriptTimerId);
    }
    this.scriptTimerId = window.setInterval(() => {
      if (!this.isScriptNarrationPlaying) return;
      this.scriptSimTime = Math.min(
        this.scriptSimDuration,
        this.scriptSimTime + 0.25 * this.playbackRate
      );

      const segIdx = this.findSegmentIndexForTime(this.scriptSimTime);
      if (segIdx !== -1 && segIdx !== this.activeSegmentIndex) {
        this.activeSegmentIndex = segIdx;
        this.speakSingleSegment(this.scriptSegments[segIdx]);
      }

      if (this.scriptSimTime >= this.scriptSimDuration) {
        this.stopScriptNarration(true);
      }
      this.notifyListeners();
    }, 250);

    this.notifyListeners();
  }

  private findSegmentIndexForTime(sec: number): number {
    for (let i = 0; i < this.scriptSegments.length; i++) {
      const seg = this.scriptSegments[i];
      if (sec >= seg.startSec && sec < seg.startSec + seg.durationSec) {
        return i;
      }
    }
    return this.scriptSegments.length - 1;
  }

  private speakSegmentAtCurrentTime() {
    const idx = Math.max(0, this.findSegmentIndexForTime(this.scriptSimTime));
    this.activeSegmentIndex = idx;
    const seg = this.scriptSegments[idx];
    if (seg) {
      this.speakSingleSegment(seg);
    }
  }

  private speakSingleSegment(seg: ScriptUtteranceSegment) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(seg.text);
      utterance.lang = 'en-GB';
      utterance.volume = this.volume;
      utterance.rate = Math.max(0.6, Math.min(1.6, 0.95 * this.playbackRate));

      const normSpeaker = seg.speaker.toUpperCase();
      if (
        normSpeaker === 'B' ||
        normSpeaker.includes('MAN') ||
        normSpeaker.includes('MALE')
      ) {
        utterance.pitch = 0.88;
      } else if (
        normSpeaker === 'A' ||
        normSpeaker.includes('WOMAN') ||
        normSpeaker.includes('FEMALE')
      ) {
        utterance.pitch = 1.1;
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
        const ukVoice = ukVoices[0] || voices.find((v) => v.lang.startsWith('en'));
        if (ukVoice) utterance.voice = ukVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore speech synthesis restrictions
    }
  }

  private stopScriptNarration(resetTime = false) {
    this.isScriptNarrationPlaying = false;
    if (this.scriptTimerId && typeof window !== 'undefined') {
      window.clearInterval(this.scriptTimerId);
      this.scriptTimerId = null;
    }
    if (resetTime) {
      this.scriptSimTime = 0;
      this.activeSegmentIndex = -1;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public pause() {
    this.pendingAutoPlay = false;
    this.clearGestureUnlock();
    if (this.audio) {
      this.audio.pause();
    }
    this.stopScriptNarration(false);
    this.isSpeechActive = false;
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
    if (this.isSpeechActive || this.isScriptNarrationPlaying) return true;
    return !!(this.audio && !this.audio.paused && !this.audio.ended);
  }

  public getCurrentTime(): number {
    if (this.audio && this.customAudioUrl && !this.audioLoadFailed) {
      return this.audio.currentTime || 0;
    }
    return this.scriptSimTime;
  }

  public getDuration(): number {
    if (
      this.audio &&
      this.customAudioUrl &&
      !this.audioLoadFailed &&
      !isNaN(this.audio.duration) &&
      this.audio.duration > 0
    ) {
      return this.audio.duration;
    }
    return this.scriptSimDuration || 120;
  }

  public seek(seconds: number) {
    const maxDur = this.getDuration() || 9999;
    const clamped = Math.max(0, Math.min(maxDur, seconds));

    if (this.audio && this.customAudioUrl && !this.audioLoadFailed) {
      try {
        this.audio.currentTime = clamped;
      } catch {
        // Ignore seek before metadata ready
      }
      this.notifyListeners();
      return;
    }

    this.scriptSimTime = clamped;
    if (this.isScriptNarrationPlaying) {
      this.speakSegmentAtCurrentTime();
    }
    this.notifyListeners();
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
    if (this.isScriptNarrationPlaying) {
      this.speakSegmentAtCurrentTime();
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
    return !!(
      (this.customAudioUrl && !this.audioLoadFailed) ||
      this.fallbackScriptText.trim().length > 0
    );
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

    this.stopScriptNarration(false);
    window.speechSynthesis.cancel();
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
