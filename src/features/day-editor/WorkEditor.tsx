import { useState } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { BREAK_VALUES, NumberPickerSheet, TimePickerSheet } from '../../components/ui/PickerSheets';
import { Divider, ValueRow } from '../../components/ui/ValueRow';
import {
  TIME_RANGE_ERROR_TEXT,
  actualMinutesOf,
  changeRange,
  validateTimeRange,
  withFittingBreakStart,
  type TimeRange,
} from '../../domain/calculations/time';
import type { ResolvedDay } from '../../domain/models';
import { plannedMinutesForNewWorkDay, workTemplateFor } from '../../domain/services/dayService';
import { formatBalance, formatBreak, formatDuration } from '../../utils/format';
import { BreakStartRow } from '../schedule/BreakStartRow';
import { deleteWorkDay, saveWorkDay } from './actions';

type Picker = 'start' | 'end' | 'break' | null;

interface WorkEditorProps {
  day: ResolvedDay;
  onDone: () => void;
}

/**
 * Arbeitszeit erfassen oder ändern. Neue Tage übernehmen die Standardzeiten des Wochentags,
 * gespeichert wird erst nach Bestätigung.
 */
export function WorkEditor({ day, onDone }: WorkEditorProps) {
  const { ctx } = useReadyData();
  const existing = day.workDay;
  const [draft, setDraft] = useState<TimeRange>(() =>
    existing
      ? // Ältere Einträge ohne Pausenbeginn bekommen einen Vorschlag (gespeichert erst mit „Speichern“).
        withFittingBreakStart({
          start: existing.start,
          end: existing.end,
          breakMinutes: existing.breakMinutes,
          breakStart: existing.breakStart,
        })
      : workTemplateFor(day.date, ctx),
  );
  // Selbst gewählter Pausenbeginn wird bei Änderungen von Beginn/Ende nicht mehr verschoben.
  const [breakPinned, setBreakPinned] = useState(() => !!existing?.breakStart);
  const change = (patch: Partial<TimeRange>) => setDraft((d) => changeRange(d, patch, breakPinned));
  const [picker, setPicker] = useState<Picker>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sollzeit: bei bestehenden Einträgen die damals gespeicherte, sonst die heute gültige.
  const plannedMinutes = existing?.plannedMinutes ?? plannedMinutesForNewWorkDay(day.date, ctx);
  const error = validateTimeRange(draft);
  const actual = actualMinutesOf(draft);
  const unchanged =
    existing !== undefined &&
    existing.start === draft.start &&
    existing.end === draft.end &&
    existing.breakMinutes === draft.breakMinutes &&
    existing.breakStart === draft.breakStart;

  const save = async () => {
    if (error || busy) return;
    setBusy(true);
    const ok = await saveWorkDay({ id: existing?.id, date: day.date, status: 'work', ...draft, plannedMinutes });
    setBusy(false);
    if (ok) onDone();
  };

  const remove = async () => {
    if (!existing) return;
    setConfirmDelete(false);
    if (await deleteWorkDay(existing.id)) onDone();
  };

  return (
    <div>
      <ValueRow label="Beginn" value={draft.start} onClick={() => setPicker('start')} />
      <Divider />
      <ValueRow
        label="Ende"
        value={draft.end}
        onClick={() => setPicker('end')}
        invalid={error === 'end-before-start' || error === 'break-too-long'}
      />
      <Divider />
      <ValueRow label="Pause" value={formatBreak(draft.breakMinutes)} onClick={() => setPicker('break')} />
      <BreakStartRow
        breakMinutes={draft.breakMinutes}
        breakStart={draft.breakStart}
        invalid={error === 'break-outside'}
        onChange={(breakStart) => {
          setBreakPinned(true);
          setDraft((d) => ({ ...d, breakStart }));
        }}
      />
      <Divider />
      <ValueRow label="Arbeitszeit" value={error ? '–' : formatDuration(actual)} emphasis />

      <p className="tabular min-h-6 pt-1 text-[15px] text-ink-2" aria-live="polite">
        {error ? (
          <span className="text-danger">{TIME_RANGE_ERROR_TEXT[error]}</span>
        ) : (
          <>
            Soll {formatDuration(plannedMinutes)} · Differenz {formatBalance(actual - plannedMinutes)}
          </>
        )}
      </p>

      <div className="flex flex-col gap-2 pt-5">
        <Button block onClick={save} disabled={!!error || busy || unchanged}>
          Speichern
        </Button>
        {existing && (
          <Button block variant="danger" onClick={() => setConfirmDelete(true)}>
            Eintrag löschen
          </Button>
        )}
      </div>

      <TimePickerSheet
        open={picker === 'start'}
        title="Beginn"
        value={draft.start}
        onChange={(start) => change({ start })}
        onClose={() => setPicker(null)}
      />
      <TimePickerSheet
        open={picker === 'end'}
        title="Ende"
        value={draft.end}
        onChange={(end) => change({ end })}
        onClose={() => setPicker(null)}
      />
      <NumberPickerSheet
        open={picker === 'break'}
        title="Pause"
        value={draft.breakMinutes}
        values={BREAK_VALUES}
        format={formatBreak}
        onChange={(breakMinutes) => change({ breakMinutes })}
        onClose={() => setPicker(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Eintrag löschen?"
        confirmLabel="Löschen"
        destructive
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        {existing && (
          <>
            Arbeit · {existing.start}–{existing.end} · {formatDuration(actualMinutesOf(existing))}
            {fallbackHint(day)}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** Hinweis, worauf der Tag nach dem Löschen zurückfällt. */
function fallbackHint(day: ResolvedDay): string {
  if (day.holiday) return ' – danach gilt wieder der Feiertag.';
  if (day.isRegularWorkDay && day.sickPeriod) return ' – danach gilt der Tag wieder als Krank.';
  if (day.isRegularWorkDay && day.vacationPeriod) return ' – danach gilt der Tag wieder als Urlaub.';
  return '';
}
