import React from 'react';

/**
 * Centered "you are here" chevron that the recording shows when the aircraft
 * is flying actively (between leg briefings). Pure SVG, no animation.
 */
export function AircraftSymbol({ size = 100, color = '#4b5563' }) {
  return (
    <svg
      viewBox="0 0 200 60"
      style={{ width: size * 2, height: size * 0.6, display: 'block' }}
    >
      <path
        d="M 10 50 L 100 10 L 190 50 L 170 50 L 100 22 L 30 50 Z"
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </svg>
  );
}
