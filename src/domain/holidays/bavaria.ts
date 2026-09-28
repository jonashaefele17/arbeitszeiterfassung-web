import { addDays, type ISODate } from '../../utils/date';

export interface PublicHoliday {
  date: ISODate;
  name: string;
}

/** Ostersonntag nach der Gaußschen Osterformel (anonymer gregorianischer Algorithmus). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const cache = new Map<number, Map<ISODate, string>>();

/**
 * Landesweit einheitliche gesetzliche Feiertage in Bayern.
 * Mariä Himmelfahrt (nur überwiegend katholische Gemeinden) und das Augsburger Friedensfest
 * sind bewusst nicht enthalten – sie können als manuelle Feiertage gesetzt werden.
 */
export function bavarianHolidays(year: number): Map<ISODate, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const fixed = (mmdd: string) => `${year}-${mmdd}`;
  const list: PublicHoliday[] = [
    { date: fixed('01-01'), name: 'Neujahr' },
    { date: fixed('01-06'), name: 'Heilige Drei Könige' },
    { date: addDays(easter, -2), name: 'Karfreitag' },
    { date: addDays(easter, 1), name: 'Ostermontag' },
    { date: fixed('05-01'), name: 'Tag der Arbeit' },
    { date: addDays(easter, 39), name: 'Christi Himmelfahrt' },
    { date: addDays(easter, 50), name: 'Pfingstmontag' },
    { date: addDays(easter, 60), name: 'Fronleichnam' },
    { date: fixed('10-03'), name: 'Tag der Deutschen Einheit' },
    { date: fixed('11-01'), name: 'Allerheiligen' },
    { date: fixed('12-25'), name: '1. Weihnachtstag' },
    { date: fixed('12-26'), name: '2. Weihnachtstag' },
  ];
  const map = new Map(list.map((h) => [h.date, h.name]));
  cache.set(year, map);
  return map;
}

export function publicHolidayName(date: ISODate): string | undefined {
  return bavarianHolidays(Number(date.slice(0, 4))).get(date);
}
