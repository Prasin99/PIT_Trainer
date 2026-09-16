import React from 'react';

/**
 * Panel stopwatch — same 60-around-the-dial layout as ClockDial, but with
 * the cream needle and small "MIN" sub-register styling of the PIT
 * reference panel.
 */
export function StopwatchDial({ value = 0, size = 200 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const labels = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  const handAngle = ((value % 60) / 60) * 360;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#1c1a17" stroke="#111827" strokeWidth={2} />

        {ticks.map((i) => {
          const major = i % 5 === 0;
          const deg = i * 6;
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - (major ? 11 : 5), r2 = r - 2;
          return (
            <line key={i}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="white" strokeWidth={major ? 2 : 1}
            />
          );
        })}
        {labels.map((m) => {
          const deg = (m === 60 ? 0 : m * 6);
          const a = (deg - 90) * Math.PI / 180;
          const lr = r - 23;
          return (
            <text key={m}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={11} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="middle"
            >{m}</text>
          );
        })}

        {/* Small inner minutes sub-register, cosmetic */}
        <circle cx={cx} cy={cy + r * 0.42} r={r * 0.22} fill="none" stroke="#4b5563" strokeWidth={1} />
        <text x={cx} y={cy + r * 0.68} fill="#9ca3af" fontSize={9} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">MIN</text>
        <path d={`M ${cx + r * 0.30} ${cy + r * 0.30} l 9 -5 l 0 10 Z`} fill="#111827" />

        <g transform={`rotate(${handAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 10} x2={cx} y2={cy - r + 10}
            stroke="#f5f0e1" strokeWidth={2.5} strokeLinecap="round" />
        </g>
        <rect x={cx - 4} y={cy - 6} width={8} height={12} rx={1.5} fill="#111827" stroke="#f5f0e1" strokeWidth={1} />
      </svg>
    </div>
  );
}
