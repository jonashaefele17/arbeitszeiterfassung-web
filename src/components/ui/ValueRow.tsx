import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { transitions } from './motion';

interface ValueRowProps {
  label: string;
  value: ReactNode;
  onClick?: () => void;
  emphasis?: boolean;
  invalid?: boolean;
}

/**
 * Zeile „Bezeichnung … Wert“. Mit `onClick` ist die ganze Zeile antippbar –
 * keine separaten Edit-Icons.
 */
export function ValueRow({ label, value, onClick, emphasis = false, invalid = false }: ValueRowProps) {
  const content = (
    <>
      <span className="text-[17px] text-ink-2">{label}</span>
      <span
        className={`tabular shrink-0 whitespace-nowrap text-[17px] ${emphasis ? 'font-semibold text-ink' : 'text-ink'} ${
          onClick ? 'rounded-lg bg-fill px-3 py-1.5 font-medium' : ''
        } ${invalid ? 'text-danger' : ''}`}
      >
        {value}
      </span>
    </>
  );

  if (!onClick) {
    return <div className="flex min-h-13 items-center justify-between">{content}</div>;
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.985 }}
      transition={transitions.micro}
      aria-label={`${label}: ${typeof value === 'string' ? value : ''} ändern`}
      className="flex min-h-13 w-full items-center justify-between text-left"
    >
      {content}
    </motion.button>
  );
}

export function Divider() {
  return <div className="h-px bg-line" />;
}
