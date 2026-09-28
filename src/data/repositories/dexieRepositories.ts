import type { DatePeriod } from '../../domain/models';
import { db } from '../db/database';
import type { EntityTable } from 'dexie';
import type {
  CustomHolidayRepository,
  OnboardingRepository,
  PeriodRepository,
  ProfileRepository,
  Repositories,
  ScheduleRepository,
  WorkDayRepository,
} from './types';

const PROFILE_ID = 'me';
const newId = () => crypto.randomUUID();

const profile: ProfileRepository = {
  get: () => db.profile.get(PROFILE_ID),
  save: async (data) => {
    await db.profile.put({ ...data, id: PROFILE_ID });
  },
  update: async (changes) => {
    await db.profile.update(PROFILE_ID, changes);
  },
};

const schedule: ScheduleRepository = {
  getAll: () => db.scheduleVersions.orderBy('validFrom').toArray(),
  saveVersion: async (validFrom, value) => {
    await db.transaction('rw', db.scheduleVersions, async () => {
      const existing = await db.scheduleVersions.where('validFrom').equals(validFrom).first();
      await db.scheduleVersions.put({ id: existing?.id ?? newId(), validFrom, schedule: value });
    });
  },
};

const workDays: WorkDayRepository = {
  getAll: () => db.workDays.toArray(),
  getInRange: (start, end) => db.workDays.where('date').between(start, end, true, true).toArray(),
  save: async (workDay) => {
    await db.transaction('rw', db.workDays, async () => {
      // Ein Datensatz pro Datum: vorhandenen Eintrag des Tages wiederverwenden.
      const existing = await db.workDays.where('date').equals(workDay.date).first();
      await db.workDays.put({ ...workDay, id: workDay.id ?? existing?.id ?? newId() });
    });
  },
  delete: async (id) => {
    await db.workDays.delete(id);
  },
};

function periodRepository(table: EntityTable<DatePeriod, 'id'>): PeriodRepository<DatePeriod> {
  return {
    getAll: () => table.toArray(),
    save: async (period, replaceWorkDayIds = []) => {
      await db.transaction('rw', table, db.workDays, async () => {
        if (replaceWorkDayIds.length) await db.workDays.bulkDelete(replaceWorkDayIds);
        await table.put({ ...period, id: period.id ?? newId() });
      });
    },
    delete: async (id) => {
      await table.delete(id);
    },
  };
}

const customHolidays: CustomHolidayRepository = {
  getAll: () => db.customHolidays.toArray(),
  add: async (date, replaceWorkDayIds = []) => {
    await db.transaction('rw', db.customHolidays, db.workDays, async () => {
      if (replaceWorkDayIds.length) await db.workDays.bulkDelete(replaceWorkDayIds);
      const existing = await db.customHolidays.where('date').equals(date).first();
      if (!existing) await db.customHolidays.add({ id: newId(), date });
    });
  },
  delete: async (id) => {
    await db.customHolidays.delete(id);
  },
};

const onboarding: OnboardingRepository = {
  complete: async (data, value) => {
    await db.transaction('rw', db.profile, db.scheduleVersions, async () => {
      await db.scheduleVersions.clear();
      await db.scheduleVersions.add({ id: newId(), validFrom: data.trackingStartDate, schedule: value });
      await db.profile.put({ ...data, id: PROFILE_ID });
    });
  },
};

export const dexieRepositories: Repositories = {
  profile,
  schedule,
  workDays,
  vacations: periodRepository(db.vacationPeriods),
  sickness: periodRepository(db.sickPeriods),
  customHolidays,
  onboarding,
};
