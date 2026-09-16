import React, { useMemo } from 'react';

const MIN_RPM = 5;
const MAX_RPM = 35;
// 5 sits at the 7:30 position (lower-left) and the scale sweeps clockwise
// through 9 o'clock, 12 o'clock (=20) and around to 35 at ~4 o'clock,
// matching the reference panel's RPM gauge.
const SWEEP_START = 225;
const SWEEP_END = 495;
const SWEEP_RANGE = SWEEP_END - SWEEP_START;

function rpmToAngle(v) {
  const clamped = Math.max(MIN_RPM, Math.min(MAX_RPM, v));
  return SWEEP_START + (clamped - MIN_RPM) / (MAX_RPM - MIN_RPM) * SWEEP_RANGE;
}

/**
 * RPM indicator (×100), small round dial styled after the PIT reference panel.
 */
export function TachometerDial({ value = 19, size = 200, inactive = false }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  const labels = useMemo(() => {
    const out = [];
    for (let v = MIN_RPM; v <= MAX_RPM; v += 5) out.push({ v, deg: rpmToAngle(v) });
    return out;
  }, []);

  const ticks = useMemo(() => {
    const out = [];
    for (let v = MIN_RPM; v <= MAX_RPM; v += 1) out.push({ deg: rpmToAngle(v), major: v % 5 === 0 });
    return out;
  }, []);

  const needleAngle = rpmToAngle(value);

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#1c1a17" stroke="#111827" strokeWidth={2} />

        {ticks.map(({ deg, major }) => {
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - (major ? 13 : 7);
          const r2 = r - 3;
          return (
            <line key={deg}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="white" strokeWidth={major ? 2 : 1}
            />
          );
        })}

        {labels.map(({ v, deg }) => {
          const a = (deg - 90) * Math.PI / 180;
          const lr = r - 28;
          return (
            <text key={v}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={15} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="middle"
            >{v}</text>
          );
        })}

        <text x={cx} y={cy - 4} fill="#9ca3af" fontSize={8.5} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">RPM</text>
        <text x={cx} y={cy + 6} fill="#9ca3af" fontSize={8.5} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">GAUGE</text>

        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 8} x2={cx} y2={cy - r + 20}
            stroke="white" strokeWidth={3.5} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={4} fill="white" />
      </svg>
    </div>
  );
}
