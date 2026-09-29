import { useState, type FormEvent } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/TextField';
import { ValueRow } from '../../components/ui/ValueRow';
import { AUTH_ERROR_TEXT, AuthError, authRepository } from '../../data/auth/authRepository';
import { useToastStore } from '../../stores/toastStore';
import { SettingsSection } from '../settings/SettingsSection';
import { useAuthStore } from './authStore';
import { NewPasswordFields, canSubmitNewPassword } from './NewPasswordFields';

/** Einstellungen → Konto: Benutzername, Passwort ändern, Abmelden. */
export function AccountSection() {
  const auth = useAuthStore((s) => s.state);
  const signOut = useAuthStore((s) => s.signOut);
  const [changing, setChanging] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  if (auth.status !== 'signed-in') return null;
  const { username } = auth.user;

  return (
    <>
      <SettingsSection title="Konto" footer="Deine Daten bleiben beim Abmelden auf diesem Gerät gespeichert.">
        <ValueRow label="Benutzername" value={username} />
        <ValueRow label="Passwort" value="Ändern" onClick={() => setChanging(true)} />
        <button
          type="button"
          onClick={() => setConfirmSignOut(true)}
          className="flex min-h-13 w-full items-center text-left text-[17px] font-medium text-danger"
        >
          Abmelden
        </button>
      </SettingsSection>

      <BottomSheet open={changing} onClose={() => setChanging(false)} label="Passwort ändern">
        {changing && <ChangePasswordForm username={username} onDone={() => setChanging(false)} />}
      </BottomSheet>

      <ConfirmDialog
        open={confirmSignOut}
        title="Abmelden?"
        confirmLabel="Abmelden"
        onConfirm={() => {
          setConfirmSignOut(false);
          void signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      >
        Deine Daten bleiben auf diesem Gerät gespeichert. Zum Weiterarbeiten meldest du dich wieder mit Benutzername
        und Passwort an.
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
