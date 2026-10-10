import type { CartonStatus, ContainerStatus, ContainerType, PlanStatus } from './types';

export const CONTAINER_TYPES: Record<ContainerType['code'], ContainerType> = {
  '20GP': { code: '20GP', innerLengthCm: 590, innerWidthCm: 235, innerHeightCm: 239, maxPayloadKg: 28200 },
  '40GP': { code: '40GP', innerLengthCm: 1203, innerWidthCm: 235, innerHeightCm: 239, maxPayloadKg: 26700 },
  '40HC': { code: '40HC', innerLengthCm: 1203, innerWidthCm: 235, innerHeightCm: 269, maxPayloadKg: 26500 },
  '45HC': { code: '45HC', innerLengthCm: 1356, innerWidthCm: 235, innerHeightCm: 269, maxPayloadKg: 27600 },
};

/** Vendor ship-method codes seen on packing plans. */
export const SHIP_METHOD_CODES: Record<string, 'SEA' | 'AIR' | 'TRUCK'> = {
  VL: 'SEA',
  AF: 'AIR',
  TR: 'TRUCK',
};

type Tone = 'success' | 'info' | 'warn' | 'danger' | 'neutral' | 'ai';

export const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-success-soft text-success',
  info: 'bg-primary-soft text-link',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-neutral-soft text-secondary',
  ai: 'bg-ai-soft text-ai',
};

export const PLAN_STATUS: Record<PlanStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'ร่าง', tone: 'neutral' },
  VALIDATED: { label: 'ตรวจผ่าน', tone: 'info' },
  PENDING_APPROVAL: { label: 'รออนุมัติ', tone: 'warn' },
  APPROVED: { label: 'อนุมัติแล้ว', tone: 'info' },
  SUBMITTED: { label: 'ส่ง vendor แล้ว', tone: 'info' },
  RELEASED: { label: 'ปล่อยงานหยิบ', tone: 'info' },
  LOADING: { label: 'กำลังโหลด', tone: 'info' },
  CLOSED: { label: 'โหลดแล้ว', tone: 'success' },
};

export const CONTAINER_STATUS: Record<ContainerStatus, { label: string; tone: Tone }> = {
  PLANNED: { label: 'รอหยิบ', tone: 'neutral' },
  PICKING: { label: 'กำลังหยิบ', tone: 'warn' },
  READY: { label: 'พร้อมโหลด', tone: 'success' },
  LOADING: { label: 'กำลังโหลด', tone: 'info' },
  CLOSED: { label: 'ปิดตู้แล้ว', tone: 'success' },
};

export const CARTON_STATUS: Record<CartonStatus, { label: string; tone: Tone }> = {
  IN_TRANSIT: { label: 'อยู่ระหว่างโอน', tone: 'ai' },
  AVAILABLE: { label: 'พร้อมใช้', tone: 'success' },
  RESERVED: { label: 'จองแล้ว', tone: 'info' },
  PICKED: { label: 'หยิบแล้ว', tone: 'warn' },
  STAGED: { label: 'รอที่ Staging', tone: 'neutral' },
  LOADED: { label: 'ขึ้นตู้แล้ว', tone: 'success' },
  SHIPPED: { label: 'ส่งออกแล้ว', tone: 'success' },
  HOLD: { label: 'Hold', tone: 'danger' },
};

/** Categorical colours for PO groups in charts / 3D (data colours, not status). */
export const GROUP_COLORS = ['#4DA3F0', '#3DBE7A', '#9B87E8', '#F2B84B', '#E58A5E', '#4FC1C9'];
