import { ExtendedVocabItem, UserVocabDeck } from '../types/vocab';

export interface ClozeData {
  textWithBlank: string;
  answerText: string;
  answerSpan?: [number, number];
}

export interface WordRef {
  deckId: string;
  wordId: string;
  wordKey: string; // `${deckId}::${wordId}`
}

export type VocabSourceType =
  | 'system'
  | 'exam'
  | 'manual'
  | 'ai_generated'
  | 'ai_passage'
  | 'ai_ocr';

export interface NormalizedVocabItem extends ExtendedVocabItem {
  id: string;
  deckId: string;
  wordKey: string;
  word: string;
  phonetic: string;
  partOfSpeech: 'n' | 'v' | 'adj' | 'adv' | 'phr';
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  acceptedEnglishAnswers: string[];
  acceptedVietnameseAnswers: string[];
  audioUrl?: string;
  wordForms?: string[];
  meaningGroupId?: string;
  cloze?: ClozeData | null;
  sourceType?: VocabSourceType;
  sourceQuote?: string;
  sourceSpan?: [number, number];
  contentVersion: number;
  rawSource?: Record<string, unknown>;
}

export const REWARD_CONFIG = {
  flashcard: 5,
  quiz: 10,
  spell: 10,
  dictation: 15,
  match: 10,
  mixed: 20,
  flappy: 20,
  monkey: 10,
} as const;

export function makeWordKey(deckId: string, wordId: string): string {
  return `${deckId}::${wordId}`;
}

export function makeWordRef(deckId: string, wordId: string): WordRef {
  return {
    deckId,
    wordId,
    wordKey: makeWordKey(deckId, wordId),
  };
}

/**
 * Unbiased Fisher-Yates shuffle. Never mutates input array.
 */
export function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Normalize English string for strict comparison:
 * Unicode NFC, trim, lowercase, collapse whitespace, normalize curly quotes/apostrophes.
 * Preserves spaces in multi-word phrases and hyphens.
 */
export function normalizeEnglishText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201B\u02BC`´]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize Vietnamese string for strict comparison:
 * Unicode NFC, trim, lowercase, collapse whitespace, preserve tone marks.
 */
export function normalizeVietnameseText(input: string): string {
  if (!input) return '';
  return input
    .normalize('NFC')
    .replace(/[\u2018\u2019\u201B\u02BC`´]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Extract individual acceptable Vietnamese meanings from a composite meaning string
 * e.g. "chăm sóc, trông nom / xử lý (công việc)" -> ["chăm sóc, trông nom / xử lý (công việc)", "chăm sóc", "trông nom", "xử lý", "xử lý (công việc)"]
 */
export function extractAcceptedVietnameseMeanings(
  meaningVi: string,
  explicitAccepted?: string[]
): string[] {
  const set = new Set<string>();
  const addClean = (val: string) => {
    const norm = normalizeVietnameseText(val);
    if (norm.length > 0) set.add(norm);
    // Also add version with parenthetical remarks stripped if non-empty
    const stripped = normalizeVietnameseText(val.replace(/\([^)]*\)/g, ''));
    if (stripped.length > 0) set.add(stripped);
  };

  if (Array.isArray(explicitAccepted)) {
    explicitAccepted.forEach(addClean);
  }

  if (meaningVi) {
    addClean(meaningVi);
    const parts = meaningVi.split(/[;/,،|]+/);
    parts.forEach((p) => addClean(p));
  }

  return Array.from(set);
}

/**
 * Extract acceptable English answers from headword, wordForms, and explicit accepted list
 */
export function extractAcceptedEnglishAnswers(
  word: string,
  wordForms?: string[],
  explicitAccepted?: string[]
): string[] {
  const set = new Set<string>();
  const addClean = (val: string) => {
    const norm = normalizeEnglishText(val);
    if (norm.length > 0) set.add(norm);
    // If headword has parenthetical note like "apologise (apologize)", extract both
    const parenMatch = val.match(/^([^(]+)\(([^)]+)\)$/);
    if (parenMatch) {
      const first = normalizeEnglishText(parenMatch[1]);
      const second = normalizeEnglishText(parenMatch[2]);
      if (first) set.add(first);
      if (second) set.add(second);
    }
  };

  if (word) addClean(word);
  if (Array.isArray(wordForms)) wordForms.forEach(addClean);
  if (Array.isArray(explicitAccepted)) explicitAccepted.forEach(addClean);

  return Array.from(set);
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a safe cloze blank from exampleEn without leaking the target word.
 * Returns null if no reliable match is found in exampleEn.
 */
export function buildSafeCloze(
  word: string,
  exampleEn: string,
  wordForms?: string[],
  existingCloze?: ClozeData | null
): ClozeData | null {
  if (
    existingCloze &&
    existingCloze.textWithBlank &&
    existingCloze.textWithBlank.includes('_____') &&
    existingCloze.answerText
  ) {
    return existingCloze;
  }

  const cleanWord = (word || '').trim();
  const cleanExample = (exampleEn || '').trim();
  if (!cleanWord || !cleanExample) return null;

  // Candidate forms to search in example (longest first so phrases match before single words)
  const candidates = new Set<string>();
  candidates.add(cleanWord);
  if (Array.isArray(wordForms)) {
    wordForms.forEach((f) => {
      if (f && f.trim()) candidates.add(f.trim());
    });
  }
  // Common regular inflections only for matching inside the example sentence
  const lower = cleanWord.toLowerCase();
  if (/^[a-z]+$/.test(lower) && lower.length >= 3) {
    candidates.add(`${cleanWord}s`);
    candidates.add(`${cleanWord}es`);
    candidates.add(`${cleanWord}ed`);
    candidates.add(`${cleanWord}d`);
    candidates.add(`${cleanWord}ing`);
    if (lower.endsWith('e')) {
      candidates.add(`${cleanWord.slice(0, -1)}ing`);
    }
    if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
      candidates.add(`${cleanWord.slice(0, -1)}ies`);
      candidates.add(`${cleanWord.slice(0, -1)}ied`);
    }
  }

  const sortedCandidates = Array.from(candidates).sort((a, b) => b.length - a.length);

  for (const cand of sortedCandidates) {
    const escaped = escapeRegExp(cand);
    const regex = new RegExp(`(^|[^a-zA-Z0-9])(${escaped})(?=[^a-zA-Z0-9]|$)`, 'i');
    const match = regex.exec(cleanExample);
    if (match) {
      const prefixLen = match[1].length;
      const startIdx = match.index + prefixLen;
      const matchedText = match[2];
      const endIdx = startIdx + matchedText.length;
      const textWithBlank =
        cleanExample.slice(0, startIdx) + '_____' + cleanExample.slice(endIdx);
      return {
        textWithBlank,
        answerText: matchedText,
        answerSpan: [startIdx, endIdx],
      };
    }
  }

  return null;
}

/**
 * Adapt any legacy or newly imported vocab item into a strict NormalizedVocabItem
 */
export function adaptVocabItem(
  raw: Record<string, any>,
  deckId: string,
  indexFallback = 0
): NormalizedVocabItem {
  const rawWord = String(raw.word || raw.headword || raw.term || '').trim();
  const rawMeaningVi = String(
    raw.meaningVi || raw.meaning || raw.vietnamese || raw.definitionVi || raw.translation || ''
  ).trim();
  const stableId = String(
    raw.id || `w_${deckId}_${indexFallback}_${normalizeEnglishText(rawWord).replace(/[^a-z0-9]/g, '_')}`
  );
  const posRaw = String(raw.partOfSpeech || raw.pos || 'n')
    .trim()
    .toLowerCase();
  const validPos: 'n' | 'v' | 'adj' | 'adv' | 'phr' = ['n', 'v', 'adj', 'adv', 'phr'].includes(
    posRaw
  )
    ? (posRaw as any)
    : 'n';

  const phonetic = String(raw.phonetic || raw.ipa || '').trim();
  const exampleEn = String(raw.exampleEn || raw.example || '').trim();
  const exampleVi = String(raw.exampleVi || raw.exampleMeaning || raw.exampleTranslation || '').trim();

  const wordForms: string[] = Array.isArray(raw.wordForms)
    ? raw.wordForms.map((f: any) => String(f).trim()).filter(Boolean)
    : [];

  const acceptedEnglishAnswers = extractAcceptedEnglishAnswers(
    rawWord,
    wordForms,
    raw.acceptedEnglishAnswers
  );
  const acceptedVietnameseAnswers = extractAcceptedVietnameseMeanings(
    rawMeaningVi,
    raw.acceptedVietnameseAnswers
  );

  const cloze = buildSafeCloze(rawWord, exampleEn, wordForms, raw.cloze);

  return {
    ...(raw as ExtendedVocabItem),
    id: stableId,
    deckId,
    wordKey: makeWordKey(deckId, stableId),
    word: rawWord,
    phonetic,
    partOfSpeech: validPos,
    meaningVi: rawMeaningVi,
    exampleEn,
    exampleVi,
    topic: String(raw.topic || 'General B1'),
    cefr: (raw.cefr || 'B1') as 'B1',
    acceptedEnglishAnswers,
    acceptedVietnameseAnswers,
    audioUrl: raw.audioUrl ? String(raw.audioUrl) : undefined,
    wordForms,
    meaningGroupId: raw.meaningGroupId
      ? String(raw.meaningGroupId)
      : `${normalizeEnglishText(rawWord)}__${normalizeVietnameseText(rawMeaningVi).slice(0, 24)}`,
    cloze,
    sourceType: raw.sourceType || 'system',
    sourceQuote: raw.sourceQuote ? String(raw.sourceQuote) : undefined,
    contentVersion: Number(raw.contentVersion) || 1,
    rawSource: raw,
  };
}

/**
 * Adapt an entire UserVocabDeck so all items are normalized
 */
export function adaptVocabDeck(deck: UserVocabDeck): {
  deck: UserVocabDeck;
  normalizedItems: NormalizedVocabItem[];
} {
  const rawItems = Array.isArray(deck.items) ? deck.items : [];
  const normalizedItems = rawItems
    .map((item, idx) => adaptVocabItem(item as Record<string, any>, deck.id, idx))
    .filter((item) => item.word.length > 0 && item.meaningVi.length > 0);

  const resolvedTitle = deck.title || deck.name || 'Bộ từ vựng';
  return {
    deck: {
      ...deck,
      name: deck.name || resolvedTitle,
      title: resolvedTitle,
      itemCount: normalizedItems.length,
      items: normalizedItems,
    },
    normalizedItems,
  };
}

/**
 * Check English answer against accepted variants
 */
export function checkEnglishAnswer(userInput: string, item: NormalizedVocabItem): boolean {
  const normInput = normalizeEnglishText(userInput);
  if (!normInput) return false;
  return item.acceptedEnglishAnswers.includes(normInput);
}

/**
 * Check Vietnamese answer against accepted meanings
 */
export function checkVietnameseAnswer(userInput: string, item: NormalizedVocabItem): boolean {
  const normInput = normalizeVietnameseText(userInput);
  if (!normInput) return false;
  return item.acceptedVietnameseAnswers.includes(normInput);
}

/**
 * Cumulative Hint Generator (3 levels max):
 * - Level 1: First letter of each word
 * - Level 2: + Last letter of each word
 * - Level 3: + Up to 40% of total letters while keeping at least 1 letter hidden
 */
export interface CumulativeHintState {
  maskedDisplay: string;
  revealedIndices: number[];
  canRevealMore: boolean;
  hintsUsed: number;
  maxHints: number;
}

export function computeCumulativeHint(
  targetWord: string,
  currentRevealedIndices: number[],
  nextHintLevel: number // 0, 1, 2, 3
): CumulativeHintState {
  const chars = Array.from(targetWord);
  const letterIndices: number[] = [];
  chars.forEach((ch, idx) => {
    if (/[a-zA-Z0-9]/.test(ch)) {
      letterIndices.push(idx);
    }
  });

  const totalLetters = letterIndices.length;
  const maxRevealable = Math.max(0, totalLetters - 1); // Always keep at least 1 letter hidden
  const revealedSet = new Set<number>(currentRevealedIndices);

  if (nextHintLevel >= 1 && revealedSet.size < maxRevealable) {
    // Find first letter of each word segment
    let inWord = false;
    for (let i = 0; i < chars.length; i++) {
      if (/[a-zA-Z0-9]/.test(chars[i])) {
        if (!inWord && revealedSet.size < maxRevealable) {
          revealedSet.add(i);
        }
        inWord = true;
      } else {
        inWord = false;
      }
    }
  }

  if (nextHintLevel >= 2 && revealedSet.size < maxRevealable) {
    // Find last letter of each word segment
    for (let i = 0; i < chars.length; i++) {
      const isLetter = /[a-zA-Z0-9]/.test(chars[i]);
      const nextIsLetter = i + 1 < chars.length && /[a-zA-Z0-9]/.test(chars[i + 1]);
      if (isLetter && !nextIsLetter && revealedSet.size < maxRevealable) {
        revealedSet.add(i);
      }
    }
  }

  if (nextHintLevel >= 3 && revealedSet.size < maxRevealable) {
    // Reveal additional letters up to 40% additional or maxRevealable
    const extraQuota = Math.max(1, Math.floor(totalLetters * 0.4));
    const targetCount = Math.min(maxRevealable, revealedSet.size + extraQuota);
    for (const idx of letterIndices) {
      if (revealedSet.size >= targetCount) break;
      if (!revealedSet.has(idx)) {
        revealedSet.add(idx);
      }
    }
  }

  const maskedDisplay = chars
    .map((ch, idx) => {
      if (!/[a-zA-Z0-9]/.test(ch)) return ch;
      return revealedSet.has(idx) ? ch : '_';
    })
    .join(' ');

  const canRevealMore = nextHintLevel < 3 && revealedSet.size < maxRevealable;

  return {
    maskedDisplay,
    revealedIndices: Array.from(revealedSet).sort((a, b) => a - b),
    canRevealMore,
    hintsUsed: nextHintLevel,
    maxHints: 3,
  };
}

/**
 * Quiz Question Subtypes & Generator
 */
export type QuizSubMode = 'word_to_meaning' | 'meaning_to_word' | 'context_cloze';

export interface GeneratedQuizOption {
  id: string;
  label: string;
  wordKey: string;
  isCorrect: boolean;
}

export interface GeneratedQuizQuestion {
  questionId: string;
  targetItem: NormalizedVocabItem;
  subMode: QuizSubMode;
  promptText: string;
  promptPhonetic?: string;
  promptPos?: string;
  contextTranslationVi?: string;
  options: GeneratedQuizOption[];
  fewerOptionsNotice?: string;
}

/**
 * Build distractors ensuring no duplicate display text, no overlapping accepted answers,
 * and no identical meaningGroupId. Prioritizes same partOfSpeech and similar length.
 */
export function generateQuizQuestionForItem(
  targetItem: NormalizedVocabItem,
  allCandidatePool: NormalizedVocabItem[],
  subMode: QuizSubMode,
  questionIndex: number
): GeneratedQuizQuestion | null {
  if (subMode === 'context_cloze' && !targetItem.cloze) {
    return null;
  }

  const targetEnSet = new Set(targetItem.acceptedEnglishAnswers);
  const targetViSet = new Set(targetItem.acceptedVietnameseAnswers);
  const usedDisplayLabels = new Set<string>();

  const correctLabel =
    subMode === 'word_to_meaning'
      ? targetItem.meaningVi
      : subMode === 'context_cloze' && targetItem.cloze
      ? targetItem.cloze.answerText
      : targetItem.word;

  usedDisplayLabels.add(
    subMode === 'word_to_meaning'
      ? normalizeVietnameseText(correctLabel)
      : normalizeEnglishText(correctLabel)
  );

  // Filter valid distractors
  const validDistractors = allCandidatePool.filter((cand) => {
    if (cand.wordKey === targetItem.wordKey) return false;
    if (cand.meaningGroupId && cand.meaningGroupId === targetItem.meaningGroupId) return false;
    // Check overlapping English answers
    for (const en of cand.acceptedEnglishAnswers) {
      if (targetEnSet.has(en)) return false;
    }
    // Check overlapping Vietnamese meanings
    for (const vi of cand.acceptedVietnameseAnswers) {
      if (targetViSet.has(vi)) return false;
    }
    const label = subMode === 'word_to_meaning' ? cand.meaningVi : cand.word;
    const normLabel =
      subMode === 'word_to_meaning'
        ? normalizeVietnameseText(label)
        : normalizeEnglishText(label);
    if (!normLabel || usedDisplayLabels.has(normLabel)) return false;
    return true;
  });

  // Sort by same POS priority + length similarity, with Fisher-Yates pre-shuffle for randomness
  const shuffledPool = fisherYatesShuffle(validDistractors);
  shuffledPool.sort((a, b) => {
    const aSamePos = a.partOfSpeech === targetItem.partOfSpeech ? 0 : 1;
    const bSamePos = b.partOfSpeech === targetItem.partOfSpeech ? 0 : 1;
    if (aSamePos !== bSamePos) return aSamePos - bSamePos;
    const aDiff = Math.abs(a.word.length - targetItem.word.length);
    const bDiff = Math.abs(b.word.length - targetItem.word.length);
    return aDiff - bDiff;
  });

  const chosenDistractors: NormalizedVocabItem[] = [];
  for (const d of shuffledPool) {
    if (chosenDistractors.length >= 3) break;
    const label = subMode === 'word_to_meaning' ? d.meaningVi : d.word;
    const normLabel =
      subMode === 'word_to_meaning'
        ? normalizeVietnameseText(label)
        : normalizeEnglishText(label);
    if (!usedDisplayLabels.has(normLabel)) {
      usedDisplayLabels.add(normLabel);
      chosenDistractors.push(d);
    }
  }

  // Must have at least 1 distractor (total >= 2 options)
  if (chosenDistractors.length === 0) {
    return null;
  }

  const rawOptions: GeneratedQuizOption[] = [
    {
      id: `opt_${targetItem.wordKey}_correct`,
      label: correctLabel,
      wordKey: targetItem.wordKey,
      isCorrect: true,
    },
    ...chosenDistractors.map((d, idx) => ({
      id: `opt_${d.wordKey}_${idx}`,
      label: subMode === 'word_to_meaning' ? d.meaningVi : d.word,
      wordKey: d.wordKey,
      isCorrect: false,
    })),
  ];

  const shuffledOptions = fisherYatesShuffle(rawOptions);

  let promptText = targetItem.word;
  let promptPhonetic: string | undefined = targetItem.phonetic;
  const promptPos = targetItem.partOfSpeech;
  let contextTranslationVi: string | undefined;

  if (subMode === 'meaning_to_word') {
    promptText = targetItem.meaningVi;
    promptPhonetic = undefined; // Never show IPA of answer in Meaning->Word prompt
  } else if (subMode === 'context_cloze' && targetItem.cloze) {
    promptText = targetItem.cloze.textWithBlank;
    promptPhonetic = undefined;
    contextTranslationVi = targetItem.exampleVi || undefined;
  }

  return {
    questionId: `q_${questionIndex}_${targetItem.wordKey}_${Date.now()}`,
    targetItem,
    subMode,
    promptText,
    promptPhonetic,
    promptPos,
    contextTranslationVi,
    options: shuffledOptions,
    fewerOptionsNotice:
      shuffledOptions.length < 4
        ? `Câu hỏi hiển thị ${shuffledOptions.length} lựa chọn do bộ từ chỉ có ${shuffledOptions.length} mục khác nghĩa hợp lệ.`
        : undefined,
  };
}
