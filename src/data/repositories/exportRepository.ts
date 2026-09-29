import { db } from '../db/database';

/**
 * Vollständiger Export der eigenen Daten (DSGVO: Recht auf Auskunft/Datenübertragbarkeit).
 * Enthält alle Nutzdaten dieses Kontos im lesbaren JSON-Format.
 */
export const exportRepository = {
  async exportAll(username: string) {
    const [profile, scheduleVersions, workDays, vacationPeriods, sickPeriods, customHolidays, pending] =
      await Promise.all([
        db.profile.toArray(),
        db.scheduleVersions.orderBy('validFrom').toArray(),
        db.workDays.orderBy('date').toArray(),
        db.vacationPeriods.orderBy('startDate').toArray(),
        db.sickPeriods.orderBy('startDate').toArray(),
        db.customHolidays.orderBy('date').toArray(),
        db.outbox.count(),
      ]);
    return {
      format: 'arbeitszeit-export',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      username,
      /** Änderungen, die zum Exportzeitpunkt noch nicht mit dem Konto synchronisiert waren. */
      unsyncedChanges: pending,
      profile: profile[0] ?? null,
      scheduleVersions,
      workDays,
      vacationPeriods,
      sickPeriods,
      customHolidays,
    };
  },
};
