import { motion } from 'framer-motion';
import { transitions } from '../../components/ui/motion';
import type { ResolvedDay } from '../../domain/models';
import { useUiStore } from '../../stores/uiStore';
import {
  WEEKDAY_KEYS,
  WEEKDAY_SHORT,
  dayOfMonth,
  formatDayMonth,
  formatWeekday,
  monthWorkWeekGrid,
  type ISODate,
  type YearMonth,
} from '../../utils/date';
import { formatDurationShort } from '../../utils/format';

interface MonthCalendarProps {
  month: YearMonth;
  days: readonly ResolvedDay[];
  today: ISODate;
}

export function MonthCalendar({ month, days, today }: MonthCalendarProps) {
  const openDay = useUiStore((s) => s.openDay);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells = monthWorkWeekGrid(month).flat();

  return (
    <div className="rounded-3xl bg-surface px-2 pb-3 pt-3">
      <div className="grid grid-cols-5 pb-1 text-center" aria-hidden>
        {WEEKDAY_KEYS.map((k) => (
          <div key={k} className="text-[13px] font-medium text-ink-3">
            {WEEKDAY_SHORT[k]}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-y-1">
        {cells.map((date, i) => {
          const day = date ? byDate.get(date) : undefined;
          if (!date || !day) return <div key={`empty-${i}`} />;
          const isToday = date === today;
          const label = cellLabel(day);
          return (
            <motion.button
              key={date}
              type="button"
              onClick={() => openDay(date)}
              whileTap={{ scale: 0.94 }}
              transition={transitions.micro}
              aria-label={`${formatWeekday(date)}, ${formatDayMonth(date)}${label ? `: ${label}` : ''}`}
              aria-current={isToday ? 'date' : undefined}
              className="flex min-h-16 flex-col items-center justify-start gap-1 rounded-2xl pt-1.5 transition-colors hover:bg-fill"
            >
              <span
                className={`tabular flex size-8 items-center justify-center rounded-full text-[17px] ${
                  isToday
                    ? 'bg-accent font-semibold text-white'
                    : day.isMissing
                      ? 'bg-warn-soft font-semibold text-warn-ink ring-1 ring-warn'
                      : date < today
                        ? 'text-ink-2'
                        : 'text-ink'
                }`}
              >
                {dayOfMonth(date)}
              </span>
              <span
                className={`tabular text-[12px] leading-none ${
                  day.status === 'work'
                    ? 'font-semibold text-ink'
                    : day.isMissing
                      ? 'font-medium text-warn-ink'
                      : 'font-medium text-ink-2'
                }`}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function cellLabel(day: ResolvedDay): string {
  switch (day.status) {
    case 'work':
      return formatDurationShort(day.actualMinutes);
    case 'vacation':
      return 'Urlaub';
    case 'overtimeOff':
      return 'Ü-frei';
    case 'empty':
      return day.isMissing ? 'Offen' : '';
    case 'sick':
      return 'Krank';
    case 'holiday':
      return 'Feiertag';
    default:
      return '';
  }
}
