import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { pressable } from './motion';

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

/** Icon-Button mit Touch-Fläche ≥ 44 × 44 px und Pflicht-`aria-label`. */
export function IconButton({ label, onClick, children, className = '' }: IconButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...pressable}
      className={`flex size-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-fill ${className}`}
    >
      {children}
    </motion.button>
  );
}
