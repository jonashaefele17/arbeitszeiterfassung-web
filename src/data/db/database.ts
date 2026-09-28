import Dexie, { type EntityTable } from 'dexie';
import type {
  CustomHoliday,
  SickPeriod,
  UserProfile,
  VacationPeriod,
  WorkDay,
  WorkScheduleVersion,
} from '../../domain/models';

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
  }
}

export const db = new AppDatabase();
