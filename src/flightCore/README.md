# flightCore

Reusable foundation for SkyTest-style flight aptitude modules
(PFD tracking, MIC, Gubsomat, PIT). Each module composes these
pieces and adds its own auxiliary task on top.

## What lives here

| File | Responsibility |
|---|---|
| `flightConfig.js` | Tuning constants + difficulty presets |
| `flightDynamics.js` | Plant model: stick → rate → integrated state, with OU disturbance |
| `useInputAxes.js` | Joystick (Standard Gamepad) + keyboard fallback |
| `useFlightLoop.js` | RAF loop with bounded `dt` |
| `toleranceTracker.js` | Per-channel scoring (time-in-band + RMS) |
| `instruments/AltitudeTape.jsx` | Vertical altitude tape (PFD style) |
| `instruments/SpeedTape.jsx` | Vertical airspeed tape |
| `instruments/HeadingTape.jsx` | Horizontal heading tape |
| `instruments/CompassDial.jsx` | Round compass dial (template for MIC/Gubsomat/PIT) |
| `instruments/ThrottleSlider.jsx` | Vertical throttle slider with +/- buttons |
| `instruments/SessionHeader.jsx` | Top bar: timer + Pause + Exit |
| `instruments/AircraftSymbol.jsx` | Center chevron |
| `instruments/ToleranceMessage.jsx` | Red "outside tolerance" caption |

## Physics model

Three independent channels — altitude, heading, speed — each with the same
shape:

```
input  →  rate command  →  first-order lag  →  integrated state
                ↑
        disturbance (OU)
```

Disturbance is what makes it a tracking task — without it, the aircraft sits
at trim. Each channel can be turned off (disturbance frozen) per leg, which
matches the recording where some legs say e.g. "Airspeed indicator: inactive".

Tuning lives in `flightConfig.js`. Difficulty changes only the disturbance
amplitude — control gains and lags stay constant so the aircraft "feels" the
same across difficulty levels.

## Input model

`useInputAxes()` returns `{ axesRef, poll, setThrottle }`. Call `poll(dt)` from
inside the flight loop to refresh `axesRef.current` with the latest pitch/
roll/throttle values. Gamepad is preferred when one is connected; otherwise
keyboard:

| Key | Axis |
|---|---|
| ArrowUp / ArrowDown | pitch (Up = climb) |
| ArrowLeft / ArrowRight | roll (Right = turn right) |
| Q / A | throttle up / down |

## Adding a new module

1. Create `src/<module>/` with the standard three files: `Setup.jsx`,
   `Training.jsx`, `Summary.jsx`.
2. In `Training.jsx`:
   - Build a config with `buildFlightConfig(difficulty)`
   - Create `state` with `createFlightState(cfg)`
   - Set up `const { axesRef, poll, setThrottle } = useInputAxes(...)`
   - Inside `useFlightLoop`, call `poll(dt)` then `stepFlight(state, ...)`,
     then push to a tracker with `tracker.record(...)`
3. Compose the instruments you want — tapes for PFD-style modules, dials
   for MIC/Gubsomat/PIT — and add the module-specific auxiliary task
   (briefings, listening task, response buttons, etc.)
4. Export the `Training` component as a named export with the LMS adapter
   shape: `{ settings, onComplete, onExit }`.

## Adding a new instrument

Round-dial instruments live next to `CompassDial.jsx`. The pattern is:

- One `<svg>` with a fixed face plate and a rotating/swept group
- Apply a transform based on `value`
- Add tolerance markers where applicable (green dot at target, red sectors
  for out-of-tolerance regions)

Tape instruments translate a long inner element via CSS transform; see
`AltitudeTape.jsx` for the math (it's centered on `target`, then translated
by `(value - target) * scale` so the value appears at the viewport center).
