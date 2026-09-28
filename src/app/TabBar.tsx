import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { CalendarIcon, SettingsIcon, WeekIcon } from '../components/ui/icons';
import { transitions } from '../components/ui/motion';
import { useUiStore, type Tab } from '../stores/uiStore';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'overview', label: 'Übersicht', icon: <WeekIcon /> },
  { id: 'month', label: 'Monat', icon: <CalendarIcon /> },
  { id: 'settings', label: 'Einstellungen', icon: <SettingsIcon /> },
];

export function TabBar() {
  const activeTab = useUiStore((s) => s.activeTab);
  const setTab = useUiStore((s) => s.setTab);
  return (
    <nav
      aria-label="Hauptnavigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-bg/85 backdrop-blur-xl"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <li key={tab.id} className="flex-1">
              <motion.button
                type="button"
                onClick={() => setTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                whileTap={{ scale: 0.94 }}
                transition={transitions.micro}
                className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-accent' : 'text-ink-3'
                }`}
              >
                {tab.icon}
                {tab.label}
              </motion.button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
