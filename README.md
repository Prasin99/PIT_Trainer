# PFD Tracking — AET

A SkyTest-style three-channel compensatory tracking task with reusable
flight-instrument foundation. Built as the first module on top of
`flightCore/`, which is designed to be shared with future modules
(MIC, Gubsomat, PIT).

## What's in here

```
src/
  App.jsx                                # standalone shell (setup → training → summary)
  main.jsx                               # entry
  index.css                              # tailwind base
  flightCore/                            # reusable foundation — see flightCore/README.md
    flightConfig.js
    flightDynamics.js
    useInputAxes.js
    useFlightLoop.js
    toleranceTracker.js
    instruments/
      AltitudeTape.jsx
      HeadingTape.jsx
      SpeedTape.jsx
      ThrottleSlider.jsx
      SessionHeader.jsx
      AircraftSymbol.jsx
      ToleranceMessage.jsx
      CompassDial.jsx                    # round-dial template for MIC etc.
  pfdTracking/                           # this module's task-specific pieces
    PFDTrackingTraining.jsx              # the LMS-adapter component
    PFDTrackingSetup.jsx
    PFDTrackingSummary.jsx
    legs.js                              # "Next leg" briefing sequence
```

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (typically http://localhost:5173).

## Controls

| Input | Action |
|---|---|
| ↑ / ↓ | Pitch — hold ↑ to climb, ↓ to descend |
| ← / → | Roll — hold → to turn right, ← to turn left |
| Q / A | Throttle — Q increases, A decreases (held = continuous) |
| Space / Enter | Dismiss the "Next leg" briefing |

A connected joystick (Standard Gamepad mapping) is detected automatically
and takes priority over the keyboard when present:

| Axis / Button | Action |
|---|---|
| Stick X (axis 0) | Roll |
| Stick Y (axis 1) | Pitch (inverted — pull back to climb) |
| LT (button 6) | Throttle decrement |
| RT (button 7) | Throttle increment |

## How the task works

You start at altitude 8000 ft, heading 000°, speed 150 kt. Each channel is
nudged by a slow, low-frequency disturbance — your job is to keep all three
inside the green tolerance band. Each "leg" runs for 60 seconds; between
legs a briefing tells you which instruments are active and which are
inactive (their disturbance pauses and they're not scored).

When a value drifts outside the green band, the tape flashes a red border
and a red caption appears below ("Altitude out of tolerance" etc.).

After the configured duration the summary screen breaks down per-channel
performance (time-in-green / yellow / red, RMS error, overall %).

## Foundation reuse

Every module on top of `flightCore/` follows the same pattern:

1. Build a config: `buildFlightConfig('medium')`
2. Hold physics state in a ref: `createFlightState(cfg)`
3. Pull inputs: `const { axesRef, poll, setThrottle } = useInputAxes(...)`
4. Run a loop: `useFlightLoop((dt) => { ... }, runningRef)`
5. Inside the loop: `stepFlight(state, inputs, active, cfg, dt, rng)` and
   `tracker.record(channel, value, dt)`
6. Compose instruments — tapes for PFD-style, dials for MIC / Gubsomat / PIT
7. Add module-specific aux task (briefings here; listening + buttons for MIC)
8. Export `<ModuleName>Training` as a named export with `{ settings, onComplete, onExit }`

See `src/flightCore/README.md` for full architectural notes.

## LMS integration

`PFDTrackingTraining` follows the same adapter shape as the existing
multitasking and rotating-cube modules:

```jsx
<PFDTrackingTraining
  settings={{
    duration: 240,
    difficulty: 'medium',
    enableAltitude: true,
    enableHeading: true,
    enableSpeed: true,
    locale: 'en',
  }}
  onComplete={(result) => {
    // result.duration, result.completedAt
    // result.results.altitude  = { timeInGreen, timeInYellow, timeInRed, totalTime, rmsError, fractionGreen }
    // result.results.heading   = { ... }
    // result.results.speed     = { ... }
    // result.results.overall   = 0..1 (mean fractionGreen across active channels)
  }}
  onExit={() => { /* return to LMS */ }}
/>
```

## Roadmap

- **MIC**: round-dial set (CompassDial is already in place; need
  AirspeedDial, AltimeterDial, ClockDial) + listening task with red/green
  response buttons.
- **Gubsomat**: similar round-dial layout + apparatus-specific aux task.
- **PIT**: PFD-style layout (reuses tape instruments directly) tuned to
  Swiss / Austrian Airlines screening parameters.

The disturbance physics, throttle control, session header, and scoring
math are already shared, so each new module is a single composition file
plus any module-specific instruments / aux task UI.
