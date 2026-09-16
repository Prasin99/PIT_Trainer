import React, { useMemo } from 'react';

// Format altitude with a space between thousands and hundreds (e.g. "02 418")
function formatAlt(v) {
  const n = Math.max(0, Math.round(v));
  const s = String(n).padStart(5, '0');
  return `${s.slice(0, 2)} ${s.slice(2)}`;
}

export function AltimeterDial({
  value = 0, target = 0, tolerance, size = 200,
  inactive = false, outOfTolerance = false,
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  // 10 numerals 0..9 around the rim, clock-position layout
  const labels = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ deg: i * 36, text: String(i) })),
    []
  );
  // Fine tick marks every 3°, major at each numeral (every 36°)
  const ticks = useMemo(() => {
    const out = [];
    for (let d = 0; d < 360; d += 3) out.push({ deg: d, major: d % 36 === 0 });
    return out;
  }, []);

  const needleAngle = (((value  % 1000) + 1000) % 1000) / 1000 * 360;
  const targetAngle = (((target % 1000) + 1000) % 1000) / 1000 * 360;

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Dial face */}
        <circle cx={cx} cy={cy} r={r} fill="#1f2937" stroke="#111827" strokeWidth={2} />

        {/* Ticks */}
        {ticks.map(({ deg, major }) => {
          const a = (deg - 90) * Math.PI / 180;
          const r1 = r - (major ? 12 : 5);
          const r2 = r - 2;
          return (
            <line key={deg}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="white" strokeWidth={major ? 2 : 1}
            />
          );
        })}

        {/* Numerals 0–9 */}
        {labels.map(({ deg, text }) => {
          const a = (deg - 90) * Math.PI / 180;
          const lr = r - 26;
          return (
            <text key={deg}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={17} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="central"
            >{text}</text>
          );
        })}

        {/* Digital window */}
        <rect x={cx - 36} y={cy - 14} width={72} height={22}
              fill="#0b0b0b" stroke="white" strokeWidth={1.2} rx={2} />
        <text x={cx} y={cy - 3} fill="white" fontSize={14} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="central"
              letterSpacing="0.5">
          {formatAlt(value)}
        </text>

        {/* "ALT" label below window */}
        <text x={cx} y={cy + 22} fill="white" fontSize={10} fontWeight={600}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" letterSpacing="1">ALT</text>

        {/* Needle — long, with tail through center */}
        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 18} x2={cx} y2={cy - r + 14}
                stroke="white" strokeWidth={3.5} strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r={3.5} fill="white" />

        {/* Green target dot on rim */}
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