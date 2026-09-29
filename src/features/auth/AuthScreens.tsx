import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/TextField';
import { AUTH_ERROR_TEXT, AuthError, authRepository, type AuthUser } from '../../data/auth/authRepository';
import { normalizeUsername } from '../../data/auth/username';
import { useAuthStore } from './authStore';
import { NewPasswordFields, canSubmitNewPassword } from './NewPasswordFields';

const errorText = (error: unknown) => AUTH_ERROR_TEXT[error instanceof AuthError ? error.code : 'unknown'];

/** Gemeinsamer Rahmen der Anmelde-Bildschirme (ruhig, fokussiert, wie das Onboarding). */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-lg flex-col px-6">
      <div className="pt-14">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-14 rounded-2xl" />
        <h1 className="pt-6 text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="pt-2 text-[17px] leading-relaxed text-ink-2">{subtitle}</p>}
      </div>
      <div className="flex flex-1 flex-col pt-8">{children}</div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  return (
    <p role="alert" aria-live="assertive" className="min-h-6 px-1 text-[15px] text-danger">
      {message}
    </p>
  );
}

export function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = normalizeUsername(username).length > 0 && password.length > 0 && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(normalizeUsername(username), password);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Anmelden" subtitle="Deinen Zugang erhältst du vom Betreiber der App.">
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <div className="space-y-4">
          <TextField
            label="Benutzername"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
          />
          <TextField
            label="Passwort"
            value={password}
            onChange={setPassword}
            revealable
            autoComplete="current-password"
            enterKeyHint="go"
          />
          <ErrorMessage message={error} />
        </div>
        <div className="mt-auto pt-6">
          <Button type="submit" block disabled={!canSubmit}>
            {busy ? 'Anmelden …' : 'Anmelden'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

export function SetInitialPasswordScreen({ user }: { user: AuthUser }) {
  const initialPasswordSet = useAuthStore((s) => s.initialPasswordSet);
  const signOut = useAuthStore((s) => s.signOut);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = canSubmitNewPassword(password, confirmation) && !busy;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await authRepository.setInitialPassword(user.id, password);
      await initialPasswordSet();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Eigenes Passwort festlegen"
      subtitle={
        <>
          Willkommen, <span className="font-semibold text-ink">{user.username}</span>. Ersetze dein Startpasswort
          durch ein eigenes – nur du kennst es.
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-1 flex-col">
        {/* Benutzername für Passwort-Manager, damit das neue Passwort dem richtigen Konto zugeordnet wird */}
        <input type="text" name="username" autoComplete="username" value={user.username} readOnly hidden />
        <NewPasswordFields
          password={password}
          confirmation={confirmation}
          onPasswordChange={setPassword}
          onConfirmationChange={setConfirmation}
        />
        <div className="pt-3">
          <ErrorMessage message={error} />
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-6">
          <Button type="submit" block disabled={!canSubmit}>
            {busy ? 'Speichern …' : 'Passwort speichern'}
          </Button>
          <Button block variant="plain" onClick={() => void signOut()}>
            Abmelden
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

export function ForeignDataScreen({ user }: { user: AuthUser }) {
  const discardForeignData = useAuthStore((s) => s.discardForeignData);
  const signOut = useAuthStore((s) => s.signOut);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const discard = async () => {
    setConfirm(false);
    setBusy(true);
    await discardForeignData();
    setBusy(false);
  };

  return (
    <AuthLayout
      title="Daten eines anderen Kontos"
      subtitle={
        <>
          Auf diesem Gerät sind Arbeitszeiten eines anderen Kontos gespeichert. Du bist als{' '}
          <span className="font-semibold text-ink">{user.username}</span> angemeldet.
        </>
      }
    >
      <p className="text-[15px] leading-relaxed text-ink-2">
        Um fortzufahren, müssen die Daten auf diesem Gerät gelöscht werden. Gehören sie dir unter einem anderen
        Benutzernamen, melde dich ab und mit diesem Konto wieder an.
      </p>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button block variant="secondary" onClick={() => void signOut()} disabled={busy}>
          Abmelden
        </Button>
        <Button block variant="danger" onClick={() => setConfirm(true)} disabled={busy}>
          Gerätedaten löschen und fortfahren
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Gerätedaten endgültig löschen?"
        confirmLabel="Löschen"
        destructive
        onConfirm={() => void discard()}
        onCancel={() => setConfirm(false)}
      >
        Alle auf diesem Gerät gespeicherten Arbeitszeiten, Urlaube und Einstellungen des anderen Kontos werden
        gelöscht. Das kann nicht rückgängig gemacht werden.
      </ConfirmDialog>
    </AuthLayout>
  );
}

export function NotConfiguredScreen() {
  return (
    <AuthLayout
      title="Anmeldung nicht eingerichtet"
      subtitle="Dieser App-Version fehlen die Zugangsdaten zum Server. Bitte wende dich an den Betreiber."
    >
      <span />
    </AuthLayout>
  );
}
