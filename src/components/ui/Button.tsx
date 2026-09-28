import { motion, type HTMLMotionProps } from 'framer-motion';
import { pressable } from './motion';

type Variant = 'primary' | 'secondary' | 'plain' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white active:bg-accent-pressed disabled:bg-ink-3/40',
  secondary: 'bg-fill text-ink disabled:text-ink-3',
  plain: 'bg-transparent text-accent disabled:text-ink-3',
  danger: 'bg-transparent text-danger',
};

interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = 'primary', block = false, className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <motion.button
      type={type}
      {...pressable}
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-[17px] font-semibold transition-colors ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...props}
    />
  );
}
