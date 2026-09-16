import React, { useMemo, useRef } from 'react';
import { angularDiff } from '../flightDynamics.js';

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
 * Horizontal heading tape.
 *
 *   followCurrent === false (default; easy/medium/hard)
 *     Static scale anchored to first target; yellow/green block tolerance
 *     bands; blue pin moves with current heading.
 *
 *   followCurrent === true  (expert)
 *     SkyTest model: scrolling scale anchored to current heading; the
 *     tolerance band is rendered by COLOURING each minor tick within
 *     ±yellow*1.2 of the target via `toleranceColor()`; blue pin is
 *     pinned at screen-centre.
 */
export function HeadingTape({
  value,
  target,
  tolerance,
  tapeSpan = 35,
  majorStep = 5,
  minorStep = 1,
  width = 720,
  height = 80,
  label = 'HEADING',
  inactive = false,
  outOfTolerance = false,
  pinLevel = 'green',
  followCurrent = false,
}) {
  const scale = width / (2 * tapeSpan);

  // Static-mode anchor (captured once from the first target).
  const staticAnchorRef = useRef(target);

  // Scroll-mode anchor: follows current value, quantized to minorStep
  // so the tick list only re-renders at degree crossings.
  const center = inactive ? target : value;
  const dynamicAnchor = Math.floor(center / minorStep) * minorStep;

  const tickAnchor = followCurrent ? dynamicAnchor : staticAnchorRef.current;
  const posCenter  = followCurrent ? center        : staticAnchorRef.current;

  const xAt = (absHdg) => width / 2 + angularDiff(absHdg, posCenter) * scale;

  // Fixed-anchor positioning for elements INSIDE the scroll container.
  // Each tick already carries its signed delta `d` from tickAnchor (built
  // in the useMemo below), so xAtFixed(d) is a stable integer-pixel x.
  // The container is then translated by (tickAnchor - posCenter) * scale
  // via translate3d so motion is handled by the GPU compositor.
  const xAtFixed       = (d) => width / 2 + d * scale;
  const tickTranslateX = (tickAnchor - posCenter) * scale;
  const targetD        = angularDiff(target, tickAnchor);

  const valueDelta  = inactive ? 0 : angularDiff(value,  posCenter);
  const targetDelta = inactive ? 0 : angularDiff(target, posCenter);

  const valueX  = followCurrent ? width / 2 : xAt(value);
  const targetX = xAt(target);

  const ticks = useMemo(() => {
    const out = [];
    const min = -tapeSpan;
    const max =  tapeSpan;
    const first = Math.ceil(min / minorStep) * minorStep;
    for (let d = first; d <= max; d += minorStep) {
      // const absHdg = ((tickAnchor + d) % 360 + 360) % 360;
      // const isMajor = Math.abs(absHdg % majorStep) < 1e-6
      //              || Math.abs((absHdg % majorStep) - majorStep) < 1e-6;
      // out.push({ labelText: absHdg, absHdg, d, isMajor });
      // AFTER:
const rawHdg = tickAnchor + d;
const absHdg = ((rawHdg % 360) + 360) % 360;
const raw360 = ((Math.round(rawHdg) % 360) + 360) % 360;
//const labelText = raw360;  // 0–359; we skip 355 in render
const labelText = raw360 === 355 ? 0 : raw360;

const isMajor = Math.abs(raw360 % majorStep) < 1e-6
       || Math.abs((raw360 % majorStep) - majorStep) < 1e-6;
out.push({ labelText, absHdg, d, isMajor });
    }
    return out;
  }, [tickAnchor, tapeSpan, minorStep, majorStep]);

  // Static-mode tolerance band positions (unused when followCurrent).
  const greenLeft   = targetX - tolerance.green  * scale;
  const greenRight  = targetX + tolerance.green  * scale;
  const yellowLeft  = targetX - tolerance.yellow * scale;
  const yellowRight = targetX + tolerance.yellow * scale;

  const valueRight  = !inactive && valueDelta  >  tapeSpan;
  const valueLeft   = !inactive && valueDelta  < -tapeSpan;
  const targetRight = !inactive && targetDelta >  tapeSpan;
  const targetLeft  = !inactive && targetDelta < -tapeSpan;
  const valueOff    = valueLeft  || valueRight;
  const targetOff   = targetLeft || targetRight;

  const pinColor =
      pinLevel === 'red'    ? '#ef4444'
    : pinLevel === 'yellow' ? '#eab308'
    :                         '#2563eb';

  return (
    <div className="relative select-none" style={{ width, height: height + 40 }}>
      <div className="text-blue-700 font-semibold text-center text-sm" style={{ height: 20 }}>
        {label}
      </div>

      <div
        className="relative bg-white border border-gray-300 overflow-hidden"
        style={{ width, height, opacity: inactive ? 0.45 : 1 }}
      >
        {/* Right-side target value chip */}
        <div
          className="absolute text-xs font-mono text-green-300 bg-gray-800 border border-gray-700 z-20"
          style={{ right: 4, top: 4, padding: '1px 6px' }}
        >
          {String(Math.round(target)).padStart(3, '0')}
        </div>

        {/* STATIC-MODE block tolerance bands — hidden when followCurrent */}
        {!followCurrent && (
          <>
            <div style={{
              position: 'absolute', top: 6, height: 6,
              left: yellowLeft, width: yellowRight - yellowLeft, background: '#fde68a',
            }} />
            <div style={{
              position: 'absolute', top: 6, height: 6,
              left: greenLeft, width: greenRight - greenLeft, background: '#86efac',
            }} />
            <div style={{
              position: 'absolute', top: 6, height: 6,
              left: yellowLeft - 6, width: 6, background: '#ef4444',
            }} />
            <div style={{
              position: 'absolute', top: 6, height: 6,
              left: yellowRight, width: 6, background: '#ef4444',
            }} />
          </>
        )}

        {/* SCROLL CONTAINER — ticks and the on-tape target ring live here.
            translate3d slides the whole group smoothly on the GPU while
            each child stays on integer pixels. */}
        <div style={{
          position: 'absolute',
          inset: 0,
          transform: `translate3d(${tickTranslateX}px, 0, 0)`,
          willChange: 'transform',
        }}>
          {ticks.map(({ labelText, absHdg, d, isMajor }, i) => {
            const x = Math.round(xAtFixed(d));
            const tolDist = followCurrent && !inactive
              ? Math.abs(angularDiff(absHdg, target))
              : Infinity;
            const color = toleranceColor(tolDist, tolerance.green, tolerance.yellow);
            const isColored = color !== null;

            return (
              <React.Fragment key={i}>
                <div style={{
                  position: 'absolute',
                  top:    isMajor ? 16          : 22,
                  height: isMajor ? height - 32 : height - 44,
                  left:   x - (isColored ? 1 : 0),
                  width:  isColored ? 3 : 1,
                  background: isColored ? color : '#374151',
                  zIndex: isColored ? 1 : 0,
                }} />
{isMajor && (
                  <div style={{
                    position: 'absolute',
                    bottom: 4, left: x - 14, width: 28,
                    fontSize: 11,
                    fontFamily: 'ui-monospace, monospace',
                    color: '#111827', textAlign: 'center',
                    zIndex: 2,
                  }}>
                    {labelText}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* Green target ring — inside transform so it scrolls with scale */}
          {!targetOff && (
            <div style={{
              position: 'absolute',
              top: 2,
              left: Math.round(xAtFixed(targetD)) - 9,
              width: 18, height: 18,
              border: '2.5px solid #16a34a',
              borderRadius: '50%',
              zIndex: 3,
            }} />
          )}
        </div>

        {/* BLUE current-value pin — outside transform, stays at centre */}
        {!valueOff && (
          <div style={{
            position: 'absolute',
            left: valueX - 2, top: 14, bottom: 14, width: 4,
            background: pinColor, zIndex: 4,
          }} />
        )}

        {/* Off-screen TARGET indicator */}
        {targetOff && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              ...(targetRight ? { right: 4 } : { left: 4 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: '#16a34a',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 3,
              textAlign: 'center',
              minWidth: 36,
            }}
          >
            {targetRight ? '▶' : '◀'} {String(Math.round(target)).padStart(3, '0')}
          </div>
        )}

        {/* Off-screen VALUE indicator (static mode only) */}
        {valueOff && (
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              ...(valueRight ? { right: 4 } : { left: 4 }),
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              color: pinColor,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.85)',
              padding: '1px 4px',
              borderRadius: 3,
              zIndex: 4,
              textAlign: 'center',
              minWidth: 36,
            }}
          >
            {valueRight ? '▶' : '◀'} {String(Math.round(value)).padStart(3, '0')}
          </div>
        )}

        {outOfTolerance && !inactive && (
          <div className="absolute inset-0 pointer-events-none" style={{
            boxShadow: 'inset 0 0 0 2px #ef4444',
          }} />
        )}
      </div>

      {/* Green ▲ arrow under the tape — kept as a single dynamic-position
          element (uses live targetX). It's only one node moving, so no
          transform optimisation is needed; this keeps it positioned
          relative to the outer wrapper rather than the inner overflow
          container, which is what the original layout assumed. */}
      {!targetOff && (
        <div
          className="absolute"
          style={{
            left: targetX - 6,
            bottom: 18,
            color: '#16a34a',
            fontSize: 14,
            zIndex: 2,
            lineHeight: '14px',
            fontWeight: 700,
          }}
        >
          ▲
        </div>
      )}
    </div>
  );
}