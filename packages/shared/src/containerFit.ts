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
  let seq = 0;
  let weightKg = 0;
  let cartonVolume = 0;
  let total = 0;

  // The wall currently being filled. Columns run across the container width; each column
  // stacks cartons upwards. Any carton whose footprint fits the wall's column (depth and width)
  // keeps filling it, so pack codes sharing a footprint (e.g. A6 / A7) don't waste a new wall.
  let wall: { x: number; depth: number; across: number; heights: number[]; counts: number[] } | null = null;
  let x = 0; // where the next wall starts

  const openWall = (o: Orientation) => {
    if (wall) x = wall.x + wall.depth;
    if (x + o.depth > L + 1e-6) return false;
    wall = { x, depth: o.depth, across: o.across, heights: new Array(o.cols).fill(0), counts: new Array(o.cols).fill(0) };
    return true;
  };

  for (const item of items) {
    total += item.count;
    let remaining = item.count;
    const o = bestOrientation(item, W, H);
    if (!o) {
      overflow.push({ key: item.key, count: remaining });
      continue;
    }
    const fitsWall = () => {
      const w = wall as { depth: number; across: number } | null;
      if (!w) return false;
      // same column width either way round; depth must not exceed the wall
      if (o.across <= w.across + 0.5 && o.depth <= w.depth + 0.5) return true;
      return o.depth <= w.across + 0.5 && o.across <= w.depth + 0.5;
    };
    const maxStack = item.maxStack ?? Number.POSITIVE_INFINITY;
    let full = false;
    while (remaining > 0 && !full) {
      if (weightKg + item.grossKg > c.maxPayloadKg) break;
      if (!fitsWall() && !openWall(o)) break;
      const w = wall as unknown as { x: number; depth: number; across: number; heights: number[]; counts: number[] };
      // lowest column that still has room — fills level by level
      let col = -1;
      for (let i = 0; i < w.heights.length; i++) {
        if (w.heights[i] + item.heightCm <= H + 1e-6 && w.counts[i] < maxStack && (col < 0 || w.heights[i] < w.heights[col] - 0.01)) col = i;
      }
      if (col < 0) {
        if (!openWall(o)) full = true;
        continue;
      }
      const sameWay = o.across <= w.across + 0.5;
      seq += 1;
      weightKg += item.grossKg;
      cartonVolume += item.lengthCm * item.widthCm * item.heightCm;
      placements.push({
        seq,
        key: item.key,
        group: item.group,
        x: w.x,
        y: col * w.across,
        z: w.heights[col],
        l: sameWay ? o.depth : o.across,
        w: sameWay ? o.across : o.depth,
        h: item.heightCm,
      });
      w.heights[col] += item.heightCm;
      w.counts[col] += 1;
      remaining -= 1;
    }
    if (remaining > 0) overflow.push({ key: item.key, count: remaining });
  }
  const finalWall = wall as { x: number; depth: number } | null;
  if (finalWall) x = finalWall.x + finalWall.depth;

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
