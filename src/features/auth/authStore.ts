import { create } from 'zustand';
import { authRepository, type AuthUser } from '../../data/auth/authRepository';
import { deviceRepository } from '../../data/repositories/deviceRepository';
import { useUiStore } from '../../stores/uiStore';

export type AuthState =
  | { status: 'loading' }
  | { status: 'not-configured' }
  | { status: 'signed-out' }
  /** Startpasswort muss ersetzt werden. */
  | { status: 'must-change-password'; user: AuthUser }
  /** Auf dem Gerät liegen Daten eines anderen Kontos. */
  | { status: 'foreign-data'; user: AuthUser }
  | { status: 'signed-in'; user: AuthUser };

interface AuthStore {
  state: AuthState;
  init: () => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  initialPasswordSet: () => Promise<void>;
  discardForeignData: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Laufende Auflösungen werden durchnummeriert; nur das Ergebnis der jüngsten zählt.
let resolveRun = 0;

/**
 * Anmeldezustand der App. Reihenfolge: Sitzung → Startpasswort ersetzt? → gehören die
 * lokalen Daten zu diesem Konto? → angemeldet. Bestehende Gerätedaten ohne Zuordnung
 * (V1.1) werden beim ersten Login dem Konto zugeordnet.
 */
export const useAuthStore = create<AuthStore>((set, get) => {
  async function resolve(user: AuthUser | null) {
    const run = ++resolveRun;
    const apply = (state: AuthState) => {
      if (run === resolveRun) set({ state });
    };
    if (!user) return apply({ status: 'signed-out' });
    if (await authRepository.mustChangePassword(user.id)) return apply({ status: 'must-change-password', user });
    const owner = await deviceRepository.getLocalOwner();
    if (owner && owner !== user.id && (await deviceRepository.hasLocalData())) {
      return apply({ status: 'foreign-data', user });
    }
    if (owner !== user.id) await deviceRepository.setLocalOwner(user.id);
    apply({ status: 'signed-in', user });
  }

  let unsubscribe: (() => void) | undefined;

  return {
    state: { status: 'loading' },

    init: async () => {
      if (!authRepository.isConfigured()) return set({ state: { status: 'not-configured' } });
      unsubscribe?.();
      unsubscribe = authRepository.onSignedOut(() => void resolve(null));
      await resolve(await authRepository.getCurrentUser());
    },

    signIn: async (username, password) => {
      const user = await authRepository.signIn(username, password);
      // Nach dem Anmelden immer mit der Übersicht der aktuellen Woche starten.
      useUiStore.getState().setTab('overview');
      useUiStore.getState().goToToday();
      await resolve(user);
    },

    initialPasswordSet: async () => {
      const current = get().state;
      if ('user' in current) await resolve(current.user);
    },

    discardForeignData: async () => {
      const current = get().state;
      if (current.status !== 'foreign-data') return;
      await deviceRepository.clearAll();
      await resolve(current.user);
    },

    signOut: async () => {
      await authRepository.signOut();
      await resolve(null);
    },
  };
});
