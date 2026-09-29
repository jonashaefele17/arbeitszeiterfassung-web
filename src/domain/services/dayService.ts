import type { DatePeriod, DayStatus, ResolvedDay, VacationPeriod, WorkDay } from '../models';
import { eachWorkWeekDay, type ISODate } from '../../utils/date';
import type { CalculationContext } from '../calculations/context';
import { resolveDay } from '../calculations/resolveDay';
import type { TimeRange } from '../calculations/time';
import { isRegularWorkDay, regularPlannedMinutes, scheduleDayFor } from './scheduleService';

export type AbsenceKind = 'vacation' | 'sick' | 'holiday';

const FALLBACK_TEMPLATE: TimeRange = { start: '08:00', end: '12:00', breakMinutes: 0 };

/**
 * Vorlage beim erstmaligen Erfassen von Arbeit.
 * Die Sollzeit wird beim Speichern eingefroren: die reguläre Sollzeit (auch an Feiertagen, die Arbeit
 * ersetzt den Feiertag), an Nicht-Arbeitstagen 0.
 */
export function workTemplateFor(
  date: ISODate,
  ctx: CalculationContext,
): TimeRange & { plannedMinutes: number } {
  const scheduleDay = scheduleDayFor(date, ctx.scheduleVersions);
  const range: TimeRange = scheduleDay?.isWorkDay
    ? { start: scheduleDay.start, end: scheduleDay.end, breakMinutes: scheduleDay.breakMinutes }
    : FALLBACK_TEMPLATE;
  return { ...range, plannedMinutes: plannedMinutesForNewWorkDay(date, ctx) };
}

export function plannedMinutesForNewWorkDay(date: ISODate, ctx: CalculationContext): number {
  return regularPlannedMinutes(date, ctx.scheduleVersions);
}

export interface AbsencePlan {
  kind: AbsenceKind;
  startDate: ISODate;
  endDate: ISODate;
  /** Beim Bearbeiten eines bestehenden Zeitraums: dessen ID. */
  existingId?: string;
  /**
   * Bisheriger Zeitraum beim Bearbeiten. Arbeitserfassungen darin sind bewusste Ausnahmen
   * und bleiben erhalten – sie gelten nicht als Konflikt.
   */
  existingRange?: { startDate: ISODate; endDate: ISODate };
  /** Nur bei `kind: 'vacation'`: `'overtime'` = frei auf Überstunden statt Urlaub. */
  vacationKind?: 'overtime';
}

/** Status, den ein Tag durch diesen Eintrag erhält. */
function targetStatus(plan: Pick<AbsencePlan, 'kind' | 'vacationKind'>): DayStatus {
  return plan.kind === 'vacation' && plan.vacationKind === 'overtime' ? 'overtimeOff' : plan.kind;
}

const DAY_NOUN: Partial<Record<DayStatus, string>> = {
  vacation: 'Urlaubstag',
  overtimeOff: 'Tag Überstunden frei',
  sick: 'Krankheitstag',
};

export interface AbsenceAnalysis {
  /** Arbeitserfassungen, die durch den Eintrag ersetzt (gelöscht) würden. */
  conflictingWorkDays: WorkDay[];
  /** Tage, die nach dem Speichern tatsächlich diesen Status tragen. */
  effectiveDays: number;
  /** Hinweise zu Überschneidungen (keine Datenverluste). */
  notes: string[];
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Prüft einen geplanten Urlaub/Krank-Zeitraum oder manuellen Feiertag auf Konflikte,
 * ohne Daten zu verändern.
 */
export function analyzeAbsence(plan: AbsencePlan, ctx: CalculationContext): AbsenceAnalysis {
  const days = eachWorkWeekDay(plan.startDate, plan.endDate);
  const before = new Map<ISODate, ResolvedDay>(days.map((d) => [d, resolveDay(d, ctx)]));

  const conflictingWorkDays = days
    .map((d) => ctx.workDays.get(d))
    .filter((w): w is WorkDay => {
      if (!w) return false;
      const r = plan.existingRange;
      if (r && r.startDate <= w.date && w.date <= r.endDate) return false;
      return plan.kind === 'holiday' || isRegularWorkDay(w.date, ctx.scheduleVersions);
    });

  const simulated = applyPlan(plan, ctx, conflictingWorkDays);
  const after = days.map((d) => resolveDay(d, simulated));
  const target = targetStatus(plan);
  const effectiveDays = after.filter((d) => d.status === target).length;

  const notes: string[] = [];
  if (plan.kind !== 'holiday') {
    const holidays = after.filter((d) => d.status === 'holiday' && d.isRegularWorkDay).length;
    if (holidays > 0) {
      notes.push(
        `${plural(holidays, 'Feiertag liegt', 'Feiertage liegen')} im Zeitraum und ${holidays === 1 ? 'zählt' : 'zählen'} nicht als ${DAY_NOUN[target]}.`,
      );
    }
  }
  if (plan.kind === 'vacation') {
    const sick = after.filter((d) => d.status === 'sick').length;
    if (sick > 0) notes.push(`${plural(sick, 'Tag bleibt', 'Tage bleiben')} als Krankheit erfasst.`);
  }
  if (plan.kind === 'sick') {
    const converted = after.filter((d) => d.status === 'sick' && before.get(d.date)?.status === 'vacation').length;
    if (converted > 0) {
      notes.push(`${plural(converted, 'Urlaubstag wird', 'Urlaubstage werden')} dem Urlaubskonto gutgeschrieben.`);
    }
    const fromOvertime = after.filter((d) => d.status === 'sick' && before.get(d.date)?.status === 'overtimeOff').length;
    if (fromOvertime > 0) {
      notes.push(`${plural(fromOvertime, 'Tag', 'Tage')} Überstunden frei ${fromOvertime === 1 ? 'wird' : 'werden'} stattdessen als Krankheit gezählt.`);
    }
  }
  if (plan.kind === 'holiday') {
    const affected = after[0];
    const prior = before.get(plan.startDate);
    const noun = prior ? DAY_NOUN[prior.status] : undefined;
    if (affected && noun) notes.push(`Der Tag zählt dann nicht mehr als ${noun}.`);
  }

  return { conflictingWorkDays, effectiveDays, notes };
}

function applyPlan(
  plan: AbsencePlan,
  ctx: CalculationContext,
  removedWorkDays: readonly WorkDay[],
): CalculationContext {
  const workDays = new Map(ctx.workDays);
  for (const w of removedWorkDays) workDays.delete(w.date);

  if (plan.kind === 'holiday') {
    const customHolidays = new Map(ctx.customHolidays);
    customHolidays.set(plan.startDate, { id: plan.existingId ?? 'planned', date: plan.startDate });
    return { ...ctx, workDays, customHolidays };
  }

  const period: VacationPeriod = { id: plan.existingId ?? 'planned', startDate: plan.startDate, endDate: plan.endDate };
  if (plan.kind === 'vacation' && plan.vacationKind) period.kind = plan.vacationKind;
  const replace = (list: DatePeriod[]) => [...list.filter((p) => p.id !== plan.existingId), period];
  return plan.kind === 'vacation'
    ? { ...ctx, workDays, vacationPeriods: replace(ctx.vacationPeriods) }
    : { ...ctx, workDays, sickPeriods: replace(ctx.sickPeriods) };
}

/** Anzahl der Tage eines bestehenden Zeitraums, die aktuell diesen Status tragen. */
export function effectiveDaysOfPeriod(
  kind: 'vacation' | 'sick',
  period: VacationPeriod,
  ctx: CalculationContext,
): number {
  const target = targetStatus({ kind, vacationKind: period.kind });
  return eachWorkWeekDay(period.startDate, period.endDate)
    .map((d) => resolveDay(d, ctx))
    .filter((d) => d.status === target && (kind === 'vacation' ? d.vacationPeriod : d.sickPeriod)?.id === period.id)
    .length;
}
