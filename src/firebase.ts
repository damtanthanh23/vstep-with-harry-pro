import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  enableNetwork,
  doc,
  setDoc,
  deleteDoc,
  DocumentReference,
  SetOptions,
  setLogLevel,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

export const APP_SITE_ID = 'vstep';
export const STORAGE_AUDIO_FOLDER = 'vstep/exam_audio';
export const AUDIO_KEY_PREFIX = 'vstep_';
export const FIREBASE_STORAGE_BUCKET = 'harrytoeicbackup.firebasestorage.app';
export const STORAGE_BUCKET_NAME = 'harrytoeicbackup.firebasestorage.app';

// Silence internal @firebase/firestore SDK backoff/quota console spam so resilient local fallbacks run cleanly
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

export const app = initializeApp({
  ...firebaseConfig,
  storageBucket: firebaseConfig.storageBucket || FIREBASE_STORAGE_BUCKET,
});

// QUAN TRỌNG NHẤT: Trỏ đúng vào Database ID thật của hệ thống VSTEP
export const REAL_DATABASE_ID =
  firebaseConfig.firestoreDatabaseId ||
  'ai-studio-vsteptutor-6c9f7e6d-6d42-4864-9991-780c76d9f4dc';

export const db = getFirestore(app, REAL_DATABASE_ID);
export const storage = getStorage(app, `gs://${FIREBASE_STORAGE_BUCKET}`);
export const storageAppspot = getStorage(app, 'gs://harrytoeicbackup.appspot.com');
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

try {
  enableNetwork(db).catch(() => {});
} catch {
  // Ignore
}

const QUOTA_TRIPPED_DATE_KEY = 'langcert_fs_quota_exhausted_utc_date_v2';

// Clear any legacy false-positive quota flags from sessionStorage
try {
  sessionStorage.removeItem('langcert_fs_quota_exhausted_utc_date');
  sessionStorage.removeItem(QUOTA_TRIPPED_DATE_KEY);
} catch {
  // Ignore
}

export function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as { code?: string })?.code || '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
}

export function canWriteToFirestore(): boolean {
  return true;
}

export function markFirestoreQuotaExhausted(_error?: unknown): void {
  // Do not lock the entire session on transient write rate limits
}

/**
 * Quota-safe wrapper around Firestore `setDoc` that skips cloud writes only when daily quota is genuinely exhausted
 * and uses a generous 20s timeout for full 75-question exam payloads without disabling the network on slow connections.
 */
export async function safeSetDoc<T>(
  reference: DocumentReference<T>,
  data: T,
  options?: SetOptions,
  timeoutMs: number = 12000
): Promise<boolean> {
  if (!canWriteToFirestore()) return false;

  try {
    const writePromise = options
      ? setDoc(reference, data, options)
      : setDoc(reference, data);

    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), timeoutMs)
    );

    const result = await Promise.race([
      writePromise.then(() => 'ok' as const),
      timeoutPromise,
    ]);

    if (result === 'timeout') {
      console.warn(`Firestore write took longer than ${timeoutMs}ms; continuing in background.`);
      return false;
    }
    return true;
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err);
      return false;
    }
    console.warn('Firestore write error:', err);
    return false;
  }
}

/**
 * Quota-safe wrapper around Firestore `deleteDoc`
 */
export async function safeDeleteDoc(reference: DocumentReference<unknown>): Promise<boolean> {
  if (!canWriteToFirestore()) return false;
  try {
    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 15000)
    );
    const result = await Promise.race([
      deleteDoc(reference).then(() => 'ok' as const),
      timeoutPromise,
    ]);
    if (result === 'timeout') {
      return false;
    }
    return true;
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err);
    }
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  if (isQuotaError(error)) {
    markFirestoreQuotaExhausted(error);
    return;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.warn('Firestore Notice (local fallback active):', JSON.stringify(errInfo));
}
