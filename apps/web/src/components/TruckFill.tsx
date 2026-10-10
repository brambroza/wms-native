import { useId } from 'react';

/**
 * Side view of a tractor + container whose body fills with blue as cartons are loaded.
 * `pct` 0–100. Pure SVG so it works on the dashboard, the loading page and the staff PWA.
 */
export function TruckFill({ pct, compact = false, label }: { pct: number; compact?: boolean; label?: string }) {
  const id = useId().replace(/:/g, '');
  const p = Math.max(0, Math.min(100, pct));
  const fillW = Math.round((474 * p) / 100);
  return (
    <svg viewBox="0 0 720 250" width="100%" role="img" aria-label={label ?? `รถหัวลากพร้อมตู้ โหลดแล้ว ${Math.round(p)}%`}>
      <defs>
        <pattern id={`stripe-${id}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="14" fill="rgba(255,255,255,.18)" />
        </pattern>
      </defs>
      <ellipse cx="370" cy="232" rx="350" ry="10" fill="#edf1f5" />
      <rect x="228" y="26" width="474" height="166" rx="8" fill="#dcebfa" stroke="#b8d4f0" />
      <rect x="228" y="26" width={fillW} height="166" rx="8" fill="#4da3f0" style={{ transition: 'width .6s ease' }} />
      <rect x="228" y="26" width={fillW} height="166" rx="8" fill={`url(#stripe-${id})`} style={{ transition: 'width .6s ease' }} />
      {p > 0 && p < 100 && <rect x={228 + fillW - 3} y="26" width="6" height="166" fill="#1c74c4" />}
      {!compact && (
        <g stroke="rgba(255,255,255,.4)" strokeWidth="1.5">
          {[252, 276, 636, 660, 684].map((x) => (
            <line key={x} x1={x} y1="34" x2={x} y2="184" />
          ))}
        </g>
      )}
      <rect x="40" y="190" width="666" height="14" rx="3" fill="#2e3a47" />
      <path d="M38 204 V118 Q38 70 88 64 L168 58 Q200 57 210 88 L224 140 V204 Z" fill="#ffffff" stroke="#d5dce4" strokeWidth="2" />
      <path d="M66 82 L158 74 Q178 73 186 94 L196 128 H66 Z" fill="#cfe6fa" stroke="#9cc3e6" strokeWidth="2" />
      <line x1="130" y1="78" x2="130" y2="128" stroke="#9cc3e6" strokeWidth="2" />
      <rect x="196" y="98" width="10" height="26" rx="3" fill="#2e3a47" />
      <line x1="120" y1="140" x2="120" y2="196" stroke="#e1e6ec" strokeWidth="2" />
      <rect x="32" y="176" width="22" height="26" rx="4" fill="#c7d0da" />
      <rect x="40" y="150" width="14" height="10" rx="2" fill="#ffd27a" />
      <rect x="56" y="148" width="58" height="6" rx="3" fill="#1c74c4" />
      {[96, 300, 356, 592, 648].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="206" r="25" fill="#20262d" />
          <circle cx={cx} cy="206" r="11" fill="#c9d1da" />
        </g>
      ))}
    </svg>
  );
}
