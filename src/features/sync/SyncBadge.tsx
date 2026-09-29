import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { transitions } from '../../components/ui/motion';
import { syncService, useSyncStatus } from '../../data/sync/syncService';
import { useSyncCounts } from '../../data/sync/useSyncCounts';
import { useToastStore } from '../../stores/toastStore';
import { useUiStore } from '../../stores/uiStore';

type BadgeState = 'synced' | 'syncing' | 'pending' | 'offline' | 'conflict' | 'error';

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Sync-Zustand für Anzeige und Hinweistext. */
export function useSyncBadgeState(): { state: BadgeState; text: string; pending: number } {
  const { phase, lastSyncedAt } = useSyncStatus();
  const { pending, conflicts } = useSyncCounts();
  const online = useOnline();

  if (conflicts > 0) {
    return {
      state: 'conflict',
      text: `${plural(conflicts, 'Eintrag wurde', 'Einträge wurden')} auf mehreren Geräten geändert und ${conflicts === 1 ? 'wird' : 'werden'} noch nicht synchronisiert.`,
      pending,
    };
  }
  if (!online || phase === 'offline') {
    return {
      state: 'offline',
      text: pending
        ? `Offline – ${plural(pending, 'Änderung wird', 'Änderungen werden')} hochgeladen, sobald du online bist.`
        : 'Offline – alle Änderungen sind gesichert.',
      pending,
    };
  }
  if (phase === 'syncing') return { state: 'syncing', text: 'Wird synchronisiert …', pending };
  if (phase === 'error') return { state: 'error', text: 'Synchronisierung fehlgeschlagen – wird erneut versucht.', pending };
  if (pending > 0) return { state: 'pending', text: `${plural(pending, 'Änderung', 'Änderungen')} ausstehend.`, pending };
  const time = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;
  return { state: 'synced', text: time ? `Synchronisiert um ${time}.` : 'Synchronisiert.', pending };
}

const COLOR: Record<BadgeState, string> = {
  synced: 'text-ink-3',
  syncing: 'text-accent',
  pending: 'text-ink-3',
  offline: 'text-warn-ink',
  conflict: 'text-danger',
  error: 'text-warn-ink',
};

/**
 * Kleines Symbol neben dem Seitentitel: ✓ synchronisiert, ⟳ läuft, Wolke durchgestrichen = offline.
 * Antippen zeigt den Zustand als Text und synchronisiert sofort.
 */
export function SyncBadge() {
  const { state, text, pending } = useSyncBadgeState();

  const onTap = () => {
    if (state === 'conflict') return useUiStore.getState().openConflicts();
    useToastStore.getState().show(text);
    if (navigator.onLine) void syncService.syncNow();
  };

  return (
    <motion.button
      type="button"
      onClick={onTap}
      whileTap={{ scale: 0.9 }}
      transition={transitions.micro}
      aria-label={`Synchronisierung: ${text}`}
      className={`flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 ${COLOR[state]}`}
    >
      <Icon state={state} />
      {(state === 'offline' || state === 'pending') && pending > 0 && (
        <span className="tabular text-[13px] font-semibold">{pending}</span>
      )}
    </motion.button>
  );
}

function Icon({ state }: { state: BadgeState }) {
  const cloud = 'M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.4 4.3 4.3 0 0 0 7 18Z';
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

  if (state === 'syncing') {
    return (
      <motion.svg {...common} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
        <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        <path d="M20 4v4h-4" />
      </motion.svg>
    );
  }
  return (
    <svg {...common}>
      <path d={cloud} />
      {state === 'synced' && <path d="m9.5 13.5 2 2 3.5-4" />}
      {state === 'pending' && <path d="M12 15.5v-4m-1.8 1.8L12 11.5l1.8 1.8" />}
      {(state === 'offline' || state === 'error') && <path d="M4 4l16 16" />}
      {state === 'conflict' && <path d="M12 10.5v3m0 2.2v.1" />}
    </svg>
  );
}
