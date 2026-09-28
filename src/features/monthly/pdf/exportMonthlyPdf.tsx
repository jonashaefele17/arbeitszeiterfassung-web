import { pdf } from '@react-pdf/renderer';
import type { CalculationContext } from '../../../domain/calculations/context';
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

  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Teilen nicht möglich (z. B. abgelaufene Nutzergeste) → Download als Fallback.
    }
  }
  download(file);
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
