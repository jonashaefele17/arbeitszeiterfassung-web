import { create } from 'zustand';
import { supabase } from '../auth/supabaseClient';
import { db } from '../db/database';
import { onLocalChange } from './outbox';
import { createSupabaseRemote } from './remote';
import {
  bootstrap,
  bootstrapUseAccountData,
  pull,
  push,
  unsyncedCount,
  type BootstrapResult,
  type SyncContext,
} from './syncEngine';

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

interface SyncStatus {
  phase: SyncPhase;
  lastSyncedAt: string | null;
}

/** Sync-Zustand für die Anzeige (keine Nutzdaten). */
export const useSyncStatus = create<SyncStatus>(() => ({ phase: 'idle', lastSyncedAt: null }));

const LAST_SYNC_KEY = 'lastSyncedAt';
const PUSH_DEBOUNCE_MS = 400;
const INTERVAL_MS = 2 * 60 * 1000;

let ctx: SyncContext | null = null;
let running: Promise<boolean> | null = null;
let rerun = false;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let intervalTimer: ReturnType<typeof setInterval> | undefined;
const cleanups: (() => void)[] = [];

function context(userId: string): SyncContext {
  if (!supabase) throw new Error('Supabase ist nicht konfiguriert');
  return { userId, remote: createSupabaseRemote(supabase) };
}

async function runOnce(): Promise<boolean> {
  if (!ctx) return false;
  if (!navigator.onLine) {
    useSyncStatus.setState({ phase: 'offline' });
    return false;
  }
  useSyncStatus.setState({ phase: 'syncing' });
  try {
    await push(ctx);
    await pull(ctx);
    const now = new Date().toISOString();
    await db.meta.put({ key: LAST_SYNC_KEY, value: now });
    useSyncStatus.setState({ phase: 'idle', lastSyncedAt: now });
    return true;
  } catch (error) {
    console.warn('Sync fehlgeschlagen', error);
    useSyncStatus.setState({ phase: navigator.onLine ? 'error' : 'offline' });
    return false;
  }
}

/**
 * Steuert, wann synchronisiert wird: nach lokalen Änderungen (kurz verzögert), beim Start,
 * bei Rückkehr in die App, bei wiederhergestellter Verbindung und alle 2 Minuten.
 * Es läuft immer höchstens ein Sync gleichzeitig.
 */
export const syncService = {
  /** Erster Abgleich des Kontos auf diesem Gerät (braucht beim ersten Mal Internet). */
  async bootstrap(userId: string): Promise<BootstrapResult> {
    return bootstrap(context(userId));
  },

  async useAccountData(userId: string): Promise<void> {
    await bootstrapUseAccountData(context(userId));
  },

  start(userId: string): void {
    this.stop();
    ctx = context(userId);
    void db.meta.get(LAST_SYNC_KEY).then((m) => useSyncStatus.setState({ lastSyncedAt: m?.value ?? null }));

    const soon = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void this.syncNow(), PUSH_DEBOUNCE_MS);
    };
    cleanups.push(onLocalChange(soon));

    const onOnline = () => void this.syncNow();
    const onOffline = () => useSyncStatus.setState({ phase: 'offline' });
    // Beim Zurückkehren abgleichen, beim Verlassen noch schnell hochladen.
    const onVisibility = () => void this.syncNow();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    cleanups.push(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    });

    intervalTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.syncNow();
    }, INTERVAL_MS);

    void this.syncNow();
  },

  stop(): void {
    ctx = null;
    clearTimeout(debounceTimer);
    clearInterval(intervalTimer);
    while (cleanups.length) cleanups.pop()!();
  },

  /** Synchronisiert jetzt; läuft bereits ein Sync, wird danach erneut synchronisiert. */
  async syncNow(): Promise<boolean> {
    if (running) {
      rerun = true;
      return running;
    }
    running = (async () => {
      let ok = await runOnce();
      while (rerun && ctx) {
        rerun = false;
        ok = await runOnce();
      }
      return ok;
    })();
    try {
      return await running;
    } finally {
      running = null;
    }
  },

  unsyncedCount,
};
