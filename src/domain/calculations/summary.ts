import type { MonthlySummary, ResolvedDay } from '../models';
import {
  addDays,
  eachWorkWeekDay,
  firstOfMonth,
  lastOfMonth,
  type ISODate,
  type YearMonth,
} from '../../utils/date';
import type { CalculationContext } from './context';
import { resolveDay } from './resolveDay';

export function resolveRange(start: ISODate, end: ISODate, ctx: CalculationContext): ResolvedDay[] {
  return eachWorkWeekDay(start, end).map((d) => resolveDay(d, ctx));
}

export function resolveMonth(ym: YearMonth, ctx: CalculationContext): ResolvedDay[] {
  return resolveRange(firstOfMonth(ym), lastOfMonth(ym), ctx);
}

/** Summiert Tage. Werte zählen erst ab dem Kontostart. */
export function summarize(days: readonly ResolvedDay[], ctx: CalculationContext): MonthlySummary {
  const summary: MonthlySummary = {
    plannedMinutes: 0,
    actualMinutes: 0,
    balanceMinutes: 0,
    vacationDays: 0,
    sickDays: 0,
    holidayDays: 0,
    workDays: 0,
  };
  for (const day of days) {
    if (day.date < ctx.trackingStartDate) continue;
    summary.plannedMinutes += day.plannedMinutes;
    summary.actualMinutes += day.actualMinutes;
    summary.balanceMinutes += day.differenceMinutes;
    if (day.status === 'vacation') summary.vacationDays++;
    else if (day.status === 'sick') summary.sickDays++;
    else if (day.status === 'holiday') summary.holidayDays++;
    else if (day.status === 'work') summary.workDays++;
  }
  return summary;
}

export function summarizeMonth(ym: YearMonth, ctx: CalculationContext): MonthlySummary {
  return summarize(resolveMonth(ym, ctx), ctx);
}

export interface BalanceSnapshot {
  /** Kontostand vor dem Monat. */
  previousMinutes: number;
  /** Saldo des Monats. */
  monthMinutes: number;
  /** Kontostand am Ende des Monats. */
  currentMinutes: number;
}

/**
 * Fortlaufendes Überstundenkonto: Startsaldo + Summe aller Tagesdifferenzen ab Kontostart.
 * Nichts wird persistiert, alles wird aus den Rohdaten berechnet.
 */
export function balanceForMonth(ym: YearMonth, ctx: CalculationContext): BalanceSnapshot {
  const monthStart = firstOfMonth(ym);
  const monthEnd = lastOfMonth(ym);

  let previous = ctx.initialBalanceMinutes;
  if (ctx.trackingStartDate < monthStart) {
    const before = resolveRange(ctx.trackingStartDate, addDays(monthStart, -1), ctx);
    previous += summarize(before, ctx).balanceMinutes;
  }
  const monthMinutes = summarize(resolveRange(monthStart, monthEnd, ctx), ctx).balanceMinutes;
  return { previousMinutes: previous, monthMinutes, currentMinutes: previous + monthMinutes };
}

export interface VacationAccount {
  year: number;
  entitlement: number;
  taken: number;
  remaining: number;
}

/** Urlaubskonto pro Kalenderjahr. Zählt alle Tage mit aufgelöstem Status „Urlaub“. */
export function vacationAccount(year: number, entitlement: number, ctx: CalculationContext): VacationAccount {
  const taken = resolveRange(`${year}-01-01`, `${year}-12-31`, ctx).filter(
    (d) => d.status === 'vacation',
  ).length;
  return { year, entitlement, taken, remaining: entitlement - taken };
}
