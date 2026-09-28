import { useState, type ReactNode } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { DatePickerSheet } from '../../components/ui/DatePickerSheet';
import { BalancePickerSheet, NumberPickerSheet } from '../../components/ui/PickerSheets';
import { ValueRow } from '../../components/ui/ValueRow';
import { range } from '../../components/ui/WheelPicker';
import { plannedMinutesOf } from '../../domain/calculations/time';
import type { UserProfile, WorkScheduleDay } from '../../domain/models';
import { scheduleVersionFor } from '../../domain/services/scheduleService';
import { repositories } from '../../data/repositories';
import { useToastStore } from '../../stores/toastStore';
import { WEEKDAY_KEYS, WEEKDAY_LABELS, formatShortDate, type WeekdayKey } from '../../utils/date';
import { runSafely } from '../../utils/errors';
import { formatBalance, formatDayCount, formatDuration } from '../../utils/format';
import { ScheduleDayFields, isScheduleDayValid } from '../schedule/ScheduleDayFields';

const VACATION_VALUES = range(0, 60);

async function updateProfile(changes: Partial<Omit<UserProfile, 'id'>>) {
  const ok = await runSafely(() => repositories.profile.update(changes));
  if (ok) useToastStore.getState().show('Gespeichert');
}

export function SettingsView() {
  const { profile, ctx } = useReadyData();
  const [picker, setPicker] = useState<'vacation' | 'balance' | 'start' | null>(null);
  const [editingDay, setEditingDay] = useState<WeekdayKey | null>(null);
  const [vacationDraft, setVacationDraft] = useState(profile.vacationDaysPerYear);
  const [balanceDraft, setBalanceDraft] = useState(profile.initialBalanceMinutes);
  const [startDraft, setStartDraft] = useState(profile.trackingStartDate);

  const schedule = scheduleVersionFor(ctx.today, ctx.scheduleVersions)?.schedule;

  const openPicker = (p: 'vacation' | 'balance' | 'start') => {
    setVacationDraft(profile.vacationDaysPerYear);
    setBalanceDraft(profile.initialBalanceMinutes);
    setStartDraft(profile.trackingStartDate);
    setPicker(p);
  };

  // Werte werden beim Schließen des Pickers gespeichert.
  const closePicker = () => {
    if (picker === 'vacation' && vacationDraft !== profile.vacationDaysPerYear) {
      void updateProfile({ vacationDaysPerYear: vacationDraft });
    }
    if (picker === 'balance' && balanceDraft !== profile.initialBalanceMinutes) {
      void updateProfile({ initialBalanceMinutes: balanceDraft });
    }
    if (picker === 'start' && startDraft !== profile.trackingStartDate) {
      void updateProfile({ trackingStartDate: startDraft });
    }
    setPicker(null);
  };

  return (
    <div className="space-y-7">
      <PageHeader title="Einstellungen" />

      <Section title="Profil">
        <NameField label="Vorname" value={profile.firstName} onSave={(firstName) => updateProfile({ firstName })} />
        <NameField label="Nachname" value={profile.lastName} onSave={(lastName) => updateProfile({ lastName })} />
      </Section>

      <Section title="Urlaub">
        <ValueRow
          label="Urlaubstage pro Jahr"
          value={formatDayCount(profile.vacationDaysPerYear)}
          onClick={() => openPicker('vacation')}
        />
      </Section>

      <Section
        title="Standardarbeitswoche"
        footer="Änderungen gelten ab heute. Bereits erfasste Tage und vergangene Wochen bleiben unverändert."
      >
        {schedule &&
          WEEKDAY_KEYS.map((key) => (
            <ValueRow
              key={key}
              label={WEEKDAY_LABELS[key]}
              value={describeDay(schedule[key])}
              onClick={() => setEditingDay(key)}
            />
          ))}
      </Section>

      <Section
        title="Überstundenkonto"
        footer="Ab dem Kontostart zählen nicht erfasste Arbeitstage als Minusstunden. Der Startsaldo ist dein Stand zu Beginn."
      >
        <ValueRow label="Kontostart" value={formatShortDate(profile.trackingStartDate)} onClick={() => openPicker('start')} />
        <ValueRow
          label="Startsaldo"
          value={formatBalance(profile.initialBalanceMinutes)}
          onClick={() => openPicker('balance')}
        />
      </Section>

      <NumberPickerSheet
        open={picker === 'vacation'}
        title="Urlaubstage pro Jahr"
        value={vacationDraft}
        values={VACATION_VALUES}
        format={(v) => formatDayCount(v)}
        onChange={setVacationDraft}
        onClose={closePicker}
      />
      <BalancePickerSheet open={picker === 'balance'} value={balanceDraft} onChange={setBalanceDraft} onClose={closePicker} />
      <DatePickerSheet
        open={picker === 'start'}
        title="Kontostart"
        value={startDraft}
        onChange={setStartDraft}
        onClose={closePicker}
      />

      {schedule && (
        <ScheduleDaySheet
          day={editingDay}
          initial={editingDay ? schedule[editingDay] : undefined}
          onClose={() => setEditingDay(null)}
          onSave={async (key, value) => {
            const ok = await runSafely(() =>
              repositories.schedule.saveVersion(ctx.today, { ...schedule, [key]: value }),
            );
            if (ok) {
              useToastStore.getState().show('Gespeichert');
              setEditingDay(null);
            }
          }}
        />
      )}
    </div>
  );
}

function describeDay(day: WorkScheduleDay): string {
  if (!day.isWorkDay) return 'Frei';
  return `${day.start}–${day.end} · ${formatDuration(plannedMinutesOf(day))}`;
}

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
      <div className="divide-y divide-line rounded-3xl bg-surface px-5">{children}</div>
      {footer && <p className="px-1 pt-2 text-[13px] leading-snug text-ink-2">{footer}</p>}
    </section>
  );
}

function NameField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) setDraft(value);
    else if (trimmed !== value) onSave(trimmed);
  };
  return (
    <label className="flex min-h-13 items-center justify-between gap-4">
      <span className="text-[17px] text-ink-2">{label}</span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        autoCapitalize="words"
        className="min-w-0 flex-1 bg-transparent text-right text-[17px] text-ink outline-none focus:text-accent"
      />
    </label>
  );
}

interface ScheduleDaySheetProps {
  day: WeekdayKey | null;
  initial: WorkScheduleDay | undefined;
  onClose: () => void;
  onSave: (day: WeekdayKey, value: WorkScheduleDay) => void | Promise<void>;
}

function ScheduleDaySheet({ day, initial, onClose, onSave }: ScheduleDaySheetProps) {
  return (
    <BottomSheet open={day !== null} onClose={onClose} label={day ? WEEKDAY_LABELS[day] : 'Wochentag'}>
      {day && initial && <ScheduleDayForm key={day} day={day} initial={initial} onSave={onSave} />}
    </BottomSheet>
  );
}

function ScheduleDayForm({
  day,
  initial,
  onSave,
}: {
  day: WeekdayKey;
  initial: WorkScheduleDay;
  onSave: (day: WeekdayKey, value: WorkScheduleDay) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const unchanged = JSON.stringify(value) === JSON.stringify(initial);
  return (
    <div className="pb-2">
      <h2 className="pb-4 pt-1 text-[28px] font-bold tracking-tight">{WEEKDAY_LABELS[day]}</h2>
      <ScheduleDayFields question="Regulärer Arbeitstag" value={value} onChange={setValue} />
      <div className="pt-5">
        <Button
          block
          disabled={busy || unchanged || !isScheduleDayValid(value)}
          onClick={async () => {
            setBusy(true);
            await onSave(day, value);
            setBusy(false);
          }}
        >
          Speichern
        </Button>
      </div>
    </div>
  );
}
