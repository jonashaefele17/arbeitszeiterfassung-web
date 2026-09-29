import { AnimatePresence, motion } from 'framer-motion';
import { useState, type FormEvent, type ReactNode } from 'react';
import { repositories } from '../../data/repositories';
import { requestPersistentStorage } from '../../data/storage';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { ChevronLeft } from '../../components/ui/icons';
import { BalancePickerSheet } from '../../components/ui/PickerSheets';
import { transitions } from '../../components/ui/motion';
import { ONBOARDING_STEPS, useOnboardingStore } from '../../stores/onboardingStore';
import { WEEKDAY_LABELS, todayISO, type WeekdayKey } from '../../utils/date';
import { runSafely } from '../../utils/errors';
import { formatBalanceInput } from '../../utils/format';
import { ScheduleDayFields, isScheduleDayValid } from '../schedule/ScheduleDayFields';

const WEEKDAY_ADVERB: Record<WeekdayKey, string> = {
  monday: 'montags',
  tuesday: 'dienstags',
  wednesday: 'mittwochs',
  thursday: 'donnerstags',
  friday: 'freitags',
};

export function OnboardingFlow() {
  const state = useOnboardingStore();
  const step = ONBOARDING_STEPS[state.stepIndex]!;
  const isLast = state.stepIndex === ONBOARDING_STEPS.length - 1;
  const [saving, setSaving] = useState(false);

  const canContinue = (() => {
    switch (step.kind) {
      case 'firstName':
        return state.firstName.trim().length > 0;
      case 'lastName':
        return state.lastName.trim().length > 0;
      case 'weekday':
        return isScheduleDayValid(state.schedule[step.day]);
      case 'vacation':
        return Number.isInteger(state.vacationDaysPerYear) && state.vacationDaysPerYear >= 0;
      case 'vacationCarryover':
        return Number.isInteger(state.vacationCarryoverDays) && state.vacationCarryoverDays >= 0;
      case 'vacationTaken':
        return Number.isInteger(state.vacationTakenDays) && state.vacationTakenDays >= 0;
      case 'balance':
        return true;
    }
  })();

  const finish = async () => {
    setSaving(true);
    const ok = await runSafely(() =>
      repositories.onboarding.complete(
        {
          firstName: state.firstName.trim(),
          lastName: state.lastName.trim(),
          vacationDaysPerYear: state.vacationDaysPerYear,
          initialVacationTakenDays: state.vacationTakenDays,
          initialVacationCarryoverDays: state.vacationCarryoverDays,
          trackingStartDate: todayISO(),
          initialVacationAsOf: todayISO(),
          initialBalanceMinutes: state.initialBalanceMinutes,
        },
        state.schedule,
      ),
    );
    setSaving(false);
    if (ok) void requestPersistentStorage();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canContinue || saving) return;
    if (isLast) void finish();
    else state.next();
  };

  return (
    <form onSubmit={submit} className="safe-top mx-auto flex min-h-dvh max-w-lg flex-col px-6">
      <header className="flex h-12 items-center justify-between">
        <div className="w-11">
          {state.stepIndex > 0 && (
            <IconButton label="Zurück" onClick={state.back} className="-ml-3">
              <ChevronLeft />
            </IconButton>
          )}
        </div>
        <ProgressDots count={ONBOARDING_STEPS.length} active={state.stepIndex} />
        <div className="w-11" />
      </header>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={state.direction}>
          <motion.div
            key={state.stepIndex}
            custom={state.direction}
            variants={{
              enter: (d: number) => ({ x: d * 48, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -48, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transitions.standard}
            className="pt-10"
          >
            <StepContent />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="safe-bottom pt-4">
        <Button type="submit" block disabled={!canContinue || saving}>
          {isLast ? 'Los geht’s' : 'Weiter'}
        </Button>
      </div>
    </form>
  );
}

function StepContent() {
  const state = useOnboardingStore();
  const step = ONBOARDING_STEPS[state.stepIndex]!;

  switch (step.kind) {
    case 'firstName':
      return (
        <Question title="Wie heißt du?">
          <BigInput label="Vorname" value={state.firstName} onChange={state.setFirstName} autoComplete="given-name" />
        </Question>
      );
    case 'lastName':
      return (
        <Question title="Und dein Nachname?">
          <BigInput label="Nachname" value={state.lastName} onChange={state.setLastName} autoComplete="family-name" />
        </Question>
      );
    case 'weekday':
      return (
        <Question title={WEEKDAY_LABELS[step.day]}>
          <ScheduleDayFields
            question={`Arbeitest du ${WEEKDAY_ADVERB[step.day]}?`}
            value={state.schedule[step.day]}
            onChange={(v) => state.setScheduleDay(step.day, v)}
          />
        </Question>
      );
    case 'vacation':
      return (
        <Question title="Wie viele Urlaubstage hast du pro Jahr?">
          <VacationStepper value={state.vacationDaysPerYear} onChange={state.setVacationDays} />
        </Question>
      );
    case 'vacationCarryover':
      return (
        <Question title={`Wie viele Urlaubstage hast du aus ${new Date().getFullYear() - 1} übrig?`}>
          <VacationStepper
            value={state.vacationCarryoverDays}
            onChange={state.setVacationCarryoverDays}
            label="Resturlaub aus dem Vorjahr"
          />
          <p className="pt-6 text-center text-[15px] text-ink-2">
            Resturlaub wird zu deinem Urlaubsanspruch für dieses Jahr addiert.
          </p>
        </Question>
      );
    case 'vacationTaken':
      return (
        <Question title={`Wie viele Urlaubstage hast du ${new Date().getFullYear()} schon genommen?`}>
          <VacationStepper
            value={state.vacationTakenDays}
            onChange={state.setVacationTakenDays}
            label="Bereits genommene Urlaubstage"
          />
          <p className="pt-6 text-center text-[15px] text-ink-2">
            Diese Tage werden von deinem Urlaubskonto für dieses Jahr abgezogen.
          </p>
        </Question>
      );
    case 'balance':
      return <BalanceStep />;
  }
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h1 className="pb-8 text-[32px] font-bold leading-tight tracking-tight">{title}</h1>
      {children}
    </section>
  );
}

interface BigInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}

function BigInput({ label, value, onChange, autoComplete }: BigInputProps) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        autoComplete={autoComplete}
        autoCapitalize="words"
        enterKeyHint="next"
        className="w-full border-b-2 border-line bg-transparent pb-3 text-[28px] font-medium outline-none transition-colors placeholder:text-ink-3 focus:border-accent"
      />
    </label>
  );
}

function VacationStepper({
  value,
  onChange,
  label = 'Urlaubstage pro Jahr',
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  const set = (v: number) => onChange(Math.min(99, Math.max(0, v)));
  return (
    <div className="flex items-center justify-center gap-6 pt-6">
      <StepperButton label="Einen Tag weniger" onClick={() => set(value - 1)}>
        −
      </StepperButton>
      <label className="flex flex-col items-center">
        <span className="sr-only">{label}</span>
        <input
          inputMode="numeric"
          value={Number.isNaN(value) ? '' : String(value)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
            onChange(digits === '' ? Number.NaN : Number(digits));
          }}
          className="tabular w-28 bg-transparent text-center text-[64px] font-semibold outline-none"
        />
        <span className="text-[15px] text-ink-2">Tage</span>
      </label>
      <StepperButton label="Einen Tag mehr" onClick={() => set(value + 1)}>
        +
      </StepperButton>
    </div>
  );
}

function StepperButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.92 }}
      transition={transitions.micro}
      onClick={onClick}
      className="flex size-14 items-center justify-center rounded-full bg-fill text-[28px] text-ink"
    >
      {children}
    </motion.button>
  );
}

function BalanceStep() {
  const { initialBalanceMinutes, setInitialBalance } = useOnboardingStore();
  const [open, setOpen] = useState(false);
  return (
    <Question title="Hast du aktuell Über- oder Minusstunden?">
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={transitions.micro}
        onClick={() => setOpen(true)}
        aria-label={`Überstundenstand ${formatBalanceInput(initialBalanceMinutes)} ändern`}
        className="tabular w-full rounded-2xl bg-surface py-8 text-center text-[44px] font-semibold"
      >
        {formatBalanceInput(initialBalanceMinutes)}
      </motion.button>
      <p className="pt-4 text-[15px] text-ink-2">
        Dein Überstundenkonto startet heute mit diesem Stand. Du kannst ihn später in den Einstellungen ändern.
      </p>
      <BalancePickerSheet
        open={open}
        value={initialBalanceMinutes}
        onChange={setInitialBalance}
        onClose={() => setOpen(false)}
      />
    </Question>
  );
}

function ProgressDots({ count, active }: { count: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`Schritt ${active + 1} von ${count}`} role="img">
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={i}
          animate={{ width: i === active ? 18 : 6, opacity: i <= active ? 1 : 0.35 }}
          transition={transitions.standard}
          className={`block h-1.5 rounded-full ${i <= active ? 'bg-accent' : 'bg-ink-3'}`}
        />
      ))}
    </div>
  );
}
