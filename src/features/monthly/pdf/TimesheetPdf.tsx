import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ResolvedDay, UserProfile } from '../../../domain/models';
import { formatMonthYear, type YearMonth } from '../../../utils/date';
import { buildTimesheet, splitHours, type SplitHours, type TimesheetRow } from './timesheetRows';

const INK = '#111114';
const MUTED = '#8A8A8A';
const RULE = INK;

/** Breite von „10:00“ in Helvetica 11 pt (4 Ziffern à 6,12 pt + Doppelpunkt 3,06 pt). */
const TIME_WIDTH = 27.6;

const COL = { date: '21%', hours: '25%', range: '30%', pause: '24%' } as const;

const s = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 56, paddingLeft: 76, paddingRight: 48, fontSize: 11, color: INK, fontFamily: 'Helvetica' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  meta: { flexDirection: 'row', marginTop: 18, fontSize: 13 },
  metaLabel: { fontFamily: 'Helvetica-Bold', width: 62 },
  table: { marginTop: 28, borderTopWidth: 0.5, borderLeftWidth: 0.5, borderRightWidth: 0.5, borderColor: RULE },
  row: { flexDirection: 'row', minHeight: 22, borderBottomWidth: 0.5, borderBottomColor: RULE },
  head: { fontFamily: 'Helvetica-Bold' },
  cell: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 3, flexDirection: 'row', alignItems: 'flex-end' },
  divider: { borderLeftWidth: 0.5, borderLeftColor: RULE },
  sumRow: { flexDirection: 'row', marginTop: 10, alignItems: 'center' },
  sumLabel: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  sumBox: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1.25, borderBottomColor: INK, fontFamily: 'Helvetica-Bold' },
});

/** Stunden am Komma ausgerichtet: ganzzahliger Teil rechtsbündig, Nachkommastellen linksbündig. */
function Hours({ hours, muted = false }: { hours: SplitHours; muted?: boolean }) {
  const color = muted ? MUTED : INK;
  return (
    <View style={{ flexDirection: 'row', width: '100%' }}>
      <Text style={{ width: '50%', textAlign: 'right', color }}>{hours.whole}</Text>
      <Text style={{ width: '50%', color }}>{hours.fraction}</Text>
    </View>
  );
}

/**
 * „8:00 - 14:00“ mit rechtsbündigen Zeiten, damit ein- und zweistellige Stunden bündig stehen.
 * Die Zeitfelder sind genau so breit wie „10:00“ – Hinweise wie „Urlaub“ beginnen am selben Einzug.
 */
function Span({ value, muted = false }: { value: { from: string; to: string } | string; muted?: boolean }) {
  if (typeof value === 'string') return <Text style={{ color: muted ? MUTED : INK }}>{value}</Text>;
  return (
    <View style={{ flexDirection: 'row' }}>
      <Text style={{ width: TIME_WIDTH, textAlign: 'right' }}>{value.from}</Text>
      <Text style={{ width: 14, textAlign: 'center' }}>-</Text>
      <Text style={{ width: TIME_WIDTH, textAlign: 'right' }}>{value.to}</Text>
    </View>
  );
}

function Row({ row }: { row: TimesheetRow }) {
  return (
    <View style={s.row} wrap={false}>
      <View style={[s.cell, { width: COL.date }]}>
        <Text style={{ width: 22 }}>{row.weekday}</Text>
        <Text style={{ width: 46, textAlign: 'right' }}>{row.day}</Text>
      </View>
      <View style={[s.cell, s.divider, { width: COL.hours }]}>
        <Hours hours={row.hours} muted={row.muted} />
      </View>
      <View style={[s.cell, s.divider, { width: COL.range }]}>
        <Span value={row.range} muted={row.muted} />
      </View>
      <View style={[s.cell, s.divider, { width: COL.pause }]}>
        <Span value={row.pause} />
      </View>
    </View>
  );
}

function EmptyRow() {
  return (
    <View style={s.row} wrap={false}>
      <View style={[s.cell, { width: COL.date }]} />
      <View style={[s.cell, s.divider, { width: COL.hours }]} />
      <View style={[s.cell, s.divider, { width: COL.range }]} />
      <View style={[s.cell, s.divider, { width: COL.pause }]} />
    </View>
  );
}

export interface TimesheetProps {
  month: YearMonth;
  days: readonly ResolvedDay[];
  profile: UserProfile;
}

/** Formular „Arbeitsaufschreibungen Minijob und Teilzeit“ nach der Papiervorlage. */
export function TimesheetPdf({ month, days, profile }: TimesheetProps) {
  const fullName = `${profile.firstName} ${profile.lastName}`;
  const { lines, totalMinutes } = buildTimesheet(days, profile.trackingStartDate);

  return (
    <Document
      title={`Arbeitsaufschreibung ${formatMonthYear(month)} – ${fullName}`}
      author={fullName}
      language="de"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Arbeitsaufschreibungen Minijob und Teilzeit</Text>
        <View style={s.meta}>
          <Text style={s.metaLabel}>Monat:</Text>
          <Text>{formatMonthYear(month)}</Text>
        </View>
        <View style={s.meta}>
          <Text style={s.metaLabel}>Name:</Text>
          <Text>{fullName}</Text>
        </View>

        <View style={s.table}>
          <View style={[s.row, s.head]} fixed>
            <Text style={[s.cell, { width: COL.date }]}>Datum:</Text>
            <Text style={[s.cell, s.divider, { width: COL.hours, textAlign: 'center' }]}>Stunden/ Minuten</Text>
            <Text style={[s.cell, s.divider, { width: COL.range }]}>Von – bis</Text>
            <Text style={[s.cell, s.divider, { width: COL.pause }]}>Pause</Text>
          </View>
          {lines.map((line, i) =>
            line === 'gap' ? <EmptyRow key={`gap-${i}`} /> : <Row key={line.date} row={line} />,
          )}
        </View>

        <View style={s.sumRow} wrap={false}>
          <Text style={[s.sumLabel, { width: COL.date, paddingHorizontal: 10 }]}>Summe:</Text>
          <View style={[s.sumBox, { width: COL.hours, paddingHorizontal: 10 }]}>
            <Hours hours={splitHours(totalMinutes)} />
          </View>
        </View>
      </Page>
    </Document>
  );
}
