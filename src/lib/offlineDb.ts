import type {
  DailySummary,
  Habit,
  HabitCompletion,
  HabitFormInput,
  Profile,
  UserSettings,
} from '../types/database';

const DB_NAME = 'cadence_offline_v1';
const DB_VERSION = 1;

export interface UserSnapshot {
  userId: string;
  email: string;
  isLocalOnly: boolean;
  profile: Profile | null;
  settings: UserSettings | null;
  habits: Habit[];
  completions: HabitCompletion[];
  summaries: DailySummary[];
  updatedAt: string;
}

export interface StoredUploadedPhoto {
  id: string;
  userId: string;
  dataUrl: string;
  createdAt: string;
}

export type SyncOperationType =
  | 'CREATE_HABIT'
  | 'UPDATE_HABIT'
  | 'DELETE_HABIT'
  | 'TOGGLE_COMPLETION'
  | 'UPDATE_PROFILE'
  | 'UPDATE_SETTINGS';

export interface SyncQueueItem {
  id: string;
  userId: string;
  type: SyncOperationType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface HabitBackupBundle {
  version: number;
  exportedAt: string;
  profile: Profile | null;
  settings: UserSettings | null;
  habits: Habit[];
  completions: HabitCompletion[];
  summaries: DailySummary[];
  uploadedPhotos: StoredUploadedPhoto[];
}

export interface CreateHabitQueuePayload extends HabitFormInput {
  id: string;
}

const MEMORY_SNAPSHOTS = new Map<string, UserSnapshot>();
const MEMORY_PHOTOS = new Map<string, StoredUploadedPhoto[]>();
const MEMORY_QUEUE = new Map<string, SyncQueueItem[]>();

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('user_snapshots')) {
        db.createObjectStore('user_snapshots', { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains('uploaded_photos')) {
        const photoStore = db.createObjectStore('uploaded_photos', { keyPath: 'id' });
        photoStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('userId', 'userId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export const offlineDb = {
  async getSnapshot(userId: string): Promise<UserSnapshot | null> {
    if (!hasIndexedDB()) {
      return MEMORY_SNAPSHOTS.get(userId) ?? null;
    }
    try {
      const result = await withStore<UserSnapshot | undefined>(
        'user_snapshots',
        'readonly',
        (store) => store.get(userId)
      );
      return result ?? null;
    } catch {
      return MEMORY_SNAPSHOTS.get(userId) ?? null;
    }
  },

  async saveSnapshot(snapshot: UserSnapshot): Promise<void> {
    MEMORY_SNAPSHOTS.set(snapshot.userId, snapshot);
    if (!hasIndexedDB()) return;
    try {
      await withStore('user_snapshots', 'readwrite', (store) => store.put(snapshot));
    } catch {
      // ignore storage quota errors gracefully
    }
  },

  async patchSnapshot(
    userId: string,
    updater: (prev: UserSnapshot | null) => UserSnapshot
  ): Promise<UserSnapshot> {
    const prev = await offlineDb.getSnapshot(userId);
    const next = updater(prev);
    await offlineDb.saveSnapshot(next);
    return next;
  },

  async listUploadedPhotos(userId: string): Promise<StoredUploadedPhoto[]> {
    if (!hasIndexedDB()) {
      return MEMORY_PHOTOS.get(userId) ?? [];
    }
    try {
      const db = await openDatabase();
      return await new Promise<StoredUploadedPhoto[]>((resolve, reject) => {
        const tx = db.transaction('uploaded_photos', 'readonly');
        const store = tx.objectStore('uploaded_photos');
        const index = store.index('userId');
        const req = index.getAll(userId);
        req.onsuccess = () => {
          const rows = ((req.result ?? []) as StoredUploadedPhoto[]).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
          );
          resolve(rows);
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return MEMORY_PHOTOS.get(userId) ?? [];
    }
  },

  async saveUploadedPhoto(
    userId: string,
    dataUrl: string
  ): Promise<StoredUploadedPhoto> {
    const existing = await offlineDb.listUploadedPhotos(userId);
    const duplicate = existing.find((p) => p.dataUrl === dataUrl);
    if (duplicate) return duplicate;

    const photo: StoredUploadedPhoto = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId,
      dataUrl,
      createdAt: new Date().toISOString(),
    };

    const nextMem = [photo, ...existing];
    MEMORY_PHOTOS.set(userId, nextMem);

    if (hasIndexedDB()) {
      try {
        await withStore('uploaded_photos', 'readwrite', (store) => store.put(photo));
      } catch {
        // ignore quota errors
      }
    }
    return photo;
  },

  async deleteUploadedPhoto(userId: string, photoId: string): Promise<void> {
    const existing = MEMORY_PHOTOS.get(userId) ?? [];
    MEMORY_PHOTOS.set(
      userId,
      existing.filter((p) => p.id !== photoId)
    );
    if (!hasIndexedDB()) return;
    try {
      await withStore('uploaded_photos', 'readwrite', (store) => store.delete(photoId));
    } catch {
      // ignore
    }
  },

  async listSyncQueue(userId: string): Promise<SyncQueueItem[]> {
    if (!hasIndexedDB()) {
      return MEMORY_QUEUE.get(userId) ?? [];
    }
    try {
      const db = await openDatabase();
      return await new Promise<SyncQueueItem[]>((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readonly');
        const store = tx.objectStore('sync_queue');
        const index = store.index('userId');
        const req = index.getAll(userId);
        req.onsuccess = () => {
          const items = ((req.result ?? []) as SyncQueueItem[]).sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt)
          );
          resolve(items);
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      });
    } catch {
      return MEMORY_QUEUE.get(userId) ?? [];
    }
  },

  async enqueueSync(
    userId: string,
    type: SyncOperationType,
    payload: Record<string, unknown>
  ): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      type,
      payload,
      createdAt: new Date().toISOString(),
    };

    const prev = MEMORY_QUEUE.get(userId) ?? [];
    MEMORY_QUEUE.set(userId, [...prev, item]);

    if (hasIndexedDB()) {
      try {
        await withStore('sync_queue', 'readwrite', (store) => store.put(item));
      } catch {
        // ignore
      }
    }
    return item;
  },

  async removeSyncItem(userId: string, itemId: string): Promise<void> {
    const prev = MEMORY_QUEUE.get(userId) ?? [];
    MEMORY_QUEUE.set(
      userId,
      prev.filter((i) => i.id !== itemId)
    );
    if (!hasIndexedDB()) return;
    try {
      await withStore('sync_queue', 'readwrite', (store) => store.delete(itemId));
    } catch {
      // ignore
    }
  },

  async clearSyncQueue(userId: string): Promise<void> {
    const items = await offlineDb.listSyncQueue(userId);
    for (const item of items) {
      await offlineDb.removeSyncItem(userId, item.id);
    }
  },
};
