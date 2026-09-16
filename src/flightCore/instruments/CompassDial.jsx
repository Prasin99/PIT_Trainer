import React, { useMemo } from 'react';

export function CompassDial({
  value, target, tolerance,
  size = 200, inactive = false, outOfTolerance = false,
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  // Cardinal letters big & bold, numbers smaller
  const labels = useMemo(() => [
    { deg: 0,   text: 'N', cardinal: true  },
    { deg: 30,  text: '3', cardinal: false },
    { deg: 60,  text: '6', cardinal: false },
    { deg: 90,  text: 'E', cardinal: true  },
    { deg: 120, text: '12', cardinal: false },
    { deg: 150, text: '15', cardinal: false },
    { deg: 180, text: 'S', cardinal: true  },
    { deg: 210, text: '21', cardinal: false },
    { deg: 240, text: '24', cardinal: false },
    { deg: 270, text: 'W', cardinal: true  },
    { deg: 300, text: '30', cardinal: false },
    { deg: 330, text: '33', cardinal: false },
  ], []);

  // Fine ticks every 5°, major at every 30° (cardinal/numbered positions)
  const ticks = useMemo(() => {
    const out = [];
    for (let d = 0; d < 360; d += 5) {
      out.push({ deg: d, major: d % 30 === 0 });
    }
    return out;
  }, []);

  const cardRotation = -value;

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Face */}
        <circle cx={cx} cy={cy} r={r} fill="#1f2937" stroke="#111827" strokeWidth={2} />

        {/* Rotating compass card */}
        <g transform={`rotate(${cardRotation} ${cx} ${cy})`}>
          {ticks.map(({ deg, major }) => {
            const a = (deg - 90) * Math.PI / 180;
            const r1 = r - (major ? 14 : 7);
            const r2 = r - 2;
            return (
              <line key={deg}
                x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
                x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
                stroke="white" strokeWidth={major ? 2 : 1}
              />
            );
          })}
          {labels.map(({ deg, text, cardinal }) => {
            const a = (deg - 90) * Math.PI / 180;
            const lr = r - (cardinal ? 22 : 26);
            const x = cx + Math.cos(a) * lr;
            const y = cy + Math.sin(a) * lr;
            return (
              <text
                key={deg}
                x={x} y={y}
                fill="white"
                fontSize={cardinal ? 22 : 13}
                fontWeight={cardinal ? 700 : 600}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${-cardRotation} ${x} ${y})`}
              >
                {text}
              </text>
            );
          })}

          {/* Green target dot rides on the rotating card */}
          {tolerance && (() => {
            const a = (target - 90) * Math.PI / 180;
            const tr = r - 4;
            return (
              <circle cx={cx + Math.cos(a) * tr} cy={cy + Math.sin(a) * tr}
                      r={7} fill="#22c55e" />
            );
          })()}
        </g>

        {/* Fixed aircraft silhouette + center line (always points up) */}
        <g>
          {/* Vertical reference line through center */}
          <line x1={cx} y1={cy - r + 18} x2={cx} y2={cy + r - 18}
                stroke="white" strokeWidth={1.5} opacity={0.85} />
          {/* Aircraft body */}
          <path
            d={`
              M ${cx} ${cy - 28}
              L ${cx - 4} ${cy - 14}
              L ${cx - 4} ${cy - 6}
              L ${cx - 26} ${cy + 4}
              L ${cx - 26} ${cy + 10}
              L ${cx - 4} ${cy + 6}
              L ${cx - 4} ${cy + 16}
              L ${cx - 10} ${cy + 22}
              L ${cx - 10} ${cy + 26}
              L ${cx} ${cy + 22}
              L ${cx + 10} ${cy + 26}
              L ${cx + 10} ${cy + 22}
              L ${cx + 4} ${cy + 16}
              L ${cx + 4} ${cy + 6}
              L ${cx + 26} ${cy + 10}
              L ${cx + 26} ${cy + 4}
              L ${cx + 4} ${cy - 6}
              L ${cx + 4} ${cy - 14}
              Z
            `}
            fill="white"
          />
        </g>

        {outOfTolerance && !inactive && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth={3} />
        )}
      </svg>
    </div>
  );
}