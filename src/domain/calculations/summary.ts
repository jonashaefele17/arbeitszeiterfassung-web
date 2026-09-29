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
    overtimeOffDays: 0,
    missingDays: 0,
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
    else if (day.status === 'overtimeOff') summary.overtimeOffDays++;
    else if (day.status === 'work') summary.workDays++;
    if (day.isMissing) summary.missingDays++;
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
  /** Resturlaub aus dem Vorjahr. */
  carryover: number;
  taken: number;
  remaining: number;
}

/**
 * In einem Jahr genommene Urlaubstage. Im Bezugsjahr der Startwerte: angegebener Wert
 * + App-Einträge ab dem Stichtag (davor ist durch den Startwert abgedeckt).
 */
function vacationTaken(year: number, refYear: number, ctx: CalculationContext): number {
  const isRefYear = year === refYear;
  const from = isRefYear ? ctx.initialVacationAsOf : `${year}-01-01`;
  const inApp = resolveRange(from, `${year}-12-31`, ctx).filter((d) => d.status === 'vacation').length;
  return inApp + (isRefYear ? ctx.initialVacationTakenDays : 0);
}

/**
 * Urlaubskonto pro Kalenderjahr: Anspruch + Resturlaub aus dem Vorjahr − genommen.
 * Resturlaub wird unbegrenzt übertragen (nie negativ). Die Startwerte (Resturlaub, bereits genommen)
 * gehören fest zum Jahr ihres Stichtags – auch wenn der Kontostart später verschoben wird.
 */
export function vacationAccount(year: number, entitlement: number, ctx: CalculationContext): VacationAccount {
  const refYear = Number(ctx.initialVacationAsOf.slice(0, 4));
  let carryover = year >= refYear ? ctx.initialVacationCarryoverDays : 0;
  for (let y = refYear; y < year; y++) {
    carryover = Math.max(0, entitlement + carryover - vacationTaken(y, refYear, ctx));
  }
  const taken = vacationTaken(year, refYear, ctx);
  return { year, entitlement, carryover, taken, remaining: entitlement + carryover - taken };
}
