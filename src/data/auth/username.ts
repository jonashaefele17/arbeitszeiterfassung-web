/**
 * Benutzernamen ↔ interne Anmeldeadresse.
 *
 * Supabase Auth benötigt eine E-Mail-Adresse als Kennung. Wir speichern keine echten
 * Adressen, sondern bilden den Benutzernamen auf eine Kunstadresse ab, an die nie
 * eine Mail geht (Registrierung und E-Mail-Bestätigung sind ausgeschaltet).
 *
 * Wird auch vom Admin-Skript (scripts/admin) importiert – daher ohne weitere Imports.
 */

export const USERNAME_DOMAIN = 'arbeitszeit.local';

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/;

/** Vereinheitlicht die Eingabe (Groß-/Kleinschreibung, Leerzeichen). */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

/** 3–32 Zeichen: Kleinbuchstaben, Ziffern, Punkt, Binde- und Unterstrich; Anfang/Ende alphanumerisch. */
export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  const suffix = `@${USERNAME_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
