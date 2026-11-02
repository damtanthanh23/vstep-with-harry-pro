import React, { useState, useEffect, useMemo } from 'react';
import {
  Map as MapIcon,
  FolderHeart,
  BookOpenCheck,
  Sparkles,
  FileSpreadsheet,
  Layers,
  Trophy,
  Users,
  GraduationCap,
  Database,
  CloudCheck,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { TestMetadata } from '../../types/exam';
import { ExtendedVocabItem, UserVocabDeck, UserVocabFolder } from '../../types/vocab';
import { generateDefault15TopicDecks } from '../../data/b1Official15TopicsData';
import { B1_VOCAB_LIST } from '../../data/b1VocabData';
import {
  NormalizedVocabItem,
  adaptVocabDeck,
  adaptVocabItem,
  normalizeEnglishText,
} from '../../utils/vocabEngine';
import {
  UserVocabPartitionState,
  VocabSavedSession,
  loadUserVocabState,
  runLegacyVocabMigrationIfNeeded,
} from '../../services/vocabStorageService';
import {
  backupAllB1VocabToFirestore,
  getB1VocabCloudStatus,
  savePersonalDecksToCloud,
  deletePersonalDeckFromCloud,
  savePersonalFoldersToCloud,
  fetchPersonalFoldersFromCloud,
  fetchPersonalDecksFromCloud,
  fetchCommunityDecksFromCloud,
  syncUserVocabStateToCloud,
  fetchUserVocabStateFromCloud,
  B1VocabCloudSummary,
} from '../../services/vocabCloudService';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { VocabRoadmapsTab } from './vocab/VocabRoadmapsTab';
import { VocabMyDecksTab } from './vocab/VocabMyDecksTab';
import { VocabStudyHubTab } from './vocab/VocabStudyHubTab';
import { VocabCommunityTab } from './vocab/VocabCommunityTab';
import { VocabDeckDetailView } from './vocab/VocabDeckDetailView';
import { VocabGameRunner, RunnerMode } from './vocab/VocabGameRunner';
import { VocabSrsModal } from './vocab/VocabSrsModal';
import { VocabAiModal } from './vocab/VocabAiModal';
import {
  VocabQuickImportModal,
  DuplicateResolutionStrategy,
} from './vocab/VocabQuickImportModal';

export interface VocabularyB1ViewProps {
  selectedTestFilterId?: string | null;
  onClearTestFilter?: () => void;
  tests?: TestMetadata[];
  activeWorkspace?: 'study_hub' | 'roadmaps' | 'my_decks' | 'community';
  onWorkspaceChange?: (workspace: 'study_hub' | 'roadmaps' | 'my_decks' | 'community') => void;
}

interface ActiveGameSessionConfig {
  sessionId: string;
  parentSessionId?: string;
  sessionKind: 'regular' | 'srs';
  isEarlySrsPractice?: boolean;
  scopeType: 'deck' | 'roadmap' | 'personal-decks';
  scopeId: string;
  scopeTitle: string;
  mode: RunnerMode;
  subMode?: string;
  sessionItems: NormalizedVocabItem[];
  distractorPool: NormalizedVocabItem[];
}

interface ActiveSrsModalScope {
  scopeType: 'roadmap' | 'personal-decks' | 'deck';
  scopeId: string;
  scopeTitle: string;
  availableDecks: { id: string; title: string }[];
  scopeItems: NormalizedVocabItem[];
}

export const VocabularyB1View: React.FC<VocabularyB1ViewProps> = ({
  selectedTestFilterId,
  onClearTestFilter,
  tests = [],
  activeWorkspace: propWorkspace,
  onWorkspaceChange,
}) => {
  // Current authenticated user tracking for strict partition isolation
  const [currentUserId, setCurrentUserId] = useState<string>('guest');
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState<string | null>(null);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        setCurrentUserDisplayName(user.displayName || user.email || 'Học viên');
        setIsUserAuthenticated(true);
      } else {
        setCurrentUserId('guest');
        setCurrentUserDisplayName(null);
        setIsUserAuthenticated(false);
      }
    });
    return () => unsub();
  }, []);

  // Load partitioned vocab state per learner
  const [vocabState, setVocabState] = useState<UserVocabPartitionState>(() =>
    loadUserVocabState('guest')
  );

  useEffect(() => {
    setVocabState(loadUserVocabState(currentUserId));
  }, [currentUserId]);

  // Personal Decks & Folders storage per user
  const personalDecksStorageKey = `langcert_personal_decks_v3_${currentUserId}`;
  const personalFoldersStorageKey = `langcert_personal_folders_v3_${currentUserId}`;

  const [personalDecks, setPersonalDecks] = useState<UserVocabDeck[]>([]);
  const [folders, setFolders] = useState<UserVocabFolder[]>([]);
  const [cloudCommunityDecks, setCloudCommunityDecks] = useState<UserVocabDeck[]>([]);

  useEffect(() => {
    try {
      const rawDecks = localStorage.getItem(personalDecksStorageKey);
      if (rawDecks) {
        setPersonalDecks(JSON.parse(rawDecks));
      } else {
        // Default starter personal deck
        const starter: UserVocabDeck = {
          id: `personal_starter_${currentUserId}`,
          name: 'Sổ tay từ vựng cá nhân của tôi',
          title: 'Sổ tay từ vựng cá nhân của tôi',
          description: 'Bộ từ cá nhân dùng để lưu từ mới, nhập CSV hoặc tạo từ bằng AI',
          icon: '📚',
          isCustom: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          itemCount: 8,
          items: B1_VOCAB_LIST.slice(0, 8).map((it, idx) => ({
            ...it,
            id: `starter_${idx}_${it.id}`,
            cefr: 'B1',
          })),
        };
        setPersonalDecks([starter]);
        localStorage.setItem(personalDecksStorageKey, JSON.stringify([starter]));
      }
    } catch {
      setPersonalDecks([]);
    }

    try {
      const rawFolders = localStorage.getItem(personalFoldersStorageKey);
      if (rawFolders) {
        setFolders(JSON.parse(rawFolders));
      } else {
        const defaultFolders: UserVocabFolder[] = [
          {
            id: 'folder_vstep_focus',
            name: 'Ôn trọng tâm VSTEP',
            deckIds: [],
            createdAt: Date.now(),
          },
        ];
        setFolders(defaultFolders);
        localStorage.setItem(personalFoldersStorageKey, JSON.stringify(defaultFolders));
      }
    } catch {
      setFolders([]);
    }
  }, [currentUserId, personalDecksStorageKey, personalFoldersStorageKey]);

  // Cloud Firestore Backup Status & Actions
  const [cloudStatus, setCloudStatus] = useState<B1VocabCloudSummary | null>(null);
  const [isBackingUpCloud, setIsBackingUpCloud] = useState<boolean>(false);
  const [cloudBackupSuccessMessage, setCloudBackupSuccessMessage] = useState<string | null>(null);

  // Auto-load status & auto-backup to Firestore on mount if never backed up
  useEffect(() => {
    let isMounted = true;
    getB1VocabCloudStatus().then((status) => {
      if (!isMounted) return;
      setCloudStatus(status);
      if (!status) {
        // Automatically perform first-time backup to Firestore
        backupAllB1VocabToFirestore(currentUserId).then((res) => {
          if (!isMounted) return;
          if (res.success) {
            getB1VocabCloudStatus().then((s) => isMounted && setCloudStatus(s));
          }
        });
      }
    });

    fetchCommunityDecksFromCloud().then((commDecks) => {
      if (isMounted) setCloudCommunityDecks(commDecks);
    });

    // Load cloud personal decks, personal folders & cloud vocab state if signed in
    if (isUserAuthenticated && currentUserId !== 'guest') {
      fetchPersonalDecksFromCloud(currentUserId).then((cloudDecks) => {
        if (!isMounted) return;
        if (cloudDecks.length > 0) {
          setPersonalDecks((prev) => {
            const mergedMap = new Map<string, UserVocabDeck>();
            prev.forEach((d) => mergedMap.set(d.id, d));
            cloudDecks.forEach((cd) => {
              const existing = mergedMap.get(cd.id);
              if (!existing || (cd.updatedAt || 0) >= (existing.updatedAt || 0)) {
                mergedMap.set(cd.id, cd);
              }
            });
            const merged = Array.from(mergedMap.values());
            try {
              localStorage.setItem(personalDecksStorageKey, JSON.stringify(merged));
            } catch {
              // Ignore
            }
            // Push any local-only decks up to cloud so everything is unified
            const cloudIds = new Set(cloudDecks.map((c) => c.id));
            const localOnlyDecks = merged.filter((d) => !cloudIds.has(d.id));
            if (localOnlyDecks.length > 0) {
              savePersonalDecksToCloud(currentUserId, localOnlyDecks).catch(() => {});
            }
            return merged;
          });
        } else {
          // First time on cloud -> push local personal decks up to Firestore
          try {
            const rawLocal = localStorage.getItem(personalDecksStorageKey);
            if (rawLocal) {
              const parsedLocal: UserVocabDeck[] = JSON.parse(rawLocal);
              if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
                savePersonalDecksToCloud(currentUserId, parsedLocal).catch(() => {});
              }
            }
          } catch {
            // Ignore
          }
        }
      });

      fetchPersonalFoldersFromCloud(currentUserId).then((cloudFolders) => {
        if (!isMounted) return;
        if (cloudFolders && cloudFolders.length > 0) {
          setFolders((prev) => {
            const folderMap = new Map<string, UserVocabFolder>();
            prev.forEach((f) => folderMap.set(f.id, f));
            cloudFolders.forEach((cf) => folderMap.set(cf.id, cf));
            const merged = Array.from(folderMap.values());
            try {
              localStorage.setItem(personalFoldersStorageKey, JSON.stringify(merged));
            } catch {
              // Ignore
            }
            if (merged.length > cloudFolders.length) {
              savePersonalFoldersToCloud(currentUserId, merged).catch(() => {});
            }
            return merged;
          });
        } else {
          try {
            const rawFolders = localStorage.getItem(personalFoldersStorageKey);
            if (rawFolders) {
              const parsedFolders: UserVocabFolder[] = JSON.parse(rawFolders);
              if (Array.isArray(parsedFolders) && parsedFolders.length > 0) {
                savePersonalFoldersToCloud(currentUserId, parsedFolders).catch(() => {});
              }
            }
          } catch {
            // Ignore
          }
        }
      });

      fetchUserVocabStateFromCloud(currentUserId).then((mergedCloudState) => {
        if (!isMounted || !mergedCloudState) return;
        setVocabState(mergedCloudState);
      });
    }

    return () => {
      isMounted = false;
    };
  }, [currentUserId, isUserAuthenticated, personalDecksStorageKey, personalFoldersStorageKey]);

  const handleManualBackup = async () => {
    setIsBackingUpCloud(true);
    setCloudBackupSuccessMessage(null);
    try {
      const res = await backupAllB1VocabToFirestore(currentUserId, currentUserDisplayName || undefined);
      if (res.success) {
        if (isUserAuthenticated && currentUserId !== 'guest') {
          await savePersonalDecksToCloud(currentUserId, personalDecks);
          await savePersonalFoldersToCloud(currentUserId, folders);
          await syncUserVocabStateToCloud(currentUserId, vocabState, allDecks);
        }
        const updatedStatus = await getB1VocabCloudStatus();
        setCloudStatus(updatedStatus);
        setCloudBackupSuccessMessage(
          `Đã sao lưu thành công ${res.totalTopics} chủ đề chính thức & ${res.totalWords} từ vựng lên database Firestore!`
        );
        setTimeout(() => setCloudBackupSuccessMessage(null), 6000);
      } else {
        setCloudBackupSuccessMessage(`Lỗi sao lưu: ${res.error || 'Vui lòng thử lại'}`);
      }
    } finally {
      setIsBackingUpCloud(false);
    }
  };

  const savePersonalDecks = (nextDecks: UserVocabDeck[]) => {
    setPersonalDecks(nextDecks);
    try {
      localStorage.setItem(personalDecksStorageKey, JSON.stringify(nextDecks));
    } catch (e) {
      console.warn('Failed to save personal decks:', e);
    }
    // Real-time Cloud Firestore sync (including publishing public decks to Community)
    if (isUserAuthenticated && currentUserId !== 'guest') {
      savePersonalDecksToCloud(currentUserId, nextDecks, currentUserDisplayName || undefined).then(
        () => {
          if (nextDecks.some((d) => d.visibility === 'public')) {
            fetchCommunityDecksFromCloud().then(setCloudCommunityDecks).catch(() => {});
          }
        }
      );
    }
  };

  const handleVocabStateChange = (nextState: UserVocabPartitionState) => {
    setVocabState(nextState);
    // Real-time Cloud Firestore sync
    if (isUserAuthenticated && currentUserId !== 'guest') {
      syncUserVocabStateToCloud(currentUserId, nextState, allDecks);
    }
  };

  const saveFolders = (nextFolders: UserVocabFolder[]) => {
    setFolders(nextFolders);
    try {
      localStorage.setItem(personalFoldersStorageKey, JSON.stringify(nextFolders));
    } catch (e) {
      console.warn('Failed to save folders:', e);
    }
    // Real-time Cloud Firestore sync for personal vocabulary folders
    if (isUserAuthenticated && currentUserId !== 'guest') {
      savePersonalFoldersToCloud(currentUserId, nextFolders);
    }
  };

  // Build System Decks (15 Official B1 Topic Decks + Exam Vocabulary Decks)
  const systemDecks = useMemo<UserVocabDeck[]>(() => {
    const official15 = generateDefault15TopicDecks();
    const examDecks: UserVocabDeck[] = [];

    tests.forEach((test) => {
      if (Array.isArray(test.vocabulary) && test.vocabulary.length > 0) {
        examDecks.push({
          id: `exam_deck_${test.id}`,
          name: `Từ vựng Đề thi: ${test.title}`,
          title: `Từ vựng Đề thi: ${test.title}`,
          description: `Bộ từ vựng trích xuất từ đề thi ${test.title} (${(test as any).level || 'B1'})`,
          icon: '📝',
          isCustom: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          itemCount: test.vocabulary.length,
          items: test.vocabulary.map((v: any, idx: number) => ({
            id: v.id || `ex_${test.id}_${idx}`,
            word: v.word,
            phonetic: v.phonetic || '',
            partOfSpeech: (['n', 'v', 'adj', 'adv', 'phr'].includes(v.partOfSpeech)
              ? v.partOfSpeech
              : 'n') as any,
            meaningVi: v.meaningVi,
            exampleEn: v.exampleEn || '',
            exampleVi: v.exampleVi || '',
            topic: test.title,
            cefr: 'B1',
          })),
        });
      }
    });

    return [...official15, ...examDecks];
  }, [tests]);

  // Normalize all decks (system + personal) via Section 2 adapter
  const { allDecks, normalizedByDeckId, allNormalizedItems } = useMemo(() => {
    const combinedDecks: UserVocabDeck[] = [];
    const byDeck: Record<string, NormalizedVocabItem[]> = {};
    const flatItems: NormalizedVocabItem[] = [];

    [...systemDecks, ...personalDecks].forEach((rawDeck) => {
      const adapted = adaptVocabDeck(rawDeck);
      combinedDecks.push(adapted.deck);
      byDeck[rawDeck.id] = adapted.normalizedItems;
      flatItems.push(...adapted.normalizedItems);
    });

    return {
      allDecks: combinedDecks,
      normalizedByDeckId: byDeck,
      allNormalizedItems: flatItems,
    };
  }, [systemDecks, personalDecks]);

  // Run one-time legacy migration if needed
  useEffect(() => {
    if (allNormalizedItems.length > 0 && !vocabState.migratedLegacyKnown) {
      const migrated = runLegacyVocabMigrationIfNeeded(vocabState, allNormalizedItems);
      if (migrated.changed) {
        setVocabState(migrated.state);
      }
    }
  }, [allNormalizedItems, vocabState]);

  // Navigation Workspace State ('roadmaps' | 'my_decks' | 'study_hub' | 'community')
  const [internalWorkspace, setInternalWorkspace] = useState<
    'roadmaps' | 'my_decks' | 'study_hub' | 'community'
  >(propWorkspace || 'roadmaps');
  const currentWorkspace = propWorkspace || internalWorkspace;

  const handleSelectWorkspace = (ws: 'roadmaps' | 'my_decks' | 'study_hub' | 'community') => {
    setInternalWorkspace(ws);
    if (onWorkspaceChange) onWorkspaceChange(ws);
    setSelectedDeckId(null);
  };

  // Active Deck Detail View State
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  // If user clicked a specific test's vocabulary button from TestSelectionView, open that exam deck
  useEffect(() => {
    if (selectedTestFilterId) {
      const targetExamDeckId = `exam_deck_${selectedTestFilterId}`;
      if (normalizedByDeckId[targetExamDeckId]) {
        setSelectedDeckId(targetExamDeckId);
      }
    }
  }, [selectedTestFilterId, normalizedByDeckId]);

  // Active Game Session Runner State
  const [activeGameConfig, setActiveGameSessionConfig] =
    useState<ActiveGameSessionConfig | null>(null);

  // Active SRS Modal State
  const [activeSrsModal, setActiveSrsModal] = useState<ActiveSrsModalScope | null>(null);

  // Modals for AI Vocab & CSV/JSON Quick Import
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiTargetDeckId, setAiTargetDeckId] = useState<string | undefined>(undefined);
  const [isQuickImportOpen, setIsQuickImportOpen] = useState<boolean>(false);
  const [importTargetDeckId, setImportTargetDeckId] = useState<string | undefined>(undefined);

  // Personal Deck & Folder CRUD Handlers
  const handleCreatePersonalDeck = (data: {
    title: string;
    description: string;
    folderId?: string;
    visibility?: 'private' | 'public';
  }) => {
    const newDeck: UserVocabDeck = {
      id: `deck_custom_${Date.now()}`,
      name: data.title,
      title: data.title,
      description: data.description,
      icon: '📚',
      folderId: data.folderId,
      isCustom: true,
      visibility: data.visibility || 'private',
      authorId: currentUserId,
      authorName: currentUserDisplayName || 'Học viên VSTEP',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      itemCount: 0,
      items: [],
    };
    const next = [newDeck, ...personalDecks];
    savePersonalDecks(next);
    return newDeck.id;
  };

  const handleUpdatePersonalDeckMeta = (
    deckId: string,
    data: {
      title: string;
      description: string;
      folderId?: string;
      visibility?: 'private' | 'public';
    }
  ) => {
    const next = personalDecks.map((d) =>
      d.id === deckId
        ? {
            ...d,
            name: data.title,
            title: data.title,
            description: data.description,
            folderId: data.folderId,
            visibility: data.visibility || d.visibility || 'private',
            authorId: d.authorId || currentUserId,
            authorName: d.authorName || currentUserDisplayName || 'Học viên VSTEP',
            updatedAt: Date.now(),
          }
        : d
    );
    savePersonalDecks(next);
  };

  const handleDeletePersonalDeck = (deckId: string) => {
    const next = personalDecks.filter((d) => d.id !== deckId);
    savePersonalDecks(next);
    if (isUserAuthenticated && currentUserId !== 'guest') {
      deletePersonalDeckFromCloud(currentUserId, deckId).catch(() => {});
    }
    if (selectedDeckId === deckId) setSelectedDeckId(null);
  };

  const handleCreateFolder = (name: string) => {
    const newFolder: UserVocabFolder = {
      id: `folder_${Date.now()}`,
      name,
      deckIds: [],
      createdAt: Date.now(),
    };
    saveFolders([...folders, newFolder]);
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    saveFolders(folders.map((f) => (f.id === folderId ? { ...f, name: newName } : f)));
  };

  const handleDeleteFolder = (folderId: string) => {
    // Deleting folder moves its decks to uncategorized (folderId = undefined) without deleting decks
    saveFolders(folders.filter((f) => f.id !== folderId));
    const nextDecks = personalDecks.map((d) =>
      d.folderId === folderId ? { ...d, folderId: undefined } : d
    );
    savePersonalDecks(nextDecks);
  };

  // Add words to a personal deck with duplicate conflict resolution ('skip' | 'keep_both' | 'overwrite')
  const handleAddWordsToPersonalDeck = (
    deckId: string,
    newWords: ExtendedVocabItem[],
    strategy: DuplicateResolutionStrategy = 'keep_both'
  ) => {
    const nextDecks = personalDecks.map((deck) => {
      if (deck.id !== deckId) return deck;
      const existingItems = [...(deck.items || [])];
      const existingByNorm = new Map<string, number>();
      existingItems.forEach((it, idx) => {
        existingByNorm.set(normalizeEnglishText(it.word), idx);
      });

      newWords.forEach((nw, i) => {
        const normW = normalizeEnglishText(nw.word);
        const existingIdx = existingByNorm.get(normW);
        const adapted = adaptVocabItem(nw as any, deckId, existingItems.length + i);

        if (existingIdx !== undefined) {
          if (strategy === 'skip') {
            return;
          }
          if (strategy === 'overwrite') {
            const prevItem = existingItems[existingIdx];
            existingItems[existingIdx] = {
              ...adapted,
              id: prevItem.id, // preserve ID so known/SRS state stays linked
              contentVersion: ((prevItem as any).contentVersion || 1) + 1,
            } as any;
            return;
          }
        }
        existingItems.push(adapted);
      });

      return {
        ...deck,
        itemCount: existingItems.length,
        items: existingItems,
      };
    });

    savePersonalDecks(nextDecks);
  };

  const handleAddManualWordToDeck = (
    deckId: string,
    wordData: {
      word: string;
      phonetic: string;
      partOfSpeech: 'n' | 'v' | 'adj' | 'adv' | 'phr';
      meaningVi: string;
      exampleEn: string;
      exampleVi: string;
    }
  ) => {
    const item = adaptVocabItem(
      {
        ...wordData,
        id: `manual_${Date.now()}`,
        sourceType: 'manual',
      },
      deckId,
      Date.now()
    );
    handleAddWordsToPersonalDeck(deckId, [item], 'keep_both');
  };

  const handleUpdateManualWordInDeck = (
    deckId: string,
    wordId: string,
    wordData: {
      word: string;
      phonetic: string;
      partOfSpeech: 'n' | 'v' | 'adj' | 'adv' | 'phr';
      meaningVi: string;
      exampleEn: string;
      exampleVi: string;
    }
  ) => {
    const nextDecks = personalDecks.map((d) => {
      if (d.id !== deckId) return d;
      const nextItems = (d.items || []).map((it) => {
        if (it.id !== wordId) return it;
        return adaptVocabItem(
          {
            ...it,
            ...wordData,
            id: wordId,
            contentVersion: ((it as any).contentVersion || 1) + 1,
          },
          deckId
        );
      });
      return { ...d, items: nextItems, itemCount: nextItems.length };
    });
    savePersonalDecks(nextDecks);
  };

  const handleDeleteManualWordFromDeck = (deckId: string, wordId: string) => {
    const nextDecks = personalDecks.map((d) => {
      if (d.id !== deckId) return d;
      const nextItems = (d.items || []).filter((it) => it.id !== wordId);
      return { ...d, items: nextItems, itemCount: nextItems.length };
    });
    savePersonalDecks(nextDecks);
  };

  // Global SRS Due Count across all decks
  const globalDueCount = useMemo(() => {
    const now = Date.now();
    let due = 0;
    Object.values(vocabState.srsMap).forEach((rec) => {
      if (rec && rec.enrolled && !rec.suspended && rec.dueAt !== null && rec.dueAt <= now) {
        due++;
      }
    });
    return due;
  }, [vocabState.srsMap]);

  // If Game Runner is active, render VocabGameRunner full-width
  if (activeGameConfig) {
    return (
      <VocabGameRunner
        key={activeGameConfig.sessionId}
        sessionId={activeGameConfig.sessionId}
        parentSessionId={activeGameConfig.parentSessionId}
        sessionKind={activeGameConfig.sessionKind}
        isEarlySrsPractice={activeGameConfig.isEarlySrsPractice}
        scopeType={activeGameConfig.scopeType}
        scopeId={activeGameConfig.scopeId}
        scopeTitle={activeGameConfig.scopeTitle}
        mode={activeGameConfig.mode}
        subMode={activeGameConfig.subMode}
        sessionItems={activeGameConfig.sessionItems}
        distractorPool={activeGameConfig.distractorPool}
        vocabState={vocabState}
        onVocabStateChange={handleVocabStateChange}
        onExitToDeck={() => setActiveGameSessionConfig(null)}
        onSwitchModeRequest={() => {
          const scopeDeckId =
            activeGameConfig.scopeType === 'deck' ? activeGameConfig.scopeId : null;
          setActiveGameSessionConfig(null);
          if (scopeDeckId) setSelectedDeckId(scopeDeckId);
        }}
        onStartFollowUpSession={({ items, mode, subMode, parentSessionId }) => {
          setActiveGameSessionConfig({
            ...activeGameConfig,
            sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            parentSessionId,
            mode,
            subMode,
            sessionItems: items,
          });
        }}
      />
    );
  }

  const activeDeck = selectedDeckId
    ? allDecks.find((d) => d.id === selectedDeckId) || null
    : null;
  const activeDeckItems = selectedDeckId ? normalizedByDeckId[selectedDeckId] || [] : [];
  const isPersonalActiveDeck = Boolean(
    selectedDeckId && personalDecks.some((d) => d.id === selectedDeckId)
  );

  return (
    <div className="space-y-6">
      {/* Real-time Cloud Database Backup Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 p-3.5 sm:p-4 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-xs">
            <Database className="h-5 w-5 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300 animate-pulse" />
              <span className="font-black text-xs uppercase tracking-wider text-emerald-100">
                Sao Lưu Thực Tế Trên Database Cloud Firestore
              </span>
            </div>
            <div className="text-[11px] sm:text-xs text-emerald-50 mt-0.5">
              Toàn bộ 15 Chủ đề chính thức VSTEP B1 & bộ từ vựng cá nhân ({cloudStatus?.totalWords || '850+'} từ) được sao lưu trên database:{' '}
              <span className="font-mono font-bold text-white">
                ai-studio-vsteptutor-6c9f7e6d-6d42-4864-9991-780c76d9f4dc
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {cloudStatus?.lastBackupAt && (
            <span className="text-[11px] text-emerald-100 hidden sm:inline">
              Sao lưu: {new Date(cloudStatus.lastBackupAt).toLocaleTimeString('vi-VN')} {new Date(cloudStatus.lastBackupAt).toLocaleDateString('vi-VN')}
            </span>
          )}
          <button
            type="button"
            onClick={handleManualBackup}
            disabled={isBackingUpCloud}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-black transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isBackingUpCloud ? 'animate-spin' : ''}`} />
            <span>{isBackingUpCloud ? 'Đang sao lưu...' : 'Sao lưu lên Database ngay'}</span>
          </button>
        </div>
      </div>

      {cloudBackupSuccessMessage && (
        <div className="rounded-xl bg-emerald-100 border border-emerald-300 p-3 text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{cloudBackupSuccessMessage}</span>
        </div>
      )}

      {/* Top Vocabulary Navigation Header (Section 8) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelectWorkspace('roadmaps')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
              currentWorkspace === 'roadmaps' && !selectedDeckId
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Lộ trình
          </button>

          <button
            type="button"
            onClick={() => handleSelectWorkspace('my_decks')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
              currentWorkspace === 'my_decks' && !selectedDeckId
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FolderHeart className="w-4 h-4" />
            Bộ của tôi ({personalDecks.length})
          </button>

          <button
            type="button"
            onClick={() => handleSelectWorkspace('study_hub')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
              currentWorkspace === 'study_hub' && !selectedDeckId
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BookOpenCheck className="w-4 h-4" />
            Học từ của tôi
          </button>

          <button
            type="button"
            onClick={() => handleSelectWorkspace('community')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
              currentWorkspace === 'community' && !selectedDeckId
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Cộng đồng Cloud
          </button>
        </div>

        {/* Right Quick Actions & Points Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>{vocabState.pointsBalance} điểm</span>
          </div>

          <button
            type="button"
            onClick={() =>
              setActiveSrsModal({
                scopeType: 'personal-decks',
                scopeId: 'all_vocab',
                scopeTitle: 'Toàn bộ Kho Từ Vựng',
                availableDecks: allDecks.map((d) => ({
                  id: d.id,
                  title: d.title || d.name || 'Bộ từ',
                })),
                scopeItems: allNormalizedItems,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
          >
            <Layers className="w-4 h-4" />
            <span>SRS ({globalDueCount} đến hạn)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAiTargetDeckId(selectedDeckId && isPersonalActiveDeck ? selectedDeckId : undefined);
              setIsAiModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-2xs transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo từ AI</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Either Active Deck Detail View OR Active Tab */}
      {activeDeck ? (
        <VocabDeckDetailView
          deckId={activeDeck.id}
          deckTitle={activeDeck.title || activeDeck.name || 'Bộ từ'}
          deckSubtitle={activeDeck.description}
          items={activeDeckItems}
          vocabState={vocabState}
          onVocabStateChange={handleVocabStateChange}
          isPersonalDeck={isPersonalActiveDeck}
          onBack={() => {
            setSelectedDeckId(null);
            if (onClearTestFilter) onClearTestFilter();
          }}
          onLaunchSession={({ mode, subMode, selectedItems, distractorPool }) => {
            setActiveGameSessionConfig({
              sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              sessionKind: 'regular',
              scopeType: 'deck',
              scopeId: activeDeck.id,
              scopeTitle: activeDeck.title || activeDeck.name || 'Bộ từ',
              mode,
              subMode,
              sessionItems: selectedItems,
              distractorPool,
            });
          }}
          onOpenSrsForDeck={() =>
            setActiveSrsModal({
              scopeType: 'deck',
              scopeId: activeDeck.id,
              scopeTitle: activeDeck.title || activeDeck.name || 'Bộ từ',
              availableDecks: [
                { id: activeDeck.id, title: activeDeck.title || activeDeck.name || 'Bộ từ' },
              ],
              scopeItems: activeDeckItems,
            })
          }
          onOpenQuickImport={() => {
            setImportTargetDeckId(activeDeck.id);
            setIsQuickImportOpen(true);
          }}
          onOpenAiModal={() => {
            setAiTargetDeckId(activeDeck.id);
            setIsAiModalOpen(true);
          }}
          onAddManualWord={
            isPersonalActiveDeck
              ? (wordData) => handleAddManualWordToDeck(activeDeck.id, wordData)
              : undefined
          }
          onUpdateManualWord={
            isPersonalActiveDeck
              ? (wordId, wordData) =>
                  handleUpdateManualWordInDeck(activeDeck.id, wordId, wordData)
              : undefined
          }
          onDeleteManualWord={
            isPersonalActiveDeck
              ? (wordId) => handleDeleteManualWordFromDeck(activeDeck.id, wordId)
              : undefined
          }
        />
      ) : currentWorkspace === 'roadmaps' ? (
        <VocabRoadmapsTab
          systemDecks={systemDecks}
          normalizedByDeckId={normalizedByDeckId}
          vocabState={vocabState}
          onVocabStateChange={handleVocabStateChange}
          onSelectDeck={(deckId) => setSelectedDeckId(deckId)}
          onOpenSrsForRoadmap={(rm) =>
            setActiveSrsModal({
              scopeType: 'roadmap',
              scopeId: rm.id,
              scopeTitle: rm.title,
              availableDecks: rm.decks.map((d) => ({
                id: d.id,
                title: d.title || d.name || 'Bộ từ',
              })),
              scopeItems: rm.items,
            })
          }
          currentUserDisplayName={currentUserDisplayName}
          isUserAuthenticated={isUserAuthenticated}
        />
      ) : currentWorkspace === 'my_decks' ? (
        <VocabMyDecksTab
          personalDecks={personalDecks}
          savedSystemDecks={systemDecks.filter((d) =>
            vocabState.savedSystemDeckIds.includes(d.id)
          )}
          folders={folders}
          normalizedByDeckId={normalizedByDeckId}
          vocabState={vocabState}
          onSelectDeck={(deckId) => setSelectedDeckId(deckId)}
          onCreateDeck={handleCreatePersonalDeck}
          onUpdateDeckMeta={handleUpdatePersonalDeckMeta}
          onDeleteDeck={handleDeletePersonalDeck}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onOpenAiModal={(deckId) => {
            setAiTargetDeckId(deckId);
            setIsAiModalOpen(true);
          }}
          onOpenQuickImport={(deckId) => {
            setImportTargetDeckId(deckId);
            setIsQuickImportOpen(true);
          }}
          onOpenSrsForPersonalDecks={() => {
            const pItems: NormalizedVocabItem[] = [];
            personalDecks.forEach((d) => {
              pItems.push(...(normalizedByDeckId[d.id] || []));
            });
            setActiveSrsModal({
              scopeType: 'personal-decks',
              scopeId: 'my_personal_decks',
              scopeTitle: 'Bộ từ cá nhân của tôi',
              availableDecks: personalDecks.map((d) => ({
                id: d.id,
                title: d.title || d.name || 'Bộ từ',
              })),
              scopeItems: pItems,
            });
          }}
        />
      ) : currentWorkspace === 'community' ? (
        <VocabCommunityTab
          cloudCommunityDecks={cloudCommunityDecks}
          clonedDeckIds={vocabState.clonedCommunityDeckIds || []}
          onRefreshCloudDecks={() => {
            fetchCommunityDecksFromCloud().then(setCloudCommunityDecks).catch(() => {});
          }}
          onCloneDeck={(commDeck) => {
            const clonedId = `cloned_${commDeck.id}`;
            if (!personalDecks.some((d) => d.id === clonedId || d.id === commDeck.id)) {
              const clonedDeck: UserVocabDeck = {
                ...commDeck,
                id: clonedId,
                name: commDeck.title || commDeck.name,
                title: commDeck.title || commDeck.name,
                isCustom: true,
                visibility: 'private',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              savePersonalDecks([clonedDeck, ...personalDecks]);
            }
            const nextClonedIds = Array.from(
              new Set([...(vocabState.clonedCommunityDeckIds || []), commDeck.id])
            );
            handleVocabStateChange({
              ...vocabState,
              clonedCommunityDeckIds: nextClonedIds,
            });
          }}
          onStartStudyItems={(rawItems, title) => {
            const tempDeckId = `comm_study_${Date.now()}`;
            const normalized = rawItems.map((it, idx) => adaptVocabItem(it, tempDeckId, idx));
            if (normalized.length === 0) return;
            setActiveGameSessionConfig({
              sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              sessionKind: 'regular',
              scopeType: 'deck',
              scopeId: tempDeckId,
              scopeTitle: title,
              mode: 'flashcard',
              sessionItems: normalized,
              distractorPool: allNormalizedItems,
            });
          }}
        />
      ) : (
        <VocabStudyHubTab
          allDecks={allDecks}
          normalizedByDeckId={normalizedByDeckId}
          vocabState={vocabState}
          onSelectDeck={(deckId) => setSelectedDeckId(deckId)}
          onOpenGlobalSrsModal={() =>
            setActiveSrsModal({
              scopeType: 'personal-decks',
              scopeId: 'all_vocab',
              scopeTitle: 'Toàn bộ Kho Từ Vựng',
              availableDecks: allDecks.map((d) => ({
                id: d.id,
                title: d.title || d.name || 'Bộ từ',
              })),
              scopeItems: allNormalizedItems,
            })
          }
          onReplaySavedSessionSubset={({ session, subsetType }) => {
            // Reconstruct NormalizedVocabItem list from saved session attempts
            const itemByWordKey = new Map<string, NormalizedVocabItem>(
              allNormalizedItems.map((it) => [it.wordKey, it])
            );

            const targetWordKeys =
              subsetType === 'wrong'
                ? session.attempts
                    .filter(
                      (a) =>
                        a.outcome === 'incorrect' ||
                        a.outcome === 'timeout' ||
                        (a.outcome === 'self_rated' && a.selfRating === 'forgot')
                    )
                    .map((a) => a.wordKey)
                : session.attempts
                    .filter((a) => a.outcome === 'incomplete')
                    .map((a) => a.wordKey);

            const resolvedItems: NormalizedVocabItem[] = targetWordKeys
              .map((wk) => {
                const live = itemByWordKey.get(wk);
                if (live) return live;
                const snap = session.attempts.find((a) => a.wordKey === wk);
                if (!snap) return null;
                return adaptVocabItem(
                  {
                    id: snap.wordId,
                    word: snap.wordSnapshot,
                    meaningVi: snap.meaningSnapshot,
                    phonetic: snap.phoneticSnapshot || '',
                    partOfSpeech: snap.posSnapshot || 'n',
                  },
                  snap.deckId
                );
              })
              .filter((x): x is NormalizedVocabItem => Boolean(x));

            if (resolvedItems.length === 0) return;

            setActiveGameSessionConfig({
              sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              parentSessionId: session.sessionId,
              sessionKind: session.sessionKind,
              scopeType: session.scopeType,
              scopeId: session.scopeId,
              scopeTitle: `${session.scopeTitle} (${
                subsetType === 'wrong' ? 'Làm lại câu sai' : 'Chơi tiếp'
              })`,
              mode: (session.mode as RunnerMode) || 'quiz',
              subMode: session.subMode,
              sessionItems: resolvedItems,
              distractorPool: allNormalizedItems,
            });
          }}
        />
      )}

      {/* SRS Modal (Sections 14, 15, 16) */}
      {activeSrsModal && (
        <VocabSrsModal
          isOpen={true}
          onClose={() => setActiveSrsModal(null)}
          scopeType={activeSrsModal.scopeType}
          scopeId={activeSrsModal.scopeId}
          scopeTitle={activeSrsModal.scopeTitle}
          availableDecks={activeSrsModal.availableDecks}
          scopeItems={activeSrsModal.scopeItems}
          vocabState={vocabState}
          onVocabStateChange={handleVocabStateChange}
          onStartSrsSession={({ items, isEarlyPractice, scopeTitle }) => {
            const scopeInfo = activeSrsModal;
            setActiveSrsModal(null);
            setActiveGameSessionConfig({
              sessionId: `srs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              sessionKind: 'srs',
              isEarlySrsPractice: isEarlyPractice,
              scopeType: scopeInfo.scopeType,
              scopeId: scopeInfo.scopeId,
              scopeTitle,
              mode: 'mixed',
              sessionItems: items,
              distractorPool:
                scopeInfo.scopeItems.length >= 4 ? scopeInfo.scopeItems : allNormalizedItems,
            });
          }}
        />
      )}

      {/* AI Vocabulary Generation Modal (Section 13) */}
      <VocabAiModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        decks={personalDecks}
        activeDeckId={aiTargetDeckId}
        userId={currentUserId}
        onAddWordsToDeck={(deckId, words) =>
          handleAddWordsToPersonalDeck(deckId, words, 'keep_both')
        }
        onRequestCreateDeck={() => {
          const newId = handleCreatePersonalDeck({
            title: `Bộ từ AI (${new Date().toLocaleDateString('vi-VN')})`,
            description: 'Tạo tự động từ cửa sổ AI',
          });
          setAiTargetDeckId(newId);
        }}
      />

      {/* Quick Import/Export CSV, TSV, JSON Modal (Section 12) */}
      <VocabQuickImportModal
        isOpen={isQuickImportOpen}
        onClose={() => setIsQuickImportOpen(false)}
        decks={personalDecks}
        activeDeckId={importTargetDeckId}
        onAddWordsToDeck={(deckId, words, strategy) =>
          handleAddWordsToPersonalDeck(deckId, words, strategy || 'skip')
        }
        onRequestCreateDeck={() => {
          const newId = handleCreatePersonalDeck({
            title: `Bộ từ Nhập File (${new Date().toLocaleDateString('vi-VN')})`,
            description: 'Tạo từ cửa sổ Nhập CSV/JSON',
          });
          setImportTargetDeckId(newId);
        }}
      />
    </div>
  );
};

export default VocabularyB1View;
