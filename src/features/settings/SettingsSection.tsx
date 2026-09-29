import type { ReactNode } from 'react';

/** Gruppierter Abschnitt der Einstellungen (Titel, Zeilen, optionaler Hinweis). */
export function SettingsSection({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">{title}</h2>
      <div className="divide-y divide-line rounded-3xl bg-surface px-5">{children}</div>
      {footer && <p className="px-1 pt-2 text-[13px] leading-snug text-ink-2">{footer}</p>}
    </section>
  );
}
