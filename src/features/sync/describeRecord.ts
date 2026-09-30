import { actualMinutesOf, formatBreakSpan } from '../../domain/calculations/time';
import type {
  CustomHoliday,
  SickPeriod,
  UserProfile,
  VacationPeriod,
  WorkDay,
  WorkScheduleVersion,
} from '../../domain/models';
import type { SyncTableName } from '../../data/db/database';
import {
  WEEKDAY_KEYS,
  WEEKDAY_SHORT,
  formatDayMonth,
  formatDayMonthShort,
  formatShortDate,
  formatWeekday,
} from '../../utils/date';
import { formatBalanceInput, formatDayCount, formatDuration } from '../../utils/format';

/** Überschrift eines Konflikts – aus dem vorhandenen Stand (lokal oder anderes Gerät). */
export function conflictTitle(table: SyncTableName, record: object | undefined): string {
  if (!record) return 'Eintrag';
  switch (table) {
    case 'workDays': {
      const w = record as WorkDay;
      return `${formatWeekday(w.date)}, ${formatDayMonth(w.date)}`;
    }
    case 'vacationPeriods':
      return (record as VacationPeriod).kind === 'overtime' ? 'Überstunden frei' : 'Urlaub';
    case 'sickPeriods':
      return 'Krankheit';
    case 'customHolidays': {
      const h = record as CustomHoliday;
      return `Feiertag am ${formatShortDate(h.date)}`;
    }
    case 'profile':
      return 'Profil und Einstellungen';
    case 'scheduleVersions':
      return `Standardarbeitswoche ab ${formatShortDate((record as WorkScheduleVersion).validFrom)}`;
  }
}

/** Inhalt eines Stands als kurze Zeilen; `undefined` = gelöscht. */
export function describeRecord(table: SyncTableName, record: object | undefined): string[] {
  if (!record) return ['Gelöscht'];
  switch (table) {
    case 'workDays': {
      const w = record as WorkDay;
      return [`Arbeit · ${w.start}–${w.end}`, `Pause ${formatBreakSpan(w)} · ${formatDuration(actualMinutesOf(w))}`];
    }
    case 'vacationPeriods':
    case 'sickPeriods': {
      const p = record as VacationPeriod | SickPeriod;
      return [`${formatDayMonthShort(p.startDate)}–${formatShortDate(p.endDate)}`];
    }
    case 'customHolidays':
      return ['Manueller Feiertag'];
    case 'profile': {
      const p = record as UserProfile;
      return [
        `${p.firstName} ${p.lastName}`,
        `${formatDayCount(p.vacationDaysPerYear)} Urlaub · Resturlaub ${formatDayCount(p.initialVacationCarryoverDays ?? 0)}`,
        `Kontostart ${formatShortDate(p.trackingStartDate)} · Startsaldo ${formatBalanceInput(p.initialBalanceMinutes)}`,
      ];
    }
    case 'scheduleVersions': {
      const v = record as WorkScheduleVersion;
      return WEEKDAY_KEYS.map((k) => {
        const d = v.schedule[k];
        return `${WEEKDAY_SHORT[k]} ${d.isWorkDay ? `${d.start}–${d.end}` : 'frei'}`;
      });
    }
  }
}
