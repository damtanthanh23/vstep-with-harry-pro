const IDB_NAME = 'langcert_audio_storage_v1';
const IDB_STORE = 'audio_blobs';

interface StoredAudioRecord {
  key: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  updatedAt: number;
}

// Keep an in-memory map of active Object URLs so we never lose a newly uploaded file's blob URL
const activeObjectUrlCache = new Map<string, string>();

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
  const baseKey = cleanAudioStorageKey(key);
  const versionedIdbUri = `idb-audio://${baseKey}?v=${Date.now()}`;
  const plainIdbUri = `idb-audio://${baseKey}`;
  const safeFileKey = fileName
    ? `file_${fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
    : '';

  // Create and cache a live Object URL immediately BEFORE async IndexedDB write
  const freshObjUrl = URL.createObjectURL(blob);
  activeObjectUrlCache.set(baseKey, freshObjUrl);
  activeObjectUrlCache.set(plainIdbUri, freshObjUrl);
  activeObjectUrlCache.set(versionedIdbUri, freshObjUrl);
  if (safeFileKey) {
    activeObjectUrlCache.set(safeFileKey, freshObjUrl);
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
        mimeType: blob.type || 'audio/mpeg',
        blob,
        updatedAt: now,
      };
      store.put(record);

      // Also cache by fileName as a secondary fallback key
      if (safeFileKey) {
        store.put({
          key: safeFileKey,
          fileName,
          mimeType: blob.type || 'audio/mpeg',
          blob,
          updatedAt: now,
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
    const dbInstance = await openAudioDatabase();
    return await new Promise<Blob | null>((resolve) => {
      const tx = dbInstance.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(cleanKey);
      req.onsuccess = () => {
        const res = req.result as StoredAudioRecord | undefined;
        resolve(res?.blob || null);
      };
      req.onerror = () => resolve(null);
    });
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
 * Persists an uploaded audio File/Blob directly into IndexedDB (zero Firestore quota usage,
 * supports large MP3 files without hitting Firestore's 20k daily free write limit).
 * Returns a versioned `idb-audio://key?v=timestamp` URI so uploading a different file
 * always triggers immediate reload in React and AudioManager.
 */
export async function persistExamAudioFile(
  file: File,
  testId: string,
  partScope: 'full' | number = 'full'
): Promise<{ persistentUrl: string; playableUrl: string; audioKey: string }> {
  const rawKey = `${testId}_${partScope === 'full' ? 'full' : `part${partScope}`}`;
  const safeKey = cleanAudioStorageKey(rawKey);
  const versionedIdbUri = await saveAudioToIndexedDB(safeKey, file, file.name);
  const playableUrl = activeObjectUrlCache.get(versionedIdbUri) || URL.createObjectURL(file);

  return {
    persistentUrl: versionedIdbUri,
    playableUrl,
    audioKey: safeKey,
  };
}

/**
 * Normalizes Google Drive / Dropbox share URLs into direct audio stream URLs
 */
export function normalizeExternalAudioUrl(url: string): string {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';

  // Google Drive: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const gdriveMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://docs.google.com/uc?export=download&id=${gdriveMatch[1]}`;
  }

  // Dropbox: ?dl=0 -> ?raw=1
  if (trimmed.includes('dropbox.com') && trimmed.includes('?dl=0')) {
    return trimmed.replace('?dl=0', '?raw=1');
  }

  return trimmed;
}

/**
 * Resolves any stored audio URL (`idb-audio://...`, `data:audio/...`, stale `blob:...`, or remote URL)
 * into a guaranteed playable browser URL.
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

  // 2. Handle idb-audio:// key (with or without ?v=timestamp)
  if (trimmed.startsWith('idb-audio://')) {
    const cleanKey = cleanAudioStorageKey(trimmed);
    if (activeObjectUrlCache.has(cleanKey)) {
      const cachedUrl = activeObjectUrlCache.get(cleanKey)!;
      activeObjectUrlCache.set(trimmed, cachedUrl);
      return cachedUrl;
    }

    const blob = await loadAudioBlobFromIndexedDB(cleanKey);
    if (blob) {
      const objUrl = URL.createObjectURL(blob);
      activeObjectUrlCache.set(trimmed, objUrl);
      activeObjectUrlCache.set(cleanKey, objUrl);
      activeObjectUrlCache.set(`idb-audio://${cleanKey}`, objUrl);
      return objUrl;
    }
  }

  // 3. Handle inline base64 data:audio/... URL -> convert to Blob ObjectURL so browser never stalls on huge strings
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

  // 4. If it's a blob: URL, check if it's still alive in the current session via a quick fetch check
  if (trimmed.startsWith('blob:')) {
    try {
      const resp = await fetch(trimmed);
      if (resp.ok) {
        return trimmed;
      }
    } catch {
      // Stale blob URL from a previous browser session! Try recovering by fallbackFileName in IndexedDB
    }
  }

  // 5. Try recovering by fallbackFileName in IndexedDB if rawUrl was a stale blob: or empty
  if (fallbackFileName) {
    const safeFileKey = `file_${fallbackFileName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    if (activeObjectUrlCache.has(safeFileKey)) {
      return activeObjectUrlCache.get(safeFileKey)!;
    }
    const recoveredBlob = await loadAudioBlobFromIndexedDB(safeFileKey);
    if (recoveredBlob) {
      const objUrl = URL.createObjectURL(recoveredBlob);
      activeObjectUrlCache.set(safeFileKey, objUrl);
      if (trimmed) activeObjectUrlCache.set(trimmed, objUrl);
      return objUrl;
    }
  }

  // 6. Standard http/https URL (with Google Drive / Dropbox normalization)
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return normalizeExternalAudioUrl(trimmed);
  }

  return null;
}
