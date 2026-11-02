import { doc, getDoc } from 'firebase/firestore';
import { db, safeSetDoc, canWriteToFirestore } from '../firebase';

const IDB_NAME = 'langcert_audio_storage_v1';
const IDB_STORE = 'audio_blobs';
const CLOUD_CHUNK_CHAR_LIMIT = 550000; // ~550KB per Firestore document (well below 1MiB limit)
const INLINE_SPEAKING_DATA_URL_MAX_CHARS = 220000; // ~220KB max inline per part so 3 parts fit comfortably in 1 Firestore doc

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

/**
 * Sanitizes key strictly for Firestore `/test_audio_chunks/{chunkId}` rules (`^[a-zA-Z0-9_\-]+$`)
 */
export function toFirestoreChunkKey(rawKey: string): string {
  const cleaned = cleanAudioStorageKey(rawKey)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 95);
  return cleaned || 'audio_default';
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
 * Splits an audio Blob into ~550KB base64 chunks and stores them in Cloud Firestore
 * `/test_audio_chunks/{chunkKey}_meta` and `/test_audio_chunks/{chunkKey}_c0..N`
 * so any device (Students or Admin) can stream/reconstruct the audio seamlessly.
 */
export async function saveAudioBlobToCloudChunks(
  rawKey: string,
  blob: Blob,
  fileName = 'audio.mp3'
): Promise<boolean> {
  if (!canWriteToFirestore()) return false;
  try {
    const chunkKey = toFirestoreChunkKey(rawKey);
    const dataUrl = await blobToBase64DataUrl(blob);
    const rawBase64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    if (!rawBase64) return false;

    const chunks: string[] = [];
    for (let i = 0; i < rawBase64.length; i += CLOUD_CHUNK_CHAR_LIMIT) {
      chunks.push(rawBase64.slice(i, i + CLOUD_CHUNK_CHAR_LIMIT));
    }

    // Cap at 35 chunks (~14MB MP3) to prevent excessive Firestore writes
    if (chunks.length > 35) {
      console.warn('Audio file exceeds 14MB cloud chunk limit; saved in local IndexedDB only.');
      return false;
    }

    const now = Date.now();
    for (let i = 0; i < chunks.length; i++) {
      const chunkDocRef = doc(db, 'test_audio_chunks', `${chunkKey}_c${i}`);
      await safeSetDoc(chunkDocRef, {
        key: chunkKey,
        index: i,
        data: chunks[i],
        updatedAt: now,
      });
    }

    const metaDocRef = doc(db, 'test_audio_chunks', `${chunkKey}_meta`);
    await safeSetDoc(metaDocRef, {
      key: chunkKey,
      fileName,
      mimeType: blob.type || 'audio/mpeg',
      totalChunks: chunks.length,
      updatedAt: now,
    });

    return true;
  } catch (err) {
    console.warn('Cloud audio chunk upload notice:', err);
    return false;
  }
}

/**
 * Downloads and reassembles an audio Blob from Cloud Firestore `/test_audio_chunks/{chunkKey}_meta`
 */
export async function loadAudioBlobFromCloudChunks(
  rawKey: string
): Promise<{ blob: Blob; fileName: string } | null> {
  try {
    const chunkKey = toFirestoreChunkKey(rawKey);
    const metaRef = doc(db, 'test_audio_chunks', `${chunkKey}_meta`);
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) return null;

    const meta = metaSnap.data() as {
      totalChunks?: number;
      mimeType?: string;
      fileName?: string;
    };
    const totalChunks = Number(meta?.totalChunks) || 0;
    if (totalChunks <= 0 || totalChunks > 50) return null;

    const chunkPromises: Promise<string>[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const cRef = doc(db, 'test_audio_chunks', `${chunkKey}_c${i}`);
      chunkPromises.push(
        getDoc(cRef).then((snap) => (snap.exists() ? String(snap.data()?.data || '') : ''))
      );
    }

    const parts = await Promise.all(chunkPromises);
    if (parts.some((p) => !p)) return null;

    const combinedBase64 = parts.join('');
    const blob = base64ToBlob(combinedBase64, meta.mimeType || 'audio/mpeg');
    return {
      blob,
      fileName: meta.fileName || `${chunkKey}.mp3`,
    };
  } catch (err) {
    console.warn('Cloud audio chunk load notice:', err);
    return null;
  }
}

/**
 * Persists a student's Speaking voice recording (compressed Opus/WebM) for cross-device & Admin playback.
 * - If the base64 DataURL is <= 220KB, returns the inline `data:audio/webm;base64,...` directly so it saves inside `speakingSubmission`.
 * - If larger, stores in IndexedDB + Cloud Firestore chunks (`test_audio_chunks`) and returns `idb-audio://spk_...`.
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

    const spkKey = `spk_${Date.now()}_p${partNumber}`;
    await saveAudioToIndexedDB(spkKey, blob, `speaking_part${partNumber}.webm`);
    const idbUri = `idb-audio://${spkKey}`;
    activeObjectUrlCache.set(idbUri, playableUrl);
    activeObjectUrlCache.set(spkKey, playableUrl);
    saveAudioBlobToCloudChunks(spkKey, blob, `speaking_part${partNumber}.webm`).catch(() => {});
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
 * Persists an uploaded audio File/Blob into IndexedDB AND syncs chunks to Cloud Firestore
 * so students on any computer/phone can stream the custom exam Listening MP3.
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

  // Sync audio chunks to Cloud Firestore in background for multi-device playback
  saveAudioBlobToCloudChunks(safeKey, file, file.name).catch(() => {});

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
 * into a guaranteed playable browser URL, with automatic Cloud Firestore chunk recovery.
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

  // 2. Handle idb-audio:// key (with or without ?v=timestamp) -> local IndexedDB first, then Cloud Firestore chunks
  if (trimmed.startsWith('idb-audio://')) {
    const cleanKey = cleanAudioStorageKey(trimmed);
    if (activeObjectUrlCache.has(cleanKey)) {
      const cachedUrl = activeObjectUrlCache.get(cleanKey)!;
      activeObjectUrlCache.set(trimmed, cachedUrl);
      return cachedUrl;
    }

    const localBlob = await loadAudioBlobFromIndexedDB(cleanKey);
    if (localBlob) {
      const objUrl = URL.createObjectURL(localBlob);
      activeObjectUrlCache.set(trimmed, objUrl);
      activeObjectUrlCache.set(cleanKey, objUrl);
      activeObjectUrlCache.set(`idb-audio://${cleanKey}`, objUrl);
      return objUrl;
    }

    // Not in local IndexedDB (e.g. Student/Admin opened on a different device) -> fetch from Cloud Firestore chunks
    const cloudAudio = await loadAudioBlobFromCloudChunks(cleanKey);
    if (cloudAudio?.blob) {
      await saveAudioToIndexedDB(cleanKey, cloudAudio.blob, cloudAudio.fileName);
      const objUrl = activeObjectUrlCache.get(cleanKey) || URL.createObjectURL(cloudAudio.blob);
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

  // 5. Try recovering by fallbackFileName in IndexedDB or Cloud if rawUrl was a stale blob: or empty
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
