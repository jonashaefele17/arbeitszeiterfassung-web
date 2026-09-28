import { describe, expect, it } from 'vitest';
import type { WorkDay, WorkSchedule, WorkScheduleVersion } from '../models';
import { bavarianHolidays, easterSunday } from '../holidays/bavaria';
import { buildContext, type RawData } from './context';
import { resolveDay } from './resolveDay';
import { balanceForMonth, summarizeMonth, vacationAccount } from './summary';
import { actualMinutesOf } from './time';
import { analyzeAbsence, workTemplateFor } from '../services/dayService';
import { formatBalance, formatDuration } from '../../utils/format';

const day = (start: string, end: string, breakMinutes: number) => ({ isWorkDay: true, start, end, breakMinutes });
const off = { isWorkDay: false, start: '08:00', end: '14:00', breakMinutes: 30 };

// Mo–Fr 08:00–14:00, 30 min Pause (5:30 h), Mittwoch frei
const schedule: WorkSchedule = {
  monday: day('08:00', '14:00', 30),
  tuesday: day('08:00', '14:00', 30),
  wednesday: off,
  thursday: day('08:00', '14:00', 30),
  friday: day('08:00', '14:00', 30),
};

const version = (validFrom: string, s: WorkSchedule = schedule): WorkScheduleVersion => ({
  id: validFrom,
  validFrom,
  schedule: s,
});

const work = (date: string, start: string, end: string, breakMinutes: number, plannedMinutes = 330): WorkDay => ({
  id: date,
  date,
  status: 'work',
  start,
  end,
  breakMinutes,
  plannedMinutes,
});

function ctx(overrides: Partial<RawData> = {}, today = '2026-09-30') {
  const raw: RawData = {
    profile: { trackingStartDate: '2026-09-01', initialBalanceMinutes: 0 },
    scheduleVersions: [version('2026-09-01')],
    workDays: [],
    vacationPeriods: [],
    sickPeriods: [],
    customHolidays: [],
    ...overrides,
  };
  return buildContext(raw, today);
}

describe('Feiertage Bayern', () => {
  it('berechnet Ostern korrekt', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2024)).toBe('2024-03-31');
  });

  it('enthält bewegliche und feste Feiertage, aber nicht Mariä Himmelfahrt', () => {
    const h = bavarianHolidays(2026);
    expect(h.get('2026-04-03')).toBe('Karfreitag');
    expect(h.get('2026-05-14')).toBe('Christi Himmelfahrt');
    expect(h.get('2026-05-25')).toBe('Pfingstmontag');
    expect(h.get('2026-06-04')).toBe('Fronleichnam');
    expect(h.get('2026-01-06')).toBe('Heilige Drei Könige');
    expect(h.has('2026-08-15')).toBe(false);
    expect(h.has('2026-08-08')).toBe(false);
    expect(h.size).toBe(12);
  });
});

describe('Zeitberechnung', () => {
  it('rundet nicht', () => {
    expect(actualMinutesOf({ start: '08:07', end: '14:19', breakMinutes: 27 })).toBe(345);
    expect(formatDuration(345)).toBe('5:45 h');
  });

  it('formatiert Salden mit Vorzeichen', () => {
    expect(formatBalance(330)).toBe('+05:30 h');
    expect(formatBalance(-225)).toBe('-03:45 h');
    expect(formatBalance(0)).toBe('+00:00 h');
  });
});

describe('resolveDay', () => {
  it('berechnet die Differenz eines Arbeitstags', () => {
    const c = ctx({ workDays: [work('2026-09-28', '08:00', '14:30', 30)] });
    const r = resolveDay('2026-09-28', c);
    expect(r.status).toBe('work');
    expect(r.actualMinutes).toBe(360);
    expect(r.differenceMinutes).toBe(30);
  });

  it('Urlaub erfüllt die Sollzeit und gilt nur an regulären Arbeitstagen', () => {
    const c = ctx({ vacationPeriods: [{ id: 'v', startDate: '2026-09-14', endDate: '2026-09-18' }] });
    const mon = resolveDay('2026-09-14', c);
    expect(mon.status).toBe('vacation');
    expect(mon.plannedMinutes).toBe(330);
    expect(mon.differenceMinutes).toBe(0);
    expect(resolveDay('2026-09-16', c).status).toBe('off'); // Mittwoch frei
  });

  it('explizite Arbeit hat Vorrang vor Urlaub und fällt nach dem Löschen zurück', () => {
    const vacation = [{ id: 'v', startDate: '2026-09-14', endDate: '2026-09-18' }];
    const withWork = ctx({ vacationPeriods: vacation, workDays: [work('2026-09-15', '08:00', '12:00', 0)] });
    expect(resolveDay('2026-09-15', withWork).status).toBe('work');
    expect(resolveDay('2026-09-15', ctx({ vacationPeriods: vacation })).status).toBe('vacation');
  });

  it('Feiertag im Urlaub zählt nicht als Urlaubstag', () => {
    // 03.10.2026 ist ein Samstag → 2025: Freitag 03.10.
    const c = ctx(
      {
        profile: { trackingStartDate: '2025-01-01', initialBalanceMinutes: 0 },
        scheduleVersions: [version('2025-01-01')],
        vacationPeriods: [{ id: 'v', startDate: '2025-09-29', endDate: '2025-10-03' }],
      },
      '2025-12-31',
    );
    expect(resolveDay('2025-10-03', c).status).toBe('holiday');
    expect(vacationAccount(2025, 30, c).taken).toBe(3); // Mo, Di, Do (Mi frei, Fr Feiertag)
  });

  it('Krankheit im Urlaub hat Vorrang', () => {
    const c = ctx({
      vacationPeriods: [{ id: 'v', startDate: '2026-09-14', endDate: '2026-09-18' }],
      sickPeriods: [{ id: 's', startDate: '2026-09-17', endDate: '2026-09-17' }],
    });
    expect(resolveDay('2026-09-17', c).status).toBe('sick');
    expect(vacationAccount(2026, 30, c).taken).toBe(3);
  });

  it('Arbeit an einem Feiertag überschreibt ihn', () => {
    const c = ctx({ workDays: [work('2026-06-04', '08:00', '12:00', 0, 0)] }, '2026-06-30');
    expect(resolveDay('2026-06-04', c).status).toBe('work');
    expect(resolveDay('2026-06-04', c).differenceMinutes).toBe(240);
  });

  it('leere Tage zählen nur zwischen Kontostart und heute', () => {
    const c = ctx({ profile: { trackingStartDate: '2026-09-15', initialBalanceMinutes: 0 } }, '2026-09-22');
    expect(resolveDay('2026-09-14', c).plannedMinutes).toBe(0); // vor Start
    expect(resolveDay('2026-09-22', c).differenceMinutes).toBe(-330); // heute
    expect(resolveDay('2026-09-24', c).plannedMinutes).toBe(0); // Zukunft
  });

  it('versionierte Standardwoche verändert die Vergangenheit nicht', () => {
    const shorter: WorkSchedule = { ...schedule, monday: day('08:00', '12:00', 0) };
    const c = ctx({ scheduleVersions: [version('2026-09-01'), version('2026-09-21', shorter)] });
    expect(resolveDay('2026-09-14', c).plannedMinutes).toBe(330);
    expect(resolveDay('2026-09-21', c).plannedMinutes).toBe(240);
  });
});

describe('Monat und Überstundenkonto', () => {
  it('berechnet Monatssaldo und führt das Konto über den Jahreswechsel fort', () => {
    const c = ctx(
      {
        profile: { trackingStartDate: '2026-12-01', initialBalanceMinutes: 60 },
        scheduleVersions: [version('2026-12-01')],
        // Dezember 2026: alle regulären Tage 30 min länger gearbeitet
        workDays: [],
      },
      '2027-01-31',
    );
    // Alle regulären Tage im Dezember leer → nur Minus
    const dec = summarizeMonth({ year: 2026, month: 12 }, c);
    // Dezember 2026: Mo/Di/Do/Fr-Tage minus Feiertage 25./26.12. (Fr/Sa)
    expect(dec.balanceMinutes).toBe(-dec.plannedMinutes);
    const jan = balanceForMonth({ year: 2027, month: 1 }, c);
    expect(jan.previousMinutes).toBe(60 + dec.balanceMinutes);
    expect(jan.currentMinutes).toBe(jan.previousMinutes + jan.monthMinutes);
  });

  it('summiert Tage exakt ohne Rundung', () => {
    const c = ctx(
      {
        workDays: [work('2026-09-01', '08:07', '14:19', 27), work('2026-09-03', '08:00', '14:00', 30)],
      },
      '2026-09-04',
    );
    const s = summarizeMonth({ year: 2026, month: 9 }, c);
    // Di 01. (345), Do 03. (330), Fr 04. leer (-330). Mi 02. frei
    expect(s.actualMinutes).toBe(675);
    expect(s.plannedMinutes).toBe(990);
    expect(s.balanceMinutes).toBe(15 + 0 - 330);
  });
});

describe('Konflikte', () => {
  it('erkennt bestehende Arbeit im Urlaubszeitraum', () => {
    const c = ctx({ workDays: [work('2026-09-28', '08:00', '14:00', 30)] });
    const a = analyzeAbsence({ kind: 'vacation', startDate: '2026-09-28', endDate: '2026-10-02' }, c);
    expect(a.conflictingWorkDays.map((w) => w.date)).toEqual(['2026-09-28']);
    // Mo, Di, Fr – Mi frei, Do 01.10. kein Feiertag → Do zählt: 28, 29, 01, 02 → 4
    expect(a.effectiveDays).toBe(4);
  });

  it('meldet Feiertage im Urlaub', () => {
    const c = ctx({}, '2026-12-31');
    const a = analyzeAbsence({ kind: 'vacation', startDate: '2026-12-21', endDate: '2026-12-25' }, c);
    expect(a.effectiveDays).toBe(3); // Mo 21, Di 22, Do 24 (Mi frei, Fr 25 Feiertag)
    expect(a.notes.length).toBe(1);
  });

  it('Vorlage an Feiertagen hat Sollzeit 0', () => {
    const c = ctx();
    expect(workTemplateFor('2026-06-04', c).plannedMinutes).toBe(0);
    expect(workTemplateFor('2026-09-28', c).plannedMinutes).toBe(330);
  });
});

describe('Zeitraum bearbeiten', () => {
  it('behält Arbeits-Ausnahmen im bisherigen Zeitraum', () => {
    const c = ctx({
      vacationPeriods: [{ id: 'v', startDate: '2026-09-14', endDate: '2026-09-18' }],
      workDays: [work('2026-09-15', '08:00', '12:00', 0), work('2026-09-21', '08:00', '12:00', 0)],
    });
    const a = analyzeAbsence(
      {
        kind: 'vacation',
        startDate: '2026-09-14',
        endDate: '2026-09-21',
        existingId: 'v',
        existingRange: { startDate: '2026-09-14', endDate: '2026-09-18' },
      },
      c,
    );
    expect(a.conflictingWorkDays.map((w) => w.date)).toEqual(['2026-09-21']);
    expect(a.effectiveDays).toBe(4); // 14, 17, 18, 21 (15 Ausnahme, 16 frei)
  });
});
