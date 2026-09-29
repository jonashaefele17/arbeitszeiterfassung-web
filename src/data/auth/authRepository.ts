import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { emailToUsername, usernameToEmail } from './username';

export interface AuthUser {
  id: string;
  username: string;
}

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'wrong-current-password'
  | 'same-password'
  | 'weak-password'
  | 'offline'
  | 'not-configured'
  | 'unknown';

/** Fachlicher Fehler ohne technische Details – die UI zeigt dazu einen verständlichen Text. */
export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
  }
}

export const AUTH_ERROR_TEXT: Record<AuthErrorCode, string> = {
  'invalid-credentials': 'Benutzername oder Passwort ist falsch.',
  'wrong-current-password': 'Das aktuelle Passwort ist falsch.',
  'same-password': 'Das neue Passwort muss sich vom bisherigen unterscheiden.',
  'weak-password': 'Das Passwort erfüllt die Anforderungen nicht.',
  offline: 'Keine Internetverbindung. Bitte versuche es erneut, sobald du online bist.',
  'not-configured': 'Die Anmeldung ist in dieser Version nicht eingerichtet.',
  unknown: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
};

function toAuthError(error: unknown, fallback: AuthErrorCode = 'unknown'): AuthError {
  if (error instanceof AuthError) return error;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return new AuthError('offline');
  const e = error as Partial<SupabaseAuthError> & { name?: string; message?: string };
  if (e?.name === 'AuthRetryableFetchError' || e?.message?.includes('Failed to fetch')) return new AuthError('offline');
  if (e?.code === 'invalid_credentials') return new AuthError('invalid-credentials');
  if (e?.code === 'same_password') return new AuthError('same-password');
  if (e?.code === 'weak_password') return new AuthError('weak-password');
  console.error(error);
  return new AuthError(fallback);
}

function client() {
  if (!supabase) throw new AuthError('not-configured');
  return supabase;
}

function toUser(user: { id: string; email?: string | null }): AuthUser {
  return { id: user.id, username: emailToUsername(user.email ?? '') };
}

const mustChangeCacheKey = (userId: string) => `arbeitszeit.mustChangePassword.${userId}`;

/** Bricht eine Anfrage nach `ms` ab, damit langsame Netze den App-Start nicht blockieren. */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Anmeldung und Konto. Die UI kennt nur diese Schnittstelle – nicht Supabase.
 * Die Sitzung wird lokal gespeichert und automatisch erneuert (auch offline lesbar).
 */
export const authRepository = {
  isConfigured(): boolean {
    return supabase !== null;
  },

  /** Aktuelle Sitzung aus dem lokalen Speicher – funktioniert auch offline. */
  async getCurrentUser(): Promise<AuthUser | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session ? toUser(data.session.user) : null;
  },

  /**
   * Meldet Abmeldungen von außen (z. B. Sitzung abgelaufen/widerrufen, Abmelden in einem anderen Tab).
   * Gibt eine Funktion zum Beenden des Abos zurück.
   */
  onSignedOut(callback: () => void): () => void {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') callback();
    });
    return () => data.subscription.unsubscribe();
  },

  async signIn(username: string, password: string): Promise<AuthUser> {
    try {
      const { data, error } = await client().auth.signInWithPassword({ email: usernameToEmail(username), password });
      if (error) throw error;
      return toUser(data.user);
    } catch (error) {
      throw toAuthError(error);
    }
  },

  /** Meldet nur dieses Gerät ab; funktioniert auch offline. */
  async signOut(): Promise<void> {
    if (!supabase) return;
    await supabase.auth.signOut({ scope: 'local' });
  },

  /**
   * Muss das Startpasswort ersetzt werden? Online vom Server, offline aus dem letzten bekannten Stand.
   */
  async mustChangePassword(userId: string): Promise<boolean> {
    const cached = () => localStorage.getItem(mustChangeCacheKey(userId)) === 'true';
    // Offline nicht auf den Server warten (der Client wiederholt fehlgeschlagene Anfragen sonst mehrfach).
    if (!navigator.onLine) return cached();
    try {
      const { data, error } = await withTimeout(
        client().from('account_status').select('must_change_password').maybeSingle(),
        3000,
      );
      if (error) throw error;
      const value = data?.must_change_password ?? false;
      localStorage.setItem(mustChangeCacheKey(userId), String(value));
      return value;
    } catch {
      return cached();
    }
  },

  /** Ersetzt das Startpasswort (Nutzer ist bereits damit angemeldet). */
  async setInitialPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const { error } = await client().auth.updateUser({ password: newPassword });
      if (error) throw error;
      const done = await client().rpc('complete_password_change');
      if (done.error) throw done.error;
      localStorage.setItem(mustChangeCacheKey(userId), 'false');
    } catch (error) {
      throw toAuthError(error);
    }
  },

  /** Passwort ändern; das aktuelle Passwort wird vorher geprüft. */
  async changePassword(username: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const check = await client().auth.signInWithPassword({ email: usernameToEmail(username), password: currentPassword });
      if (check.error) {
        throw check.error.code === 'invalid_credentials' ? new AuthError('wrong-current-password') : check.error;
      }
      const { error } = await client().auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (error) {
      throw toAuthError(error);
    }
  },
};
