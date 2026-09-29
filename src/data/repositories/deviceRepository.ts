import { db } from '../db/database';

const LOCAL_OWNER = 'localOwnerUserId';

/**
 * Gerätebezogene Daten: Welchem Konto gehören die lokal gespeicherten Daten?
 * Schützt davor, dass ein anderes Konto auf demselben Gerät fremde Daten sieht.
 */
export const deviceRepository = {
  async getLocalOwner(): Promise<string | undefined> {
    return (await db.meta.get(LOCAL_OWNER))?.value;
  },

  async setLocalOwner(userId: string): Promise<void> {
    await db.meta.put({ key: LOCAL_OWNER, value: userId });
  },

  /** Gibt es lokal Nutzdaten (Profil oder Einträge)? */
  async hasLocalData(): Promise<boolean> {
    const counts = await Promise.all([
      db.profile.count(),
      db.workDays.count(),
      db.vacationPeriods.count(),
      db.sickPeriods.count(),
      db.customHolidays.count(),
    ]);
    return counts.some((c) => c > 0);
  },

  /** Löscht alle lokalen Nutzdaten und Metadaten dieses Geräts. */
  async clearAll(): Promise<void> {
    await db.transaction(
      'rw',
      [db.profile, db.scheduleVersions, db.workDays, db.vacationPeriods, db.sickPeriods, db.customHolidays, db.meta],
      async () => {
        await Promise.all([
          db.profile.clear(),
          db.scheduleVersions.clear(),
          db.workDays.clear(),
          db.vacationPeriods.clear(),
          db.sickPeriods.clear(),
          db.customHolidays.clear(),
          db.meta.clear(),
        ]);
      },
    );
  },
};

export type DeviceRepository = typeof deviceRepository;
