import { TONE_CLASSES } from '@wms/shared';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export type Tone = keyof typeof TONE_CLASSES;

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ className, children, ...rest }: ComponentProps<'section'>) {
  return (
    <section className={cx('rounded-[14px] border border-line bg-card', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, right, sub }: { title: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-[18px] pt-4 pb-3">
      <div className="flex flex-col">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {sub && <span className="text-[13px] text-muted">{sub}</span>}
      </div>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', TONE_CLASSES[tone], className)}>{children}</span>;
}

export function Progress({ value, className, color = 'bg-data' }: { value: number; className?: string; color?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-divider', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Kpi({ label, value, sub, delta, tone = 'success' }: { label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode; tone?: Tone }) {
  return (
    <Card className="flex flex-col gap-2 px-[18px] py-4">
      <span className="text-sm text-secondary">{label}</span>
      <div className="h-px bg-divider" />
      <b className="text-[26px] font-semibold leading-tight">{value}</b>
      <div className="flex items-center gap-2">
        {sub && <span className="text-xs text-muted">{sub}</span>}
        {delta && <Pill tone={tone} className="ml-auto">{delta}</Pill>}
      </div>
    </Card>
  );
}

export function PageHeader({ title, crumbs, actions }: { title: string; crumbs?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-card px-7 py-[18px]">
      <div className="flex flex-col">
        <h1 className="m-0 text-xl font-semibold">{title}</h1>
        {crumbs && <span className="text-[13px] text-muted">{crumbs}</span>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BTN = {
  primary: 'bg-primary text-white hover:bg-primary-hover font-semibold border border-primary',
  secondary: 'bg-card text-ink border border-line hover:bg-ground',
  ghost: 'bg-transparent text-link hover:bg-primary-soft border border-transparent',
};

export function Button({ variant = 'secondary', className, ...rest }: ComponentProps<'button'> & { variant?: keyof typeof BTN }) {
  return <button type="button" className={cx('inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50', BTN[variant], className)} {...rest} />;
}

export function ButtonLink({ variant = 'secondary', className, ...rest }: ComponentProps<typeof Link> & { variant?: keyof typeof BTN }) {
  return <Link className={cx('inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm no-underline transition', BTN[variant], className)} {...rest} />;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('bg-[#f6f8fa] px-4 py-2.5 text-left text-xs font-medium text-muted', className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('border-t border-divider px-4 py-3 text-sm', className)}>{children}</td>;
}

export function Loading({ label = 'กำลังโหลด…' }: { label?: string }) {
  return <div className="p-8 text-sm text-muted">{label}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="m-6 rounded-[10px] border border-danger-soft bg-danger-soft p-4 text-sm text-danger">{message}</div>;
}

export function AiChip({ children = 'AI' }: { children?: ReactNode }) {
  return <span className="inline-flex rounded-md bg-ai-soft px-1.5 py-0.5 text-[11px] font-semibold text-ai">{children}</span>;
}
