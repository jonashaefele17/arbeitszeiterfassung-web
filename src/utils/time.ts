import type { TimeString } from './date';

/** `HH:mm` → Minuten seit Mitternacht. */
export function timeToMinutes(time: TimeString): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** Minuten seit Mitternacht → `HH:mm`. */
export function minutesToTime(minutes: number): TimeString {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
