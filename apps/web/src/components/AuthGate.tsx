'use client';

import Link from 'next/link';
import { useWms } from '@/lib/api/provider';
import { Loading } from './ui';

/** Shows a sign-in prompt when Supabase is configured and nobody is signed in. Demo mode passes straight through. */
export function AuthGate({ children, next = '/' }: { children: React.ReactNode; next?: string }) {
  const { api, session, ready } = useWms();
  if (api.mode === 'demo') return <>{children}</>;
  if (!ready) return <Loading />;
  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="m-0 text-base">กรุณาเข้าสู่ระบบก่อนใช้งาน</p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-white no-underline">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

export function DemoBanner() {
  const { api } = useWms();
  if (api.mode !== 'demo') return null;
  return (
    <div className="border-b border-warn-soft bg-warn-soft px-7 py-2 text-[13px] text-warn">
      โหมดทดลอง: ใช้ข้อมูลตัวอย่างในเบราว์เซอร์ · ตั้งค่า <code>NEXT_PUBLIC_SUPABASE_URL</code> และ <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> เพื่อเชื่อมฐานข้อมูลจริง
    </div>
  );
}
