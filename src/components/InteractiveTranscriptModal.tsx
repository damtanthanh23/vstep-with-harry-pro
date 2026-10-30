import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Languages,
  Headphones,
  Sparkles,
  BookOpen,
  Volume2,
  Check,
  Columns,
  User,
} from 'lucide-react';
import { examAudioManager } from '../utils/audioManager';

export interface SpeakerTurn {
  id: string;
  speaker: string; // e.g. 'A', 'B', 'C', 'Speaker'
  speakerDisplay: string; // e.g. 'Speaker A', 'Speaker B', 'Người nói'
  englishText: string; // All consecutive sentences spoken by this speaker in this turn
  vietnameseText?: string; // Whole-turn translation
  questionBadge?: string; // Optional e.g. 'Câu 1'
  questionId?: number;
}

const NAMED_SPEAKER_ROLES = [
  'Người dẫn chương trình',
  'Người phỏng vấn',
  'Phát thanh viên',
  'Hướng dẫn viên',
  'Người đàn ông',
  'Người phụ nữ',
  'Flight Attendant',
  'Shop Assistant',
  'Radio Host',
  'Tour Guide',
  'Giảng viên',
  'Khách hàng',
  'Khách mời',
  'Chàng trai',
  'Nhân viên',
  'Giám tuyển',
  'Người nói',
  'Interviewer',
  'Receptionist',
  'Instructor',
  'Announcer',
  'Gentleman',
  'Professor',
  'Passenger',
  'Giám đốc',
  'Sinh viên',
  'Học sinh',
  'Diễn giả',
  'Đàn ông',
  'Phụ nữ',
  'Bạn nam',
  'Bạn nữ',
  'Nam sinh',
  'Nữ sinh',
  'Giáo sư',
  'Quản lý',
  'Customer',
  'Narrator',
  'Lecturer',
  'Director',
  'Waitress',
  'Cô gái',
  'Thư ký',
  'Bác sĩ',
  'Lễ tân',
  'Speaker',
  'Teacher',
  'Student',
  'Curator',
  'Manager',
  'Officer',
  'Female',
  'Waiter',
  'Doctor',
  'Driver',
  'Woman',
  'Guest',
  'Clerk',
  'Guide',
  'Male',
  'Host',
  'Lady',
  'Girl',
  'Man',
  'Boy',
  'Nam',
  'Nữ',
  'Ông',
  'Bà',
  'Anh',
  'Chị',
  'Cô',
  'Thầy',
];

const SPEAKER_ROLE_ALT = NAMED_SPEAKER_ROLES.map((r) =>
  r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
).join('|');

// Matches speaker prefix at the start of a line without relying on ASCII \b (which fails on Unicode Vietnamese like "Nữ:")
const LINE_SPEAKER_REGEX = new RegExp(
  `^(?:\\[?(?:Speaker|Người nói|Giọng(?:\\s+đọc)?)\\s*([A-Z1-9])\\]?|(${SPEAKER_ROLE_ALT})(?:\\s+[A-Z1-9])?|([A-G]|M|W))\\s*[:.-]\\s*(.+)$`,
  'i'
);

// Splits inline speaker labels that appear mid-paragraph after sentence punctuation (. ? ! … " ” ')
const INLINE_SPEAKER_SPLIT_REGEX = new RegExp(
  `([.?!…"”'])\\s+(?=(?:\\[?(?:Speaker|Người nói|Giọng)\\s*[A-Z1-9]\\]?|(?:${SPEAKER_ROLE_ALT})|[A-G])\\s*:\\s+)`,
  'gi'
);

function splitInlineSpeakerTurns(raw: string): string {
  return raw.replace(INLINE_SPEAKER_SPLIT_REGEX, '$1\n');
}

function stripLeadingSpeakerPrefix(line: string): string {
  const m = line.trim().match(LINE_SPEAKER_REGEX);
  return m ? m[4].trim() : line.trim();
}

/**
 * Parses an English transcript (and optional Vietnamese transcript) into intact Speaker Turns.
 * Properly supports Unicode Vietnamese speaker prefixes (Nam:, Nữ:, Người đàn ông:, Người phụ nữ:, Giáo sư:, etc.)
 * and attaches each speaker's translation directly inside that speaker's turn box.
 */
export function parseScriptIntoSpeakerTurns(
  englishText: string,
  vietnameseTranslation?: string,
  questionBadge?: string,
  questionId?: number
): SpeakerTurn[] {
  if (!englishText || !englishText.trim()) return [];

  const parseRawTurns = (
    raw: string
  ): Array<{ speaker: string; speakerDisplay: string; text: string; hadExplicitPrefix: boolean }> => {
    const normalizedRaw = splitInlineSpeakerTurns(raw);
    const lines = normalizedRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const turns: Array<{
      speaker: string;
      speakerDisplay: string;
      text: string;
      hadExplicitPrefix: boolean;
    }> = [];

    // Map named roles (e.g. Man/Woman, Nam/Nữ) to A, B, C in order of first appearance in the conversation
    const roleToLetterMap = new Map<string, string>();
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    let nextLetterIdx = 0;

    const getCanonicalRoleKey = (roleWord: string): string => {
      const lower = roleWord.toLowerCase().trim();
      if (
        [
          'man',
          'male',
          'boy',
          'gentleman',
          'm',
          'nam',
          'người đàn ông',
          'đàn ông',
          'bạn nam',
          'chàng trai',
          'nam sinh',
          'ông',
          'anh',
          'thầy',
        ].includes(lower)
      ) {
        return 'ROLE_MALE';
      }
      if (
        [
          'woman',
          'female',
          'girl',
          'lady',
          'w',
          'nữ',
          'người phụ nữ',
          'phụ nữ',
          'bạn nữ',
          'cô gái',
          'nữ sinh',
          'bà',
          'cô',
          'chị',
        ].includes(lower)
      ) {
        return 'ROLE_FEMALE';
      }
      return `ROLE_${lower}`;
    };

    for (const line of lines) {
      const match = line.match(LINE_SPEAKER_REGEX);
      if (match) {
        const explicitSpeakerLetter = (match[1] || '').toUpperCase();
        const roleWord = (match[2] || '').trim();
        const singleLetter = (match[3] || '').toUpperCase();
        const content = (match[4] || '').trim();

        let speakerCode = 'A';
        let speakerDisplay = 'Speaker A';

        if (explicitSpeakerLetter && /^[A-G]$/.test(explicitSpeakerLetter)) {
          speakerCode = explicitSpeakerLetter;
          speakerDisplay = `Speaker ${speakerCode}`;
        } else if (singleLetter && /^[A-G]$/.test(singleLetter)) {
          speakerCode = singleLetter;
          speakerDisplay = `Speaker ${speakerCode}`;
        } else {
          const effectiveRole = roleWord || singleLetter || explicitSpeakerLetter || 'Speaker';
          const roleKey = getCanonicalRoleKey(effectiveRole);
          let assigned = roleToLetterMap.get(roleKey);
          if (!assigned) {
            assigned = letters[Math.min(nextLetterIdx, letters.length - 1)];
            nextLetterIdx += 1;
            roleToLetterMap.set(roleKey, assigned);
          }
          speakerCode = assigned;
          speakerDisplay = `${speakerCode} (${effectiveRole})`;
        }

        // Only merge if the previous turn had the exact same speakerCode
        if (turns.length > 0 && turns[turns.length - 1].speaker === speakerCode) {
          turns[turns.length - 1].text += ' ' + content;
        } else {
          turns.push({
            speaker: speakerCode,
            speakerDisplay,
            text: content,
            hadExplicitPrefix: true,
          });
        }
      } else {
        // Continuation line without a speaker prefix
        if (turns.length > 0) {
          turns[turns.length - 1].text += ' ' + line;
        } else {
          turns.push({
            speaker: 'A',
            speakerDisplay: 'Speaker A',
            text: line,
            hadExplicitPrefix: false,
          });
        }
      }
    }

    return turns;
  };

  const enTurns = parseRawTurns(englishText);
  const viTurns = vietnameseTranslation ? parseRawTurns(vietnameseTranslation) : [];

  // Fallback 1: Check if raw non-empty lines match 1-to-1 even if Vietnamese lacked speaker prefixes
  const rawViLines = vietnameseTranslation
    ? splitInlineSpeakerTurns(vietnameseTranslation)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
    : [];

  // Fallback 2: If enTurns has multiple turns but viTurns got collapsed into 1 block, distribute Vietnamese sentences proportionally
  let proportionalViChunks: string[] = [];
  if (enTurns.length > 1 && viTurns.length === 1 && rawViLines.length !== enTurns.length) {
    const fullViText = stripLeadingSpeakerPrefix(viTurns[0].text);
    const viSentences =
      fullViText
        .match(/[^.?!…]+[.?!…]+["'”’)]*|\s*[^.?!…]+$/g)
        ?.map((s) => s.trim())
        .filter((s) => s.length > 0) || [];

    if (viSentences.length >= enTurns.length) {
      const enSentenceCounts = enTurns.map((t) => {
        const rawText = (t as any).englishText || t.text;
        const matches = rawText.match(/[.?!…]+/g);
        return Math.max(1, matches ? matches.length : 1);
      });
      const totalEnSentences = enSentenceCounts.reduce((a, b) => a + b, 0);
      let cursor = 0;
      proportionalViChunks = enTurns.map((_, idx) => {
        if (idx === enTurns.length - 1) {
          return viSentences.slice(cursor).join(' ');
        }
        const share = Math.max(
          1,
          Math.round((enSentenceCounts[idx] / totalEnSentences) * viSentences.length)
        );
        const remainingTurns = enTurns.length - idx - 1;
        const maxTake = Math.max(1, viSentences.length - cursor - remainingTurns);
        const take = Math.min(share, maxTake);
        const chunk = viSentences.slice(cursor, cursor + take).join(' ');
        cursor += take;
        return chunk;
      });
    }
  }

  return enTurns.map((turn, idx) => {
    let matchedVi: string | undefined;

    if (viTurns.length === enTurns.length && viTurns[idx]) {
      matchedVi = stripLeadingSpeakerPrefix(viTurns[idx].text);
    } else if (rawViLines.length === enTurns.length && rawViLines[idx]) {
      matchedVi = stripLeadingSpeakerPrefix(rawViLines[idx]);
    } else if (proportionalViChunks[idx]) {
      matchedVi = stripLeadingSpeakerPrefix(proportionalViChunks[idx]);
    } else if (viTurns[idx]) {
      matchedVi = stripLeadingSpeakerPrefix(viTurns[idx].text);
    } else if (enTurns.length === 1 && vietnameseTranslation?.trim()) {
      matchedVi = stripLeadingSpeakerPrefix(vietnameseTranslation.trim());
    }

    return {
      id: `${questionId || 'q'}-turn-${idx}`,
      speaker: turn.speaker,
      speakerDisplay: turn.speakerDisplay,
      englishText: turn.text,
      vietnameseText: matchedVi,
      questionBadge,
      questionId,
    };
  });
}

export interface ScriptSectionItem {
  questionId: number;
  questionLabel: string; // e.g. 'Câu 1' or 'Conversation 1 (Câu 1–2)'
  prompt?: string;
  englishScript: string;
  vietnameseTranslation?: string;
  evidenceQuote?: string;
}

interface InteractiveScriptPanelProps {
  title?: string;
  subtitle?: string;
  sections: ScriptSectionItem[];
  activeQuestionId?: number;
  highlightQuote?: string | null;
  widthPercent?: number;
  onWidthPresetChange?: (percent: number) => void;
  onSelectQuestion?: (questionId: number) => void;
  onClose?: () => void;
}

const SPEAKER_STYLE_MAP: Record<
  string,
  { badgeBg: string; cardBorder: string; labelColor: string }
> = {
  A: {
    badgeBg: 'bg-[#58CC02] text-white',
    cardBorder: 'border-lime-200 dark:border-lime-800/70 bg-lime-50/40 dark:bg-lime-950/20',
    labelColor: 'text-[#2E7D32] dark:text-[#78E014]',
  },
  B: {
    badgeBg: 'bg-sky-600 text-white',
    cardBorder: 'border-sky-200 dark:border-sky-800/70 bg-sky-50/40 dark:bg-sky-950/20',
    labelColor: 'text-sky-700 dark:text-sky-300',
  },
  C: {
    badgeBg: 'bg-purple-600 text-white',
    cardBorder: 'border-purple-200 dark:border-purple-800/70 bg-purple-50/40 dark:bg-purple-950/20',
    labelColor: 'text-purple-700 dark:text-purple-300',
  },
  D: {
    badgeBg: 'bg-amber-600 text-white',
    cardBorder: 'border-amber-200 dark:border-amber-800/70 bg-amber-50/40 dark:bg-amber-950/20',
    labelColor: 'text-amber-700 dark:text-amber-300',
  },
};

export const InteractiveScriptPanel: React.FC<InteractiveScriptPanelProps> = ({
  title = 'Audio Script & Dịch Song Ngữ',
  subtitle = 'Lời thoại chi tiết & bản dịch song ngữ',
  sections,
  activeQuestionId,
  highlightQuote,
  widthPercent = 45,
  onWidthPresetChange,
  onSelectQuestion,
  onClose,
}) => {
  const [showFullTranslation, setShowFullTranslation] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'active'>('all');
  const [liveTurnTranslations, setLiveTurnTranslations] = useState<Record<string, string>>({});
  const [manualOpenTurns, setManualOpenTurns] = useState<Record<string, boolean>>({});
  const [loadingTurnId, setLoadingTurnId] = useState<string | null>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);

  // Deduplicate consecutive sections that share the same conversation script (e.g., Listening Part 2 Conv 1, 2, 3 or Part 3 Talks)
  const deduplicatedSections = useMemo(() => {
    const result: Array<
      ScriptSectionItem & { coveredQuestionIds: number[] }
    > = [];

    sections.forEach((sec) => {
      const cleanScript = (sec.englishScript || '').trim();
      if (!cleanScript) return;

      const prev = result[result.length - 1];
      const isSameOrSubset =
        prev &&
        (prev.englishScript.trim() === cleanScript ||
          prev.englishScript.trim().includes(cleanScript));

      if (isSameOrSubset && prev) {
        prev.coveredQuestionIds.push(sec.questionId);
        // Keep the most complete Vietnamese translation if the current item has a fuller one
        if (
          sec.vietnameseTranslation &&
          (!prev.vietnameseTranslation ||
            sec.vietnameseTranslation.length > prev.vietnameseTranslation.length)
        ) {
          prev.vietnameseTranslation = sec.vietnameseTranslation;
        }
      } else {
        result.push({
          ...sec,
          coveredQuestionIds: [sec.questionId],
        });
      }
    });

    return result;
  }, [sections]);

  const visibleSections = useMemo(() => {
    if (scopeFilter === 'active' && activeQuestionId) {
      const filtered = deduplicatedSections.filter((s) =>
        s.coveredQuestionIds.includes(activeQuestionId)
      );
      if (filtered.length > 0) return filtered;
    }
    return deduplicatedSections;
  }, [deduplicatedSections, scopeFilter, activeQuestionId]);

  // Auto-scroll to highlighted evidence quote whenever it changes
  useEffect(() => {
    if (highlightQuote && highlightedRef.current) {
      const timer = setTimeout(() => {
        highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [highlightQuote, visibleSections]);

  const handleToggleTurnTranslation = async (turn: SpeakerTurn) => {
    const currentlyShown = showFullTranslation
      ? manualOpenTurns[turn.id] !== false
      : !!manualOpenTurns[turn.id];

    if (currentlyShown) {
      setManualOpenTurns((prev) => ({ ...prev, [turn.id]: false }));
      return;
    }

    setManualOpenTurns((prev) => ({ ...prev, [turn.id]: true }));

    // If this turn already has a static or cached translation, no API call needed
    if (turn.vietnameseText || liveTurnTranslations[turn.id]) {
      return;
    }

    try {
      setLoadingTurnId(turn.id);
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: turn.englishText,
          context: `Lời thoại của ${turn.speakerDisplay} trong bài thi LanguageCert B1`,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          setLiveTurnTranslations((prev) => ({
            ...prev,
            [turn.id]: data.translation,
          }));
        }
      }
    } catch (err) {
      console.error('Turn translation error:', err);
    } finally {
      setLoadingTurnId(null);
    }
  };

  const renderTurnTextWithHighlight = (text: string) => {
    if (!highlightQuote || !highlightQuote.trim() || !text) {
      return text;
    }
    const target = highlightQuote.trim().replace(/^[A-G]\s*[:.-]\s*/i, '');
    const lowerText = text.toLowerCase();
    let index = lowerText.indexOf(target.toLowerCase());
    let matchLen = target.length;

    if (index === -1) {
      const subTarget = target.split(/[.?!]/)[0].trim().slice(0, 28);
      if (subTarget.length > 6) {
        index = lowerText.indexOf(subTarget.toLowerCase());
        matchLen = subTarget.length;
      }
    }

    if (index === -1) return text;

    const before = text.slice(0, index);
    const matched = text.slice(index, index + matchLen);
    const after = text.slice(index + matchLen);

    return (
      <>
        {before}
        <mark
          ref={(el) => {
            if (el) highlightedRef.current = el;
          }}
          id="active-evidence-mark"
          className="rounded-md bg-amber-300 dark:bg-amber-800 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 font-black ring-2 ring-amber-400 inline"
        >
          {matched}
        </mark>
        {after}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-3xl border-2 border-lime-400 dark:border-lime-700 bg-white dark:bg-slate-900 shadow-md">
      {/* Fixed Opaque Header */}
      <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#58CC02] text-white shadow-xs">
            <Headphones className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
              {title}
            </h4>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Width Ratio Presets */}
          {onWidthPresetChange && (
            <div className="hidden lg:inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
              <Columns className="h-3.5 w-3.5 text-slate-400 ml-1.5 mr-1" />
              {[38, 48, 58].map((w) => {
                const label = w === 38 ? '40%' : w === 48 ? '50%' : '60%';
                const active = Math.abs(widthPercent - w) <= 5;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onWidthPresetChange(w)}
                    className={`rounded-lg px-2 py-1 text-[10px] font-black transition-all cursor-pointer ${
                      active
                        ? 'bg-[#58CC02] text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                    title={`Tỉ lệ độ rộng cột trái ${label}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              title="Thu gọn cột Script"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Action Sub-Toolbar */}
      <div className="shrink-0 z-10 bg-lime-50/70 dark:bg-slate-800/70 px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !showFullTranslation;
              setShowFullTranslation(next);
              setManualOpenTurns({});
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
              showFullTranslation
                ? 'bg-[#58CC02] text-white shadow-2xs border-b-2 border-[#3c8c02]'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            <Languages className="h-3.5 w-3.5" />
            <span>{showFullTranslation ? 'Đang bật Dịch toàn bộ' : 'Dịch toàn bộ script'}</span>
          </button>

          {deduplicatedSections.length > 1 && (
            <div className="inline-flex rounded-xl bg-white dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                  scopeFilter === 'all'
                    ? 'bg-slate-900 dark:bg-lime-600 text-white font-black'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Cả Part ({deduplicatedSections.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter('active')}
                className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                  scopeFilter === 'active'
                    ? 'bg-slate-900 dark:bg-lime-600 text-white font-black'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Câu đang chọn
              </button>
            </div>
          )}
        </div>

        {highlightQuote && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 text-[11px] font-black text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
            <Sparkles className="h-3 w-3 text-amber-600" />
            <span>Đang tô sáng bằng chứng</span>
          </span>
        )}
      </div>

      {/* Scrollable Speaker Turns Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        {visibleSections.length === 0 ? (
          <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs italic">
            Chưa có nội dung lời thoại (Script) cho phần này.
          </div>
        ) : (
          visibleSections.map((sec) => {
            const turns = parseScriptIntoSpeakerTurns(
              sec.englishScript,
              sec.vietnameseTranslation,
              sec.questionLabel,
              sec.questionId
            );
            const isSecActive =
              activeQuestionId !== undefined &&
              sec.coveredQuestionIds.includes(activeQuestionId);

            return (
              <div
                key={sec.questionId}
                onClick={() => onSelectQuestion && onSelectQuestion(sec.questionId)}
                className={`rounded-2xl border-2 p-4 transition-all space-y-3 ${
                  isSecActive
                    ? 'border-[#58CC02] bg-white dark:bg-slate-900 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-lime-300'
                }`}
              >
                {/* Section / Question Header */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#2E7D32] px-2.5 py-0.5 text-[11px] font-black text-white shrink-0">
                      <BookOpen className="h-3 w-3" />
                      <span>{sec.questionLabel}</span>
                    </span>
                    {sec.prompt && (
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                        {sec.prompt}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      examAudioManager.speakText(sec.englishScript);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-lime-100 dark:bg-lime-950/70 hover:bg-lime-200 px-2.5 py-1 text-[11px] font-black text-[#2E7D32] dark:text-[#78E014] transition-colors shrink-0 cursor-pointer"
                    title="Nghe toàn bộ đoạn hội thoại này"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Nghe cả đoạn</span>
                  </button>
                </div>

                {/* Clean Intact Speaker Turns (A:, B:, C: inline prefix, no bulky avatar pills) */}
                <div className="space-y-2.5">
                  {turns.map((turn) => {
                    const turnTranslation =
                      turn.vietnameseText || liveTurnTranslations[turn.id];
                    const isTranslationVisible = showFullTranslation
                      ? manualOpenTurns[turn.id] !== false
                      : !!manualOpenTurns[turn.id];
                    const isLoadingThis = loadingTurnId === turn.id;

                    return (
                      <div
                        key={turn.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-3.5 transition-all space-y-2 hover:border-lime-400 dark:hover:border-lime-600 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Dialogue Text with Inline Speaker Prefix */}
                          <div className="flex-1 min-w-0 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                            {turn.speaker && (
                              <span className="font-black text-emerald-600 dark:text-emerald-400 mr-2 shrink-0">
                                {turn.speaker}:
                              </span>
                            )}
                            <span>{renderTurnTextWithHighlight(turn.englishText)}</span>
                          </div>

                          {/* Quick Action Buttons: Nghe & Dịch */}
                          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                examAudioManager.speakText(
                                  turn.englishText,
                                  undefined,
                                  turn.speaker
                                );
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-lime-100 dark:hover:bg-lime-950 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 border border-slate-200 dark:border-slate-700 cursor-pointer"
                              title="Nghe phát âm lượt thoại này"
                            >
                              <Volume2 className="h-3 w-3 text-emerald-600" />
                              <span>Nghe</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleTurnTranslation(turn);
                              }}
                              disabled={isLoadingThis}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 border border-slate-200 dark:border-slate-700 cursor-pointer"
                            >
                              <Languages className="h-3 w-3 text-emerald-600" />
                              <span>
                                {isLoadingThis
                                  ? 'Đang dịch...'
                                  : isTranslationVisible && turnTranslation
                                  ? 'Ẩn dịch'
                                  : 'Dịch'}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Whole-Turn Vietnamese Translation */}
                        {isTranslationVisible && turnTranslation && (
                          <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 p-2.5 border border-emerald-200 dark:border-emerald-800/80 text-xs font-medium text-emerald-900 dark:text-emerald-200 flex items-start gap-2 animate-in fade-in duration-150">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="leading-relaxed">
                              {turn.speaker && (
                                <strong className="font-black text-emerald-800 dark:text-emerald-300 mr-1.5 not-italic">
                                  {turn.speaker}:
                                </strong>
                              )}
                              <span>{turnTranslation}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

interface InteractiveTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  englishText: string;
  vietnameseTranslation?: string;
  highlightSentence?: string | null;
  onSentenceClick?: (sentence: string) => void;
}

/**
 * Compatibility export: No longer renders a blocking popup modal;
 * Script & Translation is now integrated directly in the Left Resizable Column of QuestionStage.
 */
export const InteractiveTranscriptModal: React.FC<InteractiveTranscriptModalProps> = () => {
  return null;
};
