import type { DatePeriod } from '../../domain/models';
import { db, type SyncTableName } from '../db/database';
import type { EntityTable, Table } from 'dexie';
import { enqueue, notifyLocalChange } from '../sync/outbox';
import { LOCAL_PROFILE_ID } from '../sync/tables';
import type {
  CustomHolidayRepository,
  OnboardingRepository,
  PeriodRepository,
  ProfileRepository,
  Repositories,
  ScheduleRepository,
  WorkDayRepository,
} from './types';

const newId = () => crypto.randomUUID();

/**
 * Jede Schreiboperation merkt die betroffenen Datensätze in derselben Transaktion
 * in der Outbox vor (Sync) und meldet danach die Änderung.
 */
async function write(tables: Table[], work: () => Promise<void>): Promise<void> {
  await db.transaction('rw', [...tables, db.outbox], work);
  notifyLocalChange();
}

const profile: ProfileRepository = {
  get: () => db.profile.get(LOCAL_PROFILE_ID),
  save: (data) =>
    write([db.profile], async () => {
      await db.profile.put({ ...data, id: LOCAL_PROFILE_ID });
      await enqueue('profile', LOCAL_PROFILE_ID);
    }),
  update: (changes) =>
    write([db.profile], async () => {
      await db.profile.update(LOCAL_PROFILE_ID, changes);
      await enqueue('profile', LOCAL_PROFILE_ID);
    }),
};

const schedule: ScheduleRepository = {
  getAll: () => db.scheduleVersions.orderBy('validFrom').toArray(),
  saveVersion: (validFrom, value) =>
    write([db.scheduleVersions], async () => {
      const existing = await db.scheduleVersions.where('validFrom').equals(validFrom).first();
      const id = existing?.id ?? newId();
      await db.scheduleVersions.put({ id, validFrom, schedule: value });
      await enqueue('scheduleVersions', id);
    }),
};

const workDays: WorkDayRepository = {
  getAll: () => db.workDays.toArray(),
  getInRange: (start, end) => db.workDays.where('date').between(start, end, true, true).toArray(),
  save: (workDay) =>
    write([db.workDays], async () => {
      // Ein Datensatz pro Datum: vorhandenen Eintrag des Tages wiederverwenden.
      const existing = await db.workDays.where('date').equals(workDay.date).first();
      const id = workDay.id ?? existing?.id ?? newId();
      await db.workDays.put({ ...workDay, id });
      await enqueue('workDays', id);
    }),
  delete: (id) =>
    write([db.workDays], async () => {
      await db.workDays.delete(id);
      await enqueue('workDays', id);
    }),
};

function periodRepository(
  table: EntityTable<DatePeriod, 'id'>,
  syncTable: SyncTableName,
): PeriodRepository<DatePeriod> {
  return {
    getAll: () => table.toArray(),
    save: (period, replaceWorkDayIds = []) =>
      write([table, db.workDays], async () => {
        if (replaceWorkDayIds.length) {
          await db.workDays.bulkDelete(replaceWorkDayIds);
          await enqueue('workDays', ...replaceWorkDayIds);
        }
        const id = period.id ?? newId();
        await table.put({ ...period, id });
        await enqueue(syncTable, id);
      }),
    delete: (id) =>
      write([table], async () => {
        await table.delete(id);
        await enqueue(syncTable, id);
      }),
  };
}

const customHolidays: CustomHolidayRepository = {
  getAll: () => db.customHolidays.toArray(),
  add: (date, replaceWorkDayIds = []) =>
    write([db.customHolidays, db.workDays], async () => {
      if (replaceWorkDayIds.length) {
        await db.workDays.bulkDelete(replaceWorkDayIds);
        await enqueue('workDays', ...replaceWorkDayIds);
      }
      const existing = await db.customHolidays.where('date').equals(date).first();
      if (!existing) {
        const id = newId();
        await db.customHolidays.add({ id, date });
        await enqueue('customHolidays', id);
      }
    }),
  delete: (id) =>
    write([db.customHolidays], async () => {
      await db.customHolidays.delete(id);
      await enqueue('customHolidays', id);
    }),
};

const onboarding: OnboardingRepository = {
  complete: (data, value) =>
    write([db.profile, db.scheduleVersions], async () => {
      // Evtl. vorhandene (auch schon synchronisierte) Versionen werden ersetzt – Löschung mitsynchronisieren.
      const previous = (await db.scheduleVersions.toCollection().primaryKeys()) as string[];
      await db.scheduleVersions.clear();
      await enqueue('scheduleVersions', ...previous);
      const id = newId();
      await db.scheduleVersions.add({ id, validFrom: data.trackingStartDate, schedule: value });
      await db.profile.put({ ...data, id: LOCAL_PROFILE_ID });
      await enqueue('scheduleVersions', id);
      await enqueue('profile', LOCAL_PROFILE_ID);
    }),
};

export const dexieRepositories: Repositories = {
  profile,
  schedule,
  workDays,
  vacations: periodRepository(db.vacationPeriods, 'vacationPeriods'),
  sickness: periodRepository(db.sickPeriods, 'sickPeriods'),
  customHolidays,
  onboarding,
};
