import Dexie, { type EntityTable } from 'dexie';
import type {
  CustomHoliday,
  SickPeriod,
  UserProfile,
  VacationPeriod,
  WorkDay,
  WorkScheduleVersion,
} from '../../domain/models';
import { publicHolidayName } from '../../domain/holidays/bavaria';
import { regularPlannedMinutes, sortVersions } from '../../domain/services/scheduleService';

export interface MetaEntry {
  key: string;
  value: string;
}

/** Lokale Tabellen, die mit dem Server synchronisiert werden. */
export type SyncTableName =
  | 'profile'
  | 'scheduleVersions'
  | 'workDays'
  | 'vacationPeriods'
  | 'sickPeriods'
  | 'customHolidays';

/** Ausstehende lokale Änderung (pro Datensatz zusammengefasst). */
export interface OutboxEntry {
  /** `${table}:${id}` */
  key: string;
  table: SyncTableName;
  id: string;
  /** Wechselt bei jeder Änderung – so erkennt der Sync Änderungen während des Hochladens. */
  stamp: string;
}

/** Zuletzt bekannte Serverversion eines Datensatzes (Basis der Konflikterkennung). */
export interface RecordVersion {
  key: string;
  version: number;
}

/** Festgehaltener Konflikt: lokal und am Server unterschiedlich geändert. */
export interface SyncConflict {
  key: string;
  table: SyncTableName;
  /** ID des lokalen Datensatzes. */
  id: string;
  /** Serverzeile zum Zeitpunkt der Erkennung (im Serverformat), `null` = am Server nicht vorhanden. */
  remote: Record<string, unknown> | null;
  detectedAt: string;
}

/**
 * Lokale Datenbank. Ausschließlich innerhalb von `src/data` verwenden –
 * alle anderen Schichten greifen über Repositories zu.
 */
export class AppDatabase extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>;
  scheduleVersions!: EntityTable<WorkScheduleVersion, 'id'>;
  workDays!: EntityTable<WorkDay, 'id'>;
  vacationPeriods!: EntityTable<VacationPeriod, 'id'>;
  sickPeriods!: EntityTable<SickPeriod, 'id'>;
  customHolidays!: EntityTable<CustomHoliday, 'id'>;
  /** Geräte-Metadaten (z. B. welchem Konto die lokalen Daten gehören). */
  meta!: EntityTable<MetaEntry, 'key'>;
  outbox!: EntityTable<OutboxEntry, 'key'>;
  recordVersions!: EntityTable<RecordVersion, 'key'>;
  conflicts!: EntityTable<SyncConflict, 'key'>;

  constructor() {
    super('arbeitszeit');
    this.version(1).stores({
      profile: 'id',
      scheduleVersions: 'id, validFrom',
      workDays: 'id, &date',
      vacationPeriods: 'id, startDate, endDate',
      sickPeriods: 'id, startDate, endDate',
      customHolidays: 'id, &date',
    });

    // V1.1: Arbeit an Feiertagen läuft gegen die reguläre Sollzeit (vorher 0).
    this.version(2).stores({}).upgrade(async (tx) => {
      const versions = sortVersions(await tx.table<WorkScheduleVersion>('scheduleVersions').toArray());
      const customDates = new Set(
        (await tx.table<CustomHoliday>('customHolidays').toArray()).map((h) => h.date),
      );
      await tx
        .table<WorkDay>('workDays')
        .filter((w) => w.plannedMinutes === 0 && (customDates.has(w.date) || !!publicHolidayName(w.date)))
        .modify((w) => {
          w.plannedMinutes = regularPlannedMinutes(w.date, versions);
        });
    });

    // V2: Geräte-Metadaten (Konto-Zuordnung der lokalen Daten, später Sync-Stand).
    this.version(3).stores({ meta: 'key' });

    // V2 Etappe 3: Synchronisierung (Warteschlange, Serverversionen, Konflikte).
    this.version(4).stores({ outbox: 'key, table', recordVersions: 'key', conflicts: 'key' });
  }
}

export const db = new AppDatabase();
