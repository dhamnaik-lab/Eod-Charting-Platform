import type { InstrumentKey } from '@/platform';
import type { ChartTimeframe } from '@/engine/types';

export function buildChartScreenshotFileName(
  instrument: InstrumentKey | null,
  timeframe: ChartTimeframe,
  capturedAt = new Date(),
): string {
  const subject = instrument ? `${instrument.exchange}_${instrument.symbol}` : 'chart';
  const timestamp = [
    capturedAt.getFullYear(),
    String(capturedAt.getMonth() + 1).padStart(2, '0'),
    String(capturedAt.getDate()).padStart(2, '0'),
    String(capturedAt.getHours()).padStart(2, '0'),
    String(capturedAt.getMinutes()).padStart(2, '0'),
    String(capturedAt.getSeconds()).padStart(2, '0'),
  ].join('');

  return `${sanitizeFileSegment(subject)}_${timeframe}_${timestamp}.png`;
}

export function pngBase64FromCanvas(canvas: HTMLCanvasElement): string {
  const prefix = 'data:image/png;base64,';
  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl.startsWith(prefix)) {
    throw new Error('The chart screenshot could not be encoded as PNG.');
  }

  return dataUrl.slice(prefix.length);
}

export async function copyCanvasPngToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Copying images is not supported by this desktop runtime.');
  }

  const image = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('The chart screenshot could not be encoded as PNG.'));
    }, 'image/png');
  });

  await navigator.clipboard.write([new ClipboardItem({ 'image/png': image })]);
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, fileName: string): void {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = fileName;
  link.click();
}

function sanitizeFileSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'chart';
}
