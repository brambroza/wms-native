import { useId } from 'react';
import { TRUCK_PHOTO, type TruckPhoto } from '@/lib/truckPhoto';

/**
 * Side view of a tractor + container whose body fills with blue as cartons are loaded.
 * `pct` 0–100. Uses the real photo from lib/truckPhoto.ts when one is configured
 * (except on compact cards), otherwise a vector drawing.
 */
export function TruckFill({ pct, compact = false, label, children }: { pct: number; compact?: boolean; label?: string; children?: React.ReactNode }) {
  const p = Math.max(0, Math.min(100, pct));
  const aria = label ?? `รถหัวลากพร้อมตู้ โหลดแล้ว ${Math.round(p)}%`;
  if (TRUCK_PHOTO && !compact) return <PhotoTruck photo={TRUCK_PHOTO} pct={p} label={aria}>{children}</PhotoTruck>;
  return (
    <div className="relative">
      <VectorTruck pct={p} compact={compact} label={aria} />
      {children && <Overlay box={VECTOR_BOX}>{children}</Overlay>}
    </div>
  );
}

/** container body inside the vector drawing (viewBox 720×250), in % */
const VECTOR_BOX = { left: (228 / 720) * 100, top: (26 / 250) * 100, width: (474 / 720) * 100, height: (166 / 250) * 100 };

/** Text over the container body (e.g. the big loaded %). */
function Overlay({ box, children }: { box: TruckPhoto['box']; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute flex flex-col justify-center px-[3%] text-white" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`, textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
      {children}
    </div>
  );
}

function PhotoTruck({ photo, pct, label, children }: { photo: TruckPhoto; pct: number; label: string; children?: React.ReactNode }) {
  const { box } = photo;
  return (
    <figure role="img" aria-label={label} className="relative m-0 overflow-hidden rounded-xl" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute overflow-hidden rounded-[6px] ring-2 ring-white/70" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%` }}>
        <div className="absolute inset-0 bg-[#dcebfa]/35" />
        <div
          className="absolute inset-y-0 bg-[#1c74c4]/70 transition-[width] duration-700"
          style={{
            width: `${pct}%`,
            [photo.fillFrom]: 0,
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,.16) 0 7px, transparent 7px 14px)',
          }}
        />
        {pct > 0 && pct < 100 && <div className="absolute inset-y-0 w-1.5 bg-white" style={{ [photo.fillFrom]: `calc(${pct}% - 3px)` }} />}
      </div>
      {children && <Overlay box={box}>{children}</Overlay>}
      <figcaption className="absolute right-2 bottom-1.5 text-[10px] text-white/80 drop-shadow">{photo.credit}</figcaption>
    </figure>
  );
}

function VectorTruck({ pct, compact, label }: { pct: number; compact: boolean; label: string }) {
  const id = useId().replace(/:/g, '');
  const fillW = Math.round((474 * pct) / 100);
  return (
    <svg viewBox="0 0 720 250" width="100%" role="img" aria-label={label}>
      <defs>
        <pattern id={`stripe-${id}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="14" fill="rgba(255,255,255,.18)" />
        </pattern>
      </defs>
      <ellipse cx="370" cy="232" rx="350" ry="10" fill="#edf1f5" />
      <rect x="228" y="26" width="474" height="166" rx="8" fill="#dcebfa" stroke="#b8d4f0" />
      <rect x="228" y="26" width={fillW} height="166" rx="8" fill="#4da3f0" style={{ transition: 'width .6s ease' }} />
      <rect x="228" y="26" width={fillW} height="166" rx="8" fill={`url(#stripe-${id})`} style={{ transition: 'width .6s ease' }} />
      {pct > 0 && pct < 100 && <rect x={228 + fillW - 3} y="26" width="6" height="166" fill="#1c74c4" />}
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
