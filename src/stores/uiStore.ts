import { create } from 'zustand';
import { startOfWeek, todayISO, yearMonthOf, type ISODate, type YearMonth } from '../utils/date';

export type Tab = 'overview' | 'month' | 'settings';

interface UiState {
  activeTab: Tab;
  currentWeekStart: ISODate;
  currentMonth: YearMonth;
  selectedDate: ISODate | null;
  isDayEditorOpen: boolean;
  setTab: (tab: Tab) => void;
  setWeekStart: (weekStart: ISODate) => void;
  setMonth: (month: YearMonth) => void;
  goToToday: () => void;
  openDay: (date: ISODate) => void;
  closeDayEditor: () => void;
}

/** Reiner UI-Zustand. Persistente Daten liegen ausschließlich in den Repositories. */
export const useUiStore = create<UiState>((set) => ({
  activeTab: 'overview',
  currentWeekStart: startOfWeek(todayISO()),
  currentMonth: yearMonthOf(todayISO()),
  selectedDate: null,
  isDayEditorOpen: false,
  setTab: (activeTab) => set({ activeTab }),
  setWeekStart: (currentWeekStart) => set({ currentWeekStart }),
  setMonth: (currentMonth) => set({ currentMonth }),
  goToToday: () => set({ currentWeekStart: startOfWeek(todayISO()), currentMonth: yearMonthOf(todayISO()) }),
  openDay: (selectedDate) => set({ selectedDate, isDayEditorOpen: true }),
  closeDayEditor: () => set({ isDayEditorOpen: false }),
}));
