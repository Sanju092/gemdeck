import { openDB, type IDBPDatabase } from 'idb';
import { Preferences } from '@capacitor/preferences';
import type { AppSettings, ChatSession, GemConfig, StoredFile } from '../types';
import { DEFAULT_GEMS } from '../data/defaultGems';

const DB_NAME = 'gemdeck-local-db';
const DB_VERSION = 2;
const SETTINGS_KEY = 'gemdeck_settings_v1';

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('gems')) {
        db.createObjectStore('gems', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'id' });
      }
    },
  });
}

export async function loadGems(): Promise<GemConfig[]> {
  const db = await getDb();
  const all = (await db.getAll('gems')) as GemConfig[];
  if (!all.length) {
    for (const g of DEFAULT_GEMS) {
      await db.put('gems', g);
    }
    return DEFAULT_GEMS;
  }
  return all;
}

export async function saveGem(gem: GemConfig): Promise<void> {
  const db = await getDb();
  await db.put('gems', gem);
}

export async function deleteGem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('gems', id);
}

export async function loadSessions(): Promise<ChatSession[]> {
  const db = await getDb();
  const all = (await db.getAll('sessions')) as ChatSession[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveSession(session: ChatSession): Promise<void> {
  const db = await getDb();
  await db.put('sessions', session);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sessions', id);
}

export async function loadStoredFiles(): Promise<StoredFile[]> {
  const db = await getDb();
  const all = (await db.getAll('files')) as StoredFile[];
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveStoredFile(file: StoredFile): Promise<void> {
  const db = await getDb();
  await db.put('files', file);
}

export async function deleteStoredFile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('files', id);
}

export async function loadSettings(): Promise<AppSettings> {
  const defaults: AppSettings = {
    theme: 'dark',
    demoMode: true,
    apiKeys: { gemini: '', openai: '', anthropic: '', nvidia: '' },
    customModels: { gemini: [], openai: [], anthropic: [], nvidia: [] },
  };
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (!value) return defaults;
    const parsed = JSON.parse(value);
    return {
      ...defaults,
      ...parsed,
      apiKeys: { ...defaults.apiKeys, ...(parsed.apiKeys || {}) },
      customModels: { ...defaults.customModels, ...(parsed.customModels || {}) },
    };
  } catch {
    return defaults;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await Preferences.set({
    key: SETTINGS_KEY,
    value: JSON.stringify(settings),
  });
}

export async function exportFullBackup(): Promise<string> {
  const [gems, sessions, files] = await Promise.all([loadGems(), loadSessions(), loadStoredFiles()]);
  return JSON.stringify(
    { version: 2, exportedAt: new Date().toISOString(), gems, sessions, files },
    null,
    2
  );
}

export async function importFullBackup(
  rawJson: string
): Promise<{ gems: GemConfig[]; sessions: ChatSession[]; files: StoredFile[] }> {
  const parsed = JSON.parse(rawJson);
  const db = await getDb();
  if (Array.isArray(parsed.gems)) {
    await db.clear('gems');
    for (const g of parsed.gems) await db.put('gems', g);
  }
  if (Array.isArray(parsed.sessions)) {
    await db.clear('sessions');
    for (const s of parsed.sessions) await db.put('sessions', s);
  }
  if (Array.isArray(parsed.files)) {
    await db.clear('files');
    for (const f of parsed.files) await db.put('files', f);
  }
  return {
    gems: await loadGems(),
    sessions: await loadSessions(),
    files: await loadStoredFiles(),
  };
}
