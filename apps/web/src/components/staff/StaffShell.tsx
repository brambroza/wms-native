'use client';

import { ChevronLeft, CloudOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
import { useWms } from '@/lib/api/provider';
import { cx } from '../ui';

/** Header for staff screens: back button, title, online / pending badge. */
export function StaffHeader({ title, sub, back, pending = 0 }: { title: string; sub?: string; back?: string; pending?: number }) {
  const online = useOnline();
  const { api } = useWms();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-card px-4 py-3">
      {back && (
        <Link href={back} aria-label="กลับ" className="flex h-11 w-11 items-center justify-center rounded-xl border border-line">
          <ChevronLeft size={22} aria-hidden />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <b className="truncate text-[17px] font-semibold">{title}</b>
        {sub && <span className="truncate text-[13px] text-muted">{sub}</span>}
      </div>
      {pending > 0 && <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">รอส่ง {pending}</span>}
      <span className={cx('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', online ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
        {!online && <CloudOff size={12} aria-hidden />}
        {online ? (api.mode === 'demo' ? 'ทดลอง' : 'ออนไลน์') : 'ออฟไลน์'}
      </span>
    </header>
  );
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

export function Flash({ msg }: { msg: { ok: boolean; text: string; queued?: boolean } | null }) {
  if (!msg) return null;
  return (
    <div role="status" className={cx('animate-flash rounded-xl px-4 py-3 text-base font-semibold', msg.queued ? 'bg-warn-soft text-warn' : msg.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
      {msg.text}
    </div>
  );
}

/** Registers the service worker that keeps /m usable offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}
