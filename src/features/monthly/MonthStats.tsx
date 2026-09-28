import type { ReactNode } from 'react';
import type { MonthlySummary } from '../../domain/models';
import type { BalanceSnapshot, VacationAccount } from '../../domain/calculations/summary';
import { formatBalance, formatDayCount, formatDuration } from '../../utils/format';

interface MonthStatsProps {
  summary: MonthlySummary;
  balance: BalanceSnapshot;
  vacation: VacationAccount;
}

export function MonthStats({ summary, balance, vacation }: MonthStatsProps) {
  return (
    <div className="space-y-6 pt-6">
      <Group>
        <Stat label="Sollzeit" value={formatDuration(summary.plannedMinutes)} />
        <Stat label="Arbeitszeit" value={formatDuration(summary.actualMinutes)} />
        <Stat label="Monatssaldo" value={formatBalance(summary.balanceMinutes)} emphasis />
      </Group>

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Urlaub" value={formatDayCount(summary.vacationDays)} />
        <Tile label="Krank" value={formatDayCount(summary.sickDays)} />
        <Tile label="Feiertage" value={formatDayCount(summary.holidayDays)} />
      </div>

      <section aria-labelledby="balance-heading">
        <SectionTitle id="balance-heading">Überstundenkonto</SectionTitle>
        <Group>
          <Stat label="Vorheriger Stand" value={formatBalance(balance.previousMinutes)} />
          <Stat label="Monatssaldo" value={formatBalance(balance.monthMinutes)} />
          <Stat
            label="Kontostand"
            value={formatBalance(balance.currentMinutes)}
            emphasis
            accent={balance.currentMinutes !== 0}
          />
        </Group>
      </section>

      <section aria-labelledby="vacation-heading">
        <SectionTitle id="vacation-heading">Urlaubskonto {vacation.year}</SectionTitle>
        <Group>
          <Stat label="Anspruch" value={formatDayCount(vacation.entitlement)} />
          <Stat label="Genommen" value={formatDayCount(vacation.taken)} />
          <Stat label="Verbleibend" value={formatDayCount(vacation.remaining)} emphasis />
        </Group>
      </section>
    </div>
  );
}

function SectionTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="px-1 pb-2 text-[13px] font-semibold uppercase tracking-wide text-ink-3">
      {children}
    </h2>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line rounded-3xl bg-surface px-5">{children}</dl>;
}

interface StatProps {
  label: string;
  value: string;
  emphasis?: boolean;
  accent?: boolean;
}

function Stat({ label, value, emphasis = false, accent = false }: StatProps) {
  return (
    <div className="flex min-h-13 items-center justify-between">
      <dt className="text-[17px] text-ink-2">{label}</dt>
      <dd className={`tabular text-[17px] ${emphasis ? 'font-semibold' : ''} ${accent ? 'text-accent' : 'text-ink'}`}>
        {value}
      </dd>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface px-3 py-3 text-center">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className="tabular pt-0.5 text-[17px] font-semibold">{value}</div>
    </div>
  );
}
