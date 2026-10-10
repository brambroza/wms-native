import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AgentAction,
  Carton,
  Container,
  Decision,
  Location,
  PackingPlan,
  PlanCartonRange,
  ScanEvent,
  ScanResult,
  Shipment,
  Warehouse,
} from '@wms/shared';
import type { ImportResult, Overview, WmsApi } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toContainer = (r: Row): Container => ({
  id: r.id,
  code: r.code,
  shipmentId: r.shipment_id,
  type: r.type,
  containerNo: r.container_no,
  sealNo: r.seal_no,
  truckPlate: r.truck_plate,
  driverName: r.driver_name,
  dock: r.dock,
  loadingWarehouseId: r.loading_warehouse_id,
  status: r.status,
  plannedCartons: r.planned_cartons,
  loadedCartons: r.loaded_cartons,
  fillVolumePct: Number(r.fill_volume_pct),
  loadedKg: Number(r.loaded_kg),
  etaDone: r.eta_done,
});

const toPlan = (r: Row): PackingPlan => ({
  id: r.id,
  planRef: r.plan_ref,
  poNo: r.po_no,
  poLine: r.po_line,
  description: r.description ?? '',
  vendorSystem: r.vendor_system,
  vendorFactoryCode: r.vendor_factory_code ?? '',
  factoryWarehouseId: r.factory_warehouse_id,
  shipmentId: r.shipment_id,
  source: r.source,
  status: r.status,
  version: r.version,
  totals: r.totals,
  issue: r.issue,
});

const toCarton = (r: Row): Carton => ({
  id: r.id,
  serial: r.serial,
  style: r.style,
  color: r.color,
  size: r.size,
  qty: r.qty,
  cartonCode: r.carton_code,
  lengthCm: Number(r.length_cm),
  widthCm: Number(r.width_cm),
  heightCm: Number(r.height_cm),
  grossKg: Number(r.gross_kg),
  netKg: Number(r.net_kg),
  poNo: r.po_no,
  poLine: r.po_line,
  planId: r.plan_id,
  containerId: r.container_id,
  status: r.status,
  warehouseId: r.warehouse_id,
  locationId: r.location_id,
  loadSeq: r.load_seq,
  loadLabel: r.load_label,
});

const toShipment = (r: Row): Shipment => ({ id: r.id, shipmentDate: r.shipment_date, destination: r.destination, shipToCode: r.ship_to_code, shipMethod: r.ship_method });
const toLocation = (r: Row): Location => ({ id: r.id, warehouseId: r.warehouse_id, code: r.code, kind: r.kind, x: Number(r.x), y: Number(r.y), z: Number(r.z), capacityCartons: r.capacity_cartons });
const toAction = (r: Row): AgentAction => ({ id: r.id, agent: r.agent, text: r.text, result: r.result, status: r.status, confidence: r.confidence === null ? null : Number(r.confidence), createdAt: r.created_at });
const toDecision = (r: Row): Decision => ({ id: r.id, kind: r.kind, title: r.title, recommendation: r.recommendation, confidence: Number(r.confidence), primaryAction: r.primary_action });

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const CARTON_COLS = 'id,serial,style,color,size,qty,carton_code,length_cm,width_cm,height_cm,gross_kg,net_kg,po_no,po_line,plan_id,container_id,status,warehouse_id,location_id,load_seq,load_label';

export class SupabaseApi implements WmsApi {
  readonly mode = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  async overview(): Promise<Overview> {
    const [containers, plans, shipments, actions, decisions, inCentral, reserved] = await Promise.all([
      this.sb.from('containers').select('*').order('code'),
      this.sb.from('packing_plans').select('*').order('created_at', { ascending: false }).limit(200),
      this.sb.from('shipments').select('*').order('shipment_date'),
      this.sb.from('agent_actions').select('*').order('created_at', { ascending: false }).limit(20),
      this.sb.from('decisions').select('*').is('resolved_at', null),
      this.sb.from('cartons').select('id', { count: 'exact', head: true }).eq('warehouse_id', 'wh-c').not('status', 'in', '(LOADED,SHIPPED)'),
      this.sb.from('cartons').select('id', { count: 'exact', head: true }).eq('warehouse_id', 'wh-c').not('container_id', 'is', null).not('status', 'in', '(LOADED,SHIPPED)'),
    ]);
    return {
      containers: must(containers).map(toContainer),
      plans: must(plans).map(toPlan),
      shipments: must(shipments).map(toShipment),
      actions: must(actions).map(toAction),
      decisions: must(decisions).map(toDecision),
      cartonsInCentral: inCentral.count ?? 0,
      reservedInCentral: reserved.count ?? 0,
    };
  }

  async listPlans() {
    return must(await this.sb.from('packing_plans').select('*').order('created_at', { ascending: false })).map(toPlan);
  }

  async getPlan(id: string) {
    const plan = must(await this.sb.from('packing_plans').select('*').eq('id', id).maybeSingle()) as Row | null;
    if (!plan) return null;
    const [ranges, cartons] = await Promise.all([
      this.sb.from('plan_carton_ranges').select('*').eq('plan_id', id).order('range_no'),
      this.sb.from('cartons').select(CARTON_COLS).eq('plan_id', id).order('serial'),
    ]);
    return {
      plan: toPlan(plan),
      ranges: must(ranges).map(
        (r: Row): PlanCartonRange => ({
          rangeNo: r.range_no, cartonFrom: r.carton_from, cartonTo: r.carton_to, serialFrom: r.serial_from, serialTo: r.serial_to, lineNo: r.line_no,
          style: r.style, poNo: r.po_no, poLine: r.po_line, color: r.color, size: r.size, styleColor: r.style_color, shipMethod: r.ship_method,
          itemQty: r.item_qty, qtyPerCarton: r.qty_per_carton, innerPkgCount: r.inner_pkg_count, cartonCount: r.carton_count, cartonCode: r.carton_code,
          netNetKg: Number(r.net_net_kg), netKg: Number(r.net_kg), grossKg: Number(r.gross_kg), lengthCm: Number(r.length_cm), widthCm: Number(r.width_cm), heightCm: Number(r.height_cm),
        }),
      ),
      cartons: must(cartons).map(toCarton),
    };
  }

  async importPlan(parsed: Parameters<WmsApi['importPlan']>[0], meta: Parameters<WmsApi['importPlan']>[1]): Promise<ImportResult> {
    const { data, error } = await this.sb.rpc('import_packing_plan', {
      p_plan: { header: parsed.header, ranges: parsed.ranges, source: meta.source, shipMethod: meta.shipMethod, totals: meta.totals, vendorSystem: 'MERCURY' },
    });
    if (error) throw new Error(error.message);
    return data as ImportResult;
  }

  async listContainers() {
    return must(await this.sb.from('containers').select('*').order('code')).map(toContainer);
  }

  async getContainer(id: string) {
    const c = must(await this.sb.from('containers').select('*').eq('id', id).maybeSingle()) as Row | null;
    if (!c) return null;
    const [cartons, shipment] = await Promise.all([
      this.sb.from('cartons').select(CARTON_COLS).eq('container_id', id).order('load_seq', { nullsFirst: false }),
      this.sb.from('shipments').select('*').eq('id', c.shipment_id).maybeSingle(),
    ]);
    return { container: toContainer(c), cartons: must(cartons).map(toCarton), shipment: shipment.data ? toShipment(shipment.data) : null };
  }

  async stock() {
    const [w, l, c] = await Promise.all([
      this.sb.from('warehouses').select('*'),
      this.sb.from('locations').select('*'),
      this.sb.from('cartons').select(CARTON_COLS).not('location_id', 'is', null).not('status', 'in', '(LOADED,SHIPPED)').limit(20000),
    ]);
    return {
      warehouses: must(w).map((r: Row): Warehouse => ({ id: r.id, code: r.code, name: r.name, type: r.type })),
      locations: must(l).map(toLocation),
      cartons: must(c).map(toCarton),
    };
  }

  async scan(ev: ScanEvent): Promise<ScanResult> {
    const { data, error } = await this.sb.rpc('scan_carton', {
      p_client_txn_id: ev.clientTxnId,
      p_action: ev.action,
      p_serial: ev.serial,
      p_container_id: ev.containerId ?? null,
      p_location_code: ev.locationCode ?? null,
      p_device_id: ev.deviceId,
    });
    if (error) throw new Error(error.message);
    return data as ScanResult;
  }

  async closeContainer(id: string, sealNo: string) {
    const { data, error } = await this.sb.rpc('close_container', { p_container_id: id, p_seal_no: sealNo });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; message: string };
  }

  async resolveDecision(id: string, resolution: string) {
    const { error } = await this.sb.rpc('resolve_decision', { p_id: id, p_resolution: resolution });
    if (error) throw new Error(error.message);
  }

  subscribe(containerId: string | null, onChange: () => void) {
    const ch = this.sb.channel(`wms-${containerId ?? 'all'}-${Math.random().toString(36).slice(2)}`);
    if (containerId) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'containers', filter: `id=eq.${containerId}` }, onChange);
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'cartons', filter: `container_id=eq.${containerId}` }, onChange);
    } else {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'containers' }, onChange);
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'agent_actions' }, onChange);
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, onChange);
    }
    ch.subscribe();
    return () => {
      void this.sb.removeChannel(ch);
    };
  }
}
