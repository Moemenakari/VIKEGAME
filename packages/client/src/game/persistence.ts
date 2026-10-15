/**
 * Saves the whole game as ONE record in IndexedDB (one read on start, one write
 * per save) instead of a record per building: the "one trip, not N trips" rule.
 * Many quick changes are batched into a single debounced write.
 * Falls back to localStorage when IndexedDB is unavailable (some private modes).
 */
const DB_NAME = 'jarlheim';
const STORE = 'saves';
const KEY = 'hold';
const FALLBACK_KEY = 'jarlheim.save';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function loadSaveText(): Promise<string | null> {
  try {
    const value = await withStore<unknown>('readonly', (s) => s.get(KEY));
    if (typeof value === 'string') return value;
  } catch {
    // fall through to localStorage
  }
  try {
    return localStorage.getItem(FALLBACK_KEY);
  } catch {
    return null;
  }
}

export async function writeSaveText(text: string): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.put(text, KEY));
    return;
  } catch {
    // fall through to localStorage
  }
  try {
    localStorage.setItem(FALLBACK_KEY, text);
  } catch {
    // Storage is blocked: the game still plays, it just will not be remembered.
  }
}

export async function clearSave(): Promise<void> {
  try {
    await withStore('readwrite', (s) => s.delete(KEY));
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(FALLBACK_KEY);
  } catch {
    // ignore
  }
}

/** Collects many save requests into one write after `delayMs` of quiet. */
export function createDebouncedSaver(write: () => void, delayMs = 1500): { request(): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    request() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        write();
      }, delayMs);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        write();
      }
    },
  };
}
