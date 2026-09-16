import React from 'react';

/**
 * Vertical throttle slider with +/- buttons. Click to nudge, hold for
 * continuous change. The slider is a thin shell around the underlying
 * throttle ref — actual input is owned by useInputAxes, this is just UI.
 *
 * Props:
 *   value             — 0..1 (read from axesRef.current.throttle)
 *   onSet(v)          — called with new value when user nudges
 *   inactive          — greys it out
 */
export function ThrottleSlider({ value, onSet, inactive = false, height = 320, width = 56 }) {
  const filled = Math.max(0, Math.min(1, value)) * (height - 80);

  const nudge = (delta) => {
    if (inactive) return;
    onSet(Math.max(0, Math.min(1, value + delta)));
  };

  // Hold-to-repeat
       const holdRef = React.useRef(null);
  const startHold = (delta) => {
    nudge(delta);
    holdRef.current = setInterval(() => nudge(delta), 80);
  };
  const endHold = () => {
    if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; }
  };
  React.useEffect(() => endHold, []);

  return (
    <div
      className="flex flex-col items-center select-none"
      style={{ width, height, opacity: inactive ? 0.45 : 1 }}
    >
      <button
        className="w-full bg-gray-200 hover:bg-gray-300 border border-gray-400 rounded-t flex items-center justify-center font-bold text-lg"
        style={{ height: 36 }}
        onMouseDown={() => startHold(+0.05)}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={(e) => { e.preventDefault(); startHold(+0.05); }}
        onTouchEnd={endHold}
        disabled={inactive}
      >
        +
      </button>

      <div
        className="relative w-full bg-gray-300 border-x border-gray-400"
        style={{ height: height - 80 }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: filled,
            background: '#2563eb',
            transition: 'height 80ms linear',
          }}
        />
      </div>

      <button
        className="w-full bg-gray-200 hover:bg-gray-300 border border-gray-400 rounded-b flex items-center justify-center font-bold text-lg"
        style={{ height: 36 }}
        onMouseDown={() => startHold(-0.05)}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={(e) => { e.preventDefault(); startHold(-0.05); }}
        onTouchEnd={endHold}
        disabled={inactive}
      >
        −
      </button>
    </div>
  );
}
