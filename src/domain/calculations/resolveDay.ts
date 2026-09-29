import type { DatePeriod, ResolvedDay } from '../models';
import type { ISODate } from '../../utils/date';
import { publicHolidayName } from '../holidays/bavaria';
import { isRegularWorkDay, regularPlannedMinutes } from '../services/scheduleService';
import { actualMinutesOf } from './time';
import type { CalculationContext } from './context';

function findPeriod<T extends DatePeriod>(periods: readonly T[], date: ISODate): T | undefined {
  return periods.find((p) => p.startDate <= date && date <= p.endDate);
}

/** Der Feiertag eines Tages – manuell hat Vorrang in der Anzeige, verhält sich aber identisch. */
export function holidayOf(date: ISODate, ctx: CalculationContext): ResolvedDay['holiday'] {
  const custom = ctx.customHolidays.get(date);
  if (custom) return { name: 'Feiertag', source: 'custom', customId: custom.id };
  const name = publicHolidayName(date);
  if (name) return { name, source: 'public' };
  return undefined;
}

/**
 * Löst den Status eines Tages (Montag–Freitag) auf.
 *
 * Priorität: Expliziter WorkDay > Feiertag (gesetzlich/manuell) > Krank > Urlaub > leer.
 * Feiertage, Urlaub und Krankheit sind bezahlte Tage: Soll = Ist = reguläre Sollzeit (an Nicht-Regeltagen 0).
 * Arbeit an einem Feiertag ersetzt ihn und läuft gegen die reguläre Sollzeit.
 * „Überstunden frei“ (Urlaubszeitraum mit kind 'overtime') erzeugt Soll ohne Ist, also Minusstunden –
 * wie ein leerer Tag erst ab dem Tag selbst (nicht im Voraus) und nur ab Kontostart.
 * Urlaub, Überstunden frei und Krankheit gelten nur an regulären Arbeitstagen.
 * Leere reguläre Arbeitstage erzeugen Soll nur zwischen Kontostart und heute.
 */
export function resolveDay(date: ISODate, ctx: CalculationContext): ResolvedDay {
  const regular = isRegularWorkDay(date, ctx.scheduleVersions);
  const regularPlanned = regularPlannedMinutes(date, ctx.scheduleVersions);
  const holiday = holidayOf(date, ctx);
  const vacationPeriod = findPeriod(ctx.vacationPeriods, date);
  const sickPeriod = findPeriod(ctx.sickPeriods, date);

  const base = {
    date,
    regularPlannedMinutes: regularPlanned,
    isRegularWorkDay: regular,
    isMissing: false,
    holiday,
    vacationPeriod,
    sickPeriod,
  };

  const workDay = ctx.workDays.get(date);
  if (workDay) {
    const actual = actualMinutesOf(workDay);
    return {
      ...base,
      status: 'work',
      workDay,
      plannedMinutes: workDay.plannedMinutes,
      actualMinutes: actual,
      differenceMinutes: actual - workDay.plannedMinutes,
    };
  }

  if (holiday) {
    return { ...base, status: 'holiday', plannedMinutes: regularPlanned, actualMinutes: regularPlanned, differenceMinutes: 0 };
  }

  if (regular && sickPeriod) {
    return { ...base, status: 'sick', plannedMinutes: regularPlanned, actualMinutes: regularPlanned, differenceMinutes: 0 };
  }

  const countsAsDue = ctx.trackingStartDate <= date && date <= ctx.today;

  if (regular && vacationPeriod?.kind === 'overtime') {
    const planned = countsAsDue ? regularPlanned : 0;
    return { ...base, status: 'overtimeOff', plannedMinutes: planned, actualMinutes: 0, differenceMinutes: -planned || 0 };
  }

  if (regular && vacationPeriod) {
    return { ...base, status: 'vacation', plannedMinutes: regularPlanned, actualMinutes: regularPlanned, differenceMinutes: 0 };
  }

  if (regular) {
    const planned = countsAsDue ? regularPlanned : 0;
    const isMissing = ctx.trackingStartDate <= date && date < ctx.today;
    return { ...base, status: 'empty', isMissing, plannedMinutes: planned, actualMinutes: 0, differenceMinutes: -planned || 0 };
  }

  return { ...base, status: 'off', plannedMinutes: 0, actualMinutes: 0, differenceMinutes: 0 };
}
