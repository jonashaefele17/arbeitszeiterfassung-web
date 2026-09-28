import { useState, type ReactNode } from 'react';
import { minutesToTime, timeToMinutes } from '../../utils/time';
import type { TimeString } from '../../utils/date';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { WheelColumn, WheelFrame, range } from './WheelPicker';

const HOURS = range(0, 23);
const MINUTES = range(0, 59);
const pad = (n: number) => String(n).padStart(2, '0');

interface PickerShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Gemeinsamer Rahmen der Auswahl-Sheets. Werte werden live übernommen, „Fertig“ schließt. */
function PickerShell({ open, title, onClose, children }: PickerShellProps) {
  return (
    <BottomSheet open={open} onClose={onClose} label={title} zIndex={60}>
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <Button variant="plain" className="-mr-3" onClick={onClose}>
          Fertig
        </Button>
      </div>
      <div className="pb-4">{children}</div>
    </BottomSheet>
  );
}

interface TimePickerSheetProps {
  open: boolean;
  title: string;
  value: TimeString;
  onChange: (value: TimeString) => void;
  onClose: () => void;
}

export function TimePickerSheet({ open, title, value, onChange, onClose }: TimePickerSheetProps) {
  const total = timeToMinutes(value);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return (
    <PickerShell open={open} title={title} onClose={onClose}>
      <WheelFrame>
        <WheelColumn
          label="Stunde"
          values={HOURS}
          value={hour}
          format={pad}
          onChange={(h) => onChange(minutesToTime(h * 60 + minute))}
          className="w-20"
        />
        <span className="text-[22px] font-semibold">:</span>
        <WheelColumn
          label="Minute"
          values={MINUTES}
          value={minute}
          format={pad}
          onChange={(m) => onChange(minutesToTime(hour * 60 + m))}
          className="w-20"
        />
      </WheelFrame>
    </PickerShell>
  );
}

interface NumberPickerSheetProps {
  open: boolean;
  title: string;
  value: number;
  values: readonly number[];
  format: (value: number) => string;
  onChange: (value: number) => void;
  onClose: () => void;
}

export function NumberPickerSheet({ open, title, value, values, format, onChange, onClose }: NumberPickerSheetProps) {
  return (
    <PickerShell open={open} title={title} onClose={onClose}>
      <WheelFrame>
        <WheelColumn label={title} values={values} value={value} format={format} onChange={onChange} className="w-40" />
      </WheelFrame>
    </PickerShell>
  );
}

export const BREAK_VALUES = range(0, 180);

interface BalancePickerSheetProps {
  open: boolean;
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
}

/** Auswahl eines vorzeichenbehafteten Stundensaldos (±Stunden:Minuten). */
export function BalancePickerSheet({ open, value, onChange, onClose }: BalancePickerSheetProps) {
  // Eigener Zustand, damit „−“ auch bei 0:00 erhalten bleibt.
  const [chosenSign, setChosenSign] = useState<string>(value < 0 ? '−' : '+');
  const sign = value < 0 ? '−' : value > 0 ? '+' : chosenSign;
  const abs = Math.abs(value);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const compose = (s: string, h: number, m: number) => (s === '−' ? -1 : 1) * (h * 60 + m);
  return (
    <PickerShell open={open} title="Überstundenstand" onClose={onClose}>
      <WheelFrame>
        <WheelColumn
          label="Vorzeichen"
          values={['+', '−']}
          value={sign}
          onChange={(s) => {
            setChosenSign(s);
            onChange(compose(s, hours, minutes));
          }}
          className="w-14"
        />
        <WheelColumn
          label="Stunden"
          values={range(0, 500)}
          value={hours}
          format={pad}
          onChange={(h) => onChange(compose(sign, h, minutes))}
          className="w-20"
        />
        <span className="text-[22px] font-semibold">:</span>
        <WheelColumn
          label="Minuten"
          values={MINUTES}
          value={minutes}
          format={pad}
          onChange={(m) => onChange(compose(sign, hours, m))}
          className="w-20"
        />
      </WheelFrame>
    </PickerShell>
  );
}
