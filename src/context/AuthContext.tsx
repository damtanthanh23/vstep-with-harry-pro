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
} from 'firebase/firestore';
import { auth, googleProvider, db, safeSetDoc, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types/exam';
import { saveUserNickname as saveStudyQuoteNickname } from '../data/vietnameseStudyQuotes';

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
export const SUPER_ADMIN_EMAILS = ['damtanthanh23@gmail.com'];

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userEmail = (user.email || '').toLowerCase().trim();
        const userIsSuperAdmin = SUPER_ADMIN_EMAILS.includes(userEmail);
        setIsSuperAdmin(userIsSuperAdmin);
        const localCache = loadLocalProfileCache(user.uid);

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
              role: effectiveRole,
              lastActiveAt: Date.now(),
            };
            
            // Sync role or lastActiveAt to Firestore
            const syncPayload: Record<string, unknown> = {
              lastActiveAt: Date.now(),
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
              displayName: user.displayName || 'Học viên VSTEP',
              ...(user.photoURL ? { photoURL: user.photoURL } : {}),
              role: effectiveRole,
              createdAt: Date.now(),
              lastActiveAt: Date.now(),
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
            createdAt: Date.now(),
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

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Google Sign-In Error:', err);
      const msg = err instanceof Error ? err.message : 'Đăng nhập Google thất bại';
      setAuthError(msg);
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: unknown) {
      console.error('Email Sign-In Error:', err);
      const msg = err instanceof Error ? err.message : 'Đăng nhập Email thất bại';
      setAuthError(msg);
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name?: string) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name && cred.user) {
        await updateProfile(cred.user, { displayName: name });
      }
    } catch (err: unknown) {
      console.error('Email Sign-Up Error:', err);
      const msg = err instanceof Error ? err.message : 'Đăng ký Email thất bại';
      setAuthError(msg);
      throw err;
    }
  };

  const signOutUser = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err: unknown) {
      console.error('Sign Out Error:', err);
      throw err;
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
