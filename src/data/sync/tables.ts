import type {
  CustomHoliday,
  SickPeriod,
  UserProfile,
  VacationPeriod,
  WorkDay,
  WorkSchedule,
  WorkScheduleVersion,
} from '../../domain/models';
import type { SyncTableName } from '../db/database';

/** Eine Zeile im Serverformat (snake_case, wie in supabase/migrations). */
export type RemoteRow = Record<string, unknown>;

/** Lokale ID des Profils (es gibt genau eins pro Gerät). Am Server ist die Profil-ID = Konto-ID. */
export const LOCAL_PROFILE_ID = 'me';

interface MappingContext {
  userId: string;
}

export interface SyncTableSpec {
  local: SyncTableName;
  remote: string;
  /** Lokale ID → Server-ID. */
  toRemoteId(localId: string, ctx: MappingContext): string;
  /** Server-ID → lokale ID. */
  toLocalId(remoteId: string): string;
  /** Nutzfelder für den Server (ohne id, Sync- und Besitzspalten). */
  toRemote(record: object): RemoteRow;
  /** Serverzeile → lokaler Datensatz. */
  fromRemote(row: RemoteRow): object;
  /** Fachlich eindeutiges Feld pro Person (z. B. ein Arbeitstag pro Datum). */
  uniqueField?: { local: string; remote: string };
}

const identity = (id: string) => id;
const str = (v: unknown) => v as string;
const num = (v: unknown) => Number(v);

const profile: SyncTableSpec = {
  local: 'profile',
  remote: 'profiles',
  toRemoteId: (_id, ctx) => ctx.userId,
  toLocalId: () => LOCAL_PROFILE_ID,
  toRemote: (r) => {
    const p = r as UserProfile;
    return {
      first_name: p.firstName,
      last_name: p.lastName,
      vacation_days_per_year: p.vacationDaysPerYear,
      tracking_start_date: p.trackingStartDate,
      initial_balance_minutes: p.initialBalanceMinutes,
      initial_vacation_as_of: p.initialVacationAsOf ?? null,
      initial_vacation_taken_days: p.initialVacationTakenDays ?? 0,
      initial_vacation_carryover_days: p.initialVacationCarryoverDays ?? 0,
    };
  },
  fromRemote: (row): UserProfile => ({
    id: LOCAL_PROFILE_ID,
    firstName: str(row.first_name),
    lastName: str(row.last_name),
    vacationDaysPerYear: num(row.vacation_days_per_year),
    trackingStartDate: str(row.tracking_start_date),
    initialBalanceMinutes: num(row.initial_balance_minutes),
    ...(row.initial_vacation_as_of ? { initialVacationAsOf: str(row.initial_vacation_as_of) } : {}),
    initialVacationTakenDays: num(row.initial_vacation_taken_days ?? 0),
    initialVacationCarryoverDays: num(row.initial_vacation_carryover_days ?? 0),
  }),
};

const scheduleVersions: SyncTableSpec = {
  local: 'scheduleVersions',
  remote: 'schedule_versions',
  toRemoteId: identity,
  toLocalId: identity,
  toRemote: (r) => {
    const v = r as WorkScheduleVersion;
    return { valid_from: v.validFrom, schedule: v.schedule };
  },
  fromRemote: (row): WorkScheduleVersion => ({
    id: str(row.id),
    validFrom: str(row.valid_from),
    schedule: row.schedule as WorkSchedule,
  }),
};

const workDays: SyncTableSpec = {
  local: 'workDays',
  remote: 'work_days',
  toRemoteId: identity,
  toLocalId: identity,
  toRemote: (r) => {
    const w = r as WorkDay;
    return {
      date: w.date,
      status: w.status,
      start_time: w.start,
      end_time: w.end,
      break_minutes: w.breakMinutes,
      break_start: w.breakMinutes > 0 ? (w.breakStart ?? null) : null,
      planned_minutes: w.plannedMinutes,
    };
  },
  fromRemote: (row): WorkDay => ({
    id: str(row.id),
    date: str(row.date),
    status: 'work',
    start: str(row.start_time),
    end: str(row.end_time),
    breakMinutes: num(row.break_minutes),
    ...(row.break_start ? { breakStart: str(row.break_start) } : {}),
    plannedMinutes: num(row.planned_minutes),
  }),
  uniqueField: { local: 'date', remote: 'date' },
};

const vacationPeriods: SyncTableSpec = {
  local: 'vacationPeriods',
  remote: 'vacation_periods',
  toRemoteId: identity,
  toLocalId: identity,
  toRemote: (r) => {
    const v = r as VacationPeriod;
    return { start_date: v.startDate, end_date: v.endDate, kind: v.kind ?? null };
  },
  fromRemote: (row): VacationPeriod => ({
    id: str(row.id),
    startDate: str(row.start_date),
    endDate: str(row.end_date),
    ...(row.kind === 'overtime' ? { kind: 'overtime' as const } : {}),
  }),
};

const sickPeriods: SyncTableSpec = {
  local: 'sickPeriods',
  remote: 'sick_periods',
  toRemoteId: identity,
  toLocalId: identity,
  toRemote: (r) => {
    const s = r as SickPeriod;
    return { start_date: s.startDate, end_date: s.endDate };
  },
  fromRemote: (row): SickPeriod => ({ id: str(row.id), startDate: str(row.start_date), endDate: str(row.end_date) }),
};

const customHolidays: SyncTableSpec = {
  local: 'customHolidays',
  remote: 'custom_holidays',
  toRemoteId: identity,
  toLocalId: identity,
  toRemote: (r) => ({ date: (r as CustomHoliday).date }),
  fromRemote: (row): CustomHoliday => ({ id: str(row.id), date: str(row.date) }),
  uniqueField: { local: 'date', remote: 'date' },
};

/** Reihenfolge = Upload-Reihenfolge (Profil und Standardwoche zuerst). */
export const SYNC_TABLES: readonly SyncTableSpec[] = [
  profile,
  scheduleVersions,
  workDays,
  vacationPeriods,
  sickPeriods,
  customHolidays,
];

export const SYNC_TABLE_BY_NAME: Record<SyncTableName, SyncTableSpec> = Object.fromEntries(
  SYNC_TABLES.map((t) => [t.local, t]),
) as Record<SyncTableName, SyncTableSpec>;

export const syncKey = (table: SyncTableName, id: string) => `${table}:${id}`;
