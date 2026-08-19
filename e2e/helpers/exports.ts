import type { BrowserContext } from '@playwright/test';

export async function captureExportTab(
  context: BrowserContext,
  trigger: () => Promise<void>,
): Promise<string> {
  const [popup] = await Promise.all([context.waitForEvent('page'), trigger()]);
  await popup.waitForURL((url) => url.href !== 'about:blank', { timeout: 60_000 });
  const url = popup.url();
  await popup.close();
  return url;
}

export interface ExportEnvelope {
  DocumentURL?: string;
  PdfDocumentURL?: string;
  XlsxDocument?: string;
  URL?: string;
  url?: string;
}

export function exportDocumentUrl(body: ExportEnvelope): string {
  const url = body.DocumentURL ?? body.XlsxDocument ?? body.URL ?? body.url ?? body.PdfDocumentURL;
  if (!url) {
    throw new Error(`Export response has no document URL: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return url;
}
