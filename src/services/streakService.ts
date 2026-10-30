import { doc, getDoc } from 'firebase/firestore';
import { auth, db, safeSetDoc } from '../firebase';
import { UserExamAttempt } from '../types/exam';

const STREAK_STORAGE_KEY = 'langcert_study_streak_v1';
const LEGACY_VOCAB_STREAK_KEY = 'langcert_vocab_streak_v2';
export const STREAK_UPDATED_EVENT = 'langcert-streak-updated';

export interface StudyStreakStorage {
  activeDates: string[]; // YYYY-MM-DD in local time
  dailyActivityCount: Record<string, number>;
  lastActivityAt?: number;
  lastActivityLabel?: string;
}

export interface WeekDayStreakStatus {
  label: string; // 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN'
  dateKey: string; // YYYY-MM-DD
  dayNumber: number; // 1..31
  monthNumber: number; // 1..12
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
  activityCount: number;
}

export interface ComputedStreakStatus {
  currentStreak: number;
  longestStreak: number;
  studiedToday: boolean;
  todayCount: number;
  totalActiveDays: number;
  lastActivityLabel?: string;
  lastActivityAt?: number;
  weekDays: WeekDayStreakStatus[];
  activeDates: string[];
}

/**
 * Formats a Date object as local YYYY-MM-DD
 */
export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a local Date at noon (to avoid DST edge cases)
 */
function parseLocalDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

/**
 * Shifts a local Date by N days and returns its YYYY-MM-DD key
 */
function addDaysToKey(dateKey: string, deltaDays: number): string {
  const dt = parseLocalDateKey(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return toLocalDateKey(dt);
}

/**
 * Loads raw streak storage from localStorage
 */
export function loadRawStreakStorage(): StudyStreakStorage {
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.activeDates)) {
        const cleanDates: string[] = Array.from(
          new Set<string>(
            parsed.activeDates.filter(
              (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)
            )
          )
        ).sort();
        return {
          activeDates: cleanDates,
          dailyActivityCount:
            parsed.dailyActivityCount && typeof parsed.dailyActivityCount === 'object'
              ? parsed.dailyActivityCount
              : {},
          lastActivityAt: parsed.lastActivityAt,
          lastActivityLabel: parsed.lastActivityLabel,
        };
      }
    }
  } catch (e) {
    console.warn('Could not read streak storage:', e);
  }

  return {
    activeDates: [],
    dailyActivityCount: {},
  };
}

/**
 * Saves raw streak storage to localStorage and dispatches update event
 */
function saveRawStreakStorage(storage: StudyStreakStorage): ComputedStreakStatus {
  const cleanDates = Array.from(
    new Set(storage.activeDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))
  ).sort();

  const normalized: StudyStreakStorage = {
    ...storage,
    activeDates: cleanDates,
  };

  const computed = computeStreakFromStorage(normalized);

  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(normalized));
    localStorage.setItem(LEGACY_VOCAB_STREAK_KEY, String(computed.currentStreak));
  } catch (e) {
    console.warn('Could not save streak storage:', e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(STREAK_UPDATED_EVENT, { detail: computed }));
  }

  return computed;
}

/**
 * Computes currentStreak, longestStreak, studiedToday, and the 7-day Monday..Sunday strip
 */
export function computeStreakFromStorage(storage: StudyStreakStorage): ComputedStreakStatus {
  const dateSet = new Set(storage.activeDates);
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const yesterdayKey = addDaysToKey(todayKey, -1);

  const studiedToday = dateSet.has(todayKey);
  const studiedYesterday = dateSet.has(yesterdayKey);

  // 1. Calculate current consecutive streak
  let currentStreak = 0;
  if (studiedToday || studiedYesterday) {
    let cursor = studiedToday ? todayKey : yesterdayKey;
    while (dateSet.has(cursor)) {
      currentStreak += 1;
      cursor = addDaysToKey(cursor, -1);
    }
  }

  // 2. Calculate longest streak across all sorted activeDates
  const sorted = [...storage.activeDates].sort();
  let longestStreak = 0;
  let running = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      running = 1;
    } else {
      const prevExpected = addDaysToKey(sorted[i], -1);
      if (sorted[i - 1] === prevExpected) {
        running += 1;
      } else if (sorted[i - 1] !== sorted[i]) {
        running = 1;
      }
    }
    if (running > longestStreak) {
      longestStreak = running;
    }
  }

  // 3. Build current week (Monday = T2 ... Sunday = CN)
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diffToMonday, 12, 0, 0);

  const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const weekDays: WeekDayStreakStatus[] = labels.map((label, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const key = toLocalDateKey(d);
    return {
      label,
      dateKey: key,
      dayNumber: d.getDate(),
      monthNumber: d.getMonth() + 1,
      active: dateSet.has(key),
      isToday: key === todayKey,
      isFuture: key > todayKey,
      activityCount: storage.dailyActivityCount[key] || (dateSet.has(key) ? 1 : 0),
    };
  });

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    studiedToday,
    todayCount: storage.dailyActivityCount[todayKey] || (studiedToday ? 1 : 0),
    totalActiveDays: dateSet.size,
    lastActivityLabel: storage.lastActivityLabel,
    lastActivityAt: storage.lastActivityAt,
    weekDays,
    activeDates: sorted,
  };
}

/**
 * Returns the current computed streak status synchronously
 */
export function getStreakStatus(): ComputedStreakStatus {
  const raw = loadRawStreakStorage();
  return computeStreakFromStorage(raw);
}

/**
 * Records a real study activity today (e.g., completing an exam, answering practice questions, reviewing SRS flashcards)
 */
export function recordStudyActivity(
  activityLabel: string = 'Hoàn thành bài luyện tập',
  explicitUid?: string | null
): ComputedStreakStatus {
  const storage = loadRawStreakStorage();
  const todayKey = toLocalDateKey(new Date());

  if (!storage.activeDates.includes(todayKey)) {
    storage.activeDates.push(todayKey);
  }
  storage.dailyActivityCount[todayKey] = (storage.dailyActivityCount[todayKey] || 0) + 1;
  storage.lastActivityAt = Date.now();
  storage.lastActivityLabel = activityLabel;

  const computed = saveRawStreakStorage(storage);

  // Sync to Firestore if signed in and quota available
  const uid = explicitUid || auth.currentUser?.uid;
  if (uid) {
    const userRef = doc(db, 'users', uid);
    safeSetDoc(
      userRef,
      {
        uid,
        studyStreak: {
          activeDates: storage.activeDates.slice(-365),
          dailyActivityCount: storage.dailyActivityCount,
          lastActivityAt: storage.lastActivityAt,
          lastActivityLabel: storage.lastActivityLabel,
          currentStreak: computed.currentStreak,
          longestStreak: computed.longestStreak,
        },
      },
      { merge: true }
    ).catch(() => {});
  }

  return computed;
}

/**
 * Hydrates and merges streak history from Firestore user profile and completed exam attempts
 */
export async function syncStreakWithCloudAndAttempts(
  uid: string,
  attempts: UserExamAttempt[] = []
): Promise<ComputedStreakStatus> {
  const local = loadRawStreakStorage();
  const mergedDates = new Set<string>(local.activeDates);
  const mergedCounts: Record<string, number> = { ...local.dailyActivityCount };
  let lastActivityAt = local.lastActivityAt || 0;
  let lastActivityLabel = local.lastActivityLabel;

  // 1. Extract dates from historical exam attempts
  attempts.forEach((attempt) => {
    if (attempt.completedAt && typeof attempt.completedAt === 'number') {
      const dateKey = toLocalDateKey(new Date(attempt.completedAt));
      mergedDates.add(dateKey);
      mergedCounts[dateKey] = Math.max(mergedCounts[dateKey] || 0, 1);
      if (attempt.completedAt > lastActivityAt) {
        lastActivityAt = attempt.completedAt;
        lastActivityLabel = `Hoàn thành đề: ${attempt.testTitle}`;
      }
    }
  });

  // 2. Fetch remote studyStreak from Firestore users/{uid}
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      const remoteStreak = data?.studyStreak;
      if (remoteStreak && Array.isArray(remoteStreak.activeDates)) {
        remoteStreak.activeDates.forEach((d: unknown) => {
          if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
            mergedDates.add(d);
          }
        });
      }
      if (remoteStreak?.dailyActivityCount && typeof remoteStreak.dailyActivityCount === 'object') {
        Object.entries(remoteStreak.dailyActivityCount).forEach(([k, v]) => {
          if (typeof v === 'number') {
            mergedCounts[k] = Math.max(mergedCounts[k] || 0, v);
          }
        });
      }
      if (
        typeof remoteStreak?.lastActivityAt === 'number' &&
        remoteStreak.lastActivityAt > lastActivityAt
      ) {
        lastActivityAt = remoteStreak.lastActivityAt;
        lastActivityLabel = remoteStreak.lastActivityLabel || lastActivityLabel;
      }
    }
  } catch (err) {
    console.warn('Could not fetch remote studyStreak:', err);
  }

  const updatedStorage: StudyStreakStorage = {
    activeDates: Array.from(mergedDates).sort(),
    dailyActivityCount: mergedCounts,
    lastActivityAt: lastActivityAt || undefined,
    lastActivityLabel,
  };

  const computed = saveRawStreakStorage(updatedStorage);

  // Save merged state back to Firestore only if remote dates differed from local
  if (updatedStorage.activeDates.length > local.activeDates.length) {
    await safeSetDoc(
      doc(db, 'users', uid),
      {
        uid,
        studyStreak: {
          activeDates: updatedStorage.activeDates.slice(-365),
          dailyActivityCount: updatedStorage.dailyActivityCount,
          lastActivityAt: updatedStorage.lastActivityAt || Date.now(),
          lastActivityLabel: updatedStorage.lastActivityLabel || 'Đồng bộ tiến trình học',
          currentStreak: computed.currentStreak,
          longestStreak: computed.longestStreak,
        },
      },
      { merge: true }
    );
  }

  return computed;
}
