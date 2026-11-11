import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Award,
  BookOpen,
  Headphones,
  PenTool,
  Mic,
  Calendar,
  Clock,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Sparkles,
  Layers,
  BarChart2,
  RefreshCw,
  Flame,
  Radio,
  Eye,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  Folder,
  ChevronDown,
  ChevronUp,
  Volume2,
  Sun,
  Moon,
  Edit3,
  Save,
  Target,
  Lock,
} from 'lucide-react';
import {
  UserProfile,
  UserRole,
  UserExamAttempt,
  UserTargetScores,
  UserVocabStats,
  InProgressAttempt,
} from '../../../types/studentManagement';
import { Question } from '../../../types/exam';
import { UserVocabDeck, UserVocabFolder } from '../../../types/vocab';
import {
  resolveTestTitle,
  isUserOnline,
  formatRelativeActiveTime,
  subscribeToStudentAttempts,
  fetchStudentInProgressMap,
  fetchStudentPersonalVocabData,
  updateStudentProfileAndGoals,
  fetchTestQuestionsMapForReview,
  DEMO_ATTEMPTS,
  DEMO_IN_PROGRESS,
  SUPER_ADMIN_EMAILS,
} from '../../../services/studentManagementService';
import { computeVocabStatsFromPartition } from '../../../services/vocabCloudService';
import { generateDefault15TopicDecks } from '../../../data/b1Official15TopicsData';
import { getZodiacFromBirthDate } from '../ZodiacPixelMascot';
import { resolvePlayableAudioUrl } from '../../../utils/audioStorageService';
import { saveTeacherAttemptFeedback } from '../../../services/examService';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

interface StudentDetail360ModalProps {
  student: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpenTest?: (testId: string) => void;
  isCurrentAdmin: boolean;
  isSuperAdmin: boolean;
  onRoleChange?: (targetUid: string, newRole: UserRole) => Promise<void>;
  onStudentUpdated?: (updatedStudent: UserProfile) => void;
}

export const StudentDetail360Modal: React.FC<StudentDetail360ModalProps> = ({
  student,
  isOpen,
  onClose,
  onOpenTest,
  isCurrentAdmin,
  isSuperAdmin,
  onRoleChange,
  onStudentUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'history' | 'vocab'>('analytics');
  const [attempts, setAttempts] = useState<UserExamAttempt[]>([]);
  const [inProgressMap, setInProgressMap] = useState<Record<string, InProgressAttempt>>({});
  const [liveVocabStats, setLiveVocabStats] = useState<UserVocabStats | null>(null);
  const [personalDecks, setPersonalDecks] = useState<UserVocabDeck[]>([]);
  const [personalFolders, setPersonalFolders] = useState<UserVocabFolder[]>([]);
  const [syncedAudioVolume, setSyncedAudioVolume] = useState<number | undefined>(undefined);
  const [expandedPersonalDeckId, setExpandedPersonalDeckId] = useState<string | null>(null);
  const [isLoadingAttempts, setIsLoadingAttempts] = useState<boolean>(true);
  const [selectedAttemptDetail, setSelectedAttemptDetail] = useState<UserExamAttempt | null>(null);
  const [reviewQuestionsMap, setReviewQuestionsMap] = useState<Record<number, Question>>({});
  const [reviewAnswerFilter, setReviewAnswerFilter] = useState<'all' | 'wrong' | 'correct' | 'unanswered'>('all');
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);
  const [resolvedSpeakingUrls, setResolvedSpeakingUrls] = useState<{
    part1?: string;
    part2?: string;
    part3?: string;
  }>({});
  const [studentMistakes, setStudentMistakes] = useState<any[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>(student.role || 'student');
  const [roleChangeNotice, setRoleChangeNotice] = useState<string | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  // Two-Way Teacher Edit State for Student Profile & Target Scores
  const [isEditingProfileGoals, setIsEditingProfileGoals] = useState<boolean>(false);
  const [isSavingProfileGoals, setIsSavingProfileGoals] = useState<boolean>(false);
  const [editDisplayName, setEditDisplayName] = useState<string>(student.displayName || '');
  const [editNickname, setEditNickname] = useState<string>(student.nickname || '');
  const [editPhone, setEditPhone] = useState<string>(student.phone || '');
  const [editBirthDate, setEditBirthDate] = useState<string>(student.birthDate || '');
  const [editAddress, setEditAddress] = useState<string>(student.address || '');
  const [editGoals, setEditGoals] = useState<UserTargetScores>(
    student.targetScores || {
      overall: 6.5,
      listening: 6.5,
      reading: 6.5,
      writing: 6.5,
      speaking: 6.5,
    }
  );

  // Teacher Direct Review & Score Override State for Selected Attempt
  const [teacherCommentInput, setTeacherCommentInput] = useState<string>('');
  const [teacherWritingOverrideInput, setTeacherWritingOverrideInput] = useState<string>('');
  const [teacherSpeakingOverrideInput, setTeacherSpeakingOverrideInput] = useState<string>('');
  const [teacherReviewerName, setTeacherReviewerName] = useState<string>('Mr.Harry (Giảng viên VSTEP)');
  const [isSavingTeacherFeedback, setIsSavingTeacherFeedback] = useState<boolean>(false);
  const [teacherFeedbackSavedMsg, setTeacherFeedbackSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAttemptDetail) {
      setTeacherCommentInput('');
      setTeacherWritingOverrideInput('');
      setTeacherSpeakingOverrideInput('');
      setTeacherFeedbackSavedMsg(null);
      return;
    }
    setTeacherCommentInput(selectedAttemptDetail.teacherFeedback?.commentVi || '');
    setTeacherWritingOverrideInput(
      selectedAttemptDetail.teacherFeedback?.writingScoreOverride !== undefined
        ? String(selectedAttemptDetail.teacherFeedback.writingScoreOverride)
        : selectedAttemptDetail.writingScore !== undefined
        ? String(selectedAttemptDetail.writingScore)
        : ''
    );
    setTeacherSpeakingOverrideInput(
      selectedAttemptDetail.teacherFeedback?.speakingScoreOverride !== undefined
        ? String(selectedAttemptDetail.teacherFeedback.speakingScoreOverride)
        : selectedAttemptDetail.speakingScore !== undefined
        ? String(selectedAttemptDetail.speakingScore)
        : ''
    );
    if (selectedAttemptDetail.teacherFeedback?.teacherName) {
      setTeacherReviewerName(selectedAttemptDetail.teacherFeedback.teacherName);
    }
    setTeacherFeedbackSavedMsg(null);
  }, [selectedAttemptDetail]);

  const handleSaveTeacherFeedback = async () => {
    if (!selectedAttemptDetail || isSavingTeacherFeedback) return;
    setIsSavingTeacherFeedback(true);
    setTeacherFeedbackSavedMsg(null);
    try {
      const parsedW =
        teacherWritingOverrideInput.trim() !== ''
          ? Math.max(0, Math.min(10, Number(teacherWritingOverrideInput)))
          : undefined;
      const parsedS =
        teacherSpeakingOverrideInput.trim() !== ''
          ? Math.max(0, Math.min(10, Number(teacherSpeakingOverrideInput)))
          : undefined;

      const feedbackObj = {
        commentVi: teacherCommentInput.trim(),
        writingScoreOverride: parsedW !== undefined && !isNaN(parsedW) ? parsedW : undefined,
        speakingScoreOverride: parsedS !== undefined && !isNaN(parsedS) ? parsedS : undefined,
        teacherName: teacherReviewerName.trim() || 'Mr.Harry (Giảng viên VSTEP)',
        updatedAt: Date.now(),
      };

      const res = await saveTeacherAttemptFeedback(
        student.uid,
        selectedAttemptDetail.attemptId,
        feedbackObj
      );

      const updatedAttempt: UserExamAttempt = {
        ...selectedAttemptDetail,
        teacherFeedback: feedbackObj,
        ...(res.updatedWritingScore !== undefined ? { writingScore: res.updatedWritingScore } : {}),
        ...(res.updatedSpeakingScore !== undefined ? { speakingScore: res.updatedSpeakingScore } : {}),
        ...(res.updatedVstepBandScore !== undefined ? { vstepBandScore: res.updatedVstepBandScore } : {}),
      };

      setSelectedAttemptDetail(updatedAttempt);
      setAttempts((prev) =>
        prev.map((a) => (a.attemptId === updatedAttempt.attemptId ? updatedAttempt : a))
      );
      setTeacherFeedbackSavedMsg('Đã lưu lời phê & điểm chấm của Giáo viên lên Cloud Firestore! Học viên sẽ thấy ngay trên màn hình Kết quả.');
    } catch {
      setTeacherFeedbackSavedMsg('Lỗi khi lưu nhận xét giáo viên. Vui lòng thử lại.');
    } finally {
      setIsSavingTeacherFeedback(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!selectedAttemptDetail?.speakingSubmission) {
      setResolvedSpeakingUrls({});
      return;
    }
    const sub = selectedAttemptDetail.speakingSubmission as any;
    const raw1 = sub.part1AudioDataUrl || sub.part1AudioUrl || '';
    const raw2 = sub.part2AudioDataUrl || sub.part2AudioUrl || '';
    const raw3 = sub.part3AudioDataUrl || sub.part3AudioUrl || '';

    Promise.all([
      raw1 ? resolvePlayableAudioUrl(raw1) : Promise.resolve(null),
      raw2 ? resolvePlayableAudioUrl(raw2) : Promise.resolve(null),
      raw3 ? resolvePlayableAudioUrl(raw3) : Promise.resolve(null),
    ]).then(([u1, u2, u3]) => {
      if (!cancelled) {
        setResolvedSpeakingUrls({
          part1: u1 || raw1 || undefined,
          part2: u2 || raw2 || undefined,
          part3: u3 || raw3 || undefined,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedAttemptDetail]);

  // Load official test questions map whenever an attempt is selected for detailed review
  useEffect(() => {
    let cancelled = false;
    if (!selectedAttemptDetail) {
      setReviewQuestionsMap({});
      setExpandedQuestionId(null);
      setReviewAnswerFilter('all');
      return;
    }
    fetchTestQuestionsMapForReview(selectedAttemptDetail.testId)
      .then((qMap) => {
        if (!cancelled) {
          setReviewQuestionsMap(qMap);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedAttemptDetail]);

  // Sync role and edit fields when student changes
  useEffect(() => {
    setSelectedRole(student.role || 'student');
    setLiveVocabStats(student.vocabStats || null);
    setPersonalDecks([]);
    setPersonalFolders([]);
    setStudentMistakes([]);
    setExpandedPersonalDeckId(null);
    setEditDisplayName(student.displayName || '');
    setEditNickname(student.nickname || '');
    setEditPhone(student.phone || '');
    setEditBirthDate(student.birthDate || '');
    setEditAddress(student.address || '');
    setEditGoals(
      student.targetScores || {
        overall: 6.5,
        listening: 6.5,
        reading: 6.5,
        writing: 6.5,
        speaking: 6.5,
      }
    );
  }, [student]);

  // Load attempts, in-progress & live vocab_state + personal decks/folders
  useEffect(() => {
    if (!isOpen || !student) return;

    setIsLoadingAttempts(true);

    if (student.uid.startsWith('demo_')) {
      const demoList = DEMO_ATTEMPTS[student.uid] || [];
      setAttempts(demoList);
      const demoInProg = DEMO_IN_PROGRESS[student.uid];
      setInProgressMap(demoInProg ? { [demoInProg.testId]: demoInProg } : {});
      setLiveVocabStats(student.vocabStats || null);
      fetchStudentPersonalVocabData(student.uid).then((res) => {
        setPersonalDecks(res.personalDecks);
        setPersonalFolders(res.personalFolders);
        setSyncedAudioVolume(res.audioVolumePercent);
      });
      setIsLoadingAttempts(false);
      return;
    }

    const unsubAttempts = subscribeToStudentAttempts(
      student.uid,
      (loaded: UserExamAttempt[]) => {
        setAttempts(loaded);
        setIsLoadingAttempts(false);
      },
      () => {
        setIsLoadingAttempts(false);
      }
    );

    fetchStudentInProgressMap(student.uid)
      .then((map: Record<string, InProgressAttempt>) => {
        setInProgressMap(map);
      })
      .catch(() => {});

    // Fetch live vocab_state/main + personal vocab_decks so vocabulary tab reflects real-time cloud data
    fetchStudentPersonalVocabData(student.uid)
      .then((res) => {
        setPersonalDecks(res.personalDecks);
        setPersonalFolders(res.personalFolders);
        setSyncedAudioVolume(res.audioVolumePercent ?? student.preferences?.audioVolumePercent);
        if (res.rawPartitionState || res.personalDecks.length > 0) {
          const allDecks = [...generateDefault15TopicDecks(), ...res.personalDecks];
          const computed = computeVocabStatsFromPartition(res.rawPartitionState || {}, allDecks);
          computed.personalDecksCount = res.personalDecks.length;
          computed.personalFoldersCount = res.personalFolders.length;
          setLiveVocabStats(computed);
        }
      })
      .catch(() => {});

    // Fetch student's Cloud Mistake Notebook (users/{uid}/vocab_state/mistakes_notebook)
    getDoc(doc(db, 'users', student.uid, 'vocab_state', 'mistakes_notebook'))
      .then((mSnap) => {
        if (mSnap.exists()) {
          const data = mSnap.data();
          if (Array.isArray(data?.records)) {
            setStudentMistakes(data.records);
          }
        }
      })
      .catch(() => {});

    return () => {
      unsubAttempts();
    };
  }, [isOpen, student]);

  const handleRefreshStudentData = async () => {
    if (!student || student.uid.startsWith('demo_')) return;
    setIsLoadingAttempts(true);
    try {
      const attCol = collection(db, 'users', student.uid, 'attempts');
      const snap = await getDocs(attCol);
      const list: UserExamAttempt[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as UserExamAttempt), attemptId: d.id }));
      list.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
      setAttempts(list);

      const inProg = await fetchStudentInProgressMap(student.uid);
      setInProgressMap(inProg);

      const vocabRes = await fetchStudentPersonalVocabData(student.uid);
      setPersonalDecks(vocabRes.personalDecks);
      setPersonalFolders(vocabRes.personalFolders);
      if (vocabRes.rawPartitionState || vocabRes.personalDecks.length > 0) {
        const allDecks = [...generateDefault15TopicDecks(), ...vocabRes.personalDecks];
        const computed = computeVocabStatsFromPartition(vocabRes.rawPartitionState || {}, allDecks);
        computed.personalDecksCount = vocabRes.personalDecks.length;
        computed.personalFoldersCount = vocabRes.personalFolders.length;
        setLiveVocabStats(computed);
      }

      const mSnap = await getDoc(doc(db, 'users', student.uid, 'vocab_state', 'mistakes_notebook'));
      if (mSnap.exists() && Array.isArray(mSnap.data()?.records)) {
        setStudentMistakes(mSnap.data().records);
      }
    } catch (err) {
      console.warn('Error refreshing student detail:', err);
    } finally {
      setIsLoadingAttempts(false);
    }
  };

  if (!isOpen) return null;

  const zodiac = student.birthDate ? getZodiacFromBirthDate(student.birthDate) : null;
  const isOnline = isUserOnline(student);
  const goals: UserTargetScores = student.targetScores || {
    overall: 6.5,
    listening: 6.5,
    reading: 6.5,
    writing: 6.5,
    speaking: 6.5,
  };

  // Compute analytics
  const analytics = useMemo(() => {
    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        avgScore: 0,
        avgPercentage: 0,
        passRate: 0,
        highPassRate: 0,
        avgListening: 0,
        avgReading: 0,
        avgWriting: 0,
        avgSpeaking: 0,
        maxListening: 0,
        maxReading: 0,
        maxWriting: 0,
        maxSpeaking: 0,
        totalStudySeconds: 0,
      };
    }

    let totalScore = 0;
    let totalPercentage = 0;
    let passCount = 0;
    let highPassCount = 0;
    let totalListen = 0;
    let countListen = 0;
    let maxListen = 0;
    let totalRead = 0;
    let countRead = 0;
    let maxRead = 0;
    let totalWrite = 0;
    let countWrite = 0;
    let maxWrite = 0;
    let totalSpeak = 0;
    let countSpeak = 0;
    let maxSpeak = 0;
    let totalSec = 0;

    attempts.forEach((a) => {
      totalScore += a.score;
      totalPercentage += a.percentage || 0;
      totalSec += a.timeSpentSeconds || 0;
      if (a.percentage >= 50 || a.grade === 'Pass' || a.grade === 'High Pass') passCount++;
      if (a.percentage >= 75 || a.grade === 'High Pass') highPassCount++;

      if (typeof a.listeningScore === 'number') {
        totalListen += a.listeningScore;
        countListen++;
        if (a.listeningScore > maxListen) maxListen = a.listeningScore;
      }
      if (typeof a.readingScore === 'number') {
        totalRead += a.readingScore;
        countRead++;
        if (a.readingScore > maxRead) maxRead = a.readingScore;
      }
      if (typeof a.writingScore === 'number') {
        totalWrite += a.writingScore;
        countWrite++;
        if (a.writingScore > maxWrite) maxWrite = a.writingScore;
      }
      if (typeof a.speakingScore === 'number') {
        totalSpeak += a.speakingScore;
        countSpeak++;
        if (a.speakingScore > maxSpeak) maxSpeak = a.speakingScore;
      }
    });

    const len = attempts.length;
    return {
      totalAttempts: len,
      avgScore: Math.round((totalScore / len) * 10) / 10,
      avgPercentage: Math.round((totalPercentage / len) * 10) / 10,
      passRate: Math.round((passCount / len) * 100),
      highPassRate: Math.round((highPassCount / len) * 100),
      avgListening: countListen > 0 ? Math.round((totalListen / countListen) * 10) / 10 : 0,
      avgReading: countRead > 0 ? Math.round((totalRead / countRead) * 10) / 10 : 0,
      avgWriting: countWrite > 0 ? Math.round((totalWrite / countWrite) * 10) / 10 : 0,
      avgSpeaking: countSpeak > 0 ? Math.round((totalSpeak / countSpeak) * 10) / 10 : 0,
      maxListening: maxListen,
      maxReading: maxRead,
      maxWriting: maxWrite,
      maxSpeaking: maxSpeak,
      totalStudySeconds: totalSec,
    };
  }, [attempts]);

  // Attempt items sorted chronologically for line chart
  const chartAttempts = useMemo(() => {
    return [...attempts]
      .sort((a, b) => a.completedAt - b.completedAt)
      .slice(-10); // recent 10 attempts
  }, [attempts]);

  const activeDraft = useMemo(() => {
    const list = Object.values(inProgressMap);
    if (list.length > 0) {
      return list.sort(
        (a, b) => (b.savedAt || b.lastUpdatedAt || 0) - (a.savedAt || a.lastUpdatedAt || 0)
      )[0];
    }
    if (student.activeDraftSummary && student.activeDraftSummary.testId) {
      return {
        testId: student.activeDraftSummary.testId,
        testTitle: student.activeDraftSummary.testTitle,
        mode: student.activeDraftSummary.mode,
        elapsedSeconds: student.activeDraftSummary.elapsedSeconds || 0,
        answers: Object.fromEntries(
          Array.from({ length: student.activeDraftSummary.answeredCount || 0 }, (_, i) => [
            i + 1,
            'A',
          ])
        ),
      } as InProgressAttempt;
    }
    return null;
  }, [inProgressMap, student.activeDraftSummary]);

  const handleApplyRole = async (newRole: UserRole) => {
    if (!onRoleChange || isUpdatingRole) return;
    setIsUpdatingRole(true);
    setRoleChangeNotice(null);
    try {
      await onRoleChange(student.uid, newRole);
      setSelectedRole(newRole);
      setRoleChangeNotice(`Đã cập nhật vai trò thành: ${newRole === 'admin' ? 'Giáo viên/Admin' : newRole === 'co_teacher' ? 'Trợ giảng' : 'Học viên'}`);
      setTimeout(() => setRoleChangeNotice(null), 3000);
    } catch (err: any) {
      setRoleChangeNotice(`Lỗi: ${err?.message || 'Không thể đổi vai trò'}`);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleSaveProfileAndGoals = async () => {
    if (isSavingProfileGoals) return;
    setIsSavingProfileGoals(true);
    try {
      const normalizedGoals: UserTargetScores = {
        overall: Math.max(0, Math.min(10, Number(editGoals.overall) || 6.5)),
        listening: Math.max(0, Math.min(10, Number(editGoals.listening) || 6.5)),
        reading: Math.max(0, Math.min(10, Number(editGoals.reading) || 6.5)),
        writing: Math.max(0, Math.min(10, Number(editGoals.writing) || 6.5)),
        speaking: Math.max(0, Math.min(10, Number(editGoals.speaking) || 6.5)),
        updatedAt: Date.now(),
      };
      const profilePatch = {
        displayName: editDisplayName.trim() || student.displayName || 'Học viên VSTEP',
        nickname: editNickname.trim() || undefined,
        phone: editPhone.trim() || undefined,
        birthDate: editBirthDate.trim() || undefined,
        address: editAddress.trim() || undefined,
      };
      await updateStudentProfileAndGoals(student.uid, profilePatch, normalizedGoals);
      if (onStudentUpdated) {
        onStudentUpdated({
          ...student,
          ...profilePatch,
          targetScores: normalizedGoals,
        });
      }
      setIsEditingProfileGoals(false);
      setRoleChangeNotice('Đã lưu thông tin hồ sơ & mục tiêu điểm VSTEP trực tiếp lên Cloud Firestore!');
      setTimeout(() => setRoleChangeNotice(null), 3500);
    } catch (err: any) {
      setRoleChangeNotice(`Lỗi lưu Cloud: ${err?.message || 'Không thể lưu mục tiêu'}`);
    } finally {
      setIsSavingProfileGoals(false);
    }
  };

  const isSuperAdminEmail = Boolean(
    student.email && SUPER_ADMIN_EMAILS.includes(student.email.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL TOP HEADER */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              {student.photoURL ? (
                <img
                  src={student.photoURL}
                  alt={student.displayName || 'Avatar'}
                  className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl object-cover shadow-sm border-2 border-white dark:border-slate-700"
                />
              ) : (
                <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-tr from-[#58CC02] to-emerald-400 text-white font-black text-2xl flex items-center justify-center shadow-sm">
                  {(student.displayName || student.email || 'H').charAt(0).toUpperCase()}
                </div>
              )}
              {isOnline ? (
                <span
                  className="absolute -top-1 -right-1 flex h-4 w-4"
                  title="Đang Online trên hệ thống"
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900" />
                </span>
              ) : (
                <span
                  className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-slate-400 border-2 border-white dark:border-slate-900"
                  title="Offline"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate">
                  {student.displayName || 'Học viên VSTEP'}
                </h2>
                {student.nickname && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                    @{student.nickname}
                  </span>
                )}
                {isSuperAdminEmail ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Super Admin</span>
                  </span>
                ) : student.role === 'admin' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                    <GraduationCap className="h-3 w-3" />
                    <span>Giáo viên</span>
                  </span>
                ) : student.role === 'co_teacher' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Award className="h-3 w-3" />
                    <span>Trợ giảng</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <UserCheck className="h-3 w-3" />
                    <span>Học viên</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="truncate">{student.email || 'Chưa có email'}</span>
                </span>
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{student.phone}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                  <Radio className={`h-3 w-3 ${isOnline ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                  <span>{isOnline ? 'Đang Online' : formatRelativeActiveTime(student.lastActiveAt)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center shrink-0">
            {/* Quick role change for Admin */}
            {(isSuperAdmin || (isCurrentAdmin && !isSuperAdminEmail)) && onRoleChange && (
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-extrabold text-slate-500 pl-1.5">Vai trò:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => handleApplyRole(e.target.value as UserRole)}
                  disabled={isUpdatingRole}
                  className="text-xs font-black rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-2.5 py-1 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-[#58CC02] cursor-pointer"
                >
                  <option value="student">Học viên</option>
                  <option value="co_teacher">Trợ giảng</option>
                  <option value="admin">Giáo viên / Admin</option>
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ROLE NOTICE IF ANY */}
        {roleChangeNotice && (
          <div className="px-6 py-2 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{roleChangeNotice}</span>
          </div>
        )}

        {/* TAB NAVIGATION STRIP */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-900/80 border-b-2 border-[#E5E5E5] dark:border-slate-800 flex items-center gap-2.5 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 text-xs font-black rounded-2xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'btn-duo-green'
                : 'btn-duo-white text-slate-600 dark:text-slate-200'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>1. Biểu đồ &amp; Thống kê điểm số</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2.5 text-xs font-black rounded-2xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'btn-duo-blue'
                : 'btn-duo-white text-slate-600 dark:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>2. Đang làm &amp; Lịch sử bài thi ({attempts.length})</span>
            {activeDraft && (
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF9600] animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vocab')}
            className={`px-4 py-2.5 text-xs font-black rounded-2xl transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'vocab'
                ? 'btn-duo-purple'
                : 'btn-duo-white text-slate-600 dark:text-slate-200'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>3. Tiến độ Từ vựng (SRS)</span>
          </button>

          <div className="ml-auto shrink-0">
            <button
              type="button"
              onClick={handleRefreshStudentData}
              disabled={isLoadingAttempts}
              className="btn-duo-white inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black cursor-pointer"
              title="Đồng bộ lại dữ liệu bài nộp từ Cloud Firestore"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAttempts ? 'animate-spin text-[#1CB0F6]' : 'text-[#58CC02]'}`} />
              <span className="hidden sm:inline">Làm mới dữ liệu Cloud</span>
            </button>
          </div>
        </div>

        {/* TAB CONTENTS (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: VISUAL SCORE ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Số lượt đã hoàn thành</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                    {analytics.totalAttempts}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {analytics.totalAttempts > 0 ? `${Math.round(analytics.totalStudySeconds / 60)} phút rèn luyện` : 'Chưa có lượt thi'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm trung bình (Overall)</span>
                  <div className="text-2xl font-black text-[#2E7D32] dark:text-[#58CC02] mt-1 tabular-nums">
                    {analytics.avgPercentage}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Đúng TB: {analytics.avgScore}/75 câu
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tỷ lệ đạt chuẩn (Pass)</span>
                  <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 tabular-nums">
                    {analytics.passRate}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Chuẩn VSTEP B1 (≥ 50%)
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tỷ lệ xuất sắc (High Pass)</span>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
                    {analytics.highPassRate}%
                  </div>
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Chuẩn VSTEP B2-C1 (≥ 75%)
                  </span>
                </div>
              </div>

              {/* SVG Score Progression Line & Area Chart */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#58CC02]" />
                      <span>Biểu đồ Tiến trình Điểm thi (%) theo từng lượt</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Đường ngưỡng đạt: <strong>Pass (50%)</strong> và <strong>High Pass (75%)</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-5 bg-emerald-500 rounded-full" />
                      <span>High Pass ≥ 75%</span>
                    </span>
                    <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                      <span className="h-2 w-5 bg-amber-500 rounded-full" />
                      <span>Pass ≥ 50%</span>
                    </span>
                  </div>
                </div>

                {chartAttempts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 italic">
                    Chưa có đủ dữ liệu lịch sử thi để dựng biểu đồ tiến trình.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[500px] h-52 relative">
                      <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#58CC02" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#58CC02" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* Threshold Lines */}
                        {/* 100% Top Line */}
                        <line x1="0" y1="15" x2="500" y2="15" stroke="currentColor" strokeDasharray="2,3" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />
                        <text x="4" y="12" className="text-[9px] fill-slate-400 font-bold">100%</text>

                        {/* 75% High Pass Line */}
                        <line x1="0" y1="52" x2="500" y2="52" stroke="#10b981" strokeDasharray="4,3" strokeWidth="1.5" opacity="0.6" />
                        <text x="4" y="49" fill="#10b981" className="text-[9px] font-black">75% High Pass</text>

                        {/* 50% Pass Line */}
                        <line x1="0" y1="92" x2="500" y2="92" stroke="#f59e0b" strokeDasharray="4,3" strokeWidth="1.5" opacity="0.6" />
                        <text x="4" y="89" fill="#f59e0b" className="text-[9px] font-black">50% Pass</text>

                        {/* 0% Bottom Line */}
                        <line x1="0" y1="165" x2="500" y2="165" stroke="currentColor" className="text-slate-300 dark:text-slate-700" strokeWidth="1" />
                        <text x="4" y="162" className="text-[9px] fill-slate-400 font-bold">0%</text>

                        {/* Area Polygon and Polyline */}
                        {(() => {
                          const points = chartAttempts.map((att, i) => {
                            const x = chartAttempts.length === 1 ? 250 : 25 + (i * 450) / (chartAttempts.length - 1);
                            const clampedPct = Math.max(0, Math.min(100, att.percentage || 0));
                            // Map 0% -> y=165, 100% -> y=15
                            const y = 165 - (clampedPct / 100) * 150;
                            return { x, y, att };
                          });

                          const pathData = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                          const areaData = `${pathData} L ${points[points.length - 1].x} 165 L ${points[0].x} 165 Z`;

                          return (
                            <>
                              <path d={areaData} fill="url(#scoreGrad)" />
                              <path d={pathData} fill="none" stroke="#58CC02" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r="5" fill="#58CC02" stroke="#ffffff" strokeWidth="2" className="hover:scale-125 transition-transform" />
                                  <text x={p.x} y={p.y - 9} textAnchor="middle" className="text-[10px] font-black fill-slate-900 dark:fill-white tabular-nums">
                                    {Math.round(p.att.percentage)}%
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Skill Comparison Bar Chart (Listening, Reading, Writing, Speaking) */}
              <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-[#58CC02]" />
                  <span>Đối chiếu Năng lực 4 Kỹ năng (Điểm Thực tế vs Mục tiêu VSTEP)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Listening */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                        <Headphones className="h-3.5 w-3.5" />
                        <span>1. Listening</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {goals.listening.toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgListening}/35 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgListening / 35) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-sky-600 dark:text-sky-400 tabular-nums">
                            {analytics.maxListening}/35 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxListening / 35) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reading */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>2. Reading</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {goals.reading.toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgReading}/40 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgReading / 40) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {analytics.maxReading}/40 câu
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxReading / 40) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Writing */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <PenTool className="h-3.5 w-3.5" />
                        <span>3. Writing</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {goals.writing.toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgWriting > 0 ? `${analytics.avgWriting}/10` : 'Chưa chấm'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgWriting / 10) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-purple-600 dark:text-purple-400 tabular-nums">
                            {analytics.maxWriting > 0 ? `${analytics.maxWriting}/10` : 'Chưa có'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxWriting / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Speaking */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-black text-slate-900 dark:text-white mb-2">
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Mic className="h-3.5 w-3.5" />
                        <span>4. Speaking</span>
                      </span>
                      <span className="tabular-nums">Mục tiêu: {(goals.speaking ?? 6.5).toFixed(1)}/10</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Điểm TB đạt:</span>
                          <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                            {analytics.avgSpeaking > 0 ? `${analytics.avgSpeaking}/10` : 'Chưa chấm'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.avgSpeaking / 10) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-0.5">
                          <span>Cao nhất:</span>
                          <strong className="text-amber-600 dark:text-amber-400 tabular-nums">
                            {analytics.maxSpeaking > 0 ? `${analytics.maxSpeaking}/10` : 'Chưa có'}
                          </strong>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${Math.min(100, (analytics.maxSpeaking / 10) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Target vs Actual Table */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-black text-xs text-slate-800 dark:text-slate-200">
                  Bảng Tổng hợp Tiến độ Mục tiêu VSTEP (Thang điểm 10)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                        <th className="p-3">Kỹ năng</th>
                        <th className="p-3">Mục tiêu đã đặt</th>
                        <th className="p-3">Điểm TB thực tế</th>
                        <th className="p-3">Điểm cao nhất</th>
                        <th className="p-3">Đánh giá tiến độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-300">
                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <Headphones className="h-3.5 w-3.5 text-sky-500" />
                          <span>Listening (35 câu)</span>
                        </td>
                        <td className="p-3 font-bold">{goals.listening.toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgListening > 0 ? `${analytics.avgListening}/35` : '-'}</td>
                        <td className="p-3 font-bold text-sky-600">{analytics.maxListening > 0 ? `${analytics.maxListening}/35` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxListening >= (goals.listening / 10) * 35 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[11px]">Cần cố gắng thêm</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Reading (40 câu)</span>
                        </td>
                        <td className="p-3 font-bold">{goals.reading.toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgReading > 0 ? `${analytics.avgReading}/40` : '-'}</td>
                        <td className="p-3 font-bold text-emerald-600">{analytics.maxReading > 0 ? `${analytics.maxReading}/40` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxReading >= (goals.reading / 10) * 40 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-amber-600 font-bold text-[11px]">Cần cố gắng thêm</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <PenTool className="h-3.5 w-3.5 text-purple-500" />
                          <span>Writing (Task 1 &amp; 2)</span>
                        </td>
                        <td className="p-3 font-bold">{goals.writing.toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgWriting > 0 ? `${analytics.avgWriting}/10` : '-'}</td>
                        <td className="p-3 font-bold text-purple-600">{analytics.maxWriting > 0 ? `${analytics.maxWriting}/10` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxWriting >= goals.writing ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[11px]">Đang theo dõi</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="p-3 flex items-center gap-2 font-black text-slate-900 dark:text-white">
                          <Mic className="h-3.5 w-3.5 text-amber-500" />
                          <span>Speaking (Part 1, 2, 3)</span>
                        </td>
                        <td className="p-3 font-bold">{(goals.speaking ?? 6.5).toFixed(1)}/10</td>
                        <td className="p-3">{analytics.avgSpeaking > 0 ? `${analytics.avgSpeaking}/10` : '-'}</td>
                        <td className="p-3 font-bold text-amber-600">{analytics.maxSpeaking > 0 ? `${analytics.maxSpeaking}/10` : '-'}</td>
                        <td className="p-3">
                          {analytics.maxSpeaking >= (goals.speaking ?? 6.5) ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-black text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Đã đạt mục tiêu
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold text-[11px]">Đang theo dõi</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Teacher Direct Edit Panel: Student Personal Profile & VSTEP Target Scores */}
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#58CC02]" />
                      <span>Cập nhật Hồ sơ Cá nhân &amp; Mục tiêu VSTEP (Đồng bộ 2 chiều Cloud)</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Giáo viên/Admin có thể chỉnh sửa trực tiếp thông tin liên hệ và mục tiêu điểm VSTEP (Thang 10) vào <code className="font-mono">users/&#123;uid&#125;</code> và <code className="font-mono">user_target_scores/&#123;uid&#125;</code>.
                    </p>
                  </div>

                  {!isEditingProfileGoals ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfileGoals(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#58CC02]" />
                      <span>Chỉnh sửa Hồ sơ &amp; Mục tiêu</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingProfileGoals(false)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveProfileAndGoals}
                        disabled={isSavingProfileGoals}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#58CC02] hover:bg-[#46a302] text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>{isSavingProfileGoals ? 'Đang lưu Cloud...' : 'Lưu vào Cloud Firestore'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {isEditingProfileGoals ? (
                  <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Họ và tên học viên
                        </label>
                        <input
                          type="text"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Biệt danh (Nickname)
                        </label>
                        <input
                          type="text"
                          value={editNickname}
                          onChange={(e) => setEditNickname(e.target.value)}
                          placeholder="VD: Minh VSTEP"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Số điện thoại
                        </label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="09xx xxx xxx"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Ngày sinh (YYYY-MM-DD)
                        </label>
                        <input
                          type="date"
                          value={editBirthDate}
                          onChange={(e) => setEditBirthDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Địa chỉ / Trường học / Đơn vị
                        </label>
                        <input
                          type="text"
                          value={editAddress}
                          onChange={(e) => setEditAddress(e.target.value)}
                          placeholder="Hà Nội / TP.HCM..."
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-xs">
                      {(
                        [
                          { key: 'overall', label: 'Overall (0-10)' },
                          { key: 'listening', label: 'Listening (0-10)' },
                          { key: 'reading', label: 'Reading (0-10)' },
                          { key: 'writing', label: 'Writing (0-10)' },
                          { key: 'speaking', label: 'Speaking (0-10)' },
                        ] as const
                      ).map((item) => (
                        <div key={item.key}>
                          <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                            {item.label}
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="10"
                            value={editGoals[item.key] ?? 6.5}
                            onChange={(e) =>
                              setEditGoals((prev) => ({
                                ...prev,
                                [item.key]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-black text-[#2E7D32] dark:text-[#58CC02] tabular-nums focus:border-[#58CC02] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block">Số điện thoại</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {student.phone || 'Chưa cập nhật'}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block">Ngày sinh &amp; Cung</span>
                      <span className="font-black text-slate-800 dark:text-slate-200">
                        {student.birthDate || 'Chưa cập nhật'}{' '}
                        {zodiac ? `(${zodiac.branchName})` : ''}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block">Địa chỉ</span>
                      <span className="font-black text-slate-800 dark:text-slate-200 truncate block">
                        {student.address || 'Chưa cập nhật'}
                      </span>
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block">XP &amp; Chuỗi ngày học</span>
                      <span className="font-black text-amber-600 dark:text-amber-400 tabular-nums">
                        {student.leaderboardStats?.xp || student.vocabStats?.totalCoins || 0} XP ·{' '}
                        {student.leaderboardStats?.streakDays || student.currentStreak || 0} ngày
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: IN-PROGRESS & EXAM HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-5">
              {/* Active Draft Alert Card */}
              {activeDraft && (
                <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                        Bài thi đang làm dở (Chưa nộp)
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                      {resolveTestTitle(activeDraft.testId, activeDraft.testTitle)}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
                      <span>Đã làm: <strong>{Object.keys(activeDraft.answers || {}).length}/75</strong> câu trắc nghiệm</span>
                      {activeDraft.activeQuestionId ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/80 text-amber-950 dark:text-amber-200 font-black">
                          Đang đứng ở câu #{activeDraft.activeQuestionId}
                        </span>
                      ) : null}
                      {(activeDraft.writingDraft?.task1WordCount || activeDraft.writingDraft?.task2WordCount) ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 font-bold">
                          Nháp Writing: {(activeDraft.writingDraft?.task1WordCount || 0) + (activeDraft.writingDraft?.task2WordCount || 0)} từ
                        </span>
                      ) : null}
                      {(activeDraft.speakingDraft?.part1Text || activeDraft.speakingDraft?.part2Text || activeDraft.speakingDraft?.part3Text) ? (
                        <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/70 text-sky-800 dark:text-sky-300 font-bold">
                          Nháp Speaking đã lưu Cloud
                        </span>
                      ) : null}
                      <span>Đã làm: {Math.round(activeDraft.elapsedSeconds / 60)} phút</span>
                      {(activeDraft.timeRemainingSeconds || activeDraft.remainingSeconds) ? (
                        <span>Còn lại: {Math.round(((activeDraft.timeRemainingSeconds || activeDraft.remainingSeconds || 0)) / 60)} phút</span>
                      ) : null}
                    </p>
                  </div>

                  {onOpenTest && (
                    <button
                      type="button"
                      onClick={() => onOpenTest(activeDraft.testId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Mở đề kiểm tra</span>
                    </button>
                  )}
                </div>
              )}

              {/* Completed Exam Attempts List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#58CC02]" />
                    <span>Lịch sử các lượt bài đã nộp ({attempts.length} lượt)</span>
                  </h3>
                </div>

                {isLoadingAttempts ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-bold">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#58CC02]" />
                    <span>Đang tải danh sách bài làm của học viên...</span>
                  </div>
                ) : attempts.length === 0 ? (
                  <div className="p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    Học viên chưa nộp bài thi nào trên hệ thống.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attempts.map((att, idx) => {
                      const title = resolveTestTitle(att.testId, att.testTitle);
                      return (
                        <div
                          key={att.attemptId || idx}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-[#58CC02] dark:hover:border-[#58CC02] transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                {title}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                  att.mode === 'exam'
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                    : 'bg-lime-100 text-[#2B6601] dark:bg-emerald-950/70 dark:text-lime-300'
                                }`}
                              >
                                {att.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                  att.grade === 'High Pass'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : att.grade === 'Pass'
                                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                }`}
                              >
                                {att.grade || 'Pass'}
                              </span>
                              {att.aiWritingEvaluation && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
                                  AI Writing
                                </span>
                              )}
                              {att.aiSpeakingEvaluation && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                                  AI Speaking
                                </span>
                              )}
                              {typeof att.tabSwitchCount === 'number' && att.tabSwitchCount > 0 && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                                  Rời tab: {att.tabSwitchCount} lần
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4 flex-wrap tabular-nums">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(att.completedAt).toLocaleString('vi-VN')}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{Math.round(att.timeSpentSeconds / 60)} phút</span>
                              </span>
                              <span>
                                Tổng đúng: <strong className="text-[#2E7D32] dark:text-[#58CC02]">{att.score}/{att.totalQuestions}</strong> ({Math.round(att.percentage)}%)
                              </span>
                              {typeof att.vstepBandScore === 'number' && (
                                <span>
                                  Band: <strong className="text-slate-900 dark:text-white">{att.vstepBandScore.toFixed(1)}/10</strong>
                                </span>
                              )}
                              {typeof att.listeningScore === 'number' && (
                                <span>Nghe: {att.listeningScore}/35</span>
                              )}
                              {typeof att.readingScore === 'number' && (
                                <span>Đọc: {att.readingScore}/40</span>
                              )}
                              {typeof att.speakingScore === 'number' && (
                                <span>Nói: {att.speakingScore.toFixed(1)}/10</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                            <button
                              type="button"
                              onClick={() => setSelectedAttemptDetail(att)}
                              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black transition-colors cursor-pointer"
                            >
                              Xem đáp án &amp; Tự luận
                            </button>
                            {onOpenTest && (
                              <button
                                type="button"
                                onClick={() => onOpenTest(att.testId)}
                                className="p-2 rounded-xl text-slate-400 hover:text-[#58CC02] hover:bg-lime-50 dark:hover:bg-slate-800 transition-colors"
                                title="Mở đề thi này"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Student Cloud Mistake Notebook Inspector for Teachers */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500" />
                    <span>
                      Sổ Tay Câu Hỏi Hay Sai Của Học Viên ({studentMistakes.length} câu đã ghi nhận Cloud)
                    </span>
                  </h3>
                  {studentMistakes.length > 0 && (
                    <div className="flex items-center gap-2 text-[11px] font-black tabular-nums">
                      <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                        Cần ôn lại: {studentMistakes.filter((m) => !m.mastered).length} câu
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                        Đã nắm vững: {studentMistakes.filter((m) => m.mastered).length} câu
                      </span>
                    </div>
                  )}
                </div>

                {studentMistakes.length === 0 ? (
                  <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                    Chưa có bản ghi Sổ tay câu sai trên Cloud cho học viên này.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {studentMistakes.slice(0, 24).map((m, mIdx) => (
                      <div
                        key={m.key || mIdx}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 dark:text-white truncate">
                            [{m.section === 'LISTENING' ? 'Nghe' : 'Đọc'} · Part {m.partNumber}] {m.testTitle}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                              m.mastered
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {m.mastered ? 'Đã thuộc' : `Sai ${m.wrongCount || 1} lần`}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 font-semibold line-clamp-2">
                          Câu {m.questionNumber || m.questionId}: {m.prompt}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] font-mono pt-0.5">
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            Chọn sai: {m.userAnswer || '--'}
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-400 font-black">
                            Đáp án đúng: {m.correctAnswer}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SRS VOCABULARY TRACKING */}
          {activeTab === 'vocab' && (
            <div className="space-y-5">
              {/* 4 Vocab KPI Summary Cards */}
              {(() => {
                const vocab: UserVocabStats = liveVocabStats ||
                  student.vocabStats || {
                    totalWords: 850,
                    masteredCount: 0,
                    learningCount: 0,
                    totalDecks: 15,
                    lastStudiedDeckName: undefined,
                    lastStudiedAt: undefined,
                    decks: [],
                    updatedAt: Date.now(),
                  };

                const masteryPct =
                  vocab.totalWords > 0
                    ? Math.round((vocab.masteredCount / vocab.totalWords) * 100)
                    : 0;

                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          Đã thuộc (Mastered Lv4-5)
                        </span>
                        <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
                          {vocab.masteredCount} từ
                        </div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                          Đạt {masteryPct}% kho từ
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                          Đang ghi nhớ (Learning Lv1-3)
                        </span>
                        <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1 tabular-nums">
                          {vocab.learningCount} từ
                        </div>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5">
                          Đang trong chu kỳ Anki
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Tổng vốn từ vựng
                        </span>
                        <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                          {vocab.totalWords} từ
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Trong {vocab.totalDecks} bộ thẻ từ
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Bộ từ học gần nhất
                        </span>
                        <div
                          className="text-xs font-black text-slate-900 dark:text-white mt-1 truncate"
                          title={vocab.lastStudiedDeckName}
                        >
                          {vocab.lastStudiedDeckName || 'Chưa ghi nhận phiên học'}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatRelativeActiveTime(vocab.lastStudiedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Overall Progress Bar */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-xs font-black mb-1.5">
                        <span className="text-slate-700 dark:text-slate-300">
                          Tiến độ Làm chủ Từ vựng VSTEP:
                        </span>
                        <span className="text-[#2E7D32] dark:text-[#58CC02]">
                          {masteryPct}% ({vocab.masteredCount}/{vocab.totalWords} từ)
                        </span>
                      </div>
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-[#58CC02]"
                          style={{ width: `${masteryPct}%` }}
                          title={`Đã thuộc: ${vocab.masteredCount} từ`}
                        />
                        <div
                          className="h-full bg-amber-400"
                          style={{
                            width: `${Math.min(
                              100 - masteryPct,
                              vocab.totalWords > 0
                                ? (vocab.learningCount / vocab.totalWords) * 100
                                : 0
                            )}%`,
                          }}
                          title={`Đang học: ${vocab.learningCount} từ`}
                        />
                      </div>
                    </div>

                    {/* 6-Level Anki SRS Memory Breakdown (lv0 -> lv5) */}
                    {vocab.levelBreakdown && (
                      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                            <Flame className="h-4 w-4 text-amber-500" />
                            <span>Phân bổ 6 Cấp độ Trí nhớ Anki SRS (Lv0 &rarr; Lv5)</span>
                          </h4>
                          {typeof vocab.dueWordsCount === 'number' && (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-[11px] font-black">
                              Cần ôn tập hôm nay: {vocab.dueWordsCount} từ
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs tabular-nums">
                          {[
                            { lv: 'lv0', label: 'Lv0 · Chưa học', val: vocab.levelBreakdown.lv0, color: 'text-slate-500 bg-slate-50 dark:bg-slate-800/60' },
                            { lv: 'lv1', label: 'Lv1 · Mới gặp', val: vocab.levelBreakdown.lv1, color: 'text-rose-600 bg-rose-50/70 dark:bg-rose-950/40' },
                            { lv: 'lv2', label: 'Lv2 · Đang nhớ', val: vocab.levelBreakdown.lv2, color: 'text-amber-600 bg-amber-50/70 dark:bg-amber-950/40' },
                            { lv: 'lv3', label: 'Lv3 · Tạm nhớ', val: vocab.levelBreakdown.lv3, color: 'text-sky-600 bg-sky-50/70 dark:bg-sky-950/40' },
                            { lv: 'lv4', label: 'Lv4 · Thành thạo', val: vocab.levelBreakdown.lv4, color: 'text-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40' },
                            { lv: 'lv5', label: 'Lv5 · Thuộc lòng', val: vocab.levelBreakdown.lv5, color: 'text-[#2E7D32] dark:text-[#58CC02] bg-lime-50/80 dark:bg-lime-950/40' },
                          ].map((b) => (
                            <div
                              key={b.lv}
                              className={`p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 ${b.color}`}
                            >
                              <span className="block text-[10px] font-bold opacity-80">{b.label}</span>
                              <strong className="text-base font-black block mt-0.5">{b.val}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Study Sessions List */}
                    {Array.isArray(vocab.recentSessions) && vocab.recentSessions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-indigo-500" />
                          <span>Lịch sử các phiên học từ vựng gần nhất ({vocab.recentSessions.length} phiên)</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {vocab.recentSessions.slice(0, 6).map((sess, idx) => (
                            <div
                              key={sess.sessionId || idx}
                              className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="font-black text-slate-900 dark:text-white truncate">
                                  {sess.deckTitle}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  Chế độ: <strong className="uppercase">{sess.mode}</strong> · {formatRelativeActiveTime(sess.completedAt)}
                                </div>
                              </div>
                              <div className="text-right shrink-0 tabular-nums">
                                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black text-[11px]">
                                  {sess.correctWords}/{sess.totalWords} ({sess.accuracy}%)
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Decks Breakdown List */}
                    <div>
                      <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-[#58CC02]" />
                        <span>Danh sách các bộ thẻ từ vựng đã học</span>
                      </h4>

                      {(vocab.decks || []).length === 0 ? (
                        <div className="p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                          Học viên chưa ghi nhận phiên học từ vựng B1 nào trên hệ thống.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {(vocab.decks || []).map((deck: any) => {
                            const pct =
                              deck.totalWords > 0
                                ? Math.round((deck.masteredWords / deck.totalWords) * 100)
                                : 0;
                            return (
                              <div
                                key={deck.id}
                                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-xs font-black text-slate-900 dark:text-white truncate">
                                      {deck.name}
                                    </h5>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                      {deck.categoryLabel}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 mt-0.5 block tabular-nums">
                                    Đã thuộc: <strong>{deck.masteredWords}</strong>/{deck.totalWords}{' '}
                                    từ · Đang học: {deck.learningWords} từ
                                  </span>
                                </div>

                                <div className="w-full sm:w-44 shrink-0">
                                  <div className="flex items-center justify-between text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                                    <span>{pct}%</span>
                                    <span>
                                      {deck.masteredWords}/{deck.totalWords}
                                    </span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#58CC02] rounded-full"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Personal Vocabulary Folders & Custom Decks Created by Student */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                          <Folder className="h-4 w-4 text-amber-500" />
                          <span>
                            Thư mục &amp; Bộ từ vựng cá nhân do học viên tự tạo ({personalDecks.length} bộ từ · {personalFolders.length} thư mục)
                          </span>
                        </h4>

                        <div className="flex items-center gap-2 flex-wrap">
                          {typeof syncedAudioVolume === 'number' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                              <Volume2 className="h-3.5 w-3.5 text-[#58CC02]" />
                              <span>Âm lượng từ vựng: {syncedAudioVolume}%</span>
                            </span>
                          )}
                          {student.preferences?.themeMode && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                              {student.preferences.themeMode === 'dark' ? (
                                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                              ) : (
                                <Sun className="h-3.5 w-3.5 text-amber-500" />
                              )}
                              <span>Giao diện: {student.preferences.themeMode === 'dark' ? 'Tối' : student.preferences.themeMode === 'light' ? 'Sáng' : 'Hệ thống'}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Folders Pills */}
                      {personalFolders.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {personalFolders.map((folder) => {
                            const countInFolder = personalDecks.filter(
                              (d) => d.folderId === folder.id
                            ).length;
                            return (
                              <div
                                key={folder.id}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs"
                              >
                                <Folder className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="font-black text-amber-900 dark:text-amber-200">
                                  {folder.name}
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-200/70 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-black">
                                  {countInFolder} bộ
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Custom Personal Decks List */}
                      {personalDecks.length === 0 ? (
                        <div className="p-6 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
                          Học viên chưa tự tạo bộ từ vựng cá nhân nào trên Cloud.
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {personalDecks.map((pDeck) => {
                            const folderObj = personalFolders.find((f) => f.id === pDeck.folderId);
                            const isExpanded = expandedPersonalDeckId === pDeck.id;
                            const wordsList: any[] = Array.isArray(pDeck.words)
                              ? pDeck.words
                              : Array.isArray(pDeck.items)
                              ? pDeck.items
                              : [];
                            return (
                              <div
                                key={pDeck.id}
                                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden"
                              >
                                <div
                                  onClick={() =>
                                    setExpandedPersonalDeckId(isExpanded ? null : pDeck.id)
                                  }
                                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className="text-xs font-black text-slate-900 dark:text-white">
                                        {pDeck.name}
                                      </h5>
                                      {folderObj && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                                          <Folder className="h-2.5 w-2.5" />
                                          <span>{folderObj.name}</span>
                                        </span>
                                      )}
                                      {pDeck.categoryTag && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                                          {pDeck.categoryTag}
                                        </span>
                                      )}
                                    </div>
                                    {pDeck.description && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                        {pDeck.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                                    <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">
                                      {wordsList.length} từ vựng
                                    </span>
                                    <button
                                      type="button"
                                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                                      title="Xem danh sách từ trong bộ này"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && (
                                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-3.5 max-h-64 overflow-y-auto">
                                    {wordsList.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic text-center py-2">
                                        Bộ từ này chưa có từ vựng nào.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {wordsList.map((w: any, idx: number) => (
                                          <div
                                            key={w.id || idx}
                                            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="font-black text-slate-900 dark:text-white">
                                                {w.word}
                                                {w.pos ? (
                                                  <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                                                    ({w.pos})
                                                  </span>
                                                ) : null}
                                              </span>
                                              {w.ipa && (
                                                <span className="text-[11px] font-mono text-slate-400">
                                                  {w.ipa}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                                              {w.meaningVi}
                                            </div>
                                            {w.exampleEn && (
                                              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic mt-1 line-clamp-2">
                                                &ldquo;{w.exampleEn}&rdquo;
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-slate-400 font-semibold truncate">
            UID: <code className="font-mono">{student.uid}</code>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* SUB-MODAL: ATTEMPT DETAIL REVIEW */}
      {selectedAttemptDetail && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
          onClick={() => setSelectedAttemptDetail(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 shadow-2xl border-2 border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Chi tiết bài làm: {resolveTestTitle(selectedAttemptDetail.testId, selectedAttemptDetail.testTitle)}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Hoàn thành: {new Date(selectedAttemptDetail.completedAt).toLocaleString('vi-VN')} · Đúng {selectedAttemptDetail.score}/{selectedAttemptDetail.totalQuestions} câu ({Math.round(selectedAttemptDetail.percentage)}%)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttemptDetail(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Anti-Cheat Cross-Reference Audit Badge for Teachers */}
              {selectedAttemptDetail.mode === 'exam' && (selectedAttemptDetail.practicedQuestionsCount || 0) > 0 ? (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-800 p-3.5 flex items-start gap-3 text-xs text-amber-950 dark:text-amber-100">
                  <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <span>Cảnh báo đối chiếu luyện tập (Anti-Cheat Practice Audit)</span>
                    </div>
                    <p className="mt-1 leading-relaxed">
                      Học viên đã làm trước{' '}
                      <strong className="font-black text-amber-800 dark:text-amber-300">
                        {selectedAttemptDetail.practicedQuestionsCount} câu
                      </strong>{' '}
                      trong chế độ Luyện tập của bộ đề này trước khi hoàn thành bài thi thử chính thức.
                    </p>
                  </div>
                </div>
              ) : selectedAttemptDetail.mode === 'exam' ? (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 p-3 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200 font-bold">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Bài thi thử độc lập: Học sinh làm bài trực tiếp, không có dữ liệu luyện tập trước.</span>
                </div>
              ) : (
                <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 p-3 flex items-center gap-2 text-xs text-sky-900 dark:text-sky-200 font-bold">
                  <Lock className="h-4 w-4 text-sky-600 shrink-0" />
                  <span>Chế độ Luyện tập: Đã chốt đáp án &amp; lưu tự động tức thì lên Cloud Firestore.</span>
                </div>
              )}

              {/* Tab Switch Proctoring Alert for Teachers */}
              {typeof selectedAttemptDetail.tabSwitchCount === 'number' &&
                selectedAttemptDetail.tabSwitchCount > 0 && (
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 p-3.5 flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200">
                    <div className="flex items-center gap-2.5 font-bold">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>
                        Cảnh báo Giám sát Phòng thi VSTEP: Học viên đã chuyển sang tab/cửa sổ khác{' '}
                        <strong className="font-black underline">
                          {selectedAttemptDetail.tabSwitchCount} lần
                        </strong>{' '}
                        trong quá trình làm bài.
                      </span>
                    </div>
                  </div>
                )}

              {/* Detailed 75-Question Answer vs Official Key & Explanation Inspector */}
              {(() => {
                const rawAnswers = selectedAttemptDetail.answers || {};
                const totalQCount = Math.max(
                  selectedAttemptDetail.totalQuestions || 75,
                  Object.keys(reviewQuestionsMap).length || 75
                );
                const questionNumbers = Array.from({ length: totalQCount }, (_, i) => i + 1);

                const normalizeAns = (v: any): string =>
                  v !== undefined && v !== null ? String(v).trim().toUpperCase() : '';

                const isQuestionCorrect = (qNum: number): boolean | null => {
                  const studentAns = normalizeAns(rawAnswers[qNum]);
                  if (!studentAns) return null;
                  const qObj = reviewQuestionsMap[qNum];
                  if (!qObj || !qObj.correctAnswer) return true;
                  if (Array.isArray(qObj.correctAnswer)) {
                    return qObj.correctAnswer.some((ca) => normalizeAns(ca) === studentAns);
                  }
                  return normalizeAns(qObj.correctAnswer) === studentAns;
                };

                const filteredQNums = questionNumbers.filter((qNum) => {
                  const status = isQuestionCorrect(qNum);
                  if (reviewAnswerFilter === 'wrong') return status === false;
                  if (reviewAnswerFilter === 'correct') return status === true;
                  if (reviewAnswerFilter === 'unanswered') return status === null;
                  return true;
                });

                const wrongCount = questionNumbers.filter((n) => isQuestionCorrect(n) === false).length;
                const correctCount = questionNumbers.filter((n) => isQuestionCorrect(n) === true).length;
                const unansweredCount = questionNumbers.filter((n) => isQuestionCorrect(n) === null).length;

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-xs font-black uppercase text-slate-600 dark:text-slate-300">
                        Đối chiếu chi tiết {totalQCount} câu hỏi (Đáp án Học viên chọn vs Đáp án chuẩn &amp; Giải thích):
                      </h4>

                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        <button
                          type="button"
                          onClick={() => setReviewAnswerFilter('all')}
                          className={`px-2.5 py-1 rounded-lg font-black cursor-pointer ${
                            reviewAnswerFilter === 'all'
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Tất cả ({totalQCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewAnswerFilter('wrong')}
                          className={`px-2.5 py-1 rounded-lg font-black cursor-pointer ${
                            reviewAnswerFilter === 'wrong'
                              ? 'bg-rose-600 text-white'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          Làm sai ({wrongCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewAnswerFilter('correct')}
                          className={`px-2.5 py-1 rounded-lg font-black cursor-pointer ${
                            reviewAnswerFilter === 'correct'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          Làm đúng ({correctCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewAnswerFilter('unanswered')}
                          className={`px-2.5 py-1 rounded-lg font-black cursor-pointer ${
                            reviewAnswerFilter === 'unanswered'
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          Bỏ trống ({unansweredCount})
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                      {filteredQNums.map((qNum) => {
                        const studentAns = normalizeAns(rawAnswers[qNum]);
                        const qObj = reviewQuestionsMap[qNum];
                        const officialAns = qObj?.correctAnswer
                          ? Array.isArray(qObj.correctAnswer)
                            ? qObj.correctAnswer.join(' / ')
                            : String(qObj.correctAnswer)
                          : '';
                        const status = isQuestionCorrect(qNum);
                        const isSelected = expandedQuestionId === qNum;

                        return (
                          <button
                            key={qNum}
                            type="button"
                            onClick={() =>
                              setExpandedQuestionId(isSelected ? null : qNum)
                            }
                            className={`rounded-xl border p-2 text-left transition-all cursor-pointer ${
                              isSelected ? 'ring-2 ring-[#58CC02] ' : ''
                            }${
                              status === true
                                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40'
                                : status === false
                                ? 'border-rose-300 dark:border-rose-800 bg-rose-50/70 dark:bg-rose-950/40'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50'
                            }`}
                            title="Bấm để xem câu hỏi, đáp án chuẩn và giải thích chi tiết"
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                              <span>Câu {qNum}</span>
                              <span>{qObj?.section === 'LISTENING' ? 'Nghe' : qObj?.section === 'READING' ? 'Đọc' : ''}</span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-1 text-xs font-black tabular-nums">
                              <span
                                className={
                                  status === true
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : status === false
                                    ? 'text-rose-600 dark:text-rose-400 line-through'
                                    : 'text-slate-400'
                                }
                              >
                                {studentAns || '--'}
                              </span>
                              {status === false && officialAns && (
                                <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                                  &rarr; {officialAns}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Expanded Question Explanation Card */}
                    {expandedQuestionId && reviewQuestionsMap[expandedQuestionId] && (
                      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 p-4 border-2 border-[#58CC02] text-xs space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 dark:text-white">
                            Chi tiết Câu {expandedQuestionId} ({reviewQuestionsMap[expandedQuestionId].section} · Part {reviewQuestionsMap[expandedQuestionId].partNumber})
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedQuestionId(null)}
                            className="text-slate-400 hover:text-slate-700 text-[11px] font-bold cursor-pointer"
                          >
                            Đóng chi tiết ✕
                          </button>
                        </div>
                        {reviewQuestionsMap[expandedQuestionId].prompt && (
                          <p className="font-bold text-slate-800 dark:text-slate-100">
                            {reviewQuestionsMap[expandedQuestionId].prompt}
                          </p>
                        )}
                        {Array.isArray(reviewQuestionsMap[expandedQuestionId].options) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {reviewQuestionsMap[expandedQuestionId].options!.map((opt) => {
                              const stuAns = normalizeAns(rawAnswers[expandedQuestionId]);
                              const corrAns = normalizeAns(reviewQuestionsMap[expandedQuestionId].correctAnswer);
                              const isCorrectOpt = opt.id.toUpperCase() === corrAns;
                              const isStuOpt = opt.id.toUpperCase() === stuAns;
                              return (
                                <div
                                  key={opt.id}
                                  className={`p-2 rounded-xl border text-[11px] ${
                                    isCorrectOpt
                                      ? 'border-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 font-black text-emerald-950 dark:text-emerald-200'
                                      : isStuOpt
                                      ? 'border-rose-400 bg-rose-100/70 dark:bg-rose-950/60 font-bold text-rose-900 dark:text-rose-200'
                                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <strong>{opt.id}.</strong> {opt.text}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {reviewQuestionsMap[expandedQuestionId].explanation && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 leading-relaxed">
                            <strong className="text-[#2E7D32] dark:text-[#58CC02]">Giải thích đáp án: </strong>
                            {reviewQuestionsMap[expandedQuestionId].explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Writing Tasks */}
              {selectedAttemptDetail.writingSubmission && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <PenTool className="h-4 w-4" />
                    <span>Bài làm Writing (Tự luận):</span>
                  </h4>

                  {selectedAttemptDetail.writingSubmission.task1Text && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1.5">
                        Task 1 (Email / Thư) — {selectedAttemptDetail.writingSubmission.task1WordCount || selectedAttemptDetail.writingSubmission.task1Text.split(/\s+/).filter(Boolean).length} từ
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-[11px]">
                        {selectedAttemptDetail.writingSubmission.task1Text}
                      </p>
                    </div>
                  )}

                  {selectedAttemptDetail.writingSubmission.task2Text && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 text-xs">
                      <div className="font-black text-slate-900 dark:text-white mb-1.5">
                        Task 2 (Essay / Luận học thuật) — {selectedAttemptDetail.writingSubmission.task2WordCount || selectedAttemptDetail.writingSubmission.task2Text.split(/\s+/).filter(Boolean).length} từ
                      </div>
                      <p className="whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed font-mono text-[11px]">
                        {selectedAttemptDetail.writingSubmission.task2Text}
                      </p>
                    </div>
                  )}

                  {/* Saved AI Writing Examiner Evaluation */}
                  {selectedAttemptDetail.aiWritingEvaluation && (
                    <div className="rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 p-4 border border-purple-200 dark:border-purple-800/70 text-xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-purple-600" />
                          <span>Kết quả Giám khảo AI Writing (Đã lưu Cloud)</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-purple-200/80 dark:bg-purple-900 text-purple-900 dark:text-purple-100 font-black text-[11px]">
                          Task 1: {selectedAttemptDetail.aiWritingEvaluation.task1Score ?? '-'} · Task 2: {selectedAttemptDetail.aiWritingEvaluation.task2Score ?? '-'}
                        </span>
                      </div>
                      {selectedAttemptDetail.aiWritingEvaluation.task1Criteria?.feedback && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900">
                          <strong className="text-purple-800 dark:text-purple-300">Nhận xét Task 1: </strong>
                          {selectedAttemptDetail.aiWritingEvaluation.task1Criteria.feedback}
                        </div>
                      )}
                      {selectedAttemptDetail.aiWritingEvaluation.task2Criteria?.feedback && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900">
                          <strong className="text-purple-800 dark:text-purple-300">Nhận xét Task 2: </strong>
                          {selectedAttemptDetail.aiWritingEvaluation.task2Criteria.feedback}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Speaking Submissions */}
              {selectedAttemptDetail.speakingSubmission && (
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Mic className="h-4 w-4" />
                    <span>Bài làm Speaking (Ghi âm Cloud &amp; Transcript):</span>
                  </h4>

                  {(selectedAttemptDetail.speakingSubmission.part1Transcript ||
                    selectedAttemptDetail.speakingSubmission.part1Text ||
                    resolvedSpeakingUrls.part1 ||
                    selectedAttemptDetail.speakingSubmission.part1AudioDataUrl) && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white">
                          Part 1: Social Interaction
                        </span>
                        {selectedAttemptDetail.speakingSubmission.part1DurationSec ? (
                          <span className="text-[10px] font-bold text-slate-500">
                            Thời lượng: {selectedAttemptDetail.speakingSubmission.part1DurationSec}s
                          </span>
                        ) : null}
                      </div>
                      {(resolvedSpeakingUrls.part1 ||
                        selectedAttemptDetail.speakingSubmission.part1AudioDataUrl) && (
                        <audio
                          controls
                          src={
                            resolvedSpeakingUrls.part1 ||
                            selectedAttemptDetail.speakingSubmission.part1AudioDataUrl
                          }
                          className="w-full h-9"
                        />
                      )}
                      {(selectedAttemptDetail.speakingSubmission.part1Transcript ||
                        selectedAttemptDetail.speakingSubmission.part1Text) && (
                        <p className="text-slate-700 dark:text-slate-300 italic text-[11px] whitespace-pre-line">
                          &quot;
                          {selectedAttemptDetail.speakingSubmission.part1Transcript ||
                            selectedAttemptDetail.speakingSubmission.part1Text}
                          &quot;
                        </p>
                      )}
                    </div>
                  )}

                  {(selectedAttemptDetail.speakingSubmission.part2Transcript ||
                    selectedAttemptDetail.speakingSubmission.part2Text ||
                    resolvedSpeakingUrls.part2 ||
                    selectedAttemptDetail.speakingSubmission.part2AudioDataUrl) && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white">
                          Part 2: Solution Discussion
                        </span>
                        {selectedAttemptDetail.speakingSubmission.part2DurationSec ? (
                          <span className="text-[10px] font-bold text-slate-500">
                            Thời lượng: {selectedAttemptDetail.speakingSubmission.part2DurationSec}s
                          </span>
                        ) : null}
                      </div>
                      {(resolvedSpeakingUrls.part2 ||
                        selectedAttemptDetail.speakingSubmission.part2AudioDataUrl) && (
                        <audio
                          controls
                          src={
                            resolvedSpeakingUrls.part2 ||
                            selectedAttemptDetail.speakingSubmission.part2AudioDataUrl
                          }
                          className="w-full h-9"
                        />
                      )}
                      {(selectedAttemptDetail.speakingSubmission.part2Transcript ||
                        selectedAttemptDetail.speakingSubmission.part2Text) && (
                        <p className="text-slate-700 dark:text-slate-300 italic text-[11px] whitespace-pre-line">
                          &quot;
                          {selectedAttemptDetail.speakingSubmission.part2Transcript ||
                            selectedAttemptDetail.speakingSubmission.part2Text}
                          &quot;
                        </p>
                      )}
                    </div>
                  )}

                  {(selectedAttemptDetail.speakingSubmission.part3Transcript ||
                    selectedAttemptDetail.speakingSubmission.part3Text ||
                    resolvedSpeakingUrls.part3 ||
                    selectedAttemptDetail.speakingSubmission.part3AudioDataUrl) && (
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 dark:text-white">
                          Part 3: Topic Development (Mind-map)
                        </span>
                        {selectedAttemptDetail.speakingSubmission.part3DurationSec ? (
                          <span className="text-[10px] font-bold text-slate-500">
                            Thời lượng: {selectedAttemptDetail.speakingSubmission.part3DurationSec}s
                          </span>
                        ) : null}
                      </div>
                      {(resolvedSpeakingUrls.part3 ||
                        selectedAttemptDetail.speakingSubmission.part3AudioDataUrl) && (
                        <audio
                          controls
                          src={
                            resolvedSpeakingUrls.part3 ||
                            selectedAttemptDetail.speakingSubmission.part3AudioDataUrl
                          }
                          className="w-full h-9"
                        />
                      )}
                      {(selectedAttemptDetail.speakingSubmission.part3Transcript ||
                        selectedAttemptDetail.speakingSubmission.part3Text) && (
                        <p className="text-slate-700 dark:text-slate-300 italic text-[11px] whitespace-pre-line">
                          &quot;
                          {selectedAttemptDetail.speakingSubmission.part3Transcript ||
                            selectedAttemptDetail.speakingSubmission.part3Text}
                          &quot;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Saved AI Speaking Examiner Evaluation */}
                  {selectedAttemptDetail.aiSpeakingEvaluation && (
                    <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 p-4 border border-amber-200 dark:border-amber-800/70 text-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-amber-600" />
                          <span>Kết quả Giám khảo AI Speaking (Đã lưu Cloud)</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-200/80 dark:bg-amber-900 text-amber-950 dark:text-amber-100 font-black text-[11px] tabular-nums">
                          Part 1: {selectedAttemptDetail.aiSpeakingEvaluation.part1Score ?? '-'} · Part 2: {selectedAttemptDetail.aiSpeakingEvaluation.part2Score ?? '-'} · Part 3: {selectedAttemptDetail.aiSpeakingEvaluation.part3Score ?? '-'} (Tổng: {selectedAttemptDetail.aiSpeakingEvaluation.overallBand10 ?? selectedAttemptDetail.speakingScore ?? '-'}/10)
                        </span>
                      </div>
                      {selectedAttemptDetail.aiSpeakingEvaluation.part1Criteria?.feedbackVi && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900">
                          <strong className="text-amber-800 dark:text-amber-300">Nhận xét Part 1 (Social): </strong>
                          {selectedAttemptDetail.aiSpeakingEvaluation.part1Criteria.feedbackVi}
                        </div>
                      )}
                      {selectedAttemptDetail.aiSpeakingEvaluation.part2Criteria?.feedbackVi && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900">
                          <strong className="text-amber-800 dark:text-amber-300">Nhận xét Part 2 (Solution): </strong>
                          {selectedAttemptDetail.aiSpeakingEvaluation.part2Criteria.feedbackVi}
                        </div>
                      )}
                      {selectedAttemptDetail.aiSpeakingEvaluation.part3Criteria?.feedbackVi && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/70 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900">
                          <strong className="text-amber-800 dark:text-amber-300">Nhận xét Part 3 (Topic): </strong>
                          {selectedAttemptDetail.aiSpeakingEvaluation.part3Criteria.feedbackVi}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Saved AI Diagnostic Report */}
              {selectedAttemptDetail.aiDiagnosticReport && (
                <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    <span>Báo cáo Chẩn đoán &amp; Lộ trình AI (Đã lưu Cloud):</span>
                  </h4>
                  <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 border border-emerald-200 dark:border-emerald-800/70 text-xs space-y-2">
                    {Array.isArray(selectedAttemptDetail.aiDiagnosticReport.strengths) &&
                      selectedAttemptDetail.aiDiagnosticReport.strengths.length > 0 && (
                        <div>
                          <strong className="text-emerald-800 dark:text-emerald-300 block mb-0.5">
                            Điểm mạnh:
                          </strong>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                            {selectedAttemptDetail.aiDiagnosticReport.strengths
                              .slice(0, 3)
                              .map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                          </ul>
                        </div>
                      )}
                    {Array.isArray(selectedAttemptDetail.aiDiagnosticReport.weaknesses) &&
                      selectedAttemptDetail.aiDiagnosticReport.weaknesses.length > 0 && (
                        <div>
                          <strong className="text-amber-800 dark:text-amber-300 block mb-0.5">
                            Cần cải thiện:
                          </strong>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                            {selectedAttemptDetail.aiDiagnosticReport.weaknesses
                              .slice(0, 3)
                              .map((w: string, i: number) => (
                                <li key={i}>{w}</li>
                              ))}
                          </ul>
                        </div>
                      )}
                  </div>
                </div>
              )}
              {/* Teacher Direct Review, Score Override & Commentary Box */}
              <div className="space-y-3 pt-4 border-t-2 border-slate-200 dark:border-slate-800">
                <div className="rounded-2xl bg-lime-50/80 dark:bg-emerald-950/30 p-4 border-2 border-[#58CC02] space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-black uppercase text-[#2E7D32] dark:text-[#58CC02] flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4" />
                      <span>Giáo Viên Chấm Điểm &amp; Ghi Lời Phê Trực Tiếp (Đồng bộ sang Học viên)</span>
                    </h4>
                    {selectedAttemptDetail.teacherFeedback?.updatedAt && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Cập nhật: {new Date(selectedAttemptDetail.teacherFeedback.updatedAt).toLocaleString('vi-VN')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Điểm Writing GV chấm (/10)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        value={teacherWritingOverrideInput}
                        onChange={(e) => setTeacherWritingOverrideInput(e.target.value)}
                        placeholder="VD: 6.5"
                        className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-black tabular-nums text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Điểm Speaking GV chấm (/10)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="10"
                        value={teacherSpeakingOverrideInput}
                        onChange={(e) => setTeacherSpeakingOverrideInput(e.target.value)}
                        placeholder="VD: 7.0"
                        className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-black tabular-nums text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Tên Giáo viên chấm bài
                      </label>
                      <input
                        type="text"
                        value={teacherReviewerName}
                        onChange={(e) => setTeacherReviewerName(e.target.value)}
                        placeholder="Mr.Harry (Giảng viên)"
                        className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                      Lời phê chi tiết &amp; Hướng dẫn sửa bài cho học viên:
                    </label>
                    <textarea
                      rows={3}
                      value={teacherCommentInput}
                      onChange={(e) => setTeacherCommentInput(e.target.value)}
                      placeholder="Nhập nhận xét về bố cục bài viết, cách phát âm Speaking hoặc những bẫy Listening/Reading học viên cần lưu ý..."
                      className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs font-semibold text-slate-900 dark:text-white focus:border-[#58CC02] focus:outline-none"
                    />
                  </div>

                  {teacherFeedbackSavedMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 text-[11px] font-black flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-[#58CC02] shrink-0" />
                      <span>{teacherFeedbackSavedMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveTeacherFeedback}
                      disabled={isSavingTeacherFeedback}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#58CC02] hover:bg-[#46A302] text-white font-black text-xs border-b-4 border-[#3C8C02] active:border-b-0 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>
                        {isSavingTeacherFeedback
                          ? 'Đang lưu lên Cloud...'
                          : 'Lưu Điểm & Lời Phê Giáo Viên'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedAttemptDetail(null)}
                className="px-5 py-2 rounded-xl bg-[#58CC02] text-white text-xs font-black cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
