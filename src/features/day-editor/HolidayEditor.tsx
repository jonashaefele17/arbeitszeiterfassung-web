import { useMemo, useState } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { publicHolidayName } from '../../domain/holidays/bavaria';
import type { ResolvedDay } from '../../domain/models';
import { analyzeAbsence } from '../../domain/services/dayService';
import { addCustomHoliday, deleteCustomHoliday } from './actions';
import { ConflictList } from './ConflictList';

interface HolidayEditorProps {
  day: ResolvedDay;
  onDone: () => void;
}

/** Gesetzlicher Feiertag (Info), manueller Feiertag (entfernen) oder neuen Feiertag setzen. */
export function HolidayEditor({ day, onDone }: HolidayEditorProps) {
  const { ctx } = useReadyData();
  const [dialog, setDialog] = useState<'conflict' | 'remove' | null>(null);
  const [busy, setBusy] = useState(false);
  const publicName = publicHolidayName(day.date);
  const custom = day.holiday?.source === 'custom' ? day.holiday : undefined;

  const analysis = useMemo(
    () => analyzeAbsence({ kind: 'holiday', startDate: day.date, endDate: day.date }, ctx),
    [day.date, ctx],
  );

  if (publicName && !custom) {
    return (
      <div className="pb-2">
        <p className="text-[20px] font-semibold">{publicName}</p>
        <p className="pt-1 text-[15px] text-ink-2">
          Gesetzlicher Feiertag in Bayern – ohne Sollzeit.
          {day.status === 'work' && ' Da du an diesem Tag gearbeitet hast, zählt deine Arbeitszeit.'}
        </p>
      </div>
    );
  }

  const persist = async () => {
    setDialog(null);
    setBusy(true);
    const ok = await addCustomHoliday(day.date, analysis.conflictingWorkDays.map((w) => w.id));
    setBusy(false);
    if (ok) onDone();
  };

  const remove = async () => {
    if (!custom?.customId) return;
    setDialog(null);
    if (await deleteCustomHoliday(custom.customId)) onDone();
  };

  if (custom) {
    return (
      <div>
        <p className="text-[20px] font-semibold">Manueller Feiertag</p>
        <p className="pt-1 text-[15px] text-ink-2">Dieser Tag zählt ohne Sollzeit.</p>
        <div className="pt-5">
          <Button block variant="danger" onClick={() => setDialog('remove')}>
            Feiertag entfernen
          </Button>
        </div>
        <ConfirmDialog
          open={dialog === 'remove'}
          title="Feiertag entfernen?"
          confirmLabel="Entfernen"
          destructive
          onConfirm={remove}
          onCancel={() => setDialog(null)}
        >
          Der Tag zählt danach wieder als normaler Tag.
        </ConfirmDialog>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[15px] text-ink-2">
        Der Tag wird als Feiertag eingetragen – ohne Sollzeit, ohne Arbeitszeit.
      </p>
      {analysis.notes.map((n) => (
        <p key={n} className="pt-1 text-[15px] text-ink-2">
          {n}
        </p>
      ))}
      <div className="pt-5">
        <Button
          block
          disabled={busy}
          onClick={() => (analysis.conflictingWorkDays.length > 0 ? setDialog('conflict') : void persist())}
        >
          Als Feiertag eintragen
        </Button>
      </div>
      <ConfirmDialog
        open={dialog === 'conflict'}
        title="Der Tag enthält bereits eine Arbeitszeiterfassung"
        confirmLabel="Ersetzen"
        destructive
        onConfirm={persist}
        onCancel={() => setDialog(null)}
      >
        <ConflictList workDays={analysis.conflictingWorkDays} />
        <p className="pt-3">Die bestehende Erfassung wird ersetzt, wenn du den Feiertag einträgst.</p>
      </ConfirmDialog>
    </div>
  );
}
