import type { Table } from 'dexie';
import { db, type OutboxEntry, type SyncTableName } from '../db/database';
import { enqueue } from './outbox';
import type { RemoteApi } from './remote';
import { SYNC_TABLES, SYNC_TABLE_BY_NAME, syncKey, type RemoteRow, type SyncTableSpec } from './tables';

/**
 * Synchronisierung lokal ↔ Server (siehe docs/V2-Konzept.md, Abschnitt 5).
 *
 * - Push: Outbox-Einträge hochladen; Änderungen nur, wenn der Server noch die bekannte Version hat.
 * - Pull: Änderungen seit der letzten bekannten Revision abholen und einspielen.
 * - Konflikte werden festgehalten und nie still überschrieben (Auflösung: Etappe 4).
 */

export interface SyncContext {
  userId: string;
  remote: RemoteApi;
}

const PULL_PAGE = 500;
const BOOTSTRAP_KEY = 'syncBootstrappedUserId';
const revisionKey = (spec: SyncTableSpec) => `revision:${spec.local}`;

const localTable = (name: SyncTableName) => db.table(name) as Table<{ id: string } & Record<string, unknown>, string>;

const LOCAL_DATA_TABLES = () => SYNC_TABLES.map((t) => localTable(t.local));

/** JSON mit sortierten Schlüsseln – Postgres (jsonb) ändert die Schlüsselreihenfolge. */
function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Entspricht die Serverzeile inhaltlich dem lokalen Datensatz? */
export function sameContent(spec: SyncTableSpec, local: object | undefined, row: RemoteRow | null): boolean {
  if (!row) return !local;
  if (!local) return row.deleted === true;
  if (row.deleted === true) return false;
  const wanted = spec.toRemote(local);
  return Object.entries(wanted).every(([k, v]) => stableStringify(row[k]) === stableStringify(v));
}

async function removeIfUnchanged(entry: OutboxEntry): Promise<void> {
  const current = await db.outbox.get(entry.key);
  if (current?.stamp === entry.stamp) await db.outbox.delete(entry.key);
}

async function recordConflict(entry: OutboxEntry, remote: RemoteRow | null): Promise<void> {
  await db.conflicts.put({
    key: entry.key,
    table: entry.table,
    id: entry.id,
    remote,
    detectedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

export interface PushResult {
  pushed: number;
  conflicts: number;
}

export async function push(ctx: SyncContext): Promise<PushResult> {
  const order = new Map(SYNC_TABLES.map((t, i) => [t.local, i]));
  const entries = (await db.outbox.toArray()).sort((a, b) => order.get(a.table)! - order.get(b.table)!);
  const blocked = new Set((await db.conflicts.toCollection().primaryKeys()) as string[]);
  const result: PushResult = { pushed: 0, conflicts: 0 };

  for (const entry of entries) {
    if (blocked.has(entry.key)) continue;
    const spec = SYNC_TABLE_BY_NAME[entry.table];
    const local = await localTable(entry.table).get(entry.id);
    const base = (await db.recordVersions.get(entry.key))?.version;
    const remoteId = spec.toRemoteId(entry.id, ctx);

    if (base === undefined && !local) {
      // Nie hochgeladen und lokal schon wieder gelöscht: nichts zu tun.
      await removeIfUnchanged(entry);
      continue;
    }

    const outcome =
      base === undefined
        ? await ctx.remote.insert(spec, remoteId, spec.toRemote(local!))
        : await ctx.remote.update(
            spec,
            remoteId,
            base,
            local ? { ...spec.toRemote(local), deleted: false } : { deleted: true },
          );

    // Auch ein „Konflikt“ mit identischem Inhalt ist ein Erfolg (z. B. Antwort ging beim letzten Mal verloren).
    const accepted = outcome.ok || (outcome.row && outcome.row.id === remoteId && sameContent(spec, local, outcome.row));
    if (accepted && outcome.row) {
      const row = outcome.row;
      await db.transaction('rw', db.recordVersions, db.outbox, async () => {
        if (row.deleted) await db.recordVersions.delete(entry.key);
        else await db.recordVersions.put({ key: entry.key, version: Number(row.version) });
        await removeIfUnchanged(entry);
      });
      result.pushed++;
    } else {
      await recordConflict(entry, outcome.row);
      result.conflicts++;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

async function applyRemoteRows(spec: SyncTableSpec, rows: RemoteRow[]): Promise<void> {
  const table = localTable(spec.local);
  await db.transaction('rw', [table, db.outbox, db.recordVersions, db.conflicts], async () => {
    for (const row of rows) {
      const localId = spec.toLocalId(String(row.id));
      const key = syncKey(spec.local, localId);

      // Lokal ausstehende Änderung oder offener Konflikt: nicht überschreiben – der Push entscheidet.
      if ((await db.outbox.get(key)) || (await db.conflicts.get(key))) continue;

      if (row.deleted) {
        await table.delete(localId);
        await db.recordVersions.delete(key);
        continue;
      }

      const record = spec.fromRemote(row) as { id: string } & Record<string, unknown>;

      // Fachlich eindeutiges Feld (z. B. Datum eines Arbeitstags) lokal unter anderer ID belegt?
      if (spec.uniqueField) {
        const other = await table.where(spec.uniqueField.local).equals(record[spec.uniqueField.local] as string).first();
        if (other && other.id !== localId) {
          const otherKey = syncKey(spec.local, other.id);
          if (await db.outbox.get(otherKey)) {
            await db.conflicts.put({ key: otherKey, table: spec.local, id: other.id, remote: row, detectedAt: new Date().toISOString() });
            continue;
          }
          await table.delete(other.id);
          await db.recordVersions.delete(otherKey);
        }
      }

      await table.put(record);
      await db.recordVersions.put({ key, version: Number(row.version) });
    }
  });
}

export async function pull(ctx: SyncContext): Promise<number> {
  let applied = 0;
  for (const spec of SYNC_TABLES) {
    let since = Number((await db.meta.get(revisionKey(spec)))?.value ?? 0);
    for (;;) {
      const rows = await ctx.remote.fetchChanges(spec, since, PULL_PAGE);
      if (rows.length === 0) break;
      await applyRemoteRows(spec, rows);
      applied += rows.length;
      since = Math.max(since, ...rows.map((r) => Number(r.revision)));
      await db.meta.put({ key: revisionKey(spec), value: String(since) });
      if (rows.length < PULL_PAGE) break;
    }
  }
  return applied;
}

// ---------------------------------------------------------------------------
// Erster Abgleich eines Kontos auf diesem Gerät
// ---------------------------------------------------------------------------

export type BootstrapResult = 'ready' | 'needs-decision';

async function localHasData(): Promise<boolean> {
  const counts = await Promise.all(LOCAL_DATA_TABLES().map((t) => t.count()));
  return counts.some((c) => c > 0);
}

async function markBootstrapped(userId: string): Promise<void> {
  await db.meta.put({ key: BOOTSTRAP_KEY, value: userId });
}

/** Alle lokalen Datensätze zum Hochladen vormerken (Gerätedaten ins leere Konto übernehmen). */
async function enqueueAllLocal(): Promise<void> {
  await db.transaction('rw', [...LOCAL_DATA_TABLES(), db.outbox], async () => {
    for (const spec of SYNC_TABLES) {
      const ids = (await localTable(spec.local).toCollection().primaryKeys()) as string[];
      await enqueue(spec.local, ...ids);
    }
  });
}

/**
 * - Konto leer, Gerät hat Daten → Gerätedaten hochladen
 * - Konto hat Daten, Gerät leer → herunterladen
 * - beide leer → bereit (Onboarding legt Daten an)
 * - beide haben Daten → Entscheidung durch den Nutzer (`needs-decision`)
 */
export async function bootstrap(ctx: SyncContext): Promise<BootstrapResult> {
  if ((await db.meta.get(BOOTSTRAP_KEY))?.value === ctx.userId) return 'ready';

  const [remoteHas, localHas] = await Promise.all([ctx.remote.hasAccountData(), localHasData()]);
  if (localHas && remoteHas) return 'needs-decision';
  if (localHas) await enqueueAllLocal();
  else await pull(ctx);
  await markBootstrapped(ctx.userId);
  return 'ready';
}

/** Entscheidung „Kontodaten verwenden“: Gerätedaten verwerfen und den Kontostand laden. */
export async function bootstrapUseAccountData(ctx: SyncContext): Promise<void> {
  await clearSyncedData({ keepOwner: true });
  await pull(ctx);
  await markBootstrapped(ctx.userId);
}

// ---------------------------------------------------------------------------
// Zustand & Aufräumen
// ---------------------------------------------------------------------------

/** Anzahl der Einträge mit ausstehender Änderung oder offenem Konflikt (jeder Eintrag zählt einmal). */
export async function unsyncedCount(): Promise<number> {
  const [pending, conflicts] = await Promise.all([
    db.outbox.toCollection().primaryKeys(),
    db.conflicts.toCollection().primaryKeys(),
  ]);
  return new Set([...pending, ...conflicts]).size;
}

/** Löscht alle lokalen Nutz- und Sync-Daten (z. B. beim Abmelden, wenn alles gesichert ist). */
export async function clearSyncedData({ keepOwner = false } = {}): Promise<void> {
  const owner = keepOwner ? await db.meta.get('localOwnerUserId') : undefined;
  await db.transaction('rw', [...LOCAL_DATA_TABLES(), db.outbox, db.recordVersions, db.conflicts, db.meta], async () => {
    await Promise.all([
      ...LOCAL_DATA_TABLES().map((t) => t.clear()),
      db.outbox.clear(),
      db.recordVersions.clear(),
      db.conflicts.clear(),
      db.meta.clear(),
    ]);
    if (owner) await db.meta.put(owner);
  });
}
