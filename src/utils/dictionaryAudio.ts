/**
 * Utility for playing natural Oxford & Cambridge human dictionary pronunciation
 * Supports both British (UK) and American (US) native recordings, custom audioUrl,
 * adjustable playback speed (0.75x, 1x, 1.25x), volume (0-100%), and clean stop.
 */

const audioUrlCache: Record<string, { uk?: string; us?: string }> = {};
let activeAudio: HTMLAudioElement | null = null;
let globalVolumePercent = 70; // Default 70% per Section 12

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
    } catch {
      // ignore
    }
  }
}

export async function getDictionaryAudioUrl(
  word: string,
  accent: 'uk' | 'us'
): Promise<string | null> {
  const cleanWord = word.trim().toLowerCase().replace(/[^a-z- ]/g, '').trim();
  if (!cleanWord) return null;

  if (audioUrlCache[cleanWord]?.[accent]) {
    return audioUrlCache[cleanWord][accent]!;
  }

  // Only query single-word dictionary API if no spaces
  if (!cleanWord.includes(' ')) {
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`
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
      // Fallback below
    }
  }

  const langCode = accent === 'uk' ? 'en-gb' : 'en-us';
  const naturalStreamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(
    cleanWord
  )}`;

  if (!audioUrlCache[cleanWord]) audioUrlCache[cleanWord] = {};
  audioUrlCache[cleanWord][accent] = naturalStreamUrl;
  return naturalStreamUrl;
}

export interface PlayVocabAudioOptions {
  customAudioUrl?: string;
  playbackRate?: number; // e.g. 0.75, 1.0, 1.25
  volumePercent?: number; // 0..100
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

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

  const cleanWord = word.trim().replace(/[#]/g, '');
  if (!cleanWord) {
    opts.onError?.('Từ vựng rỗng');
    return false;
  }

  stopDictionaryAudio();

  const rate = opts.playbackRate || 1.0;
  const vol =
    typeof opts.volumePercent === 'number'
      ? Math.max(0, Math.min(1, opts.volumePercent / 100))
      : globalVolumePercent / 100;

  const fallbackSpeechSynthesis = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        opts.onError?.('Trình duyệt không hỗ trợ phát âm thanh');
        opts.onEnd?.();
        resolve(false);
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleanWord);
        utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
        utterance.rate = Math.max(0.5, Math.min(1.5, rate * 0.95));
        utterance.volume = vol;
        utterance.onstart = () => {
          opts.onStart?.();
          resolve(true);
        };
        utterance.onend = () => {
          opts.onEnd?.();
        };
        utterance.onerror = () => {
          opts.onError?.('Lỗi đọc âm thanh trình duyệt');
          opts.onEnd?.();
          resolve(false);
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        opts.onError?.('Không thể khởi tạo bộ đọc giọng nói');
        opts.onEnd?.();
        resolve(false);
      }
    });
  };

  try {
    const audioUrl =
      opts.customAudioUrl || (await getDictionaryAudioUrl(cleanWord, accent));
    if (!audioUrl) {
      return await fallbackSpeechSynthesis();
    }

    const audio = new Audio(audioUrl);
    audio.playbackRate = rate;
    audio.volume = vol;
    activeAudio = audio;

    audio.onplay = () => opts.onStart?.();
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
    return await fallbackSpeechSynthesis();
  }
}
