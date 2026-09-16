import React, { useMemo } from 'react';

/**
 * Classic artificial horizon / attitude indicator, styled after the
 * gyroscopic AI used on the PIT (Panel Instrument Test) reference panel.
 *
 * Props:
 *   pitch   — degrees, positive = nose up (default 0, level)
 *   bank    — degrees, positive = right wing down (default 0, wings level)
 *   size    — outer diameter in px
 *   inactive
 */
export function AttitudeIndicator({ pitch = 0, bank = 0, size = 260, inactive = false }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  const pxPerDeg = r / 45; // ±45° of pitch fills roughly the visible face

  const clipId = useMemo(() => `ai-clip-${Math.random().toString(36).slice(2)}`, []);

  // Pitch bars: [offsetDeg, labeled, halfWidthFrac]
  const bars = [
    { deg: 60, labeled: false, w: 0.30 },
    { deg: 30, labeled: false, w: 0.30 },
    { deg: 10, labeled: true, w: 0.46 },
    { deg: -10, labeled: true, w: 0.46 },
    { deg: -30, labeled: false, w: 0.30 },
    { deg: -60, labeled: false, w: 0.62 },
  ];

  const bankTicks = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];

  return (
    <div className="relative" style={{ width: size, height: size, opacity: inactive ? 0.45 : 1 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={r - 2} />
          </clipPath>
          <pattern id={`${clipId}-grid`} width="14" height="14" patternUnits="userSpaceOnUse">
            <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Bezel */}
        <circle cx={cx} cy={cy} r={r} fill="#0d0d0d" stroke="#000" strokeWidth={2} />

        {/* Rotating/translating sphere (bank rotates around center; pitch translates along the rotated axis).
            Bank convention: positive = right wing down = turning right. The
            horizon (fixed to the world) then appears to rotate the opposite
            way relative to the case, so we rotate by -bank. */}
        <g clipPath={`url(#${clipId})`}>
          <g transform={`rotate(${-bank} ${cx} ${cy}) translate(0 ${pitch * pxPerDeg})`}>
            {/* Sky + ground, oversized so rotation never reveals a corner */}
            <rect x={cx - size} y={cy - size * 1.6} width={size * 2} height={size * 1.6} fill="#0f6fd6" />
            <rect x={cx - size} y={cy} width={size * 2} height={size * 1.6} fill="#a8672f" />
            <rect x={cx - size} y={cy - size * 1.6} width={size * 2} height={size * 3.2} fill={`url(#${clipId}-grid)`} />

            {/* Horizon line */}
            <rect x={cx - size} y={cy - 1.5} width={size * 2} height={3} fill="#f5f0e1" />
            <rect x={cx - size * 0.31} y={cy - 3} width={size * 0.62} height={6} fill="#e8c34a" />
            {/* Aircraft-nose chevron on the horizon */}
            <path
              d={`M ${cx - 12} ${cy - 3} L ${cx} ${cy + 7} L ${cx + 12} ${cy - 3} L ${cx + 7} ${cy - 3} L ${cx} ${cy + 1} L ${cx - 7} ${cy - 3} Z`}
              fill="#e2571f"
            />

            {/* Pitch reference bars */}
            {bars.map(({ deg, labeled, w }) => {
              const y = cy - deg * pxPerDeg;
              const half = (size * w) / 2;
              return (
                <g key={deg}>
                  <line x1={cx - half} y1={y} x2={cx + half} y2={y} stroke="#f5f0e1" strokeWidth={labeled ? 2.5 : 2} />
                  {labeled && (
                    <>
                      <text x={cx - half - 14} y={y} fill="#f5f0e1" fontSize={12} fontWeight={700}
                        textAnchor="middle" dominantBaseline="middle"
                        fontFamily="ui-sans-serif, system-ui, sans-serif">10</text>
                      <text x={cx + half + 14} y={y} fill="#f5f0e1" fontSize={12} fontWeight={700}
                        textAnchor="middle" dominantBaseline="middle"
                        fontFamily="ui-sans-serif, system-ui, sans-serif">10</text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </g>

        {/* Fixed bank-angle scale (does not rotate) */}
        {bankTicks.map((deg) => {
          const a = (deg - 90) * Math.PI / 180;
          const big = deg === 0 || Math.abs(deg) === 30 || Math.abs(deg) === 60;
          const r1 = r - (big ? 20 : 14);
          const r2 = r - 5;
          return (
            <line key={deg}
              x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
              x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
              stroke="#f5f0e1" strokeWidth={big ? 2.5 : 1.5}
            />
          );
        })}

        {/* Fixed center index (roll pointer) */}
        <path d={`M ${cx - 8} ${cy - r + 8} L ${cx + 8} ${cy - r + 8} L ${cx} ${cy - r + 22} Z`}
          fill="none" stroke="#f5f0e1" strokeWidth={2} strokeLinejoin="round" />
        <path d={`M ${cx - 4} ${cy - r + 12} L ${cx + 4} ${cy - r + 12} L ${cx} ${cy - r + 19} Z`}
          fill="#e8c34a" />
        <line x1={cx - 18} y1={cy - r + 24} x2={cx + 18} y2={cy - r + 24} stroke="#f5f0e1" strokeWidth={1.5} />

        {/* Outer ring to hide clip edge artifacts */}
        <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#000" strokeWidth={2} />
      </svg>
    </div>
  );
}
