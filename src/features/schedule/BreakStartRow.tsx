import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { TimePickerSheet } from '../../components/ui/PickerSheets';
import { Divider, ValueRow } from '../../components/ui/ValueRow';
import { transitions } from '../../components/ui/motion';
import { breakEnd } from '../../domain/calculations/time';
import type { TimeString } from '../../utils/date';

interface BreakStartRowProps {
  breakMinutes: number;
  breakStart: TimeString | undefined;
  onChange: (breakStart: TimeString) => void;
  invalid?: boolean;
}

/**
 * „Pausenbeginn“ unter der Pausendauer – nur sichtbar, wenn eine Pause eingetragen ist.
 * Das Pausenende wird daraus berechnet und mit angezeigt.
 */
export function BreakStartRow({ breakMinutes, breakStart, onChange, invalid = false }: BreakStartRowProps) {
  const [open, setOpen] = useState(false);
  const visible = breakMinutes > 0 && !!breakStart;

  return (
    <>
      <AnimatePresence initial={false}>
        {visible && (
          <motion.div
            key="break-start"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={transitions.standard}
            className="overflow-hidden"
          >
            <Divider />
            <ValueRow
              label={`Pausenbeginn · bis ${breakEnd(breakStart, breakMinutes)}`}
              value={breakStart}
              onClick={() => setOpen(true)}
              invalid={invalid}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <TimePickerSheet
        open={open && visible}
        title="Pausenbeginn"
        value={breakStart ?? '12:00'}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
