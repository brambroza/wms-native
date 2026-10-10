import type {
  AgentAction,
  Carton,
  Container,
  Decision,
  Location,
  PackingPlan,
  ParsedPlan,
  PlanCartonRange,
  ScanEvent,
  ScanResult,
  Shipment,
  Warehouse,
} from '@wms/shared';

export interface ImportResult {
  planId: string;
  version: number;
  expectedCartons: number;
  matchedCartons: number;
  missingCartons: number;
  factoryWarehouseId: string | null;
}

export interface Overview {
  containers: Container[];
  plans: PackingPlan[];
  shipments: Shipment[];
  actions: AgentAction[];
  decisions: Decision[];
  cartonsInCentral: number;
  reservedInCentral: number;
}

export interface StockSnapshot {
  warehouses: Warehouse[];
  locations: Location[];
  /** cartons currently stored in a location (not loaded/shipped) */
  cartons: Carton[];
}

/** One interface, two implementations: Supabase (real) and Demo (in-memory). */
export interface WmsApi {
  readonly mode: 'demo' | 'supabase';
  overview(): Promise<Overview>;
  listPlans(): Promise<PackingPlan[]>;
  getPlan(id: string): Promise<{ plan: PackingPlan; ranges: PlanCartonRange[]; cartons: Carton[] } | null>;
  importPlan(parsed: ParsedPlan, meta: { source: PackingPlan['source']; shipMethod: string | null; totals: PackingPlan['totals'] }): Promise<ImportResult>;
  listContainers(): Promise<Container[]>;
  getContainer(id: string): Promise<{ container: Container; cartons: Carton[]; shipment: Shipment | null } | null>;
  stock(): Promise<StockSnapshot>;
  scan(event: ScanEvent): Promise<ScanResult>;
  closeContainer(id: string, sealNo: string): Promise<{ ok: boolean; message: string }>;
  resolveDecision(id: string, resolution: string): Promise<void>;
  /** Called whenever a container or its cartons change. Returns an unsubscribe function. */
  subscribe(containerId: string | null, onChange: () => void): () => void;
}
