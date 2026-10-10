import { fitContainer, type FitItem, type FitResult, type Placement } from './containerFit';
import type { Carton, ContainerType } from './types';

export interface LoadStep extends Placement {
  serial: string;
  label: string; // human placement hint, e.g. "แถว 7 · ซ้าย · ล่าง"
}

export interface LoadPlan {
  fit: FitResult;
  steps: LoadStep[];
  unplaced: string[];
}

const PACK_PRIORITY: Record<string, number> = { A1: 0, A6: 1, A7: 2 };

/**
 * Build the load sequence for a container: PO groups stay together (in the order given),
 * larger pack codes go first within a group so heavier cartons end up lower / deeper.
 */
export function buildLoadPlan(cartons: Carton[], type: ContainerType['code']): LoadPlan {
  const poOrder: string[] = [];
  cartons.forEach((c) => {
    if (!poOrder.includes(c.poNo)) poOrder.push(c.poNo);
  });
  const sorted = [...cartons].sort((a, b) => {
    const g = poOrder.indexOf(a.poNo) - poOrder.indexOf(b.poNo);
    if (g) return g;
    const p = (PACK_PRIORITY[a.cartonCode] ?? 9) - (PACK_PRIORITY[b.cartonCode] ?? 9);
    if (p) return p;
    return a.serial.localeCompare(b.serial);
  });

  // Merge consecutive cartons with identical dimensions + group into one FitItem.
  const items: (FitItem & { serials: string[] })[] = [];
  for (const c of sorted) {
    const last = items[items.length - 1];
    if (last && last.group === c.poNo && last.lengthCm === c.lengthCm && last.widthCm === c.widthCm && last.heightCm === c.heightCm) {
      last.count += 1;
      last.serials.push(c.serial);
    } else {
      items.push({ key: `${c.poNo}:${c.cartonCode}`, group: c.poNo, lengthCm: c.lengthCm, widthCm: c.widthCm, heightCm: c.heightCm, grossKg: c.grossKg, count: 1, serials: [c.serial] });
    }
  }

  const fit = fitContainer(items, type);
  const queue = items.flatMap((it) => it.serials.map((s) => ({ key: it.key, serial: s })));
  const steps: LoadStep[] = [];
  let qi = 0;
  const byKey = new Map<string, string[]>();
  queue.forEach((q) => byKey.set(q.key, [...(byKey.get(q.key) ?? []), q.serial]));
  const used = new Map<string, number>();
  for (const p of fit.placements) {
    const list = byKey.get(p.key) ?? [];
    const i = used.get(p.key) ?? 0;
    used.set(p.key, i + 1);
    const serial = list[i] ?? queue[qi]?.serial ?? '';
    qi++;
    steps.push({ ...p, serial, label: placementLabel(p, type) });
  }
  const placed = new Set(steps.map((s) => s.serial));
  return { fit, steps, unplaced: sorted.filter((c) => !placed.has(c.serial)).map((c) => c.serial) };
}

function placementLabel(p: Placement, type: ContainerType['code']): string {
  const widths: Record<string, number> = { '20GP': 235, '40GP': 235, '40HC': 235, '45HC': 235 };
  const W = widths[type];
  const row = Math.floor(p.x / 120) + 1; // ~1.2 m bands along the container
  const mid = p.y + p.w / 2;
  const side = mid < W / 3 ? 'ซ้าย' : mid > (2 * W) / 3 ? 'ขวา' : 'กลาง';
  const level = p.z < 1 ? 'ล่าง' : p.z < 120 ? 'กลาง' : 'บน';
  return `แถว ${row} · ${side} · ${level}`;
}
