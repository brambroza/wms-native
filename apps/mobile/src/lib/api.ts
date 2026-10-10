import type { CartonStatus, ContainerStatus, ContainerType } from '@wms/shared';
import { supabase } from './supabase';
import { createDemoApi } from './demoApi';
import {
  TransientError,
  type CloseResult,
  type ScanRequest,
  type ScanResponse,
  type StaffCarton,
  type StaffContainer,
} from './types';

export type ApiMode = 'supabase' | 'demo';

/** Everything the staff app is allowed to do against the backend. */
export interface WmsApi {
  readonly mode: ApiMode;
  listContainers(): Promise<StaffContainer[]>;
  getContainer(id: string): Promise<StaffContainer | null>;
  listContainerCartons(containerId: string): Promise<StaffCarton[]>;
  /** Idempotent by req.clientTxnId. Throws TransientError when offline / unreachable. */
  scan(req: ScanRequest): Promise<ScanResponse>;
  closeContainer(containerId: string, sealNo: string): Promise<CloseResult>;
  /** Calls `onChange` whenever the container row changes. Returns an unsubscribe fn. */
  subscribeContainer(containerId: string, onChange: () => void): () => void;
}

// ------------------------------------------------------------------ Supabase

interface ContainerRow {
  id: string;
  code: string;
  type: ContainerType['code'];
  status: ContainerStatus;
  dock: string | null;
  seal_no: string | null;
  planned_cartons: number;
  loaded_cartons: number;
  fill_volume_pct: number | string;
  loaded_kg: number | string;
  eta_done: string | null;
}

interface CartonRow {
  serial: string;
  style: string | null;
  size: string | null;
  carton_code: string | null;
  po_no: string | null;
  status: CartonStatus;
  location_id: string | null;
  container_id: string | null;
  load_seq: number | null;
  load_label: string | null;
  gross_kg: number | string;
}

const CONTAINER_COLS = 'id, code, type, status, dock, seal_no, planned_cartons, loaded_cartons, fill_volume_pct, loaded_kg, eta_done';
const CARTON_COLS = 'serial, style, size, carton_code, po_no, status, location_id, container_id, load_seq, load_label, gross_kg';

function toContainer(r: ContainerRow): StaffContainer {
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    status: r.status,
    dock: r.dock,
    sealNo: r.seal_no,
    plannedCartons: r.planned_cartons,
    loadedCartons: r.loaded_cartons,
    fillVolumePct: Number(r.fill_volume_pct),
    loadedKg: Number(r.loaded_kg),
    etaDone: r.eta_done,
  };
}

/** PostgREST returns code '' for fetch/network failures; auth/JWT problems are worth retrying too. */
function isTransient(err: { code?: string; message?: string }): boolean {
  const code = err.code ?? '';
  if (code === '' || code.startsWith('PGRST3')) return true;
  return /fetch|network|timeout/i.test(err.message ?? '');
}

function createSupabaseApi(): WmsApi {
  const sb = supabase;
  if (!sb) throw new Error('Supabase is not configured');
  return {
    mode: 'supabase',

    async listContainers() {
      const { data, error } = await sb.from('containers').select(CONTAINER_COLS).order('code');
      if (error) throw new Error(error.message);
      return (data as ContainerRow[]).map(toContainer);
    },

    async getContainer(id) {
      const { data, error } = await sb.from('containers').select(CONTAINER_COLS).eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toContainer(data as ContainerRow) : null;
    },

    async listContainerCartons(containerId) {
      const { data, error } = await sb.from('cartons').select(CARTON_COLS).eq('container_id', containerId);
      if (error) throw new Error(error.message);
      const rows = data as CartonRow[];
      const locIds = [...new Set(rows.map((r) => r.location_id).filter((x): x is string => !!x))];
      const codes = new Map<string, string>();
      if (locIds.length) {
        const res = await sb.from('locations').select('id, code').in('id', locIds);
        if (res.error) throw new Error(res.error.message);
        (res.data as { id: string; code: string }[]).forEach((l) => codes.set(l.id, l.code));
      }
      return rows.map((r) => ({
        serial: r.serial,
        style: r.style ?? '',
        size: r.size ?? '',
        cartonCode: r.carton_code ?? '',
        poNo: r.po_no ?? '',
        status: r.status,
        locationCode: r.location_id ? (codes.get(r.location_id) ?? r.location_id) : null,
        containerId: r.container_id,
        loadSeq: r.load_seq,
        loadLabel: r.load_label,
        grossKg: Number(r.gross_kg),
      }));
    },

    async scan(req) {
      let res;
      try {
        res = await sb.rpc('scan_carton', {
          p_client_txn_id: req.clientTxnId,
          p_action: req.action,
          p_serial: req.serial,
          p_container_id: req.containerId,
          p_location_code: req.locationCode,
          p_device_id: req.deviceId,
        });
      } catch (e) {
        throw new TransientError(e instanceof Error ? e.message : String(e));
      }
      if (res.error) {
        if (isTransient(res.error)) throw new TransientError(res.error.message);
        return { ok: false, duplicate: false, code: res.error.code, message: res.error.message };
      }
      return res.data as ScanResponse;
    },

    async closeContainer(containerId, sealNo) {
      const { data, error } = await sb.rpc('close_container', { p_container_id: containerId, p_seal_no: sealNo });
      if (error) return { ok: false, message: error.message };
      return data as CloseResult;
    },

    subscribeContainer(containerId, onChange) {
      const channel = sb
        .channel(`container-${containerId}-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'containers', filter: `id=eq.${containerId}` }, () => onChange())
        .subscribe();
      return () => {
        sb.removeChannel(channel).catch(() => undefined);
      };
    },
  };
}

export function createApi(mode: ApiMode): WmsApi {
  return mode === 'demo' ? createDemoApi() : createSupabaseApi();
}
