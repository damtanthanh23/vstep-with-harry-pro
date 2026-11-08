import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  db,
  storage,
  storageAppspot,
  safeSetDoc,
  canWriteToFirestore,
  APP_SITE_ID,
  STORAGE_AUDIO_FOLDER,
  AUDIO_KEY_PREFIX,
  FIREBASE_STORAGE_BUCKET,
} from '../firebase';

export { APP_SITE_ID, STORAGE_AUDIO_FOLDER, AUDIO_KEY_PREFIX, FIREBASE_STORAGE_BUCKET };

const IDB_NAME = 'langcert_audio_storage_v1';
const IDB_STORE = 'audio_blobs';
const STORAGE_URL_MAP_LS_KEY = 'vstep_firebase_storage_urls_v1';
const CLOUD_CHUNK_CHAR_LIMIT = 320000; // ~320KB per Firestore document for smooth WebChannel streaming
const INLINE_SPEAKING_DATA_URL_MAX_CHARS = 220000; // ~220KB max inline per part so 3 parts fit comfortably in 1 Firestore doc

interface StoredAudioRecord {
  key: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  arrayBuffer?: ArrayBuffer;
  storageUrl?: string;
  updatedAt: number;
}

export interface AudioCloudSyncState {
  active: boolean;
  status: 'idle' | 'syncing' | 'completed' | 'error';
  testTitle: string;
  currentFileName: string;
  percent: number;
  completedFiles: number;
  totalFiles: number;
  message: string;
  storageUrl?: string;
}

export interface StorageConnectionTestResult {
  ok: boolean;
  bucket: string;
  storagePath: string;
  downloadUrl?: string;
  testedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

let currentCloudSyncState: AudioCloudSyncState = {
  active: false,
  status: 'idle',
  testTitle: '',
  currentFileName: '',
  percent: 0,
  completedFiles: 0,
  totalFiles: 0,
  message: '',
};

const cloudSyncListeners = new Set<(state: AudioCloudSyncState) => void>();
const storageUrlReadyListeners = new Set<(key: string, storageUrl: string) => void>();
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

// In-memory + localStorage cache mapping audioKey -> Firebase Storage CDN downloadUrl
const storageCdnUrlCache = new Map<string, string>();
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = window.localStorage.getItem(STORAGE_URL_MAP_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      Object.entries(parsed).forEach(([k, v]) => {
        if (k && typeof v === 'string' && (v.startsWith('http') || v.startsWith('/api/audio/'))) {
          storageCdnUrlCache.set(k, v);
        }
      });
    }
  }
} catch {
  // Ignore localStorage parse errors
}

function recordFirebaseStorageUrl(keys: string[], storageUrl: string): void {
  if (!storageUrl || (!storageUrl.startsWith('http') && !storageUrl.startsWith('/api/audio/'))) return;
  keys.forEach((k) => {
    const cleaned = cleanAudioStorageKey(k);
    if (cleaned) {
      storageCdnUrlCache.set(cleaned, storageUrl);
    }
    if (k) {
      storageCdnUrlCache.set(k, storageUrl);
    }
  });
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const obj: Record<string, string> = {};
      storageCdnUrlCache.forEach((v, k) => {
        obj[k] = v;
      });
      window.localStorage.setItem(STORAGE_URL_MAP_LS_KEY, JSON.stringify(obj));
    }
  } catch {
    // Ignore quota errors
  }
  keys.forEach((k) => {
    const cleaned = cleanAudioStorageKey(k);
    if (cleaned) {
      storageUrlReadyListeners.forEach((cb) => cb(cleaned, storageUrl));
    }
  });
}

export function getCachedFirebaseStorageUrl(rawKey: string): string | null {
  if (!rawKey) return null;
  const cleaned = cleanAudioStorageKey(rawKey);
  const vstepKey = ensureVstepAudioKey(cleaned);
  return (
    storageCdnUrlCache.get(vstepKey) ||
    storageCdnUrlCache.get(cleaned) ||
    storageCdnUrlCache.get(rawKey) ||
    null
  );
}

export function subscribeToFirebaseStorageUrlReady(
  listener: (key: string, storageUrl: string) => void
): () => void {
  storageUrlReadyListeners.add(listener);
  return () => {
    storageUrlReadyListeners.delete(listener);
  };
}

export function notifyAudioCloudSyncBanner(patch: Partial<AudioCloudSyncState>): void {
  updateAudioCloudSyncState(patch);
}

function updateAudioCloudSyncState(patch: Partial<AudioCloudSyncState>) {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
  currentCloudSyncState = {
    ...currentCloudSyncState,
    ...patch,
  };
  cloudSyncListeners.forEach((listener) => listener(currentCloudSyncState));

  if (currentCloudSyncState.status === 'completed') {
    autoDismissTimer = setTimeout(() => {
      currentCloudSyncState = {
        ...currentCloudSyncState,
        active: false,
        status: 'idle',
      };
      cloudSyncListeners.forEach((listener) => listener(currentCloudSyncState));
    }, 5000);
  }
}

export function getAudioCloudSyncState(): AudioCloudSyncState {
  return currentCloudSyncState;
}

export function subscribeToAudioCloudSync(
  listener: (state: AudioCloudSyncState) => void
): () => void {
  cloudSyncListeners.add(listener);
  listener(currentCloudSyncState);
  return () => {
    cloudSyncListeners.delete(listener);
  };
}

export function dismissAudioCloudSyncBanner(): void {
  if (autoDismissTimer) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }
  currentCloudSyncState = {
    ...currentCloudSyncState,
    active: false,
    status: 'idle',
  };
  cloudSyncListeners.forEach((listener) => listener(currentCloudSyncState));
}

// Keep an in-memory map of active Object URLs so we never lose a newly uploaded file's blob URL
const activeObjectUrlCache = new Map<string, string>();
// Keep an in-memory map of detached memory Blobs so active session uploads are 100% immune to OS file handle revocation
const activeMemoryBlobCache = new Map<string, Blob>();

/**
 * Strips `idb-audio://` prefix and any `?v=...` version query parameter
 * so IndexedDB always looks up the canonical storage key.
 */
export function cleanAudioStorageKey(rawKey: string): string {
  return (rawKey || '')
    .trim()
    .replace(/^idb-audio:\/\//, '')
    .split('?')[0]
    .replace(/[^a-zA-Z0-9_.-]/g, '_');
}

/**
 * Ensures the audio key strictly starts with `vstep_` (AUDIO_KEY_PREFIX) without doubling `vstep_vstep_`.
 */
export function ensureVstepAudioKey(rawKey: string): string {
  const cleaned = cleanAudioStorageKey(rawKey);
  if (!cleaned) return `${AUDIO_KEY_PREFIX}audio_default`;
  if (cleaned.startsWith(AUDIO_KEY_PREFIX)) {
    return cleaned;
  }
  return `${AUDIO_KEY_PREFIX}${cleaned}`;
}

/**
 * Returns the VSTEP-namespaced fallback file key `vstep_file_{fileName}`
 */
export function ensureVstepFileFallbackKey(fileName: string): string {
  const safeName = (fileName || 'audio.mp3').replace(/[^a-zA-Z0-9_.-]/g, '_');
  if (safeName.startsWith(`${AUDIO_KEY_PREFIX}file_`)) {
    return safeName;
  }
  if (safeName.startsWith('file_')) {
    return `${AUDIO_KEY_PREFIX}${safeName}`;
  }
  return `${AUDIO_KEY_PREFIX}file_${safeName}`;
}

/**
 * Returns legacy unprefixed `file_{fileName}` for backward-compatible reads
 */
function getLegacyFileFallbackKey(fileName: string): string {
  const safeName = (fileName || 'audio.mp3').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return safeName.startsWith('file_') ? safeName : `file_${safeName}`;
}

/**
 * Builds the isolated VSTEP Firebase Cloud Storage object path:
 * `vstep/exam_audio/vstep_{cleanKey}.mp3`
 */
export function getVstepStoragePath(rawKey: string): string {
  const vstepKey = ensureVstepAudioKey(rawKey).replace(/\.mp3$/i, '');
  return `${STORAGE_AUDIO_FOLDER}/${vstepKey}.mp3`;
}

/**
 * Sanitizes key strictly for Firestore `/test_audio_chunks/{chunkId}` rules (`^[a-zA-Z0-9_\-]+$`)
 */
export function toFirestoreChunkKey(rawKey: string): string {
  const cleaned = cleanAudioStorageKey(rawKey)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 95);
  return cleaned || 'vstep_audio_default';
}

export function blobToBase64DataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert Blob to base64 DataURL'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SZ = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SZ) {
    const sub = bytes.subarray(i, Math.min(bytes.length, i + CHUNK_SZ));
    parts.push(String.fromCharCode.apply(null, sub as unknown as number[]));
  }
  return btoa(parts.join(''));
}

function openAudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const dbInstance = req.result;
      if (!dbInstance.objectStoreNames.contains(IDB_STORE)) {
        dbInstance.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioToIndexedDB(
  key: string,
  blob: Blob,
  fileName = 'audio.mp3'
): Promise<string> {
  const baseKey = ensureVstepAudioKey(key);
  const legacyKey = cleanAudioStorageKey(key);
  const versionedIdbUri = `idb-audio://${baseKey}?v=${Date.now()}`;
  const plainIdbUri = `idb-audio://${baseKey}`;
  const vstepFileKey = fileName ? ensureVstepFileFallbackKey(fileName) : '';
  const legacyFileKey = fileName ? getLegacyFileFallbackKey(fileName) : '';

  const mimeType = blob.type || 'audio/mpeg';
  let detachedBuffer: ArrayBuffer | undefined;
  let detachedBlob: Blob = blob;

  try {
    detachedBuffer = await blob.arrayBuffer();
    detachedBlob = new Blob([detachedBuffer], { type: mimeType });
  } catch (err) {
    console.warn('Could not read ArrayBuffer into memory before IDB save:', err);
  }

  // Create and cache a live Object URL & Memory Blob immediately (0ms) BEFORE async IndexedDB write
  const freshObjUrl = URL.createObjectURL(detachedBlob);
  activeObjectUrlCache.set(baseKey, freshObjUrl);
  activeObjectUrlCache.set(legacyKey, freshObjUrl);
  activeObjectUrlCache.set(plainIdbUri, freshObjUrl);
  activeObjectUrlCache.set(versionedIdbUri, freshObjUrl);
  activeMemoryBlobCache.set(baseKey, detachedBlob);
  activeMemoryBlobCache.set(legacyKey, detachedBlob);

  if (vstepFileKey) {
    activeObjectUrlCache.set(vstepFileKey, freshObjUrl);
    activeMemoryBlobCache.set(vstepFileKey, detachedBlob);
  }
  if (legacyFileKey) {
    activeObjectUrlCache.set(legacyFileKey, freshObjUrl);
    activeMemoryBlobCache.set(legacyFileKey, detachedBlob);
  }

  try {
    const dbInstance = await openAudioDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = dbInstance.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const now = Date.now();

      const record: StoredAudioRecord = {
        key: baseKey,
        fileName,
        mimeType,
        blob: detachedBlob,
        ...(detachedBuffer ? { arrayBuffer: detachedBuffer } : {}),
        updatedAt: now,
      };
      store.put(record);

      // Also save under legacy unprefixed key if different so backward-compatible lookups succeed
      if (legacyKey && legacyKey !== baseKey) {
        store.put({
          ...record,
          key: legacyKey,
        });
      }

      // Also cache by VSTEP fileName key (`vstep_file_...`) and legacy (`file_...`)
      if (vstepFileKey) {
        store.put({
          ...record,
          key: vstepFileKey,
        });
      }
      if (legacyFileKey && legacyFileKey !== vstepFileKey) {
        store.put({
          ...record,
          key: legacyFileKey,
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB audio save notice:', err);
  }

  return versionedIdbUri;
}

export async function loadAudioBlobFromIndexedDB(key: string): Promise<Blob | null> {
  try {
    const cleanKey = cleanAudioStorageKey(key);
    if (!cleanKey) return null;
    const vstepKey = ensureVstepAudioKey(cleanKey);

    if (activeMemoryBlobCache.has(vstepKey)) {
      return activeMemoryBlobCache.get(vstepKey)!;
    }
    if (activeMemoryBlobCache.has(cleanKey)) {
      return activeMemoryBlobCache.get(cleanKey)!;
    }

    const dbInstance = await openAudioDatabase();
    const candidateKeys = vstepKey !== cleanKey ? [vstepKey, cleanKey] : [cleanKey];

    for (const candidate of candidateKeys) {
      const record = await new Promise<StoredAudioRecord | undefined>((resolve) => {
        const tx = dbInstance.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(candidate);
        req.onsuccess = () => resolve(req.result as StoredAudioRecord | undefined);
        req.onerror = () => resolve(undefined);
      });

      if (!record) continue;

      if (record.storageUrl && record.storageUrl.startsWith('http')) {
        recordFirebaseStorageUrl([vstepKey, cleanKey], record.storageUrl);
      }

      // 1. If record has a detached ArrayBuffer stored in IDB, reconstruct a fresh memory Blob (100% immune to NotReadableError)
      if (record.arrayBuffer && record.arrayBuffer.byteLength > 0) {
        const memBlob = new Blob([record.arrayBuffer], {
          type: record.mimeType || 'audio/mpeg',
        });
        activeMemoryBlobCache.set(vstepKey, memBlob);
        activeMemoryBlobCache.set(cleanKey, memBlob);
        return memBlob;
      }

      // 2. If record only has `blob` (e.g., from an older session), verify the browser hasn't revoked the OS File handle
      if (record.blob && record.blob.size > 0) {
        try {
          const probeSlice = record.blob.slice(0, Math.min(64, record.blob.size));
          await probeSlice.arrayBuffer();
          activeMemoryBlobCache.set(vstepKey, record.blob);
          activeMemoryBlobCache.set(cleanKey, record.blob);
          return record.blob;
        } catch {
          // OS File handle from an older session was revoked by the browser (NotReadableError)
          continue;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function base64ToBlob(base64: string, mimeType = 'audio/mpeg'): Blob {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const byteCharacters = atob(cleanBase64);
  const byteArrays: BlobPart[] = [];
  const sliceSize = 16384;

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(byteNumbers.buffer as ArrayBuffer);
  }

  return new Blob(byteArrays, { type: mimeType });
}

/**
 * Fast helper to read a Firestore document with a strict timeout so background checks never hang
 */
async function getDocWithTimeout(docRef: ReturnType<typeof doc>, timeoutMs = 3500) {
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), timeoutMs)
  );
  return Promise.race([getDoc(docRef), timeoutPromise]);
}

/**
 * Diagnostic test function for the "Kiểm tra kết nối Storage" button:
 * Writes `vstep/exam_audio/_connection_test.txt` to bucket `harrytoeicbackup.firebasestorage.app`
 * and retrieves its direct CDN link via `getDownloadURL`.
 */
export async function testFirebaseStorageConnection(): Promise<StorageConnectionTestResult> {
  const storagePath = `${STORAGE_AUDIO_FOLDER}/_connection_test.txt`;
  const testedAt = new Date().toLocaleString('vi-VN');

  try {
    const testRef = ref(storage, storagePath);
    const payloadText = [
      `VSTEP Firebase Cloud Storage Connection Verified`,
      `APP_SITE_ID: ${APP_SITE_ID}`,
      `STORAGE_BUCKET: ${FIREBASE_STORAGE_BUCKET}`,
      `STORAGE_AUDIO_FOLDER: ${STORAGE_AUDIO_FOLDER}`,
      `AUDIO_KEY_PREFIX: ${AUDIO_KEY_PREFIX}`,
      `TestedAt: ${new Date().toISOString()}`,
    ].join('\n');

    const testBlob = new Blob([payloadText], { type: 'text/plain;charset=utf-8' });
    const uploadTask = uploadBytesResumable(testRef, testBlob, {
      contentType: 'text/plain;charset=utf-8',
      customMetadata: {
        site: APP_SITE_ID,
        purpose: 'connection_test',
      },
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        try {
          uploadTask.cancel();
        } catch {
          // Ignore
        }
        reject(
          new Error(
            'Quá thời gian chờ (12 giây) khi ghi vào Firebase Storage. Vui lòng kiểm tra Storage Rules của bucket harrytoeicbackup.firebasestorage.app.'
          )
        );
      }, 12000);

      uploadTask.on(
        'state_changed',
        undefined,
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
        () => {
          clearTimeout(timer);
          resolve();
        }
      );
    });

    const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
    return {
      ok: true,
      bucket: FIREBASE_STORAGE_BUCKET,
      storagePath,
      downloadUrl,
      testedAt,
    };
  } catch (err: unknown) {
    const errorCode = (err as { code?: string })?.code || 'storage/error';
    const rawMsg =
      err instanceof Error ? err.message : String(err || 'Lỗi kết nối Firebase Storage');
    return {
      ok: false,
      bucket: FIREBASE_STORAGE_BUCKET,
      storagePath,
      testedAt,
      errorCode,
      errorMessage: rawMsg,
    };
  }
}

/**
 * Uploads binary MP3 Blob directly to Firebase Cloud Storage under isolated namespace:
 * `vstep/exam_audio/vstep_{cleanKey}.mp3` using `uploadBytesResumable`, retrieves the CDN link
 * via `getDownloadURL`, and saves `storageUrl` into Firestore `test_audio_chunks/vstep_{cleanKey}_meta`.
 */
export async function uploadAudioBlobToFirebaseStorage(
  rawKey: string,
  blob: Blob,
  fileName = 'audio.mp3',
  onPercent?: (percent: number) => void
): Promise<string | null> {
  const vstepKey = ensureVstepAudioKey(rawKey);
  const legacyKey = cleanAudioStorageKey(rawKey);
  const vstepFileKey = fileName ? ensureVstepFileFallbackKey(fileName) : '';
  const storagePath = getVstepStoragePath(vstepKey);

  try {
    const audioRef = ref(storage, storagePath);
    const mimeType = blob.type || 'audio/mpeg';

    const uploadTask = uploadBytesResumable(audioRef, blob, {
      contentType: mimeType,
      customMetadata: {
        site: APP_SITE_ID,
        audioKey: vstepKey,
        originalFileName: fileName,
      },
    });

    await new Promise<void>((resolve, reject) => {
      let lastActivityTime = Date.now();
      let hasProgressed = false;

      // Watchdog so if Firebase Storage Rules block or stall at 0 bytes, we fail fast (10s) and let fallback run
      const stallInterval = setInterval(() => {
        const elapsed = Date.now() - lastActivityTime;
        const timeoutLimit = hasProgressed ? 25000 : 10000;
        if (elapsed > timeoutLimit) {
          clearInterval(stallInterval);
          try {
            uploadTask.cancel();
          } catch {
            // Ignore
          }
          reject(new Error('Firebase Storage upload timed out or blocked by Storage Rules'));
        }
      }, 2000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          lastActivityTime = Date.now();
          if (snapshot.bytesTransferred > 0) {
            hasProgressed = true;
          }
          if (snapshot.totalBytes > 0) {
            const pct = Math.min(
              99,
              Math.max(5, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
            );
            onPercent?.(pct);
          }
        },
        (error) => {
          clearInterval(stallInterval);
          reject(error);
        },
        () => {
          clearInterval(stallInterval);
          resolve();
        }
      );
    });

    const storageUrl = await getDownloadURL(uploadTask.snapshot.ref);
    if (!storageUrl) return null;

    onPercent?.(100);
    recordFirebaseStorageUrl([vstepKey, legacyKey, vstepFileKey], storageUrl);

    // Save `storageUrl` into Firestore `test_audio_chunks/vstep_{cleanKey}_meta` so any Student device
    // looking up `vstep_{cleanKey}` or `vstep_file_{fileName}` immediately gets the direct CDN link!
    if (canWriteToFirestore()) {
      const now = Date.now();
      const vstepChunkKey = toFirestoreChunkKey(vstepKey);
      const metaPayload = {
        key: vstepChunkKey,
        site: APP_SITE_ID,
        bucket: FIREBASE_STORAGE_BUCKET,
        storagePath,
        storageUrl,
        fileName,
        mimeType,
        byteSize: blob.size,
        totalChunks: 0,
        updatedAt: now,
      };

      const metaWrites: Promise<boolean>[] = [
        safeSetDoc(doc(db, 'test_audio_chunks', `${vstepChunkKey}_meta`), metaPayload, undefined, 6000),
      ];

      const legacyChunkKey = toFirestoreChunkKey(legacyKey);
      if (legacyChunkKey && legacyChunkKey !== vstepChunkKey) {
        metaWrites.push(
          safeSetDoc(
            doc(db, 'test_audio_chunks', `${legacyChunkKey}_meta`),
            { ...metaPayload, key: legacyChunkKey },
            undefined,
            6000
          )
        );
      }

      if (vstepFileKey) {
        const fileChunkKey = toFirestoreChunkKey(vstepFileKey);
        metaWrites.push(
          safeSetDoc(
            doc(db, 'test_audio_chunks', `${fileChunkKey}_meta`),
            { ...metaPayload, key: fileChunkKey },
            undefined,
            6000
          )
        );
      }

      await Promise.allSettled(metaWrites);
    }

    return storageUrl;
  } catch (err) {
    console.warn('Firebase Storage direct upload notice (falling back to Server/Firestore chunks):', err);
    return null;
  }
}

/**
 * Checks whether an audio file exists in Firebase Cloud Storage (`vstep/exam_audio/vstep_{cleanKey}.mp3`)
 * or has a `storageUrl` recorded in Firestore `test_audio_chunks/vstep_{cleanKey}_meta`.
 */
export async function resolveFirebaseStorageCdnUrl(
  rawKey: string,
  fallbackFileName?: string
): Promise<string | null> {
  const cached = getCachedFirebaseStorageUrl(rawKey);
  if (cached) return cached;

  if (fallbackFileName) {
    const cachedByFile = getCachedFirebaseStorageUrl(ensureVstepFileFallbackKey(fallbackFileName));
    if (cachedByFile) return cachedByFile;
  }

  const vstepKey = ensureVstepAudioKey(rawKey);
  const legacyKey = cleanAudioStorageKey(rawKey);
  const vstepFileKey = fallbackFileName ? ensureVstepFileFallbackKey(fallbackFileName) : '';

  // 1. Check Firestore `test_audio_chunks/vstep_{cleanKey}_meta` for saved `storageUrl`
  try {
    const candidateChunkKeys = Array.from(
      new Set(
        [
          toFirestoreChunkKey(vstepKey),
          legacyKey ? toFirestoreChunkKey(legacyKey) : '',
          vstepFileKey ? toFirestoreChunkKey(vstepFileKey) : '',
        ].filter(Boolean)
      )
    );

    for (const cKey of candidateChunkKeys) {
      const metaSnap = await getDocWithTimeout(doc(db, 'test_audio_chunks', `${cKey}_meta`), 3000);
      if (metaSnap && metaSnap.exists()) {
        const data = metaSnap.data() as { storageUrl?: string };
        if (data?.storageUrl && data.storageUrl.startsWith('http')) {
          recordFirebaseStorageUrl([vstepKey, legacyKey, vstepFileKey], data.storageUrl);
          return data.storageUrl;
        }
      }
    }
  } catch {
    // Ignore and try direct Storage lookup
  }

  // 2. Try direct `getDownloadURL` on `vstep/exam_audio/vstep_{cleanKey}.mp3` in Firebase Storage
  const storageCandidatePaths = Array.from(
    new Set(
      [
        getVstepStoragePath(vstepKey),
        vstepFileKey ? getVstepStoragePath(vstepFileKey) : '',
      ].filter(Boolean)
    )
  );

  for (const sPath of storageCandidatePaths) {
    for (const bucketInstance of [storage, storageAppspot]) {
      try {
        const fileRef = ref(bucketInstance, sPath);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
        const url = await Promise.race([getDownloadURL(fileRef), timeoutPromise]);
        if (url && typeof url === 'string' && url.startsWith('http')) {
          recordFirebaseStorageUrl([vstepKey, legacyKey, vstepFileKey], url);
          return url;
        }
      } catch {
        // Object does not exist at this path or Storage rules restricted
      }
    }
  }

  return null;
}

/**
 * Checks whether the MP3 file already exists on the Express server (`/api/audio/exists/:key`)
 * Supports both `vstep_` prefixed keys and legacy keys.
 */
export async function checkAudioExistsOnServer(
  rawKey: string,
  expectedByteSize?: number,
  fallbackFileName?: string
): Promise<{ exists: boolean; streamUrl?: string }> {
  try {
    const cleanKey = cleanAudioStorageKey(rawKey);
    const vstepKey = ensureVstepAudioKey(cleanKey);
    if (!cleanKey && !fallbackFileName) return { exists: false };

    const candidateKeys = Array.from(
      new Set([
        vstepKey,
        cleanKey,
        fallbackFileName ? ensureVstepFileFallbackKey(fallbackFileName) : '',
        fallbackFileName ? getLegacyFileFallbackKey(fallbackFileName) : '',
      ].filter(Boolean))
    );

    const query = fallbackFileName
      ? `?fileName=${encodeURIComponent(fallbackFileName)}`
      : '';

    for (const lookupKey of candidateKeys) {
      const resp = await fetch(`/api/audio/exists/${encodeURIComponent(lookupKey)}${query}`);
      if (!resp.ok) continue;
      const data = (await resp.json()) as {
        exists?: boolean;
        byteSize?: number;
        streamUrl?: string;
      };
      if (!data?.exists) continue;
      if (
        expectedByteSize &&
        expectedByteSize > 0 &&
        data.byteSize &&
        data.byteSize !== expectedByteSize
      ) {
        continue;
      }
      return {
        exists: true,
        streamUrl: data.streamUrl || `/api/audio/stream/${encodeURIComponent(lookupKey)}${query}`,
      };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

/**
 * Uploads an audio Blob to `/api/audio/upload-chunk` in 384KB JSON base64 chunks
 * so every chunk passes cleanly through proxies and reports real-time 0% -> 100% progress.
 */
export async function uploadAudioBlobToServer(
  rawKey: string,
  blob: Blob,
  fileName = 'audio.mp3',
  onPercent?: (percent: number) => void
): Promise<boolean> {
  try {
    const vstepKey = ensureVstepAudioKey(rawKey);
    const fullBuffer = await blob.arrayBuffer();
    if (!fullBuffer || fullBuffer.byteLength <= 0) {
      return false;
    }

    const bytes = new Uint8Array(fullBuffer);
    const CHUNK_BYTE_SIZE = 384 * 1024; // 384KB per chunk (~512KB JSON body)
    const totalChunks = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTE_SIZE));
    const mimeType = blob.type || 'audio/mpeg';

    for (let idx = 0; idx < totalChunks; idx++) {
      const start = idx * CHUNK_BYTE_SIZE;
      const end = Math.min(bytes.length, start + CHUNK_BYTE_SIZE);
      const slice = bytes.subarray(start, end);
      const chunkBase64 = uint8ArrayToBase64(slice);

      let chunkOk = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const resp = await fetch('/api/audio/upload-chunk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: vstepKey,
              fileName,
              mimeType,
              chunkIndex: idx,
              totalChunks,
              chunkBase64,
            }),
          });
          if (resp.ok) {
            chunkOk = true;
            break;
          }
        } catch {
          // Retry once
        }
      }

      if (!chunkOk) {
        return false;
      }

      const pct = Math.min(99, Math.max(5, Math.round(((idx + 1) / totalChunks) * 100)));
      onPercent?.(pct);
    }

    onPercent?.(100);
    return true;
  } catch (err) {
    console.warn('Error uploading audio chunks to server:', err);
    return false;
  }
}

/**
 * Checks whether a Cloud/Storage/Server audio entry already exists and is complete
 */
export async function checkAudioExistsOnCloud(
  rawKey: string,
  expectedByteSize?: number,
  fallbackFileName?: string
): Promise<boolean> {
  // 1. Check Firebase Cloud Storage CDN (`vstep/exam_audio/vstep_{cleanKey}.mp3`)
  const storageUrl = await resolveFirebaseStorageCdnUrl(rawKey, fallbackFileName);
  if (storageUrl) return true;

  // 2. Check fast Express server storage (<10ms)
  const serverRes = await checkAudioExistsOnServer(rawKey, expectedByteSize, fallbackFileName);
  if (serverRes.exists) return true;

  // 3. Fallback check in Firestore chunks (check both `vstep_` key and legacy key)
  try {
    const candidateChunkKeys = Array.from(
      new Set([
        toFirestoreChunkKey(ensureVstepAudioKey(rawKey)),
        toFirestoreChunkKey(rawKey),
      ])
    );

    for (const chunkKey of candidateChunkKeys) {
      const metaRef = doc(db, 'test_audio_chunks', `${chunkKey}_meta`);
      const metaSnap = await getDocWithTimeout(metaRef, 3500);
      if (!metaSnap || !metaSnap.exists()) continue;

      const meta = metaSnap.data() as {
        totalChunks?: number;
        byteSize?: number;
        storageUrl?: string;
      };
      if (meta?.storageUrl && meta.storageUrl.startsWith('http')) {
        return true;
      }
      const totalChunks = Number(meta?.totalChunks) || 0;
      if (totalChunks <= 0) continue;

      if (
        expectedByteSize &&
        expectedByteSize > 0 &&
        meta.byteSize !== expectedByteSize
      ) {
        continue;
      }

      const lastChunkRef = doc(db, 'test_audio_chunks', `${chunkKey}_c${totalChunks - 1}`);
      const lastChunkSnap = await getDocWithTimeout(lastChunkRef, 3500);
      if (lastChunkSnap && lastChunkSnap.exists()) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Automatically patches the resolved audio URL & fileName onto the test document
 * in both `/api/tests/:id/audio-patch` and Firestore `tests/{testId}` (when the test doc exists)
 * so students on any device immediately receive the real MP3 link even if background upload finishes after Save.
 */
export async function patchTestAudioMetadataEverywhere(params: {
  testId: string;
  partScope: 'full' | 1 | 2 | 3 | 4;
  audioUrl: string;
  fileName?: string;
  audioMode?: 'single' | 'per_part';
}): Promise<void> {
  const cleanTestId = (params.testId || '').trim();
  const cleanUrl = (params.audioUrl || '').trim();
  if (!cleanTestId || !cleanUrl) return;

  const patchBody: {
    audioMode?: 'single' | 'per_part';
    audioUrl?: string;
    audioFileName?: string;
    partAudioUrls?: Record<string, string>;
    partAudioFileNames?: Record<string, string>;
  } = {};

  if (params.audioMode) {
    patchBody.audioMode = params.audioMode;
  }

  if (params.partScope === 'full') {
    patchBody.audioUrl = cleanUrl;
    if (params.fileName) patchBody.audioFileName = params.fileName;
  } else {
    const pKey = `part${params.partScope}`;
    patchBody.partAudioUrls = { [pKey]: cleanUrl };
    if (params.fileName) {
      patchBody.partAudioFileNames = { [pKey]: params.fileName };
    }
  }

  // 1. Patch on Express Server `/api/tests/:id/audio-patch`
  try {
    await fetch(`/api/tests/${encodeURIComponent(cleanTestId)}/audio-patch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patchBody),
    });
  } catch {
    // Ignore network error
  }

  // 2. Patch on Firestore `tests/{testId}` if document exists
  if (canWriteToFirestore()) {
    try {
      const testRef = doc(db, 'tests', cleanTestId);
      const snap = await getDocWithTimeout(testRef, 3500);
      if (snap && snap.exists()) {
        const existingData = snap.data() as Record<string, any>;
        const updatedDoc: Record<string, any> = {
          ...existingData,
          id: cleanTestId,
          title: existingData.title || `VSTEP Test ${cleanTestId}`,
          updatedAt: Date.now(),
        };
        if (params.audioMode) {
          updatedDoc.audioMode = params.audioMode;
        }
        if (params.partScope === 'full') {
          updatedDoc.audioUrl = cleanUrl;
          if (params.fileName) updatedDoc.audioFileName = params.fileName;
        } else {
          const pKey = `part${params.partScope}`;
          updatedDoc.partAudioUrls = {
            ...(existingData.partAudioUrls || {}),
            [pKey]: cleanUrl,
          };
          if (params.fileName) {
            updatedDoc.partAudioFileNames = {
              ...(existingData.partAudioFileNames || {}),
              [pKey]: params.fileName,
            };
          }
        }
        await safeSetDoc(testRef, updatedDoc, { merge: true }, 6000);
      }
    } catch {
      // Ignore Firestore patch notice
    }
  }
}

function parseCanonicalTestSlotFromKey(
  vstepKey: string
): { testId: string; partScope: 'full' | 1 | 2 | 3 | 4 } | null {
  const withoutPrefix = vstepKey.replace(/^vstep_/, '');
  const match = withoutPrefix.match(/^(.+)_(full|part([1-4]))$/);
  if (!match) return null;
  const testId = match[1];
  const slot = match[2];
  if (slot === 'full') {
    return { testId, partScope: 'full' };
  }
  const pNum = Number(match[3]) as 1 | 2 | 3 | 4;
  return { testId, partScope: pNum };
}

/**
 * Primary Upload Pipeline:
 * 1. Uploads binary MP3 directly to Firebase Cloud Storage (`vstep/exam_audio/vstep_{cleanKey}.mp3`)
 *    via `uploadBytesResumable`, retrieves CDN `storageUrl` via `getDownloadURL`, and saves `storageUrl`
 *    into Firestore `test_audio_chunks/vstep_{cleanKey}_meta`.
 * 2. Also mirrors to Express server `/api/audio/upload-chunk` and falls back to Firestore base64 chunks
 *    if Firebase Storage Rules are not yet opened.
 */
export async function saveAudioBlobToCloudChunks(
  rawKey: string,
  blob: Blob,
  fileName = 'audio.mp3',
  onProgress?: (uploaded: number, total: number) => void
): Promise<boolean> {
  const vstepKey = ensureVstepAudioKey(rawKey);
  const parsedSlot = parseCanonicalTestSlotFromKey(vstepKey);
  onProgress?.(5, 100);

  // 1. Primary: Upload binary Blob directly to Firebase Cloud Storage (`vstep/exam_audio/vstep_{cleanKey}.mp3`)
  const storageUrl = await uploadAudioBlobToFirebaseStorage(vstepKey, blob, fileName, (pct) => {
    onProgress?.(pct, 100);
  });

  if (storageUrl) {
    // Mirror in background to Express server for local preview redundancy (non-blocking)
    uploadAudioBlobToServer(vstepKey, blob, fileName).catch(() => {});
    if (parsedSlot) {
      patchTestAudioMetadataEverywhere({
        testId: parsedSlot.testId,
        partScope: parsedSlot.partScope,
        audioUrl: storageUrl,
        fileName,
      }).catch(() => {});
    }
    return true;
  }

  // 2. Fallback A: High-speed 384KB chunked JSON upload to Express server
  const uploadedToServer = await uploadAudioBlobToServer(vstepKey, blob, fileName, (pct) => {
    onProgress?.(pct, 100);
  });

  if (uploadedToServer) {
    const serverStreamUrl = `/api/audio/stream/${encodeURIComponent(vstepKey)}`;
    recordFirebaseStorageUrl([vstepKey, cleanAudioStorageKey(rawKey)], serverStreamUrl);
    if (parsedSlot) {
      patchTestAudioMetadataEverywhere({
        testId: parsedSlot.testId,
        partScope: parsedSlot.partScope,
        audioUrl: `idb-audio://${vstepKey}`,
        fileName,
      }).catch(() => {});
    }
  }

  // 3. Fallback B: If Firebase Storage Rules were not yet opened, split into Firestore chunks (`test_audio_chunks`)
  if (!canWriteToFirestore()) {
    return uploadedToServer;
  }

  try {
    const chunkKey = toFirestoreChunkKey(vstepKey);
    const dataUrl = await blobToBase64DataUrl(blob);
    const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    if (!rawBase64) return uploadedToServer;

    const chunks: string[] = [];
    for (let i = 0; i < rawBase64.length; i += CLOUD_CHUNK_CHAR_LIMIT) {
      chunks.push(rawBase64.slice(i, i + CLOUD_CHUNK_CHAR_LIMIT));
    }

    if (chunks.length > 110) {
      return uploadedToServer;
    }

    const now = Date.now();
    const BATCH_SIZE = 2;
    if (!uploadedToServer) {
      onProgress?.(0, chunks.length);
    }

    for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
      const slice = chunks.slice(start, start + BATCH_SIZE);
      const batchResults = await Promise.all(
        slice.map((chunkData, idx) => {
          const chunkIndex = start + idx;
          const chunkDocRef = doc(db, 'test_audio_chunks', `${chunkKey}_c${chunkIndex}`);
          return safeSetDoc(
            chunkDocRef,
            {
              key: chunkKey,
              site: APP_SITE_ID,
              index: chunkIndex,
              data: chunkData,
              updatedAt: now,
            },
            undefined,
            6500
          );
        })
      );

      if (batchResults.some((ok) => !ok)) {
        return uploadedToServer;
      }

      if (!uploadedToServer) {
        onProgress?.(Math.min(chunks.length, start + slice.length), chunks.length);
      }
    }

    const metaDocRef = doc(db, 'test_audio_chunks', `${chunkKey}_meta`);
    const metaSaved = await safeSetDoc(
      metaDocRef,
      {
        key: chunkKey,
        site: APP_SITE_ID,
        fileName,
        mimeType: blob.type || 'audio/mpeg',
        byteSize: blob.size,
        totalChunks: chunks.length,
        updatedAt: now,
      },
      undefined,
      6500
    );

    if (metaSaved && parsedSlot) {
      patchTestAudioMetadataEverywhere({
        testId: parsedSlot.testId,
        partScope: parsedSlot.partScope,
        audioUrl: `idb-audio://${vstepKey}`,
        fileName,
      }).catch(() => {});
    }

    return metaSaved || uploadedToServer;
  } catch (err) {
    console.warn('Cloud audio chunk upload notice:', err);
    return uploadedToServer;
  }
}

/**
 * Downloads and reassembles an audio Blob from Cloud Firestore `/test_audio_chunks/{chunkKey}_meta`
 * Supports both `vstep_` prefixed keys and legacy unprefixed keys.
 */
export async function loadAudioBlobFromCloudChunks(
  rawKey: string
): Promise<{ blob: Blob; fileName: string } | null> {
  try {
    const candidateChunkKeys = Array.from(
      new Set([
        toFirestoreChunkKey(ensureVstepAudioKey(rawKey)),
        toFirestoreChunkKey(rawKey),
      ])
    );

    for (const chunkKey of candidateChunkKeys) {
      const metaRef = doc(db, 'test_audio_chunks', `${chunkKey}_meta`);
      const metaSnap = await getDocWithTimeout(metaRef, 5000);
      if (!metaSnap || !metaSnap.exists()) continue;

      const meta = metaSnap.data() as {
        totalChunks?: number;
        mimeType?: string;
        fileName?: string;
        storageUrl?: string;
      };

      const totalChunks = Number(meta?.totalChunks) || 0;
      if (totalChunks <= 0 || totalChunks > 120) continue;

      const chunkPromises: Promise<string>[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const cRef = doc(db, 'test_audio_chunks', `${chunkKey}_c${i}`);
        chunkPromises.push(
          getDoc(cRef).then((snap) => (snap.exists() ? String(snap.data()?.data || '') : ''))
        );
      }

      const parts = await Promise.all(chunkPromises);
      if (parts.some((p) => !p)) continue;

      const combinedBase64 = parts.join('');
      const blob = base64ToBlob(combinedBase64, meta.mimeType || 'audio/mpeg');
      return {
        blob,
        fileName: meta.fileName || `${chunkKey}.mp3`,
      };
    }
    return null;
  } catch (err) {
    console.warn('Cloud audio chunk load notice:', err);
    return null;
  }
}

/**
 * Persists a student's Speaking voice recording (compressed Opus/WebM) for cross-device & Admin playback.
 */
export async function persistSpeakingAudioBlob(
  blob: Blob,
  partNumber: 1 | 2 | 3
): Promise<{ playableUrl: string; persistentDataUrl: string }> {
  const playableUrl = URL.createObjectURL(blob);
  try {
    const dataUrl = await blobToBase64DataUrl(blob);
    if (dataUrl.length <= INLINE_SPEAKING_DATA_URL_MAX_CHARS) {
      activeObjectUrlCache.set(dataUrl, playableUrl);
      return {
        playableUrl,
        persistentDataUrl: dataUrl,
      };
    }

    const spkKey = ensureVstepAudioKey(`spk_${Date.now()}_p${partNumber}`);
    await saveAudioToIndexedDB(spkKey, blob, `vstep_speaking_part${partNumber}.webm`);
    const idbUri = `idb-audio://${spkKey}`;
    activeObjectUrlCache.set(idbUri, playableUrl);
    activeObjectUrlCache.set(spkKey, playableUrl);
    saveAudioBlobToCloudChunks(spkKey, blob, `vstep_speaking_part${partNumber}.webm`).catch(() => {});
    return {
      playableUrl,
      persistentDataUrl: idbUri,
    };
  } catch {
    return {
      playableUrl,
      persistentDataUrl: playableUrl,
    };
  }
}

/**
 * Persists an uploaded audio File/Blob into IndexedDB immediately (0ms) AND starts background
 * Firebase Cloud Storage upload (`vstep/exam_audio/vstep_{cleanKey}.mp3`) with live % progress.
 */
export async function persistExamAudioFile(
  file: File,
  testId: string,
  partScope: 'full' | number = 'full'
): Promise<{
  persistentUrl: string;
  playableUrl: string;
  audioKey: string;
}> {
  const rawKey = `${testId}_${partScope === 'full' ? 'full' : `part${partScope}`}`;
  const vstepKey = ensureVstepAudioKey(rawKey);
  const versionedIdbUri = await saveAudioToIndexedDB(vstepKey, file, file.name);
  const detachedBlob = activeMemoryBlobCache.get(vstepKey) || file;
  const playableUrl = activeObjectUrlCache.get(versionedIdbUri) || URL.createObjectURL(detachedBlob);

  // Trigger non-blocking background upload to Firebase Storage (`vstep/exam_audio/vstep_{cleanKey}.mp3`)
  startBackgroundTestAudioCloudSync(
    partScope === 'full' ? 'Audio Toàn Bài' : `Listening Part ${partScope}`,
    [
      {
        label: partScope === 'full' ? 'Audio toàn bài' : `Part ${partScope}`,
        fileName: file.name,
        canonicalKey: vstepKey,
        blob: detachedBlob,
      },
    ],
    true
  );

  return {
    persistentUrl: versionedIdbUri,
    playableUrl,
    audioKey: vstepKey,
  };
}

export interface ResolvedLocalSlotItem {
  label: string;
  fileName: string;
  canonicalKey: string;
  blob: Blob;
}

let lastRetryableSyncJob: {
  testTitle: string;
  items: ResolvedLocalSlotItem[];
} | null = null;

export function retryLastAudioCloudSync(): void {
  if (lastRetryableSyncJob && lastRetryableSyncJob.items.length > 0) {
    startBackgroundTestAudioCloudSync(
      lastRetryableSyncJob.testTitle,
      lastRetryableSyncJob.items,
      true
    );
  }
}

async function resolveLocalBlobForSlot(
  rawUrl: string | undefined,
  fileName: string | undefined,
  canonicalKey: string
): Promise<{ blob: Blob; key: string } | null> {
  const trimmed = (rawUrl || '').trim();
  if (trimmed.startsWith('idb-audio://')) {
    const cleanKey = cleanAudioStorageKey(trimmed);
    const vstepKey = ensureVstepAudioKey(cleanKey);
    const b = (await loadAudioBlobFromIndexedDB(vstepKey)) || (await loadAudioBlobFromIndexedDB(cleanKey));
    if (b) return { blob: b, key: vstepKey };
  }

  if (canonicalKey) {
    const vstepCanonical = ensureVstepAudioKey(canonicalKey);
    const bByCanonical =
      (await loadAudioBlobFromIndexedDB(vstepCanonical)) ||
      (await loadAudioBlobFromIndexedDB(canonicalKey));
    if (bByCanonical) return { blob: bByCanonical, key: vstepCanonical };
  }

  if (fileName) {
    const vstepFileKey = ensureVstepFileFallbackKey(fileName);
    const legacyFileKey = getLegacyFileFallbackKey(fileName);
    const b =
      (await loadAudioBlobFromIndexedDB(vstepFileKey)) ||
      (await loadAudioBlobFromIndexedDB(legacyFileKey));
    if (b) {
      const cleanKey = trimmed.startsWith('idb-audio://')
        ? ensureVstepAudioKey(trimmed)
        : ensureVstepAudioKey(canonicalKey || vstepFileKey);
      return { blob: b, key: cleanKey };
    }
  }

  if (trimmed.startsWith('blob:')) {
    try {
      const resp = await fetch(trimmed);
      if (resp.ok) {
        const b = await resp.blob();
        return { blob: b, key: ensureVstepAudioKey(canonicalKey) };
      }
    } catch {
      // Stale blob URL
    }
  }

  return null;
}

/**
 * Step 1 (Instant < 50ms): Normalizes local IndexedDB audio URLs (or already-resolved Firebase Storage CDN URLs)
 * and collects local Blobs BEFORE `saveTestToFirestore` runs, so saving/publishing completes in ~1 second.
 */
export async function prepareLocalTestAudioBeforeSave(params: {
  testId: string;
  audioMode: 'single' | 'per_part';
  audioUrl?: string;
  audioFileName?: string;
  partAudioUrls?: { part1?: string; part2?: string; part3?: string; part4?: string };
  partAudioFileNames?: { part1?: string; part2?: string; part3?: string; part4?: string };
}): Promise<{
  audioUrl?: string;
  partAudioUrls: { part1?: string; part2?: string; part3?: string; part4?: string };
  localItemsToSync: ResolvedLocalSlotItem[];
  unreadableSlotLabels: string[];
}> {
  const nextPartAudioUrls = { ...(params.partAudioUrls || {}) };
  let nextSingleAudioUrl = params.audioUrl;
  const localItemsToSync: ResolvedLocalSlotItem[] = [];
  const unreadableSlotLabels: string[] = [];

  // 1. Check single full-test audio if present
  if ((params.audioUrl && params.audioUrl.trim()) || params.audioFileName) {
    const raw = (params.audioUrl || '').trim();
    const fName = params.audioFileName || 'full_audio.mp3';
    const isRemoteHttp = raw.startsWith('http://') || raw.startsWith('https://');
    const canonicalKey = raw.startsWith('idb-audio://')
      ? ensureVstepAudioKey(raw)
      : ensureVstepAudioKey(`${params.testId}_full`);

    // If we already uploaded this key to Firebase Cloud Storage in this session, attach the CDN `storageUrl` directly!
    const cachedStorageUrl = getCachedFirebaseStorageUrl(canonicalKey);
    if (cachedStorageUrl) {
      nextSingleAudioUrl = cachedStorageUrl;
    }

    if (!isRemoteHttp) {
      const localFound = await resolveLocalBlobForSlot(raw, params.audioFileName, canonicalKey);
      if (localFound) {
        if (!cachedStorageUrl && !raw.startsWith('idb-audio://')) {
          nextSingleAudioUrl = await saveAudioToIndexedDB(canonicalKey, localFound.blob, fName);
        }
        if (!cachedStorageUrl) {
          localItemsToSync.push({
            label: 'Audio toàn bài',
            fileName: fName,
            canonicalKey,
            blob: localFound.blob,
          });
        }
      } else if (!cachedStorageUrl) {
        const existsRemotely = await checkAudioExistsOnCloud(canonicalKey, undefined, fName);
        if (!existsRemotely && params.audioMode === 'single') {
          unreadableSlotLabels.push(`Audio toàn bài (${fName})`);
        }
      }
    }
  }

  // 2. Check per-part audio slots (Part 1, 2, 3, and 4 if present)
  for (const pNum of [1, 2, 3, 4] as const) {
    const partKey = `part${pNum}` as const;
    const raw = (nextPartAudioUrls[partKey] || '').trim();
    const fName = params.partAudioFileNames?.[partKey];
    if (!raw && !fName) continue;

    const isRemoteHttp = raw.startsWith('http://') || raw.startsWith('https://');
    const canonicalKey = raw.startsWith('idb-audio://')
      ? ensureVstepAudioKey(raw)
      : ensureVstepAudioKey(`${params.testId}_part${pNum}`);
    const displayFileName = fName || `Part_${pNum}.mp3`;

    const cachedStorageUrl = getCachedFirebaseStorageUrl(canonicalKey);
    if (cachedStorageUrl) {
      nextPartAudioUrls[partKey] = cachedStorageUrl;
    }

    if (isRemoteHttp) continue;

    const localFound = await resolveLocalBlobForSlot(raw, fName, canonicalKey);
    if (localFound) {
      if (!cachedStorageUrl && !raw.startsWith('idb-audio://')) {
        nextPartAudioUrls[partKey] = await saveAudioToIndexedDB(
          canonicalKey,
          localFound.blob,
          displayFileName
        );
      }
      if (!cachedStorageUrl) {
        localItemsToSync.push({
          label: `Part ${pNum}`,
          fileName: displayFileName,
          canonicalKey,
          blob: localFound.blob,
        });
      }
    } else if (pNum <= 3 && !cachedStorageUrl) {
      const existsRemotely = await checkAudioExistsOnCloud(canonicalKey, undefined, displayFileName);
      if (!existsRemotely) {
        unreadableSlotLabels.push(`Part ${pNum} (${displayFileName})`);
      }
    }
  }

  return {
    audioUrl: nextSingleAudioUrl,
    partAudioUrls: nextPartAudioUrls,
    localItemsToSync,
    unreadableSlotLabels,
  };
}

/**
 * Step 2 (Non-blocking Background Task): Uploads all MP3 files directly to Firebase Cloud Storage
 * (`vstep/exam_audio/vstep_{cleanKey}.mp3`) with live 0% -> 100% progress.
 */
export function startBackgroundTestAudioCloudSync(
  testTitle: string,
  items: ResolvedLocalSlotItem[],
  forceUpload = false
): void {
  if (!items || items.length === 0) return;

  lastRetryableSyncJob = { testTitle, items };

  void (async () => {
    const totalFiles = items.length;
    updateAudioCloudSyncState({
      active: true,
      status: 'syncing',
      testTitle,
      currentFileName: items[0].fileName,
      percent: 5,
      completedFiles: 0,
      totalFiles,
      message: `Đang tải ${totalFiles} file MP3 lên Firebase Storage (${STORAGE_AUDIO_FOLDER})...`,
    });

    let syncedFiles = 0;
    let lastStorageUrl: string | undefined;

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const vstepKey = ensureVstepAudioKey(item.canonicalKey);
      const basePercent = Math.round((idx / totalFiles) * 100);

      updateAudioCloudSyncState({
        active: true,
        status: 'syncing',
        testTitle,
        currentFileName: item.fileName,
        percent: Math.max(5, basePercent),
        completedFiles: idx,
        totalFiles,
        message: `Đang tải ${item.label} (${item.fileName}) lên ${STORAGE_AUDIO_FOLDER}/${vstepKey}.mp3...`,
      });

      if (!forceUpload) {
        const existingCdn = await resolveFirebaseStorageCdnUrl(vstepKey, item.fileName);
        if (existingCdn) {
          syncedFiles++;
          lastStorageUrl = existingCdn;
          const nextPct = Math.round(((idx + 1) / totalFiles) * 100);
          updateAudioCloudSyncState({
            active: true,
            status: 'syncing',
            testTitle,
            currentFileName: item.fileName,
            percent: nextPct,
            completedFiles: idx + 1,
            totalFiles,
            storageUrl: existingCdn,
            message: `Đã có sẵn trên Firebase Storage CDN: ${item.label} (${nextPct}%)`,
          });
          continue;
        }
      }

      const ok = await saveAudioBlobToCloudChunks(
        vstepKey,
        item.blob,
        item.fileName,
        (uploaded, total) => {
          const fileFraction = total > 0 ? uploaded / total : 0;
          const overallPercent = Math.min(
            99,
            Math.max(5, Math.round(((idx + fileFraction) / totalFiles) * 100))
          );
          updateAudioCloudSyncState({
            active: true,
            status: 'syncing',
            testTitle,
            currentFileName: item.fileName,
            percent: overallPercent,
            completedFiles: idx,
            totalFiles,
            message: `Đang tải ${item.label} lên Firebase Storage: ${item.fileName} (${overallPercent}%)...`,
          });
        }
      );

      if (ok) {
        syncedFiles++;
        const resolvedUrl = getCachedFirebaseStorageUrl(vstepKey);
        if (resolvedUrl) {
          lastStorageUrl = resolvedUrl;
        }
      } else {
        break;
      }
    }

    if (syncedFiles === totalFiles) {
      updateAudioCloudSyncState({
        active: true,
        status: 'completed',
        testTitle,
        currentFileName: items[items.length - 1].fileName,
        percent: 100,
        completedFiles: totalFiles,
        totalFiles,
        storageUrl: lastStorageUrl,
        message: lastStorageUrl
          ? `Đã đồng bộ ${totalFiles}/${totalFiles} MP3 lên Firebase Storage (${STORAGE_AUDIO_FOLDER}) (100%)!`
          : `Hoàn tất đồng bộ ${totalFiles}/${totalFiles} file MP3 lên Cloud (100%)!`,
      });
    } else {
      updateAudioCloudSyncState({
        active: true,
        status: 'error',
        testTitle,
        currentFileName: items[Math.min(syncedFiles, items.length - 1)].fileName,
        percent: Math.round((syncedFiles / totalFiles) * 100),
        completedFiles: syncedFiles,
        totalFiles,
        message: `Đã đồng bộ ${syncedFiles}/${totalFiles} file MP3. Hãy bấm "Đổi MP3" chọn lại file từ máy hoặc bấm "Thử lại".`,
      });
    }
  })();
}

/**
 * Normalizes Google Drive / Dropbox share URLs into guaranteed playable audio stream URLs.
 * Routes Google Drive links through `/api/audio-proxy` to bypass virus-scan HTML pages,
 * 303 redirect blocks, and third-party cookie restrictions in modern browsers.
 */
export function normalizeExternalAudioUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  const isGoogleDrive =
    trimmed.includes('drive.google.com/') ||
    trimmed.includes('docs.google.com/uc') ||
    trimmed.includes('drive.usercontent.google.com/');

  if (isGoogleDrive) {
    return `/api/audio-proxy?url=${encodeURIComponent(trimmed)}`;
  }

  if (trimmed.includes('dropbox.com') && trimmed.includes('?dl=0')) {
    return trimmed.replace('?dl=0', '?raw=1');
  }

  return trimmed;
}

/**
 * Resolves any stored audio URL (`idb-audio://...`, Firebase Storage CDN `https://firebasestorage.googleapis.com/...`,
 * `data:audio/...`, stale `blob:...`, or remote URL) into a guaranteed playable browser URL:
 * 1. Local IndexedDB (0ms for Teacher's browser)
 * 2. Direct Firebase Cloud Storage CDN URL (`vstep/exam_audio/vstep_{cleanKey}.mp3` or `storageUrl` in Firestore `_meta`)
 * 3. Fallback to Express Server Stream (`/api/audio/stream/:key`) & Firestore base64 chunks (`test_audio_chunks`)
 */
export async function resolvePlayableAudioUrl(
  rawUrl: string,
  fallbackFileName?: string
): Promise<string | null> {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed && !fallbackFileName) return null;

  // 1. Check in-memory active object URL cache for exact URI (including ?v=timestamp)
  if (trimmed && activeObjectUrlCache.has(trimmed)) {
    return activeObjectUrlCache.get(trimmed)!;
  }

  // 2. If `rawUrl` is already a Firebase Storage CDN link, return the CDN URL immediately
  if (
    trimmed.startsWith('https://firebasestorage.googleapis.com/') ||
    trimmed.startsWith('https://storage.googleapis.com/')
  ) {
    return trimmed;
  }

  // 3. Handle idb-audio:// key -> Local IndexedDB (0ms) -> Firebase Storage CDN (`storageUrl`) -> Server Stream -> Firestore Chunks
  if (trimmed.startsWith('idb-audio://')) {
    const cleanKey = cleanAudioStorageKey(trimmed);
    const vstepKey = ensureVstepAudioKey(cleanKey);

    if (activeObjectUrlCache.has(vstepKey)) {
      const cachedUrl = activeObjectUrlCache.get(vstepKey)!;
      activeObjectUrlCache.set(trimmed, cachedUrl);
      return cachedUrl;
    }
    if (activeObjectUrlCache.has(cleanKey)) {
      const cachedUrl = activeObjectUrlCache.get(cleanKey)!;
      activeObjectUrlCache.set(trimmed, cachedUrl);
      return cachedUrl;
    }

    // 3a. Local IndexedDB (0ms instant playback for the Teacher who uploaded it)
    const localBlob =
      (await loadAudioBlobFromIndexedDB(vstepKey)) ||
      (await loadAudioBlobFromIndexedDB(cleanKey));
    if (localBlob) {
      const objUrl = URL.createObjectURL(localBlob);
      activeObjectUrlCache.set(trimmed, objUrl);
      activeObjectUrlCache.set(vstepKey, objUrl);
      activeObjectUrlCache.set(cleanKey, objUrl);
      activeObjectUrlCache.set(`idb-audio://${vstepKey}`, objUrl);
      activeObjectUrlCache.set(`idb-audio://${cleanKey}`, objUrl);
      return objUrl;
    }

    // 3b. Direct Firebase Cloud Storage CDN URL (`vstep/exam_audio/vstep_{cleanKey}.mp3` or `test_audio_chunks/vstep_{cleanKey}_meta`)
    const storageCdnUrl = await resolveFirebaseStorageCdnUrl(vstepKey, fallbackFileName);
    if (storageCdnUrl) {
      activeObjectUrlCache.set(trimmed, storageCdnUrl);
      activeObjectUrlCache.set(vstepKey, storageCdnUrl);
      activeObjectUrlCache.set(cleanKey, storageCdnUrl);
      activeObjectUrlCache.set(`idb-audio://${vstepKey}`, storageCdnUrl);
      return storageCdnUrl;
    }

    // 3c. Check Fast Express Server Stream (/api/audio/stream/:key)
    const serverCheck = await checkAudioExistsOnServer(vstepKey, undefined, fallbackFileName);
    if (serverCheck.exists && serverCheck.streamUrl) {
      activeObjectUrlCache.set(trimmed, serverCheck.streamUrl);
      activeObjectUrlCache.set(vstepKey, serverCheck.streamUrl);
      activeObjectUrlCache.set(cleanKey, serverCheck.streamUrl);
      return serverCheck.streamUrl;
    }

    // 3d. Fallback to Cloud Firestore base64 chunks (if Storage Rules were not yet opened)
    const cloudAudio =
      (await loadAudioBlobFromCloudChunks(vstepKey)) ||
      (await loadAudioBlobFromCloudChunks(cleanKey));
    if (cloudAudio?.blob) {
      await saveAudioToIndexedDB(vstepKey, cloudAudio.blob, cloudAudio.fileName);
      const objUrl = activeObjectUrlCache.get(vstepKey) || URL.createObjectURL(cloudAudio.blob);
      activeObjectUrlCache.set(trimmed, objUrl);
      activeObjectUrlCache.set(vstepKey, objUrl);
      activeObjectUrlCache.set(cleanKey, objUrl);
      return objUrl;
    }
  }

  // 4. Handle inline base64 data:audio/... URL
  if (trimmed.startsWith('data:audio') || trimmed.startsWith('data:application/octet-stream')) {
    try {
      const mimeMatch = trimmed.match(/^data:([^;]+);base64,/);
      const mime = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
      const blob = base64ToBlob(trimmed, mime);
      const objUrl = URL.createObjectURL(blob);
      activeObjectUrlCache.set(trimmed, objUrl);
      return objUrl;
    } catch {
      return trimmed;
    }
  }

  // 5. If it's a blob: URL, check if it's still alive in the current session
  if (trimmed.startsWith('blob:')) {
    try {
      const resp = await fetch(trimmed);
      if (resp.ok) {
        return trimmed;
      }
    } catch {
      // Stale blob URL from a previous browser session
    }
  }

  // 6. Try recovering by fallbackFileName (`vstep_file_{fileName}` and legacy `file_{fileName}`)
  if (fallbackFileName) {
    const vstepFileKey = ensureVstepFileFallbackKey(fallbackFileName);
    const legacyFileKey = getLegacyFileFallbackKey(fallbackFileName);

    if (activeObjectUrlCache.has(vstepFileKey)) {
      return activeObjectUrlCache.get(vstepFileKey)!;
    }
    if (activeObjectUrlCache.has(legacyFileKey)) {
      return activeObjectUrlCache.get(legacyFileKey)!;
    }

    const recoveredBlob =
      (await loadAudioBlobFromIndexedDB(vstepFileKey)) ||
      (await loadAudioBlobFromIndexedDB(legacyFileKey));
    if (recoveredBlob) {
      const objUrl = URL.createObjectURL(recoveredBlob);
      activeObjectUrlCache.set(vstepFileKey, objUrl);
      activeObjectUrlCache.set(legacyFileKey, objUrl);
      if (trimmed) activeObjectUrlCache.set(trimmed, objUrl);
      return objUrl;
    }

    const storageByFile = await resolveFirebaseStorageCdnUrl(vstepFileKey, fallbackFileName);
    if (storageByFile) {
      activeObjectUrlCache.set(vstepFileKey, storageByFile);
      if (trimmed) activeObjectUrlCache.set(trimmed, storageByFile);
      return storageByFile;
    }

    const serverByFile = await checkAudioExistsOnServer(vstepFileKey, undefined, fallbackFileName);
    if (serverByFile.exists && serverByFile.streamUrl) {
      activeObjectUrlCache.set(vstepFileKey, serverByFile.streamUrl);
      if (trimmed) activeObjectUrlCache.set(trimmed, serverByFile.streamUrl);
      return serverByFile.streamUrl;
    }

    const cloudByFile =
      (await loadAudioBlobFromCloudChunks(vstepFileKey)) ||
      (await loadAudioBlobFromCloudChunks(legacyFileKey));
    if (cloudByFile?.blob) {
      await saveAudioToIndexedDB(vstepFileKey, cloudByFile.blob, cloudByFile.fileName);
      const objUrl = activeObjectUrlCache.get(vstepFileKey) || URL.createObjectURL(cloudByFile.blob);
      activeObjectUrlCache.set(vstepFileKey, objUrl);
      if (trimmed) activeObjectUrlCache.set(trimmed, objUrl);
      return objUrl;
    }
  }

  // 7. Standard http/https URL (with Google Drive / Dropbox normalization)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return normalizeExternalAudioUrl(trimmed);
  }

  return null;
}

/**
 * Comprehensive Canonical Audio Auto-Discovery for Student Devices:
 * Even if the student's cached test metadata did not yet have `audioUrl` or `partAudioUrls` populated,
 * this function automatically discovers real MP3 files or external links by probing:
 * 1. Explicit configured URL / fileName on the test metadata
 * 2. Canonical keys `vstep_{testId}_part{partNum}` and `vstep_{testId}_full` across Local IDB, Firebase Storage,
 *    Server `/api/audio/discover/:testId`, live Firestore `tests/{testId}` document, and Firestore `test_audio_chunks`.
 */
export async function resolveStudentExamAudioUrl(params: {
  testId: string;
  partNum: number;
  audioMode?: 'single' | 'per_part';
  configuredUrl?: string;
  configuredFileName?: string;
  partAudioUrls?: { part1?: string; part2?: string; part3?: string; part4?: string };
  partAudioFileNames?: { part1?: string; part2?: string; part3?: string; part4?: string };
}): Promise<{ playableUrl: string | null; resolvedLabel?: string }> {
  const cleanTestId = (params.testId || '').trim();
  const partNum = params.partNum || 1;
  const partField = `part${partNum}` as 'part1' | 'part2' | 'part3' | 'part4';

  // 1. Try explicit configured URL / fileName first
  const explicitUrl = (params.configuredUrl || '').trim();
  const explicitFileName = (params.configuredFileName || '').trim() || undefined;
  if (explicitUrl || explicitFileName) {
    const resolvedExplicit = await resolvePlayableAudioUrl(explicitUrl, explicitFileName);
    if (resolvedExplicit) {
      return {
        playableUrl: resolvedExplicit,
        resolvedLabel: explicitFileName || `Listening Part ${partNum}`,
      };
    }
  }

  if (!cleanTestId) {
    return { playableUrl: null };
  }

  // 2. Build canonical keys in priority order based on audioMode
  const partCanonicalKey = ensureVstepAudioKey(`${cleanTestId}_part${partNum}`);
  const fullCanonicalKey = ensureVstepAudioKey(`${cleanTestId}_full`);
  const orderedCanonicalKeys =
    params.audioMode === 'per_part'
      ? [
          { key: partCanonicalKey, label: `Audio Part ${partNum}` },
          { key: fullCanonicalKey, label: 'Audio toàn bài' },
        ]
      : [
          { key: fullCanonicalKey, label: 'Audio toàn bài' },
          { key: partCanonicalKey, label: `Audio Part ${partNum}` },
        ];

  // 2a. Check fast local IDB or in-memory cache for canonical keys
  for (const cand of orderedCanonicalKeys) {
    if (activeObjectUrlCache.has(cand.key)) {
      return { playableUrl: activeObjectUrlCache.get(cand.key)!, resolvedLabel: cand.label };
    }
    const cachedCdn = getCachedFirebaseStorageUrl(cand.key);
    if (cachedCdn) {
      return { playableUrl: cachedCdn, resolvedLabel: cand.label };
    }
  }

  // 2b. Query Express Server `/api/audio/discover/:testId` (checks both server audio files AND server custom_tests.json)
  try {
    const resp = await fetch(`/api/audio/discover/${encodeURIComponent(cleanTestId)}`);
    if (resp.ok) {
      const data = (await resp.json()) as {
        full?: { streamUrl?: string; fileName?: string } | null;
        parts?: Record<string, { streamUrl?: string; fileName?: string }>;
        testConfig?: {
          audioMode?: 'single' | 'per_part';
          audioUrl?: string;
          audioFileName?: string;
          partAudioUrls?: Record<string, string>;
          partAudioFileNames?: Record<string, string>;
        } | null;
      };

      const cfg = data?.testConfig;
      const effectiveMode = cfg?.audioMode || params.audioMode || 'single';

      if (effectiveMode === 'per_part') {
        if (data?.parts?.[partField]?.streamUrl) {
          return {
            playableUrl: data.parts[partField].streamUrl!,
            resolvedLabel: data.parts[partField].fileName || `Audio Part ${partNum}`,
          };
        }
        const cfgPartUrl = cfg?.partAudioUrls?.[partField];
        if (cfgPartUrl) {
          const r = await resolvePlayableAudioUrl(cfgPartUrl, cfg?.partAudioFileNames?.[partField]);
          if (r) {
            return {
              playableUrl: r,
              resolvedLabel: cfg?.partAudioFileNames?.[partField] || `Audio Part ${partNum}`,
            };
          }
        }
      }

      if (data?.full?.streamUrl) {
        return {
          playableUrl: data.full.streamUrl,
          resolvedLabel: data.full.fileName || 'Audio toàn bài',
        };
      }
      if (data?.parts?.[partField]?.streamUrl) {
        return {
          playableUrl: data.parts[partField].streamUrl!,
          resolvedLabel: data.parts[partField].fileName || `Audio Part ${partNum}`,
        };
      }
      if (cfg?.audioUrl) {
        const r = await resolvePlayableAudioUrl(cfg.audioUrl, cfg.audioFileName);
        if (r) {
          return {
            playableUrl: r,
            resolvedLabel: cfg.audioFileName || 'Audio toàn bài',
          };
        }
      }
    }
  } catch {
    // Ignore server discovery error and continue to Firebase Storage / Firestore
  }

  // 2c. Probe canonical keys via `resolvePlayableAudioUrl('idb-audio://...')` (checks IDB -> Firebase Storage -> Server -> Firestore Chunks)
  for (const cand of orderedCanonicalKeys) {
    const resolved = await resolvePlayableAudioUrl(`idb-audio://${cand.key}`);
    if (resolved) {
      return { playableUrl: resolved, resolvedLabel: cand.label };
    }
  }

  // 2d. Check live Firestore `tests/{testId}` document in case Teacher just saved an external link or updated URLs
  try {
    const testSnap = await getDocWithTimeout(doc(db, 'tests', cleanTestId), 3500);
    if (testSnap && testSnap.exists()) {
      const tData = testSnap.data() as {
        audioMode?: 'single' | 'per_part';
        audioUrl?: string;
        audioFileName?: string;
        partAudioUrls?: Record<string, string>;
        partAudioFileNames?: Record<string, string>;
      };
      const remotePartUrl = tData?.partAudioUrls?.[partField];
      const remotePartName = tData?.partAudioFileNames?.[partField];
      if (remotePartUrl) {
        const r = await resolvePlayableAudioUrl(remotePartUrl, remotePartName);
        if (r) {
          return { playableUrl: r, resolvedLabel: remotePartName || `Audio Part ${partNum}` };
        }
      }
      if (tData?.audioUrl) {
        const r = await resolvePlayableAudioUrl(tData.audioUrl, tData.audioFileName);
        if (r) {
          return { playableUrl: r, resolvedLabel: tData.audioFileName || 'Audio toàn bài' };
        }
      }
    }
  } catch {
    // Ignore Firestore lookup error
  }

  return { playableUrl: null };
}

