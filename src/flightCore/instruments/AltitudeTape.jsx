import React, { useMemo, useRef } from 'react';

/**
 * SkyTest-style gradient: green at target → yellow at the green-tolerance
 * boundary → orange at the yellow-tolerance boundary → red at the band
 * edge (yellow * 1.2). Returns null past the edge so the band cleanly
 * stops. Piecewise so the green-tolerance zone still reads "mostly
 * green" rather than slipping into yellow halfway through.
 */
function toleranceColor(d, greenTol, yellowTol) {
  const redEdge = yellowTol * 1.2;
  if (d > redEdge) return null;
  let h;
  if (d <= greenTol) {
    h = 120 - 40 * (d / greenTol);                              // 120 → 80
  } else if (d <= yellowTol) {
    h = 80  - 40 * ((d - greenTol)  / (yellowTol - greenTol));  // 80  → 40
  } else {
    h = 40  - 40 * ((d - yellowTol) / (redEdge - yellowTol));   // 40  → 0
  }
  return `hsl(${Math.max(0, h)}, 80%, 45%)`;
}

/**
 * Vertical altitude tape.
 *
 *   followCurrent === false (default; easy/medium/hard)
 *     Static scale anchored to first target; yellow/green block tolerance
 *     column; blue pin moves with altitude.
 *
 *   followCurrent === true  (expert)
 *     SkyTest model: scrolling scale anchored to current altitude;
 *     tolerance is rendered by COLOURING each minor tick within
 *     ±yellow*1.2 of the target via `toleranceColor()`; blue pin pinned
 *     at screen-centre.
 */
export function AltitudeTape({
  value,
  target,
  tolerance,
  tapeSpan = 200,
  majorStep = 100,
  minorStep = 10,
  width = 100,
  height = 360,
  label = 'ALTITUDE',
  inactive = false,
  outOfTolerance = false,
  pinLevel = 'green',
  followCurrent = false,
}) {
  const scale = height / (2 * tapeSpan);

  const staticAnchorRef = useRef(target);

  const center = inactive ? target : value;
  const dynamicAnchor = Math.floor(center / minorStep) * minorStep;

  const tickAnchor = followCurrent ? dynamicAnchor : staticAnchorRef.current;
  const posCenter  = followCurrent ? center        : staticAnchorRef.current;

  // Pin / off-screen indicators keep using the live posCenter.
  const yAt = (V) => height / 2 + (posCenter - V) * scale;

  // Everything inside the scroll container is positioned against the
  // quantised tickAnchor — those positions are stable integers. The
  // container is then translated by (posCenter - tickAnchor) * scale via
  // translate3d, so smooth sub-pixel motion is handled by the GPU
  // compositor and individual ticks stay locked on integer pixels.
  const yAtFixed       = (V) => height / 2 + (tickAnchor - V) * scale;
  const tickTranslateY = (posCenter - tickAnchor) * scale;
  const targetYFixed   = yAtFixed(target);

  const tickValues = useMemo(() => {
    const out = [];
    const min = tickAnchor - tapeSpan;
    const max = tickAnchor + tapeSpan;
    for (let v = Math.ceil(min / minorStep) * minorStep; v <= max; v += minorStep) {
      const isMajor = Math.abs(v % majorStep) < 1e-6;
      out.push({ v, isMajor });
    }
    return out;
  }, [tickAnchor, tapeSpan, minorStep, majorStep]);

  // Static-mode tolerance band positions.
  const greenTop  = yAt(target + tolerance.green);
  const greenBot  = yAt(target - tolerance.green);
  const yellowTop = yAt(target + tolerance.yellow);
  const yellowBot = yAt(target - tolerance.yellow);

  const valueY = followCurrent || inactive ? height / 2 : yAt(value);

  const valueAbove  = !inactive && value  > posCenter + tapeSpan;
  const valueBelow  = !inactive && value  < posCenter - tapeSpan;
  const targetAbove = !inactive && target > posCenter + tapeSpan;
  const targetBelow = !inactive && target < posCenter - tapeSpan;
  const valueOff    = valueAbove  || valueBelow;
  const targetOff   = targetAbove || targetBelow;

  const pinColor =
      pinLevel === 'red'    ? '#ef4444'
    : pinLevel === 'yellow' ? '#eab308'
    :                         '#2563eb';

  return (
    <div className="relative select-none" style={{ width, height: height + 40 }}>
      <div
        className="text-blue-700 font-semibold text-center text-sm"
        style={{ height: 20 }}
      >
        {label}
      </div>

      <div
        className="relative bg-white border border-gray-300 overflow-hidden"
        style={{ width, height, opacity: inactive ? 0.45 : 1 }}
      >
        {/* STATIC-MODE block tolerance column — hidden when followCurrent */}
        {!followCurrent && (
          <>
            <div style={{
              position: 'absolute', left: 30, width: 6,
              top: yellowTop, height: yellowBot - yellowTop,
              background: '#fde68a',
            }} />
            <div style={{
              position: 'absolute', left: 30, width: 6,
              top: greenTop, height: greenBot - greenTop,
              background: '#86efac',
            }} />
            <div style={{
              position: 'absolute', left: 30, width: 6,
              top: yellowTop - 6, height: 6, background: '#ef4444',
            }} />
            <div style={{
              position: 'absolute', left: 30, width: 6,
              top: yellowBot, height: 6, background: '#ef4444',
            }} />
          </>
        )}

        {/* SCROLL CONTAINER — ticks, green ring, green ▶ arrow all live
            in here. translate3d slides the whole group smoothly on the
            GPU while each child stays on integer pixels. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          transform: `translate3d(0, ${tickTranslateY}px, 0)`,
          willChange: 'transform',
        }}>
          {tickValues.map(({ v, isMajor }, i) => {
            const y = Math.round(yAtFixed(v));
            const tolDist = followCurrent && !inactive ? Math.abs(v - target) : Infinity;
            const color = toleranceColor(tolDist, tolerance.green, tolerance.yellow);
            const isColored = color !== null;

            // Adaptive colored-tick thickness so dense scales (small px/step)
            // keep a visible gap between adjacent colored marks. ≥7 px/step
            // → 3, ≥4 → 2, else 1.
            const minorPx  = minorStep * scale;
            const colThick = minorPx >= 7 ? 3 : minorPx >= 4 ? 2 : 1;

            return (
              <React.Fragment key={i}>
                <div style={{
                  position: 'absolute',
                  // Colored marks match the underlying tick's natural length
                  // (minor stays minor-length, major stays major-length).
                  left:   isMajor ? 44              : 52,
                  width:  isMajor ? width - 50      : width - 60,
                  top:    y - (isColored ? Math.floor(colThick / 2) : 0),
                  height: isColored ? colThick : 1,
                  background: isColored ? color : '#374151',
                  zIndex: isColored ? 1 : 0,
                }} />
                {isMajor && (
                  <div style={{
                    position: 'absolute',
                    left: 0, top: y - 7,
                    width: 28,
                    fontSize: 11,
                    fontFamily: 'ui-monospace, monospace',
                    color: '#111827', textAlign: 'right',
                    zIndex: 2,
                  }}>
                    {v}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Green target ring — inside transform so it scrolls with scale */}
          {!targetOff && (
            <div style={{
              position: 'absolute',
              left: width - 30,
              top:  Math.round(targetYFixed) - 9,
              width: 18, height: 18,
              border: '2.5px solid #16a34a',
              borderRadius: '50%',
              zIndex: 3,
            }} />
          )}

          {/* Green ▶ arrow on the LEFT edge — also inside transform */}
          {!targetOff && (
            <div style={{
              position: 'absolute',
              top: Math.round(targetYFixed) - 7, left: 0,
              color: '#16a34a', fontSize: 14, zIndex: 3,
              lineHeight: '14px', fontWeight: 700,
            }}>
              ▶
            </div>
          )}
        </div>

        {/* BLUE current-value pin — OUTSIDE transform, stays at centre */}
        {!valueOff && (
          <div style={{
            position: 'absolute',
            top: valueY - 3, left: width - 32,
            width: 28, height: 6,
            background: pinColor,
            zIndex: 4,
          }} />
        )}

        {/* Off-screen TARGET indicator */}
        {targetOff && (
          <div
            style={{
              position: 'absolute',
              left: width - 36,
              ...(targetAbove ? { top: 2 } : { bottom: 2 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: '#16a34a',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 3,
              textAlign: 'center',
              minWidth: 32,
            }}
          >
            {targetAbove ? '▲' : '▼'} {Math.round(target)}
          </div>
        )}

        {/* Off-screen VALUE indicator (static mode only) */}
        {valueOff && (
          <div
            style={{
              position: 'absolute',
              left: 4,
              ...(valueAbove ? { top: 2 } : { bottom: 2 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: pinColor,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 4,
              textAlign: 'center',
              minWidth: 32,
            }}
          >
            {valueAbove ? '▲' : '▼'} {Math.round(value)}
          </div>
        )}

        {outOfTolerance && !inactive && (
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 0 2px #ef4444',
          }} />
        )}
      </div>

      <div
        className="absolute text-center text-xs font-mono text-green-300 bg-gray-800 border border-gray-700"
        style={{ left: '50%', transform: 'translateX(-50%)', bottom: 0, padding: '1px 8px', minWidth: 50 }}
      >
        {Math.round(target)}
      </div>
    </div>
  );
}