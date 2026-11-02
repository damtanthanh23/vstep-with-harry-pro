import { NormalizedVocabItem, makeWordKey } from '../utils/vocabEngine';

export type SrsLevelNumber = 0 | 1 | 2 | 3 | 4 | 5;
export type SrsTransitionKey = '0_1' | '1_2' | '2_3' | '3_4' | '4_5';
export type SrsStepMode = 'flashcard' | 'quiz' | 'spell' | 'dictation';
export type Lv5CycleOption = null | 15 | 30 | 45 | 60;

export interface SrsWordRecord {
  wordKey: string; // `${deckId}::${wordId}`
  deckId: string;
  wordId: string;
  enrolled: boolean;
  suspended: boolean;
  srsLevel: SrsLevelNumber;
  dueAt: number | null; // UTC timestamp ms, null when Lv5 cycle is 'Không ôn lại'
  lastReviewedAt: number | null;
  levelEnteredAt: number;
  reviewCount: number;
  lapseCount: number;
  schedulerVersion: number;
  version: number;
  contentVersion: number;
  enrollmentSource?: 'known_confirm' | 'legacy_migration' | 'manual';
}

export interface VocabSrsSettings {
  reviewPresentation: 'per-level' | 'all-flashcards';
  transitions: Record<SrsTransitionKey, SrsStepMode>;
  lv5CycleDays: Lv5CycleOption;
  updatedAt: number;
}

export const DEFAULT_SRS_SETTINGS: VocabSrsSettings = {
  reviewPresentation: 'per-level',
  transitions: {
    '0_1': 'quiz',
    '1_2': 'quiz',
    '2_3': 'spell',
    '3_4': 'dictation',
    '4_5': 'dictation',
  },
  lv5CycleDays: null, // Không ôn lại
  updatedAt: 0,
};

export const SRS_SCHEDULE_CONFIG = {
  version: 1,
  calendarDaysByTransition: {
    0: 1, // Lv0 -> Lv1: +1 calendar day
    1: 3, // Lv1 -> Lv2: +3 calendar days
    2: 7, // Lv2 -> Lv3: +7 calendar days
    3: 14, // Lv3 -> Lv4: +14 calendar days
  } as Record<number, number>,
  lapseRetryMinutes: 10, // Sai hoặc hết giờ -> Lv0, hẹn sau 10 phút
  assistedHoldDays: 1, // Đúng có trợ giúp ở Lv0-Lv2 -> giữ level, hẹn sau 1 ngày lịch
};

export interface WordKnownRecord {
  wordKey: string;
  deckId: string;
  wordId: string;
  isKnown: boolean;
  updatedAt: number;
  version: number;
}

export type SessionEndReason = 'completed' | 'out_of_lives' | 'caught_by_yeti' | 'early_exit';

export interface SessionItemAttempt {
  wordKey: string;
  deckId: string;
  wordId: string;
  wordSnapshot: string;
  meaningSnapshot: string;
  phoneticSnapshot?: string;
  posSnapshot?: string;
  modeUsed: string;
  outcome: 'correct' | 'assisted_correct' | 'incorrect' | 'timeout' | 'self_rated' | 'incomplete';
  selfRating?: 'known' | 'forgot';
  hintCount: number;
  usedExample: boolean;
  usedTranslation: boolean;
  usedAudioHelp: boolean;
  earnedPoints: number;
  srsBeforeLevel?: SrsLevelNumber;
  srsBeforeDueAt?: number | null;
  srsBeforeVersion?: number;
  wasDueAtSessionStart?: boolean;
}

export interface VocabSavedSession {
  sessionId: string;
  parentSessionId?: string;
  sessionKind: 'regular' | 'srs';
  scopeType: 'deck' | 'roadmap' | 'personal-decks';
  scopeId: string;
  scopeTitle: string;
  mode: string;
  subMode?: string;
  endReason: SessionEndReason;
  totalItemsInSession: number;
  attempts: SessionItemAttempt[];
  allWordKeysSnapshot: string[];
  independentCorrectCount: number;
  assistedCorrectCount: number;
  incorrectCount: number;
  timeoutCount: number;
  selfRatedKnownCount: number;
  selfRatedForgotCount: number;
  incompleteCount: number;
  unaskedCount: number;
  objectiveAccuracyPercent: number | null; // null if 0 objective questions graded
  matchingPairsCompleted?: number;
  matchingWrongClicks?: number;
  durationSeconds: number;
  pointsEarned: number;
  balanceBefore: number;
  balanceAfter: number;
  markedKnownWordKeys: string[];
  conflictsCount?: number;
  savedAt: number;
}

export interface UserVocabPartitionState {
  schemaVersion: number;
  userId: string;
  knownMap: Record<string, WordKnownRecord>;
  srsMap: Record<string, SrsWordRecord>;
  srsSettings: VocabSrsSettings;
  pointsBalance: number;
  committedSessionIds: string[];
  sessionHistory: VocabSavedSession[];
  pinnedRoadmapIds: string[];
  savedSystemDeckIds: string[];
  clonedCommunityDeckIds?: string[];
  audioVolumePercent: number; // 0..100, default 70
  leaderboardOptIn: boolean; // default false (private)
  migratedLegacyKnown: boolean;
}

const STORAGE_PREFIX = 'langcert_vocab_partition_v3_';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

/**
 * Compute UTC timestamp corresponding to +N calendar days in Asia/Ho_Chi_Minh
 * Preserves current time of day or starts at 06:00 AM Ho Chi Minh time on that future date.
 */
export function addHoChiMinhCalendarDays(baseUtcMs: number, daysToAdd: number): number {
  // Ho Chi Minh is UTC+7
  const HCM_OFFSET_MS = 7 * 60 * 60 * 1000;
  const hcmTime = new Date(baseUtcMs + HCM_OFFSET_MS);
  hcmTime.setUTCDate(hcmTime.getUTCDate() + daysToAdd);
  return hcmTime.getTime() - HCM_OFFSET_MS;
}

export function getPartitionKey(userId?: string | null): string {
  const safeUid = userId && userId.trim() ? userId.trim() : 'guest';
  return `${STORAGE_PREFIX}${safeUid}`;
}

export function loadUserVocabState(userId?: string | null): UserVocabPartitionState {
  const safeUid = userId && userId.trim() ? userId.trim() : 'guest';
  const key = getPartitionKey(safeUid);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserVocabPartitionState>;
      return {
        schemaVersion: 3,
        userId: safeUid,
        knownMap: parsed.knownMap || {},
        srsMap: parsed.srsMap || {},
        srsSettings: {
          ...DEFAULT_SRS_SETTINGS,
          ...(parsed.srsSettings || {}),
          transitions: {
            ...DEFAULT_SRS_SETTINGS.transitions,
            ...(parsed.srsSettings?.transitions || {}),
          },
        },
        pointsBalance: typeof parsed.pointsBalance === 'number' ? parsed.pointsBalance : 120,
        committedSessionIds: Array.isArray(parsed.committedSessionIds)
          ? parsed.committedSessionIds
          : [],
        sessionHistory: Array.isArray(parsed.sessionHistory) ? parsed.sessionHistory : [],
        pinnedRoadmapIds: Array.isArray(parsed.pinnedRoadmapIds)
          ? parsed.pinnedRoadmapIds
          : ['roadmap_b1_master', 'roadmap_listening_parts'],
        savedSystemDeckIds: Array.isArray(parsed.savedSystemDeckIds)
          ? parsed.savedSystemDeckIds
          : [],
        clonedCommunityDeckIds: Array.isArray(parsed.clonedCommunityDeckIds)
          ? parsed.clonedCommunityDeckIds
          : [],
        audioVolumePercent:
          typeof parsed.audioVolumePercent === 'number'
            ? Math.max(0, Math.min(100, parsed.audioVolumePercent))
            : 70,
        leaderboardOptIn: Boolean(parsed.leaderboardOptIn),
        migratedLegacyKnown: Boolean(parsed.migratedLegacyKnown),
      };
    }
  } catch (e) {
    console.warn('Error loading vocab partition state:', e);
  }

  return {
    schemaVersion: 3,
    userId: safeUid,
    knownMap: {},
    srsMap: {},
    srsSettings: { ...DEFAULT_SRS_SETTINGS, updatedAt: Date.now() },
    pointsBalance: 120,
    committedSessionIds: [],
    sessionHistory: [],
    pinnedRoadmapIds: ['roadmap_b1_master', 'roadmap_listening_parts'],
    savedSystemDeckIds: [],
    clonedCommunityDeckIds: [],
    audioVolumePercent: 70,
    leaderboardOptIn: false,
    migratedLegacyKnown: false,
  };
}

export function saveUserVocabState(state: UserVocabPartitionState): void {
  const key = getPartitionKey(state.userId);
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn('Error saving vocab partition state:', e);
  }
}

/**
 * One-time idempotent migration of legacy `isMastered` items on decks into `knownMap` & `srsMap` (Lv0 due immediately)
 */
export function runLegacyVocabMigrationIfNeeded(
  state: UserVocabPartitionState,
  allNormalizedItems: NormalizedVocabItem[]
): { state: UserVocabPartitionState; changed: boolean } {
  if (state.migratedLegacyKnown) {
    return { state, changed: false };
  }

  const now = Date.now();
  const nextKnownMap = { ...state.knownMap };
  const nextSrsMap = { ...state.srsMap };
  let changed = false;

  allNormalizedItems.forEach((item) => {
    if (item.isMastered) {
      if (!nextKnownMap[item.wordKey]) {
        nextKnownMap[item.wordKey] = {
          wordKey: item.wordKey,
          deckId: item.deckId,
          wordId: item.id,
          isKnown: true,
          updatedAt: now,
          version: 1,
        };
        changed = true;
      }
      if (!nextSrsMap[item.wordKey]) {
        nextSrsMap[item.wordKey] = {
          wordKey: item.wordKey,
          deckId: item.deckId,
          wordId: item.id,
          enrolled: true,
          suspended: false,
          srsLevel: 0,
          dueAt: now,
          lastReviewedAt: null,
          levelEnteredAt: now,
          reviewCount: 0,
          lapseCount: 0,
          schedulerVersion: SRS_SCHEDULE_CONFIG.version,
          version: 1,
          contentVersion: item.contentVersion || 1,
          enrollmentSource: 'legacy_migration',
        };
        changed = true;
      }
    }
  });

  const nextState: UserVocabPartitionState = {
    ...state,
    knownMap: nextKnownMap,
    srsMap: nextSrsMap,
    migratedLegacyKnown: true,
  };
  saveUserVocabState(nextState);
  return { state: nextState, changed: true };
}

/**
 * Toggle isKnown outside of a game session (e.g. in Deck Word Table).
 * Enrolls in SRS Lv0 (due immediately) on first confirmation of isKnown=true.
 * Unchecking isKnown does NOT delete or alter existing SRS record.
 */
export function toggleWordKnownDirect(
  state: UserVocabPartitionState,
  deckId: string,
  wordId: string,
  contentVersion = 1
): UserVocabPartitionState {
  const now = Date.now();
  const wordKey = makeWordKey(deckId, wordId);
  const existingKnown = state.knownMap[wordKey];
  const nextIsKnown = !(existingKnown?.isKnown ?? false);

  const nextKnownMap = {
    ...state.knownMap,
    [wordKey]: {
      wordKey,
      deckId,
      wordId,
      isKnown: nextIsKnown,
      updatedAt: now,
      version: (existingKnown?.version || 0) + 1,
    },
  };

  const nextSrsMap = { ...state.srsMap };
  if (nextIsKnown && !nextSrsMap[wordKey]) {
    nextSrsMap[wordKey] = {
      wordKey,
      deckId,
      wordId,
      enrolled: true,
      suspended: false,
      srsLevel: 0,
      dueAt: now,
      lastReviewedAt: null,
      levelEnteredAt: now,
      reviewCount: 0,
      lapseCount: 0,
      schedulerVersion: SRS_SCHEDULE_CONFIG.version,
      version: 1,
      contentVersion,
      enrollmentSource: 'known_confirm',
    };
  }

  const nextState: UserVocabPartitionState = {
    ...state,
    knownMap: nextKnownMap,
    srsMap: nextSrsMap,
  };
  saveUserVocabState(nextState);
  return nextState;
}

/**
 * Manually enroll an item into SRS at Lv0 (due immediately) or resume if suspended
 */
export function enrollWordInSrsManual(
  state: UserVocabPartitionState,
  deckId: string,
  wordId: string,
  contentVersion = 1
): UserVocabPartitionState {
  const now = Date.now();
  const wordKey = makeWordKey(deckId, wordId);
  const existing = state.srsMap[wordKey];

  const nextRecord: SrsWordRecord = existing
    ? {
        ...existing,
        enrolled: true,
        suspended: false,
        dueAt: existing.dueAt ?? now,
        version: existing.version + 1,
      }
    : {
        wordKey,
        deckId,
        wordId,
        enrolled: true,
        suspended: false,
        srsLevel: 0,
        dueAt: now,
        lastReviewedAt: null,
        levelEnteredAt: now,
        reviewCount: 0,
        lapseCount: 0,
        schedulerVersion: SRS_SCHEDULE_CONFIG.version,
        version: 1,
        contentVersion,
        enrollmentSource: 'manual',
      };

  const nextState: UserVocabPartitionState = {
    ...state,
    srsMap: {
      ...state.srsMap,
      [wordKey]: nextRecord,
    },
  };
  saveUserVocabState(nextState);
  return nextState;
}

/**
 * Toggle suspend/resume on an SRS record without deleting it
 */
export function toggleSuspendSrsWord(
  state: UserVocabPartitionState,
  wordKey: string
): UserVocabPartitionState {
  const existing = state.srsMap[wordKey];
  if (!existing) return state;

  const nextState: UserVocabPartitionState = {
    ...state,
    srsMap: {
      ...state.srsMap,
      [wordKey]: {
        ...existing,
        suspended: !existing.suspended,
        version: existing.version + 1,
      },
    },
  };
  saveUserVocabState(nextState);
  return nextState;
}

/**
 * Manually adjust an item's SRS level from the SRS management table (Section 14)
 */
export function adjustSrsLevelManually(
  state: UserVocabPartitionState,
  deckId: string,
  wordId: string,
  newLevel: SrsLevelNumber
): UserVocabPartitionState {
  const now = Date.now();
  const wordKey = makeWordKey(deckId, wordId);
  const existing = state.srsMap[wordKey];

  let nextDueAt: number | null = now;
  if (newLevel === 0) {
    nextDueAt = now;
  } else if (newLevel === 1) {
    nextDueAt = addHoChiMinhCalendarDays(now, 1);
  } else if (newLevel === 2) {
    nextDueAt = addHoChiMinhCalendarDays(now, 3);
  } else if (newLevel === 3) {
    nextDueAt = addHoChiMinhCalendarDays(now, 7);
  } else if (newLevel === 4) {
    nextDueAt = addHoChiMinhCalendarDays(now, 14);
  } else if (newLevel === 5) {
    const cycle = state.srsSettings.lv5CycleDays;
    nextDueAt = cycle ? addHoChiMinhCalendarDays(now, cycle) : null;
  }

  const nextRecord: SrsWordRecord = existing
    ? {
        ...existing,
        enrolled: true,
        suspended: false,
        srsLevel: newLevel,
        dueAt: nextDueAt,
        levelEnteredAt: now,
        version: existing.version + 1,
      }
    : {
        wordKey,
        deckId,
        wordId,
        enrolled: true,
        suspended: false,
        srsLevel: newLevel,
        dueAt: nextDueAt,
        lastReviewedAt: null,
        levelEnteredAt: now,
        reviewCount: 0,
        lapseCount: 0,
        schedulerVersion: SRS_SCHEDULE_CONFIG.version,
        version: 1,
        contentVersion: 1,
        enrollmentSource: 'manual',
      };

  const nextState: UserVocabPartitionState = {
    ...state,
    srsMap: {
      ...state.srsMap,
      [wordKey]: nextRecord,
    },
  };
  saveUserVocabState(nextState);
  return nextState;
}

/**
 * Update SRS settings and consistently recalculate dueAt for all existing Lv5 records
 * based on `lastReviewedAt || levelEnteredAt` (never pushing old words back from 'now' if already past due).
 */
export function updateSrsSettingsAndLv5Schedule(
  state: UserVocabPartitionState,
  newSettings: VocabSrsSettings
): UserVocabPartitionState {
  const now = Date.now();
  const nextSrsMap = { ...state.srsMap };
  const cycle = newSettings.lv5CycleDays;

  Object.keys(nextSrsMap).forEach((wKey) => {
    const rec = nextSrsMap[wKey];
    if (rec && rec.enrolled && rec.srsLevel === 5) {
      if (cycle === null) {
        nextSrsMap[wKey] = {
          ...rec,
          dueAt: null,
          version: rec.version + 1,
        };
      } else {
        const anchorMs = rec.lastReviewedAt || rec.levelEnteredAt || now;
        const computedDue = addHoChiMinhCalendarDays(anchorMs, cycle);
        nextSrsMap[wKey] = {
          ...rec,
          dueAt: computedDue <= now ? now : computedDue,
          version: rec.version + 1,
        };
      }
    }
  });

  const nextState: UserVocabPartitionState = {
    ...state,
    srsSettings: {
      ...newSettings,
      updatedAt: now,
    },
    srsMap: nextSrsMap,
  };
  saveUserVocabState(nextState);
  return nextState;
}

/**
 * Compute next SRS state for an item reviewed in an official SRS session (`sessionKind === 'srs'`)
 * Early practice (`wasDueAtSessionStart === false`) does NOT change level or schedule.
 */
export function computeNextSrsAfterReview(
  prev: SrsWordRecord,
  attempt: SessionItemAttempt,
  lv5CycleDays: Lv5CycleOption,
  nowMs: number
): SrsWordRecord {
  // Skip / incomplete -> keep unchanged
  if (attempt.outcome === 'incomplete') {
    return prev;
  }

  // Early practice ("Ôn ngay" when not due yet): do not change level or schedule
  if (!attempt.wasDueAtSessionStart) {
    return prev;
  }

  const curLevel = prev.srsLevel;

  // Wrong, timeout, or self-rated forgot -> Reset to Lv0, due in 10 minutes
  if (
    attempt.outcome === 'incorrect' ||
    attempt.outcome === 'timeout' ||
    (attempt.outcome === 'self_rated' && attempt.selfRating === 'forgot')
  ) {
    return {
      ...prev,
      srsLevel: 0,
      dueAt: nowMs + SRS_SCHEDULE_CONFIG.lapseRetryMinutes * MIN_MS,
      lastReviewedAt: nowMs,
      levelEnteredAt: nowMs,
      reviewCount: prev.reviewCount + 1,
      lapseCount: prev.lapseCount + 1,
      version: prev.version + 1,
    };
  }

  // Assisted correct at Lv0–Lv2 -> Keep level, due in +1 calendar day
  if (attempt.outcome === 'assisted_correct') {
    return {
      ...prev,
      dueAt: addHoChiMinhCalendarDays(nowMs, SRS_SCHEDULE_CONFIG.assistedHoldDays),
      lastReviewedAt: nowMs,
      reviewCount: prev.reviewCount + 1,
      version: prev.version + 1,
    };
  }

  // Independent correct OR self-rated 'known'
  if (
    attempt.outcome === 'correct' ||
    (attempt.outcome === 'self_rated' && attempt.selfRating === 'known')
  ) {
    if (curLevel < 4) {
      const nextLevel = (curLevel + 1) as SrsLevelNumber;
      const waitDays = SRS_SCHEDULE_CONFIG.calendarDaysByTransition[curLevel] || 1;
      return {
        ...prev,
        srsLevel: nextLevel,
        dueAt: addHoChiMinhCalendarDays(nowMs, waitDays),
        lastReviewedAt: nowMs,
        levelEnteredAt: nowMs,
        reviewCount: prev.reviewCount + 1,
        version: prev.version + 1,
      };
    }

    // curLevel === 4 -> Lv5, or curLevel === 5 -> stays Lv5
    const nextDue =
      lv5CycleDays !== null ? addHoChiMinhCalendarDays(nowMs, lv5CycleDays) : null;
    return {
      ...prev,
      srsLevel: 5,
      dueAt: nextDue,
      lastReviewedAt: nowMs,
      levelEnteredAt: curLevel === 4 ? nowMs : prev.levelEnteredAt,
      reviewCount: prev.reviewCount + 1,
      version: prev.version + 1,
    };
  }

  return prev;
}

/**
 * Commit a completed or early-finished session idempotently.
 * Handles multi-tab version checks, known confirmations, SRS updates (if sessionKind === 'srs'),
 * points ledger receipt, and session history.
 */
export function commitVocabSession(
  userId: string | null | undefined,
  payload: {
    sessionId: string;
    parentSessionId?: string;
    sessionKind: 'regular' | 'srs';
    scopeType: 'deck' | 'roadmap' | 'personal-decks';
    scopeId: string;
    scopeTitle: string;
    mode: string;
    subMode?: string;
    endReason: SessionEndReason;
    totalItemsInSession: number;
    allWordKeysSnapshot: string[];
    attempts: SessionItemAttempt[];
    markedKnownWordKeys: string[]; // Explicitly checked by learner on results screen or rated Known in Flashcard
    unmarkedKnownWordKeys?: string[]; // Explicitly rated Forgot in Flashcard
    matchingPairsCompleted?: number;
    matchingWrongClicks?: number;
    durationSeconds: number;
  }
): {
  state: UserVocabPartitionState;
  savedSession: VocabSavedSession;
  alreadyCommitted: boolean;
  conflictsCount: number;
} {
  // Always reload latest state from storage to detect multi-tab updates
  const latestState = loadUserVocabState(userId);

  // Idempotency check
  const existingSession = latestState.sessionHistory.find(
    (s) => s.sessionId === payload.sessionId
  );
  if (
    existingSession ||
    latestState.committedSessionIds.includes(payload.sessionId)
  ) {
    return {
      state: latestState,
      savedSession:
        existingSession ||
        ({
          sessionId: payload.sessionId,
          sessionKind: payload.sessionKind,
          scopeType: payload.scopeType,
          scopeId: payload.scopeId,
          scopeTitle: payload.scopeTitle,
          mode: payload.mode,
          endReason: payload.endReason,
          totalItemsInSession: payload.totalItemsInSession,
          attempts: payload.attempts,
          allWordKeysSnapshot: payload.allWordKeysSnapshot,
          independentCorrectCount: 0,
          assistedCorrectCount: 0,
          incorrectCount: 0,
          timeoutCount: 0,
          selfRatedKnownCount: 0,
          selfRatedForgotCount: 0,
          incompleteCount: 0,
          unaskedCount: 0,
          objectiveAccuracyPercent: null,
          durationSeconds: payload.durationSeconds,
          pointsEarned: 0,
          balanceBefore: latestState.pointsBalance,
          balanceAfter: latestState.pointsBalance,
          markedKnownWordKeys: payload.markedKnownWordKeys,
          savedAt: Date.now(),
        } as VocabSavedSession),
      alreadyCommitted: true,
      conflictsCount: 0,
    };
  }

  const now = Date.now();
  const nextKnownMap = { ...latestState.knownMap };
  const nextSrsMap = { ...latestState.srsMap };
  let conflictsCount = 0;

  // 1. Apply explicit known confirmations (and auto-enroll in SRS Lv0 if not yet enrolled)
  payload.markedKnownWordKeys.forEach((wordKey) => {
    const [deckId, wordId] = wordKey.split('::');
    if (!deckId || !wordId) return;
    const prevKnown = nextKnownMap[wordKey];
    nextKnownMap[wordKey] = {
      wordKey,
      deckId,
      wordId,
      isKnown: true,
      updatedAt: now,
      version: (prevKnown?.version || 0) + 1,
    };

    if (!nextSrsMap[wordKey]) {
      nextSrsMap[wordKey] = {
        wordKey,
        deckId,
        wordId,
        enrolled: true,
        suspended: false,
        srsLevel: 0,
        dueAt: now,
        lastReviewedAt: null,
        levelEnteredAt: now,
        reviewCount: 0,
        lapseCount: 0,
        schedulerVersion: SRS_SCHEDULE_CONFIG.version,
        version: 1,
        contentVersion: 1,
        enrollmentSource: 'known_confirm',
      };
    }
  });

  // Apply explicit Flashcard 'Forgot' unmark if provided (does not delete SRS)
  if (Array.isArray(payload.unmarkedKnownWordKeys)) {
    payload.unmarkedKnownWordKeys.forEach((wordKey) => {
      const [deckId, wordId] = wordKey.split('::');
      if (!deckId || !wordId) return;
      const prevKnown = nextKnownMap[wordKey];
      if (prevKnown?.isKnown) {
        nextKnownMap[wordKey] = {
          ...prevKnown,
          isKnown: false,
          updatedAt: now,
          version: prevKnown.version + 1,
        };
      }
    });
  }

  // 2. If sessionKind === 'srs', update SRS schedule with version conflict check
  const rewardedWordKeys = new Set<string>();
  let totalPointsEarned = 0;

  payload.attempts.forEach((att) => {
    if (payload.sessionKind === 'srs') {
      const currentSrs = nextSrsMap[att.wordKey];
      if (currentSrs) {
        if (
          att.srsBeforeVersion !== undefined &&
          currentSrs.version !== att.srsBeforeVersion
        ) {
          // Another tab modified this item's SRS record while session was running -> keep newer tab's state
          conflictsCount++;
          return;
        }
        nextSrsMap[att.wordKey] = computeNextSrsAfterReview(
          currentSrs,
          att,
          latestState.srsSettings.lv5CycleDays,
          now
        );
      }
    }

    // Max 1 reward per wordKey per sessionId
    if (att.earnedPoints > 0 && !rewardedWordKeys.has(att.wordKey)) {
      rewardedWordKeys.add(att.wordKey);
      totalPointsEarned += Math.round(att.earnedPoints);
    }
  });

  // 3. Calculate statistics
  let independentCorrectCount = 0;
  let assistedCorrectCount = 0;
  let incorrectCount = 0;
  let timeoutCount = 0;
  let selfRatedKnownCount = 0;
  let selfRatedForgotCount = 0;
  let incompleteCount = 0;

  const attemptedWordKeys = new Set<string>();
  payload.attempts.forEach((att) => {
    attemptedWordKeys.add(att.wordKey);
    if (att.outcome === 'correct') independentCorrectCount++;
    else if (att.outcome === 'assisted_correct') assistedCorrectCount++;
    else if (att.outcome === 'incorrect') incorrectCount++;
    else if (att.outcome === 'timeout') timeoutCount++;
    else if (att.outcome === 'self_rated') {
      if (att.selfRating === 'known') selfRatedKnownCount++;
      else selfRatedForgotCount++;
    } else if (att.outcome === 'incomplete') {
      incompleteCount++;
    }
  });

  const totalGradedObjective =
    independentCorrectCount + assistedCorrectCount + incorrectCount + timeoutCount;
  const objectiveAccuracyPercent =
    totalGradedObjective > 0
      ? Math.round(
          ((independentCorrectCount + assistedCorrectCount) / totalGradedObjective) * 100
        )
      : null;

  const unaskedCount = Math.max(
    0,
    payload.totalItemsInSession - attemptedWordKeys.size
  );

  const balanceBefore = latestState.pointsBalance;
  const balanceAfter = balanceBefore + totalPointsEarned;

  const savedSession: VocabSavedSession = {
    sessionId: payload.sessionId,
    parentSessionId: payload.parentSessionId,
    sessionKind: payload.sessionKind,
    scopeType: payload.scopeType,
    scopeId: payload.scopeId,
    scopeTitle: payload.scopeTitle,
    mode: payload.mode,
    subMode: payload.subMode,
    endReason: payload.endReason,
    totalItemsInSession: payload.totalItemsInSession,
    attempts: payload.attempts,
    allWordKeysSnapshot: payload.allWordKeysSnapshot,
    independentCorrectCount,
    assistedCorrectCount,
    incorrectCount,
    timeoutCount,
    selfRatedKnownCount,
    selfRatedForgotCount,
    incompleteCount,
    unaskedCount,
    objectiveAccuracyPercent,
    matchingPairsCompleted: payload.matchingPairsCompleted,
    matchingWrongClicks: payload.matchingWrongClicks,
    durationSeconds: payload.durationSeconds,
    pointsEarned: totalPointsEarned,
    balanceBefore,
    balanceAfter,
    markedKnownWordKeys: payload.markedKnownWordKeys,
    conflictsCount,
    savedAt: now,
  };

  const nextState: UserVocabPartitionState = {
    ...latestState,
    knownMap: nextKnownMap,
    srsMap: nextSrsMap,
    pointsBalance: balanceAfter,
    committedSessionIds: [payload.sessionId, ...latestState.committedSessionIds.slice(0, 199)],
    sessionHistory: [savedSession, ...latestState.sessionHistory.slice(0, 99)],
  };

  saveUserVocabState(nextState);
  return {
    state: nextState,
    savedSession,
    alreadyCommitted: false,
    conflictsCount,
  };
}
