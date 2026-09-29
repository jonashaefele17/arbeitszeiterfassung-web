import { create } from 'zustand';
import type { WorkSchedule, WorkScheduleDay } from '../domain/models';
import { DEFAULT_SCHEDULE, DEFAULT_VACATION_DAYS } from '../domain/models/defaults';
import { WEEKDAY_KEYS, type WeekdayKey } from '../utils/date';

export type OnboardingStep =
  | { kind: 'firstName' }
  | { kind: 'lastName' }
  | { kind: 'weekday'; day: WeekdayKey }
  | { kind: 'vacation' }
  | { kind: 'vacationCarryover' }
  | { kind: 'vacationTaken' }
  | { kind: 'balance' };

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { kind: 'firstName' },
  { kind: 'lastName' },
  ...WEEKDAY_KEYS.map((day) => ({ kind: 'weekday', day }) as const),
  { kind: 'vacation' },
  { kind: 'vacationCarryover' },
  { kind: 'vacationTaken' },
  { kind: 'balance' },
];

interface OnboardingState {
  stepIndex: number;
  direction: 1 | -1;
  firstName: string;
  lastName: string;
  schedule: WorkSchedule;
  /** Wochentage, die der Benutzer bereits gesehen hat. Folgetage übernehmen sonst den Vortag. */
  visited: WeekdayKey[];
  vacationDaysPerYear: number;
  vacationTakenDays: number;
  vacationCarryoverDays: number;
  initialBalanceMinutes: number;
  next: () => void;
  back: () => void;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setScheduleDay: (day: WeekdayKey, value: WorkScheduleDay) => void;
  setVacationDays: (v: number) => void;
  setVacationTakenDays: (v: number) => void;
  setVacationCarryoverDays: (v: number) => void;
  setInitialBalance: (v: number) => void;
}

/** Entwurf des Onboardings (UI-Zustand). Gespeichert wird erst beim Abschluss. */
export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  stepIndex: 0,
  direction: 1,
  firstName: '',
  lastName: '',
  schedule: DEFAULT_SCHEDULE,
  visited: [],
  vacationDaysPerYear: DEFAULT_VACATION_DAYS,
  vacationTakenDays: 0,
  vacationCarryoverDays: 0,
  initialBalanceMinutes: 0,
  next: () => {
    const { stepIndex, schedule, visited } = get();
    const current = ONBOARDING_STEPS[stepIndex];
    const upcoming = ONBOARDING_STEPS[stepIndex + 1];
    if (!upcoming) return;
    const patch: Partial<OnboardingState> = { stepIndex: stepIndex + 1, direction: 1 };
    if (current?.kind === 'weekday') {
      patch.visited = [...visited, current.day];
      // Nächster Tag übernimmt die Zeiten des aktuellen, solange er noch nicht bearbeitet wurde.
      // Ein freier Tag wird dabei nicht weitergegeben.
      if (upcoming.kind === 'weekday' && !visited.includes(upcoming.day)) {
        patch.schedule = { ...schedule, [upcoming.day]: { ...schedule[current.day], isWorkDay: true } };
      }
    }
    set(patch);
  },
  back: () => set((s) => ({ stepIndex: Math.max(0, s.stepIndex - 1), direction: -1 })),
  setFirstName: (firstName) => set({ firstName }),
  setLastName: (lastName) => set({ lastName }),
  setScheduleDay: (day, value) => set((s) => ({ schedule: { ...s.schedule, [day]: value } })),
  setVacationDays: (vacationDaysPerYear) => set({ vacationDaysPerYear }),
  setVacationTakenDays: (vacationTakenDays) => set({ vacationTakenDays }),
  setVacationCarryoverDays: (vacationCarryoverDays) => set({ vacationCarryoverDays }),
  setInitialBalance: (initialBalanceMinutes) => set({ initialBalanceMinutes }),
}));
