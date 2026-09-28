import { repositories } from '../../data/repositories';
import type { DatePeriod, WorkDay } from '../../domain/models';
import { useToastStore } from '../../stores/toastStore';
import { runSafely } from '../../utils/errors';
import type { ISODate } from '../../utils/date';

/**
 * Schreibende Aktionen des Day Editors. Kapseln Repository-Aufrufe, Fehlerbehandlung und Feedback.
 * Rückgabe `true` bei Erfolg.
 */
const success = (message: string) => useToastStore.getState().show(message);

export async function saveWorkDay(workDay: Omit<WorkDay, 'id'> & { id?: string }): Promise<boolean> {
  const ok = await runSafely(() => repositories.workDays.save(workDay));
  if (ok) success('Gespeichert');
  return ok;
}

export async function deleteWorkDay(id: string): Promise<boolean> {
  const ok = await runSafely(() => repositories.workDays.delete(id), 'Löschen fehlgeschlagen. Bitte versuche es erneut.');
  if (ok) success('Eintrag gelöscht');
  return ok;
}

export async function savePeriod(
  kind: 'vacation' | 'sick',
  period: Omit<DatePeriod, 'id'> & { id?: string },
  replaceWorkDayIds: string[],
): Promise<boolean> {
  const repo = kind === 'vacation' ? repositories.vacations : repositories.sickness;
  const ok = await runSafely(() => repo.save(period, replaceWorkDayIds));
  if (ok) success(kind === 'vacation' ? 'Urlaub eingetragen' : 'Krankheit eingetragen');
  return ok;
}

export async function deletePeriod(kind: 'vacation' | 'sick', id: string): Promise<boolean> {
  const repo = kind === 'vacation' ? repositories.vacations : repositories.sickness;
  const ok = await runSafely(() => repo.delete(id), 'Löschen fehlgeschlagen. Bitte versuche es erneut.');
  if (ok) success('Zeitraum entfernt');
  return ok;
}

export async function addCustomHoliday(date: ISODate, replaceWorkDayIds: string[]): Promise<boolean> {
  const ok = await runSafely(() => repositories.customHolidays.add(date, replaceWorkDayIds));
  if (ok) success('Feiertag eingetragen');
  return ok;
}

export async function deleteCustomHoliday(id: string): Promise<boolean> {
  const ok = await runSafely(() => repositories.customHolidays.delete(id), 'Löschen fehlgeschlagen. Bitte versuche es erneut.');
  if (ok) success('Feiertag entfernt');
  return ok;
}
