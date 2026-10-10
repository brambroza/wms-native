import { CONTAINER_TYPES } from './constants';
import type {
  AgentAction,
  Carton,
  CartonStatus,
  Container,
  Decision,
  Location,
  PackingPlan,
  PlanCartonRange,
  Shipment,
  Warehouse,
} from './types';

/**
 * Deterministic demo dataset. Used when Supabase is not configured so the apps
 * run out of the box, and as the source for supabase/seed.sql.
 * All PO numbers, serials and names are fictitious.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const PACK_CODES = {
  A1: { l: 59.7, w: 39.7, h: 20.3 },
  A6: { l: 39.7, w: 30.5, h: 17.8 },
  A7: { l: 39.7, w: 30.5, h: 10.2 },
} as const;

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
/** multiplies the plan sizes below (per container) so containers reach realistic fill levels */
const SCALE: Record<string, number> = { 'ct-1': 6.0, 'ct-2': 9.3, 'ct-3': 14.8, 'ct-4': 14.6, 'ct-5': 28.5, '': 6 };

export interface DemoData {
  warehouses: Warehouse[];
  locations: Location[];
  shipments: Shipment[];
  plans: PackingPlan[];
  ranges: Record<string, PlanCartonRange[]>; // planId -> ranges
  cartons: Carton[];
  containers: Container[];
  actions: AgentAction[];
  decisions: Decision[];
}

let cache: DemoData | null = null;

export function demoData(): DemoData {
  if (cache) return cache;
  const rand = rng(42);

  const warehouses: Warehouse[] = [
    { id: 'wh-c', code: 'WH-C', name: 'คลังกลาง', type: 'CENTRAL' },
    { id: 'wh-a', code: 'WH-A', name: 'คลังสาขา โรงงาน A', type: 'BRANCH' },
    { id: 'wh-b', code: 'WH-B', name: 'คลังสาขา โรงงาน B', type: 'BRANCH' },
  ];

  const locations: Location[] = [];
  const rows = ['A', 'B', 'C', 'D'];
  rows.forEach((row, ri) => {
    for (let bay = 1; bay <= 10; bay++) {
      for (let level = 1; level <= 3; level++) {
        locations.push({
          id: `loc-${row}${bay}-${level}`,
          warehouseId: 'wh-c',
          code: `C-${row}${String(bay).padStart(2, '0')}-${level}`,
          kind: 'RACK',
          x: (bay - 1) * 1.3,
          y: ri * 2.6 + (ri >= 2 ? 0.6 : 0),
          z: (level - 1) * 1.1,
          capacityCartons: 160,
        });
      }
    }
  });
  ['A', 'B', 'C'].forEach((s, i) =>
    locations.push({ id: `stg-${s}`, warehouseId: 'wh-c', code: `STG-${s}`, kind: 'STAGING', x: i * 4, y: 11.5, z: 0, capacityCartons: 600 }),
  );
  [1, 2, 3].forEach((d, i) =>
    locations.push({ id: `dock-${d}`, warehouseId: 'wh-c', code: `DOCK-${d}`, kind: 'DOCK', x: i * 4, y: 13, z: 0, capacityCartons: 0 }),
  );
  ['wh-a', 'wh-b'].forEach((wh) => {
    for (let bay = 1; bay <= 6; bay++) {
      locations.push({ id: `${wh}-${bay}`, warehouseId: wh, code: `${wh === 'wh-a' ? 'A' : 'B'}-R${String(bay).padStart(2, '0')}`, kind: 'RACK', x: bay, y: 0, z: 0, capacityCartons: 80 });
    }
  });

  const shipments: Shipment[] = [
    { id: 'sh-1', shipmentDate: '2026-10-12', destination: 'MEMPHIS, TN, USA', shipToCode: '[SHIP-TO]', shipMethod: 'SEA' },
    { id: 'sh-2', shipmentDate: '2026-10-13', destination: 'LOS ANGELES, CA, USA', shipToCode: '[SHIP-TO]', shipMethod: 'SEA' },
    { id: 'sh-3', shipmentDate: '2026-10-14', destination: 'ROTTERDAM, NL', shipToCode: '[SHIP-TO]', shipMethod: 'SEA' },
  ];

  const containers: Container[] = [
    { id: 'ct-1', code: 'C1', shipmentId: 'sh-1', type: '40HC', containerNo: '[CONTAINER NO.]', sealNo: null, truckPlate: '[ทะเบียนรถ]', driverName: '[ชื่อคนขับ]', dock: 'DOCK-2', loadingWarehouseId: 'wh-c', status: 'LOADING', plannedCartons: 0, loadedCartons: 0, fillVolumePct: 0, loadedKg: 0, etaDone: '13:42' },
    { id: 'ct-2', code: 'C2', shipmentId: 'sh-1', type: '40HC', containerNo: '[CONTAINER NO.]', sealNo: null, truckPlate: '[ทะเบียนรถ]', driverName: '[ชื่อคนขับ]', dock: 'DOCK-3', loadingWarehouseId: 'wh-c', status: 'LOADING', plannedCartons: 0, loadedCartons: 0, fillVolumePct: 0, loadedKg: 0, etaDone: '15:10' },
    { id: 'ct-3', code: 'C3', shipmentId: 'sh-2', type: '20GP', containerNo: null, sealNo: null, truckPlate: null, driverName: null, dock: 'STG-B', loadingWarehouseId: 'wh-c', status: 'READY', plannedCartons: 0, loadedCartons: 0, fillVolumePct: 0, loadedKg: 0, etaDone: null },
    { id: 'ct-4', code: 'C4', shipmentId: 'sh-2', type: '40GP', containerNo: null, sealNo: null, truckPlate: null, driverName: null, dock: null, loadingWarehouseId: 'wh-a', status: 'PLANNED', plannedCartons: 0, loadedCartons: 0, fillVolumePct: 0, loadedKg: 0, etaDone: null },
    { id: 'ct-5', code: 'C5', shipmentId: 'sh-3', type: '40HC', containerNo: null, sealNo: null, truckPlate: null, driverName: null, dock: 'STG-C', loadingWarehouseId: 'wh-c', status: 'PICKING', plannedCartons: 0, loadedCartons: 0, fillVolumePct: 0, loadedKg: 0, etaDone: null },
  ];

  // plan definitions: [poNo, line, desc, factory, containerId, cartons, styles, status, source]
  const defs: [string, string, string, string, string, number, string, PackingPlan['status'], PackingPlan['source']][] = [
    ['4500000101', '10', 'MENS 630', 'FAC-A01', 'ct-1', 96, 'ST1001', 'LOADING', 'PDF'],
    ['4500000101', '20', 'MENS 630', 'FAC-A01', 'ct-1', 84, 'ST1001', 'LOADING', 'MERCURY'],
    ['4500000102', '10', 'WMNS 412', 'FAC-C01', 'ct-1', 120, 'ST2040', 'LOADING', 'MERCURY'],
    ['4500000103', '10', 'MENS 630', 'FAC-B01', 'ct-1', 96, 'ST1002', 'LOADING', 'MERCURY'],
    ['4500000104', '10', 'MENS 711', 'FAC-C01', 'ct-2', 140, 'ST3011', 'LOADING', 'EXCEL'],
    ['4500000105', '10', 'KIDS 201', 'FAC-C01', 'ct-2', 110, 'ST4020', 'LOADING', 'MERCURY'],
    ['4500000106', '10', 'WMNS 300', 'FAC-C01', 'ct-3', 72, 'ST2100', 'RELEASED', 'MERCURY'],
    ['4500000107', '10', 'MENS 630', 'FAC-A01', 'ct-4', 150, 'ST1003', 'APPROVED', 'MERCURY'],
    ['4500000108', '30', 'KIDS 201', 'FAC-C01', 'ct-5', 88, 'ST4021', 'RELEASED', 'EXCEL'],
    ['4500000109', '10', 'MENS 711', 'FAC-NEW', '', 64, 'ST3012', 'DRAFT', 'PDF'],
    ['4500000110', '10', 'WMNS 412', 'FAC-C01', '', 48, 'ST2041', 'PENDING_APPROVAL', 'MERCURY'],
  ];
  const factoryWh: Record<string, string | null> = { 'FAC-A01': 'wh-a', 'FAC-B01': 'wh-b', 'FAC-C01': 'wh-c', 'FAC-NEW': null };

  const plans: PackingPlan[] = [];
  const ranges: Record<string, PlanCartonRange[]> = {};
  const cartons: Carton[] = [];
  let serial = 7100001;
  const rackLocs = locations.filter((l) => l.kind === 'RACK' && l.warehouseId === 'wh-c');

  defs.forEach(([poNo, poLine, desc, fac, containerId, baseCount, style, status, source], pi) => {
    const count = Math.round(baseCount * SCALE[containerId]);
    const id = `pp-${pi + 1}`;
    const container = containers.find((c) => c.id === containerId);
    const shipmentId = container?.shipmentId ?? (pi % 2 ? 'sh-3' : 'sh-2');
    const planRanges: PlanCartonRange[] = [];
    let remaining = count;
    let cartonNo = 1;
    let r = 0;
    while (remaining > 0) {
      const size = SIZES[r % SIZES.length];
      const packCode = (['A6', 'A1', 'A6', 'A7', 'A7', 'A6'] as const)[r % 6];
      const dims = PACK_CODES[packCode];
      const n = Math.min(remaining, 40 + Math.floor(rand() * 120));
      const qtyPer = packCode === 'A1' ? 16 : packCode === 'A6' ? 10 : 6;
      const gross = Math.round((dims.l * dims.w * dims.h) / 9000 * 100) / 100;
      planRanges.push({
        rangeNo: String(r + 1).padStart(4, '0'),
        cartonFrom: cartonNo,
        cartonTo: cartonNo + n - 1,
        serialFrom: String(serial),
        serialTo: String(serial + n - 1),
        lineNo: String(r + 1).padStart(4, '0'),
        style,
        poNo,
        poLine: poLine.padStart(5, '0'),
        color: 'BLACK/GREY',
        size,
        styleColor: `${style}-010`,
        shipMethod: 'VL',
        itemQty: n * qtyPer,
        qtyPerCarton: qtyPer,
        innerPkgCount: null,
        cartonCount: n,
        cartonCode: packCode,
        netNetKg: 0,
        netKg: Math.round(gross * 0.8 * 1000) / 1000,
        grossKg: gross,
        lengthCm: dims.l,
        widthCm: dims.w,
        heightCm: dims.h,
      });
      for (let k = 0; k < n; k++) {
        const fromBranch = factoryWh[fac] && factoryWh[fac] !== 'wh-c';
        const inBranch = fromBranch && (status === 'APPROVED' || rand() < 0.08);
        const loc = rackLocs[(pi * 7 + r * 3 + k) % rackLocs.length];
        cartons.push({
          id: `cn-${serial + k}`,
          serial: String(serial + k),
          style,
          color: 'BLACK/GREY',
          size,
          qty: qtyPer,
          cartonCode: packCode,
          lengthCm: dims.l,
          widthCm: dims.w,
          heightCm: dims.h,
          grossKg: gross,
          netKg: Math.round(gross * 0.8 * 1000) / 1000,
          poNo,
          poLine,
          planId: id,
          containerId: containerId || null,
          status: (status === 'DRAFT' || status === 'PENDING_APPROVAL' ? 'AVAILABLE' : 'RESERVED') as CartonStatus,
          warehouseId: inBranch ? (factoryWh[fac] as string) : 'wh-c',
          locationId: inBranch ? `${factoryWh[fac]}-${(k % 6) + 1}` : loc.id,
        });
      }
      serial += n;
      cartonNo += n;
      remaining -= n;
      r++;
    }
    ranges[id] = planRanges;
    const sum = (f: (x: PlanCartonRange) => number) => planRanges.reduce((s, x) => s + f(x), 0);
    plans.push({
      id,
      planRef: `${poNo}-${poLine}`,
      poNo,
      poLine,
      description: desc,
      vendorSystem: 'MERCURY',
      vendorFactoryCode: fac,
      factoryWarehouseId: factoryWh[fac],
      shipmentId,
      source,
      status,
      version: 1,
      totals: {
        itemQty: sum((x) => x.itemQty),
        cartons: count,
        netNetKg: 0,
        netKg: Math.round(sum((x) => x.netKg * x.cartonCount) * 100) / 100,
        grossKg: Math.round(sum((x) => x.grossKg * x.cartonCount) * 100) / 100,
        cbm: Math.round(sum((x) => (x.lengthCm * x.widthCm * x.heightCm * x.cartonCount) / 1e6) * 1000) / 1000,
      },
      issue: fac === 'FAC-NEW' ? 'ยังไม่ map รหัสโรงงาน' : pi === 8 ? 'ขาด 6 กล่อง' : null,
    });
    serial += 37; // gap between plans
  });

  // loading progress on C1/C2 and staging on C3
  const progress: Record<string, number> = { 'ct-1': 0.72, 'ct-2': 0.18 };
  containers.forEach((c) => {
    const mine = cartons.filter((x) => x.containerId === c.id);
    c.plannedCartons = mine.length;
    const loadedN = Math.round(mine.length * (progress[c.id] ?? 0));
    mine.forEach((x, i) => {
      if (i < loadedN) {
        x.status = 'LOADED';
        x.locationId = c.dock ? `dock-${c.dock.slice(-1)}` : null;
      } else if (c.status === 'LOADING' || c.status === 'READY') {
        x.status = 'STAGED';
        x.locationId = c.status === 'READY' ? 'stg-B' : c.id === 'ct-1' ? 'stg-A' : 'stg-C';
      }
    });
    c.loadedCartons = loadedN;
    c.loadedKg = Math.round(mine.slice(0, loadedN).reduce((s, x) => s + x.grossKg, 0));
    const vol = mine.reduce((s, x) => s + x.lengthCm * x.widthCm * x.heightCm, 0);
    const t = CONTAINER_TYPES[c.type];
    c.fillVolumePct = Math.round((vol / (t.innerLengthCm * t.innerWidthCm * t.innerHeightCm)) * 1000) / 10;
  });
  // shortage on C5: last 6 cartons missing
  cartons.filter((x) => x.containerId === 'ct-5').slice(-6).forEach((x) => { x.status = 'HOLD'; x.locationId = null; });
  // a few holds
  cartons.filter((x) => x.status === 'AVAILABLE').slice(0, 3).forEach((x) => (x.status = 'HOLD'));

  const actions: AgentAction[] = [
    { id: 'a1', agent: 'Sync', text: 'ดึง Packing Plan ใหม่ 11 แผนจาก Mercury · ยอดควบคุมตรง 10 แผน', result: '10/11', status: 'DONE', confidence: null, createdAt: '2026-10-10T12:21:00+07:00' },
    { id: 'a2', agent: 'Planner', text: 'จัด 4 แผนเข้า C1 (40HC) และ 2 แผนเข้า C2', result: 'เต็ม 96% / 93%', status: 'DONE', confidence: 0.94, createdAt: '2026-10-10T12:22:00+07:00' },
    { id: 'a3', agent: 'Transfer', text: 'สร้างใบโอนจากสาขา A · 150 กล่อง สำหรับ C4', result: 'รถออกแล้ว', status: 'DONE', confidence: null, createdAt: '2026-10-10T12:22:30+07:00' },
    { id: 'a4', agent: 'Slotting', text: 'ย้ายกล่อง Shipment 13/10 ไปใกล้ Dock 3 ช่วงทีมว่าง', result: 'ระยะหยิบ −31%', status: 'DONE', confidence: 0.88, createdAt: '2026-10-10T12:24:00+07:00' },
    { id: 'a5', agent: 'Vision', text: 'ตรวจภาพครึ่งตู้ C1 · ไม่พบกล่องเสียหาย', result: 'ผ่าน', status: 'DONE', confidence: 0.97, createdAt: '2026-10-10T12:58:00+07:00' },
    { id: 'a6', agent: 'Planner', text: 'C5 ขาด 6 กล่อง (PO 4500000108) · เตรียมทางเลือก', result: 'รอคุณ', status: 'NEEDS_DECISION', confidence: 0.91, createdAt: '2026-10-10T13:02:00+07:00' },
  ];

  const decisions: Decision[] = [
    { id: 'd1', kind: 'SHORTAGE', title: 'C5 ขาด 6 กล่อง · PO 4500000108', recommendation: 'ดึงจากสาขา B รถรอบ 13:30 ยังมีที่ ทันโหลด 15:00', confidence: 0.91, primaryAction: 'อนุมัติ' },
    { id: 'd2', kind: 'FACTORY_UNMAPPED', title: 'แผน 4500000109-10 ใช้รหัสโรงงานใหม่ FAC-NEW', recommendation: 'น่าจะเป็นคลังสาขา B (ตรงกับที่อยู่ผู้ส่ง 3 แผนก่อนหน้า)', confidence: 0.76, primaryAction: 'Map เป็นสาขา B' },
  ];

  cache = { warehouses, locations, shipments, plans, ranges, cartons, containers, actions, decisions };
  return cache;
}
