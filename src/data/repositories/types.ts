import type {
  CustomHoliday,
  DatePeriod,
  SickPeriod,
  UserProfile,
  VacationPeriod,
  WorkDay,
  WorkSchedule,
  WorkScheduleVersion,
} from '../../domain/models';
import type { ISODate } from '../../utils/date';

/**
 * Fachliche Repository-Schnittstellen. Die UI kennt nur diese Interfaces –
 * nicht Dexie, IndexedDB oder später eine REST-API.
 */

export interface ProfileRepository {
  get(): Promise<UserProfile | undefined>;
  save(profile: Omit<UserProfile, 'id'>): Promise<void>;
  update(changes: Partial<Omit<UserProfile, 'id'>>): Promise<void>;
}

export interface ScheduleRepository {
  getAll(): Promise<WorkScheduleVersion[]>;
  /** Legt eine neue Version ab `validFrom` an bzw. ersetzt eine Version mit gleichem Datum. */
  saveVersion(validFrom: ISODate, schedule: WorkSchedule): Promise<void>;
}

export interface WorkDayRepository {
  getAll(): Promise<WorkDay[]>;
  getInRange(start: ISODate, end: ISODate): Promise<WorkDay[]>;
  save(workDay: Omit<WorkDay, 'id'> & { id?: string }): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface PeriodRepository<T extends DatePeriod> {
  getAll(): Promise<T[]>;
  /**
   * Speichert einen Zeitraum. `replaceWorkDayIds` werden in derselben Transaktion gelöscht
   * (nur nach ausdrücklicher Bestätigung durch den Benutzer).
   */
  save(period: Omit<T, 'id'> & { id?: string }, replaceWorkDayIds?: string[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface CustomHolidayRepository {
  getAll(): Promise<CustomHoliday[]>;
  add(date: ISODate, replaceWorkDayIds?: string[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface OnboardingRepository {
  /** Speichert Profil und erste Standardwoche atomar. */
  complete(profile: Omit<UserProfile, 'id'>, schedule: WorkSchedule): Promise<void>;
}

export interface Repositories {
  profile: ProfileRepository;
  schedule: ScheduleRepository;
  workDays: WorkDayRepository;
  vacations: PeriodRepository<VacationPeriod>;
  sickness: PeriodRepository<SickPeriod>;
  customHolidays: CustomHolidayRepository;
  onboarding: OnboardingRepository;
}
