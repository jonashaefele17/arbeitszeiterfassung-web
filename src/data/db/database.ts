import Dexie, { type EntityTable } from 'dexie';
import type {
  CustomHoliday,
  SickPeriod,
  UserProfile,
  VacationPeriod,
  WorkDay,
  WorkScheduleVersion,
} from '../../domain/models';
import { publicHolidayName } from '../../domain/holidays/bavaria';
import { regularPlannedMinutes, sortVersions } from '../../domain/services/scheduleService';

/**
 * Lokale Datenbank. Ausschließlich innerhalb von `src/data` verwenden –
 * alle anderen Schichten greifen über Repositories zu.
 */
export class AppDatabase extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>;
  scheduleVersions!: EntityTable<WorkScheduleVersion, 'id'>;
  workDays!: EntityTable<WorkDay, 'id'>;
  vacationPeriods!: EntityTable<VacationPeriod, 'id'>;
  sickPeriods!: EntityTable<SickPeriod, 'id'>;
  customHolidays!: EntityTable<CustomHoliday, 'id'>;

  constructor() {
    super('arbeitszeit');
    this.version(1).stores({
      profile: 'id',
      scheduleVersions: 'id, validFrom',
      workDays: 'id, &date',
      vacationPeriods: 'id, startDate, endDate',
      sickPeriods: 'id, startDate, endDate',
      customHolidays: 'id, &date',
    });

    // V1.1: Arbeit an Feiertagen läuft gegen die reguläre Sollzeit (vorher 0).
    this.version(2).stores({}).upgrade(async (tx) => {
      const versions = sortVersions(await tx.table<WorkScheduleVersion>('scheduleVersions').toArray());
      const customDates = new Set(
        (await tx.table<CustomHoliday>('customHolidays').toArray()).map((h) => h.date),
      );
      await tx
        .table<WorkDay>('workDays')
        .filter((w) => w.plannedMinutes === 0 && (customDates.has(w.date) || !!publicHolidayName(w.date)))
        .modify((w) => {
          w.plannedMinutes = regularPlannedMinutes(w.date, versions);
        });
    });
  }
}

export const db = new AppDatabase();
