import { SHIP_METHOD_CODES } from './constants';
import type { ControlTotals, PlanCartonRange } from './types';

/**
 * Packing Plan import.
 * Two input shapes are supported:
 *  1. Tabular rows (Excel / CSV export from the vendor portal) — preferred.
 *  2. Text of the vendor's PDF report (SSRS "Packing Plan" layout, text extracted with layout kept).
 * Both produce ParsedPlan objects that go through the same validation.
 * Field mapping: docs/06-packing-plan-format.md
 */

export interface ParsedPlanHeader {
  planRef: string;
  poNo: string;
  poLine: string;
  shipmentDate: string | null; // ISO yyyy-mm-dd
  vendorFactoryCode: string | null;
  shipToCode: string | null;
  destination: string | null;
  description: string | null;
}

export interface ParsedPlan {
  header: ParsedPlanHeader;
  summary: ControlTotals | null; // PO SUMMARY block as printed (control totals)
  ranges: PlanCartonRange[];
}

export type CheckLevel = 'ok' | 'warn' | 'error';

export interface PlanCheck {
  key: string;
  label: string;
  document: string;
  computed: string;
  level: CheckLevel;
  note?: string;
}

export interface PlanValidation {
  level: CheckLevel;
  checks: PlanCheck[];
  computed: ControlTotals;
  /** Whether weights on detail lines are per carton or per range (decided by matching the summary). */
  weightBasis: 'per_carton' | 'per_range' | 'unknown';
  shipMethod: 'SEA' | 'AIR' | 'TRUCK' | null;
}

// ---------------------------------------------------------------- helpers

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

function toIsoDate(d: string): string | null {
  const m = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

export function rangeCbm(r: Pick<PlanCartonRange, 'lengthCm' | 'widthCm' | 'heightCm' | 'cartonCount'>) {
  return (r.lengthCm * r.widthCm * r.heightCm * r.cartonCount) / 1_000_000;
}

// ---------------------------------------------------------------- tabular rows

/** Accepted column names (lower-cased, spaces/punctuation removed) for each field. */
const ALIASES: Record<keyof PlanCartonRange, string[]> = {
  rangeNo: ['range', 'rangeno', 'rang'],
  cartonFrom: ['from', 'cartonfrom', 'ctnfrom'],
  cartonTo: ['to', 'cartonto', 'ctnto'],
  serialFrom: ['serialfrom', 'serialnofrom', 'serial'],
  serialTo: ['serialto', 'serialnoto'],
  lineNo: ['line', 'lineno', 'line#'],
  style: ['buyeritem', 'buyeritem#', 'style', 'item'],
  poNo: ['po', 'po#', 'ponumber', 'pono'],
  poLine: ['mainline', 'mainline#', 'poline'],
  color: ['colorname', 'color', 'colour'],
  size: ['size'],
  styleColor: ['shortdescription', 'stylecolor'],
  shipMethod: ['shipmentmethod', 'shipmethod'],
  itemQty: ['itemqty', 'qty'],
  qtyPerCarton: ['qtyperpkg', 'qtyperpkginnerpack', 'qtypercarton'],
  innerPkgCount: ['innerpkgcount'],
  cartonCount: ['pkgcount', 'cartons', 'cartoncount'],
  cartonCode: ['packcode', 'cartoncode'],
  netNetKg: ['netnet'],
  netKg: ['net'],
  grossKg: ['gross'],
  lengthCm: ['l', 'length'],
  widthCm: ['w', 'width'],
  heightCm: ['h', 'height'],
};

const normKey = (k: string) => k.toLowerCase().replace(/[\s_./()-]/g, '');

export function parsePlanRows(rows: Record<string, unknown>[]): ParsedPlan[] {
  if (rows.length === 0) return [];
  const headerKeys = Object.keys(rows[0]);
  const colFor = {} as Record<keyof PlanCartonRange, string | undefined>;
  (Object.keys(ALIASES) as (keyof PlanCartonRange)[]).forEach((field) => {
    colFor[field] = headerKeys.find((h) => ALIASES[field].includes(normKey(h)));
  });
  const get = (row: Record<string, unknown>, f: keyof PlanCartonRange) => (colFor[f] ? row[colFor[f] as string] : undefined);

  const byPlan = new Map<string, ParsedPlan>();
  rows.forEach((row, i) => {
    const poNo = str(get(row, 'poNo'));
    if (!poNo) return;
    const poLineRaw = str(get(row, 'poLine'));
    const poLine = String(Number(poLineRaw) || poLineRaw);
    const from = num(get(row, 'cartonFrom'));
    const to = num(get(row, 'cartonTo')) || from;
    const range: PlanCartonRange = {
      rangeNo: str(get(row, 'rangeNo')) || String(i + 1).padStart(4, '0'),
      cartonFrom: from,
      cartonTo: to,
      serialFrom: str(get(row, 'serialFrom')),
      serialTo: str(get(row, 'serialTo')) || str(get(row, 'serialFrom')),
      lineNo: str(get(row, 'lineNo')),
      style: str(get(row, 'style')),
      poNo,
      poLine: poLineRaw,
      color: str(get(row, 'color')),
      size: str(get(row, 'size')),
      styleColor: str(get(row, 'styleColor')),
      shipMethod: str(get(row, 'shipMethod')),
      itemQty: num(get(row, 'itemQty')),
      qtyPerCarton: num(get(row, 'qtyPerCarton')),
      innerPkgCount: get(row, 'innerPkgCount') ? num(get(row, 'innerPkgCount')) : null,
      cartonCount: num(get(row, 'cartonCount')) || to - from + 1,
      cartonCode: str(get(row, 'cartonCode')),
      netNetKg: num(get(row, 'netNetKg')),
      netKg: num(get(row, 'netKg')),
      grossKg: num(get(row, 'grossKg')),
      lengthCm: num(get(row, 'lengthCm')),
      widthCm: num(get(row, 'widthCm')),
      heightCm: num(get(row, 'heightCm')),
    };
    const planRef = `${poNo}-${poLine}`;
    if (!byPlan.has(planRef)) {
      byPlan.set(planRef, {
        header: { planRef, poNo, poLine, shipmentDate: null, vendorFactoryCode: null, shipToCode: null, destination: null, description: null },
        summary: null,
        ranges: [],
      });
    }
    byPlan.get(planRef)!.ranges.push(range);
  });
  return [...byPlan.values()];
}

// ---------------------------------------------------------------- PDF text (SSRS layout)

const DETAIL_RE =
  /^\s*(\d{4})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d{4})\s+(\S+)\s+(\d{6,})\s+(\d{3,})\s+(.+?)\s{2,}(\S+)\s+(\S+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(?:([\d.]+)\s+)?([\d.]+)\s+([A-Z]\w*)\s+((?:[\d.]+\s+){1,2})([\d.]+)\s+KG\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+CM/;

const SUMMARY_RE =
  /^\s*(\d{6,})\s+(\d+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+KG\s+([\d.,]+)\s+CBM/m;

export function parsePackingPlanText(text: string): ParsedPlan | null {
  const planRefMatch = text.match(/Plan Ref Number\s+(\S+)/);
  if (!planRefMatch) return null;
  const planRef = planRefMatch[1];

  const ship = text.match(/SHIPMENT\s+(\d{1,2}\/\d{1,2}\/\d{4})[ \t]*([^\n]*)/);
  const summary = text.match(SUMMARY_RE);
  const desc = text.match(/DESCRIPTION\s*:\s*([^\n]+)/);

  // Right-hand box: a short code line (e.g. "NO CAB") and a destination line ("CITY, ST,COUNTRY").
  const lines = text.split(/\r?\n/);
  const destLine = lines.map((l) => l.trim()).find((l) => /^[A-Z][A-Z .'-]+,\s*[A-Z]{2}\s*,\s*[A-Z ]+$/.test(l));
  // Ship-to code: a short all-caps line (1–3 words) inside the PO SUMMARY block that is not a column header.
  const summaryBlock = text.slice(text.indexOf('PO SUMMARY') + 10, text.indexOf('PACKING DETAIL') > 0 ? text.indexOf('PACKING DETAIL') : undefined);
  const shipToLine = summaryBlock
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /^[A-Z]{2,}(?: [A-Z]{2,}){0,2}$/.test(l) && !/^(PO|KG|CBM|TOTALS?|UNIT)\b/.test(l));
  const shipTo = shipToLine ? [shipToLine, shipToLine] : null;

  const ranges: PlanCartonRange[] = [];
  for (const line of lines) {
    const m = line.match(DETAIL_RE);
    if (!m) continue;
    const weights = m[19].trim().split(/\s+/).map(Number); // [netNet?, net]
    const net = weights[weights.length - 1];
    const netNet = weights.length > 1 ? weights[0] : 0;
    ranges.push({
      rangeNo: m[1],
      cartonFrom: Number(m[2]),
      cartonTo: Number(m[3]),
      serialFrom: m[4],
      serialTo: m[5],
      lineNo: m[6],
      style: m[7],
      poNo: m[8],
      poLine: m[9],
      color: m[10].trim(),
      size: m[11],
      styleColor: m[12],
      shipMethod: m[13],
      itemQty: Number(m[14]),
      qtyPerCarton: Number(m[15]),
      innerPkgCount: m[16] ? Number(m[16]) : null,
      cartonCount: Number(m[17]),
      cartonCode: m[18],
      netNetKg: netNet,
      netKg: net,
      grossKg: Number(m[20]),
      lengthCm: Number(m[21]),
      widthCm: Number(m[22]),
      heightCm: Number(m[23]),
    });
  }

  const [poNo, poLine] = planRef.split('-');
  return {
    header: {
      planRef,
      poNo: summary?.[1] ?? poNo,
      poLine: summary?.[2] ?? poLine ?? '',
      shipmentDate: ship ? toIsoDate(ship[1]) : null,
      vendorFactoryCode: ship?.[2]?.trim() || null,
      shipToCode: shipTo?.[1] ?? null,
      destination: destLine ?? null,
      description: desc?.[1]?.trim() ?? null,
    },
    summary: summary
      ? {
          itemQty: num(summary[3]),
          cartons: num(summary[4]),
          netNetKg: num(summary[5]),
          netKg: num(summary[6]),
          grossKg: num(summary[7]),
          cbm: num(summary[8]),
        }
      : null,
    ranges,
  };
}

// ---------------------------------------------------------------- validation

const near = (a: number, b: number, tol = 0.011) => Math.abs(a - b) <= tol;

export function validatePlan(plan: ParsedPlan, cbmTolerancePct = 3): PlanValidation {
  const r = plan.ranges;
  const sum = (f: (x: PlanCartonRange) => number) => r.reduce((s, x) => s + f(x), 0);
  const perCarton = { gross: sum((x) => x.grossKg * x.cartonCount), net: sum((x) => x.netKg * x.cartonCount), netNet: sum((x) => x.netNetKg * x.cartonCount) };
  const perRange = { gross: sum((x) => x.grossKg), net: sum((x) => x.netKg), netNet: sum((x) => x.netNetKg) };

  let weightBasis: PlanValidation['weightBasis'] = 'unknown';
  let w = perCarton;
  if (plan.summary) {
    if (near(perCarton.gross, plan.summary.grossKg)) weightBasis = 'per_carton';
    else if (near(perRange.gross, plan.summary.grossKg)) {
      weightBasis = 'per_range';
      w = perRange;
    }
  }

  const computed: ControlTotals = {
    itemQty: sum((x) => x.itemQty),
    cartons: sum((x) => x.cartonCount),
    netNetKg: round(w.netNet, 3),
    netKg: round(w.net, 3),
    grossKg: round(w.gross, 3),
    cbm: round(sum(rangeCbm), 4),
  };

  const checks: PlanCheck[] = [];
  const s = plan.summary;
  const cmp = (key: string, label: string, doc: number | undefined, calc: number, tol = 0.011) => {
    if (doc === undefined) {
      checks.push({ key, label, document: '—', computed: String(calc), level: 'warn', note: 'ไม่มียอดสรุปให้เทียบ' });
      return;
    }
    checks.push({ key, label, document: fmt(doc), computed: fmt(calc), level: near(doc, calc, tol) ? 'ok' : 'error' });
  };
  cmp('itemQty', 'จำนวนชิ้น (Item Qty)', s?.itemQty, computed.itemQty);
  cmp('cartons', 'จำนวนกล่อง (Pkg)', s?.cartons, computed.cartons);
  cmp('netKg', 'Net kg', s?.netKg, computed.netKg);
  cmp('grossKg', 'Gross kg', s?.grossKg, computed.grossKg);

  if (s) {
    const diffPct = s.cbm ? (Math.abs(computed.cbm - s.cbm) / s.cbm) * 100 : 0;
    checks.push({
      key: 'cbm',
      label: 'ปริมาตร CBM (จาก L×W×H)',
      document: fmt(s.cbm),
      computed: fmt(round(computed.cbm, 3)),
      level: diffPct === 0 ? 'ok' : diffPct <= cbmTolerancePct ? 'warn' : 'error',
      note: diffPct ? `ต่าง ${diffPct.toFixed(1)}%` : undefined,
    });
  }

  // Range integrity: carton numbers and serials must agree with the carton count.
  r.forEach((x) => {
    const byNumber = x.cartonTo - x.cartonFrom + 1;
    const bySerial = Number(x.serialTo) - Number(x.serialFrom) + 1;
    if (byNumber !== x.cartonCount) {
      checks.push({ key: `range-${x.rangeNo}`, label: `Range ${x.rangeNo}: From–To`, document: String(x.cartonCount), computed: String(byNumber), level: 'error' });
    }
    if (Number.isFinite(bySerial) && bySerial !== x.cartonCount) {
      checks.push({ key: `serial-${x.rangeNo}`, label: `Range ${x.rangeNo}: Serial`, document: String(x.cartonCount), computed: String(bySerial), level: 'warn', note: 'serial ไม่ต่อเนื่อง' });
    }
  });

  if (r.length === 0) checks.push({ key: 'rows', label: 'รายการกล่อง', document: '—', computed: '0', level: 'error', note: 'อ่านรายละเอียดไม่ได้' });

  const level: CheckLevel = checks.some((c) => c.level === 'error') ? 'error' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok';
  const methodCode = r[0]?.shipMethod ?? '';
  return { level, checks, computed, weightBasis, shipMethod: SHIP_METHOD_CODES[methodCode] ?? null };
}

/** Expand ranges to individual carton serials (for reservation & scanning). */
export function expandSerials(range: Pick<PlanCartonRange, 'serialFrom' | 'serialTo' | 'cartonCount'>): string[] {
  const a = Number(range.serialFrom);
  const b = Number(range.serialTo);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [range.serialFrom];
  const width = range.serialFrom.length;
  const out: string[] = [];
  for (let s = a; s <= b; s++) out.push(String(s).padStart(width, '0'));
  return out;
}

function round(n: number, d: number) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : String(round(n, 3));
}
