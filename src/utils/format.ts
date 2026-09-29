/**
 * Zentrale Formatierung von Dauern. Gerechnet wird immer in ganzen Minuten ohne Rundung;
 * errechnete Zeiten werden als Dezimalstunden angezeigt (höchstens zwei Nachkommastellen).
 */

/** Minuten → Dezimalstunden ohne Vorzeichen, deutsch formatiert: 330 → „5,5“, 349 → „5,82“. */
function decimalHours(minutes: number): string {
  const hours = Math.round((Math.abs(minutes) / 60) * 100) / 100;
  return hours
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .replace('.', ',');
}

/** 330 → „5,5“ */
export function formatDurationShort(minutes: number): string {
  const value = decimalHours(minutes);
  return `${minutes < 0 && value !== '0' ? '-' : ''}${value}`;
}

/** 330 → „5,5 h“ */
export function formatDuration(minutes: number): string {
  return `${formatDurationShort(minutes)} h`;
}

/** Salden mit Vorzeichen: 330 → „+5,5 h“, -225 → „-3,75 h“, 0 → „0 h“. */
export function formatBalance(minutes: number): string {
  const value = decimalHours(minutes);
  const sign = value === '0' ? '' : minutes < 0 ? '-' : '+';
  return `${sign}${value} h`;
}

/**
 * Saldo im Eingabeformat Stunden:Minuten (passend zum Auswahlrad), z. B. beim Startsaldo:
 * 330 → „+05:30 h“, -225 → „-03:45 h“.
 */
export function formatBalanceInput(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `${minutes < 0 ? '-' : '+'}${h}:${m} h`;
}

/** 30 → „30 min“ */
export function formatBreak(minutes: number): string {
  return `${minutes} min`;
}

export function formatDayCount(count: number): string {
  return `${count} ${count === 1 ? 'Tag' : 'Tage'}`;
}
