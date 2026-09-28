/** Bittet den Browser, die lokalen Daten nicht automatisch zu löschen. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Nicht kritisch – manche Browser unterstützen die API nicht.
  }
}
