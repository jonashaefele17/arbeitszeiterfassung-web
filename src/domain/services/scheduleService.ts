import type { WorkScheduleDay, WorkScheduleVersion } from '../models';
import { weekdayKeyOf, type ISODate } from '../../utils/date';
import { plannedMinutesOf } from '../calculations/time';

/**
 * Liefert die zum Datum gültige Version der Standardwoche.
 * Vor der ersten Version gilt die erste Version (z. B. beim Nachtragen vergangener Tage).
 * Erwartet `versions` aufsteigend nach `validFrom` sortiert.
 */
export function scheduleVersionFor(
  date: ISODate,
  versions: readonly WorkScheduleVersion[],
): WorkScheduleVersion | undefined {
  let result = versions[0];
  for (const v of versions) {
    if (v.validFrom <= date) result = v;
    else break;
  }
  return result;
}

export function scheduleDayFor(
  date: ISODate,
  versions: readonly WorkScheduleVersion[],
): WorkScheduleDay | undefined {
  const key = weekdayKeyOf(date);
  if (!key) return undefined;
  return scheduleVersionFor(date, versions)?.schedule[key];
}

/** Reguläre Sollzeit laut Standardwoche. Nicht-Arbeitstage und Wochenenden → 0. */
export function regularPlannedMinutes(date: ISODate, versions: readonly WorkScheduleVersion[]): number {
  const day = scheduleDayFor(date, versions);
  return day?.isWorkDay ? plannedMinutesOf(day) : 0;
}

export function isRegularWorkDay(date: ISODate, versions: readonly WorkScheduleVersion[]): boolean {
  return scheduleDayFor(date, versions)?.isWorkDay ?? false;
}

export function sortVersions(versions: readonly WorkScheduleVersion[]): WorkScheduleVersion[] {
  return [...versions].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}
