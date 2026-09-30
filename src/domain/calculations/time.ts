import { minutesToTime, timeToMinutes } from '../../utils/time';
import type { TimeString } from '../../utils/date';

export interface TimeRange {
  start: TimeString;
  end: TimeString;
  breakMinutes: number;
  /** Beginn der Pause; nur bei Pause > 0. Für die Berechnung zählt allein die Pausendauer. */
  breakStart?: TimeString;
}

/** Istzeit = Ende − Beginn − Pause. Keine Rundung; der Pausenbeginn spielt keine Rolle. */
export function actualMinutesOf({ start, end, breakMinutes }: TimeRange): number {
  return timeToMinutes(end) - timeToMinutes(start) - breakMinutes;
}

/** Sollzeit eines Standardtags. Nie negativ. */
export function plannedMinutesOf(range: TimeRange): number {
  return Math.max(0, actualMinutesOf(range));
}

/** Ende der Pause: Pausenbeginn + Pausendauer. */
export function breakEnd(breakStart: TimeString, breakMinutes: number): TimeString {
  return minutesToTime(timeToMinutes(breakStart) + breakMinutes);
}

/** Liegt die Pause vollständig innerhalb der Arbeitszeit? */
export function breakFits({ start, end, breakMinutes, breakStart }: TimeRange): boolean {
  if (breakMinutes <= 0 || !breakStart) return true;
  const b = timeToMinutes(breakStart);
  return b >= timeToMinutes(start) && b + breakMinutes <= timeToMinutes(end);
}

/**
 * Vorschlag für den Pausenbeginn: Pause mittig in der Arbeitszeit, auf 15 Minuten gerundet,
 * begrenzt auf [Beginn, Ende − Pause]. Beispiel: 08:00–14:00, 30 min → 10:45.
 */
export function suggestBreakStart(start: TimeString, end: TimeString, breakMinutes: number): TimeString {
  const s = timeToMinutes(start);
  const latest = timeToMinutes(end) - breakMinutes;
  if (latest <= s) return start;
  const middle = (s + timeToMinutes(end)) / 2 - breakMinutes / 2;
  const rounded = Math.round(middle / 15) * 15;
  return minutesToTime(Math.min(latest, Math.max(s, rounded)));
}

/**
 * Pausenbeginn passend zur Zeitspanne: vorhandenen übernehmen, wenn er passt, sonst vorschlagen.
 * Bei 0 min Pause gibt es keinen Pausenbeginn.
 */
export function withFittingBreakStart(range: TimeRange, preferred?: TimeString): TimeRange {
  if (range.breakMinutes <= 0) return { start: range.start, end: range.end, breakMinutes: range.breakMinutes };
  const candidate = preferred ?? range.breakStart;
  if (candidate && breakFits({ ...range, breakStart: candidate })) return { ...range, breakStart: candidate };
  return { ...range, breakStart: suggestBreakStart(range.start, range.end, range.breakMinutes) };
}

/**
 * Änderung von Beginn, Ende oder Pause beim Bearbeiten. Der Pausenbeginn wird mitgeführt:
 * - Pause 0 → kein Pausenbeginn
 * - noch kein Pausenbeginn (z. B. Pause von 0 auf 30 min) → Vorschlag
 * - nicht selbst gewählt (`pinned` = false) → wird bei Bedarf passend verschoben
 * - selbst gewählt → bleibt; passt er nicht mehr, meldet die Validierung das
 */
export function changeRange(range: TimeRange, patch: Partial<TimeRange>, pinned: boolean): TimeRange {
  const next = { ...range, ...patch };
  if (next.breakMinutes <= 0) return withFittingBreakStart(next);
  if (pinned && next.breakStart) return next;
  return withFittingBreakStart(next);
}

export type TimeRangeError = 'end-before-start' | 'break-too-long' | 'break-outside';

export function validateTimeRange(range: TimeRange): TimeRangeError | null {
  const span = timeToMinutes(range.end) - timeToMinutes(range.start);
  if (span <= 0) return 'end-before-start';
  if (range.breakMinutes < 0 || range.breakMinutes >= span) return 'break-too-long';
  if (!breakFits(range)) return 'break-outside';
  return null;
}

export const TIME_RANGE_ERROR_TEXT: Record<TimeRangeError, string> = {
  'end-before-start': 'Das Ende muss nach dem Beginn liegen.',
  'break-too-long': 'Die Pause ist länger als die Arbeitszeit.',
  'break-outside': 'Die Pause liegt außerhalb der Arbeitszeit.',
};

/** Pause für Anzeige und Export: „12:30–13:00“ mit Pausenbeginn, sonst nur die Dauer „30 min“. */
export function formatBreakSpan({ breakMinutes, breakStart }: Pick<TimeRange, 'breakMinutes' | 'breakStart'>): string {
  if (breakMinutes > 0 && breakStart) return `${breakStart}–${breakEnd(breakStart, breakMinutes)}`;
  return `${breakMinutes} min`;
}
