// Domain types shared by web, PWA and the native handheld app.
// Unit of handling = carton (identified by serial), see docs/06-packing-plan-format.md

export type WarehouseType = 'CENTRAL' | 'BRANCH';

export type CartonStatus =
  | 'IN_TRANSIT' // shipped from a branch, not yet received at central
  | 'AVAILABLE'
  | 'RESERVED' // allocated to a packing plan / container
  | 'PICKED'
  | 'STAGED'
  | 'LOADED'
  | 'SHIPPED'
  | 'HOLD';

export type PlanStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'RELEASED'
  | 'LOADING'
  | 'CLOSED';

export type ContainerStatus = 'PLANNED' | 'PICKING' | 'READY' | 'LOADING' | 'CLOSED';

export type ShipMethod = 'SEA' | 'AIR' | 'TRUCK';

export type PlanSource = 'PDF' | 'EXCEL' | 'CSV' | 'MERCURY' | 'MANUAL';

export type ScanAction = 'RECEIVE' | 'PUTAWAY' | 'PICK' | 'STAGE' | 'LOAD' | 'UNLOAD';

export type IssueKind = 'SHORTAGE' | 'WRONG_CONTAINER' | 'DAMAGED' | 'NOT_FOUND' | 'FACTORY_UNMAPPED';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: WarehouseType;
}

export interface Location {
  id: string;
  warehouseId: string;
  code: string; // e.g. C-A04-02
  kind: 'RACK' | 'FLOOR' | 'STAGING' | 'DOCK';
  /** grid position for 2D/3D views (meters) */
  x: number;
  y: number;
  z: number;
  capacityCartons: number;
}

export interface CartonCode {
  code: string; // Pack Code from the plan, e.g. A1, A6, A7
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  maxStack: number;
}

export interface Carton {
  id: string;
  serial: string;
  style: string;
  color: string;
  size: string;
  qty: number;
  cartonCode: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  grossKg: number;
  netKg: number;
  poNo: string;
  poLine: string;
  planId: string | null;
  containerId: string | null;
  status: CartonStatus;
  warehouseId: string;
  locationId: string | null;
  /** load order inside the container (1 = first in, deepest) */
  loadSeq?: number | null;
  /** placement hint for loaders, e.g. "แถว 7 · ซ้าย · ล่าง" */
  loadLabel?: string | null;
}

export interface Shipment {
  id: string;
  shipmentDate: string; // ISO date
  destination: string;
  shipToCode: string | null;
  shipMethod: ShipMethod;
}

export interface PackingPlan {
  id: string;
  planRef: string; // <PO>-<POLine>
  poNo: string;
  poLine: string;
  description: string;
  vendorSystem: string; // MERCURY, ...
  vendorFactoryCode: string; // e.g. "HIT HT70" -> mapped to factoryWarehouseId
  factoryWarehouseId: string | null;
  shipmentId: string | null;
  source: PlanSource;
  status: PlanStatus;
  version: number;
  totals: ControlTotals;
  issue: string | null;
}

export interface ControlTotals {
  itemQty: number;
  cartons: number;
  netNetKg: number;
  netKg: number;
  grossKg: number;
  cbm: number;
}

export interface PlanCartonRange {
  rangeNo: string;
  cartonFrom: number;
  cartonTo: number;
  serialFrom: string;
  serialTo: string;
  lineNo: string;
  style: string; // Buyer Item#
  poNo: string;
  poLine: string;
  color: string;
  size: string;
  styleColor: string; // Short Description
  shipMethod: string; // VL = sea
  itemQty: number;
  qtyPerCarton: number;
  innerPkgCount: number | null;
  cartonCount: number;
  cartonCode: string;
  netNetKg: number;
  netKg: number;
  grossKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface ContainerType {
  code: '20GP' | '40GP' | '40HC' | '45HC';
  innerLengthCm: number;
  innerWidthCm: number;
  innerHeightCm: number;
  maxPayloadKg: number;
}

export interface Container {
  id: string;
  code: string; // C1, C2 ...
  shipmentId: string;
  type: ContainerType['code'];
  containerNo: string | null;
  sealNo: string | null;
  truckPlate: string | null;
  driverName: string | null;
  dock: string | null;
  loadingWarehouseId: string;
  status: ContainerStatus;
  plannedCartons: number;
  loadedCartons: number;
  fillVolumePct: number;
  loadedKg: number;
  etaDone: string | null;
}

export interface ScanEvent {
  clientTxnId: string; // idempotency key generated on the device
  action: ScanAction;
  serial: string;
  containerId?: string | null;
  locationCode?: string | null;
  deviceId: string;
  scannedAt: string;
}

export interface ScanResult {
  ok: boolean;
  duplicate: boolean;
  message: string;
  carton?: Pick<Carton, 'serial' | 'style' | 'size' | 'cartonCode' | 'poNo' | 'status'>;
  loadedCartons?: number;
  plannedCartons?: number;
}

export interface AgentAction {
  id: string;
  agent: 'Sync' | 'Planner' | 'Transfer' | 'Slotting' | 'Vision';
  text: string;
  result: string;
  status: 'DONE' | 'NEEDS_DECISION' | 'UNDONE';
  confidence: number | null;
  createdAt: string;
}

export interface Decision {
  id: string;
  title: string;
  recommendation: string;
  confidence: number;
  primaryAction: string;
  kind: IssueKind;
}
