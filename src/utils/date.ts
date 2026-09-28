import {
  addDays as dfAddDays,
  addMonths as dfAddMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  getISODay,
  getISOWeek,
  lastDayOfMonth,
  startOfISOWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';

/** Lokales Kalenderdatum im Format `YYYY-MM-DD`. Wird überall als Datums-Schlüssel verwendet. */
export type ISODate = string;

/** Uhrzeit im Format `HH:mm`. */
export type TimeString = string;

/** Kalendermonat, `month` ist 1-basiert (1 = Januar). */
export interface YearMonth {
  year: number;
  month: number;
}

export const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
};

export const WEEKDAY_SHORT: Record<WeekdayKey, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr',
};

export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd');
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDays(date: ISODate, amount: number): ISODate {
  return toISODate(dfAddDays(parseISODate(date), amount));
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(parseISODate(to), parseISODate(from));
}

/** Montag–Freitag → Schlüssel, Samstag/Sonntag → `null`. */
export function weekdayKeyOf(date: ISODate): WeekdayKey | null {
  const isoDay = getISODay(parseISODate(date)); // 1 = Montag … 7 = Sonntag
  return isoDay <= 5 ? WEEKDAY_KEYS[isoDay - 1]! : null;
}

export function isWeekend(date: ISODate): boolean {
  return weekdayKeyOf(date) === null;
}

/** Montag der Woche, in der `date` liegt. */
export function startOfWeek(date: ISODate): ISODate {
  return toISODate(startOfISOWeek(parseISODate(date)));
}

export function shiftWeek(weekStart: ISODate, amount: number): ISODate {
  return toISODate(addWeeks(parseISODate(weekStart), amount));
}

/** Die fünf Tage Montag–Freitag ab einem Wochenstart. */
export function workWeekDays(weekStart: ISODate): ISODate[] {
  return WEEKDAY_KEYS.map((_, i) => addDays(weekStart, i));
}

export function isoWeekNumber(date: ISODate): number {
  return getISOWeek(parseISODate(date));
}

/** Alle Tage (inkl. Wochenende) von `start` bis `end`, jeweils inklusive. */
export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const result: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) result.push(d);
  return result;
}

/** Alle Montag–Freitag-Tage zwischen `start` und `end` (inklusive). */
export function eachWorkWeekDay(start: ISODate, end: ISODate): ISODate[] {
  return eachDay(start, end).filter((d) => !isWeekend(d));
}

export function yearMonthOf(date: ISODate): YearMonth {
  const [y, m] = date.split('-').map(Number) as [number, number];
  return { year: y, month: m };
}

export function firstOfMonth({ year, month }: YearMonth): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function lastOfMonth(ym: YearMonth): ISODate {
  return toISODate(lastDayOfMonth(parseISODate(firstOfMonth(ym))));
}

export function shiftMonth(ym: YearMonth, amount: number): YearMonth {
  return yearMonthOf(toISODate(dfAddMonths(parseISODate(firstOfMonth(ym)), amount)));
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

export function sameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return compareYearMonth(a, b) === 0;
}

// ---------- Anzeige ----------

/** „Montag“ */
export function formatWeekday(date: ISODate): string {
  return format(parseISODate(date), 'EEEE', { locale: de });
}

/** „28. September“ */
export function formatDayMonth(date: ISODate): string {
  return format(parseISODate(date), 'd. MMMM', { locale: de });
}

/** „28.09.2026“ */
export function formatShortDate(date: ISODate): string {
  return format(parseISODate(date), 'dd.MM.yyyy');
}

/** „28.09.“ */
export function formatDayMonthShort(date: ISODate): string {
  return format(parseISODate(date), 'dd.MM.');
}

/** „Mo, 28.09.“ */
export function formatWeekdayShortDate(date: ISODate): string {
  return format(parseISODate(date), 'EEEEEE, dd.MM.', { locale: de });
}

/** „September 2026“ */
export function formatMonthYear(ym: YearMonth): string {
  return format(parseISODate(firstOfMonth(ym)), 'MMMM yyyy', { locale: de });
}

/** „September“ */
export function formatMonth(ym: YearMonth): string {
  return format(parseISODate(firstOfMonth(ym)), 'MMMM', { locale: de });
}

export function dayOfMonth(date: ISODate): number {
  return Number(date.slice(8, 10));
}

/**
 * Kalenderraster eines Monats: eine Zeile pro Woche, je fünf Zellen (Mo–Fr).
 * Tage außerhalb des Monats sind `null` (oder mit `includeAdjacent` die Tage der Nachbarmonate).
 * Wochen ohne Werktage im Monat entfallen.
 */
export function monthWorkWeekGrid(ym: YearMonth, includeAdjacent = false): (ISODate | null)[][] {
  const first = firstOfMonth(ym);
  const last = lastOfMonth(ym);
  const weeks: (ISODate | null)[][] = [];
  for (let weekStart = startOfWeek(first); weekStart <= last; weekStart = shiftWeek(weekStart, 1)) {
    const days = workWeekDays(weekStart);
    if (!days.some((d) => d >= first && d <= last)) continue;
    weeks.push(includeAdjacent ? days : days.map((d) => (d >= first && d <= last ? d : null)));
  }
  return weeks;
}
