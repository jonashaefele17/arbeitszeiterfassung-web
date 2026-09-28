import { useMemo, useState } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DatePickerSheet } from '../../components/ui/DatePickerSheet';
import { Divider, ValueRow } from '../../components/ui/ValueRow';
import { vacationAccount } from '../../domain/calculations/summary';
import type { ResolvedDay } from '../../domain/models';
import { analyzeAbsence, effectiveDaysOfPeriod } from '../../domain/services/dayService';
import { formatDayMonthShort, formatShortDate } from '../../utils/date';
import { formatDayCount } from '../../utils/format';
import { deletePeriod, deleteWorkDay, savePeriod } from './actions';
import { ConflictList } from './ConflictList';

interface PeriodEditorProps {
  kind: 'vacation' | 'sick';
  day: ResolvedDay;
  onDone: () => void;
}

const TEXT = {
  vacation: { noun: 'Urlaub', days: (n: number) => `${n} ${n === 1 ? 'Urlaubstag' : 'Urlaubstage'}`, add: 'Urlaub eintragen' },
  sick: { noun: 'Krankheit', days: (n: number) => `${n} ${n === 1 ? 'Krankheitstag' : 'Krankheitstage'}`, add: 'Krankheit eintragen' },
} as const;

/**
 * Urlaub oder Krankheit über einen Zeitraum. Liegt der Tag bereits in einem Zeitraum,
 * wird dieser als Ganzes bearbeitet oder entfernt.
 */
export function PeriodEditor({ kind, day, onDone }: PeriodEditorProps) {
  const { ctx, profile } = useReadyData();
  const existing = kind === 'vacation' ? day.vacationPeriod : day.sickPeriod;
  const text = TEXT[kind];

  const [startDate, setStartDate] = useState(existing?.startDate ?? day.date);
  const [endDate, setEndDate] = useState(existing?.endDate ?? day.date);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [dialog, setDialog] = useState<'conflict' | 'remove' | 'restore' | null>(null);
  const [busy, setBusy] = useState(false);

  const analysis = useMemo(
    () =>
      analyzeAbsence(
        { kind, startDate, endDate, existingId: existing?.id, existingRange: existing },
        ctx,
      ),
    [kind, startDate, endDate, existing, ctx],
  );

  const unchanged = existing?.startDate === startDate && existing?.endDate === endDate;
  const isException = existing !== undefined && day.status === 'work';
  const year = Number(startDate.slice(0, 4));
  const account = kind === 'vacation' ? vacationAccount(year, profile.vacationDaysPerYear, ctx) : null;

  const persist = async () => {
    setDialog(null);
    setBusy(true);
    const ok = await savePeriod(
      kind,
      { id: existing?.id, startDate, endDate },
      analysis.conflictingWorkDays.map((w) => w.id),
    );
    setBusy(false);
    if (ok) onDone();
  };

  const save = () => {
    if (analysis.conflictingWorkDays.length > 0) setDialog('conflict');
    else void persist();
  };

  const remove = async () => {
    if (!existing) return;
    setDialog(null);
    if (await deletePeriod(kind, existing.id)) onDone();
  };

  const restore = async () => {
    if (!day.workDay) return;
    setDialog(null);
    if (await deleteWorkDay(day.workDay.id)) onDone();
  };

  return (
    <div>
      <ValueRow label="Von" value={formatShortDate(startDate)} onClick={() => setPicker('start')} />
      <Divider />
      <ValueRow label="Bis" value={formatShortDate(endDate)} onClick={() => setPicker('end')} />
      <Divider />
      <ValueRow label="Gezählt" value={text.days(analysis.effectiveDays)} emphasis />

      <div className="space-y-1 pt-1 text-[15px] text-ink-2" aria-live="polite">
        {analysis.effectiveDays === 0 && <p>Im Zeitraum liegt kein regulärer Arbeitstag.</p>}
        {analysis.notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
        {account && (
          <p>
            Urlaubskonto {account.year}: {formatDayCount(account.remaining)} verbleibend
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-5">
        {isException && (
          <Button block variant="secondary" onClick={() => setDialog('restore')}>
            Diesen Tag wieder als {text.noun}
          </Button>
        )}
        <Button block onClick={save} disabled={busy || analysis.effectiveDays === 0 || unchanged}>
          {existing ? 'Zeitraum speichern' : text.add}
        </Button>
        {existing && (
          <Button block variant="danger" onClick={() => setDialog('remove')}>
            Zeitraum entfernen
          </Button>
        )}
      </div>

      <DatePickerSheet
        open={picker === 'start'}
        title="Von"
        value={startDate}
        rangeEnd={endDate}
        onChange={setStartDate}
        onClose={() => setPicker(null)}
      />
      <DatePickerSheet
        open={picker === 'end'}
        title="Bis"
        value={endDate}
        rangeStart={startDate}
        onChange={setEndDate}
        onClose={() => setPicker(null)}
      />

      <ConfirmDialog
        open={dialog === 'conflict'}
        title="Der Zeitraum enthält bereits Arbeitszeiterfassungen"
        confirmLabel="Ersetzen"
        destructive
        onConfirm={persist}
        onCancel={() => setDialog(null)}
      >
        <ConflictList workDays={analysis.conflictingWorkDays} />
        <p className="pt-3">
          {analysis.conflictingWorkDays.length === 1 ? 'Die bestehende Erfassung wird' : 'Die bestehenden Erfassungen werden'}{' '}
          ersetzt, wenn du {kind === 'vacation' ? 'den Urlaub' : 'die Krankheit'} einträgst.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'remove'}
        title="Zeitraum entfernen?"
        confirmLabel="Entfernen"
        destructive
        onConfirm={remove}
        onCancel={() => setDialog(null)}
      >
        {existing && (
          <>
            {text.noun} {formatDayMonthShort(existing.startDate)}–{formatShortDate(existing.endDate)} ·{' '}
            {text.days(effectiveDaysOfPeriod(kind, existing, ctx))}
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'restore'}
        title={`Diesen Tag wieder als ${text.noun}?`}
        confirmLabel="Arbeitszeit löschen"
        destructive
        onConfirm={restore}
        onCancel={() => setDialog(null)}
      >
        {day.workDay && <ConflictList workDays={[day.workDay]} />}
        <p className="pt-3">Die Arbeitszeiterfassung dieses Tages wird gelöscht.</p>
      </ConfirmDialog>
    </div>
  );
}
