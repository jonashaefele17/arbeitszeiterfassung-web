import type { ISODate, TimeString, WeekdayKey } from '../../utils/date';

export interface WorkScheduleDay {
  isWorkDay: boolean;
  start: TimeString;
  end: TimeString;
  breakMinutes: number;
  /** Üblicher Pausenbeginn (Vorschlag für neue Einträge); fehlt bei älteren Standardwochen. */
  breakStart?: TimeString;
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
  /**
   * Stichtag der Urlaubs-Startwerte (Onboarding-Datum). Bleibt beim Verschieben des Kontostarts erhalten;
   * fehlt bei alten Profilen = Kontostart.
   */
  initialVacationAsOf?: ISODate;
  /** Im Jahr des Stichtags davor bereits genommene Urlaubstage (fehlt bei alten Profilen = 0). */
  initialVacationTakenDays?: number;
  /** Resturlaub aus dem Vorjahr des Stichtags (fehlt bei alten Profilen = 0). */
  initialVacationCarryoverDays?: number;
}

export interface WorkDay {
  id: string;
  date: ISODate;
  status: 'work';
  start: TimeString;
  end: TimeString;
  breakMinutes: number;
  /** Beginn der Pause (nur bei Pause > 0); fehlt bei älteren Einträgen. */
  breakStart?: TimeString;
  /** Sollzeit zum Zeitpunkt der Erfassung. */
  plannedMinutes: number;
}

export interface DatePeriod {
  id: string;
  startDate: ISODate;
  endDate: ISODate;
}

/** Urlaubszeitraum. `kind: 'overtime'` = freie Tage auf Überstunden (verbraucht keinen Urlaub). */
export interface VacationPeriod extends DatePeriod {
  kind?: 'overtime';
}
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
  | 'overtimeOff' // frei auf Überstunden: Soll, aber kein Ist
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
  /** Vergangener regulärer Arbeitstag (ab Kontostart) ohne Eintrag. */
  isMissing: boolean;
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
  overtimeOffDays: number;
  missingDays: number;
  workDays: number;
}
