import React, { useMemo } from 'react';

const MAX_VAL = 20;
const STEP = 5;

// Symmetric dial: 0 sits at the 9 o'clock (left) position; the scale climbs
// to MAX_VAL both over the top (through 12 o'clock, where it reads 10) and
// under the bottom (through 6 o'clock, also 10), meeting again at 3
// o'clock — matching the reference panel's variometer face.
// (Angle convention here: 0deg = top/12 o'clock, 90deg = right/3 o'clock,
// 180deg = bottom/6 o'clock, 270deg = left/9 o'clock, clockwise.)
function valueToAngleUpper(v) {
  const clamped = Math.max(0, Math.min(MAX_VAL, v));
  return 270 + (clamped / MAX_VAL) * 180; // 270 (left) -> 360/0 (top) -> 450/90 (right)
}
function valueToAngleLower(v) {
  const clamped = Math.max(0, Math.min(MAX_VAL, v));
  return 270 - (clamped / MAX_VAL) * 180; // 270 (left) -> 180 (bottom) -> 90 (right)
}

/**
 * Variometer / vertical-speed indicator. Needle deflects toward 3 o'clock
 * as climb rate increases and toward 9 o'clock... in this classic PIT-panel
 * face the scale is mirrored top/bottom, so the needle simply sweeps
 * through the top half for climb and would sweep the bottom half for
 * descent (negative value).
 */
export function VariometerDial({ value = 0, size = 260, inactive = false }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  const majors = useMemo(() => {
    const out = [];
    for (let v = 0; v <= MAX_VAL; v += STEP) {
      out.push({ v, deg: valueToAngleUpper(v), half: 'upper' });
      if (v > 0 && v < MAX_VAL) out.push({ v, deg: valueToAngleLower(v), half: 'lower' });
    }
    return out;
  }, []);

  const ticks = useMemo(() => {
    const out = [];
    for (let v = 0; v <= MAX_VAL; v += 1) {
      out.push({ deg: valueToAngleUpper(v), major: v % STEP === 0 });
      if (v > 0 && v < MAX_VAL) out.push({ deg: valueToAngleLower(v), major: v % STEP === 0 });
    }
    return out;
  }, []);

  const needleDeg = value >= 0 ? valueToAngleUpper(value) : valueToAngleLower(-value);

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#1c1a17" stroke="#111827" strokeWidth={2} />

        {ticks.map(({ deg, major }, i) => {
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - (major ? 13 : 7);
          const r2 = r - 3;
          return (
            <line key={i}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="white" strokeWidth={major ? 2 : 1}
            />
          );
        })}

        {majors.map(({ v, deg, half }) => {
          if (v === 0) return null; // hidden under the needle, as on the real face
          const a = (deg - 90) * Math.PI / 180;
          const lr = r - 30;
          return (
            <text key={`${half}-${v}`}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={15} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="middle"
            >{v}</text>
          );
        })}

        <text x={cx} y={cy - 34} fill="white" fontSize={11} fontWeight={700}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle" letterSpacing="0.5">
          VERTICAL SPEED
        </text>
        <text x={cx} y={cy + 40} fill="white" fontSize={10} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle" letterSpacing="0.5">
          100 FEET PER MIN
        </text>

        {/* Two-tone needle: light pointer + dark hub stub, like the reference face.
            The needle art below points left (270deg) at rotate(0), so subtract 270. */}
        <g transform={`rotate(${needleDeg - 270} ${cx} ${cy})`}>
          <line x1={cx - (r - 14)} y1={cy} x2={cx + 6} y2={cy} stroke="#f5f0e1" strokeWidth={5} strokeLinecap="round" />
          <path d={`M ${cx - (r - 14)} ${cy} l 14 -6 l 0 12 Z`} fill="#f5f0e1" />
          <rect x={cx - 4} y={cy - 5} width={38} height={10} rx={5} fill="#2b2b2b" />
        </g>
        <circle cx={cx} cy={cy} r={4} fill="#f5f0e1" />
      </svg>
    </div>
  );
}
