import type {
  CustomHoliday,
  SickPeriod,
  UserProfile,
  VacationPeriod,
  WorkDay,
  WorkScheduleVersion,
} from '../models';
import type { ISODate } from '../../utils/date';
import { sortVersions } from '../services/scheduleService';

/** Alle Rohdaten, die zur Berechnung benötigt werden. Unabhängig von React und Datenhaltung. */
export interface CalculationContext {
  today: ISODate;
  trackingStartDate: ISODate;
  initialBalanceMinutes: number;
  /** Stichtag der Urlaubs-Startwerte (Onboarding-Datum); unabhängig vom späteren Kontostart. */
  initialVacationAsOf: ISODate;
  initialVacationTakenDays: number;
  initialVacationCarryoverDays: number;
  scheduleVersions: WorkScheduleVersion[];
  workDays: Map<ISODate, WorkDay>;
  vacationPeriods: VacationPeriod[];
  sickPeriods: SickPeriod[];
  customHolidays: Map<ISODate, CustomHoliday>;
}

export interface RawData {
  profile: Pick<
    UserProfile,
    | 'trackingStartDate'
    | 'initialBalanceMinutes'
    | 'initialVacationAsOf'
    | 'initialVacationTakenDays'
    | 'initialVacationCarryoverDays'
  >;
  scheduleVersions: WorkScheduleVersion[];
  workDays: WorkDay[];
  vacationPeriods: VacationPeriod[];
  sickPeriods: SickPeriod[];
  customHolidays: CustomHoliday[];
}

export function buildContext(raw: RawData, today: ISODate): CalculationContext {
  return {
    today,
    trackingStartDate: raw.profile.trackingStartDate,
    initialBalanceMinutes: raw.profile.initialBalanceMinutes,
    initialVacationAsOf: raw.profile.initialVacationAsOf ?? raw.profile.trackingStartDate,
    initialVacationTakenDays: raw.profile.initialVacationTakenDays ?? 0,
    initialVacationCarryoverDays: raw.profile.initialVacationCarryoverDays ?? 0,
    scheduleVersions: sortVersions(raw.scheduleVersions),
    workDays: new Map(raw.workDays.map((w) => [w.date, w])),
    vacationPeriods: raw.vacationPeriods,
    sickPeriods: raw.sickPeriods,
    customHolidays: new Map(raw.customHolidays.map((h) => [h.date, h])),
  };
}
