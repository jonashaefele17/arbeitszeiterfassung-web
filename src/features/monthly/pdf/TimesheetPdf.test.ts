import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { pdf } from '@react-pdf/renderer';
import type { UserProfile, WorkDay } from '../../../domain/models';
import { buildContext } from '../../../domain/calculations/context';
import { resolveMonth } from '../../../domain/calculations/summary';
import { eachWorkWeekDay } from '../../../utils/date';
import { TimesheetPdf } from './TimesheetPdf';

const day = { isWorkDay: true, start: '08:00', end: '14:00', breakMinutes: 30, breakStart: '11:00' };
const profile = {
  id: 'p',
  firstName: 'Maximiliane',
  lastName: 'Musterfrau-Beispielname',
  trackingStartDate: '2026-01-01',
} as UserProfile;

async function pageCount(month: { year: number; month: number }, workDays: WorkDay[]): Promise<number> {
  const ctx = buildContext(
    {
      profile: { trackingStartDate: '2026-01-01', initialBalanceMinutes: 0 },
      scheduleVersions: [
        { id: 'v', validFrom: '2026-01-01', schedule: { monday: day, tuesday: day, wednesday: day, thursday: day, friday: day } },
      ],
      workDays,
      vacationPeriods: [],
      sickPeriods: [],
      customHolidays: [],
    },
    '2027-01-31',
  );
  const document = createElement(TimesheetPdf, { month, days: resolveMonth(month, ctx), profile });
  const blob = await pdf(document as Parameters<typeof pdf>[0]).toBlob();
  const text = new TextDecoder('latin1').decode(await blob.arrayBuffer());
  return text.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
}

describe('Formular-PDF', () => {
  // Größter mögliche Monat: 23 Werktage über 5 Arbeitswochen (4 Leerzeilen) – z. B. Dezember 2026.
  it('passt auch beim vollsten Monat auf eine Seite', async () => {
    const workDays = eachWorkWeekDay('2026-12-01', '2026-12-31').map(
      (date): WorkDay => ({ id: date, date, status: 'work', start: '08:00', end: '15:30', breakMinutes: 30, breakStart: '12:00', plannedMinutes: 330 }),
    );
    expect(workDays).toHaveLength(23);
    expect(await pageCount({ year: 2026, month: 12 }, workDays)).toBe(1);
  }, 30000);
});
