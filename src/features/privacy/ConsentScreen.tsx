import { motion } from 'framer-motion';
import { useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { transitions } from '../../components/ui/motion';
import { AUTH_ERROR_TEXT, AuthError, type AuthUser } from '../../data/auth/authRepository';
import { AuthLayout } from '../auth/AuthScreens';
import { useAuthStore } from '../auth/authStore';
import { PrivacyNotice } from './PrivacyNotice';

/**
 * Ausdrückliche Einwilligung zur Speicherung von Gesundheitsdaten (Krankheitstage),
 * bevor Daten mit dem Server synchronisiert werden.
 */
export function ConsentScreen({ user }: { user: AuthUser }) {
  const giveConsent = useAuthStore((s) => s.giveConsent);
  const signOut = useAuthStore((s) => s.signOut);
  const [checked, setChecked] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await giveConsent();
    } catch (e) {
      setError(AUTH_ERROR_TEXT[e instanceof AuthError ? e.code : 'unknown']);
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Deine Daten"
      subtitle={
        <>
          Hallo <span className="font-semibold text-ink">{user.username}</span>, bevor es losgeht: So gehen wir mit
          deinen Daten um.
        </>
      }
    >
      <ul className="space-y-3 text-[15px] leading-relaxed text-ink-2">
        <Point>Gespeichert werden nur deine Arbeitszeiten, Urlaube und Krankheitstage – ohne Diagnosen.</Point>
        <Point>Die Daten werden verschlüsselt übertragen und in einem Rechenzentrum in Frankfurt (EU) gespeichert.</Point>
        <Point>Nur du siehst deine Daten. Dein Arbeitgeber hat keinen Zugriff.</Point>
        <Point>Du kannst deine Daten jederzeit exportieren oder dein Konto samt aller Daten löschen.</Point>
      </ul>
      <button
        type="button"
        onClick={() => setShowNotice(true)}
        className="mt-3 min-h-11 self-start text-[15px] font-semibold text-accent"
      >
        Datenschutzhinweise lesen
      </button>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="text-[15px] leading-relaxed text-ink">
          Ich willige ein, dass meine Arbeitszeiten einschließlich meiner Krankheitstage (Gesundheitsdaten, ohne
          Diagnosen) wie beschrieben gespeichert werden. Ich kann die Einwilligung jederzeit widerrufen.
        </span>
      </label>

      <p role="alert" aria-live="assertive" className="min-h-6 pt-2 text-[15px] text-danger">
        {error}
      </p>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button block disabled={!checked || busy} onClick={() => void submit()}>
          {busy ? 'Wird gespeichert …' : 'Einwilligen und fortfahren'}
        </Button>
        <Button block variant="plain" onClick={() => void signOut()} disabled={busy}>
          Abmelden
        </Button>
      </div>

      <BottomSheet open={showNotice} onClose={() => setShowNotice(false)} label="Datenschutzhinweise">
        <PrivacyNotice />
      </BottomSheet>
    </AuthLayout>
  );
}

function Point({ children }: { children: string }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.standard}
      className="flex gap-3"
    >
      <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </motion.li>
  );
}
