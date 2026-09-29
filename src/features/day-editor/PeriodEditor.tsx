import { LayoutGroup, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DatePickerSheet } from '../../components/ui/DatePickerSheet';
import { Divider, ValueRow } from '../../components/ui/ValueRow';
import { transitions } from '../../components/ui/motion';
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

type Variant = 'vacation' | 'overtime' | 'sick';

const TEXT: Record<Variant, { noun: string; days: (n: number) => string; add: string; accusative: string }> = {
  vacation: {
    noun: 'Urlaub',
    days: (n) => `${n} ${n === 1 ? 'Urlaubstag' : 'Urlaubstage'}`,
    add: 'Urlaub eintragen',
    accusative: 'den Urlaub',
  },
  overtime: {
    noun: 'Überstunden frei',
    days: (n) => `${formatDayCount(n)} Überstunden frei`,
    add: 'Überstunden frei eintragen',
    accusative: 'die freien Tage',
  },
  sick: {
    noun: 'Krankheit',
    days: (n) => `${n} ${n === 1 ? 'Krankheitstag' : 'Krankheitstage'}`,
    add: 'Krankheit eintragen',
    accusative: 'die Krankheit',
  },
};

/**
 * Urlaub, Überstunden frei oder Krankheit über einen Zeitraum. Liegt der Tag bereits in einem Zeitraum,
 * wird dieser als Ganzes bearbeitet oder entfernt.
 */
export function PeriodEditor({ kind, day, onDone }: PeriodEditorProps) {
  const { ctx, profile } = useReadyData();
  const existing = kind === 'vacation' ? day.vacationPeriod : day.sickPeriod;
  const existingVariant: Variant = kind === 'sick' ? 'sick' : day.vacationPeriod?.kind === 'overtime' ? 'overtime' : 'vacation';

  const [variant, setVariant] = useState<Variant>(existingVariant);
  const [startDate, setStartDate] = useState(existing?.startDate ?? day.date);
  const [endDate, setEndDate] = useState(existing?.endDate ?? day.date);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [dialog, setDialog] = useState<'conflict' | 'remove' | 'restore' | null>(null);
  const [busy, setBusy] = useState(false);

  const text = TEXT[variant];
  const vacationKind = variant === 'overtime' ? ('overtime' as const) : undefined;

  const analysis = useMemo(
    () =>
      analyzeAbsence(
        { kind, vacationKind, startDate, endDate, existingId: existing?.id, existingRange: existing },
        ctx,
      ),
    [kind, vacationKind, startDate, endDate, existing, ctx],
  );

  const unchanged =
    existing?.startDate === startDate && existing?.endDate === endDate && variant === existingVariant;
  const isException = existing !== undefined && day.status === 'work';
  const year = Number(startDate.slice(0, 4));
  const account = variant === 'vacation' ? vacationAccount(year, profile.vacationDaysPerYear, ctx) : null;

  const persist = async () => {
    setDialog(null);
    setBusy(true);
    const ok = await savePeriod(
      kind,
      { id: existing?.id, startDate, endDate, ...(vacationKind ? { kind: vacationKind } : {}) },
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

  const existingText = TEXT[existingVariant];

  return (
    <div>
      {kind === 'vacation' && <VariantToggle value={variant} onChange={setVariant} />}

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
        {variant === 'overtime' && <p>Die Sollzeit wird von deinem Überstundenkonto abgezogen.</p>}
      </div>

      <div className="flex flex-col gap-2 pt-5">
        {isException && (
          <Button block variant="secondary" onClick={() => setDialog('restore')}>
            Diesen Tag wieder als {existingText.noun}
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
          ersetzt, wenn du {text.accusative} einträgst.
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
            {existingText.noun} {formatDayMonthShort(existing.startDate)}–{formatShortDate(existing.endDate)} ·{' '}
            {existingText.days(effectiveDaysOfPeriod(kind, existing, ctx))}
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'restore'}
        title={`Diesen Tag wieder als ${existingText.noun}?`}
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

const VARIANTS: { id: 'vacation' | 'overtime'; label: string }[] = [
  { id: 'vacation', label: 'Urlaub' },
  { id: 'overtime', label: 'Überstunden frei' },
];

/** Umschalter zwischen regulärem Urlaub und einem freien Tag auf Überstunden. */
function VariantToggle({ value, onChange }: { value: Variant; onChange: (v: Variant) => void }) {
  return (
    <LayoutGroup id="vacation-variant">
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-fill p-1" role="radiogroup" aria-label="Art der Abwesenheit">
        {VARIANTS.map((v) => {
          const active = v.id === value;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(v.id)}
              className={`relative min-h-10 rounded-lg text-[15px] font-medium transition-colors ${
                active ? 'text-ink' : 'text-ink-2'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="vacation-variant-active"
                  transition={transitions.layout}
                  className="absolute inset-0 rounded-lg bg-surface shadow-sm"
                />
              )}
              <span className="relative">{v.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
