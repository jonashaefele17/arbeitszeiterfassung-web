import { useToastStore } from '../stores/toastStore';

const DEFAULT_MESSAGE = 'Speichern fehlgeschlagen. Bitte versuche es erneut.';

/**
 * Führt eine Datenoperation aus und zeigt bei Fehlern eine verständliche Meldung.
 * Gibt `true` zurück, wenn die Operation erfolgreich war.
 */
export async function runSafely(action: () => Promise<void>, errorMessage = DEFAULT_MESSAGE): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    console.error(error);
    useToastStore.getState().show(errorMessage, 'error');
    return false;
  }
}
