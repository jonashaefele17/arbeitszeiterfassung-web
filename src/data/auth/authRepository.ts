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

export interface AccountStatus {
  mustChangePassword: boolean;
  hasConsent: boolean;
}

const DEFAULT_STATUS: AccountStatus = { mustChangePassword: false, hasConsent: false };
const statusCacheKey = (userId: string) => `arbeitszeit.accountStatus.${userId}`;

function cacheStatus(userId: string, patch: Partial<AccountStatus>): void {
  try {
    const current = JSON.parse(localStorage.getItem(statusCacheKey(userId)) ?? '{}') as Partial<AccountStatus>;
    localStorage.setItem(statusCacheKey(userId), JSON.stringify({ ...current, ...patch }));
  } catch {
    // Speicher nicht verfügbar – der Status wird beim nächsten Online-Start neu geladen.
  }
}

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
   * Kontostatus (Startpasswort aktiv? Einwilligung erteilt?). Online vom Server,
   * offline aus dem letzten bekannten Stand – der App-Start wartet nie auf das Netz.
   */
  async accountStatus(userId: string): Promise<AccountStatus> {
    const cached = (): AccountStatus => {
      try {
        return { ...DEFAULT_STATUS, ...JSON.parse(localStorage.getItem(statusCacheKey(userId)) ?? '{}') };
      } catch {
        return DEFAULT_STATUS;
      }
    };
    // Offline nicht auf den Server warten (der Client wiederholt fehlgeschlagene Anfragen sonst mehrfach).
    if (!navigator.onLine) return cached();
    try {
      const { data, error } = await withTimeout(
        client().from('account_status').select('must_change_password, health_data_consent_at').maybeSingle(),
        3000,
      );
      if (error) throw error;
      const status: AccountStatus = {
        mustChangePassword: data?.must_change_password ?? false,
        hasConsent: !!data?.health_data_consent_at,
      };
      cacheStatus(userId, status);
      return status;
    } catch {
      return cached();
    }
  },

  /** Einwilligung zur Speicherung von Krankheitstagen erteilen (braucht Internet). */
  async giveConsent(userId: string): Promise<void> {
    try {
      const { error } = await client().rpc('give_health_data_consent');
      if (error) throw error;
      cacheStatus(userId, { hasConsent: true });
    } catch (error) {
      throw toAuthError(error);
    }
  },

  /** Eigenes Konto samt aller Daten am Server endgültig löschen (braucht Internet). */
  async deleteAccount(userId: string): Promise<void> {
    try {
      const { error } = await client().rpc('delete_own_account');
      if (error) throw error;
      localStorage.removeItem(statusCacheKey(userId));
      await client().auth.signOut({ scope: 'local' });
    } catch (error) {
      throw toAuthError(error);
    }
  },

  /** Ersetzt das Startpasswort (Nutzer ist bereits damit angemeldet). */
  async setInitialPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const { error } = await client().auth.updateUser({ password: newPassword });
      if (error) throw error;
      const done = await client().rpc('complete_password_change');
      if (done.error) throw done.error;
      cacheStatus(userId, { mustChangePassword: false });
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
