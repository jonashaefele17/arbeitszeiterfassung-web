/**
 * Bietet eine Datei zum Teilen (mobil, Share-Sheet) oder Herunterladen (Desktop/Fallback) an.
 */
export async function shareOrDownload(file: File): Promise<void> {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
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
