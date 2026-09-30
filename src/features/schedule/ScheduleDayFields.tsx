import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { WorkScheduleDay } from '../../domain/models';
import { TIME_RANGE_ERROR_TEXT, changeRange, plannedMinutesOf, validateTimeRange } from '../../domain/calculations/time';
import { BreakStartRow } from './BreakStartRow';
import { BREAK_VALUES, NumberPickerSheet, TimePickerSheet } from '../../components/ui/PickerSheets';
import { Divider, ValueRow } from '../../components/ui/ValueRow';
import { Switch } from '../../components/ui/Switch';
import { transitions } from '../../components/ui/motion';
import { formatBreak, formatDuration } from '../../utils/format';

interface ScheduleDayFieldsProps {
  question: string;
  value: WorkScheduleDay;
  onChange: (value: WorkScheduleDay) => void;
}

type Picker = 'start' | 'end' | 'break' | null;

/** Standardarbeitszeit eines Wochentags – genutzt im Onboarding und in den Einstellungen. */
export function ScheduleDayFields({ question, value, onChange }: ScheduleDayFieldsProps) {
  const [picker, setPicker] = useState<Picker>(null);
  // Erst ein selbst gewählter Pausenbeginn bleibt bei geänderten Zeiten fest; sonst wird er passend verschoben.
  const [breakPinned, setBreakPinned] = useState(false);
  const change = (patch: Partial<WorkScheduleDay>) =>
    onChange({ isWorkDay: value.isWorkDay, ...changeRange(value, patch, breakPinned) });
  const error = value.isWorkDay ? validateTimeRange(value) : null;
  const close = () => setPicker(null);

  return (
    <div>
      <div className="flex min-h-14 items-center justify-between gap-4">
        <span className="text-[17px]">{question}</span>
        <Switch checked={value.isWorkDay} onChange={(isWorkDay) => onChange({ ...value, isWorkDay })} label={question} />
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {value.isWorkDay ? (
          <motion.div
            key="fields"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.standard}
            className="overflow-hidden"
          >
            <Divider />
            <ValueRow label="Beginn" value={value.start} onClick={() => setPicker('start')} />
            <Divider />
            <ValueRow label="Ende" value={value.end} onClick={() => setPicker('end')} invalid={error === 'end-before-start' || error === 'break-too-long'} />
            <Divider />
            <ValueRow label="Pause" value={formatBreak(value.breakMinutes)} onClick={() => setPicker('break')} />
            <BreakStartRow
              breakMinutes={value.breakMinutes}
              breakStart={value.breakStart}
              invalid={error === 'break-outside'}
              onChange={(breakStart) => {
                setBreakPinned(true);
                onChange({ ...value, breakStart });
              }}
            />
            <Divider />
            <ValueRow label="Sollzeit" value={formatDuration(plannedMinutesOf(value))} emphasis />
            {error && <p className="pb-2 text-[15px] text-danger">{TIME_RANGE_ERROR_TEXT[error]}</p>}
          </motion.div>
        ) : (
          <motion.p
            key="off"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitions.standard}
            className="pt-2 text-[17px] text-ink-2"
          >
            Kein regulärer Arbeitstag
          </motion.p>
        )}
      </AnimatePresence>

      <TimePickerSheet
        open={picker === 'start'}
        title="Beginn"
        value={value.start}
        onChange={(start) => change({ start })}
        onClose={close}
      />
      <TimePickerSheet
        open={picker === 'end'}
        title="Ende"
        value={value.end}
        onChange={(end) => change({ end })}
        onClose={close}
      />
      <NumberPickerSheet
        open={picker === 'break'}
        title="Pause"
        value={value.breakMinutes}
        values={BREAK_VALUES}
        format={formatBreak}
        onChange={(breakMinutes) => change({ breakMinutes })}
        onClose={close}
      />
    </div>
  );
}

export function isScheduleDayValid(day: WorkScheduleDay): boolean {
  return !day.isWorkDay || validateTimeRange(day) === null;
}
