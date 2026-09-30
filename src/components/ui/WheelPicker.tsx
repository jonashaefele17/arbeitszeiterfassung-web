import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

const ITEM_HEIGHT = 44;
const VISIBLE = 5;
const PADDING = ((VISIBLE - 1) / 2) * ITEM_HEIGHT;

interface WheelColumnProps<T extends string | number> {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format?: (value: T) => string;
  label: string;
  className?: string;
}

/**
 * Ergänzt einen Wert, der nicht im Raster liegt (z. B. 8:07 bei 5-min-Schritten), an passender Stelle.
 */
export function withValue<T extends string | number>(values: readonly T[], value: T): readonly T[] {
  if (values.includes(value)) return values;
  if (typeof value !== 'number') return [...values, value];
  const index = values.findIndex((v) => (v as number) > value);
  return index === -1 ? [...values, value] : [...values.slice(0, index), value, ...values.slice(index)];
}

/**
 * Einzelne Scroll-Walze mit Snapping. Unterstützt Touch, Mausrad und Pfeiltasten.
 * Ein Startwert außerhalb des Rasters bleibt wählbar, solange die Walze offen ist.
 */
export function WheelColumn<T extends string | number>({
  values: raster,
  value,
  onChange,
  format = String,
  label,
  className = '',
}: WheelColumnProps<T>) {
  const [initial] = useState(value);
  const values = useMemo(() => withValue(raster, initial), [raster, initial]);
  const ref = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const selectedIndex = Math.max(0, values.indexOf(value));
  const [liveIndex, setLiveIndex] = useState(selectedIndex);

  // Initiale Position ohne Animation setzen.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedIndex * ITEM_HEIGHT;
  }, []);

  // Externe Wertänderungen nachführen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = Math.round(el.scrollTop / ITEM_HEIGHT);
    if (current !== selectedIndex) el.scrollTo({ top: selectedIndex * ITEM_HEIGHT, behavior: 'smooth' });
    setLiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const index = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)));
    setLiveIndex(index);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const next = values[index];
      if (next !== undefined && next !== value) onChange(next);
    }, 100);
  };

  const select = (index: number) => {
    const clamped = Math.min(values.length - 1, Math.max(0, index));
    ref.current?.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
    const next = values[clamped];
    if (next !== undefined && next !== value) onChange(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      select(selectedIndex + step);
    }
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      aria-label={label}
      aria-valuenow={typeof value === 'number' ? value : selectedIndex}
      aria-valuetext={format(value)}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={onKeyDown}
      className={`no-scrollbar relative snap-y snap-mandatory overflow-y-scroll overscroll-contain ${className}`}
      style={{
        height: ITEM_HEIGHT * VISIBLE,
        paddingBlock: PADDING,
        maskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)',
      }}
    >
      {values.map((v, i) => (
        <button
          key={String(v)}
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => select(i)}
          className={`tabular flex w-full snap-center items-center justify-center text-[22px] transition-[color,transform] duration-150 ${
            i === liveIndex ? 'font-semibold text-ink' : 'text-ink-3'
          }`}
          style={{ height: ITEM_HEIGHT }}
        >
          {format(v)}
        </button>
      ))}
    </div>
  );
}

/** Hervorhebungsband hinter den Walzen. */
export function WheelFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex items-center justify-center gap-1 px-2">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl bg-fill"
        style={{ height: ITEM_HEIGHT }}
      />
      <div className="relative flex items-center justify-center gap-1">{children}</div>
    </div>
  );
}

export const range = (from: number, to: number, step = 1): number[] => {
  const result: number[] = [];
  for (let i = from; i <= to; i += step) result.push(i);
  return result;
};
