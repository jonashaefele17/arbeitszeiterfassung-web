import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { BalanceSnapshot } from '../../../domain/calculations/summary';
import type { MonthlySummary, ResolvedDay, UserProfile } from '../../../domain/models';
import { formatMonthYear, formatShortDate, formatWeekdayShortDate, type YearMonth } from '../../../utils/date';
import { formatBalance, formatBreak, formatDayCount, formatDuration } from '../../../utils/format';

const ACCENT = '#980C3B';
const INK = '#111114';
const INK_2 = '#62626B';
const LINE = '#E8E8EC';

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 48, paddingHorizontal: 40, fontSize: 9, color: INK, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: ACCENT },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 11, color: INK_2, marginTop: 4 },
  name: { fontSize: 11, textAlign: 'right' },
  table: { marginTop: 18 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 5 },
  headRow: { flexDirection: 'row', paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: INK },
  headCell: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: INK_2 },
  muted: { color: INK_2 },
  summary: { marginTop: 22, flexDirection: 'row', gap: 24 },
  summaryCol: { flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: LINE },
  summaryStrong: { fontFamily: 'Helvetica-Bold' },
  sectionTitle: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 6 },
  signatures: { marginTop: 56, flexDirection: 'row', gap: 40 },
  signature: { flex: 1, borderTopWidth: 0.75, borderTopColor: INK, paddingTop: 5, color: INK_2, fontSize: 8 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: INK_2 },
});

const COLUMNS = [
  { key: 'date', label: 'Datum', width: '15%' },
  { key: 'status', label: 'Status', width: '19%' },
  { key: 'start', label: 'Beginn', width: '9%' },
  { key: 'end', label: 'Ende', width: '9%' },
  { key: 'break', label: 'Pause', width: '9%' },
  { key: 'actual', label: 'Arbeitszeit', width: '13%' },
  { key: 'planned', label: 'Sollzeit', width: '12%' },
  { key: 'diff', label: 'Differenz', width: '14%' },
] as const;

type Cells = Record<(typeof COLUMNS)[number]['key'], string>;

const NUMERIC = new Set(['actual', 'planned', 'diff']);

function statusText(day: ResolvedDay): string {
  switch (day.status) {
    case 'work':
      return day.holiday ? 'Arbeit (Feiertag)' : 'Arbeit';
    case 'vacation':
      return 'Urlaub';
    case 'overtimeOff':
      return 'Überstunden frei';
    case 'empty':
      return day.isMissing ? 'Nicht eingetragen' : '–';
    case 'sick':
      return 'Krank';
    case 'holiday':
      return day.holiday?.source === 'public' ? day.holiday.name : 'Feiertag';
    default:
      return '–';
  }
}

function toCells(day: ResolvedDay, trackingStartDate: string): Cells {
  const counts = day.date >= trackingStartDate;
  const w = day.workDay;
  const showTimes = counts;
  return {
    date: formatWeekdayShortDate(day.date),
    status: statusText(day),
    start: w?.start ?? '',
    end: w?.end ?? '',
    break: w ? formatBreak(w.breakMinutes) : '',
    actual: showTimes && (day.status === 'work' || (day.status !== 'empty' && day.plannedMinutes > 0))
      ? formatDuration(day.actualMinutes)
      : '',
    planned: showTimes && day.plannedMinutes > 0 ? formatDuration(day.plannedMinutes) : '',
    diff: showTimes && (day.status === 'work' || day.plannedMinutes > 0) ? formatBalance(day.differenceMinutes) : '',
  };
}

export interface MonthlyReportProps {
  month: YearMonth;
  days: readonly ResolvedDay[];
  summary: MonthlySummary;
  balance: BalanceSnapshot;
  profile: UserProfile;
  createdOn: string;
}

/** Arbeitszeitnachweis eines Monats. Layout ist in V1 fest definiert. */
export function MonthlyReportPdf({ month, days, summary, balance, profile, createdOn }: MonthlyReportProps) {
  // Nicht-Arbeitstage ohne Eintrag werden ausgelassen; Feiertage erscheinen wie Urlaub ohne Beginn/Ende.
  const rows = days.filter((d) => d.status !== 'off');
  const fullName = `${profile.firstName} ${profile.lastName}`;

  return (
    <Document title={`Arbeitszeitnachweis ${formatMonthYear(month)} – ${fullName}`} author={fullName} language="de">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.title}>Arbeitszeitnachweis</Text>
            <Text style={s.subtitle}>{formatMonthYear(month)}</Text>
          </View>
          <View>
            <Text style={s.name}>{fullName}</Text>
          </View>
        </View>

        <View style={s.table}>
          <View style={s.headRow} fixed>
            {COLUMNS.map((c) => (
              <Text key={c.key} style={[s.headCell, { width: c.width, textAlign: NUMERIC.has(c.key) ? 'right' : 'left' }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {rows.map((day) => {
            const cells = toCells(day, profile.trackingStartDate);
            const muted = day.status === 'empty';
            return (
              <View key={day.date} style={s.row} wrap={false}>
                {COLUMNS.map((c) => (
                  <Text
                    key={c.key}
                    style={[{ width: c.width, textAlign: NUMERIC.has(c.key) ? 'right' : 'left' }, muted ? s.muted : {}]}
                  >
                    {cells[c.key]}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>

        <View style={s.summary} wrap={false}>
          <View style={s.summaryCol}>
            <Text style={s.sectionTitle}>Zusammenfassung</Text>
            <SummaryRow label="Sollzeit" value={formatDuration(summary.plannedMinutes)} />
            <SummaryRow label="Arbeitszeit" value={formatDuration(summary.actualMinutes)} />
            <SummaryRow label="Monatssaldo" value={formatBalance(summary.balanceMinutes)} strong />
          </View>
          <View style={s.summaryCol}>
            <Text style={s.sectionTitle}>Abwesenheiten</Text>
            <SummaryRow label="Urlaub" value={formatDayCount(summary.vacationDays)} />
            <SummaryRow label="Überstunden frei" value={formatDayCount(summary.overtimeOffDays)} />
            <SummaryRow label="Krankheit" value={formatDayCount(summary.sickDays)} />
            <SummaryRow label="Feiertage" value={formatDayCount(summary.holidayDays)} />
          </View>
          <View style={s.summaryCol}>
            <Text style={s.sectionTitle}>Überstundenkonto</Text>
            <SummaryRow label="Vormonat" value={formatBalance(balance.previousMinutes)} />
            <SummaryRow label="Monatssaldo" value={formatBalance(balance.monthMinutes)} />
            <SummaryRow label="Aktueller Stand" value={formatBalance(balance.currentMinutes)} strong />
          </View>
        </View>

        <View style={s.signatures} wrap={false}>
          <Text style={s.signature}>Datum, Unterschrift Mitarbeiter/in</Text>
          <Text style={s.signature}>Datum, Unterschrift Arbeitgeber</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {fullName} · {formatMonthYear(month)} · erstellt am {formatShortDate(createdOn)}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.summaryRow}>
      <Text style={strong ? s.summaryStrong : {}}>{label}</Text>
      <Text style={strong ? s.summaryStrong : {}}>{value}</Text>
    </View>
  );
}
