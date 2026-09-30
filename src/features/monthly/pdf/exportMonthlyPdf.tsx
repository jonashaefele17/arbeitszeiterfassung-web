import { pdf } from '@react-pdf/renderer';
import type { CalculationContext } from '../../../domain/calculations/context';
import { shareOrDownload } from '../../../utils/shareFile';
import { MonthlyReportPdf, type MonthlyReportProps } from './MonthlyReportPdf';
import { TimesheetPdf } from './TimesheetPdf';

/** 'timesheet' = Formular „Arbeitsaufschreibungen“, 'report' = detaillierter Arbeitszeitnachweis. */
export type PdfVariant = 'timesheet' | 'report';

/**
 * Erstellt das PDF und bietet es zum Teilen (mobil) oder Herunterladen an.
 * Wird bei Bedarf dynamisch geladen, damit @react-pdf nicht im Start-Bundle landet.
 */
export async function exportMonthlyPdf(
  variant: PdfVariant,
  props: Omit<MonthlyReportProps, 'createdOn'> & { ctx: CalculationContext },
): Promise<void> {
  const { ctx, ...rest } = props;
  const { month, days, profile } = rest;
  const document =
    variant === 'timesheet' ? (
      <TimesheetPdf month={month} days={days} profile={profile} />
    ) : (
      <MonthlyReportPdf {...rest} createdOn={ctx.today} />
    );
  const blob = await pdf(document).toBlob();
  const prefix = variant === 'timesheet' ? 'Arbeitsaufschreibung' : 'Arbeitszeitnachweis';
  const fileName = `${prefix}_${month.year}-${String(month.month).padStart(2, '0')}_${profile.lastName}.pdf`
    .replace(/\s+/g, '_');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  await shareOrDownload(file);
}
