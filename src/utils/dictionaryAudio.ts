/**
 * Utility for playing natural Oxford & Cambridge human dictionary pronunciation
 * Supports both British (UK) and American (US) native recordings with fallbacks.
 */

// Cache for audio URLs to prevent redundant network requests
const audioUrlCache: Record<string, { uk?: string; us?: string }> = {};

// Active audio element tracking for clean single-sound playback
let activeAudio: HTMLAudioElement | null = null;

/**
 * Fetch human dictionary audio URL for a given word and accent (UK or US)
 */
export async function getDictionaryAudioUrl(word: string, accent: 'uk' | 'us'): Promise<string | null> {
  const cleanWord = word.trim().toLowerCase().replace(/[^a-z-]/g, '');
  if (!cleanWord) return null;

  if (audioUrlCache[cleanWord]?.[accent]) {
    return audioUrlCache[cleanWord][accent]!;
  }

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
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
              // General audio
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
  } catch (err) {
    console.warn(`[DictionaryAudio] Network check for "${cleanWord}" failed, using natural stream fallback:`, err);
  }

  // Fallback to high-quality natural TTS audio stream from Google Dictionary CDN
  const langCode = accent === 'uk' ? 'en-gb' : 'en-us';
  const naturalStreamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(
    cleanWord
  )}`;

  if (!audioUrlCache[cleanWord]) audioUrlCache[cleanWord] = {};
  audioUrlCache[cleanWord][accent] = naturalStreamUrl;
  return naturalStreamUrl;
}

/**
 * Play dictionary audio for a word with accent (UK or US)
 * @returns Promise that resolves when audio finishes playing or rejects on failure
 */
export async function playDictionaryAudio(
  word: string,
  accent: 'uk' | 'us',
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  const cleanWord = word.trim().replace(/[#]/g, '');
  if (!cleanWord) return;

  // Stop currently playing audio
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudio = null;
  }

  // Fallback function using browser speech synthesis with accent
  const fallbackSpeechSynthesis = () => {
    if (!('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanWord);
    utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
    utterance.rate = 0.9;
    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  };

  try {
    const audioUrl = await getDictionaryAudioUrl(cleanWord, accent);
    if (!audioUrl) {
      fallbackSpeechSynthesis();
      return;
    }

    const audio = new Audio(audioUrl);
    activeAudio = audio;

    audio.onplay = () => onStart?.();
    audio.onended = () => {
      activeAudio = null;
      onEnd?.();
    };
    audio.onerror = () => {
      activeAudio = null;
      // If audio file fails, fallback to speech synthesis
      fallbackSpeechSynthesis();
    };

    await audio.play();
  } catch {
    fallbackSpeechSynthesis();
  }
}
