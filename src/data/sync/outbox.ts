import { db, type SyncTableName } from '../db/database';
import { syncKey } from './tables';

type Listener = () => void;
const listeners = new Set<Listener>();

/** Meldet lokale Änderungen an den Sync (löst zeitnah ein Hochladen aus). */
export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalChange(): void {
  for (const l of listeners) l();
}

/**
 * Merkt einen Datensatz zum Hochladen vor. Muss innerhalb der schreibenden Dexie-Transaktion
 * aufgerufen werden (Tabelle `db.outbox` in die Transaktion aufnehmen), damit lokale Änderung
 * und Outbox-Eintrag immer gemeinsam gespeichert werden.
 */
export async function enqueue(table: SyncTableName, ...ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.outbox.bulkPut(ids.map((id) => ({ key: syncKey(table, id), table, id, stamp: crypto.randomUUID() })));
}
