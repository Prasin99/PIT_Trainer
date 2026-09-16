import React from 'react';

export function ClockDial({ value = 0, size = 160 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const labels = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  const handAngle = ((value % 60) / 60) * 360;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="#1f2937" stroke="#111827" strokeWidth={2} />

        {ticks.map((i) => {
          const major = i % 5 === 0;
          const deg = i * 6;
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - (major ? 10 : 4), r2 = r - 2;
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
          const lr = r - 20;
          return (
            <text key={m}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={10} fontFamily="ui-monospace, monospace"
              textAnchor="middle" dominantBaseline="middle"
            >{m}</text>
          );
        })}

        <g transform={`rotate(${handAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 8} x2={cx} y2={cy - r + 12}
                stroke="#ef4444" strokeWidth={2} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={3} fill="white" />
      </svg>
    </div>
  );
}