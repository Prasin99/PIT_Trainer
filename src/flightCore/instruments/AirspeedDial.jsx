import React, { useMemo } from 'react';

const MIN_SPEED   = 40;
const MAX_SPEED   = 260;
const SWEEP_START = 45;     // 40 at 1-2 o'clock (top-right)
const SWEEP_END   = 315;    // 260 at 10-11 o'clock (top-left)
const SWEEP_RANGE = SWEEP_END - SWEEP_START;   // 270°

function speedToAngle(s) {
  const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, s));
  return SWEEP_START + (clamped - MIN_SPEED) / (MAX_SPEED - MIN_SPEED) * SWEEP_RANGE;
}

function arcPath(cx, cy, r, deg0, deg1) {
  const a0 = (deg0 - 90) * Math.PI / 180;
  const a1 = (deg1 - 90) * Math.PI / 180;
  const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r;
  const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
  const large = deg1 - deg0 > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

export function AirspeedDial({
  value = 0, target = 0, tolerance, size = 200,
  inactive = false, outOfTolerance = false,
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const arcR = r - 14;

  const labels = useMemo(() => {
    const out = [];
    for (let s = MIN_SPEED; s <= MAX_SPEED; s += 20) {
      out.push({ speed: s, deg: speedToAngle(s) });
    }
    return out;
  }, []);

  const ticks = useMemo(() => {
    const out = [];
    for (let s = MIN_SPEED; s <= MAX_SPEED; s += 5) {
      out.push({ deg: speedToAngle(s), major: s % 20 === 0 });
    }
    return out;
  }, []);

  const needleAngle = speedToAngle(value);
  const targetAngle = speedToAngle(target);

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Face */}
        <circle cx={cx} cy={cy} r={r} fill="#1f2937" stroke="#111827" strokeWidth={2} />

        {/* Colored arcs — sweep goes CLOCKWISE: low (right) → mid (bottom) → high (left) */}
        <path d={arcPath(cx, cy, arcR, speedToAngle(40),  speedToAngle(180))}
              fill="none" stroke="#22c55e" strokeWidth={8} strokeLinecap="butt" />
        <path d={arcPath(cx, cy, arcR, speedToAngle(180), speedToAngle(200))}
              fill="none" stroke="#facc15" strokeWidth={8} strokeLinecap="butt" />
        <path d={arcPath(cx, cy, arcR, speedToAngle(200), speedToAngle(220))}
              fill="none" stroke="#f97316" strokeWidth={8} strokeLinecap="butt" />
        <path d={arcPath(cx, cy, arcR, speedToAngle(220), speedToAngle(260))}
              fill="none" stroke="#ef4444" strokeWidth={8} strokeLinecap="butt" />

        {/* Tick marks */}
        {ticks.map(({ deg, major }) => {
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - (major ? 14 : 8);
          const r2 = r - 4;
          return (
            <line key={deg}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="white" strokeWidth={major ? 2 : 1}
            />
          );
        })}

        {/* Number labels */}
        {labels.map(({ speed, deg }) => {
          const a = (deg - 90) * Math.PI / 180;
          const lr = r - 32;
          return (
            <text key={speed}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={14} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="middle"
            >{speed}</text>
          );
        })}

        {/* KNOTS / AIRSPEED label at top center */}
        <text x={cx} y={cy - 36} fill="white" fontSize={15} fontWeight={700}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle">KNOTS</text>
        <text x={cx} y={cy - 18} fill="white" fontSize={12} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle">AIRSPEED</text>

        {/* Needle */}
        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 8} x2={cx} y2={cy - r + 22}
                stroke="white" strokeWidth={4} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={4} fill="white" />

        {/* Green target dot */}
        {tolerance && (() => {
          const a = (targetAngle - 90) * Math.PI / 180;
          const tr = r - 4;
          return (
            <circle cx={cx + Math.cos(a) * tr} cy={cy + Math.sin(a) * tr}
                    r={7} fill="#22c55e" />
          );
        })()}

        {outOfTolerance && !inactive && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth={3} />
        )}
      </svg>
    </div>
  );
}