import { motion } from 'framer-motion';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import type { AuthUser } from '../../data/auth/authRepository';
import { syncService } from '../../data/sync/syncService';
import { AuthLayout } from '../auth/AuthScreens';
import { useAuthStore } from '../auth/authStore';

type GateState = 'checking' | 'decision' | 'need-online' | 'ready';

/**
 * Erster Abgleich des Kontos auf diesem Gerät, bevor die App ihre Daten zeigt
 * (sonst würde z. B. das Onboarding erscheinen, obwohl das Konto schon Daten hat).
 */
export function SyncGate({ user, children }: { user: AuthUser; children: ReactNode }) {
  const [state, setState] = useState<GateState>('checking');

  const run = useCallback(async () => {
    setState('checking');
    try {
      const result = await syncService.bootstrap(user.id);
      if (result === 'needs-decision') return setState('decision');
      syncService.start(user.id);
      setState('ready');
    } catch (error) {
      console.warn('Erster Abgleich fehlgeschlagen', error);
      setState('need-online');
    }
  }, [user.id]);

  useEffect(() => {
    void run();
    return () => syncService.stop();
  }, [run]);

  if (state === 'ready') return <>{children}</>;
  if (state === 'checking') return <Checking />;
  if (state === 'decision') return <DecisionScreen user={user} onDone={() => void run()} />;
  return <NeedOnlineScreen onRetry={() => void run()} />;
}

function Checking() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <motion.span
        aria-hidden
        className="size-8 rounded-full border-[3px] border-accent/20 border-t-accent"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-[15px] text-ink-2"
      >
        Daten werden abgeglichen …
      </motion.p>
    </div>
  );
}

function NeedOnlineScreen({ onRetry }: { onRetry: () => void }) {
  const signOut = useAuthStore((s) => s.signOut);
  return (
    <AuthLayout
      title="Internet benötigt"
      subtitle="Für den ersten Abgleich deines Kontos auf diesem Gerät wird eine Internetverbindung benötigt. Danach funktioniert die App auch offline."
    >
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button block onClick={onRetry}>
          Erneut versuchen
        </Button>
        <Button block variant="plain" onClick={() => void signOut()}>
          Abmelden
        </Button>
      </div>
    </AuthLayout>
  );
}

function DecisionScreen({ user, onDone }: { user: AuthUser; onDone: () => void }) {
  const signOut = useAuthStore((s) => s.signOut);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useAccount = async () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    try {
      await syncService.useAccountData(user.id);
      onDone();
    } catch {
      setError('Die Kontodaten konnten nicht geladen werden. Bitte prüfe deine Internetverbindung.');
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Daten auf Gerät und im Konto"
      subtitle="Auf diesem Gerät und in deinem Konto sind bereits Arbeitszeiten gespeichert. Sie werden nicht automatisch zusammengeführt."
    >
      <p className="text-[15px] leading-relaxed text-ink-2">
        Mit „Kontodaten verwenden“ lädst du den Stand aus deinem Konto. Die bisher nur auf diesem Gerät gespeicherten
        Daten werden dabei verworfen.
      </p>
      {error && (
        <p role="alert" className="pt-3 text-[15px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button block onClick={() => setConfirm(true)} disabled={busy}>
          {busy ? 'Wird geladen …' : 'Kontodaten verwenden'}
        </Button>
        <Button block variant="plain" onClick={() => void signOut()} disabled={busy}>
          Abmelden
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Gerätedaten verwerfen?"
        confirmLabel="Kontodaten verwenden"
        destructive
        onConfirm={() => void useAccount()}
        onCancel={() => setConfirm(false)}
      >
        Die nur auf diesem Gerät gespeicherten Arbeitszeiten, Urlaube und Einstellungen werden gelöscht und durch den
        Stand aus deinem Konto ersetzt.
      </ConfirmDialog>
    </AuthLayout>
  );
}
