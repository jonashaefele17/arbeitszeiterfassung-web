import { motion } from 'framer-motion';
import { transitions } from './motion';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
        checked ? 'justify-end bg-accent' : 'justify-start bg-line'
      }`}
    >
      <motion.span layout transition={transitions.layout} className="block size-[27px] rounded-full bg-white shadow-sm" />
    </button>
  );
}
