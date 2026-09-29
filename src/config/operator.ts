/**
 * Angaben zum Betreiber für die Datenschutzhinweise.
 * Werden als Build-Variablen gesetzt (GitHub → Settings → Variables bzw. `.env.local`):
 *   VITE_OPERATOR_NAME     z. B. „Jonas Mustermann“
 *   VITE_OPERATOR_CONTACT  z. B. eine E-Mail-Adresse oder Telefonnummer
 * Fehlen sie, zeigt die App einen neutralen Hinweis auf den Betreiber.
 */
export const OPERATOR = {
  name: (import.meta.env.VITE_OPERATOR_NAME as string | undefined)?.trim() || null,
  contact: (import.meta.env.VITE_OPERATOR_CONTACT as string | undefined)?.trim() || null,
};
