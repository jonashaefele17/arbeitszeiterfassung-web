/**
 * Passwort-Anforderungen. Müssen mit der Supabase-Konfiguration übereinstimmen
 * (Authentication → Passwort: Mindestlänge 8, „Letters and digits“).
 */

export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  id: 'length' | 'letter' | 'digit';
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'letter', label: 'Mindestens ein Buchstabe', test: (p) => /\p{L}/u.test(p) },
  { id: 'digit', label: 'Mindestens eine Ziffer', test: (p) => /\d/.test(p) },
];

export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
