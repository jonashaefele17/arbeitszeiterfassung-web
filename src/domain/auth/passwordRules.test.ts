import { describe, expect, it } from 'vitest';
import { PASSWORD_RULES, isPasswordValid } from './passwordRules';

describe('Passwort-Regeln', () => {
  it('verlangt mindestens 8 Zeichen, einen Buchstaben und eine Ziffer', () => {
    expect(isPasswordValid('abcdefg1')).toBe(true);
    expect(isPasswordValid('Sommer2026')).toBe(true);
    expect(isPasswordValid('abc1')).toBe(false); // zu kurz
    expect(isPasswordValid('abcdefgh')).toBe(false); // keine Ziffer
    expect(isPasswordValid('12345678')).toBe(false); // kein Buchstabe
  });

  it('akzeptiert Umlaute als Buchstaben', () => {
    expect(isPasswordValid('bärenstark7')).toBe(true);
  });

  it('meldet jede Regel einzeln', () => {
    const failed = PASSWORD_RULES.filter((r) => !r.test('abc')).map((r) => r.id);
    expect(failed).toEqual(['length', 'digit']);
  });
});
