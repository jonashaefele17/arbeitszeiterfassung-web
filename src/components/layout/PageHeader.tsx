import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { AnimatedHeight } from '../ui/AnimatedHeight';
import { transitions } from '../ui/motion';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-3 pb-5 pt-4">
      {/* Weiche Höhenänderung, wenn der Untertitel z. B. beim Wochenwechsel auf zwei Zeilen umbricht. */}
      <div className="min-w-0 flex-1">
        <AnimatedHeight>
          <h1 className="truncate text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="text-[15px] text-ink-2">{subtitle}</p>}
        </AnimatedHeight>
      </div>
      {actions && <div className="-mr-2 flex shrink-0 items-center">{actions}</div>}
    </header>
  );
}

/** „Heute“ – hervorgehoben, sobald ein anderer Zeitraum angezeigt wird. */
export function TodayButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={transitions.micro}
      className={`mr-1 min-h-11 rounded-full px-3 text-[15px] font-semibold transition-colors ${
        active ? 'bg-accent-soft text-accent' : 'text-accent'
      }`}
    >
      Heute
    </motion.button>
  );
}
