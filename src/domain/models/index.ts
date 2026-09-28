import type { ISODate, TimeString, WeekdayKey } from '../../utils/date';

export interface WorkScheduleDay {
  isWorkDay: boolean;
  start: TimeString;
  end: TimeString;
  breakMinutes: number;
}

/** Standardarbeitswoche. Samstag und Sonntag werden nicht unterstützt. */
export type WorkSchedule = Record<WeekdayKey, WorkScheduleDay>;

/**
 * Eine Version der Standardarbeitswoche, gültig ab `validFrom` bis zur nächsten Version.
 * Dadurch verändern spätere Änderungen die Sollzeiten der Vergangenheit nicht.
 */
export interface WorkScheduleVersion {
  id: string;
  validFrom: ISODate;
  schedule: WorkSchedule;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  vacationDaysPerYear: number;
  /** Ab diesem Tag zählen leere Arbeitstage als Sollzeit. */
  trackingStartDate: ISODate;
  /** Überstundenstand beim Start der App-Nutzung. */
  initialBalanceMinutes: number;
}

export interface WorkDay {
  id: string;
  date: ISODate;
  status: 'work';
  start: TimeString;
  end: TimeString;
  breakMinutes: number;
  /** Sollzeit zum Zeitpunkt der Erfassung. */
  plannedMinutes: number;
}

export interface DatePeriod {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
}

export type VacationPeriod = DatePeriod;
export type SickPeriod = DatePeriod;

export interface CustomHoliday {
  id: string;
  date: ISODate;
}

export type DayStatus =
  | 'work' // expliziter WorkDay
  | 'holiday' // gesetzlicher oder manueller Feiertag
  | 'sick'
  | 'vacation'
  | 'empty' // regulärer Arbeitstag ohne Eintrag
  | 'off'; // kein regulärer Arbeitstag, kein Eintrag

export interface ResolvedDay {
  date: ISODate;
  status: DayStatus;
  plannedMinutes: number;
  actualMinutes: number;
  differenceMinutes: number;
  /** Sollzeit laut Standardwoche an diesem Tag (unabhängig vom Status). */
  regularPlannedMinutes: number;
  isRegularWorkDay: boolean;
  workDay?: WorkDay;
  holiday?: { name: string; source: 'public' | 'custom'; customId?: string };
  vacationPeriod?: VacationPeriod;
  sickPeriod?: SickPeriod;
}

export interface MonthlySummary {
  plannedMinutes: number;
  actualMinutes: number;
  balanceMinutes: number;
  vacationDays: number;
  sickDays: number;
  holidayDays: number;
  workDays: number;
}
