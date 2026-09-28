import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { IconButton } from '../../components/ui/IconButton';
import { ChevronLeft, ChevronRight } from '../../components/ui/icons';
import { transitions } from '../../components/ui/motion';
import { resolveRange } from '../../domain/calculations/summary';
import type { ResolvedDay } from '../../domain/models';
import { useUiStore } from '../../stores/uiStore';
import {
  addDays,
  formatDayMonth,
  formatWeekday,
  isoWeekNumber,
  shiftWeek,
  startOfWeek,
} from '../../utils/date';
import { formatDuration } from '../../utils/format';
import { PageHeader, TodayButton } from '../../components/layout/PageHeader';

export function WeekView() {
  const { ctx } = useReadyData();
  const weekStart = useUiStore((s) => s.currentWeekStart);
  const setWeekStart = useUiStore((s) => s.setWeekStart);
  const goToToday = useUiStore((s) => s.goToToday);
  const openDay = useUiStore((s) => s.openDay);
  const [direction, setDirection] = useState<1 | -1>(1);

  const days = useMemo(() => resolveRange(weekStart, addDays(weekStart, 4), ctx), [weekStart, ctx]);
  const isCurrentWeek = weekStart === startOfWeek(ctx.today);

  const go = (amount: 1 | -1) => {
    setDirection(amount);
    setWeekStart(shiftWeek(weekStart, amount));
  };

  const today = () => {
    setDirection(weekStart < startOfWeek(ctx.today) ? 1 : -1);
    goToToday();
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 60 || Math.abs(info.offset.y) > Math.abs(info.offset.x)) return;
    go(info.offset.x < 0 ? 1 : -1);
  };

  return (
    <div>
      <PageHeader
        title={`KW ${isoWeekNumber(weekStart)}`}
        subtitle={`${formatDayMonth(weekStart)} – ${formatDayMonth(addDays(weekStart, 4))}`}
        actions={
          <>
            <TodayButton active={!isCurrentWeek} onClick={today} />
            <IconButton label="Vorherige Woche" onClick={() => go(-1)}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Nächste Woche" onClick={() => go(1)}>
              <ChevronRight />
            </IconButton>
          </>
        }
      />

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.ul
            key={weekStart}
            custom={direction}
            variants={{
              enter: (d: number) => ({ x: d * 40, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -40, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={transitions.standard}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={onDragEnd}
            className="flex flex-col gap-2 touch-pan-y"
          >
            {days.map((day) => (
              <li key={day.date}>
                <WeekDayRow day={day} today={ctx.today} onOpen={() => openDay(day.date)} />
              </li>
            ))}
          </motion.ul>
        </AnimatePresence>
      </div>
    </div>
  );
}

interface WeekDayRowProps {
  day: ResolvedDay;
  today: string;
  onOpen: () => void;
}

function WeekDayRow({ day, today, onOpen }: WeekDayRowProps) {
  const isToday = day.date === today;
  const isPast = day.date < today;

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileTap={{ scale: 0.985 }}
      transition={transitions.micro}
      aria-current={isToday ? 'date' : undefined}
      className={`relative flex min-h-[84px] w-full items-center justify-between gap-4 overflow-hidden rounded-3xl px-5 py-4 text-left transition-colors ${
        isToday ? 'bg-surface shadow-[0_1px_12px_rgba(152,12,59,0.08)] ring-1 ring-accent/25' : 'bg-surface'
      }`}
    >
      {isToday && <span aria-hidden className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-accent" />}
      <div className={`min-w-0 ${isPast && !isToday ? 'opacity-55' : ''}`}>
        <div className={`text-[17px] font-semibold ${isToday ? 'text-accent' : 'text-ink'}`}>
          {formatWeekday(day.date)}
        </div>
        <div className="text-[15px] text-ink-2">{formatDayMonth(day.date)}</div>
      </div>
      <div className={`text-right ${isPast && !isToday ? 'opacity-55' : ''}`}>
        <DaySummary day={day} />
      </div>
    </motion.button>
  );
}

function DaySummary({ day }: { day: ResolvedDay }) {
  switch (day.status) {
    case 'work':
      return (
        <>
          <div className="tabular text-[17px] font-semibold">{formatDuration(day.actualMinutes)}</div>
          <div className="tabular text-[15px] text-ink-2">
            {day.workDay!.start} – {day.workDay!.end}
          </div>
        </>
      );
    case 'vacation':
      return <StatusLabel>Urlaub</StatusLabel>;
    case 'sick':
      return <StatusLabel>Krank</StatusLabel>;
    case 'holiday':
      return (
        <>
          <StatusLabel>Feiertag</StatusLabel>
          {day.holiday?.source === 'public' && <div className="text-[13px] text-ink-3">{day.holiday.name}</div>}
        </>
      );
    default:
      return null;
  }
}

function StatusLabel({ children }: { children: string }) {
  return <div className="text-[17px] font-medium text-ink-2">{children}</div>;
}
