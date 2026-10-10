import { parsePackingPlanText, parsePlanRows, type ParsedPlan, type PackingPlan } from '@wms/shared';

export interface FileParseResult {
  source: PackingPlan['source'];
  plans: ParsedPlan[];
  /** raw text (PDF) — kept for troubleshooting the layout parser */
  text?: string;
}

/**
 * Rebuilds layout-preserving text from pdf.js text items: items are grouped into lines by their
 * y position and joined with runs of spaces proportional to the horizontal gap, so the result
 * looks like `pdftotext -layout` and the shared SSRS parser can read it.
 */
export function itemsToLayoutText(items: { str: string; x: number; y: number; w: number }[]): string {
  const lines = new Map<number, typeof items>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const key = Math.round(it.y / 2.5);
    const arr = lines.get(key) ?? [];
    arr.push(it);
    lines.set(key, arr);
  }
  const charW = 3.2; // approx width of one space at the report's 7–8pt font
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0]) // pdf y grows upwards
    .map(([, arr]) => {
      arr.sort((a, b) => a.x - b.x);
      let out = '';
      let cursor = 0;
      for (const it of arr) {
        const gap = it.x - cursor;
        if (out) out += ' '.repeat(Math.max(1, Math.round(gap / charW)));
        out += it.str;
        cursor = it.x + it.w;
      }
      return out;
    })
    .join('\n');
}

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = content.items
      .filter((it): it is Extract<typeof it, { str: string }> => 'str' in it)
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width }));
    pages.push(itemsToLayoutText(items));
  }
  return pages.join('\n\f\n');
}

export async function parseImportFile(file: File): Promise<FileParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    const text = await pdfToText(file);
    // one PDF may hold several plans: split on the report title
    const chunks = text.split(/(?=Packing Plan\s*\n)/).filter((c) => /Plan Ref Number/.test(c));
    const plans = (chunks.length ? chunks : [text]).map(parsePackingPlanText).filter((p): p is ParsedPlan => p !== null);
    return { source: 'PDF', plans, text };
  }
  if (name.endsWith('.csv')) {
    const Papa = (await import('papaparse')).default;
    const res = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true });
    return { source: 'CSV', plans: parsePlanRows(res.data) };
  }
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    const rows = (await readSheet(file)) as unknown[][];
    const [head = [], ...body] = rows;
    const objs = body.map((r) => Object.fromEntries(head.map((h, i) => [String(h ?? `col${i}`), r[i] as unknown])));
    return { source: 'EXCEL', plans: parsePlanRows(objs) };
  }
  throw new Error('รองรับไฟล์ .pdf .xlsx และ .csv');
}
