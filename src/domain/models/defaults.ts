import type { WorkSchedule, WorkScheduleDay } from './index';

export const DEFAULT_SCHEDULE_DAY: WorkScheduleDay = {
  isWorkDay: true,
  start: '08:00',
  end: '14:00',
  breakMinutes: 30,
};

export const DEFAULT_SCHEDULE: WorkSchedule = {
  monday: DEFAULT_SCHEDULE_DAY,
  tuesday: DEFAULT_SCHEDULE_DAY,
  wednesday: DEFAULT_SCHEDULE_DAY,
  thursday: DEFAULT_SCHEDULE_DAY,
  friday: DEFAULT_SCHEDULE_DAY,
};

export const DEFAULT_VACATION_DAYS = 30;
