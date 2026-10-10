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
    <div className="pointer-events-none absolute flex flex-col justify-center px-[3%] text-white" style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, height: `${box.height}%`, textShadow: '0 1px 4px rgba(15,23,32,.55)' }}>
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

/**
 * Detailed side view of a cab-over tractor pulling a 40' container (viewBox 720×250).
 * The container body (x 228–702, y 26–192) must stay where VECTOR_BOX says.
 */
function VectorTruck({ pct, compact, label }: { pct: number; compact: boolean; label: string }) {
  const id = useId().replace(/:/g, '');
  const u = (name: string) => `url(#${name}-${id})`;
  const fillW = Math.round((474 * pct) / 100);
  const detail = !compact;
  return (
    <svg viewBox="0 0 720 250" width="100%" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`cab-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#eef2f6" />
          <stop offset="1" stopColor="#d3dbe4" />
        </linearGradient>
        <linearGradient id={`cabside-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity=".10" />
          <stop offset=".12" stopColor="#000" stopOpacity="0" />
          <stop offset=".9" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".08" />
        </linearGradient>
        <linearGradient id={`glass-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d5b75" />
          <stop offset=".5" stopColor="#6f95b6" />
          <stop offset="1" stopColor="#2a4054" />
        </linearGradient>
        <linearGradient id={`chrome-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f8fa" />
          <stop offset=".35" stopColor="#b3bdc7" />
          <stop offset=".55" stopColor="#eef1f4" />
          <stop offset="1" stopColor="#7c8794" />
        </linearGradient>
        <linearGradient id={`chromev-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a95a1" />
          <stop offset=".4" stopColor="#f4f6f8" />
          <stop offset="1" stopColor="#7c8794" />
        </linearGradient>
        <linearGradient id={`steel-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8eef4" />
          <stop offset="1" stopColor="#c9d4df" />
        </linearGradient>
        <linearGradient id={`load-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#67b5f7" />
          <stop offset="1" stopColor="#2a7ccb" />
        </linearGradient>
        <linearGradient id={`rib-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".45" stopColor="#000" stopOpacity=".10" />
          <stop offset="1" stopColor="#fff" stopOpacity=".28" />
        </linearGradient>
        <pattern id={`ribs-${id}`} x="228" y="0" width="11" height="250" patternUnits="userSpaceOnUse">
          <rect width="11" height="250" fill={u('rib')} />
        </pattern>
        <radialGradient id={`tire-${id}`}>
          <stop offset=".55" stopColor="#2b3138" />
          <stop offset=".85" stopColor="#1a1e23" />
          <stop offset="1" stopColor="#0f1215" />
        </radialGradient>
        <radialGradient id={`rim-${id}`} cx=".4" cy=".35">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".6" stopColor="#c3ccd5" />
          <stop offset="1" stopColor="#7d8894" />
        </radialGradient>
        <linearGradient id={`lamp-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffe3a3" />
        </linearGradient>
        <filter id={`soft-${id}`} x="-10%" y="-200%" width="120%" height="500%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <clipPath id={`box-${id}`}>
          <rect x="228" y="26" width="474" height="166" rx="3" />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="372" cy="231" rx="342" ry="7" fill="#0f1720" opacity=".22" filter={u('soft')} />

      {/* ---------- container ---------- */}
      <g clipPath={u('box')}>
        <rect x="228" y="26" width="474" height="166" fill={u('steel')} />
        <rect x="228" y="26" width={fillW} height="166" fill={u('load')} style={{ transition: 'width .6s ease' }} />
        <rect x="228" y="26" width="474" height="166" fill={u('ribs')} />
        {/* top / bottom rails and corner posts */}
        <rect x="228" y="26" width="474" height="8" fill="#000" opacity=".13" />
        <rect x="228" y="183" width="474" height="9" fill="#000" opacity=".2" />
        <rect x="228" y="26" width="9" height="166" fill="#000" opacity=".12" />
        <rect x="693" y="26" width="9" height="166" fill="#000" opacity=".14" />
        {pct > 0 && pct < 100 && <rect x={228 + fillW - 2} y="26" width="4" height="166" fill="#fff" opacity=".9" style={{ transition: 'x .6s ease' }} />}
      </g>
      {[
        [228, 26],
        [690, 26],
        [228, 182],
        [690, 182],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="12" height="10" rx="1.5" fill="#7f8b97" />
      ))}
      {detail && (
        <g fill="#5d6a77" opacity=".75" fontSize="9" fontWeight="600" letterSpacing="1">
          <text x="684" y="50" textAnchor="end">WMSU 401827 3</text>
          <text x="684" y="62" textAnchor="end" fontSize="7.5" fontWeight="400">45G1</text>
        </g>
      )}

      {/* ---------- chassis ---------- */}
      <rect x="40" y="186" width="370" height="14" rx="2" fill="#262c33" />
      <rect x="228" y="192" width="480" height="9" fill="#2b3138" />
      {/* landing gear */}
      <rect x="452" y="200" width="8" height="22" fill="#3a424b" />
      <rect x="446" y="220" width="20" height="5" rx="1" fill="#2b3138" />
      {/* side underrun guard */}
      {detail && (
        <g fill="#9aa5b1">
          <rect x="384" y="205" width="166" height="4" rx="2" />
          <rect x="384" y="214" width="166" height="4" rx="2" />
        </g>
      )}
      {/* rear lights + bumper */}
      <rect x="698" y="199" width="12" height="15" rx="2" fill="#30373f" />
      <rect x="701" y="202" width="7" height="6" rx="1" fill="#e5484d" />

      {/* ---------- tractor ---------- */}
      {/* exhaust stack + air deflector */}
      <rect x="214" y="36" width="8" height="136" rx="3" fill={u('chromev')} />
      <rect x="212" y="32" width="12" height="7" rx="2" fill="#5b6672" />
      <path d="M86 50 C122 31 168 27 210 27 L212 48 Z" fill={u('cab')} stroke="#c9d2dc" strokeWidth="1" />
      {/* cab body */}
      <path d="M40 186 L36 96 Q35 52 72 49 L196 45 Q211 45 211 61 L211 186 Z" fill={u('cab')} stroke="#c3ccd6" strokeWidth="1.5" />
      <path d="M40 186 L36 96 Q35 52 72 49 L196 45 Q211 45 211 61 L211 186 Z" fill={u('cabside')} />
      {/* sun visor */}
      <path d="M40 66 Q44 54 72 52 L110 51 L110 58 L44 64 Z" fill="#2c3540" />
      {/* windshield edge + door glass */}
      <path d="M44 70 L106 63 L106 114 L41 118 Q40 92 44 70 Z" fill={u('glass')} />
      <path d="M118 62 L176 59 Q184 59 184 67 L184 112 L118 114 Z" fill={u('glass')} />
      {detail && (
        <g fill="#fff" opacity=".22">
          <path d="M52 69 L70 67 L50 116 L42 117 Z" />
          <path d="M128 62 L142 61 L124 113 L118 113 Z" />
        </g>
      )}
      {/* door + cut lines */}
      <path d="M112 58 L112 168 L188 168 L188 58" fill="none" stroke="#b7c1cc" strokeWidth="1.5" />
      <rect x="166" y="124" width="16" height="4" rx="2" fill="#7c8794" />
      {/* brand stripe */}
      <rect x="37" y="134" width="174" height="7" fill="#1c74c4" />
      <rect x="37" y="143" width="174" height="2.5" fill="#4da3f0" />
      {/* grab handle */}
      {detail && <rect x="194" y="74" width="4" height="70" rx="2" fill={u('chromev')} />}
      {/* steps */}
      <rect x="120" y="170" width="54" height="5" rx="1.5" fill="#39424c" />
      <rect x="120" y="180" width="54" height="5" rx="1.5" fill="#39424c" />
      {/* mirror */}
      <path d="M48 78 L28 74" stroke="#39424c" strokeWidth="3" strokeLinecap="round" />
      <rect x="18" y="62" width="10" height="34" rx="3" fill="#2c3540" />
      {/* front bumper + lamps */}
      <path d="M30 168 H66 V190 Q66 194 62 194 H34 Q30 194 30 190 Z" fill={u('chrome')} />
      <rect x="34" y="150" width="14" height="12" rx="2" fill={u('lamp')} stroke="#c9b27a" strokeWidth=".8" />
      <rect x="50" y="152" width="8" height="8" rx="1.5" fill="#f5a524" />
      {/* steer wheel arch */}
      <path d="M58 206 A38 38 0 0 1 134 206 V188 H58 Z" fill="#1d2228" />
      <path d="M56 188 A40 40 0 0 1 136 188" fill="none" stroke="#2c3540" strokeWidth="5" />
      {/* fuel tank */}
      <rect x="226" y="158" width="44" height="26" rx="11" fill={u('chrome')} />
      {detail && (
        <g fill="#6c7783">
          <rect x="236" y="158" width="3" height="26" />
          <rect x="257" y="158" width="3" height="26" />
        </g>
      )}
      {/* mud flaps */}
      <rect x="390" y="196" width="5" height="30" fill="#1d2228" />
      <rect x="712" y="196" width="4" height="28" fill="#1d2228" />

      {/* ---------- wheels ---------- */}
      {[96, 300, 356, 584, 636, 688].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="206" r="25" fill={u('tire')} />
          <circle cx={cx} cy="206" r="21" fill="none" stroke="#3a424b" strokeWidth="1" />
          <circle cx={cx} cy="206" r="14" fill={u('rim')} />
          <circle cx={cx} cy="206" r="14" fill="none" stroke="#6b7682" strokeWidth="1" />
          <circle cx={cx} cy="206" r="5.5" fill="#56616d" />
          {detail &&
            [0, 60, 120, 180, 240, 300].map((a) => (
              <circle key={a} cx={cx + 9 * Math.cos((a * Math.PI) / 180)} cy={206 + 9 * Math.sin((a * Math.PI) / 180)} r="1.6" fill="#4a5561" />
            ))}
        </g>
      ))}
    </svg>
  );
}
