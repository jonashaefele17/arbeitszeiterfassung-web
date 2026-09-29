import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { listConflicts, type ConflictDetails } from './syncEngine';

/** Ausstehende Änderungen und offene Konflikte – reaktiv für die Sync-Anzeige. */
export function useSyncCounts(): { pending: number; conflicts: number } {
  return (
    useLiveQuery(async () => ({ pending: await db.outbox.count(), conflicts: await db.conflicts.count() }), []) ?? {
      pending: 0,
      conflicts: 0,
    }
  );
}

/** Offene Konflikte mit beiden Ständen – reaktiv für den Konflikt-Dialog. */
export function useConflicts(): ConflictDetails[] {
  return useLiveQuery(() => listConflicts(), []) ?? [];
}
