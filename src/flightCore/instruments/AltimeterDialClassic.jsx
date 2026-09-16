import React, { useMemo } from 'react';

/**
 * Classic single-needle altimeter (hundreds of feet, 0-9 dial) styled after
 * the PIT reference panel: "100" / "FEET" captions flanking 0, and a
 * diagonal-striped low-altitude warning wedge between 9 and 0.
 */
export function AltimeterDialClassic({ value = 450, size = 260, inactive = false }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;

  const labels = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({ deg: i * 36, text: String(i) })),
    []
  );
  const ticks = useMemo(() => {
    const out = [];
    for (let d = 0; d < 360; d += 3) out.push({ deg: d, major: d % 36 === 0 });
    return out;
  }, []);

  // value is in tens of feet (0..999 maps once around the dial), matching
  // the single hundreds-needle look of the reference photo.
  const needleAngle = (((value % 1000) + 1000) % 1000) / 1000 * 360;

  const hashId = useMemo(() => `alt-hash-${Math.random().toString(36).slice(2)}`, []);

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <pattern id={hashId} width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#1c1a17" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#f5f0e1" strokeWidth="2" />
          </pattern>
        </defs>

        <circle cx={cx} cy={cy} r={r} fill="#1c1a17" stroke="#111827" strokeWidth={2} />

        {/* Low-altitude warning hash, a thin band near the rim between 9 and 0 */}
        {(() => {
          const rOuter = r - 2, rInner = r - 16;
          const a0 = (-16 - 90) * Math.PI / 180, a1 = (16 - 90) * Math.PI / 180;
          const p = (rad, rr) => `${cx + Math.cos(rad) * rr} ${cy + Math.sin(rad) * rr}`;
          return (
            <path
              d={`M ${p(a0, rOuter)} A ${rOuter} ${rOuter} 0 0 1 ${p(a1, rOuter)}
                  L ${p(a1, rInner)} A ${rInner} ${rInner} 0 0 0 ${p(a0, rInner)} Z`}
              fill={`url(#${hashId})`}
            />
          );
        })()}

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

        {labels.map(({ deg, text }) => {
          const a = (deg - 90) * Math.PI / 180;
          const lr = r - 30;
          return (
            <text key={deg}
              x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
              fill="white" fontSize={22} fontWeight={700}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
              textAnchor="middle" dominantBaseline="central"
            >{text}</text>
          );
        })}

        <text x={cx - 30} y={cy - r + 34} fill="white" fontSize={9} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">100</text>
        <text x={cx + 32} y={cy - r + 34} fill="white" fontSize={9} fontWeight={600}
          fontFamily="ui-sans-serif, system-ui, sans-serif" textAnchor="middle">FEET</text>

        {/* Needle: long thin pointer to value + short fat tail on the far side */}
        <g transform={`rotate(${needleAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 22} x2={cx} y2={cy - r + 18}
            stroke="#f5f0e1" strokeWidth={4} strokeLinecap="round" />
          <path d={`M ${cx} ${cy - 6} L ${cx + 42} ${cy - 16} L ${cx + 20} ${cy - 26} L ${cx} ${cy - 16} Z`}
            fill="#f5f0e1" />
        </g>
        <circle cx={cx} cy={cy} r={5} fill="#3a362f" stroke="#f5f0e1" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
