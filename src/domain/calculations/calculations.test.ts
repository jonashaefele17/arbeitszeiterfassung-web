import { describe, expect, it } from 'vitest';
import type { WorkDay, WorkSchedule, WorkScheduleVersion } from '../models';
import { bavarianHolidays, easterSunday } from '../holidays/bavaria';
import { buildContext, type RawData } from './context';
import { resolveDay } from './resolveDay';
import { balanceForMonth, summarizeMonth, vacationAccount } from './summary';
import { actualMinutesOf } from './time';
import { analyzeAbsence, workTemplateFor } from '../services/dayService';
import { formatBalance, formatBalanceInput, formatDuration, formatDurationShort } from '../../utils/format';

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
    expect(formatDuration(345)).toBe('5,75 h');
  });

  it('zeigt errechnete Zeiten als Dezimalstunden', () => {
    expect(formatDuration(210)).toBe('3,5 h');
    expect(formatDuration(330)).toBe('5,5 h');
    expect(formatDuration(360)).toBe('6 h');
    expect(formatDuration(349)).toBe('5,82 h'); // Anzeige auf zwei Stellen
    expect(formatDuration(0)).toBe('0 h');
    expect(formatDurationShort(-90)).toBe('-1,5');
  });

  it('formatiert Salden mit Vorzeichen', () => {
    expect(formatBalance(330)).toBe('+5,5 h');
    expect(formatBalance(-225)).toBe('-3,75 h');
    expect(formatBalance(0)).toBe('0 h');
    expect(formatBalance(9000)).toBe('+150 h');
  });

  it('zeigt den Startsaldo im Eingabeformat', () => {
    expect(formatBalanceInput(330)).toBe('+05:30 h');
    expect(formatBalanceInput(-225)).toBe('-03:45 h');
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

  it('Feiertag an einem regulären Tag ist ein bezahlter Tag', () => {
    const c = ctx({}, '2026-06-30');
    const r = resolveDay('2026-06-04', c); // Fronleichnam, Donnerstag
    expect(r.status).toBe('holiday');
    expect(r.plannedMinutes).toBe(330);
    expect(r.actualMinutes).toBe(330);
    expect(r.differenceMinutes).toBe(0);
  });

  it('Feiertag an einem Nicht-Arbeitstag zählt 0', () => {
    const c = ctx({ customHolidays: [{ id: 'h', date: '2026-09-16' }] }); // Mittwoch frei
    const r = resolveDay('2026-09-16', c);
    expect(r.status).toBe('holiday');
    expect(r.plannedMinutes).toBe(0);
    expect(r.actualMinutes).toBe(0);
  });

  it('Arbeit an einem Feiertag ersetzt ihn und läuft gegen die reguläre Sollzeit', () => {
    const c = ctx({}, '2026-06-30');
    const planned = workTemplateFor('2026-06-04', c).plannedMinutes;
    const withWork = ctx({ workDays: [work('2026-06-04', '08:00', '12:00', 0, planned)] }, '2026-06-30');
    const r = resolveDay('2026-06-04', withWork);
    expect(r.status).toBe('work');
    expect(r.plannedMinutes).toBe(330);
    expect(r.differenceMinutes).toBe(-90);
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
    // Leere Tage erzeugen Minus, der bezahlte Feiertag 25.12. (Fr) nicht. Der 26.12. ist ein Samstag.
    expect(dec.balanceMinutes).toBe(-(dec.plannedMinutes - 330));
    const jan = balanceForMonth({ year: 2027, month: 1 }, c);
    expect(jan.previousMinutes).toBe(60 + dec.balanceMinutes);
    expect(jan.currentMinutes).toBe(jan.previousMinutes + jan.monthMinutes);
  });

  it('Feiertage sind in Soll- und Arbeitszeit des Monats enthalten', () => {
    const c = ctx(
      { profile: { trackingStartDate: '2026-06-01', initialBalanceMinutes: 0 }, scheduleVersions: [version('2026-06-01')] },
      '2026-06-30',
    );
    const s = summarizeMonth({ year: 2026, month: 6 }, c);
    expect(s.holidayDays).toBe(1); // Fronleichnam 04.06.
    expect(s.actualMinutes).toBe(330);
    expect(s.balanceMinutes).toBe(-(s.plannedMinutes - 330));
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

  it('Vorlage an Feiertagen übernimmt die reguläre Sollzeit', () => {
    const c = ctx();
    expect(workTemplateFor('2026-06-04', c).plannedMinutes).toBe(330);
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

describe('Überstunden frei', () => {
  const overtime = [{ id: 'o', startDate: '2026-09-14', endDate: '2026-09-18', kind: 'overtime' as const }];

  it('erzeugt Soll ohne Ist und verbraucht keinen Urlaub', () => {
    const c = ctx({ vacationPeriods: overtime });
    const r = resolveDay('2026-09-14', c);
    expect(r.status).toBe('overtimeOff');
    expect(r.plannedMinutes).toBe(330);
    expect(r.actualMinutes).toBe(0);
    expect(r.differenceMinutes).toBe(-330);
    expect(resolveDay('2026-09-16', c).status).toBe('off'); // Mittwoch frei
    expect(vacationAccount(2026, 30, c).taken).toBe(0);
  });

  it('wirkt auf den Saldo wie ein nicht eingetragener Tag', () => {
    const withOvertime = summarizeMonth({ year: 2026, month: 9 }, ctx({ vacationPeriods: overtime }));
    const empty = summarizeMonth({ year: 2026, month: 9 }, ctx());
    expect(withOvertime.balanceMinutes).toBe(empty.balanceMinutes);
    expect(withOvertime.overtimeOffDays).toBe(4);
  });

  it('Feiertag und Krankheit haben Vorrang', () => {
    const c = ctx(
      {
        vacationPeriods: [{ id: 'o', startDate: '2026-06-01', endDate: '2026-06-05', kind: 'overtime' }],
        sickPeriods: [{ id: 's', startDate: '2026-06-05', endDate: '2026-06-05' }],
        scheduleVersions: [version('2026-06-01')],
        profile: { trackingStartDate: '2026-06-01', initialBalanceMinutes: 0 },
      },
      '2026-06-30',
    );
    expect(resolveDay('2026-06-04', c).status).toBe('holiday'); // Fronleichnam
    expect(resolveDay('2026-06-05', c).status).toBe('sick');
  });

  it('analyzeAbsence zählt die freien Tage', () => {
    const a = analyzeAbsence(
      { kind: 'vacation', vacationKind: 'overtime', startDate: '2026-09-14', endDate: '2026-09-18' },
      ctx(),
    );
    expect(a.effectiveDays).toBe(4);
  });
});

describe('Nicht eingetragene Tage', () => {
  it('markiert nur vergangene leere Arbeitstage ab Kontostart', () => {
    const c = ctx({ profile: { trackingStartDate: '2026-09-15', initialBalanceMinutes: 0 } }, '2026-09-22');
    expect(resolveDay('2026-09-14', c).isMissing).toBe(false); // vor Kontostart
    expect(resolveDay('2026-09-15', c).isMissing).toBe(true);
    expect(resolveDay('2026-09-16', c).isMissing).toBe(false); // Mittwoch frei
    expect(resolveDay('2026-09-22', c).isMissing).toBe(false); // heute
    expect(resolveDay('2026-09-24', c).isMissing).toBe(false); // Zukunft
    expect(summarizeMonth({ year: 2026, month: 9 }, c).missingDays).toBe(4); // 15, 17, 18, 21
  });

  it('eingetragene Tage gelten nicht als fehlend', () => {
    const c = ctx({ workDays: [work('2026-09-15', '08:00', '14:00', 30)] }, '2026-09-22');
    expect(resolveDay('2026-09-15', c).isMissing).toBe(false);
  });
});

describe('Urlaubskonto und Jahreswechsel', () => {
  const raw = (extra: Partial<RawData> = {}) => ({
    profile: { trackingStartDate: '2026-09-15', initialBalanceMinutes: 0, initialVacationTakenDays: 12 },
    scheduleVersions: [version('2026-01-01')],
    ...extra,
  });

  it('zieht die vor dem Kontostart genommenen Tage im Startjahr ab', () => {
    const c = ctx(raw({ vacationPeriods: [{ id: 'v', startDate: '2026-09-21', endDate: '2026-09-22' }] }));
    expect(vacationAccount(2026, 30, c)).toMatchObject({ taken: 14, remaining: 16 });
  });

  it('zählt in der App eingetragenen Urlaub vor dem Kontostart nicht doppelt', () => {
    const c = ctx(raw({ vacationPeriods: [{ id: 'v', startDate: '2026-08-03', endDate: '2026-08-04' }] }));
    expect(vacationAccount(2026, 30, c).taken).toBe(12);
  });

  it('überträgt Resturlaub ins Folgejahr', () => {
    const c = ctx(raw({ vacationPeriods: [{ id: 'v', startDate: '2027-01-11', endDate: '2027-01-12' }] }), '2027-02-01');
    // 2026: 30 − 12 = 18 Rest → 2027: 30 + 18 − 2 = 46
    expect(vacationAccount(2027, 30, c)).toMatchObject({ carryover: 18, taken: 2, remaining: 46 });
  });

  it('berücksichtigt den Resturlaub aus dem Vorjahr des Kontostarts', () => {
    const c = ctx({
      profile: { trackingStartDate: '2026-09-15', initialBalanceMinutes: 0, initialVacationTakenDays: 12, initialVacationCarryoverDays: 4 },
      scheduleVersions: [version('2026-01-01')],
    });
    expect(vacationAccount(2026, 30, c)).toMatchObject({ carryover: 4, taken: 12, remaining: 22 });
    expect(vacationAccount(2027, 30, c)).toMatchObject({ carryover: 22, remaining: 52 });
  });

  it('überträgt kein Minus', () => {
    const c = ctx({
      profile: { trackingStartDate: '2026-09-15', initialBalanceMinutes: 0, initialVacationTakenDays: 35 },
      scheduleVersions: [version('2026-01-01')],
    });
    expect(vacationAccount(2026, 30, c).remaining).toBe(-5);
    expect(vacationAccount(2027, 30, c)).toMatchObject({ carryover: 0, remaining: 30 });
  });

  it('vor dem Startjahr gibt es keinen Übertrag', () => {
    expect(vacationAccount(2025, 30, ctx(raw())).carryover).toBe(0);
  });

  it('alte Profile ohne Angabe zählen 0', () => {
    const c = ctx({ profile: { trackingStartDate: '2026-09-01', initialBalanceMinutes: 0 } });
    expect(vacationAccount(2026, 30, c).taken).toBe(0);
  });
});

describe('Code-Review-Fixes', () => {
  it('Überstunden frei in der Zukunft zieht erst ab dem Tag selbst ab', () => {
    const overtime = [{ id: 'o', startDate: '2026-09-28', endDate: '2026-10-02', kind: 'overtime' as const }];
    const before = ctx({ vacationPeriods: overtime }, '2026-09-22');
    const r = resolveDay('2026-09-28', before);
    expect(r.status).toBe('overtimeOff');
    expect(r.differenceMinutes).toBe(0);
    expect(balanceForMonth({ year: 2026, month: 9 }, before).currentMinutes).toBe(
      balanceForMonth({ year: 2026, month: 9 }, ctx({}, '2026-09-22')).currentMinutes,
    );
    const onTheDay = ctx({ vacationPeriods: overtime }, '2026-09-28');
    expect(resolveDay('2026-09-28', onTheDay).differenceMinutes).toBe(-330);
  });

  it('Urlaubs-Startwerte bleiben in ihrem Jahr, wenn der Kontostart verschoben wird', () => {
    const c = ctx(
      {
        profile: {
          trackingStartDate: '2025-12-01', // nachträglich ins Vorjahr verschoben
          initialBalanceMinutes: 0,
          initialVacationAsOf: '2026-09-15', // Onboarding-Datum
          initialVacationTakenDays: 12,
          initialVacationCarryoverDays: 4,
        },
        scheduleVersions: [version('2025-01-01')],
      },
      '2026-09-30',
    );
    expect(vacationAccount(2025, 30, c)).toMatchObject({ carryover: 0, taken: 0 });
    expect(vacationAccount(2026, 30, c)).toMatchObject({ carryover: 4, taken: 12, remaining: 22 });
  });
});
