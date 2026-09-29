import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useReadyData } from '../../app/AppDataContext';
import { AnimatedHeight } from '../../components/ui/AnimatedHeight';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { transitions } from '../../components/ui/motion';
import { resolveDay } from '../../domain/calculations/resolveDay';
import type { ResolvedDay } from '../../domain/models';
import { useUiStore } from '../../stores/uiStore';
import { formatDayMonth, formatWeekday, isWeekend } from '../../utils/date';
import { HolidayEditor } from './HolidayEditor';
import { PeriodEditor } from './PeriodEditor';
import { StatusPicker, type EditorKind } from './StatusPicker';
import { WorkEditor } from './WorkEditor';

export function DayEditorSheet() {
  const date = useUiStore((s) => s.selectedDate);
  const open = useUiStore((s) => s.isDayEditorOpen);
  const close = useUiStore((s) => s.closeDayEditor);
  const { ctx } = useReadyData();

  const day = date && !isWeekend(date) ? resolveDay(date, ctx) : null;

  return (
    <BottomSheet open={open && day !== null} onClose={close} label={date ? `${formatWeekday(date)}, ${formatDayMonth(date)}` : 'Tag'}>
      {/* `key` setzt den Editor beim Öffnen eines anderen Tages zurück. */}
      {day && <DayEditorContent key={day.date} day={day} onDone={close} />}
    </BottomSheet>
  );
}

function initialKind(day: ResolvedDay): EditorKind | null {
  switch (day.status) {
    case 'work':
    case 'vacation':
    case 'sick':
    case 'holiday':
      return day.status;
    case 'overtimeOff':
      return 'vacation';
    default:
      return null;
  }
}

function DayEditorContent({ day, onDone }: { day: ResolvedDay; onDone: () => void }) {
  const [kind, setKind] = useState<EditorKind | null>(() => initialKind(day));

  return (
    <div className="pb-2">
      <header className="pb-5 pt-1">
        <h2 className="text-[28px] font-bold leading-tight tracking-tight">{formatWeekday(day.date)}</h2>
        <p className="text-[17px] text-ink-2">
          {formatDayMonth(day.date)}
          {day.status === 'off' && ' · kein regulärer Arbeitstag'}
        </p>
      </header>

      <AnimatedHeight>
        <StatusPicker selected={kind} onSelect={setKind} />
        <AnimatePresence mode="popLayout" initial={false}>
          {kind && (
            <motion.div
              key={kind}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={transitions.standard}
              className="pt-4"
            >
              {kind === 'work' && <WorkEditor day={day} onDone={onDone} />}
              {(kind === 'vacation' || kind === 'sick') && <PeriodEditor kind={kind} day={day} onDone={onDone} />}
              {kind === 'holiday' && <HolidayEditor day={day} onDone={onDone} />}
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatedHeight>
    </div>
  );
}
