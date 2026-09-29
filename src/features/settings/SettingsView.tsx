import { useState } from 'react';
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
import { formatBalanceInput, formatDayCount, formatDuration } from '../../utils/format';
import { AccountSection } from '../auth/AccountSection';
import { ScheduleDayFields, isScheduleDayValid } from '../schedule/ScheduleDayFields';
import { SettingsSection } from './SettingsSection';
import { SyncBadge } from '../sync/SyncBadge';

const VACATION_VALUES = range(0, 60);

async function updateProfile(changes: Partial<Omit<UserProfile, 'id'>>) {
  const ok = await runSafely(() => repositories.profile.update(changes));
  if (ok) useToastStore.getState().show('Gespeichert');
}

export function SettingsView() {
  const { profile, ctx } = useReadyData();
  const [picker, setPicker] = useState<'vacation' | 'vacationCarryover' | 'vacationTaken' | 'balance' | 'start' | null>(null);
  const [editingDay, setEditingDay] = useState<WeekdayKey | null>(null);
  const [vacationDraft, setVacationDraft] = useState(profile.vacationDaysPerYear);
  const initialTaken = profile.initialVacationTakenDays ?? 0;
  const [takenDraft, setTakenDraft] = useState(initialTaken);
  const initialCarryover = profile.initialVacationCarryoverDays ?? 0;
  const [carryoverDraft, setCarryoverDraft] = useState(initialCarryover);
  const [balanceDraft, setBalanceDraft] = useState(profile.initialBalanceMinutes);
  const [startDraft, setStartDraft] = useState(profile.trackingStartDate);

  // Bezugsjahr der Urlaubs-Startwerte: Stichtag des Onboardings, unabhängig vom späteren Kontostart.
  const vacationAsOf = profile.initialVacationAsOf ?? profile.trackingStartDate;
  const startYear = vacationAsOf.slice(0, 4);
  const schedule = scheduleVersionFor(ctx.today, ctx.scheduleVersions)?.schedule;

  const openPicker = (p: 'vacation' | 'vacationCarryover' | 'vacationTaken' | 'balance' | 'start') => {
    setVacationDraft(profile.vacationDaysPerYear);
    setTakenDraft(initialTaken);
    setCarryoverDraft(initialCarryover);
    setBalanceDraft(profile.initialBalanceMinutes);
    setStartDraft(profile.trackingStartDate);
    setPicker(p);
  };

  // Werte werden beim Schließen des Pickers gespeichert.
  const closePicker = () => {
    if (picker === 'vacation' && vacationDraft !== profile.vacationDaysPerYear) {
      void updateProfile({ vacationDaysPerYear: vacationDraft });
    }
    if (picker === 'vacationCarryover' && carryoverDraft !== initialCarryover) {
      void updateProfile({ initialVacationCarryoverDays: carryoverDraft });
    }
    if (picker === 'vacationTaken' && takenDraft !== initialTaken) {
      void updateProfile({ initialVacationTakenDays: takenDraft });
    }
    if (picker === 'balance' && balanceDraft !== profile.initialBalanceMinutes) {
      void updateProfile({ initialBalanceMinutes: balanceDraft });
    }
    if (picker === 'start' && startDraft !== profile.trackingStartDate) {
      // Alte Profile ohne Stichtag: bisherigen Stichtag festhalten, damit die Urlaubs-Startwerte im Jahr bleiben.
      void updateProfile({
        trackingStartDate: startDraft,
        ...(profile.initialVacationAsOf ? {} : { initialVacationAsOf: profile.trackingStartDate }),
      });
    }
    setPicker(null);
  };

  return (
    <div className="space-y-7">
      <PageHeader title="Einstellungen" accessory={<SyncBadge />} />

      <SettingsSection title="Profil">
        <NameField label="Vorname" value={profile.firstName} onSave={(firstName) => updateProfile({ firstName })} />
        <NameField label="Nachname" value={profile.lastName} onSave={(lastName) => updateProfile({ lastName })} />
      </SettingsSection>

      <SettingsSection
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
      </SettingsSection>

      <SettingsSection
        title="Urlaub"
        footer={`Übrige Urlaubstage werden automatisch ins nächste Jahr übertragen. „Bereits genommen“ sind deine Urlaubstage ${startYear} vor dem ${formatShortDate(vacationAsOf)}.`}
      >
        <ValueRow
          label="Urlaubstage pro Jahr"
          value={formatDayCount(profile.vacationDaysPerYear)}
          onClick={() => openPicker('vacation')}
        />
        <ValueRow
          label={`Resturlaub aus ${Number(startYear) - 1}`}
          value={formatDayCount(initialCarryover)}
          onClick={() => openPicker('vacationCarryover')}
        />
        <ValueRow
          label="Bereits genommen"
          value={formatDayCount(initialTaken)}
          onClick={() => openPicker('vacationTaken')}
        />
      </SettingsSection>

      <SettingsSection
        title="Überstundenkonto"
        footer="Ab dem Kontostart zählen nicht erfasste Arbeitstage als Minusstunden. Der Startsaldo ist dein Stand zu Beginn."
      >
        <ValueRow label="Kontostart" value={formatShortDate(profile.trackingStartDate)} onClick={() => openPicker('start')} />
        <ValueRow
          label="Startsaldo"
          value={formatBalanceInput(profile.initialBalanceMinutes)}
          onClick={() => openPicker('balance')}
        />
      </SettingsSection>

      <AccountSection />

      <NumberPickerSheet
        open={picker === 'vacation'}
        title="Urlaubstage pro Jahr"
        value={vacationDraft}
        values={VACATION_VALUES}
        format={(v) => formatDayCount(v)}
        onChange={setVacationDraft}
        onClose={closePicker}
      />
      <NumberPickerSheet
        open={picker === 'vacationCarryover'}
        title={`Resturlaub aus ${Number(startYear) - 1}`}
        value={carryoverDraft}
        values={VACATION_VALUES}
        format={(v) => formatDayCount(v)}
        onChange={setCarryoverDraft}
        onClose={closePicker}
      />
      <NumberPickerSheet
        open={picker === 'vacationTaken'}
        title={`Bereits genommen (${startYear})`}
        value={takenDraft}
        values={VACATION_VALUES}
        format={(v) => formatDayCount(v)}
        onChange={setTakenDraft}
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
