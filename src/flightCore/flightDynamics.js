/**
 * Compensatory tracking plant.
 *
 * Each channel has a `mode` per leg:
 *   'maintain'   — target fixed; disturbance active; user holds
 *   'consistent' — target drifts smoothly (slow OU walk around base)
 *   'irregular'  — target jumps to a new random offset every few seconds
 *   'inactive'   — disturbance frozen; value held at base; not scored
 *
 * Heading-band-shake fix (consistent mode):
 *   The OU process produces correlated drift but with HIGH-FREQUENCY noise
 *   per step (≈ 0.3° / frame std on heading at 60 fps, which is ~3 px on
 *   the heading tape). The user perceives that as "shaking". We feed the
 *   OU output through a first-order low-pass filter with τ ≈ 1.5 s
 *   (`consistentDriftSmoothTau`) before adding it to the target. The
 *   visible band motion becomes ~0.2 px / frame — smooth — without
 *   changing the long-term drift envelope.
 */

export function createFlightState(cfg) {
  return {
    altitude: cfg.altitude.initial,
    vSpeed: 0,
    heading: cfg.heading.initial,
    headingRate: 0,
    speed: cfg.speed.initial,
    throttle: cfg.speed.initialThrottle,
    // Raw throttle command shown by the blue column
    displayThrottle: cfg.speed.initialThrottle,

    distVSpeed: 0,
    distHdgRate: 0,
    distSpeed: 0,

    currentTargetAltitude: cfg.altitude.target,
    currentTargetHeading: cfg.heading.target,
    currentTargetSpeed: cfg.speed.target,

    // Raw OU output per channel (the "wandering goal" the band chases).
    drftAlt: 0, drftHdg: 0, drftSpd: 0,
    // First-order low-pass output of the OU above — this is what actually
    // gets added to the base target, so the band moves smoothly.
    drftAltSmoothed: 0, drftHdgSmoothed: 0, drftSpdSmoothed: 0,
    // Countdown timers for irregular-jump mode.
    nextJumpAlt: 0, nextJumpHdg: 0, nextJumpSpd: 0,
    irrSetAlt: 0, irrSetHdg: 0, irrSetSpd: 0,
    // First-order low-pass of the setpoint above. With irregularSmoothTau
    // === 0 (every level except expert altitude/heading) this just copies
    // the setpoint and the visible behaviour is identical to a snap.
    irrSmAlt: 0, irrSmHdg: 0, irrSmSpd: 0,
    // Used only when irregularAlternateWithStop is enabled.
    // Pattern: one side → center/stop → other side → center/stop.
    irrDirAlt: 0, irrDirHdg: 0, irrDirSpd: 0,
    irrNextCenterAlt: false, irrNextCenterHdg: false, irrNextCenterSpd: false,

    // Level 1 maintain-mode random bias direction.
    // Keeps the same movement speed, only reverses direction after random time.
    biasDirAlt: Math.sign(cfg.altitude.disturbanceBias ?? 0) || -1,
    biasDirHdg: Math.sign(cfg.heading.disturbanceBias ?? 0) || -1,
    nextBiasFlipAlt: cfg.altitude.biasFlipMinInterval ?? 8,
    nextBiasFlipHdg: cfg.heading.biasFlipMinInterval ?? 8,
  };
}

export function stepFlight(state, inputs, mode, cfg, dt, rng) {
  state.currentTargetAltitude = updateTarget('altitude', mode.altitude, state.currentTargetAltitude, cfg.altitude, state, dt, rng);
  state.currentTargetHeading = updateTarget('heading', mode.heading, state.currentTargetHeading, cfg.heading, state, dt, rng);
  state.currentTargetSpeed = updateTarget('speed', mode.speed, state.currentTargetSpeed, cfg.speed, state, dt, rng);

  const altInactive = mode.altitude === 'inactive';
  const hdgInactive = mode.heading === 'inactive';
  const spdInactive = mode.speed === 'inactive';

  state.distVSpeed = altInactive ? 0 : ouStep(state.distVSpeed, cfg.altitude.disturbanceSigma, cfg.altitude.disturbanceTau, dt, rng);
  state.distHdgRate = hdgInactive ? 0 : ouStep(state.distHdgRate, cfg.heading.disturbanceSigma, cfg.heading.disturbanceTau, dt, rng);
  state.distSpeed = spdInactive ? 0 : ouStep(state.distSpeed, cfg.speed.disturbanceSigma, cfg.speed.disturbanceTau, dt, rng);

  if (altInactive) {
    state.vSpeed = 0;
    state.altitude = state.currentTargetAltitude;
  } else {
    //const vSpeedCmd = cfg.altitude.gainPitch * clampPM1(inputs.pitch) + state.distVSpeed;
    //const vSpeedCmd = cfg.altitude.gainPitch * clampPM1(inputs.pitch) + state.distVSpeed + (cfg.altitude.disturbanceBias ?? 0);
    const altitudeBias = updateMaintainBias(
      state,
      'altitude',
      cfg.altitude,
      mode.altitude,
      dt,
      rng
    );

    // const vSpeedCmd =
    //   cfg.altitude.gainPitch * clampPM1(inputs.pitch)
    //   + state.distVSpeed
    //   + altitudeBias;

    const pitchInput = clampPM1(inputs.pitch);
    const manualPitchActive = Math.abs(pitchInput) > 0.08;

    // Automatic altitude drift is active while the joystick is neutral.
    // During push or pull, only the joystick controls the altitude response,
    // making both directions equally strong.
    const automaticAltitudeMovement = manualPitchActive
      ? 0
      : state.distVSpeed + altitudeBias;

    const vSpeedCmd =
      cfg.altitude.gainPitch * pitchInput
      + automaticAltitudeMovement;

    state.vSpeed += (vSpeedCmd - state.vSpeed) * (dt / cfg.altitude.rateLag);
    state.altitude += state.vSpeed * dt;
  }

  if (hdgInactive) {
    state.headingRate = 0;
    state.heading = state.currentTargetHeading;
  } else {
    //const hdgRateCmd = cfg.heading.gainRoll * clampPM1(inputs.roll) + state.distHdgRate;
    //const hdgRateCmd = cfg.heading.gainRoll * clampPM1(inputs.roll) + state.distHdgRate + (cfg.heading.disturbanceBias ?? 0);
    const headingBias = updateMaintainBias(
      state,
      'heading',
      cfg.heading,
      mode.heading,
      dt,
      rng
    );

    const hdgRateCmd =
      cfg.heading.gainRoll * clampPM1(inputs.roll)
      + state.distHdgRate
      + headingBias;
    state.headingRate += (hdgRateCmd - state.headingRate) * (dt / cfg.heading.rateLag);
    state.heading = wrap360(state.heading + state.headingRate * dt);
  }

  // --- SPEED dynamics ---

  const commandedThrottle = clamp01(inputs.throttle);

  // Blue column display follows the actual throttle command
  state.displayThrottle = commandedThrottle;

  // Smoothed throttle is used for the airspeed physics
  const throttleTau = cfg.speed.throttleInertiaTau ?? 1.0;
  const throttleAlpha = 1 - Math.exp(-dt / throttleTau);

  state.throttle += (commandedThrottle - state.throttle) * throttleAlpha;

  if (spdInactive) {
    state.speed = state.currentTargetSpeed;
  } else {
    const throttleMin = cfg.speed.minThrottleSpeed ?? 40;
    const throttleMax = cfg.speed.maxThrottleSpeed ?? 260;

    // Throttle sets the base equilibrium speed.
    const baseEq =
      throttleMin + (throttleMax - throttleMin) * state.throttle;

    // Joystick pitch effect on speed.
    // Pull back = positive pitch = speed decreases.
    // Push forward = negative pitch = speed increases.
    //
    // Important:
    // This uses inputs.pitch directly.
    // It does NOT use state.vSpeed, because state.vSpeed contains
    // altitude disturbance/bias and can create unwanted speed turbulence.
    const pitchInput = clampPM1(inputs.pitch);

    const pitchPullShift = cfg.speed.pitchSpeedPullShift ?? 110;
    const pitchPushShift = cfg.speed.pitchSpeedPushShift ?? 110;

    const pitchSpeedShift =
      pitchInput >= 0
        ? pitchPullShift * pitchInput
        : pitchPushShift * pitchInput;

    const eq = baseEq - pitchSpeedShift;

    const speedCmd =
      eq +
      state.distSpeed +
      (cfg.speed.disturbanceBias ?? 0);

    state.speed +=
      (speedCmd - state.speed) *
      (dt / (cfg.speed.rateLag ?? 1.2));

    state.speed = clamp(
      state.speed,
      throttleMin,
      throttleMax
    );
  }
}

function updateTarget(channelName, modeStr, currentTarget, ccfg, state, dt, rng) {
  const baseTarget = ccfg.target;
  const driftKey = channelName === 'altitude' ? 'drftAlt' : channelName === 'heading' ? 'drftHdg' : 'drftSpd';
  const smoothKey = channelName === 'altitude' ? 'drftAltSmoothed' : channelName === 'heading' ? 'drftHdgSmoothed' : 'drftSpdSmoothed';
  const jumpKey = channelName === 'altitude' ? 'nextJumpAlt' : channelName === 'heading' ? 'nextJumpHdg' : 'nextJumpSpd';
  const irrSetKey = channelName === 'altitude' ? 'irrSetAlt' : channelName === 'heading' ? 'irrSetHdg' : 'irrSetSpd';
  const irrSmKey = channelName === 'altitude' ? 'irrSmAlt' : channelName === 'heading' ? 'irrSmHdg' : 'irrSmSpd';
  const irrDirKey = channelName === 'altitude' ? 'irrDirAlt' : channelName === 'heading' ? 'irrDirHdg' : 'irrDirSpd';
  const irrNextCenterKey = channelName === 'altitude' ? 'irrNextCenterAlt' : channelName === 'heading' ? 'irrNextCenterHdg' : 'irrNextCenterSpd';

  switch (modeStr) {
    case 'maintain':
    case 'inactive':
      // Channel parked at base — wipe every drift / jump / slew slot so
      // the next active leg of any mode starts from a clean slate.
      state[driftKey] = 0;
      state[smoothKey] = 0;
      state[irrSetKey] = 0;
      state[irrSmKey] = 0;
      state[jumpKey] = 0;
      state[irrDirKey] = 0;
      state[irrNextCenterKey] = false;
      return baseTarget;

    case 'consistent': {
      // OU drift active; irregular slots held at 0 so a later irregular
      // leg starts from base instead of inheriting a stale setpoint.
      state[irrSetKey] = 0;
      state[irrSmKey] = 0;
      state[irrDirKey] = 0;
      state[irrNextCenterKey] = false;

      // 1. Raw OU drift (correlated random walk around 0 with std=sigma).
      state[driftKey] = ouStep(state[driftKey], ccfg.consistentDriftSigma, ccfg.consistentDriftTau, dt, rng);
      // 2. Low-pass to strip the high-frequency per-step jitter.
      const smoothTau = ccfg.consistentDriftSmoothTau ?? 1.5;
      state[smoothKey] += (state[driftKey] - state[smoothKey]) * (dt / smoothTau);
      // let next = baseTarget + state[smoothKey];
      // if (channelName === 'heading') next = wrap360(next);
      // return next;
      let next = baseTarget + state[smoothKey];

      if (channelName === 'speed') {
        next = clamp(
          next,
          ccfg.targetMinSpeed ?? 100,
          ccfg.targetMaxSpeed ?? 180
        );
      }

      if (channelName === 'heading') next = wrap360(next);
      return next;
    }

    case 'irregular': {
      // Irregular active; OU slots held at 0 so a later consistent leg
      // starts clean. (This preserves the old behaviour exactly.)
      state[driftKey] = 0;
      state[smoothKey] = 0;

      // Tick the jump timer. On expiry sample a fresh offset into the
      // SETPOINT slot. The smoothed slew below either copies it (snap)
      // or eases toward it (expert altitude/heading).
      state[jumpKey] -= dt;

      if (ccfg.irregularFullCircleSweep) {
        const maxOffset = ccfg.irregularSweepRange ?? ccfg.irregularJumpRange ?? 0;
        const sweepRate = ccfg.irregularSweepRate ?? maxOffset / 8;

        // How often the green dot should change direction.
        // Example: 10 = reverse roughly every 10 seconds.
        const directionChangeInterval = ccfg.irregularDirectionChangeInterval ?? 10;

        // Short pause before moving in the opposite direction.
        // 0.3 = 300 milliseconds. This is short, but still visible.
        const reversePause = ccfg.irregularReversePause ?? 0.3;

        // Start with a random direction.
        // Also start slightly on the opposite side, so the movement is visible immediately.
        if (state[irrDirKey] === 0) {
          state[irrDirKey] = rng() < 0.5 ? -1 : 1;

          const startOffset = Math.min(
            maxOffset,
            sweepRate * directionChangeInterval * 0.5
          );

          state[irrSmKey] = -state[irrDirKey] * startOffset;
          state[irrSetKey] = state[irrSmKey];

          state[jumpKey] = directionChangeInterval;
          state[irrNextCenterKey] = false;
        }

        // If we are in the short pause phase, do not move.
        // When the pause is finished, reverse direction and continue.
        if (state[irrNextCenterKey]) {
          if (state[jumpKey] <= 0) {
            state[irrDirKey] *= -1;
            state[irrNextCenterKey] = false;
            state[jumpKey] = directionChangeInterval;
          }
        } else {
          // Move continuously in the current direction.
          state[irrSmKey] += state[irrDirKey] * sweepRate * dt;

          // Keep the green dot inside the configured movement range.
          if (state[irrSmKey] > maxOffset) {
            state[irrSmKey] = maxOffset;
            state[irrNextCenterKey] = true;
            state[jumpKey] = reversePause;
          } else if (state[irrSmKey] < -maxOffset) {
            state[irrSmKey] = -maxOffset;
            state[irrNextCenterKey] = true;
            state[jumpKey] = reversePause;
          }

          // Reverse direction after the configured interval.
          if (state[jumpKey] <= 0) {
            state[irrNextCenterKey] = true;
            state[jumpKey] = reversePause;
          }
        }

        state[irrSetKey] = state[irrSmKey];

        // let next = baseTarget + state[irrSmKey];
        // if (channelName === 'heading') next = wrap360(next);
        // return next;
        let next = baseTarget + state[irrSmKey];

        if (channelName === 'speed') {
          next = clamp(
            next,
            ccfg.targetMinSpeed ?? 100,
            ccfg.targetMaxSpeed ?? 180
          );
        }

        if (channelName === 'heading') next = wrap360(next);
        return next;
      }

      if (state[jumpKey] <= 0) {
        if (ccfg.irregularAlternateWithStop) {
          const maxOffset = ccfg.irregularJumpRange ?? 0;
          const minAbsOffset = Math.min(
            ccfg.irregularMinAbsOffset ?? maxOffset * 0.6,
            maxOffset
          );

          if (state[irrDirKey] === 0) {
            state[irrDirKey] = rng() < 0.5 ? -1 : 1;
          }

          if (state[irrNextCenterKey]) {
            state[irrSetKey] = 0;
            state[irrDirKey] *= -1;
            state[irrNextCenterKey] = false;
            state[jumpKey] = ccfg.irregularCenterHoldInterval ?? 1.8;
          } else {
            const magnitude =
              minAbsOffset + rng() * (maxOffset - minAbsOffset);

            state[irrSetKey] = state[irrDirKey] * magnitude;
            state[irrNextCenterKey] = true;
            state[jumpKey] = ccfg.irregularSideHoldInterval ?? 2.8;
          }
        } else {
          state[irrSetKey] = (rng() * 2 - 1) * ccfg.irregularJumpRange;
          state[jumpKey] = ccfg.irregularMinInterval
            + rng() * (ccfg.irregularMaxInterval - ccfg.irregularMinInterval);
        }
      }
      // First-order LP slew of the setpoint.
      //   τ === 0 → direct copy → bit-identical to the old snap.
      //   τ  > 0 → exponential approach → smooth slew.
      // For heading the LP runs on the *offset* (always bounded to
      // ±irregularJumpRange = ±12° at expert) so plain linear filtering
      // is correct; the wrap is applied at the end after adding to base.
      const smoothTau = ccfg.irregularSmoothTau ?? 0;
      if (smoothTau > 0) {
        state[irrSmKey] += (state[irrSetKey] - state[irrSmKey]) * (dt / smoothTau);
      } else {
        state[irrSmKey] = state[irrSetKey];
      }
      // let next = baseTarget + state[irrSmKey];
      // if (channelName === 'heading') next = wrap360(next);
      // return next;
      let next = baseTarget + state[irrSmKey];

      if (channelName === 'speed') {
        next = clamp(
          next,
          ccfg.targetMinSpeed ?? 100,
          ccfg.targetMaxSpeed ?? 180
        );
      }

      if (channelName === 'heading') next = wrap360(next);
      return next;
    }

    default:
      return baseTarget;
  }
}
function updateMaintainBias(state, channelName, ccfg, modeStr, dt, rng) {
  const configuredBias = ccfg.disturbanceBias ?? 0;

  // Only Level 1 / maintain mode reverses direction randomly.
  // In consistent and irregular levels, the configured bias remains unchanged.
  if (
    modeStr !== 'maintain' &&
    modeStr !== 'consistent' &&
    modeStr !== 'irregular'
  ) {
    return configuredBias;
  }

  const magnitude = Math.abs(configuredBias);
  if (magnitude === 0) return 0;

  const dirKey = channelName === 'altitude'
    ? 'biasDirAlt'
    : 'biasDirHdg';

  const timerKey = channelName === 'altitude'
    ? 'nextBiasFlipAlt'
    : 'nextBiasFlipHdg';

  if (!state[dirKey]) {
    state[dirKey] = Math.sign(configuredBias) || -1;
  }

  state[timerKey] -= dt;

  if (state[timerKey] <= 0) {
    // Reverse direction, but keep exactly the same movement speed.
    state[dirKey] *= -1;

    const minInterval = ccfg.biasFlipMinInterval ?? 8;
    const maxInterval = ccfg.biasFlipMaxInterval ?? 14;

    state[timerKey] =
      minInterval + rng() * (maxInterval - minInterval);
  }

  return magnitude * state[dirKey];
}

function ouStep(x, sigma, tau, dt, rng) {
  if (sigma <= 0) return 0;
  const decay = Math.exp(-dt / tau);
  const variance = Math.max(0, 1 - decay * decay);
  return x * decay + sigma * Math.sqrt(variance) * gaussian(rng);
}

function gaussian(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function wrap360(a) { let x = a % 360; if (x < 0) x += 360; return x; }
function clamp(x, min, max) {
  return Math.max(min, Math.min(max, x));
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function clampPM1(x) { return Math.max(-1, Math.min(1, x)); }

export function angularDiff(a, b) {
  return ((a - b) % 360 + 540) % 360 - 180;
}