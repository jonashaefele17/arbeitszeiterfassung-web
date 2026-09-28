import { timeToMinutes } from '../../utils/time';
import type { TimeString } from '../../utils/date';

export interface TimeRange {
  start: TimeString;
  end: TimeString;
  breakMinutes: number;
}

/** Istzeit = Ende − Beginn − Pause. Keine Rundung. */
export function actualMinutesOf({ start, end, breakMinutes }: TimeRange): number {
  return timeToMinutes(end) - timeToMinutes(start) - breakMinutes;
}

/** Sollzeit eines Standardtags. Nie negativ. */
export function plannedMinutesOf(range: TimeRange): number {
  return Math.max(0, actualMinutesOf(range));
}

export type TimeRangeError = 'end-before-start' | 'break-too-long';

export function validateTimeRange(range: TimeRange): TimeRangeError | null {
  const span = timeToMinutes(range.end) - timeToMinutes(range.start);
  if (span <= 0) return 'end-before-start';
  if (range.breakMinutes < 0 || range.breakMinutes >= span) return 'break-too-long';
  return null;
}

export const TIME_RANGE_ERROR_TEXT: Record<TimeRangeError, string> = {
  'end-before-start': 'Das Ende muss nach dem Beginn liegen.',
  'break-too-long': 'Die Pause ist länger als die Arbeitszeit.',
};
