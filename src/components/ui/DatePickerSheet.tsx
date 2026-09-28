import { useEffect, useState } from 'react';
import {
  WEEKDAY_KEYS,
  WEEKDAY_SHORT,
  dayOfMonth,
  formatMonthYear,
  formatShortDate,
  monthWorkWeekGrid,
  shiftMonth,
  yearMonthOf,
  type ISODate,
} from '../../utils/date';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { ChevronLeft, ChevronRight } from './icons';

interface DatePickerSheetProps {
  open: boolean;
  title: string;
  value: ISODate;
  /** Beginn des Zeitraums – Tage dazwischen werden hervorgehoben, frühere sind gesperrt. */
  rangeStart?: ISODate;
  /** Späteste wählbare Grenze (z. B. Ende des Zeitraums beim Wählen des Beginns). */
  rangeEnd?: ISODate;
  onChange: (value: ISODate) => void;
  onClose: () => void;
}

export function DatePickerSheet({ open, title, value, rangeStart, rangeEnd, onChange, onClose }: DatePickerSheetProps) {
  const [month, setMonth] = useState(() => yearMonthOf(value));
  useEffect(() => {
    if (open) setMonth(yearMonthOf(value));
    // Nur beim Öffnen auf den gewählten Monat springen.
  }, [open]);

  const weeks = monthWorkWeekGrid(month, true);
  const monthPrefix = `${month.year}-${String(month.month).padStart(2, '0')}`;
  const lower = rangeStart;
  const upper = rangeEnd;

  return (
    <BottomSheet open={open} onClose={onClose} label={title} zIndex={60}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <Button variant="plain" className="-mr-3" onClick={onClose}>
          Fertig
        </Button>
      </div>
      <div className="flex items-center justify-between py-2">
        <span className="text-[17px] font-medium capitalize">{formatMonthYear(month)}</span>
        <div className="flex">
          <IconButton label="Vorheriger Monat" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft />
          </IconButton>
          <IconButton label="Nächster Monat" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-y-1 pb-5 text-center" role="grid" aria-label={formatMonthYear(month)}>
        {WEEKDAY_KEYS.map((k) => (
          <div key={k} className="pb-1 text-[13px] font-medium text-ink-3" role="columnheader">
            {WEEKDAY_SHORT[k]}
          </div>
        ))}
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const disabled = (lower !== undefined && date < lower) || (upper !== undefined && date > upper);
          const selected = date === value;
          const inRange =
            (rangeStart !== undefined && date >= rangeStart && date <= value) ||
            (rangeEnd !== undefined && date >= value && date <= rangeEnd);
          return (
            <div key={date} className={`flex justify-center ${inRange && !selected ? 'bg-accent-soft' : ''}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(date)}
                aria-pressed={selected}
                aria-label={formatShortDate(date)}
                className={`tabular flex size-11 items-center justify-center rounded-full text-[17px] transition-colors ${
                  selected
                    ? 'bg-accent font-semibold text-white'
                    : disabled
                      ? 'text-ink-3/50'
                      : date.startsWith(monthPrefix)
                        ? 'text-ink'
                        : 'text-ink-3'
                }`}
              >
                {dayOfMonth(date)}
              </button>
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}
