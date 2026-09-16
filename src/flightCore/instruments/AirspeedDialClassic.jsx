import React, { useMemo } from 'react';

const MIN_SPEED = 40;
const MAX_SPEED = 180;
const SWEEP_START = 20;
const SWEEP_END = 300;
const SWEEP_RANGE = SWEEP_END - SWEEP_START;

function speedToAngle(s) {
  const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, s));
  return SWEEP_START + (clamped - MIN_SPEED) / (MAX_SPEED - MIN_SPEED) * SWEEP_RANGE;
}

/**
 * Classic single-needle airspeed indicator (no tolerance arcs), styled after
 * the PIT reference panel: STALL placard, AIRSPEED / KNOTS captions.
 */
export function AirspeedDialClassic({ value = 120, size = 260, inactive = false }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  const labels = useMemo(() => {
    const out = [];
    for (let s = MIN_SPEED; s <= MAX_SPEED; s += 20) out.push({ s, deg: speedToAngle(s) });
    return out;
  }, []);

  // Full 360° of minor ticks so the unlabeled top gap still reads as a dial,
  // matching the reference photo.
  const ticks = useMemo(() => {
    const out = [];
    for (let d = 0; d < 360; d += 6) out.push(d);
    return out;
  }, []);
  const majorTickDegs = useMemo(() => new Set(labels.map((l) => Math.round(l.deg))), [labels]);

  const needleAngle = speedToAngle(value);

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#1c1a17" stroke="#111827" strokeWidth={2} />

        {ticks.map((deg) => {
          const major = majorTickDegs.has(deg);
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - (major ? 14 : 8);
          const r2 = r - 4;
          return (
            <line key={deg}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="white" strokeWidth={major ? 2.5 : 1}
            />
          );
        })}

        {labels.map(({ s, deg }) => {
          const a = (deg - 90) * Math.PI / 180;
          const lr = r - 34;
          return (
            <text key={s}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={19} fontWeight={700}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="middle"
            >{s}</text>
          );
        })}

        {/* STALL placard */}
        <rect x={cx - 30} y={cy - 68} width={60} height={17} fill="none" stroke="white" strokeWidth={1.2} />
        <text x={cx} y={cy - 59} fill="white" fontSize={11} fontWeight={700}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle" dominantBaseline="middle">STALL</text>

        <text x={cx} y={cy - 40} fill="white" fontSize={12} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">AIRSPEED</text>

        <text x={cx} y={cy + 44} fill="white" fontSize={12} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">KNOTS</text>

        {/* Needle: long pointer + short tail cone toward the placard */}
        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 6} x2={cx} y2={cy - r + 18}
            stroke="#f5f0e1" strokeWidth={4.5} strokeLinecap="round" />
          <path d={`M ${cx - 6} ${cy + 6} L ${cx + 6} ${cy + 6} L ${cx} ${cy - 28} Z`} fill="#3a362f" />
        </g>
        <circle cx={cx} cy={cy} r={4.5} fill="#f5f0e1" />
      </svg>
    </div>
  );
}
