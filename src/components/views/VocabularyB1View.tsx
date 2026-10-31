import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Folder,
  Layers,
  Sparkles,
  BookOpen,
  X,
  Trophy,
  Flame,
  FileCode2,
  CheckCircle2,
} from 'lucide-react';
import { doc } from 'firebase/firestore';
import { db, safeSetDoc } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { TestMetadata } from '../../types/exam';
import {
  UserVocabDeck,
  UserVocabFolder,
  VocabSrsRecord,
  ExtendedVocabItem,
  VocabDeckCategoryType,
  OFFICIAL_15_TOPICS,
} from '../../types/vocab';

// Subcomponents
import { VocabMyDecksTab } from './vocab/VocabMyDecksTab';
import { VocabStudyHubTab } from './vocab/VocabStudyHubTab';
import { VocabDeckModal } from './vocab/VocabDeckModal';
import { VocabFolderModal } from './vocab/VocabFolderModal';
import { VocabAiModal } from './vocab/VocabAiModal';
import { VocabQuickImportModal } from './vocab/VocabQuickImportModal';
import { VocabAiPromptModal, BatchImportInstruction } from './VocabAiPromptModal';
import { generateDefault15TopicDecks } from '../../data/b1Official15TopicsData';
import {
  getStreakStatus,
  recordStudyActivity,
  STREAK_UPDATED_EVENT,
  ComputedStreakStatus,
} from '../../services/streakService';

interface VocabularyB1ViewProps {
  selectedTestFilterId?: string | null;
  onClearTestFilter?: () => void;
  tests?: TestMetadata[];
  activeWorkspace?: 'my_decks' | 'study_hub';
  onWorkspaceChange?: (ws: 'my_decks' | 'study_hub') => void;
}

type MainWorkspace = 'my_decks' | 'study_hub';

const LOCAL_DECKS_KEY = 'langcert_custom_vocab_decks_v2';
const LOCAL_FOLDERS_KEY = 'langcert_vocab_folders_v2';
const LOCAL_SRS_KEY = 'langcert_vocab_srs_v2';
const LOCAL_STREAK_KEY = 'langcert_vocab_streak_v2';
const LOCAL_COINS_KEY = 'langcert_vocab_coins_v2';

// SM-2 calculation helper
function computeNextSm2(
  prev: VocabSrsRecord | undefined,
  wordId: string,
  rating: 'again' | 'hard' | 'good' | 'easy'
): VocabSrsRecord {
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MIN_MS = 60 * 1000;

  const currentRep = prev?.repetition ?? 0;
  const currentInterval = prev?.intervalDays ?? 0;
  let ease = prev?.easeFactor ?? 2.5;

  if (rating === 'again') {
    ease = Math.max(1.3, ease - 0.2);
    return {
      wordId,
      intervalDays: 0,
      repetition: 0,
      easeFactor: Number(ease.toFixed(2)),
      dueAt: now + 10 * MIN_MS,
      lastRatedAt: now,
      status: 'learning',
    };
  }

  if (rating === 'hard') {
    ease = Math.max(1.3, ease - 0.15);
    const nextDays = currentInterval === 0 ? 1 : Math.max(1, Math.round(currentInterval * 1.2));
    return {
      wordId,
      intervalDays: nextDays,
      repetition: currentRep + 1,
      easeFactor: Number(ease.toFixed(2)),
      dueAt: now + nextDays * DAY_MS,
      lastRatedAt: now,
      status: nextDays >= 7 ? 'mastered' : 'review',
    };
  }

  if (rating === 'good') {
    const nextDays =
      currentRep === 0
        ? 1
        : currentRep === 1
        ? 3
        : Math.max(4, Math.round(currentInterval * ease));
    return {
      wordId,
      intervalDays: nextDays,
      repetition: currentRep + 1,
      easeFactor: Number(ease.toFixed(2)),
      dueAt: now + nextDays * DAY_MS,
      lastRatedAt: now,
      status: nextDays >= 7 ? 'mastered' : 'review',
    };
  }

  // 'easy'
  ease = ease + 0.15;
  const nextDays =
    currentRep === 0
      ? 4
      : currentRep === 1
      ? 7
      : Math.max(7, Math.round(currentInterval * ease * 1.3));
  return {
    wordId,
    intervalDays: nextDays,
    repetition: currentRep + 1,
    easeFactor: Number(ease.toFixed(2)),
    dueAt: now + nextDays * DAY_MS,
    lastRatedAt: now,
    status: 'mastered',
  };
}

export const VocabularyB1View: React.FC<VocabularyB1ViewProps> = ({
  selectedTestFilterId,
  onClearTestFilter,
  tests = [],
  activeWorkspace,
  onWorkspaceChange,
}) => {
  const { currentUser } = useAuth();

  // 1. Consolidate into 2 Primary Workspaces: 'my_decks' (Kho Từ Vựng) & 'study_hub' (Phòng Luyện Tập)
  const [internalTab, setInternalTab] = useState<MainWorkspace>('my_decks');
  const activeTab: MainWorkspace = activeWorkspace ?? internalTab;
  const setActiveTab = useCallback(
    (next: MainWorkspace) => {
      setInternalTab(next);
      onWorkspaceChange?.(next);
    },
    [onWorkspaceChange]
  );
  const [initialRelFilter, setInitialRelFilter] = useState<'all' | VocabDeckCategoryType>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  // 2. Decks & Folders state
  const [decks, setDecks] = useState<UserVocabDeck[]>(() => {
    const default15Decks = generateDefault15TopicDecks();
    try {
      const saved = localStorage.getItem(LOCAL_DECKS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seenIds = new Set<string>();
          const seenNames = new Set<string>();
          const sanitized: UserVocabDeck[] = [];
          parsed.forEach((d: UserVocabDeck, idx: number) => {
            if (!d || typeof d !== 'object') return;
            const normName = (d.name || '').trim().toLowerCase();
            if (d.id?.startsWith('deck_rm_') && seenNames.has(normName)) {
              return;
            }
            let uniqueId = d.id || `deck_restored_${Date.now()}_${idx}`;
            if (seenIds.has(uniqueId)) {
              uniqueId = `${uniqueId}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
            }
            seenIds.add(uniqueId);
            if (normName) seenNames.add(normName);

            // Auto-populate categoryType for legacy decks if missing
            let categoryType: VocabDeckCategoryType = d.categoryType || 'untagged';
            if (!d.categoryType) {
              if (uniqueId.startsWith('deck_official_') || d.officialTopicCode) {
                categoryType = '15_topics';
              } else if (d.linkedTestId || d.linkedTestTitle) {
                categoryType = 'exam_test';
              } else if (d.customTopicTag) {
                categoryType = 'custom_topic';
              }
            }

            sanitized.push({ ...d, id: uniqueId, categoryType });
          });

          const hasOfficialTopics = sanitized.some((d: UserVocabDeck) =>
            d.id?.startsWith('deck_official_')
          );
          if (hasOfficialTopics) return sanitized;
          return [...default15Decks, ...sanitized];
        }
      }
    } catch (e) {
      console.warn('Error reading local decks:', e);
    }

    return default15Decks;
  });

  const [folders, setFolders] = useState<UserVocabFolder[]>(() => {
    const defaultFolders: UserVocabFolder[] = [
      {
        id: 'folder_15_topics',
        name: '15 Chủ Đề Cốt Lõi B1 Achiever',
        deckIds: [],
        createdAt: Date.now(),
      },
      {
        id: 'folder_listening',
        name: 'Kỹ Năng Nghe (Listening)',
        deckIds: [],
        createdAt: Date.now(),
      },
      {
        id: 'folder_reading',
        name: 'Kỹ Năng Đọc (Reading)',
        deckIds: [],
        createdAt: Date.now(),
      },
    ];

    try {
      const saved = localStorage.getItem(LOCAL_FOLDERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return defaultFolders;
  });

  const [activeDeckId, setActiveDeckId] = useState<string>(() => {
    return decks[0]?.id || 'deck_official_topic_01';
  });

  // Sync any embedded test.vocabulary from `tests` into exam-linked decks automatically
  useEffect(() => {
    if (!tests || tests.length === 0) return;
    setDecks((prev) => {
      let changed = false;
      const next = [...prev];

      tests.forEach((test) => {
        if (!test.vocabulary || test.vocabulary.length === 0) return;
        const deckIdForTest = `deck_exam_${test.id}`;
        const existingIdx = next.findIndex(
          (d) => d.id === deckIdForTest || d.linkedTestId === test.id
        );

        if (existingIdx === -1) {
          const mappedItems: ExtendedVocabItem[] = test.vocabulary.map((v, idx) => ({
            id: v.id || `tv_${test.id}_${idx}`,
            word: v.word,
            phonetic: v.phonetic || '',
            partOfSpeech: v.partOfSpeech || 'n',
            meaningVi: v.meaningVi,
            exampleEn: v.exampleEn || '',
            exampleVi: v.exampleVi || '',
            cefr: v.cefr || 'B1',
            topic: v.topic || 'Exam Vocabulary',
            collocations: (v as ExtendedVocabItem).collocations || '',
            isMastered: false,
            linkedTestId: test.id,
          }));

          next.unshift({
            id: deckIdForTest,
            name: `Từ vựng Đề thi: ${test.title}`,
            description: `Từ vựng trọng tâm trích xuất từ đề thi "${test.title}"`,
            icon: '📝',
            categoryType: 'exam_test',
            linkedTestId: test.id,
            linkedTestTitle: test.title,
            itemCount: mappedItems.length,
            items: mappedItems,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tests]);

  // If user clicked "Từ vựng của đề này" from a Test Card (`selectedTestFilterId`)
  useEffect(() => {
    if (!selectedTestFilterId) return;
    setActiveTab('my_decks');
    setInitialRelFilter('exam_test');

    const matchingDeck = decks.find(
      (d) => d.linkedTestId === selectedTestFilterId || d.id === `deck_exam_${selectedTestFilterId}`
    );
    if (matchingDeck) {
      setActiveDeckId(matchingDeck.id);
    }
  }, [selectedTestFilterId, decks]);

  // 3. SRS SM-2 state
  const [srsRecords, setSrsRecords] = useState<Record<string, VocabSrsRecord>>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_SRS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  // 4. Streak & Coins (Connected to real streakService)
  const [streakCount, setStreakCount] = useState<number>(() => getStreakStatus().currentStreak);

  useEffect(() => {
    setStreakCount(getStreakStatus().currentStreak);
    const handleStreakUpdate = (e: Event) => {
      const ce = e as CustomEvent<ComputedStreakStatus>;
      setStreakCount(ce.detail ? ce.detail.currentStreak : getStreakStatus().currentStreak);
    };
    window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
    return () => window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdate);
  }, []);

  const [coinCount, setCoinCount] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(LOCAL_COINS_KEY)) || 120;
    } catch {
      return 120;
    }
  });

  // 5. Modals
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_DECKS_KEY, JSON.stringify(decks));
    } catch (e) {
      console.warn('LocalStorage save deck error:', e);
    }
  }, [decks]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
    } catch (e) {
      console.warn('LocalStorage save folders error:', e);
    }
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_SRS_KEY, JSON.stringify(srsRecords));
    } catch (e) {
      console.warn('LocalStorage save SRS error:', e);
    }
  }, [srsRecords]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STREAK_KEY, String(streakCount));
  }, [streakCount]);

  useEffect(() => {
    localStorage.setItem(LOCAL_COINS_KEY, String(coinCount));
  }, [coinCount]);

  // Subscribe to user's saved vocabulary decks, folders & SRS progress from Firestore in real time
  useEffect(() => {
    if (!currentUser?.uid) return;

    let unsub: (() => void) | undefined;
    let cancelled = false;

    import('firebase/firestore').then(({ onSnapshot }) => {
      if (cancelled) return;
      const userRef = doc(db, 'users', currentUser.uid);
      unsub = onSnapshot(
        userRef,
        (snap) => {
          if (cancelled || !snap.exists()) return;
          const data = snap.data() as {
            vocabDecksBackup?: UserVocabDeck[];
            vocabFoldersBackup?: UserVocabFolder[];
            vocabSrsBackup?: Record<string, VocabSrsRecord>;
          };

          if (Array.isArray(data.vocabDecksBackup) && data.vocabDecksBackup.length > 0) {
            setDecks((prev) => {
              const map = new Map<string, UserVocabDeck>();
              prev.forEach((d) => map.set(d.id, d));
              data.vocabDecksBackup!.forEach((remoteDeck) => {
                if (!remoteDeck || !remoteDeck.id) return;
                const localDeck = map.get(remoteDeck.id);
                if (!localDeck || (remoteDeck.updatedAt || 0) >= (localDeck.updatedAt || 0)) {
                  map.set(remoteDeck.id, remoteDeck);
                }
              });
              return Array.from(map.values());
            });
          }

          if (Array.isArray(data.vocabFoldersBackup) && data.vocabFoldersBackup.length > 0) {
            setFolders((prev) => {
              const map = new Map<string, UserVocabFolder>();
              prev.forEach((f) => map.set(f.id, f));
              data.vocabFoldersBackup!.forEach((rf) => {
                if (rf && rf.id) map.set(rf.id, rf);
              });
              return Array.from(map.values());
            });
          }

          if (data.vocabSrsBackup && typeof data.vocabSrsBackup === 'object') {
            setSrsRecords((prev) => ({
              ...data.vocabSrsBackup,
              ...prev,
            }));
          }
        },
        () => {}
      );
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [currentUser?.uid]);

  // Firestore Sync if logged in (quota-safe, sanitized, and debounced)
  const hasMountedVocabRef = React.useRef(false);
  useEffect(() => {
    if (!currentUser?.uid) return;
    if (!hasMountedVocabRef.current) {
      hasMountedVocabRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      const userRef = doc(db, 'users', currentUser.uid);
      // Only sync custom decks or modified official decks so payload stays compact
      const customOrModifiedDecks = decks.filter(
        (d) => !d.id.startsWith('deck_official_') || (d.items && d.items.length > 35)
      );
      const cleanDecks = JSON.parse(JSON.stringify(customOrModifiedDecks));
      const cleanFolders = JSON.parse(JSON.stringify(folders));
      const cleanSrs = JSON.parse(JSON.stringify(srsRecords));
      safeSetDoc(
        userRef,
        {
          uid: currentUser.uid,
          vocabDecksBackup: cleanDecks,
          vocabFoldersBackup: cleanFolders,
          vocabSrsBackup: cleanSrs,
        },
        { merge: true }
      ).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [currentUser?.uid, decks, folders, srsRecords]);

  // Handle coins earning & record real study activity
  const handleEarnCoins = (amount: number) => {
    setCoinCount((c) => c + amount);
    recordStudyActivity('Hoàn thành bài luyện từ vựng B1', currentUser?.uid);
  };

  // Add words to a deck
  const handleAddWordsToDeck = useCallback(
    (deckId: string, words: ExtendedVocabItem[]) => {
      setDecks((prev) =>
        prev.map((d) => {
          if (d.id === deckId) {
            const existingWordSet = new Set(d.items.map((i) => i.word.toLowerCase()));
            const newItems = words.filter((w) => !existingWordSet.has(w.word.toLowerCase()));
            const combined = [...d.items, ...newItems];
            return {
              ...d,
              items: combined,
              itemCount: combined.length,
              updatedAt: Date.now(),
            };
          }
          return d;
        })
      );
      setActiveDeckId(deckId);
      setActiveTab('my_decks');
      showToast(`Đã thêm ${words.length} từ vựng vào bộ từ!`);
    },
    [showToast]
  );

  // Create a new deck manually
  const handleCreateDeck = (data: {
    name: string;
    description: string;
    icon: string;
    folderId?: string;
    categoryType?: VocabDeckCategoryType;
    officialTopicCode?: string;
    linkedTestId?: string;
    linkedTestTitle?: string;
    customTopicTag?: string;
  }) => {
    const newDeck: UserVocabDeck = {
      id: `deck_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: data.name,
      description: data.description,
      icon: data.icon,
      folderId: data.folderId,
      categoryType: data.categoryType || 'custom_topic',
      officialTopicCode: data.officialTopicCode,
      linkedTestId: data.linkedTestId,
      linkedTestTitle: data.linkedTestTitle,
      customTopicTag: data.customTopicTag,
      itemCount: 0,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setDecks((prev) => [newDeck, ...prev]);
    setActiveDeckId(newDeck.id);
    if (data.categoryType) {
      setInitialRelFilter(data.categoryType);
    }
    showToast(`Đã tạo bộ từ mới "${data.name}"!`);
  };

  // Update relationship of an existing deck
  const handleUpdateDeckRelationship = useCallback(
    (
      deckId: string,
      rel: {
        categoryType: VocabDeckCategoryType;
        officialTopicCode?: string;
        linkedTestId?: string;
        linkedTestTitle?: string;
        customTopicTag?: string;
      }
    ) => {
      setDecks((prev) =>
        prev.map((d) => {
          if (d.id !== deckId) return d;
          return {
            ...d,
            categoryType: rel.categoryType,
            officialTopicCode: rel.officialTopicCode,
            linkedTestId: rel.linkedTestId,
            linkedTestTitle: rel.linkedTestTitle,
            customTopicTag: rel.customTopicTag,
            updatedAt: Date.now(),
          };
        })
      );
      showToast('Đã cập nhật mối quan hệ & nhãn cho bộ từ!');
    },
    [showToast]
  );

  // Create a new deck pre-populated with words (legacy fallback)
  const handleCreateDeckWithWords = useCallback(
    (deckName: string, description: string, words: ExtendedVocabItem[]) => {
      const newDeck: UserVocabDeck = {
        id: `deck_json_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: deckName,
        description,
        icon: '📚',
        categoryType: 'custom_topic',
        customTopicTag: deckName,
        itemCount: words.length,
        items: words,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setDecks((prev) => [newDeck, ...prev]);
      setActiveDeckId(newDeck.id);
      setActiveTab('my_decks');
      showToast(`Đã tạo bộ từ "${deckName}" với ${words.length} từ vựng!`);
    },
    [showToast]
  );

  // Comprehensive Batch JSON Import Handler supporting all routing modes
  const handleBatchImportVocab = useCallback(
    (payload: BatchImportInstruction) => {
      const {
        mode,
        items,
        customDeckName,
        targetOfficialTopic,
        targetTestId,
        targetTestTitle,
        customTopicTag,
        targetExistingDeckId,
        rawDecks,
      } = payload;
      const deckName =
        customDeckName ||
        rawDecks?.[0]?.name ||
        targetTestTitle ||
        customTopicTag ||
        'Bộ từ vựng JSON';
      const deckDescription =
        rawDecks?.[0]?.description ||
        `Nhập hàng loạt từ JSON (${items.length} từ vựng chuẩn B1)`;

      if (!items || items.length === 0) return;

      if (mode === 'existing_deck' && targetExistingDeckId) {
        handleAddWordsToDeck(targetExistingDeckId, items);
        return;
      }

      if (mode === '15_topics' && targetOfficialTopic) {
        const prefix = targetOfficialTopic.slice(0, 2);
        let matchedDeckId = '';

        setDecks((prev) => {
          const targetIdx = prev.findIndex(
            (d) =>
              d.officialTopicCode === targetOfficialTopic ||
              d.name.startsWith(prefix) ||
              d.id === `deck_official_topic_${prefix}`
          );

          if (targetIdx !== -1) {
            const targetDeck = prev[targetIdx];
            matchedDeckId = targetDeck.id;
            const existingWords = new Set(targetDeck.items.map((w) => w.word.toLowerCase()));
            const toAdd = items.filter((w) => !existingWords.has(w.word.toLowerCase()));
            const merged = [...targetDeck.items, ...toAdd];
            const next = [...prev];
            next[targetIdx] = {
              ...targetDeck,
              categoryType: '15_topics',
              officialTopicCode: targetOfficialTopic,
              items: merged,
              itemCount: merged.length,
              updatedAt: Date.now(),
            };
            return next;
          }

          // Fallback: create official topic deck
          const newId = `deck_official_custom_${Date.now()}`;
          matchedDeckId = newId;
          const newDeck: UserVocabDeck = {
            id: newId,
            name: targetOfficialTopic,
            description: deckDescription,
            icon: '🧭',
            categoryType: '15_topics',
            officialTopicCode: targetOfficialTopic,
            itemCount: items.length,
            items,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          return [newDeck, ...prev];
        });

        if (matchedDeckId) setActiveDeckId(matchedDeckId);
        setInitialRelFilter('15_topics');
        setActiveTab('my_decks');
        showToast(`Đã gộp ${items.length} từ vào chủ đề "${targetOfficialTopic}"!`);
        return;
      }

      if (mode === 'auto_15_topics') {
        let firstTouchedDeckId = '';
        let distributedCount = 0;

        setDecks((prev) => {
          const next = [...prev];
          const unmatched: ExtendedVocabItem[] = [];

          items.forEach((item) => {
            const itemTopic = (item.topic || '').trim();
            const prefixMatch = itemTopic.match(/^(\d{2})\b/);
            const officialMatch = OFFICIAL_15_TOPICS.find(
              (t) =>
                t.toLowerCase() === itemTopic.toLowerCase() ||
                (prefixMatch && t.startsWith(prefixMatch[1]))
            );

            if (officialMatch) {
              const codePrefix = officialMatch.slice(0, 2);
              const dIdx = next.findIndex(
                (d) =>
                  d.officialTopicCode === officialMatch ||
                  d.id === `deck_official_topic_${codePrefix}` ||
                  d.name.startsWith(codePrefix)
              );

              if (dIdx !== -1) {
                const targetDeck = next[dIdx];
                if (!firstTouchedDeckId) firstTouchedDeckId = targetDeck.id;
                const exists = targetDeck.items.some(
                  (w) => w.word.toLowerCase() === item.word.toLowerCase()
                );
                if (!exists) {
                  const updatedItems = [...targetDeck.items, item];
                  next[dIdx] = {
                    ...targetDeck,
                    categoryType: '15_topics',
                    officialTopicCode: officialMatch,
                    items: updatedItems,
                    itemCount: updatedItems.length,
                    updatedAt: Date.now(),
                  };
                  distributedCount++;
                }
                return;
              }
            }

            unmatched.push(item);
          });

          // If there are unmatched words OR user also gave a custom deck name, save unmatched words
          if (unmatched.length > 0) {
            const extraDeckId = `deck_auto_extra_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            if (!firstTouchedDeckId) firstTouchedDeckId = extraDeckId;
            next.unshift({
              id: extraDeckId,
              name: deckName || 'Bộ từ vựng mở rộng (Ngoài 15 chủ đề)',
              description: deckDescription,
              icon: '✨',
              categoryType: 'custom_topic',
              customTopicTag: 'Mở rộng B1',
              itemCount: unmatched.length,
              items: unmatched,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }

          return next;
        });

        if (firstTouchedDeckId) setActiveDeckId(firstTouchedDeckId);
        setInitialRelFilter('15_topics');
        setActiveTab('my_decks');
        showToast(
          `Đã tự động phân bổ ${distributedCount || items.length} từ vựng vào 15 Chủ đề chuẩn B1!`
        );
        return;
      }

      if (mode === 'exam_test') {
        const newDeckId = `deck_exam_json_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newDeck: UserVocabDeck = {
          id: newDeckId,
          name: deckName || `Từ vựng: ${targetTestTitle || 'Đề thi LanguageCert B1'}`,
          description: deckDescription,
          icon: '📝',
          categoryType: 'exam_test',
          linkedTestId: targetTestId,
          linkedTestTitle: targetTestTitle || deckName,
          itemCount: items.length,
          items,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDecks((prev) => [newDeck, ...prev]);
        setActiveDeckId(newDeckId);
        setInitialRelFilter('exam_test');
        setActiveTab('my_decks');
        showToast(`Đã tạo bộ từ gắn với đề thi "${targetTestTitle || deckName}" (${items.length} từ)!`);
        return;
      }

      if (mode === 'custom_topic') {
        const newDeckId = `deck_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newDeck: UserVocabDeck = {
          id: newDeckId,
          name: deckName,
          description: deckDescription,
          icon: '🏷️',
          categoryType: 'custom_topic',
          customTopicTag: customTopicTag || deckName,
          itemCount: items.length,
          items,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDecks((prev) => [newDeck, ...prev]);
        setActiveDeckId(newDeckId);
        setInitialRelFilter('custom_topic');
        setActiveTab('my_decks');
        showToast(`Đã tạo bộ từ chủ đề riêng "${customTopicTag || deckName}" (${items.length} từ)!`);
        return;
      }

      // Default: 'untagged'
      const newDeckId = `deck_untagged_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newDeck: UserVocabDeck = {
        id: newDeckId,
        name: deckName,
        description: deckDescription,
        icon: '📚',
        categoryType: 'untagged',
        itemCount: items.length,
        items,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setDecks((prev) => [newDeck, ...prev]);
      setActiveDeckId(newDeckId);
      setInitialRelFilter('untagged');
      setActiveTab('my_decks');
      showToast(`Đã nhập bộ từ độc lập "${deckName}" (${items.length} từ)!`);
    },
    [handleAddWordsToDeck, showToast]
  );

  // Create a new folder
  const handleCreateFolder = (name: string) => {
    const newFolder: UserVocabFolder = {
      id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      deckIds: [],
      createdAt: Date.now(),
    };
    setFolders((prev) => [...prev, newFolder]);
  };

  // Load / reload all 15 official topic decks
  const handleLoadDefault15Topics = useCallback(() => {
    const default15 = generateDefault15TopicDecks();
    setDecks((prev) => {
      const existingIds = new Set(prev.map((d) => d.id));
      const missingDecks = default15.filter((d) => !existingIds.has(d.id));
      if (missingDecks.length === 0) {
        const defaultMap = new Map(default15.map((d) => [d.id, d]));
        return prev.map((d) => (defaultMap.has(d.id) ? defaultMap.get(d.id)! : d));
      }
      return [...missingDecks, ...prev];
    });
    setActiveDeckId('deck_official_topic_01');
    setInitialRelFilter('15_topics');
    setActiveTab('my_decks');
    showToast('Đã đồng bộ đầy đủ 15 Chủ đề chuẩn LanguageCert B1!');
  }, [showToast]);

  // Toggle master status of a word
  const handleToggleMasterWord = (deckId: string, wordId: string) => {
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id === deckId) {
          const updatedItems = d.items.map((w) =>
            w.id === wordId ? { ...w, isMastered: !w.isMastered } : w
          );
          return { ...d, items: updatedItems };
        }
        return d;
      })
    );
    recordStudyActivity('Ôn tập & đánh dấu thuộc từ vựng B1', currentUser?.uid);
  };

  // Delete a word from a deck
  const handleDeleteWord = (deckId: string, wordId: string) => {
    setDecks((prev) =>
      prev.map((d) => {
        if (d.id === deckId) {
          const updatedItems = d.items.filter((w) => w.id !== wordId);
          return { ...d, items: updatedItems, itemCount: updatedItems.length };
        }
        return d;
      })
    );
  };

  // Delete a deck
  const handleDeleteDeck = (deckId: string) => {
    setDecks((prev) => {
      const next = prev.filter((d) => d.id !== deckId);
      if (activeDeckId === deckId && next.length > 0) {
        setActiveDeckId(next[0].id);
      }
      return next;
    });
    showToast('Đã xóa bộ từ vựng.');
  };

  // Delete a folder
  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
  };

  // Launch practice arena directly for a specific deck
  const handleStartPracticeDeck = useCallback(
    (deckId: string) => {
      setActiveDeckId(deckId);
      setActiveTab('study_hub');
    },
    [setActiveTab]
  );

  // SRS Rating handler
  const handleRateSrsWord = (wordId: string, rating: 'again' | 'hard' | 'good' | 'easy') => {
    setSrsRecords((prev) => {
      const current = prev[wordId];
      const updated = computeNextSm2(current, wordId, rating);
      return { ...prev, [wordId]: updated };
    });
    handleEarnCoins(5);
  };

  // Test filter detection: if selectedTestFilterId is given, display an info strip
  const filteredTest = useMemo(() => {
    if (!selectedTestFilterId) return null;
    return tests.find((t) => t.id === selectedTestFilterId) || null;
  }, [selectedTestFilterId, tests]);

  // Active deck summary for top switcher
  const activeDeckObj = useMemo(
    () => decks.find((d) => d.id === activeDeckId) || decks[0],
    [decks, activeDeckId]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-extrabold shadow-xl border border-slate-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-white shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TEST LINKED BANNER (If user navigated from a specific test) */}
      {filteredTest && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  ĐANG XEM TỪ VỰNG CỦA ĐỀ THI:
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  {filteredTest.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bạn có thể ôn tập bộ từ của đề này hoặc nhấn "Nhập file JSON & AI Prompt" để bổ sung thêm từ vựng từ đề PDF & Audio Script.
              </p>
            </div>
          </div>
          {onClearTestFilter && (
            <button
              onClick={() => {
                onClearTestFilter();
                setInitialRelFilter('all');
              }}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
            >
              <X className="w-4 h-4" /> Xem tất cả bộ từ
            </button>
          )}
        </div>
      )}

      {/* VOCABULARY PAGE HEADER & QUICK ACTIONS */}
      <div className="bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30 text-xs font-bold tracking-wide uppercase">
              <Sparkles className="w-3.5 h-3.5" /> LanguageCert B1 Achiever Vocabulary
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Hệ Thống Quản Lý & Luyện Từ Vựng B1
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Tổ chức trực quan theo 4 mối liên kết: <strong>15 Chủ đề chuẩn B1</strong>,{' '}
              <strong>Theo Đề thi trong Web</strong>, <strong>Chủ đề tự tạo</strong> hoặc{' '}
              <strong>Độc lập</strong> — tích hợp AI Prompt bóc tách từ vựng từ Đề PDF & Script Nghe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Streak & Coins */}
            <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-700/60 shadow-inner">
              <div className="flex items-center gap-1.5 text-amber-400 font-black text-sm tabular-nums">
                <Flame className="w-4 h-4 fill-amber-400" />
                <span>{streakCount} ngày</span>
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div className="flex items-center gap-1.5 text-yellow-300 font-black text-sm tabular-nums">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span>{coinCount} xu</span>
              </div>
            </div>

            {/* Prominent JSON Batch Import & AI Prompt Button */}
            <button
              type="button"
              onClick={() => setIsJsonModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <FileCode2 className="w-4 h-4 text-slate-950" />
              <span>Nhập JSON hàng loạt & AI Prompt (Đề + Script PDF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2 PRIMARY WORKSPACES NAVIGATION BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Workspace 1: Kho Từ Vựng */}
          <button
            type="button"
            onClick={() => setActiveTab('my_decks')}
            className={`flex items-center justify-between gap-3 py-3.5 px-5 rounded-xl text-left transition-all cursor-pointer ${
              activeTab === 'my_decks'
                ? 'bg-[#58CC02] text-white shadow-md shadow-lime-500/20 border-b-2 border-[#46a302]'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  activeTab === 'my_decks'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-primary-600'
                }`}
              >
                <Folder className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <div className="text-sm font-black">
                  1. Kho Từ Vựng (Lọc theo Chủ đề / Đề thi / Tag)
                </div>
                <div
                  className={`text-[11px] font-medium ${
                    activeTab === 'my_decks' ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Quản lý {decks.length} bộ từ • 15 Chủ đề B1 • Bộ từ theo Đề thi • Chủ đề tự tạo
                </div>
              </div>
            </div>
          </button>

          {/* Workspace 2: Phòng Luyện Tập */}
          <button
            type="button"
            onClick={() => setActiveTab('study_hub')}
            className={`flex items-center justify-between gap-3 py-3.5 px-5 rounded-xl text-left transition-all cursor-pointer ${
              activeTab === 'study_hub'
                ? 'bg-[#58CC02] text-white shadow-md shadow-lime-500/20 border-b-2 border-[#46a302]'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-xl ${
                  activeTab === 'study_hub'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-indigo-600'
                }`}
              >
                <Layers className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <div className="text-sm font-black">
                  2. Phòng Luyện Tập (Flashcard 3D · SRS SM-2 · Quiz & Game)
                </div>
                <div
                  className={`text-[11px] font-medium ${
                    activeTab === 'study_hub'
                      ? 'text-white/90'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Đang chọn: {activeDeckObj?.name || 'Chưa chọn bộ từ'} ({activeDeckObj?.items?.length || 0} từ)
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ACTIVE WORKSPACE CONTENT */}
      <div>
        {activeTab === 'my_decks' && (
          <VocabMyDecksTab
            decks={decks}
            folders={folders}
            tests={tests}
            activeDeckId={activeDeckId}
            initialRelationshipFilter={initialRelFilter}
            onSelectDeck={setActiveDeckId}
            onStartPracticeDeck={handleStartPracticeDeck}
            onUpdateDeckRelationship={handleUpdateDeckRelationship}
            onCreateDeck={() => setIsDeckModalOpen(true)}
            onCreateFolder={() => setIsFolderModalOpen(true)}
            onOpenAiModal={() => setIsAiModalOpen(true)}
            onOpenImportModal={() => setIsImportModalOpen(true)}
            onOpenJsonModal={() => setIsJsonModalOpen(true)}
            onLoadDefault15Topics={handleLoadDefault15Topics}
            onToggleMasterWord={handleToggleMasterWord}
            onDeleteWord={handleDeleteWord}
            onDeleteDeck={handleDeleteDeck}
            onDeleteFolder={handleDeleteFolder}
          />
        )}

        {activeTab === 'study_hub' && (
          <VocabStudyHubTab
            decks={decks}
            activeDeckId={activeDeckId}
            onSelectDeck={setActiveDeckId}
            srsRecords={srsRecords}
            onRateSrsWord={handleRateSrsWord}
            streakCount={streakCount}
            coinCount={coinCount}
            onEarnCoins={handleEarnCoins}
          />
        )}
      </div>

      {/* MODALS */}
      {/* 1. Create / Edit Deck Modal */}
      <VocabDeckModal
        isOpen={isDeckModalOpen}
        onClose={() => setIsDeckModalOpen(false)}
        onSave={handleCreateDeck}
        folders={folders}
        tests={tests}
      />

      {/* 2. Create Folder Modal */}
      <VocabFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onSave={handleCreateFolder}
      />

      {/* 3. AI Generation Modal */}
      <VocabAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        decks={decks}
        activeDeckId={activeDeckId}
        onAddWordsToDeck={handleAddWordsToDeck}
        onRequestCreateDeck={() => {
          setIsAiModalOpen(false);
          setIsDeckModalOpen(true);
        }}
      />

      {/* 4. Quick Import Modal (Paste with |, CSV, Grid) */}
      <VocabQuickImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        decks={decks}
        activeDeckId={activeDeckId}
        onAddWordsToDeck={handleAddWordsToDeck}
        onOpenJsonModal={() => {
          setIsImportModalOpen(false);
          setIsJsonModalOpen(true);
        }}
        onRequestCreateDeck={() => {
          setIsImportModalOpen(false);
          setIsDeckModalOpen(true);
        }}
      />

      {/* 5. JSON Batch Import & AI Prompt Modal */}
      <VocabAiPromptModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        decks={decks}
        tests={tests}
        activeDeckId={activeDeckId}
        onAddWordsToDeck={handleAddWordsToDeck}
        onCreateDeckWithWords={handleCreateDeckWithWords}
        onBatchImportVocab={handleBatchImportVocab}
      />
    </div>
  );
};
