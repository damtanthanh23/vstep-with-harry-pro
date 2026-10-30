import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  DocumentReference,
  SetOptions,
  setLogLevel,
  disableNetwork,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Silence internal @firebase/firestore SDK backoff/quota console spam so resilient local fallbacks run cleanly
try {
  setLogLevel('silent');
} catch {
  // Ignore
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const QUOTA_TRIPPED_DATE_KEY = 'langcert_fs_quota_exhausted_utc_date';
let quotaTrippedInMemory = false;

function getTodayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isQuotaError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as { code?: string })?.code || '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota')
  );
}

export function canWriteToFirestore(): boolean {
  if (quotaTrippedInMemory) return false;
  try {
    const trippedDate = sessionStorage.getItem(QUOTA_TRIPPED_DATE_KEY);
    if (trippedDate === getTodayUtcDateString()) {
      quotaTrippedInMemory = true;
      return false;
    }
  } catch {
    // Ignore storage access issues
  }
  return true;
}

export function markFirestoreQuotaExhausted(error?: unknown): void {
  quotaTrippedInMemory = true;
  try {
    sessionStorage.setItem(QUOTA_TRIPPED_DATE_KEY, getTodayUtcDateString());
  } catch {
    // Ignore
  }
  // Halt internal SDK write retry stream so it stops hitting the exhausted daily quota
  disableNetwork(db).catch(() => {});
  if (error && !isQuotaError(error)) {
    // Non-quota error
  }
}

/**
 * Quota-safe wrapper around Firestore `setDoc` that skips cloud writes when daily quota is exhausted
 * and enforces a short timeout so exponential backoff never hangs or spams retries.
 */
export async function safeSetDoc<T>(
  reference: DocumentReference<T>,
  data: T,
  options?: SetOptions
): Promise<boolean> {
  if (!canWriteToFirestore()) return false;

  try {
    const writePromise = options
      ? setDoc(reference, data, options)
      : setDoc(reference, data);

    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 3500)
    );

    const result = await Promise.race([
      writePromise.then(() => 'ok' as const),
      timeoutPromise,
    ]);

    if (result === 'timeout') {
      // Firestore SDK entered backoff delay (quota exhausted or offline)
      markFirestoreQuotaExhausted();
      return false;
    }
    return true;
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err);
      return false;
    }
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
      setTimeout(() => resolve('timeout'), 3500)
    );
    const result = await Promise.race([
      deleteDoc(reference).then(() => 'ok' as const),
      timeoutPromise,
    ]);
    if (result === 'timeout') {
      markFirestoreQuotaExhausted();
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
