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

const QUOTA_TRIPPED_DATE_KEY = 'langcert_fs_quota_exhausted_utc_date_v2';
let quotaTrippedInMemory = false;

// Clear any legacy false-positive quota flag from previous sessionStorage key
try {
  sessionStorage.removeItem('langcert_fs_quota_exhausted_utc_date');
} catch {
  // Ignore
}

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
    msg.includes('Quota exceeded')
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
  if (error && !isQuotaError(error)) {
    return;
  }
  quotaTrippedInMemory = true;
  try {
    sessionStorage.setItem(QUOTA_TRIPPED_DATE_KEY, getTodayUtcDateString());
  } catch {
    // Ignore
  }
}

/**
 * Quota-safe wrapper around Firestore `setDoc` that skips cloud writes only when daily quota is genuinely exhausted
 * and uses a generous 20s timeout for full 75-question exam payloads without disabling the network on slow connections.
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
      setTimeout(() => resolve('timeout'), 20000)
    );

    const result = await Promise.race([
      writePromise.then(() => 'ok' as const),
      timeoutPromise,
    ]);

    if (result === 'timeout') {
      console.warn('Firestore write took longer than 20s; continuing in background.');
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
