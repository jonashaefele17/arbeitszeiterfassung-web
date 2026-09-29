import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteRow, SyncTableSpec } from './tables';

export type RemoteWriteResult =
  | { ok: true; row: RemoteRow }
  /** Serverstand weicht ab (andere Version, schon vorhanden) – `row` = aktueller Serverstand oder `null`. */
  | { ok: false; row: RemoteRow | null };

/**
 * Serverzugriff für den Sync. Netzwerk- und Serverfehler werden als Exception geworfen,
 * Konflikte als Ergebnis zurückgegeben.
 */
export interface RemoteApi {
  /** Neuer Datensatz. Konflikt, wenn ID oder fachlich eindeutiges Feld schon existiert. */
  insert(spec: SyncTableSpec, id: string, data: RemoteRow): Promise<RemoteWriteResult>;
  /** Änderung nur, wenn der Server noch `baseVersion` hat. */
  update(spec: SyncTableSpec, id: string, baseVersion: number, data: RemoteRow): Promise<RemoteWriteResult>;
  /** Änderungen mit `revision > sinceRevision`, aufsteigend sortiert. */
  fetchChanges(spec: SyncTableSpec, sinceRevision: number, limit: number): Promise<RemoteRow[]>;
  /** Hat das Konto am Server bereits Daten (Profil vorhanden)? */
  hasAccountData(): Promise<boolean>;
}

const UNIQUE_VIOLATION = '23505';

function fail(error: { message: string }): never {
  throw new Error(error.message);
}

export function createSupabaseRemote(client: SupabaseClient): RemoteApi {
  async function fetchById(spec: SyncTableSpec, id: string): Promise<RemoteRow | null> {
    const { data, error } = await client.from(spec.remote).select('*').eq('id', id).maybeSingle();
    if (error) fail(error);
    return data;
  }

  return {
    async insert(spec, id, data) {
      const { data: row, error } = await client.from(spec.remote).insert({ ...data, id }).select().single();
      if (!error) return { ok: true, row };
      if (error.code !== UNIQUE_VIOLATION) fail(error);
      // Schon vorhanden: gleiche ID oder gleiches eindeutiges Feld (z. B. Arbeitstag am selben Datum)
      const byId = await fetchById(spec, id);
      if (byId) return { ok: false, row: byId };
      if (spec.uniqueField) {
        const value = data[spec.uniqueField.remote];
        const { data: byUnique, error: e2 } = await client
          .from(spec.remote)
          .select('*')
          .eq(spec.uniqueField.remote, value as string)
          .eq('deleted', false)
          .maybeSingle();
        if (e2) fail(e2);
        return { ok: false, row: byUnique };
      }
      return { ok: false, row: null };
    },

    async update(spec, id, baseVersion, data) {
      const { data: rows, error } = await client
        .from(spec.remote)
        .update(data)
        .eq('id', id)
        .eq('version', baseVersion)
        .select();
      if (error) {
        if (error.code === UNIQUE_VIOLATION) return { ok: false, row: await fetchById(spec, id) };
        fail(error);
      }
      if (rows.length === 1) return { ok: true, row: rows[0] };
      return { ok: false, row: await fetchById(spec, id) };
    },

    async fetchChanges(spec, sinceRevision, limit) {
      const { data, error } = await client
        .from(spec.remote)
        .select('*')
        .gt('revision', sinceRevision)
        .order('revision', { ascending: true })
        .limit(limit);
      if (error) fail(error);
      return data;
    },

    async hasAccountData() {
      const { count, error } = await client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('deleted', false);
      if (error) fail(error);
      return (count ?? 0) > 0;
    },
  };
}
