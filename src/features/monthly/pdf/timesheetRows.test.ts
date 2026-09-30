import { describe, expect, it } from 'vitest';
import type { WorkDay, WorkSchedule } from '../../../domain/models';
import { buildContext, type RawData } from '../../../domain/calculations/context';
import { resolveMonth } from '../../../domain/calculations/summary';
import { buildTimesheet, formatClock, formatTimesheetDate, splitHours, type TimesheetRow } from './timesheetRows';

const day = (start: string, end: string, breakMinutes = 0) => ({ isWorkDay: true, start, end, breakMinutes });

// Wie auf dem Papierbeispiel: Mo 3,5 h, Di frei, Mi 4 h, Do 4 h, Fr 6 h
const schedule: WorkSchedule = {
  monday: day('10:00', '13:30'),
  tuesday: { isWorkDay: false, start: '08:00', end: '12:00', breakMinutes: 0 },
  wednesday: day('08:00', '12:00'),
  thursday: day('08:00', '12:00'),
  friday: day('08:00', '14:00'),
};

const work = (date: string, start: string, end: string, breakMinutes = 0, breakStart?: string): WorkDay => ({
  id: date,
  date,
  status: 'work',
  start,
  end,
  breakMinutes,
  ...(breakStart ? { breakStart } : {}),
  plannedMinutes: 0,
});

/** Juni 2026 nach dem Papierbeispiel (Summe 68,5 h) plus „Überstunden frei“ am 10.6. */
function june(overrides: Partial<RawData> = {}) {
  const raw: RawData = {
    profile: { trackingStartDate: '2026-06-01', initialBalanceMinutes: 0 },
    scheduleVersions: [{ id: 'v', validFrom: '2026-01-01', schedule }],
    workDays: [
      work('2026-06-01', '11:00', '14:30'),
      work('2026-06-08', '10:00', '14:00'),
      work('2026-06-11', '08:00', '12:00'),
      work('2026-06-12', '08:00', '14:00'),
      work('2026-06-15', '10:00', '13:30'),
      work('2026-06-17', '08:00', '12:00'),
      work('2026-06-18', '08:00', '12:00'),
      work('2026-06-19', '08:00', '14:00'),
      work('2026-06-22', '10:00', '13:30'),
      work('2026-06-24', '08:00', '15:30', 30, '12:00'),
      work('2026-06-25', '08:00', '12:00'),
      work('2026-06-26', '08:00', '13:30'),
      work('2026-06-29', '10:00', '13:30'),
    ],
    vacationPeriods: [
      { id: 'u', startDate: '2026-06-05', endDate: '2026-06-05' },
      { id: 'ü', startDate: '2026-06-10', endDate: '2026-06-10', kind: 'overtime' },
    ],
    sickPeriods: [],
    customHolidays: [],
    ...overrides,
  };
  const ctx = buildContext(raw, '2026-07-15');
  return buildTimesheet(resolveMonth({ year: 2026, month: 6 }, ctx), raw.profile.trackingStartDate);
}

const rows = (lines: ReturnType<typeof june>['lines']) => lines.filter((l): l is TimesheetRow => l !== 'gap');
const find = (lines: ReturnType<typeof june>['lines'], date: string) => rows(lines).find((r) => r.date === date);

describe('Formular „Arbeitsaufschreibungen“', () => {
  it('formatiert Datum, Uhrzeit und Stunden ohne führende Nullen', () => {
    expect(formatTimesheetDate('2026-06-01')).toBe('1.6.26');
    expect(formatTimesheetDate('2026-11-24')).toBe('24.11.26');
    expect(formatClock('08:00')).toBe('8:00');
    expect(formatClock('10:30')).toBe('10:30');
    expect(splitHours(210)).toEqual({ whole: '3', fraction: ',5' });
    expect(splitHours(240)).toEqual({ whole: '4', fraction: '' });
    expect(splitHours(345)).toEqual({ whole: '5', fraction: ',75' });
  });

  it('bildet das Papierbeispiel nach: Summe 68,5 h ohne „Überstunden frei“', () => {
    const { lines, totalMinutes } = june();
    expect(totalMinutes).toBe(68.5 * 60);
    expect(rows(lines).map((r) => `${r.weekday} ${r.day}`)).toEqual([
      'Mo 1.6.26', 'Do 4.6.26', 'Fr 5.6.26',
      'Mo 8.6.26', 'Mi 10.6.26', 'Do 11.6.26', 'Fr 12.6.26',
      'Mo 15.6.26', 'Mi 17.6.26', 'Do 18.6.26', 'Fr 19.6.26',
      'Mo 22.6.26', 'Mi 24.6.26', 'Do 25.6.26', 'Fr 26.6.26',
      'Mo 29.6.26',
    ]);
  });

  it('trägt Arbeitszeiten und Pausen als von–bis ein', () => {
    const { lines } = june();
    expect(find(lines, '2026-06-01')).toMatchObject({ hours: { whole: '3', fraction: ',5' }, range: { from: '11:00', to: '14:30' }, pause: '' });
    expect(find(lines, '2026-06-24')).toMatchObject({ hours: { whole: '7', fraction: '' }, range: { from: '8:00', to: '15:30' }, pause: { from: '12:00', to: '12:30' } });
  });

  it('zeigt eine Pause ohne Pausenbeginn als Dauer', () => {
    const { lines } = june({ workDays: [work('2026-06-01', '08:00', '14:00', 30)] });
    expect(find(lines, '2026-06-01')?.pause).toBe('30 min');
  });

  it('trägt Abwesenheiten mit der regulären Sollzeit ein; „Überstunden frei“ ist ausgegraut', () => {
    const { lines } = june({ sickPeriods: [{ id: 'k', startDate: '2026-06-15', endDate: '2026-06-15' }], workDays: [] });
    expect(find(lines, '2026-06-04')).toMatchObject({ range: 'Feiertag', hours: { whole: '4', fraction: '' }, muted: false });
    expect(find(lines, '2026-06-05')).toMatchObject({ range: 'Urlaub', hours: { whole: '6', fraction: '' }, muted: false });
    expect(find(lines, '2026-06-10')).toMatchObject({ range: 'Überstunden frei', hours: { whole: '4', fraction: '' }, muted: true });
    expect(find(lines, '2026-06-15')).toMatchObject({ range: 'Krank', hours: { whole: '3', fraction: ',5' } });
  });

  it('lässt offene Tage, freie Tage und Tage vor dem Kontostart weg', () => {
    const { lines } = june({ profile: { trackingStartDate: '2026-06-08', initialBalanceMinutes: 0 } });
    const dates = rows(lines).map((r) => r.date);
    expect(dates).not.toContain('2026-06-01'); // vor Kontostart
    expect(dates).not.toContain('2026-06-03'); // offen (nicht eingetragen)
    expect(dates).not.toContain('2026-06-09'); // Dienstag frei
  });

  it('trennt Kalenderwochen durch eine Leerzeile', () => {
    const { lines } = june();
    const gaps = lines.flatMap((l, i) => (l === 'gap' ? [i] : []));
    expect(gaps).toHaveLength(4);
    expect(lines[0]).not.toBe('gap');
    expect(lines.at(-1)).not.toBe('gap');
    expect((lines[gaps[0]! - 1] as TimesheetRow).date).toBe('2026-06-05');
    expect((lines[gaps[0]! + 1] as TimesheetRow).date).toBe('2026-06-08');
  });
});
