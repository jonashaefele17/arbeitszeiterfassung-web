import { pdf } from '@react-pdf/renderer';
import type { CalculationContext } from '../../../domain/calculations/context';
import { shareOrDownload } from '../../../utils/shareFile';
import { MonthlyReportPdf, type MonthlyReportProps } from './MonthlyReportPdf';

/**
 * Erstellt das PDF und bietet es zum Teilen (mobil) oder Herunterladen an.
 * Wird bei Bedarf dynamisch geladen, damit @react-pdf nicht im Start-Bundle landet.
 */
export async function exportMonthlyPdf(
  props: Omit<MonthlyReportProps, 'createdOn'> & { ctx: CalculationContext },
): Promise<void> {
  const { ctx, ...rest } = props;
  const blob = await pdf(<MonthlyReportPdf {...rest} createdOn={ctx.today} />).toBlob();
  const { month, profile } = rest;
  const fileName = `Arbeitszeitnachweis_${month.year}-${String(month.month).padStart(2, '0')}_${profile.lastName}.pdf`
    .replace(/\s+/g, '_');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  await shareOrDownload(file);
}
