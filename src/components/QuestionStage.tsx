import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Maximize2,
  CheckCircle2,
  XCircle,
  Volume2,
  Sparkles,
  Languages,
  FileText,
  Flag,
  Headphones,
  PanelLeftOpen,
  PanelLeftClose,
  Columns,
  GripVertical,
  Check,
  Lock,
  Highlighter,
  Eraser,
  EyeOff,
  BookmarkPlus,
  Keyboard,
  Loader2,
  X,
} from 'lucide-react';
import { Question, StimulusCard, getPartRelativeNumber } from '../types/exam';
import { examAudioManager } from '../utils/audioManager';
import { StructuredExplanationBox } from './StructuredExplanationBox';
import { InteractiveScriptPanel, ScriptSectionItem } from './InteractiveTranscriptModal';
import { QuickSaveVocabModal, QuickSaveVocabPayload } from './QuickSaveVocabModal';
import { B1_VOCAB_LIST } from '../data/b1VocabData';
import { ExtendedVocabItem, UserVocabDeck } from '../types/vocab';
import {
  loadUserVocabState,
  enrollWordInSrsManual,
  saveUserVocabState,
} from '../services/vocabStorageService';
import {
  savePersonalDecksToCloud,
  syncUserVocabStateToCloud,
} from '../services/vocabCloudService';
import { useAuth } from '../context/AuthContext';

interface UserPassageHighlight {
  id: string;
  partKey: string;
  text: string;
  color: 'yellow' | 'green' | 'pink';
}

interface SelectionPopoverState {
  text: string;
  contextSentence: string;
  sourceLabel: string;
  x: number;
  y: number;
  placeBelow: boolean;
  meaningVi?: string;
  phonetic?: string;
  partOfSpeech?: 'n' | 'v' | 'adj' | 'adv' | 'phr';
  exampleVi?: string;
  collocations?: string;
  isLoadingMeaning?: boolean;
  isSavedSrs?: boolean;
}

interface QuestionStageProps {
  questions: Question[];
  activeQuestionId: number;
  answers: Record<number, string>;
  flagged?: Record<number, boolean>;
  mode: 'exam' | 'practice';
  isReviewMode?: boolean;
  externalScriptToggleCounter?: number;
  onAnswerChange: (questionId: number, value: string) => void;
  onToggleFlag?: (questionId: number) => void;
  onSelectQuestion: (questionId: number) => void;
  onOpenZoomModal: (card: StimulusCard) => void;
  onOpenTranscript?: (
    text: string,
    evidenceQuote?: string,
    title?: string,
    translation?: string
  ) => void;
}

export const QuestionStage: React.FC<QuestionStageProps> = ({
  questions,
  activeQuestionId,
  answers,
  flagged = {},
  mode,
  isReviewMode = false,
  externalScriptToggleCounter = 0,
  onAnswerChange,
  onToggleFlag,
  onSelectQuestion,
  onOpenZoomModal,
}) => {
  // All question boxes are expanded by default
  const [openAccordionIds, setOpenAccordionIds] = useState<Record<number, boolean>>(() => {
    const all: Record<number, boolean> = {};
    questions.forEach((q) => {
      all[q.id] = true;
    });
    return all;
  });

  const [activeHighlightQuote, setActiveHighlightQuote] = useState<string | null>(null);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<number, boolean>>({});
  const [translatedQuestions, setTranslatedQuestions] = useState<Record<number, boolean>>({});
  const [showPart1Script, setShowPart1Script] = useState<Record<number, boolean>>({});
  const canShowSolution = mode === 'practice' || isReviewMode;

  // Left-side Script & Translation Panel state (replaces popup modal)
  const [isScriptPanelOpen, setIsScriptPanelOpen] = useState<boolean>(() => isReviewMode);

  // Resizable Split-Screen Ratio (percentage width of Left Column on lg+ screens, 30% to 68%)
  const [leftPanelWidth, setLeftPanelWidth] = useState<number>(46);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Reading Passage Translation states (for Reading Part 1, 2, 3, 4)
  const [showReadingTranslation, setShowReadingTranslation] = useState<boolean>(false);
  const [liveTranslations, setLiveTranslations] = useState<Record<string, string>>({});
  const [loadingTransKey, setLoadingTransKey] = useState<string | null>(null);

  const { currentUser } = useAuth();
  const uid = currentUser?.uid || 'guest';

  // Reading Passage User Highlighter & MCQ Option Elimination (Strikethrough)
  const [highlightPenColor, setHighlightPenColor] = useState<'yellow' | 'green' | 'pink' | null>(null);
  const [userHighlights, setUserHighlights] = useState<UserPassageHighlight[]>(() => {
    try {
      const saved =
        localStorage.getItem('vstep_user_passage_highlights') ||
        sessionStorage.getItem('vstep_user_passage_highlights');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [eliminatedOptions, setEliminatedOptions] = useState<Record<number, string[]>>({});
  const [quickSavePayload, setQuickSavePayload] = useState<QuickSaveVocabPayload | null>(null);

  // Floating Text Selection Popover & Keyboard Shortcut States
  const [selectionPopover, setSelectionPopover] = useState<SelectionPopoverState | null>(null);
  const [keyboardShortcutsEnabled, setKeyboardShortcutsEnabled] = useState<boolean>(true);
  const [lastShortcutHint, setLastShortcutHint] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('vstep_user_passage_highlights', JSON.stringify(userHighlights));
    } catch {
      // Ignore
    }
  }, [userHighlights]);

  // Track active part key to automatically close transcript & translation columns when switching parts
  const activeQuestion = questions.find((q) => q.id === activeQuestionId) || questions[0];
  const currentPartKey = activeQuestion ? `${activeQuestion.section}_${activeQuestion.partNumber}` : '';
  const prevPartKeyRef = useRef<string>(currentPartKey);

  useEffect(() => {
    if (prevPartKeyRef.current !== currentPartKey) {
      prevPartKeyRef.current = currentPartKey;
      setIsScriptPanelOpen(false);
      setShowReadingTranslation(false);
      setActiveHighlightQuote(null);
      setSelectionPopover(null);
    }
  }, [currentPartKey]);

  const currentPartHighlights = useMemo(
    () => userHighlights.filter((h) => h.partKey === currentPartKey),
    [userHighlights, currentPartKey]
  );

  const addSelectionHighlight = (color: 'yellow' | 'green' | 'pink', explicitText?: string) => {
    const sel = window.getSelection();
    const rawText = explicitText || (sel ? sel.toString() : '');
    const selectedText = rawText.trim().replace(/\s+/g, ' ');
    if (selectedText.length < 2 || selectedText.length > 350) return false;

    setUserHighlights((prev) => {
      const exists = prev.some(
        (h) => h.partKey === currentPartKey && h.text.toLowerCase() === selectedText.toLowerCase()
      );
      if (exists) {
        return prev.map((h) =>
          h.partKey === currentPartKey && h.text.toLowerCase() === selectedText.toLowerCase()
            ? { ...h, color }
            : h
        );
      }
      return [
        ...prev,
        {
          id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          partKey: currentPartKey,
          text: selectedText,
          color,
        },
      ];
    });
    if (!explicitText && sel) {
      sel.removeAllRanges();
    }
    return true;
  };

  const handlePassageMouseUp = () => {
    if (highlightPenColor) {
      addSelectionHighlight(highlightPenColor);
    }
  };

  // Global Selection Listener for Floating Word/Phrase Lookup & SRS Popover
  useEffect(() => {
    const findLocalDictMatch = (rawWord: string) => {
      const lower = rawWord.toLowerCase().trim();
      const candidates = [
        lower,
        lower.replace(/(?:s|es|ed|ing|ly)$/i, ''),
        lower.replace(/ies$/i, 'y'),
      ];
      return B1_VOCAB_LIST.find((item) => candidates.includes(item.word.toLowerCase()));
    };

    const handleDocumentMouseUp = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (!targetEl) return;

      // Ignore clicks inside the floating popover itself or inside modals/inputs
      if (
        targetEl.closest('.vstep-selection-popover') ||
        targetEl.closest('button') ||
        targetEl.closest('input') ||
        targetEl.closest('textarea') ||
        targetEl.closest('select')
      ) {
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectionPopover(null);
        return;
      }

      const selectedText = sel.toString().trim().replace(/\s+/g, ' ');
      if (
        selectedText.length < 2 ||
        selectedText.length > 80 ||
        !/[a-zA-Z]/.test(selectedText)
      ) {
        setSelectionPopover(null);
        return;
      }

      let range: Range;
      try {
        range = sel.getRangeAt(0);
      } catch {
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      // Extract surrounding context sentence
      let matchedSentence = '';
      const anchorBlock =
        (sel.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? (sel.anchorNode as HTMLElement)
          : sel.anchorNode?.parentElement)?.closest('p, div, li') || null;
      if (anchorBlock && anchorBlock.textContent) {
        const blockClean = anchorBlock.textContent.replace(/^Đoạn\s+\d+\s*/i, '').trim();
        const sentences = blockClean.split(/(?<=[.?!])\s+/);
        const found = sentences.find((s) =>
          s.toLowerCase().includes(selectedText.toLowerCase())
        );
        matchedSentence = (found || blockClean).slice(0, 300);
      }

      const clampedX = Math.max(165, Math.min(window.innerWidth - 165, rect.left + rect.width / 2));
      const placeBelow = rect.top < 155;
      const posY = placeBelow ? rect.bottom + 10 : rect.top - 10;

      const sourceLabel =
        activeQuestion?.section === 'LISTENING'
          ? `Listening Part ${activeQuestion.partNumber}`
          : `Reading Part ${activeQuestion?.partNumber || 1}`;

      const localMatch = findLocalDictMatch(selectedText);
      if (localMatch) {
        setSelectionPopover({
          text: selectedText,
          contextSentence: matchedSentence || localMatch.exampleEn,
          sourceLabel,
          x: clampedX,
          y: posY,
          placeBelow,
          meaningVi: localMatch.meaningVi,
          phonetic: localMatch.phonetic,
          partOfSpeech: localMatch.partOfSpeech,
          exampleVi: localMatch.exampleVi,
          isLoadingMeaning: false,
          isSavedSrs: false,
        });
        return;
      }

      setSelectionPopover({
        text: selectedText,
        contextSentence: matchedSentence,
        sourceLabel,
        x: clampedX,
        y: posY,
        placeBelow,
        isLoadingMeaning: true,
        isSavedSrs: false,
      });

      fetch('/api/ai/quick-vocab-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: selectedText,
          contextSentence: matchedSentence,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) {
            setSelectionPopover((prev) =>
              prev && prev.text === selectedText
                ? { ...prev, isLoadingMeaning: false }
                : prev
            );
            return;
          }
          setSelectionPopover((prev) => {
            if (!prev || prev.text !== selectedText) return prev;
            const validPos = ['n', 'v', 'adj', 'adv', 'phr'].includes(data.partOfSpeech)
              ? (data.partOfSpeech as 'n' | 'v' | 'adj' | 'adv' | 'phr')
              : prev.text.includes(' ')
              ? 'phr'
              : 'n';
            return {
              ...prev,
              meaningVi: data.meaningVi || prev.meaningVi,
              phonetic: data.phonetic || prev.phonetic,
              partOfSpeech: validPos,
              exampleVi: data.exampleVi || prev.exampleVi,
              collocations: data.collocations || prev.collocations,
              isLoadingMeaning: false,
            };
          });
        })
        .catch(() => {
          setSelectionPopover((prev) =>
            prev && prev.text === selectedText ? { ...prev, isLoadingMeaning: false } : prev
          );
        });
    };

    document.addEventListener('mouseup', handleDocumentMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [activeQuestion]);

  // Direct 1-Click SRS Save from Floating Popover
  const handleDirectSaveFromPopover = () => {
    if (!selectionPopover) return;
    if (!selectionPopover.meaningVi) {
      // Open detailed modal if meaning is not yet loaded
      setQuickSavePayload({
        initialWord: selectionPopover.text,
        contextSentence: selectionPopover.contextSentence,
        sourceLabel: selectionPopover.sourceLabel,
      });
      setSelectionPopover(null);
      return;
    }

    const decksStorageKey = `langcert_personal_decks_v3_${uid}`;
    let personalDecks: UserVocabDeck[] = [];
    try {
      const raw = localStorage.getItem(decksStorageKey);
      if (raw) personalDecks = JSON.parse(raw);
    } catch {
      personalDecks = [];
    }

    const targetDeckId = `exam_saved_general_${uid}`;
    const targetDeckName = 'Từ vựng lưu từ Phòng thi & Giải thích';
    const now = Date.now();
    const newWordId = `qsave_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const cleanWord = selectionPopover.text.trim();

    const newVocabItem: ExtendedVocabItem = {
      id: newWordId,
      word: cleanWord,
      phonetic: selectionPopover.phonetic || '/.../',
      partOfSpeech:
        selectionPopover.partOfSpeech ||
        (cleanWord.includes(' ') ? 'phr' : 'n'),
      meaningVi: selectionPopover.meaningVi,
      exampleEn:
        selectionPopover.contextSentence ||
        `This term appears in ${selectionPopover.sourceLabel}.`,
      exampleVi: selectionPopover.exampleVi || selectionPopover.meaningVi,
      topic: selectionPopover.sourceLabel,
      cefr: 'B1',
      collocations: selectionPopover.collocations || undefined,
      note: `Lưu trực tiếp từ ${selectionPopover.sourceLabel}`,
      addedAt: now,
    };

    let deck = personalDecks.find((d) => d.id === targetDeckId);
    if (!deck) {
      deck = {
        id: targetDeckId,
        name: targetDeckName,
        title: targetDeckName,
        description:
          'Bộ thẻ tổng hợp các từ vựng và cấu trúc hay được bạn bôi đen lưu nhanh trong lúc luyện đề Nghe & Đọc.',
        icon: '🔖',
        isCustom: true,
        categoryType: 'exam_test',
        createdAt: now,
        updatedAt: now,
        itemCount: 1,
        items: [newVocabItem],
      };
      personalDecks = [deck, ...personalDecks];
    } else {
      const existingItems = Array.isArray(deck.items) ? deck.items : [];
      const existingIdx = existingItems.findIndex(
        (it) => it.word.trim().toLowerCase() === cleanWord.toLowerCase()
      );
      let updatedItems: ExtendedVocabItem[];
      let finalWordId = newWordId;
      if (existingIdx !== -1) {
        finalWordId = existingItems[existingIdx].id;
        updatedItems = existingItems.map((it, idx) =>
          idx === existingIdx ? { ...it, ...newVocabItem, id: finalWordId } : it
        );
      } else {
        updatedItems = [newVocabItem, ...existingItems];
      }
      deck = {
        ...deck,
        updatedAt: now,
        itemCount: updatedItems.length,
        items: updatedItems,
      };
      personalDecks = personalDecks.map((d) => (d.id === targetDeckId ? deck! : d));
      newVocabItem.id = finalWordId;
    }

    try {
      localStorage.setItem(decksStorageKey, JSON.stringify(personalDecks));
    } catch {
      // Ignore storage quota
    }

    const currentState = loadUserVocabState(uid);
    const updatedState = enrollWordInSrsManual(currentState, targetDeckId, newVocabItem.id, 1);
    saveUserVocabState(updatedState);

    if (currentUser?.uid) {
      savePersonalDecksToCloud(currentUser.uid, personalDecks).catch(() => {});
      syncUserVocabStateToCloud(currentUser.uid, updatedState).catch(() => {});
    }

    setSelectionPopover((prev) => (prev ? { ...prev, isSavedSrs: true } : null));
  };

  // VSTEP Computer-Based Exam Keyboard Shortcuts (A/B/C/D, 1/2/3/4, Left/Right Arrows, F to Flag)
  useEffect(() => {
    if (!keyboardShortcutsEnabled || Boolean(quickSavePayload)) return;

    const showHint = (msg: string) => {
      setLastShortcutHint(msg);
      window.setTimeout(() => {
        setLastShortcutHint((prev) => (prev === msg ? null : prev));
      }, 1600);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const activeEl = document.activeElement as HTMLElement | null;
      const tag = activeEl?.tagName?.toUpperCase() || '';
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        activeEl?.isContentEditable
      ) {
        return;
      }

      if (!questions || questions.length === 0) return;
      const currentIdx = Math.max(
        0,
        questions.findIndex((q) => q.id === activeQuestionId)
      );
      const currentQ = questions[currentIdx] || questions[0];

      if (e.key === 'ArrowLeft') {
        if (currentIdx > 0) {
          e.preventDefault();
          const prevQ = questions[currentIdx - 1];
          setOpenAccordionIds((prev) => ({ ...prev, [prevQ.id]: true }));
          onSelectQuestion(prevQ.id);
          const rel = getPartRelativeNumber(prevQ.id, questions);
          showHint(`← Chuyển sang Câu ${rel}`);
          window.setTimeout(() => {
            document
              .getElementById(`question-card-${prevQ.id}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 40);
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        if (currentIdx < questions.length - 1) {
          e.preventDefault();
          const nextQ = questions[currentIdx + 1];
          setOpenAccordionIds((prev) => ({ ...prev, [nextQ.id]: true }));
          onSelectQuestion(nextQ.id);
          const rel = getPartRelativeNumber(nextQ.id, questions);
          showHint(`→ Chuyển sang Câu ${rel}`);
          window.setTimeout(() => {
            document
              .getElementById(`question-card-${nextQ.id}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 40);
        }
        return;
      }

      if (e.key.toLowerCase() === 'f') {
        if (!isReviewMode && onToggleFlag && currentQ) {
          e.preventDefault();
          onToggleFlag(currentQ.id);
          const rel = getPartRelativeNumber(currentQ.id, questions);
          showHint(
            flagged[currentQ.id] ? `Đã bỏ cờ Câu ${rel}` : `⚑ Đã gắn cờ Câu ${rel}`
          );
        }
        return;
      }

      const keyMap: Record<string, string> = {
        a: 'A',
        b: 'B',
        c: 'C',
        d: 'D',
        '1': 'A',
        '2': 'B',
        '3': 'C',
        '4': 'D',
      };
      const mappedOption = keyMap[e.key.toLowerCase()];
      if (mappedOption && currentQ) {
        const currentAns = answers[currentQ.id] || '';
        const isAnswered = Boolean(currentAns && currentAns.trim().length > 0);
        const isLocked = isReviewMode || (mode === 'practice' && isAnswered);
        if (isLocked) return;

        if (currentQ.type === 'multi_text_match') {
          e.preventDefault();
          onAnswerChange(currentQ.id, mappedOption);
          const rel = getPartRelativeNumber(currentQ.id, questions);
          showHint(`Câu ${rel}: Đã chọn Text ${mappedOption}`);
          return;
        }

        if (Array.isArray(currentQ.options) && currentQ.options.length > 0) {
          const matchedOpt = currentQ.options.find(
            (o) => o.id.toUpperCase() === mappedOption
          );
          if (matchedOpt) {
            e.preventDefault();
            if (isOptionEliminated(currentQ.id, matchedOpt.id)) {
              toggleEliminateOption(currentQ.id, matchedOpt.id);
            }
            onAnswerChange(currentQ.id, matchedOpt.id);
            const rel = getPartRelativeNumber(currentQ.id, questions);
            showHint(`Câu ${rel}: Đã chọn đáp án ${matchedOpt.id}`);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    keyboardShortcutsEnabled,
    quickSavePayload,
    questions,
    activeQuestionId,
    answers,
    flagged,
    mode,
    isReviewMode,
    onAnswerChange,
    onSelectQuestion,
    onToggleFlag,
  ]);

  const removeUserHighlight = (id: string) => {
    setUserHighlights((prev) => prev.filter((h) => h.id !== id));
  };

  const clearCurrentPartHighlights = () => {
    setUserHighlights((prev) => prev.filter((h) => h.partKey !== currentPartKey));
  };

  const toggleEliminateOption = (qId: number, optId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setEliminatedOptions((prev) => {
      const list = prev[qId] || [];
      const exists = list.includes(optId);
      return {
        ...prev,
        [qId]: exists ? list.filter((id) => id !== optId) : [...list, optId],
      };
    });
  };

  const isOptionEliminated = (qId: number, optId: string): boolean => {
    return (eliminatedOptions[qId] || []).includes(optId);
  };

  // Listen to external header "Xem Script & Dịch" button clicks
  useEffect(() => {
    if (canShowSolution && externalScriptToggleCounter > 0) {
      setIsScriptPanelOpen((prev) => !prev);
    }
  }, [externalScriptToggleCounter, canShowSolution]);

  // Handle mouse drag for Resizable Split Divider
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const relX = e.clientX - rect.left;
      const pct = Math.round((relX / rect.width) * 100);
      const clamped = Math.max(30, Math.min(68, pct));
      setLeftPanelWidth(clamped);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleHighlightQuote = (quote: string) => {
    setActiveHighlightQuote(quote);
    setIsScriptPanelOpen(true);
    setTimeout(() => {
      const el = document.getElementById('active-evidence-mark');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  useEffect(() => {
    if (questions.length > 0) {
      setOpenAccordionIds((prev) => {
        const next = { ...prev };
        questions.forEach((q) => {
          if (next[q.id] === undefined) {
            next[q.id] = true;
          }
        });
        return next;
      });
    }
  }, [questions]);

  const toggleAccordion = (qId: number) => {
    setOpenAccordionIds((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
    onSelectQuestion(qId);
  };

  const isChecked = (q: Question, optionId: string) => {
    return answers[q.id] === optionId;
  };

  const isCorrect = (q: Question) => {
    const userVal = (answers[q.id] || '').trim().toLowerCase();
    if (!userVal) return false;
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer.some((ans) => userVal === ans.trim().toLowerCase());
    }
    return userVal === q.correctAnswer.trim().toLowerCase();
  };

  const fetchLiveTranslation = async (key: string, text: string, contextLabel: string) => {
    if (!text.trim() || liveTranslations[key]) return;
    try {
      setLoadingTransKey(key);
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          context: contextLabel,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          setLiveTranslations((prev) => ({ ...prev, [key]: data.translation }));
        }
      }
    } catch (err) {
      console.error('Translation fetch error:', err);
    } finally {
      setLoadingTransKey(null);
    }
  };

  // Build ScriptSectionItem[] for the Left Script & Translation Panel (for Listening Parts 2 & 3)
  const scriptSections = useMemo((): ScriptSectionItem[] => {
    if (!questions || questions.length === 0) return [];
    const items: ScriptSectionItem[] = [];
    questions.forEach((q) => {
      if (q.section === 'LISTENING' && q.partNumber === 1) return;
      if (q.section === 'READING') return;

      // In practice mode, only unlock script section for questions the student has already answered
      if (mode === 'practice' && !(answers[q.id] && answers[q.id].trim().length > 0)) {
        return;
      }

      const relNum = getPartRelativeNumber(q.id, questions);
      if (q.section === 'LISTENING') {
        let label = `Câu ${relNum}`;
        if (q.partNumber === 2) {
          if (q.id >= 9 && q.id <= 12) label = `Hội thoại 1 (Câu 9–12)`;
          else if (q.id >= 13 && q.id <= 16) label = `Hội thoại 2 (Câu 13–16)`;
          else if (q.id >= 17 && q.id <= 20) label = `Hội thoại 3 (Câu 17–20)`;
        } else if (q.partNumber === 3) {
          if (q.id >= 21 && q.id <= 25) label = `Bài nói 1 (Câu 21–25)`;
          else if (q.id >= 26 && q.id <= 30) label = `Bài nói 2 (Câu 26–30)`;
          else if (q.id >= 31 && q.id <= 35) label = `Bài giảng 3 (Câu 31–35)`;
        }
        const script = q.audioScript || '';
        if (script.trim().length > 0) {
          items.push({
            questionId: q.id,
            questionLabel: label,
            prompt: q.notesData?.label || q.prompt,
            englishScript: script,
            vietnameseTranslation: q.audioScriptTranslation,
            evidenceQuote: q.evidenceQuote,
          });
        }
      }
    });
    return items;
  }, [questions, answers, mode]);

  if (!questions || questions.length === 0) {
    return null;
  }

  const firstQ = questions[0];

  const handleOpenEvidence = (q: Question) => {
    onSelectQuestion(q.id);
    if (q.evidenceQuote) {
      handleHighlightQuote(q.evidenceQuote);
    } else {
      setIsScriptPanelOpen(true);
    }
  };

  const renderWidthPresetToolbar = () => (
    <div className="hidden lg:inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
      <Columns className="h-3.5 w-3.5 text-slate-400 ml-1.5 mr-1" />
      {[38, 48, 58].map((w) => {
        const label = w === 38 ? '40%' : w === 48 ? '50%' : '60%';
        const active = Math.abs(leftPanelWidth - w) <= 5;
        return (
          <button
            key={w}
            type="button"
            onClick={() => setLeftPanelWidth(w)}
            className={`rounded-lg px-2 py-1 text-[10px] font-black transition-all cursor-pointer ${
              active
                ? 'bg-[#58CC02] text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={`Chỉnh độ rộng cột bên trái ${label}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  const renderResizerHandle = () => (
    <div
      onMouseDown={startResizing}
      title="Kéo sang trái/phải để thu phóng tỉ lệ 2 cột"
      className="hidden lg:flex w-3 shrink-0 cursor-col-resize items-center justify-center group select-none"
    >
      <div className="h-24 w-1.5 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-[#58CC02] group-active:bg-[#46a302] transition-colors flex items-center justify-center">
        <GripVertical className="h-3.5 w-3.5 text-slate-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );

  const renderHighlightToolbar = () => {
    const colors: Array<{
      id: 'yellow' | 'green' | 'pink';
      label: string;
      dotClass: string;
      activeClass: string;
    }> = [
      {
        id: 'yellow',
        label: 'Tô vàng',
        dotClass: 'bg-yellow-300 border-yellow-500',
        activeClass: 'bg-yellow-100 dark:bg-yellow-950/80 border-yellow-400 text-amber-900 dark:text-yellow-200',
      },
      {
        id: 'green',
        label: 'Tô xanh',
        dotClass: 'bg-lime-400 border-lime-600',
        activeClass: 'bg-lime-100 dark:bg-lime-950/80 border-[#58CC02] text-[#2B6600] dark:text-lime-200',
      },
      {
        id: 'pink',
        label: 'Tô hồng',
        dotClass: 'bg-pink-300 border-pink-500',
        activeClass: 'bg-pink-100 dark:bg-pink-950/80 border-pink-400 text-pink-900 dark:text-pink-200',
      },
    ];

    return (
      <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
        <span
          className="inline-flex items-center gap-1 px-1.5 text-[10px] font-black text-slate-600 dark:text-slate-300 select-none"
          title="Chọn màu bút rồi bôi đen văn bản trong bài đọc để tô sáng (Highlight)"
        >
          <Highlighter className="h-3.5 w-3.5 text-amber-500" />
          <span className="hidden sm:inline">Bút tô:</span>
        </span>
        {colors.map((c) => {
          const isActive = highlightPenColor === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                // Prevent losing current text selection when clicking color button
                e.preventDefault();
                if (!addSelectionHighlight(c.id)) {
                  setHighlightPenColor((prev) => (prev === c.id ? null : c.id));
                } else {
                  setHighlightPenColor(c.id);
                }
              }}
              title={`${c.label} (Bôi đen từ khóa trong bài đọc để tô sáng)`}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black border transition-all cursor-pointer ${
                isActive
                  ? c.activeClass
                  : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full border ${c.dotClass}`} />
              <span className="hidden xl:inline">{c.label}</span>
            </button>
          );
        })}
        {currentPartHighlights.length > 0 && (
          <button
            type="button"
            onClick={clearCurrentPartHighlights}
            title="Xóa toàn bộ vết tô sáng trong bài đọc này"
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-black text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
          >
            <Eraser className="h-3 w-3" />
            <span>Xóa ({currentPartHighlights.length})</span>
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            const selText = window.getSelection()?.toString().trim().replace(/\s+/g, ' ') || '';
            const firstQWithArticle = questions.find((q) => q.readingArticle);
            const rawParagraphs = firstQWithArticle?.readingArticle?.paragraphs || [];
            let matchedSentence = '';
            if (selText.length >= 2) {
              for (const para of rawParagraphs) {
                const cleanPara = para.replace(/<\/?(?:u|b|strong|mark)>/gi, '');
                if (cleanPara.toLowerCase().includes(selText.toLowerCase())) {
                  const sentences = cleanPara.split(/(?<=[.?!])\s+/);
                  const found = sentences.find((s) =>
                    s.toLowerCase().includes(selText.toLowerCase())
                  );
                  matchedSentence = (found || cleanPara).slice(0, 320);
                  break;
                }
              }
            }
            setQuickSavePayload({
              initialWord: selText.length >= 2 && selText.length <= 75 ? selText : '',
              contextSentence: matchedSentence,
              sourceLabel: `Reading Passage ${activeQuestion?.partNumber || 1}`,
            });
          }}
          title="Bôi đen từ mới trong bài đọc rồi bấm để lưu nhanh vào Kho Flashcard SRS"
          className="inline-flex items-center gap-1 rounded-lg bg-[#F3E5FF] dark:bg-purple-950/80 border border-[#CE82FF] px-2 py-0.5 text-[10px] font-black text-[#A560E8] dark:text-purple-300 hover:bg-purple-200 transition-colors cursor-pointer"
        >
          <BookmarkPlus className="h-3 w-3" />
          <span>+ Lưu SRS</span>
        </button>
      </div>
    );
  };

  const renderFloatingSelectionPopover = () => (
    <>
      <QuickSaveVocabModal
        isOpen={Boolean(quickSavePayload)}
        onClose={() => setQuickSavePayload(null)}
        payload={quickSavePayload}
      />

      {selectionPopover && (
        <div
          style={{
            left: `${selectionPopover.x}px`,
            top: `${selectionPopover.y}px`,
            transform: selectionPopover.placeBelow
              ? 'translate(-50%, 0)'
              : 'translate(-50%, -100%)',
          }}
          className="vstep-selection-popover fixed z-50 w-[330px] max-w-[92vw] rounded-2xl border-2 border-slate-800 dark:border-slate-600 bg-slate-900/95 dark:bg-slate-900 text-white p-3 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Top Action Row: Selected Word, Pronounce, Highlight Colors & SRS Save */}
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-700/80">
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => examAudioManager.speakText(selectionPopover.text)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white transition-colors cursor-pointer"
                title="Nghe phát âm chuẩn"
              >
                <Volume2 className="h-3.5 w-3.5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs text-white truncate">
                    {selectionPopover.text}
                  </span>
                  {selectionPopover.partOfSpeech && (
                    <span className="rounded bg-slate-700 px-1.5 py-0.2 text-[10px] font-mono font-bold text-lime-300 shrink-0">
                      {selectionPopover.partOfSpeech}
                    </span>
                  )}
                </div>
                {selectionPopover.phonetic && (
                  <span className="block text-[10px] font-mono text-slate-300 truncate">
                    {selectionPopover.phonetic}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* 3 Quick Highlight Color Dots */}
              {(
                [
                  { id: 'yellow', cls: 'bg-yellow-300 border-yellow-500', label: 'Tô vàng' },
                  { id: 'green', cls: 'bg-lime-400 border-lime-600', label: 'Tô xanh' },
                  { id: 'pink', cls: 'bg-pink-300 border-pink-500', label: 'Tô hồng' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => addSelectionHighlight(c.id, selectionPopover.text)}
                  title={`${c.label} cụm từ này`}
                  className={`h-5 w-5 rounded-full border-2 ${c.cls} hover:scale-110 transition-transform cursor-pointer`}
                />
              ))}

              <button
                type="button"
                onClick={() => setSelectionPopover(null)}
                className="ml-1 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                title="Đóng"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Middle Row: Instant Dictionary / Contextual AI Translation */}
          <div className="py-2 text-xs">
            {selectionPopover.isLoadingMeaning ? (
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#58CC02]" />
                <span>Đang dịch nghĩa theo ngữ cảnh bài đọc...</span>
              </div>
            ) : selectionPopover.meaningVi ? (
              <div className="space-y-1">
                <p className="font-bold text-lime-300 leading-snug">
                  {selectionPopover.meaningVi}
                </p>
                {selectionPopover.exampleVi && (
                  <p className="text-[11px] text-slate-300 italic line-clamp-2">
                    “{selectionPopover.exampleVi}”
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-300">
                Bấm <strong>Lưu vào Sổ từ SRS</strong> để AI phân tích chi tiết từ vựng này.
              </p>
            )}
          </div>

          {/* Bottom Row: 1-Click Direct SRS Save + Open Full Modal */}
          <div className="pt-1.5 border-t border-slate-700/80 flex items-center justify-between gap-2">
            {selectionPopover.isSavedSrs ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#58CC02]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Đã lưu vào Sổ từ SRS!</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleDirectSaveFromPopover}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#A560E8] hover:bg-[#8B3FD9] px-3 py-1.5 text-[11px] font-black text-white transition-colors cursor-pointer"
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                <span>+ Lưu nhanh vào SRS</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setQuickSavePayload({
                  initialWord: selectionPopover.text,
                  contextSentence: selectionPopover.contextSentence,
                  sourceLabel: selectionPopover.sourceLabel,
                });
                setSelectionPopover(null);
              }}
              className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 transition-colors cursor-pointer"
            >
              Chi tiết
            </button>
          </div>
        </div>
      )}
    </>
  );

  const renderKeyboardShortcutsBar = () => (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-100/90 dark:bg-slate-800/70 px-3.5 py-2 border border-slate-200/80 dark:border-slate-700/80 text-[11px]">
      <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300 font-bold">
        <span className="inline-flex items-center gap-1 font-black text-slate-800 dark:text-slate-100">
          <Keyboard className="h-3.5 w-3.5 text-[#58CC02]" />
          <span>Phím tắt phòng thi:</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black border border-slate-300 dark:border-slate-700 shadow-2xs">
            A–D
          </kbd>
          <span>hoặc</span>
          <kbd className="rounded bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black border border-slate-300 dark:border-slate-700 shadow-2xs">
            1–4
          </kbd>
          <span>Chọn đáp án</span>
        </span>
        <span className="text-slate-300 dark:text-slate-600">·</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black border border-slate-300 dark:border-slate-700 shadow-2xs">
            ←
          </kbd>
          <kbd className="rounded bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black border border-slate-300 dark:border-slate-700 shadow-2xs">
            →
          </kbd>
          <span>Chuyển câu</span>
        </span>
        {!isReviewMode && (
          <>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded bg-white dark:bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-black border border-slate-300 dark:border-slate-700 shadow-2xs">
                F
              </kbd>
              <span>Gắn cờ</span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {lastShortcutHint && (
          <span className="rounded-lg bg-[#58CC02] px-2 py-0.5 text-[10px] font-black text-white animate-in fade-in duration-150">
            {lastShortcutHint}
          </span>
        )}
        <button
          type="button"
          onClick={() => setKeyboardShortcutsEnabled((prev) => !prev)}
          className={`rounded-lg px-2 py-0.5 text-[10px] font-black border transition-colors cursor-pointer ${
            keyboardShortcutsEnabled
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
          }`}
        >
          {keyboardShortcutsEnabled ? 'Phím tắt: BẬT' : 'Phím tắt: TẮT'}
        </button>
      </div>
    </div>
  );

  const renderEliminateOptionButton = (qId: number, optId: string, disabled = false) => {
    if (disabled || isReviewMode) return null;
    const eliminated = isOptionEliminated(qId, optId);
    return (
      <span
        role="button"
        tabIndex={-1}
        onClick={(e) => toggleEliminateOption(qId, optId, e)}
        title={
          eliminated
            ? 'Khôi phục phương án này (Hoặc nhấn chuột phải)'
            : 'Gạch loại trừ phương án nhiễu (Hoặc nhấn chuột phải)'
        }
        className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black border transition-all shrink-0 ${
          eliminated
            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
            : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 hover:text-rose-600 hover:border-rose-300 border-transparent'
        }`}
      >
        <EyeOff className="h-3 w-3" />
        <span className="hidden sm:inline">{eliminated ? 'Bỏ gạch' : 'Loại trừ'}</span>
      </span>
    );
  };

  const renderFlagButton = (qId: number, stopProp = false) => {
    if (!onToggleFlag || isReviewMode) return null;
    const isFlagged = !!flagged[qId];
    return (
      <button
        type="button"
        onClick={(e) => {
          if (stopProp) e.stopPropagation();
          onToggleFlag(qId);
        }}
        title={
          isFlagged
            ? 'Bỏ gắn cờ câu hỏi này (Phím tắt: F)'
            : 'Gắn cờ câu hỏi cần xem lại sau (Phím tắt: F)'
        }
        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-black border-2 border-b-3 active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
          isFlagged
            ? 'bg-[#FFF3D6] dark:bg-amber-950/80 text-[#D97706] dark:text-amber-300 border-[#FFC800] border-b-[#E5B400] shadow-2xs'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-900 hover:border-[#FFC800] hover:text-[#D97706]'
        }`}
      >
        <Flag className={`h-3.5 w-3.5 ${isFlagged ? 'fill-[#FF9600] text-[#FF9600]' : ''}`} />
        <span>{isFlagged ? 'Đã gắn cờ' : 'Gắn cờ'}</span>
      </button>
    );
  };

  // Parse inline VSTEP rich-text formatting: <u><b>...</b></u>, <u>...</u>, <mark>...</mark>, <b>...</b>, __...__, and [A]..[D]
  const renderRichFormattedTokens = (rawSegment: string, keyPrefix = 'rt'): React.ReactNode => {
    if (!rawSegment) return null;
    const tokenRegex =
      /(<u>\s*<b>[\s\S]*?<\/b>\s*<\/u>|<b>\s*<u>[\s\S]*?<\/u>\s*<\/b>|<u>[\s\S]*?<\/u>|<mark>[\s\S]*?<\/mark>|<b>[\s\S]*?<\/b>|<strong>[\s\S]*?<\/strong>|__[^_]+__|\[[A-D]\])/gi;
    const parts = rawSegment.split(tokenRegex);
    return parts.map((part, idx) => {
      if (!part) return null;
      const lower = part.toLowerCase();
      if (
        (lower.startsWith('<u>') && lower.includes('<b>')) ||
        (lower.startsWith('<b>') && lower.includes('<u>'))
      ) {
        const inner = part.replace(/<\/?(?:u|b)>/gi, '');
        return (
          <span
            key={`${keyPrefix}-${idx}`}
            className="underline decoration-2 decoration-[#58CC02] underline-offset-4 font-black text-slate-950 dark:text-white bg-lime-100/80 dark:bg-lime-950/70 px-1 py-0.5 rounded-md"
          >
            {inner}
          </span>
        );
      }
      if (lower.startsWith('<u>') && lower.endsWith('</u>')) {
        const inner = part.replace(/<\/?u>/gi, '');
        return (
          <span
            key={`${keyPrefix}-${idx}`}
            className="underline decoration-2 decoration-[#58CC02] underline-offset-4 font-extrabold text-slate-900 dark:text-white"
          >
            {inner}
          </span>
        );
      }
      if (part.startsWith('__') && part.endsWith('__') && part.length > 4) {
        const inner = part.slice(2, -2);
        return (
          <span
            key={`${keyPrefix}-${idx}`}
            className="underline decoration-2 decoration-[#58CC02] underline-offset-4 font-black text-slate-950 dark:text-white bg-lime-100/80 dark:bg-lime-950/70 px-1 py-0.5 rounded-md"
          >
            {inner}
          </span>
        );
      }
      if (lower.startsWith('<mark>') && lower.endsWith('</mark>')) {
        const inner = part.replace(/<\/?mark>/gi, '');
        return (
          <mark
            key={`${keyPrefix}-${idx}`}
            className="rounded-md bg-yellow-200/90 dark:bg-yellow-900/70 px-1 py-0.5 font-extrabold text-slate-900 dark:text-yellow-100"
          >
            {inner}
          </mark>
        );
      }
      if (
        (lower.startsWith('<b>') && lower.endsWith('</b>')) ||
        (lower.startsWith('<strong>') && lower.endsWith('</strong>'))
      ) {
        const inner = part.replace(/<\/?(?:b|strong)>/gi, '');
        return (
          <strong key={`${keyPrefix}-${idx}`} className="font-black text-slate-900 dark:text-white">
            {inner}
          </strong>
        );
      }
      if (/^\[[A-D]\]$/.test(part)) {
        return (
          <span
            key={`${keyPrefix}-${idx}`}
            className="inline-flex items-center justify-center rounded-md border-2 border-slate-800 dark:border-slate-200 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-1.5 py-0.5 text-xs font-mono font-black mx-0.5 shadow-2xs"
          >
            {part}
          </span>
        );
      }
      // Apply any user-created passage highlights on plain text segments
      if (currentPartHighlights.length > 0 && part.trim().length > 1) {
        let nodes: React.ReactNode[] = [part];
        currentPartHighlights.forEach((hl) => {
          const nextNodes: React.ReactNode[] = [];
          nodes.forEach((node, nIdx) => {
            if (typeof node !== 'string') {
              nextNodes.push(node);
              return;
            }
            const lowerNode = node.toLowerCase();
            const lowerTarget = hl.text.toLowerCase();
            const pos = lowerNode.indexOf(lowerTarget);
            if (pos === -1) {
              nextNodes.push(node);
              return;
            }
            const before = node.slice(0, pos);
            const match = node.slice(pos, pos + hl.text.length);
            const after = node.slice(pos + hl.text.length);
            if (before) nextNodes.push(before);
            const bgClass =
              hl.color === 'green'
                ? 'bg-lime-300/80 dark:bg-lime-800/80 text-slate-950 dark:text-lime-100'
                : hl.color === 'pink'
                ? 'bg-pink-200/90 dark:bg-pink-900/80 text-slate-950 dark:text-pink-100'
                : 'bg-yellow-200/90 dark:bg-yellow-800/80 text-slate-950 dark:text-yellow-100';
            nextNodes.push(
              <mark
                key={`${keyPrefix}-${idx}-hl-${hl.id}-${nIdx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeUserHighlight(hl.id);
                }}
                title="Bấm để xóa vết tô sáng (Highlight) này"
                className={`rounded px-0.5 cursor-pointer transition-opacity hover:opacity-75 ${bgClass}`}
              >
                {match}
              </mark>
            );
            if (after) nextNodes.push(after);
          });
          nodes = nextNodes;
        });
        return <React.Fragment key={`${keyPrefix}-${idx}`}>{nodes}</React.Fragment>;
      }
      return <React.Fragment key={`${keyPrefix}-${idx}`}>{part}</React.Fragment>;
    });
  };

  const renderHighlightedContent = (content: string) => {
    if (!content) return null;
    if (!activeHighlightQuote || !activeHighlightQuote.trim()) {
      return renderRichFormattedTokens(content, 'plain');
    }
    const target = activeHighlightQuote.trim();
    const lowerContent = content.toLowerCase();
    let index = lowerContent.indexOf(target.toLowerCase());
    let matchLen = target.length;

    if (index === -1) {
      const subTarget = target
        .replace(/<\/?(?:u|b|strong|mark)>/gi, '')
        .split(/[.?!]/)[0]
        .trim()
        .slice(0, 28);
      if (subTarget.length > 6) {
        index = lowerContent.indexOf(subTarget.toLowerCase());
        matchLen = subTarget.length;
      }
    }

    if (index === -1) {
      return renderRichFormattedTokens(content, 'no-match');
    }

    const before = content.slice(0, index);
    const matched = content.slice(index, index + matchLen);
    const after = content.slice(index + matchLen);

    return (
      <>
        {renderRichFormattedTokens(before, 'before')}
        <mark
          id="active-evidence-mark"
          className="rounded-md bg-amber-200 dark:bg-amber-900/90 text-amber-950 dark:text-amber-100 px-1.5 py-0.5 font-bold ring-2 ring-amber-400 animate-pulse inline"
        >
          {renderRichFormattedTokens(matched, 'matched')}
        </mark>
        {renderRichFormattedTokens(after, 'after')}
      </>
    );
  };

  // =========================================================================
  // RENDER VARIANT 1: Listening Part 3 - Notes Completion (Relative 1-7)
  // Supports Left-Side Resizable Script & Translation Panel
  // =========================================================================
  if (firstQ.type === 'notes') {
    const showTitle = firstQ.notesData?.showTitle || 'Notes on a Show';

    const notesContent = (
      <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-block rounded-lg bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
            Listening Part 3 · Câu 1 – {questions.length}
          </span>

          {canShowSolution && scriptSections.length > 0 && (
            <button
              type="button"
              onClick={() => setIsScriptPanelOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                isScriptPanelOpen
                  ? 'bg-slate-900 dark:bg-slate-700 text-white'
                  : 'bg-[#58CC02] hover:bg-[#46a302] text-white shadow-xs border-b-2 border-[#3c8c02]'
              }`}
            >
              {isScriptPanelOpen ? (
                <>
                  <PanelLeftClose className="h-4 w-4" />
                  <span>Ẩn cột Script & Dịch bên trái</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="h-4 w-4" />
                  <span>Mở Script & Dịch ở cột trái</span>
                </>
              )}
            </button>
          )}
        </div>

        <h3 className="mb-6 text-center text-xl sm:text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
          {showTitle}
        </h3>

        <div className="mx-auto max-w-2xl space-y-5">
          {questions.map((q) => {
            const relNum = getPartRelativeNumber(q.id, questions);
            const currentVal = answers[q.id] || '';
            const answered = currentVal.trim().length > 0;
            const isLocked = isReviewMode || (mode === 'practice' && answered);
            const canShowQuestionSolution = isReviewMode || (mode === 'practice' && answered);
            const isRevealed = isReviewMode || (mode === 'practice' ? answered : !!revealedAnswers[q.id]);
            const correct = isCorrect(q);
            const isFocused = activeQuestionId === q.id;

            return (
              <div
                key={q.id}
                onClick={() => onSelectQuestion(q.id)}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  isFocused
                    ? 'border-[#58CC02] bg-lime-50/20 dark:bg-lime-950/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-lime-400 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                {q.imageUrl && (
                  <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-center">
                    <img
                      src={q.imageUrl}
                      alt={q.imageCaption || `Câu ${relNum}`}
                      onClick={() =>
                        onOpenZoomModal({
                          id: String(relNum),
                          title: showTitle,
                          content: q.notesData?.label || '',
                          imageUrl: q.imageUrl,
                          imageCaption: q.imageCaption,
                        })
                      }
                      className="mx-auto max-h-48 w-auto cursor-zoom-in rounded-lg object-contain"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 sm:w-7/12">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#2E7D32] text-xs font-mono font-black text-white">
                      {relNum}
                    </span>
                    <label
                      htmlFor={`note-input-${q.id}`}
                      className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
                    >
                      {q.notesData?.label || q.prompt}
                    </label>
                  </div>

                  <div className="flex items-center gap-2 sm:w-5/12">
                    <div className="relative flex-1">
                      <input
                        id={`note-input-${q.id}`}
                        type="text"
                        readOnly={isLocked}
                        value={currentVal}
                        onChange={(e) => !isLocked && onAnswerChange(q.id, e.target.value)}
                        onFocus={() => onSelectQuestion(q.id)}
                        placeholder="Điền tối đa 3 từ..."
                        className={`h-11 w-full rounded-xl border-2 px-3.5 text-sm font-bold transition-all focus:outline-none ${
                          isLocked ? 'cursor-not-allowed' : ''
                        } ${
                          isRevealed && canShowQuestionSolution
                            ? correct
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                              : 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                            : answered
                            ? 'border-[#58CC02] bg-lime-50/50 dark:bg-lime-950/30 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-slate-300 focus:border-[#58CC02]'
                        }`}
                      />
                      {mode === 'practice' && answered && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[10px] font-black text-slate-500 bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          <Lock className="h-3 w-3" /> Đã chốt
                        </span>
                      )}
                    </div>
                    {renderFlagButton(q.id)}
                  </div>
                </div>

                {/* Practice / Review Feedback (Revealed only AFTER student answers in Practice mode) */}
                {canShowQuestionSolution && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      {q.audioScript && (
                        <>
                          <button
                            type="button"
                            onClick={() => examAudioManager.speakText(q.audioScript!)}
                            className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 hover:text-[#58CC02] cursor-pointer"
                          >
                            <Volume2 className="h-3.5 w-3.5 text-[#58CC02]" />
                            <span>Nghe lời thoại</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEvidence(q)}
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            <PanelLeftOpen className="h-3.5 w-3.5" />
                            <span>Xem Script & Dịch cột trái</span>
                          </button>
                        </>
                      )}
                    </div>

                    {isRevealed && (
                      <div className="w-full mt-2 rounded-2xl bg-lime-50/80 dark:bg-lime-950/40 p-4 border-2 border-lime-300 dark:border-lime-800 text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
                        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          {correct ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          )}
                          <span className="text-sm font-black">
                            {correct ? 'Chính xác!' : 'Chưa đúng'} — Đáp án chuẩn:{' '}
                            <span className="text-emerald-700 dark:text-emerald-300">
                              {Array.isArray(q.correctAnswer)
                                ? q.correctAnswer.join(' / ')
                                : q.correctAnswer}
                            </span>
                          </span>
                        </div>

                        <StructuredExplanationBox
                          evidenceQuote={q.evidenceQuote}
                          audioScript={q.audioScript}
                          audioScriptTranslation={q.audioScriptTranslation}
                          vietnameseTranslation={q.vietnameseTranslation}
                          questionPrompt={q.notesData?.label || q.prompt}
                          hideInlineScript={true}
                          onOpenEvidence={() => handleOpenEvidence(q)}
                          onHighlightQuote={handleHighlightQuote}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );

    if (canShowSolution && isScriptPanelOpen && scriptSections.length > 0) {
      return (
        <div className="mx-auto max-w-[96rem] px-3 sm:px-6 py-4">
          <div
            ref={splitContainerRef}
            className="flex flex-col lg:flex-row gap-4 lg:gap-0 lg:h-[calc(100vh-148px)] items-stretch"
          >
            <div
              style={{ width: `${leftPanelWidth}%` }}
              className="w-full lg:h-full max-lg:!w-full shrink-0"
            >
              <InteractiveScriptPanel
                title={`Audio Script & Dịch · Listening Part 3`}
                subtitle={showTitle}
                sections={scriptSections}
                activeQuestionId={activeQuestionId}
                highlightQuote={activeHighlightQuote}
                widthPercent={leftPanelWidth}
                onWidthPresetChange={setLeftPanelWidth}
                onSelectQuestion={onSelectQuestion}
                onClose={() => setIsScriptPanelOpen(false)}
              />
            </div>

            {renderResizerHandle()}

            <div className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto">
              {notesContent}
            </div>
          </div>
          {renderFloatingSelectionPopover()}
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        {notesContent}
        {renderFloatingSelectionPopover()}
      </div>
    );
  }

  // =========================================================================
  // RENDER VARIANT 2: Reading Part 2 - Gapped Text Article (Questions 32-37 -> Relative 1-6)
  // Resizable 2-Column Split-Screen with Inline Translation
  // =========================================================================
  if (firstQ.type === 'gapped_text' && firstQ.gappedArticle) {
    const article = firstQ.gappedArticle;
    const options = firstQ.gappedOptions || [];
    const pretranslatedPart2 = firstQ.gappedArticleTranslation;

    const handleTogglePart2Translations = () => {
      const next = !showReadingTranslation;
      setShowReadingTranslation(next);
      if (next) {
        const hasOptionsTrans =
          options.some((o) => !!o.vietnameseTranslation) || !!pretranslatedPart2?.optionsTranslation;
        if (!hasOptionsTrans) {
          const allOptionsText = options.map((o) => `${o.id}. ${o.text}`).join('\n');
          fetchLiveTranslation(
            'r2-options',
            allOptionsText,
            'Dịch 7 câu lựa chọn A đến G trong Reading Part 2 sang tiếng Việt'
          );
        }

        const hasArticleTrans = !!pretranslatedPart2?.fullText || !!article.vietnameseTranslation;
        if (!hasArticleTrans) {
          const fullArticleText = article.paragraphs
            .map((p) => (p.gapId ? `[Ô trống Câu ${getPartRelativeNumber(p.gapId)}]` : p.text))
            .join('\n\n');
          fetchLiveTranslation(
            'r2-article',
            fullArticleText,
            'Dịch bài báo Reading Part 2 sang tiếng Việt, giữ nguyên nhãn [Ô trống Câu X]'
          );
        }
      }
    };

    return (
      <div className="mx-auto max-w-[96rem] px-3 sm:px-6 py-4">
        <div
          ref={splitContainerRef}
          className="flex flex-col lg:flex-row gap-4 lg:gap-0 lg:h-[calc(100vh-148px)] items-stretch"
        >
          {/* Left Column: Sentence Options A-G */}
          <div
            style={{ width: `${leftPanelWidth}%` }}
            className="w-full max-lg:!w-full lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shrink-0"
          >
            {/* Solid Top Header */}
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#65A30D] dark:text-[#78E014] flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Các câu lựa chọn (A – G)
              </h4>

              <div className="flex items-center gap-2">
                {canShowSolution && (
                  <button
                    type="button"
                    onClick={handleTogglePart2Translations}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-black transition-all cursor-pointer ${
                      showReadingTranslation
                        ? 'bg-[#58CC02] text-white shadow-2xs'
                        : 'bg-lime-50 dark:bg-slate-800 text-[#2E7D32] dark:text-[#78E014] border border-lime-300 dark:border-slate-700'
                    }`}
                  >
                    <Languages className="h-3.5 w-3.5" />
                    <span>{showReadingTranslation ? 'Ẩn dịch bài đọc' : 'Dịch câu A–G & Bài đọc'}</span>
                  </button>
                )}
                {renderWidthPresetToolbar()}
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 lg:overflow-y-auto p-5 sm:p-6 space-y-2.5">
              {options.map((opt) => {
                const usedGaps = questions.filter((q) => answers[q.id] === opt.id);
                const usedRelNums = usedGaps.map((q) => getPartRelativeNumber(q.id));
                const isUsed = usedRelNums.length > 0;

                return (
                  <div
                    key={opt.id}
                    className={`rounded-2xl border-2 p-3.5 text-xs sm:text-sm font-medium transition-all flex items-start gap-3 ${
                      isUsed
                        ? 'border-lime-400 bg-lime-50/70 dark:bg-lime-950/30 text-slate-900 dark:text-slate-100'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 hover:border-lime-300'
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#65A30D] text-xs font-black text-white shadow-2xs">
                      {opt.id}
                    </span>
                    <div className="flex-1">
                      <span>{opt.text}</span>
                      {canShowSolution && showReadingTranslation && opt.vietnameseTranslation && (
                        <div className="mt-1.5 text-xs text-emerald-800 dark:text-emerald-300 font-semibold italic border-t border-emerald-100 dark:border-emerald-900/60 pt-1.5">
                          “{opt.vietnameseTranslation}”
                        </div>
                      )}
                      {isUsed && (
                        <span className="ml-2 inline-block rounded-md bg-lime-200 dark:bg-lime-800 px-2 py-0.5 text-[10px] font-black text-lime-900 dark:text-lime-200">
                          Đã điền câu {usedRelNums.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {canShowSolution && showReadingTranslation && (
                <div className="mt-4 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 text-xs text-emerald-950 dark:text-emerald-100 space-y-2">
                  <div className="font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Languages className="h-4 w-4" />
                    <span>Bản dịch các câu lựa chọn A – G:</span>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed font-medium">
                    {pretranslatedPart2?.optionsTranslation ||
                      (options.some((o) => !!o.vietnameseTranslation)
                        ? options
                            .map((o) => `${o.id}. ${o.vietnameseTranslation || o.text}`)
                            .join('\n')
                        : loadingTransKey === 'r2-options'
                        ? 'Đang dịch các câu A – G...'
                        : liveTranslations['r2-options'] || 'Đang tải bản dịch...')}
                  </p>
                </div>
              )}
            </div>
          </div>

          {renderResizerHandle()}

          {/* Right Column: Article with Inline Compact Dropdowns */}
          <div className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            {/* Solid Top Header */}
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-6 sm:px-8 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Reading Part 2 · Điền câu vào ô trống (Câu 1 – {questions.length})
              </span>
              {renderHighlightToolbar()}
            </div>

            {/* Scrollable Body */}
            <div
              onMouseUp={handlePassageMouseUp}
              className="flex-1 lg:overflow-y-auto p-6 sm:p-8 select-text"
            >
              <h3 className="mb-4 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {article.title}
              </h3>
              {canShowSolution && showReadingTranslation && pretranslatedPart2?.title && (
                <p className="-mt-2 mb-4 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  {pretranslatedPart2.title}
                </p>
              )}

              {article.imageUrl && (
                <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-center">
                  <img
                    src={article.imageUrl}
                    alt={article.imageCaption || article.title}
                    onClick={() =>
                      onOpenZoomModal({
                        id: 'Part2',
                        title: article.title,
                        content: '',
                        imageUrl: article.imageUrl,
                        imageCaption: article.imageCaption,
                      })
                    }
                    className="mx-auto max-h-60 w-auto cursor-zoom-in rounded-xl object-contain"
                  />
                  {article.imageCaption && (
                    <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                      {article.imageCaption}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-4 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
                {article.paragraphs.map((p, idx) => {
                  if (p.gapId) {
                    const targetQ = questions.find((q) => q.id === p.gapId);
                    if (!targetQ) return null;

                    const relNum = getPartRelativeNumber(targetQ.id);
                    const currentVal = answers[targetQ.id] || '';
                    const isTargetAnswered = currentVal.trim().length > 0;
                    const isTargetLocked = isReviewMode || (mode === 'practice' && isTargetAnswered);
                    const canShowTargetSolution = isReviewMode || (mode === 'practice' && isTargetAnswered);
                    const isRevealed = isReviewMode || (mode === 'practice' ? isTargetAnswered : !!revealedAnswers[targetQ.id]);
                    const correct = isCorrect(targetQ);
                    const isFocused = activeQuestionId === targetQ.id;

                    return (
                      <span
                        key={idx}
                        onClick={() => onSelectQuestion(targetQ.id)}
                        className="inline-block align-middle my-1.5 mr-1.5"
                      >
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 border-2 transition-all ${
                            isFocused
                              ? 'bg-lime-100 dark:bg-lime-950/60 border-[#58CC02] ring-2 ring-lime-300 dark:ring-lime-800 shadow-xs'
                              : 'bg-lime-50/90 dark:bg-lime-950/30 border-lime-300 dark:border-lime-800 hover:border-[#58CC02]'
                          }`}
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#65A30D] font-mono text-xs font-black text-white">
                            {relNum}
                          </span>

                          <div className="relative inline-flex items-center">
                            <select
                              disabled={isTargetLocked}
                              value={currentVal}
                              onChange={(e) => !isTargetLocked && onAnswerChange(targetQ.id, e.target.value)}
                              onFocus={() => onSelectQuestion(targetQ.id)}
                              aria-label={`Câu ${relNum}`}
                              className={`h-8 w-14 appearance-none rounded-lg border-2 pl-2.5 pr-6 text-center font-mono text-sm font-black bg-white dark:bg-slate-900 transition-colors focus:outline-none ${
                                isTargetLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                isRevealed && canShowTargetSolution
                                  ? correct
                                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50'
                                    : 'border-rose-400 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50'
                                  : currentVal
                                  ? 'border-[#58CC02] text-slate-900 dark:text-white'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 focus:border-[#58CC02]'
                              }`}
                            >
                              <option value="">▾</option>
                              {options.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.id}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-slate-500" />
                          </div>

                          {mode === 'practice' && isTargetAnswered && (
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                correct
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                              }`}
                            >
                              <Lock className="h-2.5 w-2.5" />
                              {correct ? 'Đúng' : `Sai (Đ/A: ${targetQ.correctAnswer})`}
                            </span>
                          )}

                          {renderFlagButton(targetQ.id, true)}

                          {isReviewMode && (
                            <span
                              className={`text-xs font-black px-1.5 py-0.5 rounded-md ${
                                correct
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200'
                              }`}
                            >
                              {correct ? '✓' : `✗ (Đ/A: ${targetQ.correctAnswer})`}
                            </span>
                          )}
                        </span>

                        {canShowTargetSolution && isRevealed && (
                          <div className="mt-2.5 mb-3 space-y-2 text-left block w-full max-w-2xl animate-in fade-in duration-150">
                            {/* Evidence Quote Button: correlates with Left Column Options A-G */}
                            {targetQ.evidenceQuote && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleHighlightQuote(targetQ.evidenceQuote!);
                                  handleOpenEvidence(targetQ);
                                }}
                                className="w-full inline-flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 dark:hover:bg-amber-900/80 p-3 text-xs font-black text-amber-950 dark:text-amber-100 border-2 border-amber-300 dark:border-amber-700 shadow-2xs transition-all cursor-pointer text-left"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <Sparkles className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
                                  <span className="truncate sm:whitespace-normal">
                                    Từ khóa / Bằng chứng:{' '}
                                    <span className="font-semibold italic">"{targetQ.evidenceQuote}"</span>
                                  </span>
                                </span>
                                <span className="shrink-0 rounded-lg bg-amber-900 dark:bg-amber-100 text-white dark:text-amber-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                  Đối chiếu câu A–G cột trái
                                </span>
                              </button>
                            )}

                            {/* Vietnamese Translation of Preceding Paragraph */}
                            <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-950 dark:text-emerald-100 shadow-2xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2 font-black text-emerald-800 dark:text-emerald-300 text-[11px] uppercase tracking-wider">
                                <span className="flex items-center gap-1.5">
                                  <Languages className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>Bản dịch đoạn văn phía trước ô trống {relNum}:</span>
                                </span>
                              </div>
                              <p className="leading-relaxed font-semibold whitespace-pre-line text-slate-800 dark:text-slate-100">
                                {targetQ.vietnameseTranslation ||
                                  (idx > 0 && article.paragraphs[idx - 1]?.text
                                    ? article.paragraphs[idx - 1].text
                                    : 'Đoạn văn mở đầu bài đọc.')}
                              </p>
                            </div>
                          </div>
                        )}
                      </span>
                    );
                  }
                  return (
                    <p key={idx} className="leading-relaxed">
                      {renderHighlightedContent(p.text)}
                    </p>
                  );
                })}
              </div>

              {canShowSolution && showReadingTranslation && (
                <div className="mt-6 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 p-5 text-xs sm:text-sm text-emerald-950 dark:text-emerald-100 space-y-2">
                  <div className="font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Languages className="h-4 w-4" />
                    <span>Bản dịch tiếng Việt toàn bài đọc (Reading Part 2):</span>
                  </div>
                  <p className="whitespace-pre-line leading-relaxed font-medium">
                    {pretranslatedPart2?.fullText ||
                      article.vietnameseTranslation ||
                      (loadingTransKey === 'r2-article'
                        ? 'Đang dịch bài đọc...'
                        : liveTranslations['r2-article'] || 'Đang tải bản dịch...')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        {renderFloatingSelectionPopover()}
      </div>
    );
  }

  // =========================================================================
  // RENDER VARIANT 3: Reading Part 3 - 4 Texts Matching A-D (Relative 1-7)
  // Resizable 2-Column Split-Screen with Per-Card Translation
  // =========================================================================
  if (firstQ.type === 'multi_text_match' && firstQ.multiTextCards) {
    const cards = firstQ.multiTextCards;

    const handleTogglePart3Translation = () => {
      const next = !showReadingTranslation;
      setShowReadingTranslation(next);
      if (next) {
        cards.forEach((c) => {
          // If pre-translated text is already in JSON, do not call AI endpoint
          if (!c.vietnameseTranslation) {
            fetchLiveTranslation(
              `r3-card-${c.id}`,
              `${c.title ? c.title + '\n' : ''}${c.content}`,
              `Dịch đoạn văn Text ${c.id} trong Reading Part 3 sang tiếng Việt`
            );
          }
        });
      }
    };

    return (
      <div className="mx-auto max-w-[96rem] px-3 sm:px-6 py-4">
        <div
          ref={splitContainerRef}
          className="flex flex-col lg:flex-row gap-4 lg:gap-0 lg:h-[calc(100vh-148px)] items-stretch"
        >
          {/* Left Column: 4 Texts (A - D) */}
          <div
            style={{ width: `${leftPanelWidth}%` }}
            className="w-full max-lg:!w-full lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shrink-0"
          >
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-5 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#2E7D32] dark:text-[#78E014] flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> 4 Đoạn Văn Bản (A - D)
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {renderHighlightToolbar()}
                {canShowSolution && (
                  <button
                    type="button"
                    onClick={handleTogglePart3Translation}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-black transition-all cursor-pointer ${
                      showReadingTranslation
                        ? 'bg-[#58CC02] text-white shadow-2xs'
                        : 'bg-lime-50 dark:bg-slate-800 text-[#2E7D32] dark:text-[#78E014] border border-lime-300 dark:border-slate-700'
                    }`}
                  >
                    <Languages className="h-3.5 w-3.5" />
                    <span>{showReadingTranslation ? 'Ẩn dịch 4 đoạn A–D' : 'Dịch 4 đoạn văn A–D'}</span>
                  </button>
                )}
                {renderWidthPresetToolbar()}
              </div>
            </div>

            <div
              onMouseUp={handlePassageMouseUp}
              className="flex-1 lg:overflow-y-auto p-5 sm:p-6 select-text"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cards.map((card) => {
                  const cardTransKey = `r3-card-${card.id}`;
                  const cardTrans = liveTranslations[cardTransKey];
                  return (
                    <div
                      key={card.id}
                      className="relative rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 p-5 shadow-xs hover:border-[#58CC02] transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#2E7D32] text-xs font-black text-white shadow-xs">
                            {card.id}
                          </span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {card.title}
                          </span>
                        </div>

                        {card.imageUrl && (
                          <div className="mb-3 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-center">
                            <img
                              src={card.imageUrl}
                              alt={card.imageCaption || card.title || `Text ${card.id}`}
                              onClick={() => onOpenZoomModal(card)}
                              className="mx-auto max-h-40 w-auto cursor-zoom-in rounded-xl object-contain"
                            />
                            {card.imageCaption && (
                              <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                                {card.imageCaption}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="whitespace-pre-line text-xs sm:text-sm font-sans leading-relaxed text-slate-700 dark:text-slate-300">
                          {renderHighlightedContent(card.content)}
                        </div>

                        {canShowSolution && showReadingTranslation && (
                          <div className="mt-3 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 p-3 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-100">
                            <div className="font-black text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
                              <Languages className="h-3.5 w-3.5" />
                              <span>Dịch Text {card.id}:</span>
                            </div>
                            <p className="whitespace-pre-line leading-relaxed font-medium">
                              {card.vietnameseTranslation ||
                                (loadingTransKey === cardTransKey
                                  ? 'Đang dịch...'
                                  : cardTrans || 'Đang tải bản dịch...')}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-700 pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          Text {card.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenZoomModal(card)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-lime-100 hover:text-[#58CC02] transition-colors cursor-pointer"
                          title="Phóng to thẻ văn bản"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {renderResizerHandle()}

          {/* Right Column: Questions 1 - 7 (Reading Part 3) */}
          <div className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Reading Part 3 · Câu Hỏi 1 – {questions.length}
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Chọn Text A, B, C, hoặc D tương ứng
              </span>
            </div>

            <div className="flex-1 lg:overflow-y-auto p-5 sm:p-6 space-y-3">
              {renderKeyboardShortcutsBar()}
              {questions.map((q) => {
                const relNum = getPartRelativeNumber(q.id);
                const isOpen = openAccordionIds[q.id] ?? true;
                const currentAnswer = answers[q.id];
                const isQAnswered = Boolean(currentAnswer && currentAnswer.trim().length > 0);
                const isQLocked = isReviewMode || (mode === 'practice' && isQAnswered);
                const canShowQSolution = isReviewMode || (mode === 'practice' && isQAnswered);
                const isRevealed = isReviewMode || (mode === 'practice' ? isQAnswered : !!revealedAnswers[q.id]);
                const correct = isCorrect(q);

                return (
                  <div
                    key={q.id}
                    id={`question-card-${q.id}`}
                    className={`overflow-hidden rounded-2xl border-2 transition-all ${
                      isOpen
                        ? 'border-[#58CC02] bg-white dark:bg-slate-900 shadow-sm ring-2 ring-lime-100 dark:ring-lime-950'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div
                      onClick={() => toggleAccordion(q.id)}
                      className="flex w-full items-center justify-between p-3.5 sm:p-4 text-left transition-colors hover:bg-lime-50/40 dark:hover:bg-slate-800/60 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#2E7D32] font-mono text-xs font-black text-white">
                          {relNum}
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {q.prompt}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {mode === 'practice' && isQAnswered && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            <Lock className="h-3 w-3" /> Đã chốt: Text {currentAnswer}
                          </span>
                        )}
                        {renderFlagButton(q.id, true)}
                        {isOpen ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {['A', 'B', 'C', 'D'].map((letter) => {
                            const selected = currentAnswer === letter;
                            const isCorrectLetter = q.correctAnswer === letter;

                            return (
                              <button
                                key={letter}
                                type="button"
                                disabled={isQLocked}
                                onClick={() => !isQLocked && onAnswerChange(q.id, letter)}
                                className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 px-3 text-xs font-black transition-all ${
                                  isQLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                                } ${
                                  isRevealed && canShowQSolution && isCorrectLetter
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 shadow-xs'
                                    : isRevealed && canShowQSolution && selected && !isCorrectLetter
                                    ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200'
                                    : selected
                                    ? 'border-[#58CC02] bg-lime-50 dark:bg-lime-950/40 text-lime-950 dark:text-lime-200 shadow-sm border-b-3 border-[#46a302]'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-lime-300'
                                }`}
                              >
                                <div
                                  className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                                    selected
                                      ? 'border-[#58CC02] bg-[#58CC02] text-white'
                                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                  }`}
                                >
                                  {selected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </div>
                                <span>Text {letter}</span>
                              </button>
                            );
                          })}
                        </div>

                        {canShowQSolution && isRevealed && (
                              <div className="w-full mt-2 rounded-xl bg-lime-50 dark:bg-lime-950/40 p-3.5 border border-lime-200 dark:border-lime-800 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                                <span
                                  className={`font-black block text-sm ${
                                    correct
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : 'text-rose-700 dark:text-rose-300'
                                  }`}
                                >
                                  {correct ? '✓ Chính xác!' : '✗ Chưa đúng'} — Đáp án chuẩn: Text{' '}
                                  {q.correctAnswer}
                                </span>

                                <StructuredExplanationBox
                                  evidenceQuote={q.evidenceQuote}
                                  vietnameseTranslation={q.vietnameseTranslation}
                                  questionPrompt={q.prompt}
                                  onOpenEvidence={() => handleOpenEvidence(q)}
                                  onHighlightQuote={handleHighlightQuote}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
        {renderFloatingSelectionPopover()}
      </div>
    );
  }

  // =========================================================================
  // RENDER VARIANT 4: Reading Part 4 - Long Passage with Short Answer (Relative 1-8)
  // Resizable 2-Column Split-Screen with Bilingual Passage Translation
  // =========================================================================
  if (firstQ.type === 'short_answer' && firstQ.readingArticle) {
    const article = firstQ.readingArticle;
    const pretranslatedArticle = firstQ.readingArticleTranslation;

    const handleTogglePart4Translation = () => {
      const next = !showReadingTranslation;
      setShowReadingTranslation(next);
      if (next && !pretranslatedArticle) {
        fetchLiveTranslation(
          'r4-article',
          article.paragraphs.join('\n\n'),
          'Dịch bài đọc Reading Part 4 sang tiếng Việt theo từng đoạn văn'
        );
      }
    };

    return (
      <div className="mx-auto max-w-[96rem] px-3 sm:px-6 py-4">
        <div
          ref={splitContainerRef}
          className="flex flex-col lg:flex-row gap-4 lg:gap-0 lg:h-[calc(100vh-148px)] items-stretch"
        >
          {/* Left Column: Passage with solid top header & independent scrollbar */}
          <div
            style={{ width: `${leftPanelWidth}%` }}
            className="w-full max-lg:!w-full lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shrink-0"
          >
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-6 sm:px-8 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#65A30D] dark:text-[#78E014]">
                Reading Part 4 · Bài Đọc
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {renderHighlightToolbar()}
                {canShowSolution && (
                  <button
                    type="button"
                    onClick={handleTogglePart4Translation}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-black transition-all cursor-pointer ${
                      showReadingTranslation
                        ? 'bg-[#58CC02] text-white shadow-2xs'
                        : 'bg-lime-50 dark:bg-slate-800 text-[#2E7D32] dark:text-[#78E014] border border-lime-300 dark:border-slate-700'
                    }`}
                  >
                    <Languages className="h-3.5 w-3.5" />
                    <span>{showReadingTranslation ? 'Ẩn dịch bài đọc' : 'Dịch song ngữ bài đọc'}</span>
                  </button>
                )}
                {renderWidthPresetToolbar()}
              </div>
            </div>

            <div
              onMouseUp={handlePassageMouseUp}
              className="flex-1 lg:overflow-y-auto p-6 sm:p-8 select-text"
            >
              <h3 className="mb-1 text-2xl font-black text-slate-900 dark:text-white">
                {article.title}
              </h3>
              {canShowSolution && showReadingTranslation && pretranslatedArticle?.title && (
                <p className="mb-4 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {pretranslatedArticle.title}
                </p>
              )}

              {article.imageUrl && (
                <div className="my-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-center">
                  <img
                    src={article.imageUrl}
                    alt={article.imageCaption || article.title}
                    onClick={() =>
                      onOpenZoomModal({
                        id: 'Part4',
                        title: article.title,
                        content: '',
                        imageUrl: article.imageUrl,
                        imageCaption: article.imageCaption,
                      })
                    }
                    className="mx-auto max-h-60 w-auto cursor-zoom-in rounded-xl object-contain"
                  />
                  {article.imageCaption && (
                    <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                      {article.imageCaption}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-4 text-sm sm:text-base leading-relaxed text-slate-700 dark:text-slate-300">
                {article.paragraphs.map((p, idx) => (
                  <div key={idx} className="space-y-2">
                    <p>{renderHighlightedContent(p)}</p>
                    {canShowSolution && showReadingTranslation && pretranslatedArticle?.paragraphs?.[idx] && (
                      <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-950 dark:text-emerald-100 flex items-start gap-2">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{pretranslatedArticle.paragraphs[idx]}</span>
                      </div>
                    )}
                  </div>
                ))}

                {canShowSolution && showReadingTranslation && !pretranslatedArticle && (
                  <div className="mt-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 p-4 border-2 border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-950 dark:text-emerald-100 whitespace-pre-line">
                    {loadingTransKey === 'r4-article'
                      ? 'Đang dịch toàn bộ bài đọc...'
                      : liveTranslations['r4-article'] || 'Đang tải bản dịch...'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {renderResizerHandle()}

          {/* Right Column: 8 Short Answer Questions (Relative 1-8) */}
          <div className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Reading Part 4 · Trả Lời Ngắn (Câu 1 – {questions.length})
              </span>
            </div>

            <div className="flex-1 lg:overflow-y-auto p-5 sm:p-6 space-y-4">
              {questions.map((q) => {
                const relNum = getPartRelativeNumber(q.id);
                const currentVal = answers[q.id] || '';
                const answered = currentVal.trim().length > 0;
                const isLocked = isReviewMode || (mode === 'practice' && answered);
                const canShowQuestionSolution = isReviewMode || (mode === 'practice' && answered);
                const isRevealed = isReviewMode || (mode === 'practice' ? answered : !!revealedAnswers[q.id]);
                const correct = isCorrect(q);
                const isFocused = activeQuestionId === q.id;

                return (
                  <div
                    key={q.id}
                    onClick={() => onSelectQuestion(q.id)}
                    className={`rounded-3xl border-2 bg-slate-50/40 dark:bg-slate-800/40 p-5 shadow-xs transition-all ${
                      isFocused
                        ? 'border-[#58CC02] ring-2 ring-lime-100 dark:ring-lime-950'
                        : 'border-slate-200 dark:border-slate-800 hover:border-[#58CC02]'
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <label
                        htmlFor={`short-ans-${q.id}`}
                        className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100"
                      >
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-[#65A30D] font-mono text-xs font-black text-white mr-2">
                          {relNum}
                        </span>
                        {q.prompt}
                      </label>
                      <div className="flex items-center gap-2">
                        {mode === 'practice' && answered && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-500 bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                            <Lock className="h-3 w-3" /> Đã chốt
                          </span>
                        )}
                        {renderFlagButton(q.id, true)}
                      </div>
                    </div>

                    <input
                      id={`short-ans-${q.id}`}
                      type="text"
                      readOnly={isLocked}
                      value={currentVal}
                      onChange={(e) => !isLocked && onAnswerChange(q.id, e.target.value)}
                      onFocus={() => onSelectQuestion(q.id)}
                      placeholder="Điền tối đa 3 từ..."
                      className={`h-11 w-full rounded-2xl border-2 px-3.5 text-sm font-bold transition-all focus:outline-none ${
                        isLocked ? 'cursor-not-allowed' : ''
                      } ${
                        isRevealed && canShowQuestionSolution
                          ? correct
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                            : 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                          : answered
                          ? 'border-[#58CC02] bg-lime-50/50 dark:bg-lime-950/30 text-slate-900 dark:text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:border-slate-400 focus:border-[#58CC02]'
                      }`}
                    />

                    {canShowQuestionSolution && (
                      <div className="mt-2.5 flex flex-col gap-1.5 text-xs">

                        {isRevealed && (
                          <div className="rounded-2xl bg-lime-50/80 dark:bg-lime-950/40 p-4 border-2 border-lime-300 dark:border-lime-800 text-xs text-slate-700 dark:text-slate-300 space-y-2.5">
                            <span
                              className={`font-black block text-sm ${
                                correct
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {correct ? '✓ Chính xác!' : '✗ Chưa đúng'} — Đáp án chuẩn:{' '}
                              <span className="text-emerald-700 dark:text-emerald-300">
                                {Array.isArray(q.correctAnswer)
                                  ? q.correctAnswer.join(' / ')
                                  : q.correctAnswer}
                              </span>
                            </span>

                            <StructuredExplanationBox
                              evidenceQuote={q.evidenceQuote}
                              vietnameseTranslation={q.vietnameseTranslation}
                              questionPrompt={q.prompt}
                              onOpenEvidence={() => handleOpenEvidence(q)}
                              onHighlightQuote={handleHighlightQuote}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {renderFloatingSelectionPopover()}
      </div>
    );
  }

  // =========================================================================
  // RENDER VARIANT 4B: VSTEP Reading Passages 1-4 with 10 Multiple Choice Questions (A, B, C, D)
  // Resizable 2-Column Split-Screen: Left = Rich Reading Passage (Underlined/Highlighted Words & Paragraph Numbers) | Right = 10 MCQs
  // =========================================================================
  if (firstQ.section === 'READING' && firstQ.readingArticle && firstQ.type === 'mcq') {
    const article = firstQ.readingArticle;
    const pretranslatedArticle = firstQ.readingArticleTranslation;
    const passageNum = firstQ.partNumber;
    const firstRelNum = getPartRelativeNumber(questions[0].id, questions);
    const lastRelNum = getPartRelativeNumber(questions[questions.length - 1].id, questions);
    const transCacheKey = `vstep-r${passageNum}-article`;

    const handleTogglePassageTranslation = () => {
      const next = !showReadingTranslation;
      setShowReadingTranslation(next);
      if (next && !pretranslatedArticle) {
        fetchLiveTranslation(
          transCacheKey,
          article.paragraphs.join('\n\n'),
          `Dịch bài đọc VSTEP Reading Passage ${passageNum} sang tiếng Việt theo từng đoạn văn`
        );
      }
    };

    const handleHighlightPassageEvidence = (quote?: string) => {
      if (!quote) return;
      setActiveHighlightQuote(quote);
      setTimeout(() => {
        const el = document.getElementById('active-evidence-mark');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    };

    return (
      <div className="mx-auto max-w-[96rem] px-3 sm:px-6 py-4">
        <div
          ref={splitContainerRef}
          className="flex flex-col lg:flex-row gap-4 lg:gap-0 lg:h-[calc(100vh-148px)] items-stretch"
        >
          {/* Left Column: VSTEP Reading Passage with numbered paragraphs & underlined target words */}
          <div
            style={{ width: `${leftPanelWidth}%` }}
            className="w-full max-lg:!w-full lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shrink-0"
          >
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-5 sm:px-7 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-xl bg-[#58CC02] px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-2xs border-b-2 border-[#3C8C02]">
                  PASSAGE {passageNum}
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Questions {firstRelNum}–{lastRelNum}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {renderHighlightToolbar()}
                {canShowSolution && (
                  <button
                    type="button"
                    onClick={handleTogglePassageTranslation}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                      showReadingTranslation
                        ? 'bg-[#58CC02] text-white shadow-2xs'
                        : 'bg-lime-50 dark:bg-slate-800 text-[#2E7D32] dark:text-[#78E014] border border-lime-300 dark:border-slate-700'
                    }`}
                  >
                    <Languages className="h-3.5 w-3.5" />
                    <span>{showReadingTranslation ? 'Ẩn dịch bài đọc' : 'Dịch song ngữ bài đọc'}</span>
                  </button>
                )}
                {renderWidthPresetToolbar()}
              </div>
            </div>

            <div
              onMouseUp={handlePassageMouseUp}
              className="flex-1 lg:overflow-y-auto p-6 sm:p-8 select-text"
            >
              <h3 className="mb-1 text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-snug">
                {article.title}
              </h3>
              {canShowSolution && showReadingTranslation && pretranslatedArticle?.title && (
                <p className="mb-4 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {pretranslatedArticle.title}
                </p>
              )}

              {article.imageUrl && (
                <div className="my-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-center">
                  <img
                    src={article.imageUrl}
                    alt={article.imageCaption || article.title}
                    onClick={() =>
                      onOpenZoomModal({
                        id: `Passage-${passageNum}`,
                        title: article.title,
                        content: '',
                        imageUrl: article.imageUrl,
                        imageCaption: article.imageCaption,
                      })
                    }
                    className="mx-auto max-h-60 w-auto cursor-zoom-in rounded-xl object-contain"
                  />
                  {article.imageCaption && (
                    <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                      {article.imageCaption}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-5 text-sm sm:text-[15.5px] leading-[1.8] text-slate-800 dark:text-slate-200 font-sans">
                {article.paragraphs.map((p, idx) => (
                  <div key={idx} className="space-y-2">
                    <p className="text-justify">
                      <span className="inline-flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 mr-2 select-none">
                        Đoạn {idx + 1}
                      </span>
                      {renderHighlightedContent(p)}
                    </p>
                    {canShowSolution &&
                      showReadingTranslation &&
                      pretranslatedArticle?.paragraphs?.[idx] && (
                        <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 p-3.5 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-950 dark:text-emerald-100 flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{pretranslatedArticle.paragraphs[idx]}</span>
                        </div>
                      )}
                  </div>
                ))}

                {canShowSolution && showReadingTranslation && !pretranslatedArticle && (
                  <div className="mt-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 p-4 border-2 border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-950 dark:text-emerald-100 whitespace-pre-line">
                    {loadingTransKey === transCacheKey
                      ? 'Đang dịch toàn bộ bài đọc...'
                      : liveTranslations[transCacheKey] || 'Đang tải bản dịch...'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {renderResizerHandle()}

          {/* Right Column: 10 VSTEP Multiple-Choice Questions (A, B, C, D) */}
          <div className="flex-1 min-w-0 lg:h-full flex flex-col overflow-hidden rounded-3xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <div className="shrink-0 z-20 bg-white dark:bg-slate-900 px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Reading Passage {passageNum} · Câu hỏi {firstRelNum} – {lastRelNum} (4 lựa chọn A, B, C, D)
              </span>
              <span className="text-[11px] font-bold text-[#58CC02]">
                Đã chọn:{' '}
                {
                  questions.filter((q) => (answers[q.id] || '').trim().length > 0).length
                }
                /{questions.length}
              </span>
            </div>

            <div className="flex-1 lg:overflow-y-auto p-4 sm:p-6 space-y-4">
              {renderKeyboardShortcutsBar()}
              {questions.map((q) => {
                const relNum = getPartRelativeNumber(q.id, questions);
                const currentAnswer = answers[q.id] || '';
                const isQAnswered = Boolean(currentAnswer && currentAnswer.trim().length > 0);
                const isQLocked = isReviewMode || (mode === 'practice' && isQAnswered);
                const canShowQSolution = isReviewMode || (mode === 'practice' && isQAnswered);
                const isRevealed = isReviewMode || (mode === 'practice' ? isQAnswered : !!revealedAnswers[q.id]);
                const isTranslated = !!translatedQuestions[q.id];
                const correct = isCorrect(q);
                const isFocused = activeQuestionId === q.id;

                return (
                  <div
                    key={q.id}
                    id={`question-card-${q.id}`}
                    onClick={() => onSelectQuestion(q.id)}
                    className={`rounded-3xl border-2 p-5 transition-all ${
                      isFocused
                        ? 'border-[#58CC02] bg-white dark:bg-slate-900 shadow-md ring-2 ring-lime-100 dark:ring-lime-950'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 hover:border-lime-400'
                    }`}
                  >
                    {/* Question Prompt Header */}
                    <div className="flex items-start justify-between gap-3 mb-3.5">
                      <div className="flex items-start gap-2.5 text-left">
                        <span className="mt-0.5 flex h-7 min-w-7 px-1.5 shrink-0 items-center justify-center rounded-xl bg-[#58CC02] font-mono text-xs font-black text-white shadow-2xs border-b-2 border-[#3C8C02]">
                          {relNum}
                        </span>
                        <div className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {renderRichFormattedTokens(q.prompt || `Question ${relNum}`, `prompt-${q.id}`)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {mode === 'practice' && isQAnswered && (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-black text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <Lock className="h-3 w-3 text-emerald-600" /> Đã chốt {currentAnswer}
                          </span>
                        )}
                        {renderFlagButton(q.id, true)}
                      </div>
                    </div>

                    {/* 4 Options A, B, C, D */}
                    <div className="space-y-2.5">
                      {q.options?.map((opt) => {
                        const selected = isChecked(q, opt.id);
                        const isCorrectOpt = q.correctAnswer === opt.id;
                        const eliminated = !selected && isOptionEliminated(q.id, opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={isQLocked}
                            onContextMenu={(e) => {
                              if (!isQLocked) toggleEliminateOption(q.id, opt.id, e);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectQuestion(q.id);
                              if (!isQLocked) {
                                if (isOptionEliminated(q.id, opt.id)) {
                                  toggleEliminateOption(q.id, opt.id);
                                }
                                onAnswerChange(q.id, opt.id);
                              }
                            }}
                            className={`flex w-full items-center gap-3.5 rounded-2xl border-2 border-b-4 p-3.5 text-left text-xs sm:text-sm font-bold transition-all active:border-b-2 active:translate-y-0.5 ${
                              isQLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              isRevealed && canShowQSolution && isCorrectOpt
                                ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/65 dark:bg-emerald-950/50 text-[#2B6600] dark:text-emerald-200 shadow-xs'
                                : isRevealed && canShowQSolution && selected && !isCorrectOpt
                                ? 'border-[#FF4B4B] border-b-[#EA2B2B] bg-[#FFDFE0]/70 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200'
                                : selected
                                ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/55 dark:bg-lime-950/40 text-lime-950 dark:text-lime-200 shadow-xs'
                                : eliminated
                                ? 'border-slate-200/70 dark:border-slate-800 border-b-slate-300/70 bg-slate-50/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500'
                                : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[#58CC02] hover:border-b-[#46A302]'
                            }`}
                          >
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-b-2 text-xs font-black transition-colors ${
                                selected
                                  ? 'bg-[#58CC02] border-[#46A302] text-white'
                                  : eliminated
                                  ? 'bg-slate-200/60 dark:bg-slate-800 border-slate-300 text-slate-400 line-through'
                                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {opt.id}
                            </div>
                            <span
                              className={`flex-1 ${
                                eliminated ? 'line-through opacity-55 decoration-2 decoration-rose-400' : ''
                              }`}
                            >
                              {renderRichFormattedTokens(opt.text, `opt-${q.id}-${opt.id}`)}
                            </span>
                            {renderEliminateOptionButton(q.id, opt.id, isQLocked)}
                          </button>
                        );
                      })}
                    </div>

                    {/* Vietnamese Translation Accordion for Question & Options */}
                    {canShowQSolution && isTranslated && !isRevealed && q.vietnameseTranslation && (
                      <div className="mt-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 p-3.5 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                        <Languages className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-emerald-800 dark:text-emerald-300">
                            Dịch nghĩa câu hỏi & phương án A, B, C, D:
                          </div>
                          <p className="mt-0.5 whitespace-pre-line leading-relaxed">
                            {q.vietnameseTranslation}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Practice / Review Controls (Unlocked after answering) */}
                    {canShowQSolution && (
                      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-3">
                          {q.evidenceQuote && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleHighlightPassageEvidence(q.evidenceQuote);
                              }}
                              className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              <PanelLeftOpen className="h-3.5 w-3.5" />
                              <span>Tô sáng câu bằng chứng ở bài đọc trái</span>
                            </button>
                          )}

                          {q.vietnameseTranslation && !isRevealed && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTranslatedQuestions((prev) => ({
                                  ...prev,
                                  [q.id]: !prev[q.id],
                                }));
                              }}
                              className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-700 cursor-pointer"
                            >
                              <Languages className="h-3.5 w-3.5" />
                              <span>{isTranslated ? 'Ẩn dịch' : 'Dịch câu hỏi & A, B, C, D'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {canShowQSolution && isRevealed && (
                      <div className="mt-3 rounded-2xl bg-lime-50 dark:bg-lime-950/40 p-4 border-2 border-lime-300 dark:border-lime-800 text-xs text-slate-800 dark:text-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {correct ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-600" />
                            )}
                            <span className="font-black text-sm">
                              {correct ? 'Chính xác!' : currentAnswer ? 'Chưa đúng' : 'Chưa trả lời'}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 font-bold">
                              (Đáp án chuẩn: Phương án {q.correctAnswer})
                            </span>
                          </div>
                        </div>

                        <StructuredExplanationBox
                          explanation={q.explanation}
                          evidenceQuote={q.evidenceQuote}
                          vietnameseTranslation={q.vietnameseTranslation}
                          questionPrompt={q.prompt}
                          options={q.options}
                          hideInlineScript={true}
                          onOpenEvidence={() => handleHighlightPassageEvidence(q.evidenceQuote)}
                          onHighlightQuote={handleHighlightPassageEvidence}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {renderFloatingSelectionPopover()}
      </div>
    );
  }

  // =========================================================================
  // RENDER VARIANT 5: Standard Multiple Choice Accordion Questions
  // (VSTEP Listening Parts 1, 2, 3) with Left-Side Resizable Script & Translation Panel
  // =========================================================================
  const isListeningPart1 = firstQ.section === 'LISTENING' && firstQ.partNumber === 1;
  const isReadingPart1 = firstQ.section === 'READING' && firstQ.partNumber === 1;
  const isListeningPart2 = firstQ.section === 'LISTENING' && firstQ.partNumber === 2;
  const isListeningPart3 = firstQ.section === 'LISTENING' && firstQ.partNumber === 3;

  const getConversationGroupHeader = (qId: number): string | null => {
    if (isListeningPart2) {
      if (qId === 9) return 'Questions 9 to 12 · Conversation 1 (Đoạn hội thoại 1)';
      if (qId === 13) return 'Questions 13 to 16 · Conversation 2 (Đoạn hội thoại 2)';
      if (qId === 17) return 'Questions 17 to 20 · Conversation 3 (Đoạn hội thoại 3)';
    }
    if (isListeningPart3) {
      if (qId === 21) return 'Questions 21 to 25 · Talk / Lecture 1 (Bài nói 1)';
      if (qId === 26) return 'Questions 26 to 30 · Talk / Lecture 2 (Bài nói 2)';
      if (qId === 31) return 'Questions 31 to 35 · Talk / Lecture 3 (Bài giảng 3)';
    }
    return null;
  };

  const isOddPart = firstQ.partNumber === 1 || firstQ.partNumber === 3;

  const mcqQuestionsList = (
    <div className="space-y-4">
      {/* Top Action Bar to Open/Close Left Script & Translation Panel */}
      {canShowSolution && scriptSections.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white dark:bg-slate-900 p-3.5 border-2 border-lime-300 dark:border-lime-800 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-lime-100 dark:bg-lime-950 text-[#2E7D32] dark:text-[#78E014]">
              <Languages className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 dark:text-white block">
                {firstQ.section === 'LISTENING'
                  ? `Audio Script theo lượt người nói (A, B, C) & Dịch nghĩa`
                  : `Văn bản Biển báo / Thông báo & Dịch nghĩa`}
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Hiển thị trực quan ở cột bên trái màn hình, cho phép kéo chỉnh tỉ lệ độ rộng 2 cột
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsScriptPanelOpen((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition-all cursor-pointer ${
              isScriptPanelOpen
                ? 'bg-slate-900 dark:bg-slate-700 text-white'
                : 'bg-[#58CC02] hover:bg-[#46a302] text-white shadow-xs border-b-2 border-[#3c8c02]'
            }`}
          >
            {isScriptPanelOpen ? (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Đóng cột Script bên trái</span>
              </>
            ) : (
              <>
                <PanelLeftOpen className="h-4 w-4" />
                <span>Mở Script & Dịch ở cột trái</span>
              </>
            )}
          </button>
        </div>
      )}

      {renderKeyboardShortcutsBar()}

      {questions.map((q) => {
        const relNum = getPartRelativeNumber(q.id);
        const isOpen = openAccordionIds[q.id] ?? false;
        const currentAnswer = answers[q.id];
        const isQAnswered = Boolean(currentAnswer && currentAnswer.trim().length > 0);
        const isQLocked = isReviewMode || (mode === 'practice' && isQAnswered);
        const canShowQSolution = isReviewMode || (mode === 'practice' && isQAnswered);
        const isRevealed = isReviewMode || (mode === 'practice' ? isQAnswered : !!revealedAnswers[q.id]);
        const isTranslated = !!translatedQuestions[q.id];
        const correct = isCorrect(q);
        const convHeader = getConversationGroupHeader(q.id);

        return (
          <React.Fragment key={q.id}>
            {convHeader && (
              <div className="pt-2 pb-1 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-lime-100 dark:bg-lime-950/60 border border-lime-300 dark:border-lime-800 px-3 py-1 text-xs font-black text-lime-900 dark:text-lime-200">
                  <Headphones className="h-3.5 w-3.5 text-[#46a302]" />
                  <span>{convHeader}</span>
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>
            )}

            <div
              id={`question-card-${q.id}`}
              className={`overflow-hidden rounded-3xl border-2 transition-all duration-200 ${
                isOpen
                  ? 'border-[#58CC02] bg-white dark:bg-slate-900 shadow-md ring-2 ring-lime-100 dark:ring-lime-950'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
              }`}
            >
              {/* Accordion Header */}
              <div
                onClick={() => toggleAccordion(q.id)}
                className="flex w-full items-center justify-between p-4 sm:p-5 text-left transition-colors hover:bg-lime-50/30 dark:hover:bg-slate-800/50 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-black text-white shadow-2xs ${
                      isOddPart ? 'bg-[#2E7D32]' : 'bg-[#65A30D]'
                    }`}
                  >
                    {relNum}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {q.prompt
                      ? q.prompt.replace(/^Question\s+\d+$/i, `Question ${relNum}`)
                      : `Question ${relNum}`}
                  </span>
                  {currentAnswer && (
                    <span className="rounded-lg bg-lime-100 dark:bg-lime-900/60 px-2.5 py-0.5 text-xs font-black text-lime-800 dark:text-lime-200 flex items-center gap-1">
                      {mode === 'practice' && <Lock className="h-3 w-3 text-[#2E7D32] dark:text-[#78E014]" />}
                      Đã chọn: {currentAnswer}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {renderFlagButton(q.id, true)}
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Accordion Body */}
              {isOpen && (
                <div className="border-t border-slate-100 dark:border-slate-800 p-5 sm:p-6 bg-slate-50/40 dark:bg-slate-800/30">
                  {/* Reading Part 1 Stimulus Card */}
                  {q.stimulusCard && (
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      <div className="md:col-span-5 relative rounded-3xl border-2 border-lime-300 dark:border-lime-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
                        {(q.stimulusCard.title || q.stimulusCard.tag) && (
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                            {q.stimulusCard.title && (
                              <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                                {q.stimulusCard.title}
                              </span>
                            )}
                            {q.stimulusCard.tag && (
                              <span className="rounded-lg bg-lime-100 dark:bg-lime-900/60 px-2 py-0.5 text-[10px] font-black text-lime-800 dark:text-lime-200">
                                {q.stimulusCard.tag}
                              </span>
                            )}
                          </div>
                        )}
                        {(q.stimulusCard.imageUrl || q.imageUrl) && (
                          <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-1.5 text-center">
                            <img
                              src={q.stimulusCard.imageUrl || q.imageUrl}
                              alt={
                                q.stimulusCard.imageCaption ||
                                q.imageCaption ||
                                q.stimulusCard.title ||
                                `Question ${relNum}`
                              }
                              onClick={() =>
                                onOpenZoomModal({
                                  ...q.stimulusCard!,
                                  imageUrl: q.stimulusCard!.imageUrl || q.imageUrl,
                                  imageCaption: q.stimulusCard!.imageCaption || q.imageCaption,
                                })
                              }
                              className="mx-auto max-h-52 w-auto cursor-zoom-in rounded-xl object-contain"
                            />
                            {(q.stimulusCard.imageCaption || q.imageCaption) && (
                              <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                                {q.stimulusCard.imageCaption || q.imageCaption}
                              </p>
                            )}
                          </div>
                        )}
                        {q.stimulusCard.content && (
                          <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 font-sans pr-6">
                            {renderHighlightedContent(q.stimulusCard.content)}
                          </div>
                        )}
                        {canShowQSolution && (isTranslated || isRevealed) && q.stimulusCardTranslation && (
                          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 p-3 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-100">
                            <div className="font-black text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
                              <Languages className="h-3.5 w-3.5" />
                              <span>Dịch văn bản:</span>
                            </div>
                            <p className="whitespace-pre-line leading-relaxed">
                              {q.stimulusCardTranslation}
                            </p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onOpenZoomModal({
                              ...q.stimulusCard!,
                              imageUrl: q.stimulusCard!.imageUrl || q.imageUrl,
                              imageCaption: q.stimulusCard!.imageCaption || q.imageCaption,
                            })
                          }
                          className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-lime-100 hover:text-[#58CC02] transition-colors cursor-pointer"
                          title="Phóng to thẻ văn bản / hình ảnh"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Options on the right */}
                      <div className="md:col-span-7 space-y-2.5">
                        {q.options?.map((opt) => {
                          const selected = isChecked(q, opt.id);
                          const isCorrectOpt = q.correctAnswer === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isQLocked}
                              onClick={() => !isQLocked && onAnswerChange(q.id, opt.id)}
                              className={`flex w-full items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left text-xs sm:text-sm font-bold transition-all ${
                                isQLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                isRevealed && canShowQSolution && isCorrectOpt
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 shadow-sm'
                                  : isRevealed && canShowQSolution && selected && !isCorrectOpt
                                  ? 'border-rose-400 bg-rose-50 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200'
                                  : selected
                                  ? 'border-[#58CC02] bg-lime-50 dark:bg-lime-950/40 text-lime-950 dark:text-lime-200 shadow-sm border-b-4 border-[#46a302]'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-lime-300'
                              }`}
                            >
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black transition-colors ${
                                  selected
                                    ? 'bg-[#58CC02] text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {opt.id}
                              </div>
                              <span className="flex-1">{opt.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Standard Options (Listening 1, 2, 4) with optional Question Image */}
                  {!q.stimulusCard && (
                    <div className="space-y-4">
                      {q.imageUrl && (
                        <div className="overflow-hidden rounded-2xl border-2 border-lime-200 dark:border-lime-800 bg-white dark:bg-slate-900 p-3 text-center">
                          <img
                            src={q.imageUrl}
                            alt={q.imageCaption || `Hình minh họa câu ${relNum}`}
                            onClick={() =>
                              onOpenZoomModal({
                                id: String(relNum),
                                title: q.imageCaption || `Câu hỏi #${relNum}`,
                                content: q.prompt || '',
                                imageUrl: q.imageUrl,
                                imageCaption: q.imageCaption,
                              })
                            }
                            className="mx-auto max-h-56 w-auto cursor-zoom-in rounded-xl object-contain"
                          />
                          {q.imageCaption && (
                            <p className="mt-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 italic">
                              {q.imageCaption}
                            </p>
                          )}
                        </div>
                      )}
                      {/* Listening Part 1: Question Script rendered directly above options A, B, C (Unlocked only AFTER answering in Practice) */}
                      {canShowQSolution && isListeningPart1 && q.audioScript && (showPart1Script[q.id] || isRevealed) && (
                        <div className="rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 p-4 border-2 border-emerald-300 dark:border-emerald-800 text-xs mb-3 space-y-2 animate-in fade-in duration-150">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                              <Headphones className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Lời thoại câu hỏi:</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => examAudioManager.speakText(q.audioScript!)}
                              className="inline-flex items-center gap-1 rounded-lg bg-white/80 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 border border-slate-200 dark:border-slate-700 cursor-pointer"
                            >
                              <Volume2 className="h-3 w-3 text-emerald-600" />
                              <span>Nghe</span>
                            </button>
                          </div>
                          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed">
                            {q.audioScript}
                          </div>
                          {q.audioScriptTranslation && (
                            <div className="text-xs text-emerald-800 dark:text-emerald-300 italic pt-1.5 border-t border-emerald-200/70 dark:border-emerald-800/70">
                              “{q.audioScriptTranslation}”
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-2.5">
                        {q.options?.map((opt) => {
                          const selected = isChecked(q, opt.id);
                          const isCorrectOpt = q.correctAnswer === opt.id;
                          const eliminated = !selected && isOptionEliminated(q.id, opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={isQLocked}
                              onContextMenu={(e) => {
                                if (!isQLocked) toggleEliminateOption(q.id, opt.id, e);
                              }}
                              onClick={() => {
                                if (!isQLocked) {
                                  if (isOptionEliminated(q.id, opt.id)) {
                                    toggleEliminateOption(q.id, opt.id);
                                  }
                                  onAnswerChange(q.id, opt.id);
                                }
                              }}
                              className={`flex w-full items-center gap-3.5 rounded-2xl border-2 border-b-4 p-3.5 text-left text-xs sm:text-sm font-bold transition-all active:border-b-2 active:translate-y-0.5 ${
                                isQLocked ? 'cursor-not-allowed' : 'cursor-pointer'
                              } ${
                                isRevealed && canShowQSolution && isCorrectOpt
                                  ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/65 dark:bg-emerald-950/50 text-[#2B6600] dark:text-emerald-200 shadow-sm'
                                  : isRevealed && canShowQSolution && selected && !isCorrectOpt
                                  ? 'border-[#FF4B4B] border-b-[#EA2B2B] bg-[#FFDFE0]/70 dark:bg-rose-950/50 text-rose-950 dark:text-rose-200'
                                  : selected
                                  ? 'border-[#58CC02] border-b-[#46A302] bg-[#D7FFB8]/55 dark:bg-lime-950/40 text-lime-950 dark:text-lime-200 shadow-sm'
                                  : eliminated
                                  ? 'border-slate-200/70 dark:border-slate-800 border-b-slate-300/70 bg-slate-50/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500'
                                  : 'border-slate-200 dark:border-slate-700 border-b-slate-300 dark:border-b-slate-950 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-[#58CC02] hover:border-b-[#46A302]'
                              }`}
                            >
                              <div
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border-b-2 text-xs font-black transition-colors ${
                                  selected
                                    ? 'bg-[#58CC02] border-[#46A302] text-white'
                                    : eliminated
                                    ? 'bg-slate-200/60 dark:bg-slate-800 border-slate-300 text-slate-400 line-through'
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {opt.id}
                              </div>
                              <span
                                className={`flex-1 ${
                                  eliminated ? 'line-through opacity-55 decoration-2 decoration-rose-400' : ''
                                }`}
                              >
                                {opt.text}
                              </span>
                              {renderEliminateOptionButton(q.id, opt.id, isQLocked)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Vietnamese Translation Accordion for Question & Options (Practice/Review mode only) */}
                  {canShowQSolution && isTranslated && !isRevealed && q.vietnameseTranslation && (
                    <div className="mt-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 p-3.5 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                      <Languages className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-emerald-800 dark:text-emerald-300">
                          Dịch nghĩa câu hỏi & phương án A, B, C:
                        </div>
                        <p className="mt-0.5 whitespace-pre-line leading-relaxed">
                          {q.vietnameseTranslation}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Practice / Review Controls & Audio Narration (Unlocked only AFTER answering in Practice) */}
                  {canShowQSolution && (
                    <div className="mt-5 pt-3 border-t border-slate-200/80 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        {q.audioScript && (
                          <button
                            type="button"
                            onClick={() => examAudioManager.speakText(q.audioScript!)}
                            className="inline-flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300 hover:text-[#58CC02] transition-colors cursor-pointer"
                            title="Nghe giọng đọc câu này"
                          >
                            <Volume2 className="h-4 w-4 text-[#58CC02]" />
                            <span>Nghe lời thoại</span>
                          </button>
                        )}

                        {isListeningPart1 && q.audioScript && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowPart1Script((prev) => ({
                                ...prev,
                                [q.id]: !prev[q.id],
                              }))
                            }
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
                          >
                            <Languages className="h-3.5 w-3.5" />
                            <span>{showPart1Script[q.id] ? 'Ẩn Script câu hỏi' : 'Xem Script câu hỏi'}</span>
                          </button>
                        )}

                        {!isListeningPart1 && !isReadingPart1 && (q.audioScript || q.stimulusCard) && (
                          <button
                            type="button"
                            onClick={() => handleOpenEvidence(q)}
                            className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
                          >
                            <PanelLeftOpen className="h-3.5 w-3.5" />
                            <span>Xem Script & Dịch cột trái</span>
                          </button>
                        )}

                        {q.vietnameseTranslation && !isRevealed && (
                          <button
                            type="button"
                            onClick={() =>
                              setTranslatedQuestions((prev) => ({
                                ...prev,
                                [q.id]: !prev[q.id],
                              }))
                            }
                            className="inline-flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                          >
                            <Languages className="h-3.5 w-3.5" />
                            <span>{isTranslated ? 'Ẩn dịch' : 'Dịch câu hỏi & A, B, C'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Answer Check, Evidence Quote & Full Question/Options Translation Box */}
                  {canShowQSolution && isRevealed && (
                    <div className="mt-3 rounded-2xl bg-lime-50 dark:bg-lime-950/40 p-4 border-2 border-lime-300 dark:border-lime-800 text-xs text-slate-800 dark:text-slate-200 space-y-2.5">
                      <div className="flex items-center gap-2">
                        {correct ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600" />
                        )}
                        <span className="font-black text-sm">
                          {correct ? 'Chính xác!' : 'Chưa đúng'}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400 font-bold">
                          (Đáp án chuẩn: Phương án {q.correctAnswer})
                        </span>
                      </div>

                      {/* Question & Options Vietnamese Translation Box */}
                      <StructuredExplanationBox
                        explanation={q.explanation}
                        evidenceQuote={q.evidenceQuote}
                        audioScript={q.audioScript}
                        audioScriptTranslation={q.audioScriptTranslation}
                        vietnameseTranslation={q.vietnameseTranslation}
                        questionPrompt={q.prompt}
                        options={q.options}
                        hideEvidenceQuote={isListeningPart1}
                        hideInlineScript={true}
                        onOpenEvidence={() => handleOpenEvidence(q)}
                        onHighlightQuote={handleHighlightQuote}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // If Left Script & Translation Panel is Open, render 2-Column Resizable Split Layout
  if (canShowSolution && isScriptPanelOpen && scriptSections.length > 0) {
    return (
      <div className="mx-auto max-w-[96rem] px-3 sm:px-6 py-4">
        <div
          ref={splitContainerRef}
          className="flex flex-col lg:flex-row gap-4 lg:gap-0 lg:h-[calc(100vh-148px)] items-stretch"
        >
          {/* Left Column: Speaker-Grouped Script & Translation Panel */}
          <div
            style={{ width: `${leftPanelWidth}%` }}
            className="w-full max-lg:!w-full lg:h-full shrink-0"
          >
            <InteractiveScriptPanel
              title={
                firstQ.section === 'LISTENING'
                  ? `Audio Script & Dịch · Listening Part ${firstQ.partNumber}`
                  : `Văn Bản & Dịch · Reading Part ${firstQ.partNumber}`
              }
              subtitle={
                firstQ.section === 'LISTENING'
                  ? 'Gom toàn bộ câu của từng người nói A, B, C & dịch nguyên khối'
                  : 'Đối chiếu văn bản gốc, bằng chứng & bản dịch tiếng Việt'
              }
              sections={scriptSections}
              activeQuestionId={activeQuestionId}
              highlightQuote={activeHighlightQuote}
              widthPercent={leftPanelWidth}
              onWidthPresetChange={setLeftPanelWidth}
              onSelectQuestion={onSelectQuestion}
              onClose={() => setIsScriptPanelOpen(false)}
            />
          </div>

          {renderResizerHandle()}

          {/* Right Column: Questions */}
          <div className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto pr-0.5">
            {mcqQuestionsList}
          </div>
        </div>
        {renderFloatingSelectionPopover()}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {mcqQuestionsList}
      {renderFloatingSelectionPopover()}
    </div>
  );
};
