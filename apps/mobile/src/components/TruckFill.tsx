import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

/**
 * Side view of a tractor + container. Fill colour inside the box = loaded share.
 * `pct` 0..100 (fraction of planned cartons loaded, or volume % when known).
 */
export function TruckFill({ pct, label, height = 120 }: { pct: number; label?: string; height?: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const boxX = 8;
  const boxY = 8;
  const boxW = 226;
  const boxH = 78;
  const fillW = (boxW - 4) * (p / 100);
  const ribs = Array.from({ length: 11 }, (_, i) => boxX + ((i + 1) * boxW) / 12);
  return (
    <Svg width="100%" height={height} viewBox="0 0 320 120" accessibilityLabel={`โหลดแล้ว ${Math.round(p)}%`}>
      {/* trailer chassis */}
      <Rect x={boxX} y={boxY + boxH + 2} width={boxW} height={6} rx={2} fill={colors.secondary} />
      {/* container shell */}
      <Rect x={boxX} y={boxY} width={boxW} height={boxH} rx={4} fill={colors.card} stroke={colors.muted} strokeWidth={2} />
      {/* load fill (from the front/nose = right side, toward the doors = left) */}
      <Rect x={boxX + 2 + (boxW - 4 - fillW)} y={boxY + 2} width={fillW} height={boxH - 4} rx={2} fill={colors.data} opacity={0.9} />
      <G opacity={0.35}>
        {ribs.map((x) => (
          <Line key={x} x1={x} y1={boxY + 3} x2={x} y2={boxY + boxH - 3} stroke={colors.secondary} strokeWidth={1} />
        ))}
      </G>
      <SvgText x={boxX + boxW / 2} y={boxY + boxH / 2 + 9} fontSize={26} fontWeight="bold" fill={colors.text} textAnchor="middle">
        {`${Math.round(p)}%`}
      </SvgText>
      {label ? (
        <SvgText x={boxX + 8} y={boxY + 18} fontSize={13} fontWeight="bold" fill={colors.secondary}>
          {label}
        </SvgText>
      ) : null}
      {/* tractor */}
      <Rect x={240} y={44} width={30} height={50} rx={3} fill={colors.primary} />
      <Rect x={270} y={30} width={42} height={64} rx={6} fill={colors.primary} />
      <Rect x={280} y={38} width={26} height={22} rx={3} fill={colors.primarySoft} />
      <Rect x={234} y={90} width={80} height={6} rx={2} fill={colors.secondary} />
      {/* wheels */}
      {[30, 58, 190, 214, 254, 296].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy={104} r={11} fill={colors.text} />
          <Circle cx={cx} cy={104} r={4} fill={colors.muted} />
        </G>
      ))}
    </Svg>
  );
}
