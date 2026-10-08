import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SessionHeader } from '../flightCore/instruments/SessionHeader';
import { PITPanel } from './PITPanel';
import { useFlightLoop } from '../flightCore/useFlightLoop';
import { useInputAxes } from '../flightCore/useInputAxes';
import { createFlightState, stepFlight, angularDiff } from '../flightCore/flightDynamics';
import { buildFlightConfig } from '../flightCore/flightConfig';
import { START, DEFAULT_COUNT, GAP_SEC, generateLegs, buildRequiredTrack, legLines, legSpeech, stepIdeal, advancePos } from './instructions';
import { TrackView } from './TrackView';
import { speak, stopSpeech, pauseSpeech, resumeSpeech, isSpeaking, estimateSpeechSeconds } from './speech';

const PANEL_WIDTH = 1180;
const PANEL_HEIGHT = 880;

// Visual-only gain: how far the artificial horizon banks for a given turn
// rate. This doesn't feed back into the physics — it just makes the AI
// read as "cause" for what the compass is doing. The AI is paired with
// the compass only: it banks with turn rate and stays level otherwise. It
// is deliberately NOT tied to climb/descent (that pairing is Altimeter +
// Variometer + Airspeed, driven straight off vSpeed with no AI pitch
// involved).
const MAX_BANK_DEG = 40; // full turn rate = 45° bank (was 30°)

// Display-only lag (s) for the Variometer needle. The altimeter follows the
// fast physics (altitude rateLag), while the VSI needle eases toward the
// real vertical speed like a real instrument. Larger = calmer needle.
const VSI_DISPLAY_LAG = 2.0;
const BANK_RETURN_LAG = 1.0;
const BANK_INTO_LAG = 0.15;   // banking into a turn (s)
const MAX_PITCH_DEG = 7;   // nose up/down at full vertical speed (2000 ft/min)
const BANK_MAX_RATE = 35;   // max horizon rotation speed (degrees per second)

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
    initial: START.altitude,   // 3000 ft; instructions move between 2000-5000 ft
    target: START.altitude,
    gainPitch: 30,
    rateLag: 0.8,         // stick -> climb/descent response time (s); was 2.8, felt sluggish on the altimeter
    altimeterRateScale: 1.5, // altimeter moves 1.5x faster; Variometer & Airspeed unchanged (1 = off)
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
    // Speed follows the Variometer at constant RPM: descending -> faster,
    // climbing -> slower. 1 kt per ft/s -> 1800 ft/min (full stick) = 30 kt,
    // the same range the stick-only coupling above gave.
    vSpeedSpeedCoupling: 1.0,
    tolerance: { green: 5, yellow: 10 },
  },
};

// What the required track flies while the very first instruction is being
// announced in Audio mode: hold the start heading and altitude.
const HOLD_START = { type: 'heading', heading: START.heading, altitude: START.altitude, vs: 0, duration: 0 };

// How often (s) a point is added to the flown / required tracks.
const TRACK_SAMPLE_SEC = 0.25;

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
  const { instructionCount = DEFAULT_COUNT } = settings ?? {};

  // Instruction sequence (legs). The session lasts until the last one ends.
  const legsRef = useRef(null);
  if (!legsRef.current) legsRef.current = generateLegs(instructionCount);
  const legs = legsRef.current;
  // Full required chart, computed once (never shown during the test) --
  // it only fixes the map frame so the maps look like a printed chart.
  const headerLeftRef = useRef(null);   // overall timer value shown in the header
  // Expected speaking time of each instruction (for the overall timer in Audio mode).
  const speakSecs = useMemo(() => legs.map((leg, i) => {
    const words = legSpeech(leg, i > 0 ? legs[i - 1].altitude : START.altitude).trim().split(/\s+/).length;
    return words * 0.42 + 1;
  }), [legs]);
  const fullRequiredRef = useRef(null);
  if (!fullRequiredRef.current) fullRequiredRef.current = buildRequiredTrack(legs);

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

  // ── Instructions ──────────────────────────────────────────────
  // Each instruction goes through:
  //   'announce' -- Audio mode only: the instruction is being spoken. Its time
  //                 has NOT started yet; the aircraft keeps holding the
  //                 previous heading/altitude (and so does the required track).
  //   'fly'      -- the instruction's time counts down (e.g. 20 s).
  //   'gap'      -- 5 s pause holding the instruction before the next one.
  const [legIdx, setLegIdx] = useState(0);
  const legIdxRef = useRef(0);
  const legPhaseRef = useRef('fly');      // 'announce' | 'fly' | 'gap'
  const legClockRef = useRef(0);          // seconds flown in the current instruction
  const gapClockRef = useRef(0);
  const announceClockRef = useRef(0);
  const announceLimitRef = useRef(0);     // safety timeout if speech never reports "done"
  const announceDoneRef = useRef(false);
  const [timing, setTiming] = useState(() => ({
    phase: 'fly',
    secondsLeft: legs[0].duration,
    remaining: legs.reduce((sum, l, j) => sum + l.duration + (j + 1 < legs.length ? GAP_SEC : 0), 0),
  }));

  // 'text' = instruction shown on screen; 'audio' = read aloud, text hidden.
  const [instrMode, setInstrMode] = useState('text');
  const instrModeRef = useRef('text');

  const prevAltOf = (i) => (i > 0 ? legsRef.current[i - 1].altitude : START.altitude);

  // Start instruction i: in Audio mode it is spoken first, and its time only
  // starts once the voice has finished.
  const startLeg = useCallback((i) => {
    legIdxRef.current = i;
    setLegIdx(i);
    legClockRef.current = 0;
    gapClockRef.current = 0;
    if (instrModeRef.current === 'audio') {
      const text = legSpeech(legsRef.current[i], prevAltOf(i));
      legPhaseRef.current = 'announce';
      announceClockRef.current = 0;
      announceDoneRef.current = false;
      announceLimitRef.current = estimateSpeechSeconds(text);
      speak(text, () => { announceDoneRef.current = true; });
    } else {
      legPhaseRef.current = 'fly';
    }
  }, []);

  // "Repeat": the current instruction with the time that is LEFT.
  const repeatCurrent = useCallback(() => {
    const i = legIdxRef.current;
    const leg = legsRef.current[i];
    if (!leg || legPhaseRef.current === 'announce') return;
    const left = legPhaseRef.current === 'gap' ? 0 : Math.max(0, Math.ceil(leg.duration - legClockRef.current));
    speak(legSpeech(leg, prevAltOf(i), left));
  }, []);

  const setMode = useCallback((m) => {
    instrModeRef.current = m;
    setInstrMode(m);
    // Switching to Audio does not read the instruction that is already
    // running -- the NEXT instruction is spoken when it starts; "Repeat"
    // reads the current one with the time left.
    if (m === 'text') {
      stopSpeech();
      // if an instruction was being announced, start its time now
      if (legPhaseRef.current === 'announce') { legPhaseRef.current = 'fly'; legClockRef.current = 0; }
    }
  }, []);
  useEffect(() => () => stopSpeech(), []);

  // Pause (button or track view) stops the audio at once; on resume the
  // current instruction is read again in Audio mode.
  const wasPausedRef = useRef(false);
  useEffect(() => {
    if (phase === 'paused') {
      wasPausedRef.current = true;
      pauseSpeech();               // stop, but remember where the voice was
    } else if (wasPausedRef.current) {
      wasPausedRef.current = false;
      resumeSpeech();              // continue from there -- never restart
    }
  }, [phase]);

  // ── Tracks: required (ideal) vs flown, in nautical miles ─────
  const idealRef = useRef({ heading: START.heading, altitude: START.altitude, x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const requiredTrackRef = useRef([{ x: 0, y: 0, leg: 0, v: 'level' }]);
  const flownTrackRef = useRef([{ x: 0, y: 0, leg: 0, v: 'level', hdg: START.heading, alt: START.altitude }]);
  const trackTimerRef = useRef(0);

  // Track overlay: opening it pauses the test; closing resumes it.
  const [showTrack, setShowTrack] = useState(false);
  const pausedByTrackRef = useRef(false);
  const openTrack = useCallback(() => {
    setPhase((p) => { pausedByTrackRef.current = p === 'running'; return 'paused'; });
    setShowTrack(true);
  }, []);
  const closeTrack = useCallback(() => {
    setShowTrack(false);
    if (pausedByTrackRef.current) setPhase('running');
    pausedByTrackRef.current = false;
  }, []);

  // Smoothed vertical speed shown on the Variometer (display only).
  const vsiRef = useRef(0);
  const bankRef = useRef(0);
  const readSnap = () => {
    const s = stateRef.current;
    const gainRoll = cfgRef.current.heading.gainRoll;
    return {
      altitude: s.altitude,
      heading: s.heading,
      speed: s.speed,
      // ft/s -> ft/min -> the gauge's x100 units
      vspeed: Math.max(-20, Math.min(20, (vsiRef.current * 60) / 100)),
      pitch: Math.max(-MAX_PITCH_DEG, Math.min(MAX_PITCH_DEG, ((vsiRef.current * 60) / 2000) * MAX_PITCH_DEG)),
      // Same signal that moves the Compass, rescaled into a bank angle so
      // the AI visibly "causes" what the compass is doing. No pitch term
      // here on purpose — the AI stays level regardless of climb/descent.
      //bank: Math.max(-MAX_BANK_DEG, Math.min(MAX_BANK_DEG, (s.headingRate / gainRoll) * MAX_BANK_DEG)),
      bank: bankRef.current,
      // Throttle (0-1, already smoothed by stepFlight) mapped onto the
      // tach's 5-35 scale.
      rpm: MIN_RPM + Math.max(0, Math.min(1, s.throttle)) * (MAX_RPM - MIN_RPM),
    };
  };

  const [snap, setSnap] = useState(readSnap);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const finishedRef = useRef(false);
  // Per-frame deviations from target, for the result page (scoring only).
  const samplesRef = useRef([]);

  useFlightLoop((dt) => {
    if (finishedRef.current) return;

    const inputs = poll(dt);
    stepFlight(stateRef.current, inputs, channelMode, cfgRef.current, dt, Math.random);
    vsiRef.current += (stateRef.current.vSpeed - vsiRef.current) * (1 - Math.exp(-dt / VSI_DISPLAY_LAG));
    {
      const gr = cfgRef.current.heading.gainRoll;
      const target = Math.max(-MAX_BANK_DEG, Math.min(MAX_BANK_DEG, (stateRef.current.headingRate / gr) * MAX_BANK_DEG));
      const cur = bankRef.current;
      const into = (Math.sign(cur) === Math.sign(target) || cur === 0) && Math.abs(target) > Math.abs(cur);
      const lag = into ? BANK_INTO_LAG : BANK_RETURN_LAG;
      //bankRef.current = cur + (target - cur) * (1 - Math.exp(-dt / lag));
      const maxStep = BANK_MAX_RATE * dt;
      const step = Math.max(-maxStep, Math.min(maxStep, (target - cur) * (1 - Math.exp(-dt / lag))));
      bankRef.current = cur + step;
    }

    const st = stateRef.current;

    // ── Instruction timing ──
    const tNow = elapsedRef.current;
    let li = legIdxRef.current;
    let lastDone = false;
    if (legPhaseRef.current === 'announce') {
      announceClockRef.current += dt;
      // Done when the browser reports it, when it has visibly stopped talking
      // (checked directly -- Chrome sometimes drops its "finished" event),
      // or at the latest after the estimated speaking time.
      const stoppedTalking = announceClockRef.current > 1.0 && !isSpeaking();
      if (announceDoneRef.current || stoppedTalking || announceClockRef.current >= announceLimitRef.current) {
        legPhaseRef.current = 'fly';           // voice finished -> time starts now
        legClockRef.current = 0;
      }
    } else if (legPhaseRef.current === 'fly') {
      legClockRef.current += dt;
      if (legClockRef.current >= legs[li].duration) {
        if (li + 1 >= legs.length) lastDone = true;
        else { legPhaseRef.current = 'gap'; gapClockRef.current = 0; }
      }
    } else {
      gapClockRef.current += dt;
      if (gapClockRef.current >= GAP_SEC) { startLeg(li + 1); li = legIdxRef.current; }
    }

    // Required profile: while an instruction is being announced the ideal
    // aircraft keeps flying the previous one (or the start values).
    const announcing = legPhaseRef.current === 'announce';
    const idealLegIdx = announcing ? Math.max(0, li - 1) : li;
    const idealLeg = announcing && li === 0 ? HOLD_START : legs[idealLegIdx];
    const ideal = idealRef.current;
    stepIdeal(ideal, idealLeg, dt);
    advancePos(posRef.current, st.heading, st.speed, dt);
    trackTimerRef.current += dt;
    if (trackTimerRef.current >= TRACK_SAMPLE_SEC) {
      trackTimerRef.current = 0;
      requiredTrackRef.current.push({ x: ideal.x, y: ideal.y, leg: idealLegIdx, v: ideal.vmode });
      const fpm = st.vSpeed * 60;
      flownTrackRef.current.push({
        x: posRef.current.x, y: posRef.current.y, leg: idealLegIdx,
        v: fpm > 150 ? 'climb' : fpm < -150 ? 'descent' : 'level',
        hdg: st.heading, alt: st.altitude,
      });
    }

    // Scoring: deviation from the REQUIRED profile (heading / altitude
    // follow the instructions; airspeed is held at 120 kt).
    samplesRef.current.push({
      t: tNow,
      leg: idealLegIdx,
      altitudeDev: Math.abs(st.altitude - ideal.altitude),
      headingDev: Math.abs(angularDiff(st.heading, ideal.heading)),
      speedDev: Math.abs(st.speed - st.currentTargetSpeed),
    });

    setSnap(readSnap());

    elapsedRef.current += dt;
    setElapsed(elapsedRef.current);

    // countdowns for the screen
    {
      const ph = legPhaseRef.current;
      const leg = legs[legIdxRef.current];
      const cur = ph === 'announce' ? leg.duration
        : ph === 'fly' ? Math.max(0, leg.duration - legClockRef.current) : 0;
      let rest = cur + (ph === 'gap' ? Math.max(0, GAP_SEC - gapClockRef.current) : (legIdxRef.current + 1 < legs.length ? GAP_SEC : 0));
      for (let j = legIdxRef.current + 1; j < legs.length; j++) rest += legs[j].duration + (j + 1 < legs.length ? GAP_SEC : 0);
      // Overall test timer (header): keeps running while an instruction is
      // being spoken -- in Audio mode it also counts the expected speaking
      // time of the current and the remaining instructions.
      if (instrModeRef.current === 'audio') {
        if (ph === 'announce') rest += Math.max(0, speakSecs[legIdxRef.current] - announceClockRef.current);
        for (let j = legIdxRef.current + 1; j < legs.length; j++) rest += speakSecs[j];
      }
      // Tick down smoothly: small differences between the expected and the
      // real speaking time are absorbed gradually instead of jumping.
      const shown = headerLeftRef.current;
      if (shown == null || Math.abs(rest - shown) > 20) {
        headerLeftRef.current = rest;              // first frame / mode switch
      } else {
        const next = shown - dt;
        headerLeftRef.current = Math.max(0, next + Math.max(-0.5 * dt, Math.min(0.5 * dt, rest - next)));
      }
      setTiming({ phase: ph, secondsLeft: Math.ceil(cur), remaining: headerLeftRef.current });
    }

    if (lastDone) {
      const duration = elapsedRef.current;
      finishedRef.current = true;
      runningRef.current = false;
      const c = cfgRef.current;
      onComplete({
        duration,
        samples: samplesRef.current,
        tolerance: { altitude: c.altitude.tolerance, heading: c.heading.tolerance, speed: c.speed.tolerance },
        targets: { altitude: c.altitude.target, heading: c.heading.target, speed: c.speed.target },
        legs,
        requiredTrack: requiredTrackRef.current,
        flownTrack: flownTrackRef.current,
      });
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
        remainingSec={Math.max(0, timing.remaining)}
        paused={phase === 'paused'}
        onPauseToggle={togglePause}
        onExit={onExit}
      />

      <InstructionBar
        leg={legs[legIdx]}
        index={legIdx}
        total={legs.length}
        secondsLeft={timing.secondsLeft}
        legPhase={timing.phase}
        mode={instrMode}
        onMode={setMode}
        onRepeat={() => { if (runningRef.current) repeatCurrent(); }}
        onViewTrack={openTrack}
      />

      <div ref={mainAreaRef} className="flex-1 relative text-white overflow-hidden flex items-center justify-center">
        <div style={{ transform: `scale(${panelScale})`, transformOrigin: 'center center' }}>
          <PITPanel
            speed={snap.speed}
            heading={snap.heading}
            altitude={snap.altitude}
            vspeed={snap.vspeed}
            bank={snap.bank}
            pitch={snap.pitch}
            rpm={snap.rpm}
            elapsedSec={elapsed}
          />
        </div>
      </div>

      {showTrack && (
        <div className="absolute inset-0 z-30 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl max-w-full">
            <div className="flex items-center justify-between mb-3 gap-4">
              <div className="text-white font-semibold">Track so far — required vs. yours <span className="text-slate-400 font-normal text-sm">(test paused)</span></div>
              <button onClick={closeTrack} className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">
                Close &amp; resume
              </button>
            </div>
            <TrackView
              required={requiredTrackRef.current}
              flown={flownTrackRef.current}
              legs={legs}
              frame={fullRequiredRef.current}
              width={Math.max(260, Math.min(560, ((panelSize.width || 900) - 90) / 2))}
              height={Math.max(260, Math.min(520, (panelSize.height || 600) - 90))}
            />
          </div>
        </div>
      )}

      {phase === 'paused' && !showTrack && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="bg-blue-600 text-white font-bold text-2xl py-4 px-8 w-2/3 text-center rounded">
            Pause
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Instruction strip under the header: the current instruction as text
 * (or "audio" mode: read aloud, text hidden), a Text/Audio toggle, and a
 * button to open the track view.
 */
function InstructionBar({ leg, index, total, secondsLeft, legPhase, mode, onMode, onRepeat, onViewTrack }) {
  // After the instruction's time is over there is a 5 s pause: hold heading/altitude.
  const holding = legPhase === 'gap';
  if (!leg) return null;
  const btn = (active) =>
    `px-3 py-1.5 text-sm font-semibold transition ${active ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-white border-b border-slate-300">
      <div className="flex items-center gap-4 min-w-0">
        <div className="text-xs text-slate-500 leading-tight">
          <div className="font-semibold uppercase tracking-wide">Instruction</div>
          <div>{index + 1} / {total}</div>
        </div>
        {mode === 'text' ? (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-slate-900">
            {legLines(leg).map(({ label, value }) => (
              <div key={label} className="whitespace-nowrap">
                <span className="text-sm font-semibold text-slate-500 mr-2">{label}</span>
                <span className="text-xl font-bold">{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-700">
            <span className="text-xl" aria-hidden>🔊</span>
            <span className="font-semibold">Audio instruction</span>
            <button onClick={onRepeat} className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100">
              Repeat
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* During the 5 s pause after an instruction's time, no countdown is shown. */}
        {!holding && (
          <div className="font-mono text-sm px-3 py-1 rounded bg-slate-100 text-slate-800 whitespace-nowrap">
            Time left {secondsLeft}s
          </div>
        )}
        <div className="flex rounded border border-slate-300 overflow-hidden" role="group" aria-label="Instruction mode">
          <button className={btn(mode === 'text')} onClick={() => onMode('text')}>Text</button>
          <button className={btn(mode === 'audio')} onClick={() => onMode('audio')}>Audio</button>
        </div>
        <button onClick={onViewTrack} className="px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-100">
          View track
        </button>
      </div>
    </div>
  );
}
