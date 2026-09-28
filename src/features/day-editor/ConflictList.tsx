import { actualMinutesOf } from '../../domain/calculations/time';
import type { WorkDay } from '../../domain/models';
import { formatDayMonthShort } from '../../utils/date';
import { formatDuration } from '../../utils/format';

/** Liste der Erfassungen, die durch eine Aktion ersetzt würden. */
export function ConflictList({ workDays }: { workDays: readonly WorkDay[] }) {
  return (
    <ul className="space-y-1.5 rounded-2xl bg-fill px-4 py-3 text-ink">
      {workDays.map((w) => (
        <li key={w.id} className="tabular">
          <span className="font-semibold">{formatDayMonthShort(w.date)}</span>{' '}
          <span className="text-ink-2">
            Arbeit · {w.start}–{w.end} · {formatDuration(actualMinutesOf(w))}
          </span>
        </li>
      ))}
    </ul>
  );
}
