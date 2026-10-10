'use client';

import { BarChart3, Boxes, FileText, LayoutGrid, LogOut, Smartphone, Truck, Warehouse } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWms } from '@/lib/api/provider';
import { cx } from './ui';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutGrid },
  { href: '/plans', label: 'Packing Plan', icon: FileText, sub: [{ href: '/plans', label: 'รายการแผน' }, { href: '/plans/import', label: 'นำเข้า' }] },
  { href: '/stock', label: 'สต็อก & คลัง', icon: Warehouse },
  { href: '/loading', label: 'ตู้ & โหลด', icon: Truck },
  { href: '/reports', label: 'รายงาน', icon: BarChart3, disabled: true },
];

export function Sidebar() {
  const path = usePathname();
  const { api, session, signOut } = useWms();
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <aside className="flex w-full flex-col gap-1.5 border-b border-line bg-card px-4 py-5 lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="mb-2 flex items-center gap-2.5 border-b border-divider px-1.5 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-white">
          <Boxes size={20} aria-hidden />
        </div>
        <div className="flex flex-col">
          <b className="text-base">FG Dock</b>
          <span className="text-xs text-muted">WMS ส่งออก</span>
        </div>
      </div>
      <span className="px-2.5 pt-2 pb-1 text-[11px] tracking-wider text-[#8a94a3]">หลัก</span>
      <nav aria-label="เมนูหลัก" className="flex flex-row flex-wrap gap-0.5 lg:flex-col">
        {NAV.map(({ href, label, icon: Icon, sub, disabled }) => (
          <div key={href} className="flex flex-col">
            {disabled ? (
              <span className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm text-[#a3acb8]" title="เร็ว ๆ นี้">
                <Icon size={18} aria-hidden />
                {label}
              </span>
            ) : (
              <Link
                href={href}
                aria-current={isActive(href) ? 'page' : undefined}
                className={cx('flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm no-underline', isActive(href) ? 'bg-primary-soft font-semibold text-link' : 'text-secondary hover:bg-ground')}
              >
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            )}
            {sub && isActive(href) && (
              <div className="hidden flex-col lg:flex">
                {sub.map((s) => (
                  <Link key={s.href} href={s.href} className={cx('rounded-[10px] py-2 pr-3 pl-10 text-[13px] no-underline', path === s.href ? 'font-semibold text-link' : 'text-muted hover:text-ink')}>
                    {s.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <span className="px-2.5 pt-4 pb-1 text-[11px] tracking-wider text-[#8a94a3]">หน้างาน</span>
      <Link href="/m" className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm text-secondary no-underline hover:bg-ground">
        <Smartphone size={18} aria-hidden />
        แอป Staff (PWA)
      </Link>
      <div className="mt-auto hidden items-center gap-2.5 border-t border-divider px-2 pt-3 lg:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-link">
          {(session?.user.email ?? 'D').slice(0, 2).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col">
          <b className="truncate text-sm font-semibold">{session?.user.email ?? 'โหมดทดลอง'}</b>
          <span className="text-xs text-muted">{api.mode === 'demo' ? 'ข้อมูลตัวอย่าง' : 'เชื่อม Supabase'}</span>
        </div>
        {session && (
          <button type="button" onClick={signOut} aria-label="ออกจากระบบ" className="ml-auto rounded-lg p-2 text-muted hover:bg-ground">
            <LogOut size={16} aria-hidden />
          </button>
        )}
      </div>
    </aside>
  );
}
