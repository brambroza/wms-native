'use client';

import { Boxes } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { useWms } from '@/lib/api/provider';

export default function LoginPage() {
  const { supabase, api } = useWms();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    const next = new URLSearchParams(window.location.search).get('next') ?? '/';
    router.replace(next.startsWith('/') ? next : '/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-[14px] border border-line bg-card p-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary text-white">
            <Boxes size={22} aria-hidden />
          </div>
          <div className="flex flex-col">
            <b className="text-lg">FG Dock</b>
            <span className="text-xs text-muted">WMS งาน FG ส่งออก</span>
          </div>
        </div>
        {api.mode === 'demo' ? (
          <>
            <p className="m-0 text-sm text-secondary">ยังไม่ได้ตั้งค่า Supabase ระบบจึงทำงานในโหมดทดลองด้วยข้อมูลตัวอย่าง</p>
            <Link href="/" className="rounded-[10px] bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white no-underline">
              เข้าโหมดทดลอง
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-[13px] text-muted">
              อีเมล
              <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-[10px] border border-line px-3 py-2.5 text-[15px] text-ink" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-muted">
              รหัสผ่าน
              <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-[10px] border border-line px-3 py-2.5 text-[15px] text-ink" />
            </label>
            {err && <span className="text-sm text-danger">{err}</span>}
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
