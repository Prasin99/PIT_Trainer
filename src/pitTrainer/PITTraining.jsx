import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SessionHeader } from '../flightCore/instruments/SessionHeader';
import { PITPanel } from './PITPanel';
import { useFlightLoop } from '../flightCore/useFlightLoop';
import { useInputAxes } from '../flightCore/useInputAxes';
import { createFlightState, stepFlight } from '../flightCore/flightDynamics';
import { buildFlightConfig } from '../flightCore/flightConfig';

const PANEL_WIDTH = 1180;
const PANEL_HEIGHT = 880;

// Visual-only gain: how far the artificial horizon banks for a given turn
// rate. This doesn't feed back into the physics — it just makes the AI
// read as "cause" for what the compass is doing. The AI is paired with
// the compass only: it banks with turn rate and stays level otherwise. It
// is deliberately NOT tied to climb/descent (that pairing is Altimeter +
// Variometer + Airspeed, driven straight off vSpeed with no AI pitch
// involved).
const MAX_BANK_DEG = 30;

// RPM Indicator scale (must match flightCore/instruments/TachometerDial.jsx).
// The tachometer reads the engine's throttle position directly — push the
// throttle up, RPM rises; pull it back, RPM falls — same as a real
// aircraft's tach, and the same pattern MIC/PFD used for their gauges.
const MIN_RPM = 5;
const MAX_RPM = 35;

// PIT-specific tuning: the round-dial faces read in different units/ranges
// than MIC's tapes, so a few flightCore defaults are overridden here.
const PIT_CONFIG_OVERRIDES = {
  altitude: {
    initial: 500,
    target: 500,
    gainPitch: 30,
    rateLag: 2.8,         // ft/s at full aft stick -> ~1800 ft/min, matches the variometer's 0-20 (x100 fpm) scale
    tolerance: { green: 20, yellow: 50 },
  },
  heading: {
    initial: 0,
    target: 0,
  },
  speed: {
    initial: 120,
    target: 120,
    minThrottleSpeed: 60,
    maxThrottleSpeed: 180,   // matches the Speed Indicator's 40-180 kt face
    initialThrottle: 0.5,    // mid-scale start; also the RPM Indicator's resting position
    pitchSpeedPullShift: 30, // climbing (stick back) costs ~30kt at full deflection
    pitchSpeedPushShift: 30, // diving (stick forward) gains ~30kt
    tolerance: { green: 5, yellow: 10 },
  },
};

/**
 * PIT (Panel Instrument Test) training screen.
 *
 * Pitch and roll on the joystick drive one physical plant (see
 * flightCore/flightDynamics.js), and each pair of dials reads off its own
 * side of that shared state —
 *   - stick back -> climb -> Altimeter increases, Variometer swings up,
 *     Airspeed drops (and the reverse pushing forward). The Artificial
 *     Horizon does NOT pitch for this — it has no visual tie to
 *     altitude/vertical speed/airspeed at all.
 *   - stick left/right -> turn rate -> Compass swings, and the Artificial
 *     Horizon banks in proportion to that same turn rate, so leveling the
 *     AI and stopping the compass is the same correction.
 * The AI is paired with the compass only.
 *
 * RPM Indicator: reads the throttle directly (Q/A keys, or a joystick
 * throttle slider/axis via useInputAxes) — up throttle, RPM rises across
 * its 5-35 scale; down throttle, RPM falls. It rides on the same smoothed
 * throttle value the engine uses for its speed physics, so RPM spools up
 * and down with a touch of realistic inertia rather than snapping instantly.
 */
export function PITTraining({ settings, onComplete, onExit }) {
  const { duration = 120 } = settings ?? {};

  const cfgRef = useRef(buildFlightConfig('easy', PIT_CONFIG_OVERRIDES));
  const stateRef = useRef(createFlightState(cfgRef.current));
  const { poll } = useInputAxes(cfgRef.current.speed.initialThrottle);

  // All three channels held at a fixed target with live disturbance —
  // the trainee's job is to null the deviation with the stick.
  const channelMode = { altitude: 'maintain', heading: 'maintain', speed: 'maintain' };

  const [phase, setPhase] = useState('running'); // 'running' | 'paused'
  const runningRef = useRef(true);
  useEffect(() => { runningRef.current = phase === 'running'; }, [phase]);

  const togglePause = useCallback(() => {
    setPhase((p) => (p === 'running' ? 'paused' : 'running'));
  }, []);

  const readSnap = () => {
    const s = stateRef.current;
    const gainRoll = cfgRef.current.heading.gainRoll;
    return {
      altitude: s.altitude,
      heading: s.heading,
      speed: s.speed,
      // ft/s -> ft/min -> the gauge's x100 units
      vspeed: Math.max(-20, Math.min(20, (s.vSpeed * 60) / 100)),
      // Same signal that moves the Compass, rescaled into a bank angle so
      // the AI visibly "causes" what the compass is doing. No pitch term
      // here on purpose — the AI stays level regardless of climb/descent.
      bank: Math.max(-MAX_BANK_DEG, Math.min(MAX_BANK_DEG, (s.headingRate / gainRoll) * MAX_BANK_DEG)),
      // Throttle (0-1, already smoothed by stepFlight) mapped onto the
      // tach's 5-35 scale.
      rpm: MIN_RPM + Math.max(0, Math.min(1, s.throttle)) * (MAX_RPM - MIN_RPM),
    };
  };

  const [snap, setSnap] = useState(readSnap);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const finishedRef = useRef(false);

  useFlightLoop((dt) => {
    if (finishedRef.current) return;

    const inputs = poll(dt);
    stepFlight(stateRef.current, inputs, channelMode, cfgRef.current, dt, Math.random);

    setSnap(readSnap());

    elapsedRef.current += dt;
    setElapsed(elapsedRef.current);

    if (elapsedRef.current >= duration) {
      finishedRef.current = true;
      runningRef.current = false;
      onComplete({ duration });
    }
  }, runningRef);

  // ── Responsive panel scaling, same approach as MICTraining ──
  const mainAreaRef = useRef(null);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = mainAreaRef.current;
    if (!el) return undefined;

    const updateSize = () => setPanelSize({ width: el.clientWidth, height: el.clientHeight });
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(el);
    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const panelScale = useMemo(() => {
    if (!panelSize.width || !panelSize.height) return 1;
    return Math.min(1, (panelSize.width - 20) / PANEL_WIDTH, (panelSize.height - 20) / PANEL_HEIGHT);
  }, [panelSize]);

  return (
    <div className="relative w-screen h-screen bg-[#1a1a1a] overflow-hidden flex flex-col">
      <SessionHeader
        remainingSec={Math.max(0, duration - elapsed)}
        paused={phase === 'paused'}
        onPauseToggle={togglePause}
        onExit={onExit}
      />

      <div ref={mainAreaRef} className="flex-1 relative text-white overflow-hidden flex items-center justify-center">
        <div style={{ transform: `scale(${panelScale})`, transformOrigin: 'center center' }}>
          <PITPanel
            speed={snap.speed}
            heading={snap.heading}
            altitude={snap.altitude}
            vspeed={snap.vspeed}
            bank={snap.bank}
            rpm={snap.rpm}
            elapsedSec={elapsed}
          />
        </div>
      </div>

      {phase === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-blue-600 text-white font-bold text-2xl py-4 px-8 w-2/3 text-center rounded">
            Pause
          </div>
        </div>
      )}
    </div>
  );
}
