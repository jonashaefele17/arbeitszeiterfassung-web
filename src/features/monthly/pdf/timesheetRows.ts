import type { ResolvedDay } from '../../../domain/models';
import { breakEnd } from '../../../domain/calculations/time';
import { WEEKDAY_SHORT, startOfWeek, weekdayKeyOf, type ISODate, type TimeString } from '../../../utils/date';
import { formatDurationShort } from '../../../utils/format';

/** Stunden, am Komma geteilt: 330 → { whole: '5', fraction: ',5' }. */
export interface SplitHours {
  whole: string;
  fraction: string;
}

export interface TimesheetRow {
  date: ISODate;
  /** „Mo“ */
  weekday: string;
  /** „1.6.26“ */
  day: string;
  hours: SplitHours;
  /** Arbeitszeit von–bis oder ein Hinweis wie „Urlaub“. */
  range: { from: string; to: string } | string;
  /** Pause von–bis, „30 min“ ohne Pausenbeginn oder leer. */
  pause: { from: string; to: string } | string;
  /** Zählt nicht zur Summe (Überstunden frei). */
  muted: boolean;
}

export type TimesheetLine = TimesheetRow | 'gap';

export interface Timesheet {
  lines: TimesheetLine[];
  totalMinutes: number;
}

const ABSENCE_TEXT: Partial<Record<ResolvedDay['status'], string>> = {
  holiday: 'Feiertag',
  vacation: 'Urlaub',
  sick: 'Krank',
  overtimeOff: 'Überstunden frei',
};

/** „08:00“ → „8:00“ */
export function formatClock(time: TimeString): string {
  return time.replace(/^0(\d)/, '$1');
}

/** „2026-06-01“ → „1.6.26“ */
export function formatTimesheetDate(date: ISODate): string {
  const [y = '', m, d] = date.split('-');
  return `${Number(d)}.${Number(m)}.${y.slice(2)}`;
}

export function splitHours(minutes: number): SplitHours {
  const [whole = '', fraction] = formatDurationShort(minutes).split(',');
  return { whole, fraction: fraction ? `,${fraction}` : '' };
}

function toRow(day: ResolvedDay): TimesheetRow | null {
  const weekdayKey = weekdayKeyOf(day.date);
  const base = { date: day.date, weekday: weekdayKey ? WEEKDAY_SHORT[weekdayKey] : '', day: formatTimesheetDate(day.date) };

  if (day.status === 'work' && day.workDay) {
    const w = day.workDay;
    const pause =
      w.breakMinutes > 0
        ? w.breakStart
          ? { from: formatClock(w.breakStart), to: formatClock(breakEnd(w.breakStart, w.breakMinutes)) }
          : `${w.breakMinutes} min`
        : '';
    return {
      ...base,
      hours: splitHours(day.actualMinutes),
      range: { from: formatClock(w.start), to: formatClock(w.end) },
      pause,
      muted: false,
    };
  }

  const text = ABSENCE_TEXT[day.status];
  // Bezahlte Tage zählen mit der regulären Sollzeit; an freien Wochentagen (0 h) erscheinen sie nicht.
  if (!text || day.regularPlannedMinutes <= 0) return null;
  return {
    ...base,
    hours: splitHours(day.regularPlannedMinutes),
    range: text,
    pause: '',
    muted: day.status === 'overtimeOff',
  };
}

/**
 * Zeilen für das Formular „Arbeitsaufschreibungen Minijob und Teilzeit“.
 * Nur Tage mit Arbeit oder Abwesenheit ab Kontostart; zwischen Kalenderwochen eine Leerzeile.
 * Die Summe enthält alle Zeilen außer „Überstunden frei“ (so verlangt es das Formular).
 */
export function buildTimesheet(days: readonly ResolvedDay[], trackingStartDate: ISODate): Timesheet {
  const lines: TimesheetLine[] = [];
  let totalMinutes = 0;
  let lastWeek: ISODate | null = null;

  for (const day of days) {
    if (day.date < trackingStartDate) continue;
    const row = toRow(day);
    if (!row) continue;
    const week = startOfWeek(day.date);
    if (lastWeek !== null && week !== lastWeek) lines.push('gap');
    lastWeek = week;
    lines.push(row);
    if (!row.muted) totalMinutes += day.status === 'work' ? day.actualMinutes : day.regularPlannedMinutes;
  }

  return { lines, totalMinutes };
}
