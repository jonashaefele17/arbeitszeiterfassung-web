import { useMemo } from 'react';
import { repositories } from '../data/repositories';
import { useRepositoryQuery } from '../data/live';
import { buildContext, type CalculationContext } from '../domain/calculations/context';
import type { UserProfile } from '../domain/models';
import { useToday } from './useToday';

export type AppData =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'onboarding' }
  | { status: 'ready'; profile: UserProfile; ctx: CalculationContext };

/**
 * Lädt alle Rohdaten reaktiv und baut den Berechnungskontext.
 * Die Datenmenge eines Einzelnutzers ist klein – alle Berechnungen laufen im Speicher.
 */
export function useAppData(): AppData {
  const today = useToday();
  const raw = useRepositoryQuery(async () => {
    try {
      const [profile, scheduleVersions, workDays, vacationPeriods, sickPeriods, customHolidays] = await Promise.all([
        repositories.profile.get(),
        repositories.schedule.getAll(),
        repositories.workDays.getAll(),
        repositories.vacations.getAll(),
        repositories.sickness.getAll(),
        repositories.customHolidays.getAll(),
      ]);
      return { profile: profile ?? null, scheduleVersions, workDays, vacationPeriods, sickPeriods, customHolidays };
    } catch (error) {
      console.error(error);
      return null;
    }
  });

  return useMemo<AppData>(() => {
    if (raw === undefined) return { status: 'loading' };
    if (raw === null) return { status: 'error' };
    const { profile } = raw;
    if (!profile || raw.scheduleVersions.length === 0) return { status: 'onboarding' };
    return { status: 'ready', profile, ctx: buildContext({ ...raw, profile }, today) };
  }, [raw, today]);
}
