import { CONTAINER_TYPES } from './constants';
import type { ContainerType } from './types';

/**
 * Container fit — carton-level wall building (MVP).
 *
 * Cartons are loaded in "walls": slices across the container width/height,
 * filled from the front wall (x = 0, behind the truck cab) towards the doors.
 * Items are processed in the order given, so callers pass them in load order
 * (e.g. heavy/large pack codes first, PO groups together, branch goods last).
 *
 * Cartons stay upright; each item may rotate 90° around the vertical axis.
 */

export interface FitItem {
  key: string; // e.g. pack code or plan ref + pack code
  group: string; // colour group (PO) for display
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  grossKg: number;
  count: number;
  maxStack?: number;
}

export interface Placement {
  seq: number; // 1-based load sequence
  key: string;
  group: string;
  x: number; // cm from front wall
  y: number; // cm from left wall (looking from the doors)
  z: number; // cm from floor
  l: number;
  w: number;
  h: number;
}

export interface FitResult {
  containerType: ContainerType['code'];
  placements: Placement[];
  placedCartons: number;
  totalCartons: number;
  overflow: { key: string; count: number }[];
  volumeUsedPct: number;
  weightKg: number;
  weightPct: number;
  lengthUsedCm: number;
  freeLengthCm: number;
}

interface Orientation {
  depth: number; // along container length
  across: number; // along container width
  cols: number;
  levels: number;
  perWall: number;
}

function bestOrientation(item: FitItem, W: number, H: number): Orientation | null {
  const levels = Math.min(Math.floor(H / item.heightCm), item.maxStack ?? Number.POSITIVE_INFINITY);
  if (levels < 1) return null;
  const options: Orientation[] = [
    { depth: item.lengthCm, across: item.widthCm },
    { depth: item.widthCm, across: item.lengthCm },
  ]
    .map((o) => {
      const cols = Math.floor(W / o.across);
      return { ...o, cols, levels, perWall: cols * levels };
    })
    .filter((o) => o.cols > 0);
  if (options.length === 0) return null;
  // Most cartons per cm of container length used.
  options.sort((a, b) => b.perWall / b.depth - a.perWall / a.depth);
  return options[0];
}

export function fitContainer(items: FitItem[], type: ContainerType['code'] = '40HC'): FitResult {
  const c = CONTAINER_TYPES[type];
  const L = c.innerLengthCm;
  const W = c.innerWidthCm;
  const H = c.innerHeightCm;

  const placements: Placement[] = [];
  const overflow: { key: string; count: number }[] = [];
  let x = 0;
  let seq = 0;
  let weightKg = 0;
  let cartonVolume = 0;
  let total = 0;

  for (const item of items) {
    total += item.count;
    let remaining = item.count;
    const o = bestOrientation(item, W, H);
    if (!o) {
      overflow.push({ key: item.key, count: remaining });
      continue;
    }
    while (remaining > 0) {
      if (x + o.depth > L + 1e-6) break;
      const inWall = Math.min(remaining, o.perWall);
      for (let i = 0; i < inWall; i++) {
        // fill bottom level first, left to right, then go up
        const level = Math.floor(i / o.cols);
        const col = i % o.cols;
        if (weightKg + item.grossKg > c.maxPayloadKg) break;
        seq += 1;
        weightKg += item.grossKg;
        cartonVolume += item.lengthCm * item.widthCm * item.heightCm;
        placements.push({
          seq,
          key: item.key,
          group: item.group,
          x,
          y: col * o.across,
          z: level * item.heightCm,
          l: o.depth,
          w: o.across,
          h: item.heightCm,
        });
        remaining -= 1;
      }
      x += o.depth;
      if (weightKg + item.grossKg > c.maxPayloadKg) break;
    }
    if (remaining > 0) overflow.push({ key: item.key, count: remaining });
  }

  const containerVolume = L * W * H;
  return {
    containerType: type,
    placements,
    placedCartons: placements.length,
    totalCartons: total,
    overflow,
    volumeUsedPct: round1((cartonVolume / containerVolume) * 100),
    weightKg: round1(weightKg),
    weightPct: round1((weightKg / c.maxPayloadKg) * 100),
    lengthUsedCm: round1(x),
    freeLengthCm: round1(Math.max(0, L - x)),
  };
}

/** How many more cartons of a given size would fit in the free length left by a fit result. */
export function extraCapacity(result: FitResult, item: Omit<FitItem, 'count' | 'key' | 'group'>): number {
  const c = CONTAINER_TYPES[result.containerType];
  const o = bestOrientation({ ...item, key: '', group: '', count: 0 }, c.innerWidthCm, c.innerHeightCm);
  if (!o) return 0;
  const walls = Math.floor(result.freeLengthCm / o.depth);
  return walls * o.perWall;
}

/** Pick the smallest container type that fits everything, falling back to 40HC. */
export function suggestContainerType(items: FitItem[]): FitResult {
  const order: ContainerType['code'][] = ['20GP', '40GP', '40HC', '45HC'];
  for (const t of order) {
    const r = fitContainer(items, t);
    if (r.overflow.length === 0) return r;
  }
  return fitContainer(items, '40HC');
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
