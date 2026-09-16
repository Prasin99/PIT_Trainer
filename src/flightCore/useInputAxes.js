import { useEffect, useRef } from 'react';

/**
 * Keyboard + joystick/gamepad input.
 *
 * Keyboard fallback:
 *   ArrowUp / ArrowDown     = pitch / altitude
 *   ArrowLeft / ArrowRight  = roll / heading
 *   Q / A                   = throttle up/down
 *
 * Joystick:
 *   axis 0 = roll
 *   axis 1 = pitch
 *   axis 6 = throttle slider, with fallbacks to axis 2 / axis 3
 *   buttons 5/7 = throttle up
 *   buttons 4/6 = throttle down
 */
export function useInputAxes(initialThrottle = 0.5) {
  const axesRef = useRef({
    pitch: 0,
    roll: 0,
    throttle: initialThrottle,
  });

  const keysRef = useRef(new Set());

  const gamepadIndexRef = useRef(null);

  const sliderRef = useRef({
    initialised: false,
    axisIndex: null,
    last: 0,
    active: false,
  });

  useEffect(() => {
    const onDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }

      const k = e.key.toLowerCase();
      keysRef.current.add(k);

      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'a', ' '].includes(k)) {
        e.preventDefault();
      }
    };

    const onUp = (e) => {
      keysRef.current.delete(e.key.toLowerCase());
    };

    const onBlur = () => {
      keysRef.current.clear();
    };

    const onGamepadConnected = (e) => {
      gamepadIndexRef.current = e.gamepad.index;
    };

    const onGamepadDisconnected = (e) => {
      if (gamepadIndexRef.current === e.gamepad.index) {
        gamepadIndexRef.current = null;
      }
      sliderRef.current.initialised = false;
      sliderRef.current.axisIndex = null;
      sliderRef.current.active = false;
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('gamepadconnected', onGamepadConnected);
    window.addEventListener('gamepaddisconnected', onGamepadDisconnected);

    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('gamepadconnected', onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
    };
  }, []);

  const poll = (dt) => {
    const a = axesRef.current;
    const k = keysRef.current;

    // ── Keyboard fallback ─────────────────────────────────────────────
    let kbPitch = 0;
    let kbRoll = 0;
    let kbThrDelta = 0;

    if (k.has('arrowup')) kbPitch += 1;
    if (k.has('arrowdown')) kbPitch -= 1;
    if (k.has('arrowright')) kbRoll += 1;
    if (k.has('arrowleft')) kbRoll -= 1;

    if (k.has('q')) kbThrDelta += dt * 0.25;
    if (k.has('a')) kbThrDelta -= dt * 0.25;

    // ── Joystick / gamepad ────────────────────────────────────────────
    let gpPitch = 0;
    let gpRoll = 0;
    let gpThrDelta = 0;
    let gpAbsThrottle = null;

    let gpActivePitch = false;
    let gpActiveRoll = false;

    const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];

    let pad = null;

    if (gamepadIndexRef.current !== null) {
      const remembered = pads[gamepadIndexRef.current];
      if (remembered && remembered.connected) {
        pad = remembered;
      }
    }

    if (!pad) {
      pad = pads.find((p) => p && p.connected && p.axes && p.axes.length >= 2) || null;
      if (pad) gamepadIndexRef.current = pad.index;
    }

    if (pad) {
      const DEADZONE = 0.08;
      const dz = (v) => (Math.abs(v) < DEADZONE ? 0 : v);

      // Main joystick axes.
      gpRoll = dz(pad.axes[0] ?? 0);

      // Logitech Extreme 3D Pro usually reports:
      // pull back = positive axis 1.
      // If your joystick is reversed, change this line to: gpPitch = -dz(pad.axes[1] ?? 0);
      gpPitch = dz(pad.axes[1] ?? 0);

      gpActivePitch = gpPitch !== 0;
      gpActiveRoll = gpRoll !== 0;

      // HOTAS throttle slider.
      // Prefer axis 6, but allow fallback to axis 2 or 3 for other devices.
      const throttleAxisCandidates = [6, 2, 3];
      const sl = sliderRef.current;

      for (const axisIndex of throttleAxisCandidates) {
        if (typeof pad.axes[axisIndex] !== 'number') continue;

        const raw = pad.axes[axisIndex];

        if (!sl.initialised) {
          sl.initialised = true;
          sl.axisIndex = axisIndex;
          sl.last = raw;
          break;
        }

        if (sl.axisIndex === axisIndex && Math.abs(raw - sl.last) > 0.02) {
          sl.active = true;
          sl.last = raw;
        }

        if (sl.active && sl.axisIndex === axisIndex) {
          gpAbsThrottle = clamp01((1 - raw) / 2);
        }

        if (sl.axisIndex === axisIndex) break;
      }

      // Buttons as throttle nudge.
      const btnUp =
        (pad.buttons[5]?.pressed ? 1 : 0) ||
        (pad.buttons[7]?.pressed ? 1 : 0) ||
        (pad.buttons[12]?.pressed ? 1 : 0);

      const btnDown =
        (pad.buttons[4]?.pressed ? 1 : 0) ||
        (pad.buttons[6]?.pressed ? 1 : 0) ||
        (pad.buttons[13]?.pressed ? 1 : 0);

      gpThrDelta += (btnUp - btnDown) * dt * 0.35;
    }

    // Joystick has priority when moved. Keyboard remains fallback.
    a.pitch = gpActivePitch ? gpPitch : kbPitch;
    a.roll = gpActiveRoll ? gpRoll : kbRoll;

    if (gpAbsThrottle !== null) {
      a.throttle = gpAbsThrottle;
    } else {
      a.throttle = clamp01(a.throttle + kbThrDelta + gpThrDelta);
    }

    return a;
  };

  const setThrottle = (v) => {
    axesRef.current.throttle = clamp01(v);

    // Release physical throttle lock until the joystick slider moves again.
    sliderRef.current.active = false;
  };

  return { axesRef, poll, setThrottle };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}