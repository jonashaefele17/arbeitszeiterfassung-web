import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/database';
import { dexieRepositories as repos } from '../repositories/dexieRepositories';
import type { RemoteApi, RemoteWriteResult } from './remote';
import { bootstrap, bootstrapUseAccountData, clearSyncedData, pull, push, unsyncedCount, type SyncContext } from './syncEngine';
import { SYNC_TABLE_BY_NAME, type RemoteRow, type SyncTableSpec } from './tables';

const USER = 'user-1';

/** In-Memory-Nachbau der Serverlogik: Versionen, Revisionen, Löschmarker, Eindeutigkeit. */
class FakeRemote implements RemoteApi {
  tables = new Map<string, Map<string, RemoteRow>>();
  private revision = 0;
  offline = false;

  private table(name: string) {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  private guard() {
    if (this.offline) throw new Error('Failed to fetch');
  }

  private uniqueTaken(spec: SyncTableSpec, data: RemoteRow, exceptId?: string) {
    if (!spec.uniqueField) return undefined;
    const f = spec.uniqueField.remote;
    return [...this.table(spec.remote).values()].find((r) => !r.deleted && r.id !== exceptId && r[f] === data[f]);
  }

  /** Schreibt wie ein anderes Gerät direkt „am Server“. */
  write(remoteTable: string, id: string, data: RemoteRow): RemoteRow {
    const t = this.table(remoteTable);
    const prev = t.get(id);
    const row = { ...prev, ...data, id, deleted: data.deleted ?? false, version: (Number(prev?.version) || 0) + 1, revision: ++this.revision };
    t.set(id, row);
    return row;
  }

  async insert(spec: SyncTableSpec, id: string, data: RemoteRow): Promise<RemoteWriteResult> {
    this.guard();
    const t = this.table(spec.remote);
    if (t.has(id)) return { ok: false, row: t.get(id)! };
    const taken = this.uniqueTaken(spec, data);
    if (taken) return { ok: false, row: taken };
    return { ok: true, row: this.write(spec.remote, id, data) };
  }

  async update(spec: SyncTableSpec, id: string, base: number, data: RemoteRow): Promise<RemoteWriteResult> {
    this.guard();
    const current = this.table(spec.remote).get(id);
    if (!current || current.version !== base) return { ok: false, row: current ?? null };
    if (!data.deleted && this.uniqueTaken(spec, data, id)) return { ok: false, row: current };
    return { ok: true, row: this.write(spec.remote, id, data) };
  }

  async fetchChanges(spec: SyncTableSpec, since: number, limit: number): Promise<RemoteRow[]> {
    this.guard();
    return [...this.table(spec.remote).values()]
      .filter((r) => Number(r.revision) > since)
      .sort((a, b) => Number(a.revision) - Number(b.revision))
      .slice(0, limit);
  }

  async hasAccountData(): Promise<boolean> {
    this.guard();
    return [...this.table('profiles').values()].some((r) => !r.deleted);
  }

  row(remoteTable: string, id: string) {
    return this.table(remoteTable).get(id);
  }
}

const workDay = (date: string, end = '14:00') => ({
  date,
  status: 'work' as const,
  start: '08:00',
  end,
  breakMinutes: 30,
  plannedMinutes: 330,
});

let remote: FakeRemote;
let ctx: SyncContext;

beforeEach(async () => {
  await clearSyncedData();
  remote = new FakeRemote();
  ctx = { userId: USER, remote };
});

describe('Outbox', () => {
  it('merkt jede lokale Änderung zum Hochladen vor (pro Datensatz zusammengefasst)', async () => {
    await repos.workDays.save(workDay('2026-09-28'));
    await repos.workDays.save(workDay('2026-09-28', '15:00')); // gleicher Tag → gleicher Datensatz
    expect(await db.outbox.count()).toBe(1);
    expect(await unsyncedCount()).toBe(1);
  });
});

describe('Push', () => {
  it('lädt neue, geänderte und gelöschte Datensätze hoch', async () => {
    await repos.workDays.save(workDay('2026-09-28'));
    const id = (await db.workDays.toArray())[0]!.id;

    expect(await push(ctx)).toEqual({ pushed: 1, conflicts: 0 });
    expect(remote.row('work_days', id)).toMatchObject({ date: '2026-09-28', end_time: '14:00', version: 1 });
    expect(await unsyncedCount()).toBe(0);

    await repos.workDays.save({ ...workDay('2026-09-28', '15:00'), id });
    await push(ctx);
    expect(remote.row('work_days', id)).toMatchObject({ end_time: '15:00', version: 2 });

    await repos.workDays.delete(id);
    await push(ctx);
    expect(remote.row('work_days', id)).toMatchObject({ deleted: true, version: 3 });
    expect(await db.recordVersions.count()).toBe(0);
  });

  it('lädt das Profil unter der Konto-ID hoch', async () => {
    await repos.onboarding.complete(
      { firstName: 'A', lastName: 'B', vacationDaysPerYear: 30, trackingStartDate: '2026-09-01', initialBalanceMinutes: 0 },
      { monday: { isWorkDay: true, start: '08:00', end: '14:00', breakMinutes: 30 } } as never,
    );
    await push(ctx);
    expect(remote.row('profiles', USER)).toMatchObject({ first_name: 'A', vacation_days_per_year: 30 });
  });

  it('bleibt offline unverändert in der Outbox', async () => {
    await repos.workDays.save(workDay('2026-09-28'));
    remote.offline = true;
    await expect(push(ctx)).rejects.toThrow();
    expect(await db.outbox.count()).toBe(1);
    remote.offline = false;
    await push(ctx);
    expect(await db.outbox.count()).toBe(0);
  });

  it('erkennt einen erneuten Upload mit identischem Inhalt als Erfolg', async () => {
    await repos.workDays.save(workDay('2026-09-28'));
    const id = (await db.workDays.toArray())[0]!.id;
    remote.write('work_days', id, { date: '2026-09-28', status: 'work', start_time: '08:00', end_time: '14:00', break_minutes: 30, planned_minutes: 330 });
    expect(await push(ctx)).toEqual({ pushed: 1, conflicts: 0 });
  });
});

describe('Pull', () => {
  it('spielt Änderungen anderer Geräte ein, auch Löschungen', async () => {
    remote.write('work_days', 'w1', { date: '2026-09-29', status: 'work', start_time: '09:00', end_time: '13:00', break_minutes: 0, planned_minutes: 330 });
    expect(await pull(ctx)).toBe(1);
    expect(await db.workDays.get('w1')).toMatchObject({ start: '09:00', end: '13:00' });

    remote.write('work_days', 'w1', { deleted: true });
    await pull(ctx);
    expect(await db.workDays.get('w1')).toBeUndefined();
  });

  it('holt nur Änderungen seit dem letzten Abgleich', async () => {
    remote.write('sick_periods', 's1', { start_date: '2026-09-01', end_date: '2026-09-02' });
    expect(await pull(ctx)).toBe(1);
    expect(await pull(ctx)).toBe(0);
  });

  it('überschreibt keine lokal ausstehende Änderung', async () => {
    await repos.workDays.save(workDay('2026-09-28'));
    await push(ctx);
    const id = (await db.workDays.toArray())[0]!.id;
    await repos.workDays.save({ ...workDay('2026-09-28', '16:00'), id }); // lokal ausstehend
    remote.write('work_days', id, { end_time: '12:00' }); // anderes Gerät
    await pull(ctx);
    expect((await db.workDays.get(id))!.end).toBe('16:00');
  });
});

describe('Konflikte', () => {
  it('hält gleichzeitige Änderungen am selben Datensatz fest und überschreibt nichts', async () => {
    await repos.workDays.save(workDay('2026-09-28'));
    await push(ctx);
    const id = (await db.workDays.toArray())[0]!.id;

    remote.write('work_days', id, { end_time: '15:00' }); // anderes Gerät: v2
    await repos.workDays.save({ ...workDay('2026-09-28', '16:00'), id }); // dieses Gerät, Basis v1

    expect(await push(ctx)).toEqual({ pushed: 0, conflicts: 1 });
    expect(remote.row('work_days', id)!.end_time).toBe('15:00');
    expect((await db.workDays.get(id))!.end).toBe('16:00');
    expect((await db.conflicts.toArray())[0]!.remote).toMatchObject({ end_time: '15:00' });

    await pull(ctx);
    expect((await db.workDays.get(id))!.end).toBe('16:00'); // weiterhin lokal, bis entschieden
    expect(await unsyncedCount()).toBe(1); // ein Eintrag (ausstehend und im Konflikt)
  });

  it('erkennt denselben Arbeitstag, offline auf zwei Geräten angelegt', async () => {
    remote.write('work_days', 'other-device', { date: '2026-09-28', status: 'work', start_time: '07:00', end_time: '12:00', break_minutes: 0, planned_minutes: 330 });
    await repos.workDays.save(workDay('2026-09-28'));
    expect(await push(ctx)).toEqual({ pushed: 0, conflicts: 1 });
    expect((await db.conflicts.toArray())[0]!.remote).toMatchObject({ id: 'other-device' });
  });
});

describe('Erster Abgleich', () => {
  it('Gerätedaten ins leere Konto hochladen', async () => {
    await repos.workDays.save(workDay('2026-09-28'));
    await db.outbox.clear(); // wie V1.1-Daten: nie vorgemerkt
    expect(await bootstrap(ctx)).toBe('ready');
    await push(ctx);
    expect(remote.tables.get('work_days')!.size).toBe(1);
  });

  it('Kontodaten auf leeres Gerät laden', async () => {
    remote.write('profiles', USER, { first_name: 'A', last_name: 'B', vacation_days_per_year: 28, tracking_start_date: '2026-09-01', initial_balance_minutes: 0 });
    expect(await bootstrap(ctx)).toBe('ready');
    expect(await repos.profile.get()).toMatchObject({ firstName: 'A', vacationDaysPerYear: 28 });
  });

  it('fragt nach, wenn Gerät und Konto Daten haben; „Kontodaten verwenden“ ersetzt die Gerätedaten', async () => {
    remote.write('profiles', USER, { first_name: 'Konto', last_name: 'B', vacation_days_per_year: 30, tracking_start_date: '2026-09-01', initial_balance_minutes: 0 });
    await repos.profile.save({ firstName: 'Gerät', lastName: 'B', vacationDaysPerYear: 30, trackingStartDate: '2026-09-01', initialBalanceMinutes: 0 });
    expect(await bootstrap(ctx)).toBe('needs-decision');
    await bootstrapUseAccountData(ctx);
    expect((await repos.profile.get())!.firstName).toBe('Konto');
    expect(await db.outbox.count()).toBe(0);
    expect(await bootstrap(ctx)).toBe('ready');
  });
});

it('Spezifikation: Umwandlung ist verlustfrei (lokal → Server → lokal)', () => {
  const spec = SYNC_TABLE_BY_NAME.vacationPeriods;
  const local = { id: 'v', startDate: '2026-09-01', endDate: '2026-09-05', kind: 'overtime' as const };
  expect(spec.fromRemote({ id: 'v', ...spec.toRemote(local) })).toEqual(local);
  const plain = { id: 'p', startDate: '2026-09-01', endDate: '2026-09-05' };
  expect(spec.fromRemote({ id: 'p', ...spec.toRemote(plain) })).toEqual(plain);
});
