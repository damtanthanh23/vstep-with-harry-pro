import {
  collection,
  doc,
  getDocs,
  getDoc,
} from 'firebase/firestore';
import { db, canWriteToFirestore, safeSetDoc, safeDeleteDoc } from '../firebase';
import { OFFICIAL_15_B1_TOPICS, generateDefault15TopicDecks } from '../data/b1Official15TopicsData';
import { B1_VOCAB_LIST } from '../data/b1VocabData';
import { UserVocabDeck, UserVocabFolder } from '../types/vocab';
import { UserVocabStats, UserVocabDeckSummary } from '../types/studentManagement';
import {
  UserVocabPartitionState,
  loadUserVocabState,
  getPartitionKey,
} from './vocabStorageService';

export interface B1VocabCloudSummary {
  totalTopics: number;
  totalWords: number;
  lastBackupAt: number;
  lastBackupBy?: string;
  databaseId: string;
}

/**
 * Strips undefined values to prevent Firestore serialization errors
 */
function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        clean[key] = sanitizeForFirestore(value);
      }
    }
    return clean as T;
  }
  return obj;
}

/**
 * Backup ALL official 15 B1 topics and vocabulary to Cloud Firestore
 */
export async function backupAllB1VocabToFirestore(
  userId?: string,
  userEmail?: string
): Promise<{ success: boolean; totalWords: number; totalTopics: number; error?: string }> {
  if (!canWriteToFirestore()) {
    return {
      success: false,
      totalWords: 0,
      totalTopics: 0,
      error: 'Không thể kết nối Cloud Firestore',
    };
  }

  try {
    let totalWordCount = 0;

    // 1. Save each of the 15 official B1 topics to /vocab_b1_topics/{topicId}
    for (const topic of OFFICIAL_15_B1_TOPICS) {
      totalWordCount += topic.words.length;
      const topicDocRef = doc(db, 'vocab_b1_topics', topic.id);
      const payload = sanitizeForFirestore({
        id: topic.id,
        topicCode: topic.topicCode,
        topicTitleEn: topic.topicTitleEn,
        topicTitleVi: topic.topicTitleVi,
        icon: topic.icon,
        description: topic.description,
        difficulty: topic.difficulty,
        tags: topic.tags,
        wordCount: topic.words.length,
        words: topic.words,
        updatedAt: Date.now(),
        backupBy: userEmail || userId || 'system',
      });
      await safeSetDoc(topicDocRef, payload, { merge: true });
    }

    // 2. Also save core general B1 vocab list to /vocab_b1_topics/core_general_b1
    const generalDocRef = doc(db, 'vocab_b1_topics', 'core_general_b1');
    totalWordCount += B1_VOCAB_LIST.length;
    await safeSetDoc(
      generalDocRef,
      sanitizeForFirestore({
        id: 'core_general_b1',
        topicCode: '00 Core General B1',
        topicTitleEn: 'Core General B1 Vocabulary',
        topicTitleVi: 'Từ Vựng Cốt Lõi VSTEP B1 Tổng Hợp',
        icon: '📚',
        description: 'Ngân hàng từ vựng thông dụng tần suất cao nhất trong đề thi VSTEP B1',
        difficulty: 2,
        tags: ['Cốt lõi', 'Tổng hợp', 'B1 Official'],
        wordCount: B1_VOCAB_LIST.length,
        words: B1_VOCAB_LIST,
        updatedAt: Date.now(),
        backupBy: userEmail || userId || 'system',
      }),
      { merge: true }
    );

    // 3. Save master backup metadata to /settings/b1_vocab_database
    const summaryRef = doc(db, 'settings', 'b1_vocab_database');
    const summaryData: B1VocabCloudSummary = {
      totalTopics: OFFICIAL_15_B1_TOPICS.length + 1,
      totalWords: totalWordCount,
      lastBackupAt: Date.now(),
      lastBackupBy: userEmail || userId || 'damtanthanh23@gmail.com',
      databaseId: 'ai-studio-vsteptutor-6c9f7e6d-6d42-4864-9991-780c76d9f4dc',
    };
    await safeSetDoc(summaryRef, sanitizeForFirestore(summaryData), { merge: true });

    // Store local cache timestamp
    try {
      localStorage.setItem('langcert_b1_vocab_cloud_synced', JSON.stringify(summaryData));
    } catch {
      // Ignore
    }

    return {
      success: true,
      totalWords: totalWordCount,
      totalTopics: OFFICIAL_15_B1_TOPICS.length,
    };
  } catch (error) {
    console.error('Lỗi sao lưu từ vựng B1 lên Firestore:', error);
    return {
      success: false,
      totalWords: 0,
      totalTopics: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Fetch backup status from Firestore
 */
export async function getB1VocabCloudStatus(): Promise<B1VocabCloudSummary | null> {
  try {
    const summaryRef = doc(db, 'settings', 'b1_vocab_database');
    const snap = await getDoc(summaryRef);
    if (snap.exists()) {
      return snap.data() as B1VocabCloudSummary;
    }
  } catch (err) {
    console.warn('Notice reading vocab cloud status:', err);
  }

  // Check local cache
  try {
    const cached = localStorage.getItem('langcert_b1_vocab_cloud_synced');
    if (cached) return JSON.parse(cached);
  } catch {
    // Ignore
  }

  return null;
}

/**
 * Save user personal decks to Firestore subcollection users/{userId}/vocab_decks/{deckId}
 * and publish public decks (`visibility === 'public'`) to `/vocab_b1_topics/community_deck_${deck.id}`
 */
export async function savePersonalDecksToCloud(
  userId: string,
  decks: UserVocabDeck[],
  authorDisplayName?: string
): Promise<void> {
  if (!userId || userId === 'guest' || !canWriteToFirestore()) return;
  try {
    for (const deck of decks) {
      const now = Date.now();
      const docRef = doc(db, 'users', userId, 'vocab_decks', deck.id);
      await safeSetDoc(docRef, sanitizeForFirestore({ ...deck, updatedAt: now }), {
        merge: true,
      });

      const commDocId = `community_deck_${deck.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const commRef = doc(db, 'vocab_b1_topics', commDocId);
      if (deck.visibility === 'public') {
        await safeSetDoc(
          commRef,
          sanitizeForFirestore({
            ...deck,
            isCommunityShared: true,
            authorId: deck.authorId || userId,
            authorName: deck.authorName || authorDisplayName || 'Học viên VSTEP',
            updatedAt: now,
          }),
          { merge: true }
        );
      } else {
        await safeDeleteDoc(commRef).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Notice saving personal decks to cloud:', err);
  }
}

/**
 * Delete a removed personal deck document from Firestore users/{userId}/vocab_decks/{deckId}
 * and remove from `/vocab_b1_topics/community_deck_${deckId}` if published.
 */
export async function deletePersonalDeckFromCloud(
  userId: string,
  deckId: string
): Promise<void> {
  if (!userId || userId === 'guest' || !deckId || !canWriteToFirestore()) return;
  try {
    const docRef = doc(db, 'users', userId, 'vocab_decks', deckId);
    await safeDeleteDoc(docRef);
    const commDocId = `community_deck_${deckId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const commRef = doc(db, 'vocab_b1_topics', commDocId);
    await safeDeleteDoc(commRef).catch(() => {});
  } catch (err) {
    console.warn('Notice deleting personal deck from cloud:', err);
  }
}

/**
 * Fetch all public Community Vocabulary Decks shared by teachers & students on Cloud Firestore
 */
export async function fetchCommunityDecksFromCloud(): Promise<UserVocabDeck[]> {
  try {
    const colRef = collection(db, 'vocab_b1_topics');
    const snap = await getDocs(colRef);
    const sharedDecks: UserVocabDeck[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      if (
        docSnap.id.startsWith('community_deck_') ||
        data?.isCommunityShared === true ||
        data?.visibility === 'public'
      ) {
        if (data && data.id && Array.isArray(data.items)) {
          sharedDecks.push({
            ...data,
            name: data.name || data.title || 'Bộ từ Cộng đồng',
            title: data.title || data.name || 'Bộ từ Cộng đồng',
            icon: data.icon || '🌐',
            itemCount: data.itemCount || data.items.length,
            visibility: 'public',
          } as UserVocabDeck);
        }
      }
    });
    return sharedDecks.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.warn('Notice fetching community decks from cloud:', err);
    return [];
  }
}

/**
 * Save user's personal vocabulary folders to Firestore users/{userId}/vocab_state/main
 */
export async function savePersonalFoldersToCloud(
  userId: string,
  folders: UserVocabFolder[]
): Promise<void> {
  if (!userId || userId === 'guest' || !canWriteToFirestore()) return;
  try {
    const stateDocRef = doc(db, 'users', userId, 'vocab_state', 'main');
    await safeSetDoc(
      stateDocRef,
      sanitizeForFirestore({
        userId,
        personalFolders: folders,
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Notice saving personal folders to cloud:', err);
  }
}

/**
 * Load user's personal vocabulary folders from Firestore users/{userId}/vocab_state/main
 */
export async function fetchPersonalFoldersFromCloud(
  userId: string
): Promise<UserVocabFolder[] | null> {
  if (!userId || userId === 'guest') return null;
  try {
    const stateDocRef = doc(db, 'users', userId, 'vocab_state', 'main');
    const snap = await getDoc(stateDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.personalFolders)) {
        return data.personalFolders as UserVocabFolder[];
      }
    }
    return null;
  } catch (err) {
    console.warn('Notice loading personal folders from cloud:', err);
    return null;
  }
}

/**
 * Load user personal decks from Firestore
 */
export async function fetchPersonalDecksFromCloud(userId: string): Promise<UserVocabDeck[]> {
  if (!userId || userId === 'guest') return [];
  try {
    const colRef = collection(db, 'users', userId, 'vocab_decks');
    const snap = await getDocs(colRef);
    const list: UserVocabDeck[] = [];
    snap.forEach((d) => {
      list.push(d.data() as UserVocabDeck);
    });
    return list;
  } catch (err) {
    console.warn('Notice loading personal decks from cloud:', err);
    return [];
  }
}

/**
 * Computes accurate UserVocabStats from a user's partition state and deck list
 */
export function computeVocabStatsFromPartition(
  state: Partial<UserVocabPartitionState>,
  allDecks?: UserVocabDeck[]
): UserVocabStats {
  const knownMap = state.knownMap || {};
  const srsMap = state.srsMap || {};
  const sessionHistory = Array.isArray(state.sessionHistory) ? state.sessionHistory : [];

  const masteredKeys = new Set<string>();
  const learningKeys = new Set<string>();
  let latestTimestamp = 0;

  Object.values(knownMap).forEach((rec) => {
    if (!rec) return;
    if (rec.updatedAt && rec.updatedAt > latestTimestamp) {
      latestTimestamp = rec.updatedAt;
    }
    if (rec.isKnown && rec.wordKey) {
      masteredKeys.add(rec.wordKey);
    }
  });

  Object.values(srsMap).forEach((rec) => {
    if (!rec || !rec.enrolled || rec.suspended || !rec.wordKey) return;
    const revTime = rec.lastReviewedAt || rec.levelEnteredAt || 0;
    if (revTime > latestTimestamp) {
      latestTimestamp = revTime;
    }
    if (rec.srsLevel >= 4) {
      masteredKeys.add(rec.wordKey);
      learningKeys.delete(rec.wordKey);
    } else if (!masteredKeys.has(rec.wordKey)) {
      learningKeys.add(rec.wordKey);
    }
  });

  sessionHistory.forEach((sess) => {
    if (sess?.savedAt && sess.savedAt > latestTimestamp) {
      latestTimestamp = sess.savedAt;
    }
    if (Array.isArray(sess?.attempts)) {
      sess.attempts.forEach((att) => {
        if (att?.wordKey && !masteredKeys.has(att.wordKey)) {
          learningKeys.add(att.wordKey);
        }
      });
    }
  });

  const referenceDecks =
    allDecks && allDecks.length > 0 ? allDecks : generateDefault15TopicDecks();

  const deckMetaMap = new Map<string, { name: string; categoryLabel: string; totalWords: number }>();
  referenceDecks.forEach((d) => {
    deckMetaMap.set(d.id, {
      name: d.title || d.name || d.id,
      categoryLabel: d.isCustom
        ? 'Bộ từ cá nhân'
        : d.id.startsWith('exam_deck_')
        ? 'Từ vựng theo Đề thi'
        : '15 Chủ đề chuẩn B1',
      totalWords: d.itemCount || (Array.isArray(d.items) ? d.items.length : 50),
    });
  });

  const perDeckCounts = new Map<
    string,
    { mastered: number; learning: number; updatedAt: number }
  >();

  const ensureDeckEntry = (deckId: string) => {
    let entry = perDeckCounts.get(deckId);
    if (!entry) {
      entry = { mastered: 0, learning: 0, updatedAt: latestTimestamp || Date.now() };
      perDeckCounts.set(deckId, entry);
    }
    return entry;
  };

  masteredKeys.forEach((wk) => {
    const deckId = wk.split('::')[0] || 'b1_general';
    const entry = ensureDeckEntry(deckId);
    entry.mastered += 1;
  });

  learningKeys.forEach((wk) => {
    const deckId = wk.split('::')[0] || 'b1_general';
    const entry = ensureDeckEntry(deckId);
    entry.learning += 1;
  });

  const decksSummary: UserVocabDeckSummary[] = [];
  perDeckCounts.forEach((counts, deckId) => {
    if (counts.mastered === 0 && counts.learning === 0) return;
    const meta = deckMetaMap.get(deckId);
    const totalWords = Math.max(
      meta?.totalWords || 50,
      counts.mastered + counts.learning
    );
    decksSummary.push({
      id: deckId,
      name: meta?.name || `Bộ từ: ${deckId}`,
      categoryLabel: meta?.categoryLabel || '15 Chủ đề chuẩn B1',
      totalWords,
      masteredWords: counts.mastered,
      learningWords: counts.learning,
      updatedAt: counts.updatedAt,
    });
  });

  decksSummary.sort(
    (a, b) => b.masteredWords + b.learningWords - (a.masteredWords + a.learningWords)
  );

  const latestSession = sessionHistory[0];
  const lastStudiedDeckName =
    latestSession?.scopeTitle ||
    decksSummary[0]?.name ||
    (masteredKeys.size > 0 || learningKeys.size > 0 ? '15 Chủ đề chuẩn B1' : '');

  const totalWordsInCatalog = referenceDecks.reduce(
    (sum, d) => sum + (d.itemCount || (Array.isArray(d.items) ? d.items.length : 0)),
    0
  );

  return {
    totalWords: totalWordsInCatalog > 0 ? totalWordsInCatalog : 850,
    masteredCount: masteredKeys.size,
    learningCount: learningKeys.size,
    totalDecks: referenceDecks.length || 15,
    lastStudiedDeckName: lastStudiedDeckName || undefined,
    lastStudiedAt: latestTimestamp > 0 ? latestTimestamp : undefined,
    decks: decksSummary,
    updatedAt: Date.now(),
  };
}

/**
 * Sync user's vocab partition state (knownMap count, SRS, Points, Decks summary) to Firestore
 */
export async function syncUserVocabStateToCloud(
  userId: string,
  state: UserVocabPartitionState,
  allDecks?: UserVocabDeck[]
): Promise<void> {
  if (!userId || userId === 'guest' || !canWriteToFirestore()) return;
  try {
    const vocabStats = computeVocabStatsFromPartition(state, allDecks);

    const personalDecksCount = allDecks
      ? allDecks.filter((d) => d.isCustom || d.id.startsWith('deck_custom_') || d.id.startsWith('personal_')).length
      : undefined;

    const userDocRef = doc(db, 'users', userId);
    await safeSetDoc(
      userDocRef,
      sanitizeForFirestore({
        vocabStats: {
          ...vocabStats,
          ...(personalDecksCount !== undefined ? { personalDecksCount } : {}),
        },
        pointsBalance: state.pointsBalance,
        preferences: {
          audioVolumePercent:
            typeof state.audioVolumePercent === 'number' ? state.audioVolumePercent : 70,
          updatedAt: Date.now(),
        },
        lastActiveAt: Date.now(),
      }),
      { merge: true }
    );

    // Save full partition state in users/{userId}/vocab_state/main
    const stateDocRef = doc(db, 'users', userId, 'vocab_state', 'main');
    await safeSetDoc(
      stateDocRef,
      sanitizeForFirestore({
        userId,
        knownMap: state.knownMap,
        srsMap: state.srsMap,
        srsSettings: state.srsSettings,
        pointsBalance: state.pointsBalance,
        committedSessionIds: (state.committedSessionIds || []).slice(-200),
        sessionHistory: (state.sessionHistory || []).slice(0, 40),
        pinnedRoadmapIds: state.pinnedRoadmapIds || [],
        savedSystemDeckIds: state.savedSystemDeckIds || [],
        clonedCommunityDeckIds: state.clonedCommunityDeckIds || [],
        audioVolumePercent:
          typeof state.audioVolumePercent === 'number' ? state.audioVolumePercent : 70,
        leaderboardOptIn: Boolean(state.leaderboardOptIn),
        updatedAt: Date.now(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Notice syncing vocab state to cloud:', err);
  }
}

/**
 * Hydrate user's vocab partition state from Firestore and merge with local storage
 */
export async function fetchUserVocabStateFromCloud(
  userId: string,
  allDecks?: UserVocabDeck[]
): Promise<UserVocabPartitionState | null> {
  if (!userId || userId === 'guest') return null;

  const localState = loadUserVocabState(userId);
  try {
    const stateDocRef = doc(db, 'users', userId, 'vocab_state', 'main');
    const snap = await getDoc(stateDocRef);

    if (!snap.exists()) {
      // If user has local vocab activity that hasn't been synced to cloud yet, push it up now
      const hasLocalActivity =
        Object.keys(localState.knownMap || {}).length > 0 ||
        Object.keys(localState.srsMap || {}).length > 0 ||
        (localState.sessionHistory || []).length > 0;
      if (hasLocalActivity && canWriteToFirestore()) {
        await syncUserVocabStateToCloud(userId, localState, allDecks);
      }
      return localState;
    }

    const remote = snap.data() as Partial<UserVocabPartitionState>;

    // Merge knownMap (keep latest updatedAt / version)
    const mergedKnownMap = { ...(localState.knownMap || {}) };
    Object.entries(remote.knownMap || {}).forEach(([wk, rRec]) => {
      const lRec = mergedKnownMap[wk];
      if (!lRec || (rRec.updatedAt || 0) >= (lRec.updatedAt || 0)) {
        mergedKnownMap[wk] = rRec;
      }
    });

    // Merge srsMap (keep higher version or newer lastReviewedAt)
    const mergedSrsMap = { ...(localState.srsMap || {}) };
    Object.entries(remote.srsMap || {}).forEach(([wk, rRec]) => {
      const lRec = mergedSrsMap[wk];
      if (
        !lRec ||
        (rRec.version || 0) > (lRec.version || 0) ||
        (rRec.lastReviewedAt || 0) > (lRec.lastReviewedAt || 0)
      ) {
        mergedSrsMap[wk] = rRec;
      }
    });

    // Merge sessionHistory
    const sessMap = new Map<string, any>();
    (localState.sessionHistory || []).forEach((s) => {
      if (s?.sessionId) sessMap.set(s.sessionId, s);
    });
    (remote.sessionHistory || []).forEach((s) => {
      if (s?.sessionId && !sessMap.has(s.sessionId)) {
        sessMap.set(s.sessionId, s);
      }
    });
    const mergedSessions = Array.from(sessMap.values())
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
      .slice(0, 50);

    const mergedCommittedIds = Array.from(
      new Set([
        ...(localState.committedSessionIds || []),
        ...(remote.committedSessionIds || []),
      ])
    );

    const mergedState: UserVocabPartitionState = {
      ...localState,
      userId,
      knownMap: mergedKnownMap,
      srsMap: mergedSrsMap,
      srsSettings:
        (remote.srsSettings?.updatedAt || 0) > (localState.srsSettings?.updatedAt || 0)
          ? { ...localState.srsSettings, ...remote.srsSettings }
          : localState.srsSettings,
      pointsBalance: Math.max(
        localState.pointsBalance || 120,
        typeof remote.pointsBalance === 'number' ? remote.pointsBalance : 120
      ),
      committedSessionIds: mergedCommittedIds,
      sessionHistory: mergedSessions,
      pinnedRoadmapIds: Array.from(
        new Set([
          ...(localState.pinnedRoadmapIds || []),
          ...(remote.pinnedRoadmapIds || []),
        ])
      ),
      savedSystemDeckIds: Array.from(
        new Set([
          ...(localState.savedSystemDeckIds || []),
          ...(remote.savedSystemDeckIds || []),
        ])
      ),
      clonedCommunityDeckIds: Array.from(
        new Set([
          ...(localState.clonedCommunityDeckIds || []),
          ...(remote.clonedCommunityDeckIds || []),
        ])
      ),
      audioVolumePercent:
        typeof remote.audioVolumePercent === 'number'
          ? Math.max(0, Math.min(100, remote.audioVolumePercent))
          : localState.audioVolumePercent,
      leaderboardOptIn: Boolean(localState.leaderboardOptIn || remote.leaderboardOptIn),
    };

    try {
      localStorage.setItem(getPartitionKey(userId), JSON.stringify(mergedState));
    } catch {
      // Ignore storage quota
    }

    // Ensure top-level users/{userId} has up-to-date vocabStats
    const hasMergedActivity =
      Object.keys(mergedKnownMap).length > 0 ||
      Object.keys(mergedSrsMap).length > 0 ||
      mergedSessions.length > 0;
    if (hasMergedActivity && canWriteToFirestore()) {
      const vocabStats = computeVocabStatsFromPartition(mergedState, allDecks);
      await safeSetDoc(
        doc(db, 'users', userId),
        sanitizeForFirestore({
          vocabStats,
          pointsBalance: mergedState.pointsBalance,
        }),
        { merge: true }
      );
    }

    return mergedState;
  } catch (err) {
    console.warn('Notice fetching vocab state from cloud:', err);
    return localState;
  }
}
