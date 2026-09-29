import { useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/TextField';
import { ValueRow } from '../../components/ui/ValueRow';
import { AUTH_ERROR_TEXT, AuthError, authRepository } from '../../data/auth/authRepository';
import { syncService } from '../../data/sync/syncService';
import { useToastStore } from '../../stores/toastStore';
import { useSyncBadgeState } from '../sync/SyncBadge';
import { SettingsSection } from '../settings/SettingsSection';
import { useAuthStore } from './authStore';
import { NewPasswordFields, canSubmitNewPassword } from './NewPasswordFields';

type SignOutDialog = null | { kind: 'safe' } | { kind: 'unsynced'; count: number };

/** Einstellungen → Konto: Benutzername, Sync-Stand, Passwort ändern, Abmelden. */
export function AccountSection() {
  const auth = useAuthStore((s) => s.state);
  const signOut = useAuthStore((s) => s.signOut);
  const sync = useSyncBadgeState();
  const [changing, setChanging] = useState(false);
  const [dialog, setDialog] = useState<SignOutDialog>(null);
  const [checking, setChecking] = useState(false);

  if (auth.status !== 'signed-in') return null;
  const { username } = auth.user;

  /** Vor dem Abmelden möglichst alles hochladen, dann je nach Stand fragen. */
  const requestSignOut = async () => {
    setChecking(true);
    if (navigator.onLine) await syncService.syncNow();
    const count = await syncService.unsyncedCount();
    setChecking(false);
    setDialog(count === 0 ? { kind: 'safe' } : { kind: 'unsynced', count });
  };

  const syncAndRetry = async () => {
    setDialog(null);
    await requestSignOut();
  };

  const confirmSignOut = () => {
    setDialog(null);
    void signOut({ discardLocalData: true });
  };

  return (
    <>
      <SettingsSection title="Konto">
        <ValueRow label="Benutzername" value={username} />
        <div className="flex min-h-13 items-center justify-between gap-4">
          <span className="text-[17px] text-ink-2">Synchronisierung</span>
          <span className={`text-right text-[15px] ${sync.state === 'conflict' ? 'text-danger' : 'text-ink'}`}>
            {sync.text}
          </span>
        </div>
        <ValueRow label="Passwort" value="Ändern" onClick={() => setChanging(true)} />
        <button
          type="button"
          onClick={() => void requestSignOut()}
          disabled={checking}
          className="flex min-h-13 w-full items-center text-left text-[17px] font-medium text-danger disabled:opacity-50"
        >
          {checking ? 'Wird geprüft …' : 'Abmelden'}
        </button>
      </SettingsSection>

      <BottomSheet open={changing} onClose={() => setChanging(false)} label="Passwort ändern">
        {changing && <ChangePasswordForm username={username} onDone={() => setChanging(false)} />}
      </BottomSheet>

      <ConfirmDialog
        open={dialog?.kind === 'safe'}
        title="Abmelden?"
        confirmLabel="Abmelden"
        onConfirm={confirmSignOut}
        onCancel={() => setDialog(null)}
      >
        Deine Daten sind in deinem Konto gesichert und werden von diesem Gerät entfernt. Beim nächsten Anmelden werden
        sie wieder geladen{navigator.onLine ? '' : ' – dafür brauchst du dann eine Internetverbindung'}.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'unsynced'}
        title="Nicht alle Änderungen sind gesichert"
        confirmLabel="Trotzdem abmelden"
        destructive
        onConfirm={confirmSignOut}
        onCancel={() => setDialog(null)}
      >
        {dialog?.kind === 'unsynced' && (
          <>
            <p>
              {dialog.count === 1 ? '1 Änderung ist' : `${dialog.count} Änderungen sind`} noch nicht in deinem Konto
              gespeichert. Wenn du dich jetzt abmeldest, {dialog.count === 1 ? 'geht sie' : 'gehen sie'} verloren.
            </p>
            {navigator.onLine && (
              <button
                type="button"
                onClick={() => void syncAndRetry()}
                className="mt-3 min-h-11 font-semibold text-accent"
              >
                Erneut synchronisieren
              </button>
            )}
          </>
        )}
      </ConfirmDialog>
    </>
  );
}

function ChangePasswordForm({ username, onDone }: { username: string; onDone: () => void }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = current.length > 0 && canSubmitNewPassword(password, confirmation) && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await authRepository.changePassword(username, current, password);
      useToastStore.getState().show('Passwort geändert');
      onDone();
    } catch (err) {
      setError(AUTH_ERROR_TEXT[err instanceof AuthError ? err.code : 'unknown']);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <h2 className="pt-1 text-[28px] font-bold tracking-tight">Passwort ändern</h2>
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
      <TextField
        label="Aktuelles Passwort"
        value={current}
        onChange={setCurrent}
        revealable
        autoComplete="current-password"
      />
      <NewPasswordFields
        password={password}
        confirmation={confirmation}
        onPasswordChange={setPassword}
        onConfirmationChange={setConfirmation}
      />
      <p role="alert" aria-live="assertive" className="min-h-6 px-1 text-[15px] text-danger">
        {error}
      </p>
      <Button type="submit" block disabled={!canSubmit}>
        {busy ? 'Speichern …' : 'Passwort ändern'}
      </Button>
    </form>
  );
}
