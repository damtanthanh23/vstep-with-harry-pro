/**
 * Bulletproof Utility for English Pronunciation Audio
 * 
 * Supports:
 * 1. Direct Oxford & Google Dictionary static CDN native recordings (No 403 blocks)
 * 2. Unofficial Free Dictionary API phonetics audio files
 * 3. Robust Web Speech Synthesis (SpeechSynthesis API) with Chromium garbage collection protection,
 *    iframe auto-resume, and native English voice resolution.
 * 4. Adjustable volume, playback rate (0.75x, 1x, 1.25x), and visual state callbacks.
 */

const audioUrlCache: Record<string, { uk?: string; us?: string }> = {};
let activeAudio: HTMLAudioElement | null = null;
let globalVolumePercent = 85; // Default 85% for clear audibility

// Retain a persistent reference to prevent Chrome's SpeechSynthesis garbage collection bug
let activeUtterance: SpeechSynthesisUtterance | null = null;
let audioContextInstance: AudioContext | null = null;

export function setDictionaryAudioVolume(volumePercent: number): void {
  globalVolumePercent = Math.max(0, Math.min(100, Math.round(volumePercent)));
  if (activeAudio) {
    activeAudio.volume = globalVolumePercent / 100;
  }
}

export function getDictionaryAudioVolume(): number {
  return globalVolumePercent;
}

export function stopDictionaryAudio(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      activeUtterance = null;
    } catch {
      // ignore
    }
  }
}

/**
 * Returns available native English speech synthesis voices
 */
function getEnglishVoice(accent: 'uk' | 'us'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetLang = accent === 'uk' ? 'en-GB' : 'en-US';
    // 1. Exact match
    const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === targetLang.toLowerCase());
    if (exact) return exact;

    // 2. Starts with target language
    const starts = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(targetLang.toLowerCase()));
    if (starts) return starts;

    // 3. Any English voice
    const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
    if (anyEn) return anyEn;

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves a reliable audio URL for native human pronunciation.
 * Avoids blocked Google Translate TTS endpoints that return 403 Forbidden.
 */
export async function getDictionaryAudioUrl(
  word: string,
  accent: 'uk' | 'us'
): Promise<string | null> {
  const cleanWord = word.trim().toLowerCase().replace(/[^a-z- ]/g, '').trim();
  if (!cleanWord) return null;

  if (audioUrlCache[cleanWord]?.[accent]) {
    return audioUrlCache[cleanWord][accent]!;
  }

  // Single word lookup via Oxford/Google CDN & Free Dictionary API
  if (!cleanWord.includes(' ')) {
    // 1. Try Free Dictionary API which hosts real CDN mp3 files
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data[0]?.phonetics) {
          let ukUrl: string | undefined;
          let usUrl: string | undefined;

          for (const phon of data[0].phonetics) {
            const audio = phon.audio;
            if (audio && typeof audio === 'string' && audio.startsWith('http')) {
              const lower = audio.toLowerCase();
              if (lower.includes('-uk') || lower.includes('/uk/')) {
                ukUrl = ukUrl || audio;
              } else if (lower.includes('-us') || lower.includes('/us/')) {
                usUrl = usUrl || audio;
              } else {
                if (!ukUrl) ukUrl = audio;
                if (!usUrl) usUrl = audio;
              }
            }
          }

          if (!audioUrlCache[cleanWord]) audioUrlCache[cleanWord] = {};
          if (ukUrl) audioUrlCache[cleanWord].uk = ukUrl;
          if (usUrl) audioUrlCache[cleanWord].us = usUrl;

          if (accent === 'uk' && ukUrl) return ukUrl;
          if (accent === 'us' && usUrl) return usUrl;
        }
      }
    } catch {
      // Fall through to SpeechSynthesis
    }

    // 2. High-speed Google Dictionary Static CDN (Public, no 403, ultra-fast)
    const suffix = accent === 'uk' ? '_gb_1' : '_us_1';
    const cdnUrl = `https://ssl.gstatic.com/dictionary/static/sounds/20200429/${encodeURIComponent(cleanWord)}--${suffix}.mp3`;
    if (!audioUrlCache[cleanWord]) audioUrlCache[cleanWord] = {};
    audioUrlCache[cleanWord][accent] = cdnUrl;
    return cdnUrl;
  }

  return null;
}

export interface PlayVocabAudioOptions {
  customAudioUrl?: string;
  playbackRate?: number; // 0.75, 1.0, 1.25
  volumePercent?: number; // 0..100
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

/**
 * Bulletproof speech synthesis with Chrome iframe auto-resume
 */
function speakWithSpeechSynthesis(
  cleanWord: string,
  accent: 'uk' | 'us',
  rate: number,
  vol: number,
  opts: PlayVocabAudioOptions
): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      opts.onError?.('Trình duyệt không hỗ trợ bộ đọc giọng nói');
      opts.onEnd?.();
      resolve(false);
      return;
    }

    try {
      // Resume if paused by browser autoplay policy in iframe
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanWord);
      utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
      utterance.rate = Math.max(0.6, Math.min(1.4, rate * 0.92));
      utterance.volume = Math.max(0.1, Math.min(1.0, vol));

      const voice = getEnglishVoice(accent);
      if (voice) {
        utterance.voice = voice;
      }

      let hasFinished = false;
      const finish = (success: boolean) => {
        if (hasFinished) return;
        hasFinished = true;
        activeUtterance = null;
        opts.onEnd?.();
        resolve(success);
      };

      utterance.onstart = () => {
        opts.onStart?.();
      };

      utterance.onend = () => {
        finish(true);
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis notice:', e);
        finish(false);
      };

      // Persistent module reference prevents Chrome garbage collection mid-speech
      activeUtterance = utterance;
      // Pre-call resume to overcome iframe restrictions
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);

      // Failsafe timeout in case onend never fires
      const timeoutMs = Math.max(2500, cleanWord.length * 280);
      setTimeout(() => {
        if (!hasFinished) {
          finish(true);
        }
      }, timeoutMs);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
      opts.onError?.('Lỗi phát âm SpeechSynthesis');
      opts.onEnd?.();
      resolve(false);
    }
  });
}

/**
 * Main function to play English vocabulary audio.
 * Attempts native audio recordings first; automatically falls back to Web Speech API.
 */
export async function playDictionaryAudio(
  word: string,
  accentOrOptions: 'uk' | 'us' | PlayVocabAudioOptions = 'uk',
  onStartOrOptions?: (() => void) | PlayVocabAudioOptions,
  onEndLegacy?: () => void
): Promise<boolean> {
  const accent: 'uk' | 'us' =
    typeof accentOrOptions === 'string' ? accentOrOptions : 'uk';
  const opts: PlayVocabAudioOptions =
    typeof accentOrOptions === 'object' && accentOrOptions !== null
      ? accentOrOptions
      : typeof onStartOrOptions === 'function'
      ? { onStart: onStartOrOptions, onEnd: onEndLegacy }
      : onStartOrOptions || {};

  const cleanWord = word.trim().replace(/[#]/g, '').trim();
  if (!cleanWord) {
    opts.onError?.('Từ vựng rỗng');
    return false;
  }

  stopDictionaryAudio();

  const rate = opts.playbackRate || 1.0;
  const vol =
    typeof opts.volumePercent === 'number'
      ? Math.max(0.1, Math.min(1.0, opts.volumePercent / 100))
      : globalVolumePercent / 100;

  // If custom audio URL is explicitly provided, try it first
  if (opts.customAudioUrl) {
    try {
      const audio = new Audio(opts.customAudioUrl);
      audio.playbackRate = rate;
      audio.volume = vol;
      activeAudio = audio;

      let played = false;
      audio.onplay = () => {
        played = true;
        opts.onStart?.();
      };
      audio.onended = () => {
        activeAudio = null;
        opts.onEnd?.();
      };
      audio.onerror = () => {
        activeAudio = null;
      };

      await audio.play();
      return true;
    } catch {
      activeAudio = null;
    }
  }

  // 1. Try to find a human dictionary MP3 file
  try {
    const audioUrl = await getDictionaryAudioUrl(cleanWord, accent);
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      audio.volume = vol;
      activeAudio = audio;

      let audioSucceeded = false;

      const playPromise = new Promise<boolean>((resolve) => {
        audio.onplay = () => {
          audioSucceeded = true;
          opts.onStart?.();
        };
        audio.onended = () => {
          activeAudio = null;
          opts.onEnd?.();
          resolve(true);
        };
        audio.onerror = () => {
          activeAudio = null;
          resolve(false);
        };
      });

      // Attempt to play with a short 1200ms load window
      const result = await Promise.race([
        audio.play().then(() => playPromise),
        new Promise<boolean>((res) => setTimeout(() => res(false), 1400)),
      ]);

      if (result) return true;
    }
  } catch {
    activeAudio = null;
  }

  // 2. Reliable Instant Fallback: Web Speech Synthesis API
  return await speakWithSpeechSynthesis(cleanWord, accent, rate, vol, opts);
}
