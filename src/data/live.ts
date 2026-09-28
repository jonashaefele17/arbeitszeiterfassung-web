import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Reaktive Abfrage über Repository-Methoden: Die Komponente wird neu gerendert,
 * sobald sich die zugrunde liegenden Daten ändern. Kapselt die Dexie-Reaktivität,
 * damit sie in V2 durch einen API-basierten Mechanismus ersetzt werden kann.
 */
export function useRepositoryQuery<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  return useLiveQuery(query, deps);
}
