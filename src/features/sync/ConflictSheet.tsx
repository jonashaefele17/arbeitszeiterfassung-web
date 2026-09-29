import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { transitions } from '../../components/ui/motion';
import type { ConflictChoice } from '../../data/sync/syncEngine';
import { syncService } from '../../data/sync/syncService';
import { useConflicts } from '../../data/sync/useSyncCounts';
import { useToastStore } from '../../stores/toastStore';
import { useUiStore } from '../../stores/uiStore';
import { conflictTitle, describeRecord } from './describeRecord';

/** Hinweisband über dem Inhalt, solange Konflikte offen sind. */
export function ConflictBanner() {
  const conflicts = useConflicts();
  const openConflicts = useUiStore((s) => s.openConflicts);
  const n = conflicts.length;
  return (
    <AnimatePresence initial={false}>
      {n > 0 && (
        <motion.button
          type="button"
          onClick={openConflicts}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={transitions.standard}
          className="block w-full overflow-hidden text-left"
        >
          <span className="mt-3 flex items-center gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-[15px] text-danger">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-danger text-[13px] font-bold text-white">
              !
            </span>
            <span className="flex-1">
              {n === 1 ? '1 Eintrag wurde' : `${n} Einträge wurden`} auf zwei Geräten unterschiedlich geändert.
            </span>
            <span className="font-semibold">Klären</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/**
 * Konflikte nacheinander klären: beide Stände nebeneinander, der Nutzer entscheidet.
 * Es wird nie automatisch überschrieben.
 */
export function ConflictSheet() {
  const open = useUiStore((s) => s.isConflictSheetOpen);
  const close = useUiStore((s) => s.closeConflicts);
  const conflicts = useConflicts();
  const current = conflicts[0];

  // Alle geklärt → Sheet schließen.
  useEffect(() => {
    if (open && conflicts.length === 0) close();
  }, [open, conflicts.length, close]);

  return (
    <BottomSheet open={open && !!current} onClose={close} label="Änderungen klären">
      {current && <ConflictContent key={current.key} conflict={current} remaining={conflicts.length} />}
    </BottomSheet>
  );
}

function ConflictContent({ conflict, remaining }: { conflict: ReturnType<typeof useConflicts>[number]; remaining: number }) {
  const [busy, setBusy] = useState<ConflictChoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const title = conflictTitle(conflict.table, conflict.local ?? conflict.remote);

  const choose = async (choice: ConflictChoice) => {
    setBusy(choice);
    setError(null);
    try {
      await syncService.resolveConflict(conflict.key, choice);
      useToastStore.getState().show(choice === 'local' ? 'Dieser Stand wurde übernommen' : 'Stand des anderen Geräts übernommen');
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'offline'
          ? 'Um den Stand dieses Geräts zu behalten, wird eine Internetverbindung benötigt.'
          : 'Das hat nicht geklappt. Bitte versuche es erneut.',
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={transitions.standard}
      className="pb-2"
    >
      <p className="pt-1 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
        Auf zwei Geräten geändert{remaining > 1 ? ` · noch ${remaining}` : ''}
      </p>
      <h2 className="pt-1 text-[26px] font-bold leading-tight tracking-tight">{title}</h2>
      <p className="pt-2 text-[15px] leading-relaxed text-ink-2">
        Dieser Eintrag wurde auf diesem und einem anderen Gerät unterschiedlich geändert. Welcher Stand soll gelten?
      </p>

      <div className="mt-5 grid gap-3">
        <Version
          label="Dieses Gerät"
          lines={describeRecord(conflict.table, conflict.local)}
          action="Diesen Stand behalten"
          busy={busy === 'local'}
          disabled={busy !== null}
          onChoose={() => void choose('local')}
          primary
        />
        <Version
          label="Anderes Gerät"
          lines={describeRecord(conflict.table, conflict.remote)}
          action="Anderen Stand übernehmen"
          busy={busy === 'remote'}
          disabled={busy !== null}
          onChoose={() => void choose('remote')}
        />
      </div>

      <p role="alert" aria-live="assertive" className="min-h-6 pt-3 text-[15px] text-danger">
        {error}
      </p>
    </motion.div>
  );
}

interface VersionProps {
  label: string;
  lines: string[];
  action: string;
  busy: boolean;
  disabled: boolean;
  primary?: boolean;
  onChoose: () => void;
}

function Version({ label, lines, action, busy, disabled, primary = false, onChoose }: VersionProps) {
  return (
    <section className="rounded-3xl bg-fill p-4" aria-label={label}>
      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">{label}</h3>
      <div className="tabular space-y-0.5 pb-3 pt-1.5 text-[17px] text-ink">
        {lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <Button block variant={primary ? 'primary' : 'secondary'} onClick={onChoose} disabled={disabled} className={primary ? '' : '!bg-surface'}>
        {busy ? 'Wird übernommen …' : action}
      </Button>
    </section>
  );
}
