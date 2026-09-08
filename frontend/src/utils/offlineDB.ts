const DB_NAME = "mellow-offline-v1";
const STORE = "songs";
const DB_VERSION = 1;

export interface OfflineSong {
  id: string;
  title: string;
  artist: string;
  image: string;
  duration: number;
  audioBlob: Blob;
  mimeType: string;
  savedAt: number;
  size: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineSong(song: OfflineSong): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(song);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineSong(id: string): Promise<OfflineSong | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as OfflineSong | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflineSongs(): Promise<OfflineSong[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OfflineSong[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteOfflineSong(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function hasOfflineSong(id: string): Promise<boolean> {
  const song = await getOfflineSong(id);
  return !!song;
}

/** Create a playable object URL from a stored blob. Caller should revoke when done. */
export function offlineBlobUrl(song: OfflineSong): string {
  return URL.createObjectURL(new Blob([song.audioBlob], { type: song.mimeType || "audio/mpeg" }));
}
