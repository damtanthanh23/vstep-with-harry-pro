import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { auth, googleProvider, db, safeSetDoc, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types/exam';
import { saveUserNickname as saveStudyQuoteNickname } from '../data/vietnameseStudyQuotes';
import { fetchUserVocabStateFromCloud } from '../services/vocabCloudService';
import { syncLocalAttemptsToFirestore } from '../services/examService';

const LOCAL_PROFILE_CACHE_KEY = 'langcert_user_profile_cache_v1';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCoTeacher: boolean;
  canManageExams: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  assignUserRole: (uid: string, newRole: 'student' | 'co_teacher' | 'admin') => Promise<void>;
  updateUserProfileData: (patch: Partial<UserProfile>) => Promise<void>;
}

// Master Super Admin account list
export const SUPER_ADMIN_EMAILS = ['damtanthanh23@gmail.com', 'admin@gmail.com'];

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  isAdmin: false,
  isSuperAdmin: false,
  isCoTeacher: false,
  canManageExams: false,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  signOutUser: async () => {},
  authError: null,
  clearAuthError: () => {},
  assignUserRole: async () => {},
  updateUserProfileData: async () => {},
});

function loadLocalProfileCache(uid?: string): Partial<UserProfile> {
  try {
    const raw = localStorage.getItem(`${LOCAL_PROFILE_CACHE_KEY}_${uid || 'guest'}`);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveLocalProfileCache(uid: string | undefined, data: Partial<UserProfile>): void {
  try {
    const key = `${LOCAL_PROFILE_CACHE_KEY}_${uid || 'guest'}`;
    const prev = loadLocalProfileCache(uid);
    localStorage.setItem(key, JSON.stringify({ ...prev, ...data }));
  } catch {
    // ignore storage errors
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);
  const [isCoTeacher, setIsCoTeacher] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let unsubProfileDoc: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (unsubProfileDoc) {
        unsubProfileDoc();
        unsubProfileDoc = null;
      }

      setCurrentUser(user);
      if (user) {
        const userEmail = (user.email || '').toLowerCase().trim();
        const userIsSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail);
        setIsSuperAdmin(userIsSuperAdmin);
        const localCache = loadLocalProfileCache(user.uid);
        const now = Date.now();

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data() as UserProfile;

            // If user is super admin, enforce admin role even if previous record differed
            const effectiveRole = userIsSuperAdmin ? 'admin' : (data.role || 'student');
            const updatedProfile: UserProfile = {
              ...localCache,
              ...data,
              uid: user.uid,
              role: effectiveRole,
              lastLoginAt: now,
              lastActiveAt: now,
            };

            // Sync role, lastLoginAt, lastActiveAt, and any local profile fields to Firestore
            const syncPayload: Record<string, unknown> = {
              uid: user.uid,
              lastLoginAt: now,
              lastActiveAt: now,
            };
            if (userIsSuperAdmin && data.role !== 'admin') {
              syncPayload.role = 'admin';
            }
            if (!data.email && user.email) {
              syncPayload.email = user.email;
            }
            if ((!data.displayName || data.displayName === 'Học viên VSTEP') && user.displayName) {
              syncPayload.displayName = user.displayName;
            }
            if (!data.photoURL && user.photoURL) {
              syncPayload.photoURL = user.photoURL;
            }
            if (!data.phone && localCache.phone) {
              syncPayload.phone = localCache.phone;
            }
            if (!data.birthDate && localCache.birthDate) {
              syncPayload.birthDate = localCache.birthDate;
            }
            if (!data.targetScores && localCache.targetScores) {
              syncPayload.targetScores = localCache.targetScores;
            }

            try {
              await setDoc(userDocRef, syncPayload, { merge: true });
            } catch {
              await safeSetDoc(userDocRef, syncPayload, { merge: true });
            }

            if (updatedProfile.nickname) {
              saveStudyQuoteNickname(user.uid, updatedProfile.nickname);
            }
            saveLocalProfileCache(user.uid, updatedProfile);
            setUserProfile(updatedProfile);
            const userIsAdmin = userIsSuperAdmin || effectiveRole === 'admin';
            const userIsCoTeacher = effectiveRole === 'co_teacher';
            setIsAdmin(userIsAdmin);
            setIsCoTeacher(userIsCoTeacher);
          } else {
            // First time login - bootstrap user profile
            const effectiveRole = userIsSuperAdmin ? 'admin' : 'student';
            const newProfile: UserProfile = {
              ...localCache,
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || localCache.displayName || 'Học viên VSTEP',
              ...(user.photoURL ? { photoURL: user.photoURL } : {}),
              role: effectiveRole,
              createdAt: now,
              lastLoginAt: now,
              lastActiveAt: now,
            };
            try {
              await setDoc(userDocRef, newProfile, { merge: true });
            } catch {
              await safeSetDoc(userDocRef, newProfile, { merge: true });
            }
            saveLocalProfileCache(user.uid, newProfile);
            setUserProfile(newProfile);
            setIsAdmin(userIsSuperAdmin);
            setIsCoTeacher(false);
          }

          // Background sync of vocabulary partition state so users/{uid}.vocabStats is always up-to-date
          fetchUserVocabStateFromCloud(user.uid).catch(() => {});

          // Auto-migrate any guest attempts or offline attempts to Cloud Firestore
          syncLocalAttemptsToFirestore(user.uid).catch(() => {});

          // Real-time listener on users/{uid} so changes from any device or modal stay unified
          unsubProfileDoc = onSnapshot(
            userDocRef,
            (liveSnap) => {
              if (!liveSnap.exists()) return;
              const liveData = liveSnap.data() as UserProfile;
              const liveRole = userIsSuperAdmin ? 'admin' : (liveData.role || 'student');
              const mergedLive: UserProfile = {
                ...loadLocalProfileCache(user.uid),
                ...liveData,
                uid: user.uid,
                role: liveRole,
              };
              saveLocalProfileCache(user.uid, mergedLive);
              setUserProfile(mergedLive);
              setIsAdmin(userIsSuperAdmin || liveRole === 'admin');
              setIsCoTeacher(liveRole === 'co_teacher');
            },
            () => {}
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          // Fallback minimal local profile if firestore read has network/permission hitch
          const effectiveRole = userIsSuperAdmin ? 'admin' : 'student';
          setUserProfile({
            ...localCache,
            uid: user.uid,
            email: user.email || '',
            displayName: localCache.displayName || user.displayName || 'Học viên VSTEP',
            photoURL: user.photoURL || undefined,
            role: effectiveRole,
            createdAt: now,
            lastLoginAt: now,
            lastActiveAt: now,
          });
          setIsAdmin(userIsSuperAdmin);
          setIsCoTeacher(false);
        }
      } else {
        const guestCache = loadLocalProfileCache('guest');
        if (Object.keys(guestCache).length > 0) {
          setUserProfile({
            uid: 'guest',
            email: '',
            displayName: guestCache.displayName || 'Học viên VSTEP',
            role: 'student',
            createdAt: Date.now(),
            ...guestCache,
          });
        } else {
          setUserProfile(null);
        }
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsCoTeacher(false);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubProfileDoc) {
        unsubProfileDoc();
      }
    };
  }, []);

  // 90-second visibility-aware online heartbeat
  useEffect(() => {
    if (!currentUser) return;

    const pingHeartbeat = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, { lastActiveAt: Date.now() }, { merge: true });
      } catch {
        // Silently ignore ping error
      }
    };

    pingHeartbeat();

    const intervalId = setInterval(pingHeartbeat, 90 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pingHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  const formatFirebaseAuthError = (err: unknown, fallbackMsg: string): string => {
    const code = (err as { code?: string })?.code || '';
    const message = err instanceof Error ? err.message : '';
    if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
      return 'Trình duyệt đã chặn cửa sổ bật lên (Popup). Vui lòng cho phép Popup trên thanh địa chỉ trình duyệt, mở ứng dụng trong Tab mới, hoặc đăng nhập bằng Email & Mật khẩu bên dưới.';
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return 'Cửa sổ đăng nhập Google đã được đóng trước khi hoàn tất. Vui lòng thử lại.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'Tên miền hiện tại chưa được thêm vào Authorized Domains trong Firebase Console. Bạn có thể đăng nhập bằng Email & Mật khẩu bên dưới.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Email hoặc mật khẩu không chính xác. Nếu chưa có tài khoản, vui lòng chọn "Đăng ký miễn phí".';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Email này đã được đăng ký. Vui lòng chuyển sang chế độ Đăng nhập.';
    }
    if (code === 'auth/weak-password') {
      return 'Mật khẩu cần có tối thiểu 6 ký tự.';
    }
    return message || fallbackMsg;
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const friendlyMsg = formatFirebaseAuthError(err, 'Đăng nhập Google thất bại');
      setAuthError(friendlyMsg);
      const wrappedErr = new Error(friendlyMsg) as Error & { code?: string };
      wrappedErr.code = (err as { code?: string })?.code;
      throw wrappedErr;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: unknown) {
      const friendlyMsg = formatFirebaseAuthError(err, 'Đăng nhập Email thất bại');
      setAuthError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (name && cred.user) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (err: unknown) {
      const friendlyMsg = formatFirebaseAuthError(err, 'Đăng ký Email thất bại');
      setAuthError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err: unknown) {
      const friendlyMsg = formatFirebaseAuthError(err, 'Đăng xuất thất bại');
      setAuthError(friendlyMsg);
    }
  };

  const clearAuthError = () => setAuthError(null);

  // Future-ready role assignment for Super Admin (assign co-teacher or student)
  const assignUserRole = async (targetUid: string, newRole: 'student' | 'co_teacher' | 'admin') => {
    if (!isSuperAdmin && !isAdmin) {
      throw new Error('Chỉ Super Admin mới có quyền chỉ định vai trò');
    }
    try {
      const targetDocRef = doc(db, 'users', targetUid);
      await safeSetDoc(targetDocRef, { role: newRole, assignedBy: currentUser?.email || 'admin' }, { merge: true });
    } catch (err: unknown) {
      console.error('Lỗi phân quyền người dùng:', err);
      throw err;
    }
  };

  const updateUserProfileData = async (patch: Partial<UserProfile>) => {
    const uid = currentUser?.uid || 'guest';
    const cleanPatch: Record<string, unknown> = {};
    Object.entries(patch).forEach(([k, v]) => {
      if (v !== undefined) {
        cleanPatch[k] = v;
      }
    });

    if (typeof patch.nickname === 'string') {
      try {
        localStorage.setItem('langcert_user_nickname', patch.nickname.trim());
      } catch {
        // Ignore
      }
      saveStudyQuoteNickname(currentUser?.uid, patch.nickname);
    }

    saveLocalProfileCache(uid, cleanPatch as Partial<UserProfile>);

    setUserProfile((prev) => {
      const base: UserProfile = prev || {
        uid,
        email: currentUser?.email || '',
        displayName: currentUser?.displayName || 'Học viên LanguageCert',
        role: 'student',
        createdAt: Date.now(),
      };
      return {
        ...base,
        ...(cleanPatch as Partial<UserProfile>),
      };
    });

    if (currentUser) {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await safeSetDoc(userDocRef, cleanPatch, { merge: true });
    }
  };

  const canManageExams = isSuperAdmin || isAdmin || isCoTeacher;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        isSuperAdmin,
        isCoTeacher,
        canManageExams,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        authError,
        clearAuthError,
        assignUserRole,
        updateUserProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
