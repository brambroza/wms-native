import { buildLoadPlan, demoData, expandSerials, type Carton, type DemoData, type ScanEvent, type ScanResult } from '@wms/shared';
import type { ImportResult, Overview, WmsApi } from './types';

/**
 * In-memory implementation used when Supabase isn't configured.
 * Business rules mirror supabase/migrations/*_functions_rls.sql (scan_carton, import_packing_plan, close_container).
 * A small simulator keeps container C1 loading so realtime screens move on their own.
 */
export class DemoApi implements WmsApi {
  readonly mode = 'demo' as const;
  private d: DemoData;
  private txns = new Map<string, ScanResult>();
  private listeners = new Set<{ containerId: string | null; fn: () => void }>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.d = structuredClone(demoData());
    for (const c of this.d.containers) {
      const mine = this.d.cartons.filter((x) => x.containerId === c.id);
      const plan = buildLoadPlan(mine, c.type);
      const bySerial = new Map(plan.steps.map((s) => [s.serial, s]));
      mine.forEach((x) => {
        const s = bySerial.get(x.serial);
        x.loadSeq = s?.seq ?? null;
        x.loadLabel = s?.label ?? null;
      });
      // make demo state consistent with the load sequence: the first N in sequence are the loaded ones
      if (c.loadedCartons > 0) {
        const ordered = [...mine].sort((a, b) => (a.loadSeq ?? 1e9) - (b.loadSeq ?? 1e9));
        ordered.forEach((x, i) => {
          if (x.status === 'HOLD') return;
          x.status = i < c.loadedCartons ? 'LOADED' : 'STAGED';
        });
      }
      this.recount(c.id);
    }
  }

  // ------------------------------------------------------------ helpers
  private recount(containerId: string) {
    const c = this.d.containers.find((x) => x.id === containerId);
    if (!c) return;
    const mine = this.d.cartons.filter((x) => x.containerId === containerId);
    const loaded = mine.filter((x) => x.status === 'LOADED' || x.status === 'SHIPPED');
    c.plannedCartons = mine.length;
    c.loadedCartons = loaded.length;
    c.loadedKg = Math.round(loaded.reduce((s, x) => s + x.grossKg, 0));
  }

  private emit(containerId: string | null) {
    this.listeners.forEach((l) => {
      if (l.containerId === null || l.containerId === containerId) l.fn();
    });
  }

  private ensureSimulator() {
    if (this.timer || typeof window === 'undefined') return;
    this.timer = setInterval(() => {
      const next = this.d.cartons
        .filter((x) => x.containerId === 'ct-1' && x.status === 'STAGED')
        .sort((a, b) => (a.loadSeq ?? 0) - (b.loadSeq ?? 0))[0];
      if (!next) return;
      void this.scan({ clientTxnId: `sim-${next.serial}`, action: 'LOAD', serial: next.serial, containerId: 'ct-1', deviceId: 'simulator', scannedAt: new Date().toISOString() });
    }, 5000);
  }

  // ------------------------------------------------------------ reads
  async overview(): Promise<Overview> {
    const central = this.d.cartons.filter((c) => c.warehouseId === 'wh-c' && !['LOADED', 'SHIPPED'].includes(c.status));
    return {
      containers: structuredClone(this.d.containers),
      plans: structuredClone(this.d.plans),
      shipments: structuredClone(this.d.shipments),
      actions: structuredClone(this.d.actions),
      decisions: structuredClone(this.d.decisions),
      cartonsInCentral: central.length,
      reservedInCentral: central.filter((c) => c.containerId).length,
    };
  }

  async listPlans() {
    return structuredClone(this.d.plans);
  }

  async getPlan(id: string) {
    const plan = this.d.plans.find((p) => p.id === id);
    if (!plan) return null;
    return structuredClone({ plan, ranges: this.d.ranges[id] ?? [], cartons: this.d.cartons.filter((c) => c.planId === id) });
  }

  async listContainers() {
    return structuredClone(this.d.containers);
  }

  async getContainer(id: string) {
    this.ensureSimulator();
    const container = this.d.containers.find((c) => c.id === id);
    if (!container) return null;
    const cartons = this.d.cartons.filter((c) => c.containerId === id).sort((a, b) => (a.loadSeq ?? 1e9) - (b.loadSeq ?? 1e9));
    return structuredClone({ container, cartons, shipment: this.d.shipments.find((s) => s.id === container.shipmentId) ?? null });
  }

  async stock() {
    return structuredClone({
      warehouses: this.d.warehouses,
      locations: this.d.locations,
      cartons: this.d.cartons.filter((c) => c.locationId && !['LOADED', 'SHIPPED'].includes(c.status)),
    });
  }

  // ------------------------------------------------------------ writes
  async scan(ev: ScanEvent): Promise<ScanResult> {
    const prev = this.txns.get(ev.clientTxnId);
    if (prev) return { ...prev, duplicate: true };
    const fail = (message: string): ScanResult => ({ ok: false, duplicate: false, message });
    let result: ScanResult;
    const c = this.d.cartons.find((x) => x.serial === ev.serial.trim());
    const loc = ev.locationCode ? this.d.locations.find((l) => l.code === ev.locationCode!.trim().toUpperCase()) : undefined;
    if (!c) result = fail(`ไม่พบกล่อง serial ${ev.serial} ในระบบ`);
    else if (ev.locationCode && !loc) result = fail(`ไม่พบตำแหน่ง ${ev.locationCode}`);
    else result = this.applyScan(c, ev, loc?.id ?? null, loc?.warehouseId ?? null);

    if (c?.containerId) {
      this.recount(c.containerId);
      const k = this.d.containers.find((x) => x.id === c.containerId)!;
      result.loadedCartons = k.loadedCartons;
      result.plannedCartons = k.plannedCartons;
    }
    this.txns.set(ev.clientTxnId, result);
    this.emit(c?.containerId ?? null);
    return result;
  }

  private applyScan(c: Carton, ev: ScanEvent, locId: string | null, whId: string | null): ScanResult {
    const ok = (message: string): ScanResult => ({
      ok: true,
      duplicate: false,
      message,
      carton: { serial: c.serial, style: c.style, size: c.size, cartonCode: c.cartonCode, poNo: c.poNo, status: c.status },
    });
    const fail = (message: string): ScanResult => ({ ok: false, duplicate: false, message });
    switch (ev.action) {
      case 'RECEIVE':
        if (!['IN_TRANSIT', 'AVAILABLE', 'RESERVED'].includes(c.status)) return fail(`กล่องนี้สถานะ ${c.status} รับเข้าไม่ได้`);
        c.status = c.planId ? 'RESERVED' : 'AVAILABLE';
        if (whId) c.warehouseId = whId;
        c.locationId = locId;
        return ok('รับเข้าแล้ว');
      case 'PUTAWAY':
        if (!locId) return fail('ต้องสแกนตำแหน่งที่วาง');
        c.locationId = locId;
        if (whId) c.warehouseId = whId;
        return ok('วางเรียบร้อย');
      case 'PICK':
        if (ev.containerId && c.containerId !== ev.containerId) return fail('กล่องนี้ไม่อยู่ในงานหยิบของตู้นี้');
        if (!['AVAILABLE', 'RESERVED', 'PICKED'].includes(c.status)) return fail(`กล่องนี้สถานะ ${c.status} หยิบไม่ได้`);
        c.status = 'PICKED';
        c.locationId = null;
        return ok('หยิบแล้ว');
      case 'STAGE':
        if (!locId) return fail('ต้องสแกนช่อง Staging');
        c.status = 'STAGED';
        c.locationId = locId;
        return ok('วางที่ Staging แล้ว');
      case 'LOAD': {
        const k = this.d.containers.find((x) => x.id === ev.containerId);
        if (!k) return fail('ไม่พบตู้');
        if (k.status === 'CLOSED') return fail('ตู้นี้ปิดแล้ว');
        if (c.containerId !== k.id) return fail(`กล่องนี้ไม่อยู่ในแผนตู้ ${k.code}`);
        if (c.status === 'LOADED') return ok('กล่องนี้ขึ้นตู้แล้ว');
        if (c.status === 'HOLD') return fail('กล่องนี้ถูก Hold');
        c.status = 'LOADED';
        c.locationId = null;
        k.status = 'LOADING';
        return ok(`ขึ้นตู้ ${k.code}`);
      }
      case 'UNLOAD':
        if (c.status !== 'LOADED') return fail('กล่องนี้ยังไม่ได้ขึ้นตู้');
        c.status = 'STAGED';
        return ok('ถอดออกจากตู้แล้ว');
    }
  }

  async importPlan(parsed: Parameters<WmsApi['importPlan']>[0], meta: Parameters<WmsApi['importPlan']>[1]): Promise<ImportResult> {
    const h = parsed.header;
    const version = this.d.plans.filter((p) => p.planRef === h.planRef).reduce((m, p) => Math.max(m, p.version), 0) + 1;
    const factoryMap: Record<string, string> = { 'FAC-A01': 'wh-a', 'FAC-B01': 'wh-b', 'FAC-C01': 'wh-c' };
    const wh = h.vendorFactoryCode ? factoryMap[h.vendorFactoryCode] ?? null : null;
    const id = `pp-${Date.now().toString(36)}`;
    let shipment = this.d.shipments.find((s) => s.shipmentDate === h.shipmentDate && s.destination === h.destination);
    if (!shipment && h.shipmentDate) {
      shipment = { id: `sh-${id}`, shipmentDate: h.shipmentDate, destination: h.destination ?? '', shipToCode: h.shipToCode, shipMethod: (meta.shipMethod as 'SEA') ?? 'SEA' };
      this.d.shipments.push(shipment);
    }
    this.d.plans.unshift({
      id,
      planRef: h.planRef,
      poNo: h.poNo,
      poLine: h.poLine,
      description: h.description ?? '',
      vendorSystem: 'MERCURY',
      vendorFactoryCode: h.vendorFactoryCode ?? '',
      factoryWarehouseId: wh,
      shipmentId: shipment?.id ?? null,
      source: meta.source,
      status: !wh && h.vendorFactoryCode ? 'DRAFT' : 'VALIDATED',
      version,
      totals: meta.totals,
      issue: !wh && h.vendorFactoryCode ? 'ยังไม่ map รหัสโรงงาน' : null,
    });
    this.d.ranges[id] = parsed.ranges;
    const serials = new Set(parsed.ranges.flatMap((r) => expandSerials(r)));
    let matched = 0;
    this.d.cartons.forEach((c) => {
      if (serials.has(c.serial)) {
        matched++;
        c.planId = id;
        if (c.status === 'AVAILABLE') c.status = 'RESERVED';
      }
    });
    const expected = parsed.ranges.reduce((s, r) => s + r.cartonCount, 0);
    this.d.actions.unshift({ id: `a-${id}`, agent: 'Sync', text: `นำเข้าแผน ${h.planRef} (v${version}) · พบกล่องในคลัง ${matched}/${expected}`, result: matched === expected ? 'ครบ' : `ขาด ${expected - matched}`, status: 'DONE', confidence: null, createdAt: new Date().toISOString() });
    this.emit(null);
    return { planId: id, version, expectedCartons: expected, matchedCartons: matched, missingCartons: expected - matched, factoryWarehouseId: wh };
  }

  async closeContainer(id: string, sealNo: string) {
    const left = this.d.cartons.filter((c) => c.containerId === id && !['LOADED', 'SHIPPED'].includes(c.status)).length;
    if (left > 0) return { ok: false, message: `ยังไม่ได้โหลดอีก ${left} กล่อง` };
    this.d.cartons.filter((c) => c.containerId === id).forEach((c) => (c.status = 'SHIPPED'));
    const k = this.d.containers.find((c) => c.id === id)!;
    k.status = 'CLOSED';
    k.sealNo = sealNo;
    this.emit(id);
    return { ok: true, message: 'ปิดตู้แล้ว' };
  }

  async resolveDecision(id: string, resolution: string) {
    this.d.decisions = this.d.decisions.filter((x) => x.id !== id);
    this.d.actions.unshift({ id: `a-${Date.now()}`, agent: 'Planner', text: `ผู้จัดการตัดสินใจ: ${resolution}`, result: 'ดำเนินการ', status: 'DONE', confidence: null, createdAt: new Date().toISOString() });
    this.emit(null);
  }

  subscribe(containerId: string | null, fn: () => void) {
    const l = { containerId, fn };
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
}
