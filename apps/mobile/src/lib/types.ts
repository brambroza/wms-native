import type { CartonStatus, ContainerStatus, ContainerType, ScanAction, ScanResult } from '@wms/shared';

/** Container as the handheld needs it (subset of the `containers` row). */
export interface StaffContainer {
  id: string;
  code: string;
  type: ContainerType['code'];
  status: ContainerStatus;
  dock: string | null;
  sealNo: string | null;
  plannedCartons: number;
  loadedCartons: number;
  /** planned fill (whole plan) in % of inner volume */
  fillVolumePct: number;
  loadedKg: number;
  etaDone: string | null;
}

/** Carton row for pick / load lists. */
export interface StaffCarton {
  serial: string;
  style: string;
  size: string;
  cartonCode: string;
  poNo: string;
  status: CartonStatus;
  locationCode: string | null;
  containerId: string | null;
  loadSeq: number | null;
  loadLabel: string | null;
  grossKg: number;
}

export interface ScanRequest {
  clientTxnId: string;
  action: ScanAction;
  serial: string;
  containerId: string | null;
  locationCode: string | null;
  deviceId: string;
}

/** `scan_carton` RPC result; `code` is set on business errors (NOT_FOUND, WRONG_CONTAINER, ...). */
export type ScanResponse = ScanResult & { code?: string };

export interface CloseResult {
  ok: boolean;
  message: string;
}

/** Thrown by an API implementation when the request did not reach the server (retry later). */
export class TransientError extends Error {
  readonly transient = true;
}
