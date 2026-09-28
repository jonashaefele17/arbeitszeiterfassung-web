/**
 * Zentrale Formatierung von Dauern. Es wird nie gerundet – alle Werte sind ganze Minuten.
 */

function hm(minutes: number): { h: number; m: string } {
  const abs = Math.abs(minutes);
  return { h: Math.floor(abs / 60), m: String(abs % 60).padStart(2, '0') };
}

/** 330 → „5:30“ */
export function formatDurationShort(minutes: number): string {
  const { h, m } = hm(minutes);
  return `${minutes < 0 ? '-' : ''}${h}:${m}`;
}

/** 330 → „5:30 h“ */
export function formatDuration(minutes: number): string {
  return `${formatDurationShort(minutes)} h`;
}

/** Salden immer mit Vorzeichen und zweistelliger Stunde: 330 → „+05:30 h“, -225 → „-03:45 h“. */
export function formatBalance(minutes: number): string {
  const { h, m } = hm(minutes);
  const sign = minutes < 0 ? '-' : '+';
  return `${sign}${String(h).padStart(2, '0')}:${m} h`;
}

/** 30 → „30 min“ */
export function formatBreak(minutes: number): string {
  return `${minutes} min`;
}

export function formatDayCount(count: number): string {
  return `${count} ${count === 1 ? 'Tag' : 'Tage'}`;
}
