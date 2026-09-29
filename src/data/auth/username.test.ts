import { describe, expect, it } from 'vitest';
import { emailToUsername, isValidUsername, normalizeUsername, usernameToEmail } from './username';

describe('Benutzernamen', () => {
  it('bildet Benutzernamen auf die interne Anmeldeadresse ab und zurück', () => {
    expect(usernameToEmail('anna')).toBe('anna@arbeitszeit.local');
    expect(usernameToEmail('  Anna ')).toBe('anna@arbeitszeit.local');
    expect(emailToUsername('anna@arbeitszeit.local')).toBe('anna');
  });

  it('normalisiert Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(normalizeUsername(' Jonas.H ')).toBe('jonas.h');
  });

  it('prüft das erlaubte Format', () => {
    expect(isValidUsername('anna')).toBe(true);
    expect(isValidUsername('jonas.h')).toBe(true);
    expect(isValidUsername('ab')).toBe(false); // zu kurz
    expect(isValidUsername('anna müller')).toBe(false); // Leerzeichen/Umlaut
    expect(isValidUsername('-anna')).toBe(false); // Sonderzeichen am Anfang
  });
});
