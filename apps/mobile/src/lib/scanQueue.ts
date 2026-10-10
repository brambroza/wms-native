import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import type { ScanAction } from '@wms/shared';
import type { WmsApi } from './api';
import { TransientError, type ScanRequest, type ScanResponse } from './types';

/**
 * Offline-first scan queue.
 * Every scan gets a clientTxnId and is written to AsyncStorage BEFORE it is sent.
 * Items are sent strictly in order (pick → stage → load of one carton must not overtake).
 * Re-sending is safe: `scan_carton` is idempotent by p_client_txn_id.
 */

export interface QueuedScan extends ScanRequest {
  scannedAt: string;
  attempts: number;
}

export interface RejectedScan {
  scan: QueuedScan;
  result: ScanResponse;
}

export type SubmitOutcome = { status: 'done'; result: ScanResponse } | { status: 'queued' };

export interface QueueSnapshot {
  pending: number;
  rejected: RejectedScan[];
  online: boolean;
  syncing: boolean;
}

type Listener = (s: QueueSnapshot) => void;

const SYNC_INTERVAL_MS = 15_000;
const MAX_REJECTED = 50;

export class ScanQueue {
  private items: QueuedScan[] = [];
  private rejected: RejectedScan[] = [];
  private results = new Map<string, ScanResponse>();
  private listeners = new Set<Listener>();
  private online = true;
  private syncing: Promise<void> | null = null;
  private loaded: Promise<void>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubNet: (() => void) | null = null;

  constructor(
    private readonly api: WmsApi,
    private readonly deviceId: string,
    private readonly storageKey: string,
  ) {
    this.loaded = this.load();
  }

  // ---------------------------------------------------------------- lifecycle

  start(): void {
    this.unsubNet = NetInfo.addEventListener((s) => {
      const next = s.isConnected !== false && s.isInternetReachable !== false;
      const cameBack = next && !this.online;
      this.online = next;
      this.emit();
      if (cameBack) void this.flush();
    });
    this.timer = setInterval(() => void this.flush(), SYNC_INTERVAL_MS);
    void this.loaded.then(() => this.flush());
  }

  stop(): void {
    this.unsubNet?.();
    this.unsubNet = null;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  snapshot(): QueueSnapshot {
    return { pending: this.items.length, rejected: this.rejected, online: this.online, syncing: this.syncing !== null };
  }

  // ---------------------------------------------------------------- API

  /** Persist the scan, then try to send everything pending (in order). */
  async submit(input: { action: ScanAction; serial: string; containerId?: string | null; locationCode?: string | null }): Promise<SubmitOutcome> {
    await this.loaded;
    const scan: QueuedScan = {
      clientTxnId: randomUUID(),
      action: input.action,
      serial: input.serial.trim(),
      containerId: input.containerId ?? null,
      locationCode: input.locationCode ? input.locationCode.trim().toUpperCase() : null,
      deviceId: this.deviceId,
      scannedAt: new Date().toISOString(),
      attempts: 0,
    };
    this.items.push(scan);
    await this.persist();
    this.emit();
    await this.flush();
    const result = this.results.get(scan.clientTxnId);
    if (result) {
      this.results.delete(scan.clientTxnId);
      return { status: 'done', result };
    }
    return { status: 'queued' };
  }

  /** Send pending scans FIFO; stops at the first network failure. Concurrent calls share one run. */
  flush(): Promise<void> {
    if (this.syncing) return this.syncing;
    if (!this.online || this.items.length === 0) return Promise.resolve();
    this.syncing = this.run().finally(() => {
      this.syncing = null;
      this.emit();
    });
    this.emit();
    return this.syncing;
  }

  clearRejected(): void {
    this.rejected = [];
    void this.persist();
    this.emit();
  }

  // ---------------------------------------------------------------- internals

  private async run(): Promise<void> {
    while (this.items.length > 0) {
      const head = this.items[0];
      head.attempts += 1;
      let result: ScanResponse;
      try {
        result = await this.api.scan(head);
      } catch (e) {
        if (e instanceof TransientError) {
          await this.persist();
          return; // try again on the next tick / reconnect
        }
        result = { ok: false, duplicate: false, code: 'CLIENT_ERROR', message: e instanceof Error ? e.message : String(e) };
      }
      this.items.shift();
      this.results.set(head.clientTxnId, result);
      if (!result.ok) {
        this.rejected = [{ scan: head, result }, ...this.rejected].slice(0, MAX_REJECTED);
      }
      // keep the in-memory result map bounded (only the latest submit() reads it)
      if (this.results.size > 200) {
        const first = this.results.keys().next().value;
        if (first) this.results.delete(first);
      }
      await this.persist();
      this.emit();
    }
  }

  private async load(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { items?: QueuedScan[]; rejected?: RejectedScan[] };
        this.items = parsed.items ?? [];
        this.rejected = parsed.rejected ?? [];
      }
    } catch {
      this.items = [];
    }
    this.emit();
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify({ items: this.items, rejected: this.rejected }));
    } catch {
      // storage failure must never block scanning; the in-memory queue still syncs
    }
  }

  private emit(): void {
    const snap = this.snapshot();
    this.listeners.forEach((fn) => fn(snap));
  }
}
