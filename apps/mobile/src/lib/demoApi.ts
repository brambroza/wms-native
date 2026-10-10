import { buildLoadPlan, demoData, type Carton, type Container } from '@wms/shared';
import type { WmsApi } from './api';
import type { ScanResponse, StaffCarton, StaffContainer } from './types';

/**
 * In-memory backend for โหมดทดลอง. Mirrors the rules of the `scan_carton` /
 * `close_container` SQL functions closely enough to train staff on the flow.
 * State lives for the app session only.
 */
interface DemoState {
  containers: Container[];
  cartons: Carton[];
  locCodeById: Map<string, string>;
  locIdByCode: Map<string, { id: string; warehouseId: string }>;
  seq: Map<string, { seq: number; label: string }>;
  txns: Map<string, ScanResponse>;
  listeners: Map<string, Set<() => void>>;
}

let state: DemoState | null = null;

function init(): DemoState {
  // deep copy so the shared cached dataset is never mutated
  const src = JSON.parse(JSON.stringify(demoData())) as ReturnType<typeof demoData>;
  const locCodeById = new Map(src.locations.map((l) => [l.id, l.code]));
  const locIdByCode = new Map(src.locations.map((l) => [l.code, { id: l.id, warehouseId: l.warehouseId }]));
  const seq = new Map<string, { seq: number; label: string }>();

  for (const ct of src.containers) {
    const mine = src.cartons.filter((c) => c.containerId === ct.id);
    if (!mine.length) continue;
    const plan = buildLoadPlan(mine, ct.type);
    const order = [...plan.steps.map((s) => ({ serial: s.serial, label: s.label })), ...plan.unplaced.map((s) => ({ serial: s, label: 'ไม่พอที่ · แจ้งหัวหน้า' }))];
    order.forEach((o, i) => seq.set(o.serial, { seq: i + 1, label: o.label }));
    // keep the seeded progress but make it follow the load sequence
    const loadedN = mine.filter((c) => c.status === 'LOADED').length;
    const bySerial = new Map(mine.map((c) => [c.serial, c]));
    const rest = mine.find((c) => c.status !== 'LOADED' && c.status !== 'HOLD');
    const restStatus = rest?.status ?? 'STAGED';
    const restLoc = rest?.locationId ?? null;
    order.forEach((o, i) => {
      const c = bySerial.get(o.serial);
      if (!c || c.status === 'HOLD') return;
      if (i < loadedN) {
        c.status = 'LOADED';
        c.locationId = null;
      } else if (c.status === 'LOADED') {
        c.status = restStatus;
        c.locationId = restLoc;
      }
    });
  }
  return { containers: src.containers, cartons: src.cartons, locCodeById, locIdByCode, seq, txns: new Map(), listeners: new Map() };
}

function s(): DemoState {
  if (!state) state = init();
  return state;
}

function refreshCounts(st: DemoState, containerId: string) {
  const ct = st.containers.find((c) => c.id === containerId);
  if (!ct) return;
  const mine = st.cartons.filter((c) => c.containerId === containerId);
  const loaded = mine.filter((c) => c.status === 'LOADED' || c.status === 'SHIPPED');
  ct.plannedCartons = mine.length;
  ct.loadedCartons = loaded.length;
  ct.loadedKg = Math.round(loaded.reduce((sum, c) => sum + c.grossKg, 0));
  st.listeners.get(containerId)?.forEach((fn) => fn());
}

function toStaffContainer(c: Container): StaffContainer {
  return {
    id: c.id,
    code: c.code,
    type: c.type,
    status: c.status,
    dock: c.dock,
    sealNo: c.sealNo,
    plannedCartons: c.plannedCartons,
    loadedCartons: c.loadedCartons,
    fillVolumePct: c.fillVolumePct,
    loadedKg: c.loadedKg,
    etaDone: c.etaDone,
  };
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function scanLocally(st: DemoState, action: string, serial: string, containerId: string | null, locationCode: string | null): ScanResponse {
  const fail = (code: string, message: string): ScanResponse => ({ ok: false, duplicate: false, code, message });
  const c = st.cartons.find((x) => x.serial === serial.trim());
  if (!c) return fail('NOT_FOUND', `ไม่พบกล่อง serial ${serial} ในระบบ`);
  let loc: { id: string; warehouseId: string } | undefined;
  if (locationCode) {
    loc = st.locIdByCode.get(locationCode.trim().toUpperCase());
    if (!loc) return fail('LOCATION_NOT_FOUND', `ไม่พบตำแหน่ง ${locationCode}`);
  }
  let msg = '';
  switch (action) {
    case 'RECEIVE':
      if (!['IN_TRANSIT', 'AVAILABLE', 'RESERVED'].includes(c.status)) return fail('BAD_STATUS', `กล่องนี้สถานะ ${c.status} รับเข้าไม่ได้`);
      c.status = c.planId ? 'RESERVED' : 'AVAILABLE';
      if (loc) c.warehouseId = loc.warehouseId;
      c.locationId = loc?.id ?? null;
      msg = 'รับเข้าแล้ว';
      break;
    case 'PUTAWAY':
      if (!loc) return fail('LOCATION_REQUIRED', 'ต้องสแกนตำแหน่งที่วาง');
      if (c.status === 'LOADED' || c.status === 'SHIPPED') return fail('BAD_STATUS', 'กล่องนี้ขึ้นตู้แล้ว');
      c.locationId = loc.id;
      c.warehouseId = loc.warehouseId;
      msg = `วางที่ ${locationCode?.toUpperCase()}`;
      break;
    case 'PICK':
      if (containerId && c.containerId !== containerId) return fail('WRONG_CONTAINER', 'กล่องนี้ไม่อยู่ในงานหยิบของตู้นี้');
      if (!['AVAILABLE', 'RESERVED', 'PICKED'].includes(c.status)) return fail('BAD_STATUS', `กล่องนี้สถานะ ${c.status} หยิบไม่ได้`);
      c.status = 'PICKED';
      c.locationId = null;
      msg = 'หยิบแล้ว';
      break;
    case 'STAGE':
      if (!loc) return fail('LOCATION_REQUIRED', 'ต้องสแกนช่อง Staging');
      c.status = 'STAGED';
      c.locationId = loc.id;
      msg = `วางที่ ${locationCode?.toUpperCase()}`;
      break;
    case 'LOAD': {
      const ct = st.containers.find((x) => x.id === containerId);
      if (!ct) return fail('CONTAINER_REQUIRED', 'ไม่พบตู้');
      if (ct.status === 'CLOSED') return fail('CONTAINER_CLOSED', 'ตู้นี้ปิดแล้ว');
      if (c.containerId !== ct.id) return fail('WRONG_CONTAINER', `กล่องนี้ไม่อยู่ในแผนตู้ ${ct.code}`);
      if (c.status === 'LOADED') {
        msg = 'กล่องนี้ขึ้นตู้แล้ว';
        break;
      }
      if (c.status === 'HOLD') return fail('ON_HOLD', 'กล่องนี้ถูก Hold');
      c.status = 'LOADED';
      c.locationId = null;
      ct.status = 'LOADING';
      refreshCounts(st, ct.id);
      msg = `ขึ้นตู้ ${ct.code}`;
      break;
    }
    case 'UNLOAD':
      if (c.status !== 'LOADED') return fail('BAD_STATUS', 'กล่องนี้ยังไม่ได้ขึ้นตู้');
      c.status = 'STAGED';
      if (c.containerId) refreshCounts(st, c.containerId);
      msg = 'ถอดออกจากตู้แล้ว';
      break;
    default:
      return fail('BAD_ACTION', 'action ไม่ถูกต้อง');
  }
  const res: ScanResponse = {
    ok: true,
    duplicate: false,
    message: msg,
    carton: { serial: c.serial, style: c.style, size: c.size, cartonCode: c.cartonCode, poNo: c.poNo, status: c.status },
  };
  const ct = c.containerId ? st.containers.find((x) => x.id === c.containerId) : undefined;
  if (ct) {
    res.loadedCartons = ct.loadedCartons;
    res.plannedCartons = ct.plannedCartons;
  }
  return res;
}

export function createDemoApi(): WmsApi {
  return {
    mode: 'demo',

    async listContainers() {
      await delay(80);
      return s().containers.map(toStaffContainer);
    },

    async getContainer(id) {
      const c = s().containers.find((x) => x.id === id);
      return c ? toStaffContainer(c) : null;
    },

    async listContainerCartons(containerId) {
      await delay(80);
      const st = s();
      return st.cartons
        .filter((c) => c.containerId === containerId)
        .map<StaffCarton>((c) => ({
          serial: c.serial,
          style: c.style,
          size: c.size,
          cartonCode: c.cartonCode,
          poNo: c.poNo,
          status: c.status,
          locationCode: c.locationId ? (st.locCodeById.get(c.locationId) ?? c.locationId) : null,
          containerId: c.containerId,
          loadSeq: st.seq.get(c.serial)?.seq ?? null,
          loadLabel: st.seq.get(c.serial)?.label ?? null,
          grossKg: c.grossKg,
        }));
    },

    async scan(req) {
      await delay(60);
      const st = s();
      const prev = st.txns.get(req.clientTxnId);
      if (prev) return { ...prev, duplicate: true };
      const res = scanLocally(st, req.action, req.serial, req.containerId, req.locationCode);
      st.txns.set(req.clientTxnId, res);
      return res;
    },

    async closeContainer(containerId, sealNo) {
      const st = s();
      const ct = st.containers.find((x) => x.id === containerId);
      if (!ct) return { ok: false, message: 'ไม่พบตู้' };
      const left = st.cartons.filter((c) => c.containerId === containerId && c.status !== 'LOADED' && c.status !== 'SHIPPED').length;
      if (left > 0) return { ok: false, message: `ยังไม่ได้โหลดอีก ${left} กล่อง` };
      st.cartons.filter((c) => c.containerId === containerId).forEach((c) => (c.status = 'SHIPPED'));
      ct.status = 'CLOSED';
      ct.sealNo = sealNo;
      refreshCounts(st, containerId);
      return { ok: true, message: 'ปิดตู้แล้ว' };
    },

    subscribeContainer(containerId, onChange) {
      const st = s();
      const set = st.listeners.get(containerId) ?? new Set<() => void>();
      set.add(onChange);
      st.listeners.set(containerId, set);
      return () => {
        set.delete(onChange);
      };
    },
  };
}

/** Reset demo data (used on sign-out). */
export function resetDemo(): void {
  state = null;
}
