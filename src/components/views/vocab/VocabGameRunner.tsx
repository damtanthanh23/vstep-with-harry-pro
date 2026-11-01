import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Volume2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Play,
  Pause,
  Sparkles,
  Heart,
  Clock,
  Eye,
  Lock,
  Trophy,
  AlertTriangle,
  Gamepad2,
  Layers,
  CheckSquare,
  Square,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  NormalizedVocabItem,
  REWARD_CONFIG,
  QuizSubMode,
  GeneratedQuizQuestion,
  generateQuizQuestionForItem,
  checkEnglishAnswer,
  checkVietnameseAnswer,
  computeCumulativeHint,
  fisherYatesShuffle,
} from '../../../utils/vocabEngine';
import {
  UserVocabPartitionState,
  SessionItemAttempt,
  SessionEndReason,
  VocabSavedSession,
  SrsLevelNumber,
  SrsTransitionKey,
  SrsStepMode,
  commitVocabSession,
  saveUserVocabState,
} from '../../../services/vocabStorageService';
import { playDictionaryAudio, stopDictionaryAudio } from '../../../utils/dictionaryAudio';

export type RunnerMode =
  | 'flashcard'
  | 'quiz'
  | 'dictation'
  | 'spell'
  | 'match'
  | 'mixed'
  | 'flappy'
  | 'monkey';

export interface VocabGameRunnerProps {
  sessionId: string;
  parentSessionId?: string;
  sessionKind: 'regular' | 'srs';
  isEarlySrsPractice?: boolean;
  scopeType: 'deck' | 'roadmap' | 'personal-decks';
  scopeId: string;
  scopeTitle: string;
  mode: RunnerMode;
  subMode?: string; // 'en_to_vn' | 'vn_to_en' | 'word_to_meaning' | 'meaning_to_word' | 'context_cloze' | 'quiz' | 'spell'
  sessionItems: NormalizedVocabItem[];
  distractorPool: NormalizedVocabItem[];
  vocabState: UserVocabPartitionState;
  onVocabStateChange: (nextState: UserVocabPartitionState) => void;
  onExitToDeck: () => void;
  onSwitchModeRequest: () => void;
  onStartFollowUpSession: (params: {
    items: NormalizedVocabItem[];
    mode: RunnerMode;
    subMode?: string;
    parentSessionId: string;
  }) => void;
}

interface FlashcardDraft {
  flipped: boolean;
  typedInput: string;
  typedChecked: boolean;
  typedIsCorrect: boolean | null;
  rating?: 'known' | 'forgot';
  rewarded: boolean;
}

interface MatchCard {
  id: string;
  wordKey: string;
  text: string;
  side: 'left' | 'right';
}

export const VocabGameRunner: React.FC<VocabGameRunnerProps> = ({
  sessionId,
  parentSessionId,
  sessionKind,
  isEarlySrsPractice = false,
  scopeType,
  scopeId,
  scopeTitle,
  mode,
  subMode,
  sessionItems,
  distractorPool,
  vocabState,
  onVocabStateChange,
  onExitToDeck,
  onSwitchModeRequest,
  onStartFollowUpSession,
}) => {
  const sessionStartTimeRef = useRef<number>(Date.now());
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [attemptsMap, setAttemptsMap] = useState<Record<string, SessionItemAttempt>>({});
  const [rewardedKeys, setRewardedKeys] = useState<Set<string>>(() => new Set());
  const [endReason, setEndReason] = useState<SessionEndReason | null>(null);

  // Modals & Pause state
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showUnratedFlashcardWarning, setShowUnratedFlashcardWarning] = useState<boolean>(false);
  const [isPausedModal, setIsPausedModal] = useState<boolean>(false);
  const [isTabHidden, setIsTabHidden] = useState<boolean>(false);

  // Audio volume state
  const [volumePercent, setVolumePercent] = useState<number>(vocabState.audioVolumePercent ?? 70);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.75 | 1 | 1.25>(1);

  // Per-question interactive state (for Quiz / Spell / Dictation / Mixed / Flappy / Monkey)
  const [userInput, setUserInput] = useState<string>('');
  const [selectedQuizOptionId, setSelectedQuizOptionId] = useState<string | null>(null);
  const [questionGraded, setQuestionGraded] = useState<boolean>(false);
  const [questionOutcome, setQuestionOutcome] = useState<
    'correct' | 'assisted_correct' | 'incorrect' | 'timeout' | null
  >(null);
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const [showMaskedExample, setShowMaskedExample] = useState<boolean>(false);
  const [showClozeTranslation, setShowClozeTranslation] = useState<boolean>(false);
  const [usedAudioHelpInSpell, setUsedAudioHelpInSpell] = useState<boolean>(false);
  const [dictationAudioStarted, setDictationAudioStarted] = useState<boolean>(false);
  const [dictationAudioError, setDictationAudioError] = useState<string | null>(null);
  const [isTimedSpellOrDictation, setIsTimedSpellOrDictation] = useState<boolean>(
    mode === 'dictation'
  );

  // Deadline-based Question Timer (ms remaining)
  const [questionRemainingMs, setQuestionRemainingMs] = useState<number>(30000);
  const questionTimerActiveRef = useRef<boolean>(false);
  const lastTickTimeRef = useRef<number>(Date.now());

  // Flashcard state per item
  const [flashcardDrafts, setFlashcardDrafts] = useState<Record<string, FlashcardDraft>>({});

  // Matching mode state
  const matchRoundSize = 8;
  const totalMatchRounds = Math.max(1, Math.ceil(sessionItems.length / matchRoundSize));
  const [matchRoundIndex, setMatchRoundIndex] = useState<number>(0);
  const [matchLeftCards, setMatchLeftCards] = useState<MatchCard[]>([]);
  const [matchRightCards, setMatchRightCards] = useState<MatchCard[]>([]);
  const [selectedLeftCardId, setSelectedLeftCardId] = useState<string | null>(null);
  const [selectedRightCardId, setSelectedRightCardId] = useState<string | null>(null);
  const [matchedWordKeysInRound, setMatchedWordKeysInRound] = useState<Set<string>>(
    () => new Set()
  );
  const [wrongTaintedWordKeys, setWrongTaintedWordKeys] = useState<Set<string>>(() => new Set());
  const [wrongFlashPair, setWrongFlashPair] = useState<{ leftId: string; rightId: string } | null>(
    null
  );
  const [matchHearts, setMatchHearts] = useState<number>(5);
  const [matchTotalPairsCompleted, setMatchTotalPairsCompleted] = useState<number>(0);
  const [matchTotalWrongClicks, setMatchTotalWrongClicks] = useState<number>(0);
  const [isMatchTimed, setIsMatchTimed] = useState<boolean>(true);
  const [matchRoundRemainingMs, setMatchRoundRemainingMs] = useState<number>(30000);
  const [matchRoundFinishedBanner, setMatchRoundFinishedBanner] = useState<boolean>(false);

  // Flappy Bird state
  const [flappyLives, setFlappyLives] = useState<number>(5);
  const [flappyPhase, setFlappyPhase] = useState<
    'intro' | 'flying' | 'question' | 'feedback' | 'resume-ready'
  >('intro');
  const [flappyBirdY, setFlappyBirdY] = useState<number>(140);
  const flappyVelocityRef = useRef<number>(0);
  const [flappyPipeX, setFlappyPipeX] = useState<number>(420);
  const [flappyGapTop, setFlappyGapTop] = useState<number>(75);
  const [flappyAutoPilot, setFlappyAutoPilot] = useState<boolean>(false);

  // Monkey Rescue state
  const monkeySubMode: 'quiz' | 'spell' = subMode === 'spell' ? 'spell' : 'quiz';
  const yetiSpeedMetersPerSec = monkeySubMode === 'quiz' ? 2 : 1; // 2:1 speed ratio
  const [monkeyPhase, setMonkeyPhase] = useState<'intro' | 'question' | 'feedback' | 'captured'>(
    'intro'
  );
  const [monkeyDistanceMeters, setMonkeyDistanceMeters] = useState<number>(100);

  // Results & Post-save state
  const [checkedKnownKeys, setCheckedKnownKeys] = useState<Set<string>>(() => new Set());
  const [committedResult, setCommittedResult] = useState<{
    savedSession: VocabSavedSession;
    conflictsCount: number;
  } | null>(null);

  // Snapshot initial SRS state at session start for each item
  const initialSrsSnapshot = useMemo(() => {
    const snap: Record<
      string,
      { level: SrsLevelNumber; dueAt: number | null; version: number; wasDue: boolean }
    > = {};
    const now = Date.now();
    sessionItems.forEach((it) => {
      const rec = vocabState.srsMap[it.wordKey];
      const wasDue =
        !isEarlySrsPractice &&
        Boolean(rec && rec.enrolled && !rec.suspended && rec.dueAt !== null && rec.dueAt <= now);
      snap[it.wordKey] = {
        level: rec?.srsLevel ?? 0,
        dueAt: rec?.dueAt ?? null,
        version: rec?.version ?? 1,
        wasDue,
      };
    });
    return snap;
  }, [sessionItems, vocabState.srsMap, isEarlySrsPractice]);

  // Pre-assign step modes for Mixed or SRS sessions
  const stepModesByIndex = useMemo<SrsStepMode[]>(() => {
    const combinedPool = distractorPool.length >= 2 ? distractorPool : sessionItems;
    return sessionItems.map((item, idx) => {
      if (sessionKind === 'srs') {
        if (vocabState.srsSettings.reviewPresentation === 'all-flashcards') {
          return 'flashcard';
        }
        const lv = initialSrsSnapshot[item.wordKey]?.level ?? 0;
        const transKey: SrsTransitionKey =
          lv === 0
            ? '0_1'
            : lv === 1
            ? '1_2'
            : lv === 2
            ? '2_3'
            : lv === 3
            ? '3_4'
            : '4_5';
        const desired = vocabState.srsSettings.transitions[transKey] || 'quiz';
        if (
          desired === 'quiz' &&
          !generateQuizQuestionForItem(item, combinedPool, 'word_to_meaning', idx)
        ) {
          return 'spell';
        }
        return desired;
      }

      if (mode === 'mixed') {
        const candidates: SrsStepMode[] = ['quiz', 'spell', 'dictation'];
        const validCandidates = candidates.filter((c) => {
          if (c === 'quiz') {
            return Boolean(generateQuizQuestionForItem(item, combinedPool, 'word_to_meaning', idx));
          }
          return true;
        });
        if (validCandidates.length === 0) return 'flashcard';
        return validCandidates[idx % validCandidates.length];
      }

      if (mode === 'flashcard') return 'flashcard';
      if (mode === 'dictation') return 'dictation';
      if (mode === 'spell') return 'spell';
      if (mode === 'monkey') return monkeySubMode === 'spell' ? 'spell' : 'quiz';
      return 'quiz';
    });
  }, [
    sessionItems,
    distractorPool,
    sessionKind,
    vocabState.srsSettings,
    initialSrsSnapshot,
    mode,
    monkeySubMode,
  ]);

  const currentItem: NormalizedVocabItem | undefined = sessionItems[currentIndex];
  const currentStepMode: SrsStepMode = stepModesByIndex[currentIndex] || 'quiz';

  // Determine if high-level SRS locks hints/translations/answer-audio before grading
  const isHighLevelSrsLocked = useMemo(() => {
    if (sessionKind !== 'srs' || !currentItem) return false;
    const lv = initialSrsSnapshot[currentItem.wordKey]?.level ?? 0;
    return lv >= 2; // Lv2->3, Lv3->4, Lv4->5
  }, [sessionKind, currentItem, initialSrsSnapshot]);

  // Generate Quiz Question when currentStepMode === 'quiz'
  const currentQuizQuestion = useMemo<GeneratedQuizQuestion | null>(() => {
    if (!currentItem || currentStepMode !== 'quiz') return null;
    const pool = distractorPool.length >= 2 ? distractorPool : sessionItems;
    const requestedSubMode: QuizSubMode =
      subMode === 'meaning_to_word' || subMode === 'context_cloze'
        ? subMode
        : 'word_to_meaning';

    const q = generateQuizQuestionForItem(currentItem, pool, requestedSubMode, currentIndex);
    if (q) return q;
    // Fallback to word_to_meaning if context_cloze wasn't available
    return generateQuizQuestionForItem(currentItem, pool, 'word_to_meaning', currentIndex);
  }, [currentItem, currentStepMode, distractorPool, sessionItems, subMode, currentIndex]);

  // Tab visibility listener to pause timers automatically
  useEffect(() => {
    const handleVisibility = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopDictionaryAudio();
    };
  }, []);

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolumePercent(clamped);
    const nextState = {
      ...vocabState,
      audioVolumePercent: clamped,
    };
    saveUserVocabState(nextState);
    onVocabStateChange(nextState);
  };

  // Reset per-question state whenever currentIndex changes
  const resetQuestionState = useCallback(
    (nextIdx: number) => {
      const nextStep = stepModesByIndex[nextIdx] || 'quiz';
      setUserInput('');
      setSelectedQuizOptionId(null);
      setQuestionGraded(false);
      setQuestionOutcome(null);
      setHintLevel(0);
      setRevealedIndices([]);
      setShowMaskedExample(false);
      setShowClozeTranslation(false);
      setUsedAudioHelpInSpell(false);
      setDictationAudioStarted(false);
      setDictationAudioError(null);
      setQuestionRemainingMs(30000);
      lastTickTimeRef.current = Date.now();

      if (nextStep === 'quiz') {
        questionTimerActiveRef.current = true;
      } else if (nextStep === 'spell') {
        questionTimerActiveRef.current = isTimedSpellOrDictation;
      } else if (nextStep === 'dictation') {
        // Dictation timer starts only after first audio playback starts
        questionTimerActiveRef.current = false;
      } else {
        questionTimerActiveRef.current = false;
      }
    },
    [stepModesByIndex, isTimedSpellOrDictation]
  );

  useEffect(() => {
    if (mode !== 'match' && mode !== 'flashcard') {
      resetQuestionState(currentIndex);
    }
  }, [currentIndex, mode, resetQuestionState]);

  // Initialize Matching Round
  const initMatchRound = useCallback(
    (roundIdx: number) => {
      const start = roundIdx * matchRoundSize;
      const slice = sessionItems.slice(start, start + matchRoundSize);
      const left: MatchCard[] = fisherYatesShuffle(
        slice.map((it) => ({
          id: `L_${it.wordKey}`,
          wordKey: it.wordKey,
          text: it.word,
          side: 'left',
        }))
      );
      const right: MatchCard[] = fisherYatesShuffle(
        slice.map((it) => ({
          id: `R_${it.wordKey}`,
          wordKey: it.wordKey,
          text: it.meaningVi,
          side: 'right',
        }))
      );
      setMatchLeftCards(left);
      setMatchRightCards(right);
      setSelectedLeftCardId(null);
      setSelectedRightCardId(null);
      setMatchedWordKeysInRound(new Set());
      setWrongTaintedWordKeys(new Set());
      setWrongFlashPair(null);
      setMatchRoundRemainingMs(30000);
      setMatchRoundFinishedBanner(false);
      lastTickTimeRef.current = Date.now();
    },
    [sessionItems]
  );

  useEffect(() => {
    if (mode === 'match') {
      initMatchRound(0);
    }
  }, [mode, initMatchRound]);

  // Reward helper (max 1 reward per wordKey per session)
  const computeRewardForAttempt = useCallback(
    (wordKey: string, isEligibleForReward: boolean): number => {
      if (!isEligibleForReward || rewardedKeys.has(wordKey)) return 0;
      const baseReward = REWARD_CONFIG[mode] ?? 10;
      return baseReward;
    },
    [mode, rewardedKeys]
  );

  // Record an attempt for an item
  const recordItemAttempt = useCallback(
    (
      item: NormalizedVocabItem,
      outcome: SessionItemAttempt['outcome'],
      extra?: {
        selfRating?: 'known' | 'forgot';
        hintCount?: number;
        usedExample?: boolean;
        usedTranslation?: boolean;
        usedAudioHelp?: boolean;
        modeUsedOverride?: string;
      }
    ) => {
      const isRewardEligible =
        outcome === 'correct' || (outcome === 'self_rated' && Boolean(extra?.selfRating));
      const pts = computeRewardForAttempt(item.wordKey, isRewardEligible);

      if (pts > 0) {
        setRewardedKeys((prev) => {
          const next = new Set(prev);
          next.add(item.wordKey);
          return next;
        });
      }

      const srsSnap = initialSrsSnapshot[item.wordKey];
      const attempt: SessionItemAttempt = {
        wordKey: item.wordKey,
        deckId: item.deckId,
        wordId: item.id,
        wordSnapshot: item.word,
        meaningSnapshot: item.meaningVi,
        phoneticSnapshot: item.phonetic,
        posSnapshot: item.partOfSpeech,
        modeUsed: extra?.modeUsedOverride || currentStepMode,
        outcome,
        selfRating: extra?.selfRating,
        hintCount: extra?.hintCount ?? hintLevel,
        usedExample: extra?.usedExample ?? showMaskedExample,
        usedTranslation: extra?.usedTranslation ?? showClozeTranslation,
        usedAudioHelp: extra?.usedAudioHelp ?? usedAudioHelpInSpell,
        earnedPoints: pts,
        srsBeforeLevel: srsSnap?.level,
        srsBeforeDueAt: srsSnap?.dueAt,
        srsBeforeVersion: srsSnap?.version,
        wasDueAtSessionStart: srsSnap?.wasDue,
      };

      setAttemptsMap((prev) => ({
        ...prev,
        [item.wordKey]: attempt,
      }));
    },
    [
      computeRewardForAttempt,
      initialSrsSnapshot,
      currentStepMode,
      hintLevel,
      showMaskedExample,
      showClozeTranslation,
      usedAudioHelpInSpell,
    ]
  );

  // Handle grading a Quiz / Spell / Dictation question
  const handleGradeObjectiveQuestion = useCallback(
    (rawOutcome: 'correct' | 'incorrect' | 'timeout', chosenOptionId?: string) => {
      if (!currentItem || questionGraded) return;
      questionTimerActiveRef.current = false;
      setQuestionGraded(true);
      if (chosenOptionId) setSelectedQuizOptionId(chosenOptionId);

      const usedAssistance =
        hintLevel > 0 || showMaskedExample || showClozeTranslation || usedAudioHelpInSpell;

      const finalOutcome: 'correct' | 'assisted_correct' | 'incorrect' | 'timeout' =
        rawOutcome === 'correct'
          ? usedAssistance
            ? 'assisted_correct'
            : 'correct'
          : rawOutcome;

      setQuestionOutcome(finalOutcome);
      recordItemAttempt(currentItem, finalOutcome);

      // Mode-specific side effects (Flappy Bird lives / Monkey Rescue distance)
      if (mode === 'flappy') {
        setFlappyPhase('feedback');
        if (finalOutcome === 'incorrect' || finalOutcome === 'timeout') {
          setFlappyLives((prev) => {
            const nextLives = prev - 1;
            if (nextLives <= 0) {
              setTimeout(() => setEndReason('out_of_lives'), 900);
            }
            return Math.max(0, nextLives);
          });
        }
      } else if (mode === 'monkey') {
        setMonkeyPhase('feedback');
        setMonkeyDistanceMeters((prev) => {
          if (finalOutcome === 'correct' || finalOutcome === 'assisted_correct') {
            return Math.min(100, prev + 15);
          }
          const decreased = Math.max(0, prev - 10);
          if (decreased <= 0) {
            setTimeout(() => {
              setMonkeyPhase('captured');
              setEndReason('caught_by_yeti');
            }, 600);
          }
          return decreased;
        });
      }
    },
    [
      currentItem,
      questionGraded,
      hintLevel,
      showMaskedExample,
      showClozeTranslation,
      usedAudioHelpInSpell,
      recordItemAttempt,
      mode,
    ]
  );

  // Deadline timer tick for Quiz / Spell / Dictation & Monkey Rescue continuous chase
  useEffect(() => {
    if (endReason !== null || showExitConfirm || isPausedModal || isTabHidden) {
      lastTickTimeRef.current = Date.now();
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const dtMs = Math.min(250, Math.max(0, now - lastTickTimeRef.current));
      lastTickTimeRef.current = now;

      // 1. Monkey Rescue continuous Yeti chase during active question
      if (mode === 'monkey' && monkeyPhase === 'question' && !questionGraded && currentItem) {
        setMonkeyDistanceMeters((prev) => {
          const nextDist = Math.max(0, prev - (yetiSpeedMetersPerSec * dtMs) / 1000);
          if (nextDist <= 0) {
            // Mark current unfinished question as 'incomplete' (never false-wrong)
            questionTimerActiveRef.current = false;
            recordItemAttempt(currentItem, 'incomplete');
            setMonkeyPhase('captured');
            setEndReason('caught_by_yeti');
          }
          return nextDist;
        });
      }

      // 2. Match round timer
      if (
        mode === 'match' &&
        isMatchTimed &&
        !matchRoundFinishedBanner &&
        matchLeftCards.length > 0
      ) {
        setMatchRoundRemainingMs((prev) => {
          const nextMs = Math.max(0, prev - dtMs);
          if (nextMs <= 0) {
            // Mark remaining unmatched items in session as incomplete
            setEndReason('out_of_lives');
          }
          return nextMs;
        });
      }

      // 3. Per-question 30s countdown
      const isFlappyQuestionOpen = mode === 'flappy' && flappyPhase === 'question';
      const isMonkeyQuestionOpen = mode === 'monkey' && monkeyPhase === 'question';
      const isStandardQuestionOpen =
        mode !== 'flappy' && mode !== 'monkey' && mode !== 'match' && mode !== 'flashcard';

      if (
        questionTimerActiveRef.current &&
        !questionGraded &&
        (isFlappyQuestionOpen || isMonkeyQuestionOpen || isStandardQuestionOpen)
      ) {
        setQuestionRemainingMs((prev) => {
          const nextMs = Math.max(0, prev - dtMs);
          if (nextMs <= 0) {
            handleGradeObjectiveQuestion('timeout');
          }
          return nextMs;
        });
      }
    }, 80);

    return () => clearInterval(interval);
  }, [
    endReason,
    showExitConfirm,
    isPausedModal,
    isTabHidden,
    mode,
    monkeyPhase,
    flappyPhase,
    questionGraded,
    currentItem,
    yetiSpeedMetersPerSec,
    isMatchTimed,
    matchRoundFinishedBanner,
    matchLeftCards.length,
    handleGradeObjectiveQuestion,
    recordItemAttempt,
  ]);

  // Flappy Bird Physics Loop when flappyPhase === 'flying'
  useEffect(() => {
    if (
      mode !== 'flappy' ||
      flappyPhase !== 'flying' ||
      endReason !== null ||
      showExitConfirm ||
      isPausedModal ||
      isTabHidden
    ) {
      return;
    }

    let lastTime = performance.now();
    let animId: number;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      setFlappyPipeX((prevX) => {
        const nextX = prevX - 135 * dt;
        // Trigger question when pipe reaches bird (x <= 95)
        if (nextX <= 95) {
          setFlappyPhase('question');
          questionTimerActiveRef.current = true;
          lastTickTimeRef.current = Date.now();
          return 420;
        }
        return nextX;
      });

      setFlappyBirdY((prevY) => {
        if (flappyAutoPilot) {
          const targetY = flappyGapTop + 42;
          return prevY + (targetY - prevY) * 6 * dt;
        }
        flappyVelocityRef.current += 420 * dt; // Gravity
        const nextY = prevY + flappyVelocityRef.current * dt;

        // If bird hits ground or ceiling, trigger question for this pipe without losing life directly
        if (nextY <= 12 || nextY >= 255) {
          flappyVelocityRef.current = 0;
          setFlappyPhase('question');
          questionTimerActiveRef.current = true;
          lastTickTimeRef.current = Date.now();
          setFlappyPipeX(420);
          return 135;
        }
        return nextY;
      });

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [
    mode,
    flappyPhase,
    endReason,
    showExitConfirm,
    isPausedModal,
    isTabHidden,
    flappyAutoPilot,
    flappyGapTop,
  ]);

  // Advance to next question or finish session
  const handleNextQuestion = useCallback(() => {
    if (currentIndex + 1 >= sessionItems.length) {
      setEndReason('completed');
      return;
    }
    const nextIdx = currentIndex + 1;
    setCurrentIndex(nextIdx);

    if (mode === 'flappy') {
      // Transition to resume-ready overlay where 1st tap drops & 2nd tap jumps
      setFlappyBirdY(130);
      flappyVelocityRef.current = 0;
      setFlappyPipeX(420);
      setFlappyGapTop(45 + Math.floor(Math.random() * 90));
      setFlappyPhase('resume-ready');
    } else if (mode === 'monkey') {
      setMonkeyPhase('question');
    }
  }, [currentIndex, sessionItems.length, mode]);

  // Keyboard shortcuts (Space, 1-4, Arrows, Enter) with strict input protection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (endReason !== null || showExitConfirm || isPausedModal || showUnratedFlashcardWarning) {
        return;
      }

      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInputFocused =
        activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Flappy Bird Space handling (only when not focused in a text input)
      if (mode === 'flappy' && e.code === 'Space' && !isInputFocused) {
        e.preventDefault();
        if (flappyPhase === 'intro') {
          setFlappyPhase('flying');
        } else if (flappyPhase === 'resume-ready') {
          // 1st Space closes overlay and starts falling
          flappyVelocityRef.current = 20;
          setFlappyPhase('flying');
        } else if (flappyPhase === 'flying') {
          // 2nd Space flaps upward
          flappyVelocityRef.current = -185;
        }
        return;
      }

      // Flashcard keyboard shortcuts (when not focused in typing check input)
      if (currentStepMode === 'flashcard' && !isInputFocused && currentItem) {
        if (e.code === 'Space') {
          e.preventDefault();
          setFlashcardDrafts((prev) => {
            const cur = prev[currentItem.wordKey] || {
              flipped: false,
              typedInput: '',
              typedChecked: false,
              typedIsCorrect: null,
              rewarded: false,
            };
            return {
              ...prev,
              [currentItem.wordKey]: { ...cur, flipped: !cur.flipped },
            };
          });
        } else if (e.code === 'ArrowLeft' && currentIndex > 0) {
          e.preventDefault();
          setCurrentIndex((i) => Math.max(0, i - 1));
        } else if (e.code === 'ArrowRight' && currentIndex + 1 < sessionItems.length) {
          e.preventDefault();
          setCurrentIndex((i) => Math.min(sessionItems.length - 1, i + 1));
        }
        return;
      }

      // Quiz 1-4 shortcuts
      if (
        currentStepMode === 'quiz' &&
        !questionGraded &&
        currentQuizQuestion &&
        !isInputFocused &&
        (mode !== 'flappy' || flappyPhase === 'question') &&
        (mode !== 'monkey' || monkeyPhase === 'question')
      ) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          const idx = Number(e.key) - 1;
          const opt = currentQuizQuestion.options[idx];
          if (opt) {
            e.preventDefault();
            handleGradeObjectiveQuestion(opt.isCorrect ? 'correct' : 'incorrect', opt.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    endReason,
    showExitConfirm,
    isPausedModal,
    showUnratedFlashcardWarning,
    mode,
    flappyPhase,
    monkeyPhase,
    currentStepMode,
    currentItem,
    currentIndex,
    sessionItems.length,
    questionGraded,
    currentQuizQuestion,
    handleGradeObjectiveQuestion,
  ]);

  // Handle Flashcard self-rating ('known' | 'forgot')
  const handleRateFlashcard = (rating: 'known' | 'forgot') => {
    if (!currentItem) return;
    const prevDraft = flashcardDrafts[currentItem.wordKey];
    setFlashcardDrafts((prev) => ({
      ...prev,
      [currentItem.wordKey]: {
        flipped: prevDraft?.flipped ?? true,
        typedInput: prevDraft?.typedInput ?? '',
        typedChecked: prevDraft?.typedChecked ?? false,
        typedIsCorrect: prevDraft?.typedIsCorrect ?? null,
        rating,
        rewarded: true,
      },
    }));

    recordItemAttempt(currentItem, 'self_rated', {
      selfRating: rating,
      modeUsedOverride: 'flashcard',
    });

    if (currentIndex + 1 < sessionItems.length) {
      setCurrentIndex((i) => i + 1);
    }
  };

  const handleFinishFlashcardSessionRequest = () => {
    const unratedCount = sessionItems.filter(
      (it) => !flashcardDrafts[it.wordKey]?.rating
    ).length;
    if (unratedCount > 0) {
      setShowUnratedFlashcardWarning(true);
      return;
    }
    setEndReason('completed');
  };

  // Matching card selection handler
  const handleSelectMatchCard = (card: MatchCard) => {
    if (matchedWordKeysInRound.has(card.wordKey) || matchRoundFinishedBanner) return;

    if (card.side === 'left') {
      const nextLeft = selectedLeftCardId === card.id ? null : card.id;
      setSelectedLeftCardId(nextLeft);
      if (nextLeft && selectedRightCardId) {
        evaluateMatchPair(nextLeft, selectedRightCardId);
      }
    } else {
      const nextRight = selectedRightCardId === card.id ? null : card.id;
      setSelectedRightCardId(nextRight);
      if (selectedLeftCardId && nextRight) {
        evaluateMatchPair(selectedLeftCardId, nextRight);
      }
    }
  };

  const evaluateMatchPair = (leftId: string, rightId: string) => {
    const leftCard = matchLeftCards.find((c) => c.id === leftId);
    const rightCard = matchRightCards.find((c) => c.id === rightId);
    if (!leftCard || !rightCard) return;

    if (leftCard.wordKey === rightCard.wordKey) {
      // Correct match
      const matchedItem = sessionItems.find((it) => it.wordKey === leftCard.wordKey);
      const wasTainted = wrongTaintedWordKeys.has(leftCard.wordKey);
      if (matchedItem) {
        recordItemAttempt(matchedItem, wasTainted ? 'assisted_correct' : 'correct', {
          modeUsedOverride: 'match',
        });
      }

      setMatchedWordKeysInRound((prev) => {
        const next = new Set(prev);
        next.add(leftCard.wordKey);
        if (next.size >= matchLeftCards.length) {
          // Round completed
          if (matchRoundIndex + 1 >= totalMatchRounds) {
            setTimeout(() => setEndReason('completed'), 450);
          } else {
            setMatchRoundFinishedBanner(true);
          }
        }
        return next;
      });
      setMatchTotalPairsCompleted((c) => c + 1);
      setSelectedLeftCardId(null);
      setSelectedRightCardId(null);
    } else {
      // Wrong match
      setWrongFlashPair({ leftId, rightId });
      setWrongTaintedWordKeys((prev) => {
        const next = new Set(prev);
        next.add(leftCard.wordKey);
        next.add(rightCard.wordKey);
        return next;
      });
      setMatchTotalWrongClicks((c) => c + 1);
      setMatchHearts((prev) => {
        const nextHearts = prev - 1;
        if (nextHearts <= 0) {
          setTimeout(() => setEndReason('out_of_lives'), 550);
        }
        return Math.max(0, nextHearts);
      });
      setTimeout(() => {
        setWrongFlashPair(null);
        setSelectedLeftCardId(null);
        setSelectedRightCardId(null);
      }, 500);
    }
  };

  // Play dictation audio & start timer on first successful playback
  const handlePlayDictationAudio = (rateOverride?: 0.75 | 1 | 1.25) => {
    if (!currentItem) return;
    const rate = rateOverride || playbackSpeed;
    if (rateOverride) setPlaybackSpeed(rateOverride);
    setDictationAudioError(null);

    playDictionaryAudio(currentItem.word, {
      customAudioUrl: currentItem.audioUrl,
      playbackRate: rate,
      volumePercent,
      onStart: () => {
        if (!dictationAudioStarted) {
          setDictationAudioStarted(true);
          if (isTimedSpellOrDictation && !questionGraded) {
            questionTimerActiveRef.current = true;
            lastTickTimeRef.current = Date.now();
          }
        }
      },
      onError: (msg) => {
        setDictationAudioError(msg);
        // Do not start timer automatically if audio failed
      },
    });
  };

  // Compute Pre-save summary when endReason !== null
  const resultsSummary = useMemo(() => {
    const allAttempts: SessionItemAttempt[] = sessionItems.map((item) => {
      const existing = attemptsMap[item.wordKey];
      if (existing) return existing;
      return {
        wordKey: item.wordKey,
        deckId: item.deckId,
        wordId: item.id,
        wordSnapshot: item.word,
        meaningSnapshot: item.meaningVi,
        phoneticSnapshot: item.phonetic,
        posSnapshot: item.partOfSpeech,
        modeUsed: mode,
        outcome: 'incomplete',
        hintCount: 0,
        usedExample: false,
        usedTranslation: false,
        usedAudioHelp: false,
        earnedPoints: 0,
        srsBeforeLevel: initialSrsSnapshot[item.wordKey]?.level,
        srsBeforeDueAt: initialSrsSnapshot[item.wordKey]?.dueAt,
        srsBeforeVersion: initialSrsSnapshot[item.wordKey]?.version,
        wasDueAtSessionStart: initialSrsSnapshot[item.wordKey]?.wasDue,
      };
    });

    let independentCorrect = 0;
    let assistedCorrect = 0;
    let incorrect = 0;
    let timeout = 0;
    let selfRatedKnown = 0;
    let selfRatedForgot = 0;
    let incomplete = 0;
    let previewPoints = 0;
    const seenReward = new Set<string>();

    const eligibleForKnownCheckbox: NormalizedVocabItem[] = [];
    const wrongOrForgotItems: NormalizedVocabItem[] = [];
    const incompleteItems: NormalizedVocabItem[] = [];

    sessionItems.forEach((item, idx) => {
      const att = allAttempts[idx];
      if (att.earnedPoints > 0 && !seenReward.has(att.wordKey)) {
        seenReward.add(att.wordKey);
        previewPoints += att.earnedPoints;
      }

      if (att.outcome === 'correct') {
        independentCorrect++;
        if (!vocabState.knownMap[item.wordKey]?.isKnown) {
          eligibleForKnownCheckbox.push(item);
        }
      } else if (att.outcome === 'assisted_correct') {
        assistedCorrect++;
      } else if (att.outcome === 'incorrect') {
        incorrect++;
        wrongOrForgotItems.push(item);
      } else if (att.outcome === 'timeout') {
        timeout++;
        wrongOrForgotItems.push(item);
      } else if (att.outcome === 'self_rated') {
        if (att.selfRating === 'known') selfRatedKnown++;
        else {
          selfRatedForgot++;
          wrongOrForgotItems.push(item);
        }
      } else {
        incomplete++;
        incompleteItems.push(item);
      }
    });

    const totalGradedObjective = independentCorrect + assistedCorrect + incorrect + timeout;
    const objectiveAccuracy =
      totalGradedObjective > 0
        ? Math.round(((independentCorrect + assistedCorrect) / totalGradedObjective) * 100)
        : null;

    return {
      allAttempts,
      independentCorrect,
      assistedCorrect,
      incorrect,
      timeout,
      selfRatedKnown,
      selfRatedForgot,
      incomplete,
      previewPoints,
      objectiveAccuracy,
      totalGradedObjective,
      eligibleForKnownCheckbox,
      wrongOrForgotItems,
      incompleteItems,
    };
  }, [sessionItems, attemptsMap, mode, initialSrsSnapshot, vocabState.knownMap]);

  // Commit session handler ("Lưu & Hoàn thành")
  const handleCommitSession = () => {
    if (committedResult) return;

    const markedKnown = Array.from(checkedKnownKeys);
    const unmarkedKnown: string[] = [];

    // In Flashcard mode, rating 'known' marks isKnown=true and rating 'forgot' marks isKnown=false on commit
    sessionItems.forEach((it) => {
      const att = attemptsMap[it.wordKey];
      if (att?.outcome === 'self_rated') {
        if (att.selfRating === 'known' && !markedKnown.includes(it.wordKey)) {
          markedKnown.push(it.wordKey);
        } else if (att.selfRating === 'forgot') {
          unmarkedKnown.push(it.wordKey);
        }
      }
    });

    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
    );

    const res = commitVocabSession(vocabState.userId, {
      sessionId,
      parentSessionId,
      sessionKind,
      scopeType,
      scopeId,
      scopeTitle,
      mode,
      subMode,
      endReason: endReason || 'completed',
      totalItemsInSession: sessionItems.length,
      allWordKeysSnapshot: sessionItems.map((i) => i.wordKey),
      attempts: resultsSummary.allAttempts,
      markedKnownWordKeys: markedKnown,
      unmarkedKnownWordKeys: unmarkedKnown,
      matchingPairsCompleted: mode === 'match' ? matchTotalPairsCompleted : undefined,
      matchingWrongClicks: mode === 'match' ? matchTotalWrongClicks : undefined,
      durationSeconds,
    });

    onVocabStateChange(res.state);
    setCommittedResult({
      savedSession: res.savedSession,
      conflictsCount: res.conflictsCount,
    });
  };

  // Render Results Screen (Pre-Save & Post-Save)
  if (endReason !== null) {
    const isSaved = Boolean(committedResult);
    const balanceBefore = committedResult
      ? committedResult.savedSession.balanceBefore
      : vocabState.pointsBalance;
    const pointsDelta = committedResult
      ? committedResult.savedSession.pointsEarned
      : resultsSummary.previewPoints;
    const balanceAfter = committedResult
      ? committedResult.savedSession.balanceAfter
      : balanceBefore + pointsDelta;

    return (
      <div className="max-w-4xl mx-auto py-4 px-3 sm:px-6 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
          {/* Top Banner */}
          <div
            className={`px-6 py-5 text-white flex flex-wrap items-center justify-between gap-4 ${
              endReason === 'caught_by_yeti' || endReason === 'out_of_lives'
                ? 'bg-gradient-to-r from-rose-600 to-amber-600'
                : 'bg-gradient-to-r from-indigo-600 to-violet-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-extrabold">
                    {endReason === 'caught_by_yeti'
                      ? 'Khỉ đã bị Yeti bắt kịp!'
                      : endReason === 'out_of_lives'
                      ? 'Kết thúc lượt chơi (Hết mạng / Hết giờ)'
                      : 'Hoàn thành lượt học từ vựng!'}
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase ${
                      isSaved
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-amber-300 text-slate-950'
                    }`}
                  >
                    {isSaved ? 'Đã nhận & Đã lưu' : 'Dự kiến (Chưa lưu)'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-white/85 mt-0.5">
                  {scopeTitle} • Tổng {sessionItems.length} từ trong phiên
                </p>
              </div>
            </div>

            {!isSaved && (
              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition"
              >
                Thoát không lưu
              </button>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Multi-tab conflict notice if any */}
            {committedResult && committedResult.conflictsCount > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Phát hiện {committedResult.conflictsCount} từ đã được cập nhật ở một tab khác
                  trong lúc bạn đang học. Hệ thống đã giữ nguyên bản ghi mới hơn để tránh ghi đè.
                </span>
              </div>
            )}

            {/* Points Ledger Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-xs text-slate-500 font-medium">Số dư trước lượt học</div>
                <div className="text-lg font-extrabold text-slate-800 mt-0.5">
                  {balanceBefore} điểm
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-indigo-200">
                <div className="text-xs text-indigo-600 font-bold">
                  {isSaved ? 'Điểm thưởng đã nhận' : 'Điểm thưởng dự kiến'}
                </div>
                <div className="text-lg font-extrabold text-indigo-600 mt-0.5">
                  +{pointsDelta} điểm
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200">
                <div className="text-xs text-emerald-700 font-bold">
                  {isSaved ? 'Số dư mới hiện tại' : 'Số dư dự kiến sau lưu'}
                </div>
                <div className="text-lg font-extrabold text-emerald-600 mt-0.5">
                  {balanceAfter} điểm
                </div>
              </div>
            </div>

            {/* Breakdown Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
                <div className="text-xl font-extrabold text-emerald-700">
                  {resultsSummary.independentCorrect}
                </div>
                <div className="text-xs font-semibold text-emerald-800">Đúng độc lập</div>
              </div>
              <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 text-center">
                <div className="text-xl font-extrabold text-sky-700">
                  {resultsSummary.assistedCorrect}
                </div>
                <div className="text-xs font-semibold text-sky-800">Đúng có trợ giúp</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-center">
                <div className="text-xl font-extrabold text-rose-700">
                  {resultsSummary.incorrect + resultsSummary.timeout}
                </div>
                <div className="text-xs font-semibold text-rose-800">Sai / Hết giờ</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-center">
                <div className="text-xl font-extrabold text-slate-700">
                  {resultsSummary.incomplete}
                </div>
                <div className="text-xs font-semibold text-slate-600">Chưa chấm / Chưa hỏi</div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-center col-span-2 sm:col-span-1">
                <div className="text-xl font-extrabold text-indigo-700">
                  {resultsSummary.objectiveAccuracy !== null
                    ? `${resultsSummary.objectiveAccuracy}%`
                    : `${resultsSummary.selfRatedKnown}/${sessionItems.length}`}
                </div>
                <div className="text-xs font-semibold text-indigo-800">
                  {resultsSummary.objectiveAccuracy !== null
                    ? `Độ chính xác (${
                        resultsSummary.independentCorrect + resultsSummary.assistedCorrect
                      }/${resultsSummary.totalGradedObjective})`
                    : 'Tự đánh giá Thuộc'}
                </div>
              </div>
            </div>

            {/* Known Confirmation Section for Independent Correct Items (Default Unchecked) */}
            {resultsSummary.eligibleForKnownCheckbox.length > 0 && (
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Xác nhận đánh dấu &ldquo;Đã thuộc&rdquo; (Tùy chọn)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Chỉ những từ bạn trả lời đúng độc lập (không dùng gợi ý) mới được đề xuất. Mặc
                      định không tự động tích chọn để tránh lệch tiến độ.
                    </p>
                  </div>
                  {!isSaved && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          checkedKnownKeys.size === resultsSummary.eligibleForKnownCheckbox.length
                        ) {
                          setCheckedKnownKeys(new Set());
                        } else {
                          setCheckedKnownKeys(
                            new Set(resultsSummary.eligibleForKnownCheckbox.map((i) => i.wordKey))
                          );
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200"
                    >
                      {checkedKnownKeys.size === resultsSummary.eligibleForKnownCheckbox.length
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {resultsSummary.eligibleForKnownCheckbox.map((item) => {
                    const checked = checkedKnownKeys.has(item.wordKey);
                    return (
                      <button
                        key={item.wordKey}
                        type="button"
                        disabled={isSaved}
                        onClick={() => {
                          setCheckedKnownKeys((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.wordKey)) next.delete(item.wordKey);
                            else next.add(item.wordKey);
                            return next;
                          });
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition ${
                          checked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        } ${isSaved ? 'opacity-75 cursor-default' : ''}`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-xs sm:text-sm truncate">{item.word}</div>
                          <div className="text-xs text-slate-500 truncate">{item.meaningVi}</div>
                        </div>
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pre-Save vs Post-Save Actions */}
            {!isSaved ? (
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCommitSession}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-md transition"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Lưu & Hoàn thành (+{pointsDelta} điểm)
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  {resultsSummary.wrongOrForgotItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onStartFollowUpSession({
                          items: resultsSummary.wrongOrForgotItems,
                          mode,
                          subMode,
                          parentSessionId: sessionId,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Làm lại câu sai ({resultsSummary.wrongOrForgotItems.length})
                    </button>
                  )}

                  {resultsSummary.incompleteItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        onStartFollowUpSession({
                          items: resultsSummary.incompleteItems,
                          mode,
                          subMode,
                          parentSessionId: sessionId,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
                    >
                      <Play className="w-4 h-4" />
                      Chơi tiếp ({resultsSummary.incompleteItems.length} mục chưa chấm)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onStartFollowUpSession({
                          items: fisherYatesShuffle(sessionItems),
                          mode,
                          subMode,
                          parentSessionId: sessionId,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Học lượt mới
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onSwitchModeRequest}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition"
                  >
                    <Gamepad2 className="w-4 h-4 text-indigo-600" />
                    Game khác
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onExitToDeck}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Về bộ từ
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Exit without saving modal on Pre-Save screen */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Thoát khỏi lượt học?</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Kết quả và điểm của lượt này chưa được lưu.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExitConfirm(false)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                >
                  Ở lại
                </button>
                <button
                  type="button"
                  onClick={onExitToDeck}
                  className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100"
                >
                  Thoát không lưu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Helper to render active question block (Quiz / Spell / Dictation) inside standard modes, Flappy Bird, or Monkey Rescue
  const renderActiveQuestionCard = () => {
    if (!currentItem) return null;

    const hintState = computeCumulativeHint(currentItem.word, revealedIndices, hintLevel);
    const maskedExampleText = currentItem.cloze
      ? currentItem.cloze.textWithBlank
      : currentItem.exampleEn
      ? currentItem.exampleEn.replace(new RegExp(currentItem.word, 'gi'), '_____')
      : '';

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
        {/* Top question header: Timer & Step badge */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
              {currentStepMode === 'quiz'
                ? 'Trắc nghiệm'
                : currentStepMode === 'dictation'
                ? 'Nghe & Gõ từ'
                : 'Gõ từ vựng'}
            </span>
            {sessionKind === 'srs' && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                SRS Lv{initialSrsSnapshot[currentItem.wordKey]?.level ?? 0} → Lv
                {Math.min(5, (initialSrsSnapshot[currentItem.wordKey]?.level ?? 0) + 1)}
              </span>
            )}
            {isHighLevelSrsLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                <Lock className="w-3 h-3" />
                Khóa gợi ý (Lv cao)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {(currentStepMode === 'spell' || currentStepMode === 'dictation') &&
              mode !== 'flappy' &&
              mode !== 'monkey' && (
                <button
                  type="button"
                  onClick={() => {
                    const nextTimed = !isTimedSpellOrDictation;
                    setIsTimedSpellOrDictation(nextTimed);
                    questionTimerActiveRef.current =
                      nextTimed &&
                      (currentStepMode === 'spell' || dictationAudioStarted) &&
                      !questionGraded;
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    isTimedSpellOrDictation
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {isTimedSpellOrDictation ? 'Đếm giờ: 30s' : 'Không giới hạn giờ'}
                </button>
              )}

            {(currentStepMode === 'quiz' ||
              mode === 'flappy' ||
              isTimedSpellOrDictation) && (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-extrabold border ${
                  questionRemainingMs <= 8000
                    ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {currentStepMode === 'dictation' && !dictationAudioStarted && !questionGraded
                  ? '30s (Chờ bấm nghe)'
                  : `${Math.ceil(questionRemainingMs / 1000)}s`}
              </div>
            )}
          </div>
        </div>

        {/* Question Body by StepMode */}
        {currentStepMode === 'quiz' && currentQuizQuestion ? (
          <div className="space-y-4">
            {currentQuizQuestion.fewerOptionsNotice && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {currentQuizQuestion.fewerOptionsNotice}
              </div>
            )}

            <div className="text-center py-4 px-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-center gap-2">
                {currentQuizQuestion.subMode === 'word_to_meaning' && (
                  <button
                    type="button"
                    onClick={() =>
                      playDictionaryAudio(currentItem.word, {
                        customAudioUrl: currentItem.audioUrl,
                        volumePercent,
                      })
                    }
                    className="p-2 rounded-xl bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                )}
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {currentQuizQuestion.promptText}
                </h3>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                {currentQuizQuestion.promptPhonetic && (
                  <span className="font-mono">{currentQuizQuestion.promptPhonetic}</span>
                )}
                {currentQuizQuestion.promptPos && (
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold uppercase text-slate-700">
                    {currentQuizQuestion.promptPos}
                  </span>
                )}
              </div>

              {currentQuizQuestion.subMode === 'context_cloze' &&
                currentQuizQuestion.contextTranslationVi &&
                !isHighLevelSrsLocked && (
                  <div className="pt-2">
                    {showClozeTranslation ? (
                      <p className="text-xs text-indigo-700 font-medium bg-indigo-50 inline-block px-3 py-1 rounded-lg">
                        Dịch nghĩa: {currentQuizQuestion.contextTranslationVi}
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={questionGraded}
                        onClick={() => setShowClozeTranslation(true)}
                        className="text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        + Xem dịch nghĩa câu (Tính là có trợ giúp)
                      </button>
                    )}
                  </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuizQuestion.options.map((opt, idx) => {
                const isSelected = selectedQuizOptionId === opt.id;
                let btnStyle =
                  'bg-white border-slate-200 text-slate-800 hover:border-indigo-400 hover:bg-indigo-50/40';
                if (questionGraded) {
                  if (opt.isCorrect) {
                    btnStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold';
                  } else if (isSelected && !opt.isCorrect) {
                    btnStyle = 'bg-rose-50 border-rose-500 text-rose-900';
                  } else {
                    btnStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-70';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={questionGraded}
                    onClick={() =>
                      handleGradeObjectiveQuestion(
                        opt.isCorrect ? 'correct' : 'incorrect',
                        opt.id
                      )
                    }
                    className={`p-4 rounded-xl border-2 text-left flex items-center gap-3 transition ${btnStyle}`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-extrabold text-slate-700 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm sm:text-base font-medium flex-1">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : currentStepMode === 'dictation' ? (
          /* Mode 3: Nghe và gõ (Dictation) */
          <div className="space-y-4">
            <div className="text-center py-5 px-4 bg-teal-50/60 rounded-2xl border border-teal-200 space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePlayDictationAudio()}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm shadow-sm transition"
                >
                  <Volume2 className="w-5 h-5" />
                  {dictationAudioStarted ? 'Nghe lại từ vựng' : 'Bắt đầu nghe'}
                </button>

                <div className="inline-flex rounded-xl bg-white p-1 border border-teal-200">
                  {([0.75, 1, 1.25] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => handlePlayDictationAudio(spd)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        playbackSpeed === spd
                          ? 'bg-teal-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-600">
                Nghĩa tiếng Việt: <strong className="text-slate-900">{currentItem.meaningVi}</strong>{' '}
                ({currentItem.partOfSpeech})
              </div>

              {dictationAudioError && (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg inline-block">
                  Không phát được âm thanh tự động ({dictationAudioError}). Bạn có thể dựa vào nghĩa
                  tiếng Việt bên trên để gõ từ.
                </div>
              )}

              {hintLevel > 0 && (
                <div className="font-mono text-base sm:text-lg font-bold tracking-widest text-teal-900 bg-white px-4 py-2 rounded-xl border border-teal-200 inline-block">
                  {hintState.maskedDisplay}
                </div>
              )}

              {showMaskedExample && maskedExampleText && (
                <div className="text-xs text-slate-700 italic bg-white px-3 py-2 rounded-xl border border-slate-200">
                  Ví dụ: &ldquo;{maskedExampleText}&rdquo;
                </div>
              )}
            </div>

            {/* Hints & Input */}
            {!isHighLevelSrsLocked && !questionGraded && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!hintState.canRevealMore}
                  onClick={() => {
                    const nextLv = Math.min(3, hintLevel + 1);
                    const nextState = computeCumulativeHint(
                      currentItem.word,
                      revealedIndices,
                      nextLv
                    );
                    setHintLevel(nextLv);
                    setRevealedIndices(nextState.revealedIndices);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold disabled:opacity-40 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Gợi ý chữ cái ({hintLevel}/3)
                </button>

                {maskedExampleText && !showMaskedExample && (
                  <button
                    type="button"
                    onClick={() => setShowMaskedExample(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Xem câu ví dụ ẩn từ
                  </button>
                )}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (questionGraded || !userInput.trim()) return;
                const ok = checkEnglishAnswer(userInput, currentItem);
                handleGradeObjectiveQuestion(ok ? 'correct' : 'incorrect');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={userInput}
                disabled={questionGraded}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Gõ từ hoặc cụm từ tiếng Anh bạn nghe được..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-sm sm:text-base font-medium focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                autoFocus
              />
              {!questionGraded && (
                <button
                  type="submit"
                  disabled={!userInput.trim()}
                  className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-sm transition"
                >
                  Kiểm tra
                </button>
              )}
            </form>
          </div>
        ) : (
          /* Mode 4: Gõ từ (Spell) */
          <div className="space-y-4">
            <div className="text-center py-5 px-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-2">
              <span className="px-2.5 py-0.5 rounded-md bg-white border border-emerald-200 text-xs font-bold uppercase text-emerald-800">
                {currentItem.partOfSpeech}
              </span>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {currentItem.meaningVi}
              </h3>
              {maskedExampleText && (
                <p className="text-xs sm:text-sm text-slate-600 italic">
                  Ví dụ: &ldquo;{maskedExampleText}&rdquo;
                </p>
              )}
              {hintLevel > 0 && (
                <div className="font-mono text-base sm:text-lg font-bold tracking-widest text-emerald-900 bg-white px-4 py-2 rounded-xl border border-emerald-200 inline-block mt-2">
                  {hintState.maskedDisplay}
                </div>
              )}
            </div>

            {!isHighLevelSrsLocked && !questionGraded && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!hintState.canRevealMore}
                  onClick={() => {
                    const nextLv = Math.min(3, hintLevel + 1);
                    const nextState = computeCumulativeHint(
                      currentItem.word,
                      revealedIndices,
                      nextLv
                    );
                    setHintLevel(nextLv);
                    setRevealedIndices(nextState.revealedIndices);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold disabled:opacity-40 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Gợi ý chữ cái ({hintLevel}/3)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUsedAudioHelpInSpell(true);
                    playDictionaryAudio(currentItem.word, {
                      customAudioUrl: currentItem.audioUrl,
                      volumePercent,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                  Nghe phát âm gợi ý (Tính trợ giúp)
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (questionGraded || !userInput.trim()) return;
                const ok = checkEnglishAnswer(userInput, currentItem);
                handleGradeObjectiveQuestion(ok ? 'correct' : 'incorrect');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={userInput}
                disabled={questionGraded}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Gõ từ tiếng Anh tương ứng với nghĩa trên..."
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 text-sm sm:text-base font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              {!questionGraded && (
                <button
                  type="submit"
                  disabled={!userInput.trim()}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm transition"
                >
                  Kiểm tra
                </button>
              )}
            </form>
          </div>
        )}

        {/* Graded Feedback Block */}
        {questionGraded && (
          <div
            className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              questionOutcome === 'correct'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : questionOutcome === 'assisted_correct'
                ? 'bg-sky-50 border-sky-200 text-sky-950'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                {questionOutcome === 'correct' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Chính xác độc lập! (+{REWARD_CONFIG[mode]} điểm)</span>
                  </>
                ) : questionOutcome === 'assisted_correct' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-sky-600" />
                    <span>Đúng có dùng trợ giúp (0 điểm thưởng)</span>
                  </>
                ) : questionOutcome === 'timeout' ? (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Hết thời gian trả lời!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <span>Chưa chính xác!</span>
                  </>
                )}
              </div>
              <div className="text-xs sm:text-sm">
                Đáp án:{' '}
                <strong className="font-extrabold underline">{currentItem.word}</strong>{' '}
                {currentItem.phonetic && (
                  <span className="font-mono text-xs">({currentItem.phonetic})</span>
                )}{' '}
                — {currentItem.meaningVi}
              </div>
              {currentItem.exampleEn && (
                <div className="text-xs opacity-85 italic">
                  Ví dụ: &ldquo;{currentItem.exampleEn}&rdquo;
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() =>
                  playDictionaryAudio(currentItem.word, {
                    customAudioUrl: currentItem.audioUrl,
                    volumePercent,
                  })
                }
                className="p-2.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200 text-indigo-700"
                title="Nghe phát âm"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextQuestion}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs transition"
              >
                <span>
                  {mode === 'flappy'
                    ? 'Tiếp tục bay'
                    : currentIndex + 1 >= sessionItems.length
                    ? 'Xem kết quả'
                    : 'Câu tiếp theo'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-3 px-3 sm:px-6 space-y-4">
      {/* Unified Session Top Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
          >
            <X className="w-4 h-4" />
            Thoát
          </button>
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 line-clamp-1">
              {scopeTitle}
            </div>
            <div className="text-[11px] text-slate-500">
              {mode === 'match'
                ? `Vòng ${matchRoundIndex + 1}/${totalMatchRounds} • Đã ghép ${matchTotalPairsCompleted}/${sessionItems.length} cặp`
                : ` Mục ${currentIndex + 1}/${sessionItems.length}`}
            </div>
          </div>
        </div>

        {/* Right Controls: Volume + Pause */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="range"
              min={0}
              max={100}
              value={volumePercent}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-16 accent-indigo-600 cursor-pointer"
              aria-label="Âm lượng"
            />
            <span className="text-[11px] font-bold text-slate-600 w-8">{volumePercent}%</span>
          </div>

          <button
            type="button"
            onClick={() => setIsPausedModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
          >
            <Pause className="w-3.5 h-3.5" />
            Tạm dừng
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{
            width: `${Math.round(
              ((mode === 'match' ? matchTotalPairsCompleted : currentIndex + 1) /
                Math.max(1, sessionItems.length)) *
                100
            )}%`,
          }}
        />
      </div>

      {/* Mode 1: FLASHCARD (or SRS step using flashcard) */}
      {currentStepMode === 'flashcard' && mode !== 'match' && mode !== 'flappy' && mode !== 'monkey' && currentItem && (
        <div className="space-y-4">
          {(() => {
            const draft = flashcardDrafts[currentItem.wordKey] || {
              flipped: false,
              typedInput: '',
              typedChecked: false,
              typedIsCorrect: null,
              rewarded: false,
            };
            const isVnToEn = subMode === 'vn_to_en';
            const maskedExample = currentItem.cloze
              ? currentItem.cloze.textWithBlank
              : currentItem.exampleEn
              ? currentItem.exampleEn.replace(new RegExp(currentItem.word, 'gi'), '_____')
              : '';

            return (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-md space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-xs font-extrabold">
                    Thẻ từ ({isVnToEn ? 'Việt → Anh' : 'Anh → Việt'}) • Thẻ {currentIndex + 1}/
                    {sessionItems.length}
                  </span>
                  <div className="flex items-center gap-2">
                    {draft.rating && (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          draft.rating === 'known'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        Đã đánh giá: {draft.rating === 'known' ? 'Thuộc' : 'Quên'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setFlashcardDrafts((prev) => ({
                          ...prev,
                          [currentItem.wordKey]: { ...draft, flipped: !draft.flipped },
                        }))
                      }
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                    >
                      {draft.flipped ? 'Xem mặt trước (Space)' : 'Lật mặt sau (Space)'}
                    </button>
                  </div>
                </div>

                {/* Card Flip Area */}
                <div
                  onClick={() =>
                    setFlashcardDrafts((prev) => ({
                      ...prev,
                      [currentItem.wordKey]: { ...draft, flipped: !draft.flipped },
                    }))
                  }
                  className="cursor-pointer min-h-[210px] rounded-2xl border-2 border-dashed border-violet-200 bg-gradient-to-br from-violet-50/50 to-indigo-50/40 p-6 flex flex-col items-center justify-center text-center space-y-3 hover:border-violet-300 transition"
                >
                  {!draft.flipped ? (
                    /* FRONT SIDE */
                    isVnToEn ? (
                      <>
                        <span className="px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-xs font-bold uppercase text-slate-600">
                          {currentItem.partOfSpeech}
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                          {currentItem.meaningVi}
                        </h3>
                        {maskedExample && (
                          <p className="text-xs sm:text-sm text-slate-600 italic max-w-lg">
                            Ví dụ: &ldquo;{maskedExample}&rdquo;
                          </p>
                        )}
                        <p className="text-[11px] text-violet-600 font-semibold pt-2">
                          (Nhấn vào thẻ hoặc phím Space để lật xem từ tiếng Anh)
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playDictionaryAudio(currentItem.word, {
                                customAudioUrl: currentItem.audioUrl,
                                volumePercent,
                              });
                            }}
                            className="p-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition"
                            title="Nghe phát âm"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                            {currentItem.word}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                          {currentItem.phonetic && (
                            <span className="font-mono">{currentItem.phonetic}</span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold uppercase text-slate-700">
                            {currentItem.partOfSpeech}
                          </span>
                        </div>
                        <p className="text-[11px] text-violet-600 font-semibold pt-2">
                          (Nhấn vào thẻ hoặc phím Space để lật xem nghĩa tiếng Việt)
                        </p>
                      </>
                    )
                  ) : (
                    /* BACK SIDE */
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playDictionaryAudio(currentItem.word, {
                              customAudioUrl: currentItem.audioUrl,
                              volumePercent,
                            });
                          }}
                          className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                          {currentItem.word}
                        </h3>
                        {currentItem.phonetic && (
                          <span className="text-xs font-mono text-slate-500">
                            {currentItem.phonetic}
                          </span>
                        )}
                      </div>
                      <div className="text-lg font-bold text-violet-700">
                        {currentItem.meaningVi}
                      </div>
                      {currentItem.exampleEn && (
                        <div className="text-xs sm:text-sm text-slate-700 italic max-w-xl">
                          &ldquo;{currentItem.exampleEn}&rdquo;
                          {currentItem.exampleVi && (
                            <div className="text-slate-500 not-italic mt-0.5">
                              → {currentItem.exampleVi}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Typing Check Box on Flashcard */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!draft.typedInput.trim()) return;
                    const isOk = isVnToEn
                      ? checkEnglishAnswer(draft.typedInput, currentItem)
                      : checkVietnameseAnswer(draft.typedInput, currentItem);
                    setFlashcardDrafts((prev) => ({
                      ...prev,
                      [currentItem.wordKey]: {
                        ...draft,
                        typedChecked: true,
                        typedIsCorrect: isOk,
                      },
                    }));
                  }}
                  className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
                >
                  <input
                    type="text"
                    value={draft.typedInput}
                    onChange={(e) =>
                      setFlashcardDrafts((prev) => ({
                        ...prev,
                        [currentItem.wordKey]: {
                          ...draft,
                          typedInput: e.target.value,
                          typedChecked: false,
                          typedIsCorrect: null,
                        },
                      }))
                    }
                    placeholder={
                      isVnToEn
                        ? 'Gõ thử từ tiếng Anh để tự kiểm tra...'
                        : 'Gõ thử 1 nghĩa tiếng Việt bất kỳ để kiểm tra...'
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold transition"
                  >
                    Kiểm tra
                  </button>
                </form>

                {draft.typedChecked && (
                  <div
                    className={`p-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                      draft.typedIsCorrect
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {draft.typedIsCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Chính xác! Nội dung bạn gõ khớp với đáp án của thẻ.</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Chưa khớp hoàn toàn — hãy lật thẻ sang mặt sau để đối chiếu đáp án.
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Self-Rating & Navigation Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold disabled:opacity-40"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Trước
                    </button>
                    <button
                      type="button"
                      disabled={currentIndex + 1 >= sessionItems.length}
                      onClick={() =>
                        setCurrentIndex((i) => Math.min(sessionItems.length - 1, i + 1))
                      }
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold disabled:opacity-40"
                    >
                      Tiếp
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRateFlashcard('forgot')}
                      className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold border transition ${
                        draft.rating === 'forgot'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      Quên
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRateFlashcard('known')}
                      className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold border transition ${
                        draft.rating === 'known'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      Thuộc (+5 điểm)
                    </button>
                    <button
                      type="button"
                      onClick={handleFinishFlashcardSessionRequest}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
                    >
                      Kết thúc & Lưu
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Mode 5: GHÉP CẶP (Matching) */}
      {mode === 'match' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-xs font-extrabold">
                Vòng {matchRoundIndex + 1}/{totalMatchRounds}
              </span>
              <span className="text-xs font-semibold text-slate-600">
                Trong vòng: {matchedWordKeysInRound.size}/{matchLeftCards.length} cặp • Toàn phiên:{' '}
                {matchTotalPairsCompleted}/{sessionItems.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1 text-rose-600 font-extrabold text-xs bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={`w-4 h-4 ${
                      idx < matchHearts ? 'fill-rose-500 text-rose-500' : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsMatchTimed((t) => !t)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700"
              >
                {isMatchTimed
                  ? `Giờ vòng: ${Math.ceil(matchRoundRemainingMs / 1000)}s`
                  : 'Không đếm giờ'}
              </button>
            </div>
          </div>

          {matchRoundFinishedBanner ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-extrabold text-emerald-950">
                Hoàn thành Vòng {matchRoundIndex + 1}/{totalMatchRounds}!
              </h3>
              <p className="text-xs sm:text-sm text-emerald-800">
                Bạn đã ghép đúng toàn bộ {matchLeftCards.length} cặp từ trong vòng này.
              </p>
              <button
                type="button"
                onClick={() => {
                  const nextR = matchRoundIndex + 1;
                  setMatchRoundIndex(nextR);
                  initMatchRound(nextR);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-xs transition"
              >
                <span>Vòng tiếp ({matchRoundIndex + 2}/{totalMatchRounds})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: English Words */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Từ tiếng Anh
                </div>
                {matchLeftCards.map((card) => {
                  const isMatched = matchedWordKeysInRound.has(card.wordKey);
                  const isSelected = selectedLeftCardId === card.id;
                  const isWrong = wrongFlashPair?.leftId === card.id;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={isMatched}
                      onClick={() => handleSelectMatchCard(card)}
                      className={`w-full p-3.5 rounded-xl border-2 text-left font-bold text-sm transition flex items-center justify-between ${
                        isMatched
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 opacity-60'
                          : isWrong
                          ? 'bg-rose-100 border-rose-500 text-rose-900'
                          : isSelected
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <span>{card.text}</span>
                      {isMatched && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Vietnamese Meanings */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Nghĩa tiếng Việt
                </div>
                {matchRightCards.map((card) => {
                  const isMatched = matchedWordKeysInRound.has(card.wordKey);
                  const isSelected = selectedRightCardId === card.id;
                  const isWrong = wrongFlashPair?.rightId === card.id;

                  return (
                    <button
                      key={card.id}
                      type="button"
                      disabled={isMatched}
                      onClick={() => handleSelectMatchCard(card)}
                      className={`w-full p-3.5 rounded-xl border-2 text-left font-medium text-sm transition flex items-center justify-between ${
                        isMatched
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 opacity-60'
                          : isWrong
                          ? 'bg-rose-100 border-rose-500 text-rose-900'
                          : isSelected
                          ? 'bg-indigo-50 border-indigo-600 text-indigo-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-300'
                      }`}
                    >
                      <span>{card.text}</span>
                      {isMatched && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 7: ĐẶC BIỆT — FLAPPY BIRD TỪ VỰNG */}
      {mode === 'flappy' && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 border border-pink-400/30 text-xs font-extrabold">
                  Flappy Bird Từ Vựng (+20 điểm/câu)
                </span>
                <div className="inline-flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Heart
                      key={idx}
                      className={`w-4 h-4 ${
                        idx < flappyLives ? 'fill-rose-500 text-rose-500' : 'text-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFlappyAutoPilot((a) => !a)}
                className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                  flappyAutoPilot
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {flappyAutoPilot
                  ? 'Đang bật: Tự bay / Giảm chuyển động'
                  : 'Bật Tự bay / Giảm chuyển động'}
              </button>
            </div>

            {/* Flight Canvas Viewport */}
            <div
              onClick={() => {
                if (flappyPhase === 'intro') {
                  setFlappyPhase('flying');
                } else if (flappyPhase === 'resume-ready') {
                  flappyVelocityRef.current = 20;
                  setFlappyPhase('flying');
                } else if (flappyPhase === 'flying') {
                  flappyVelocityRef.current = -185;
                }
              }}
              className="relative w-full h-[270px] rounded-xl bg-gradient-to-b from-sky-400 via-sky-300 to-emerald-200 overflow-hidden cursor-pointer select-none border border-sky-200"
            >
              {/* Pipe Obstacle */}
              <div
                style={{ left: `${flappyPipeX}px`, height: `${flappyGapTop}px` }}
                className="absolute top-0 w-14 bg-emerald-600 border-x-2 border-b-4 border-emerald-800 rounded-b-md"
              />
              <div
                style={{
                  left: `${flappyPipeX}px`,
                  top: `${flappyGapTop + 95}px`,
                  bottom: 0,
                }}
                className="absolute w-14 bg-emerald-600 border-x-2 border-t-4 border-emerald-800 rounded-t-md"
              />

              {/* Bird */}
              <div
                style={{ top: `${flappyBirdY}px`, left: '72px' }}
                className="absolute w-9 h-9 rounded-full bg-amber-400 border-2 border-slate-900 shadow-md flex items-center justify-center font-extrabold text-slate-900 text-xs transition-transform"
              >
                🐦
              </div>

              {/* Overlays */}
              {flappyPhase === 'intro' && (
                <div className="absolute inset-0 bg-slate-900/65 flex flex-col items-center justify-center text-center p-4 space-y-3">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white">
                    Sẵn sàng bay qua ống nước từ vựng!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 max-w-md">
                    Mỗi ống nước sẽ mở 1 câu hỏi từ vựng (30s). Va chạm ống không làm mất mạng — bạn
                    chỉ mất mạng khi trả lời sai hoặc hết giờ!
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlappyPhase('flying');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-md"
                  >
                    Nhấn Space hoặc Chạm để bắt đầu bay
                  </button>
                </div>
              )}

              {flappyPhase === 'resume-ready' && (
                <div className="absolute inset-0 bg-slate-900/65 flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <div className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-extrabold text-xs">
                    Đã trả lời xong ống #{currentIndex}
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold text-white">
                    Nhấn Space / Chạm lần 1 để thả chim rơi • Nhấn lần 2 để vỗ cánh bay lên
                  </h4>
                </div>
              )}
            </div>
          </div>

          {(flappyPhase === 'question' || flappyPhase === 'feedback') && renderActiveQuestionCard()}
        </div>
      )}

      {/* Mode 8: ĐẶC BIỆT — GIẢI CỨU KHỈ (Monkey Rescue) */}
      {mode === 'monkey' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-emerald-700/40 shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold">
                  Giải cứu khỉ • {monkeySubMode === 'quiz' ? 'Quiz (Yeti 2 m/s)' : 'Gõ từ (Yeti 1 m/s)'}
                </span>
                <span className="text-xs text-emerald-200">
                  Đúng +15m (Tối đa 100m) • Sai -10m
                </span>
              </div>

              <div className="text-sm font-extrabold text-amber-300">
                Khoảng cách an toàn: {Math.round(monkeyDistanceMeters)}m / 100m
              </div>
            </div>

            {/* Chase Track Visualization */}
            <div className="relative h-16 bg-slate-950/60 rounded-2xl border border-white/15 px-6 flex items-center overflow-hidden">
              <div
                className="h-2.5 bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-100"
                style={{ width: `${Math.max(4, Math.min(100, monkeyDistanceMeters))}%` }}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl" title="Yeti">
                🦍
              </div>
              <div
                style={{
                  left: `calc(${Math.max(8, Math.min(92, monkeyDistanceMeters))}% - 14px)`,
                }}
                className="absolute top-1/2 -translate-y-1/2 text-2xl transition-all duration-100"
                title="Khỉ con"
              >
                🐒
              </div>
            </div>

            {monkeyPhase === 'intro' && (
              <div className="text-center py-2 space-y-2">
                <p className="text-xs sm:text-sm text-emerald-100">
                  Yeti đang đuổi theo với tốc độ{' '}
                  <strong>{yetiSpeedMetersPerSec} mét/giây</strong>. Hãy trả lời nhanh và chính xác
                  để giữ khoảng cách trên 0m!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMonkeyPhase('question');
                    lastTickTimeRef.current = Date.now();
                  }}
                  className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-md"
                >
                  Bắt đầu cuộc đua Giải cứu khỉ
                </button>
              </div>
            )}
          </div>

          {(monkeyPhase === 'question' || monkeyPhase === 'feedback') && renderActiveQuestionCard()}
        </div>
      )}

      {/* Standard Modes: Quiz, Dictation, Spell, Mixed (or SRS step using Quiz/Dictation/Spell) */}
      {mode !== 'match' &&
        mode !== 'flappy' &&
        mode !== 'monkey' &&
        currentStepMode !== 'flashcard' &&
        renderActiveQuestionCard()}

      {/* Mid-session Pause Modal */}
      {isPausedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-2xl text-center space-y-4">
            <Pause className="w-10 h-10 text-indigo-600 mx-auto" />
            <h3 className="text-lg font-extrabold text-slate-900">Đã tạm dừng lượt học</h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Đồng hồ đếm ngược đang được tạm dừng. Nhấn tiếp tục khi bạn đã sẵn sàng.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  lastTickTimeRef.current = Date.now();
                  setIsPausedModal(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold"
              >
                Tiếp tục học
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPausedModal(false);
                  setShowExitConfirm(true);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50"
              >
                Thoát lượt học
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flashcard Early Finish Unrated Warning Modal */}
      {showUnratedFlashcardWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Còn thẻ từ chưa được đánh giá!
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Bạn còn{' '}
                  <strong>
                    {sessionItems.filter((it) => !flashcardDrafts[it.wordKey]?.rating).length} thẻ
                  </strong>{' '}
                  chưa chọn &ldquo;Quên&rdquo; hoặc &ldquo;Thuộc&rdquo;. Các thẻ chưa đánh giá sẽ
                  được ghi nhận là chưa hoàn thành.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowUnratedFlashcardWarning(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                Quay lại đánh giá
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnratedFlashcardWarning(false);
                  setEndReason('completed');
                }}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Vẫn kết thúc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mid-session Exit Confirmation Modal (Section 18) */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">Thoát khỏi lượt học?</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Thoát khỏi lượt học? Kết quả và điểm của lượt này chưa được lưu.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  lastTickTimeRef.current = Date.now();
                  setShowExitConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                Ở lại
              </button>
              <button
                type="button"
                onClick={onExitToDeck}
                className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100"
              >
                Thoát không lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
