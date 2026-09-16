// /**
//  * Single source of tuning constants for the flight plant.
//  *
//  * Three channels — altitude, heading, speed — each with:
//  *   - target the user should hold
//  *   - control gain (max rate at full stick)
//  *   - first-order rate lag
//  *   - disturbance noise (Ornstein–Uhlenbeck) the user must compensate
//  *   - tolerance bands (green / yellow) for scoring + visual feedback
//  *   - target-drift / jump parameters used by the leg modes
//  *
//  * Difficulty controls THREE things:
//  *   1. Disturbance amplitude (`disturbanceSigma`) — how hard the airplane is
//  *      to hold steady when the trainee isn't touching the controls.
//  *      Kept scaled across presets (user feedback: control feel is correct).
//  *   2. Consistent-drift amplitude + timescale (`consistentDriftSigma`,
//  *      `consistentDriftTau`) — how far and how fast the target wanders
//  *      around the base value in 'consistent' mode.
//  *   3. Irregular-jump amplitude + cadence (`irregularJumpRange`,
//  *      `irregularMin/MaxInterval`) — how big and how often the target snaps
//  *      to a new offset in 'irregular' mode (Expert levels).
//  *
//  * RECALIBRATION (beta feedback May 2026):
//  *   The previous medium/hard/expert drift values overshot the real
//  *   SkyTest PFD Tracking Test by a large margin — easy was confirmed by
//  *   beta tester as matching the real exam most closely. The new ladder
//  *   keeps easy untouched and brings medium/hard/expert down to a gentle
//  *   progression above easy, instead of a 4× cliff at expert.
//  *
//  *   altDriftSigma:  easy 20 │ medium 25 │ hard 30 │ expert 35   (was 20/40/60/80)
//  *   altDriftTau:    easy 45 │ medium 42 │ hard 38 │ expert 35   (was 45/30/20/15)
//  *   altJumpRange:   easy 50 │ medium 55 │ hard 65 │ expert 75   (was 50/75/100/130)
//  *   jumpInterval:   easy 6-10 │ medium 6-9 │ hard 5-8 │ expert 5-7  (was …/4-7/3-5/2-4)
//  *
//  *   Disturbance scaling unchanged — tester said joystick/control feel is good.
//  */

// export const difficultyPresets = {
//   easy: {
//     // EASY IS THE CALIBRATION ANCHOR — DO NOT CHANGE without a new data point.
//     // Confirmed by beta tester as the closest match to the real PFD Tracking Test.
//     altDisturbSigma:  12,   hdgDisturbSigma:  3.0,  spdDisturbSigma:  2.0,
//     altDriftSigma:    20,   hdgDriftSigma:    3.0,  spdDriftSigma:    1.5,
//     altDriftTau:      45,   hdgDriftTau:      35,   spdDriftTau:      30,
//     altJumpRange:     50,   hdgJumpRange:      7,   spdJumpRange:      5,
//     jumpMinInterval:   6,   jumpMaxInterval:  10,
//   },
//   medium: {
//     // Disturbance unchanged from previous version.
//     altDisturbSigma:  25,   hdgDisturbSigma:  5.5,  spdDisturbSigma:  4.0,
//     // Drift: barely above easy. "Just a bit difficult" — wider envelope,
//     // marginally faster timescale.
//     altDriftSigma:    25,   hdgDriftSigma:    3.5,  spdDriftSigma:    1.8,
//     altDriftTau:      42,   hdgDriftTau:      32,   spdDriftTau:      27,
//     altJumpRange:     55,   hdgJumpRange:      8,   spdJumpRange:      6,
//     jumpMinInterval:   6,   jumpMaxInterval:   9,
//   },
//   hard: {
//     altDisturbSigma:  45,   hdgDisturbSigma:  9.0,  spdDisturbSigma:  6.5,
//     // Drift: ~1.5× easy sigma, modestly shorter tau.
//     altDriftSigma:    30,   hdgDriftSigma:    4.5,  spdDriftSigma:    2.2,
//     altDriftTau:      38,   hdgDriftTau:      28,   spdDriftTau:      24,
//     altJumpRange:     65,   hdgJumpRange:     10,   spdJumpRange:      7,
//     jumpMinInterval:   5,   jumpMaxInterval:   8,
//   },
//   expert: {
//     altDisturbSigma:  60,   hdgDisturbSigma: 12.0,  spdDisturbSigma:  9.0,
//     // Drift: ~1.75× easy sigma. Previously 4× easy — the main "jumping" complaint.
//     altDriftSigma:    35,   hdgDriftSigma:    5.5,  spdDriftSigma:    2.6,
//     altDriftTau:      35,   hdgDriftTau:      25,   spdDriftTau:      21,
//     // Irregular jumps were the worst offender: was ±130ft every 2–4s.
//     // Now ±75ft every 5–7s — still distinct from hard's smooth drift,
//     // no longer violent.
//     altJumpRange:     75,   hdgJumpRange:     12,   spdJumpRange:      9,
//     jumpMinInterval:   5,   jumpMaxInterval:   7,
//   },
// };

// /**
//  * Visual-smoothing time constant for the consistent-drift output. The OU
//  * process produces high-frequency per-step noise that reads as "shaking"
//  * to the user. A first-order low-pass filter on the OU output strips
//  * that out without changing the drift envelope. Unchanged from previous
//  * version — easy is calibrated against the real exam with this value.
//  */
// const CONSISTENT_DRIFT_SMOOTH_TAU = 1.5; // seconds

// export function buildFlightConfig(difficulty = 'medium', overrides = {}) {
//   const d = difficultyPresets[difficulty] ?? difficultyPresets.medium;
//   return {
//     altitude: {
//       initial: 8000,
//       target: 8000,
//       gainPitch: 120,
//       rateLag: 1.2,
//       disturbanceSigma: d.altDisturbSigma,
//       disturbanceTau: 20,
//       tolerance: { green: 20, yellow: 50 },
//       tapeSpan: 200,
//       majorStep: 100,
//       minorStep: 10,

//       consistentDriftSigma:     d.altDriftSigma,
//       consistentDriftTau:       d.altDriftTau,
//       consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
//       irregularJumpRange:       d.altJumpRange,
//       irregularMinInterval:     d.jumpMinInterval,
//       irregularMaxInterval:     d.jumpMaxInterval,

//       ...overrides.altitude,
//     },
//     heading: {
//       initial: 0,
//       target: 0,
//       gainRoll: 20,
//       rateLag: 0.8,
//       disturbanceSigma: d.hdgDisturbSigma,
//       disturbanceTau: 8,
//       tolerance: { green: 5, yellow: 10 },
//       tapeSpan: 35,
//       majorStep: 5,
//       minorStep: 1,

//       consistentDriftSigma:     d.hdgDriftSigma,
//       consistentDriftTau:       d.hdgDriftTau,
//       consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
//       irregularJumpRange:       d.hdgJumpRange,
//       irregularMinInterval:     d.jumpMinInterval,
//       irregularMaxInterval:     d.jumpMaxInterval,

//       ...overrides.heading,
//     },
//     speed: {
//       initial: 150,
//       target: 150,
//       minThrottleSpeed: 100,
//       maxThrottleSpeed: 200,
//       initialThrottle: 0.5,
//       rateLag: 2.0,
//       altRateCouplingGain: 0.3,   // kt of speed shift per ft/sec of vSpeed
//       disturbanceSigma: d.spdDisturbSigma,
//       disturbanceTau: 8,
//       tolerance: { green: 3, yellow: 7 },
//       tapeSpan: 35,
//       majorStep: 5,
//       minorStep: 1,

//       consistentDriftSigma:     d.spdDriftSigma,
//       consistentDriftTau:       d.spdDriftTau,
//       consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
//       irregularJumpRange:       d.spdJumpRange,
//       irregularMinInterval:     d.jumpMinInterval,
//       irregularMaxInterval:     d.jumpMaxInterval,

//       ...overrides.speed,
//     },
//   };
// }




//new //


/**
 * Single source of tuning constants for the flight plant.
 *
 * Three channels — altitude, heading, speed — each with:
 *   - target the user should hold
 *   - control gain (max rate at full stick)
 *   - first-order rate lag
 *   - disturbance noise (Ornstein–Uhlenbeck) the user must compensate
 *   - tolerance bands (green / yellow) for scoring + visual feedback
 *   - target-drift / jump parameters used by the leg modes
 *
 * Difficulty controls THREE things:
 *   1. Disturbance amplitude (`disturbanceSigma`) — how hard the airplane is
 *      to hold steady when the trainee isn't touching the controls.
 *      Kept scaled across presets (user feedback: control feel is correct).
 *   2. Consistent-drift amplitude + timescale (`consistentDriftSigma`,
 *      `consistentDriftTau`) — how far and how fast the target wanders
 *      around the base value in 'consistent' mode.
 *   3. Irregular-jump amplitude + cadence (`irregularJumpRange`,
 *      `irregularMin/MaxInterval`) — how big and how often the target snaps
 *      to a new offset in 'irregular' mode (Expert levels).
 *
 * RECALIBRATION (beta feedback May 2026):
 *   The previous medium/hard/expert drift values overshot the real
 *   SkyTest PFD Tracking Test by a large margin — easy was confirmed by
 *   beta tester as matching the real exam most closely. The new ladder
 *   keeps easy untouched and brings medium/hard/expert down to a gentle
 *   progression above easy, instead of a 4× cliff at expert.
 *
 *   altDriftSigma:  easy 20 │ medium 35 │ hard 45 │ expert 55   (was 20/40/60/80)
 *   altDriftTau:    easy 45 │ medium 38 │ hard 32 │ expert 28   (was 45/30/20/15)
 *   altJumpRange:   easy 50 │ medium 55 │ hard 65 │ expert 75   (was 50/75/100/130)
 *   jumpInterval:   easy 6-10 │ medium 6-9 │ hard 5-8 │ expert 5-7  (was …/4-7/3-5/2-4)
 *
 *   Altitude medium/hard/expert bumped (25→35, 30→45, 35→55) after
 *   second beta round — at 25 the target hugged 8000 and the trainee
 *   had nothing to chase in level 5.
 *
 *   Disturbance scaling unchanged — tester said joystick/control feel is good.
 */
export const BRIEFING_DURATION_MS = 10000;

export const difficultyPresets = {
  easy: {
    // EASY IS THE CALIBRATION ANCHOR — DO NOT CHANGE without a new data point.
    // Confirmed by beta tester as the closest match to the real PFD Tracking Test.
    altDisturbSigma:  12,   hdgDisturbSigma:  3.0,  spdDisturbSigma:  2.0,
    altDriftSigma:    20,   hdgDriftSigma:    3.0,  spdDriftSigma:    1.5,
    altDriftTau:      45,   hdgDriftTau:      35,   spdDriftTau:      30,
    altJumpRange:     50,   hdgJumpRange:      7,   spdJumpRange:      5,
    jumpMinInterval:   6,   jumpMaxInterval:  10,
  },
  medium: {
    // Disturbance unchanged from previous version.
    altDisturbSigma:  25,   hdgDisturbSigma:  5.5,  spdDisturbSigma:  4.0,
    // Drift: heading & speed barely above easy. Altitude bumped to 35
    // (was 25) per beta feedback — at 25 the target hugged 8000 and the
    // trainee had nothing to chase. 35 produces ~±35ft typical excursions
    // through the yellow band (±50ft tolerance) without feeling jumpy.
    altDriftSigma:    35,   hdgDriftSigma:    3.5,  spdDriftSigma:    1.8,
    altDriftTau:      38,   hdgDriftTau:      32,   spdDriftTau:      27,
    altJumpRange:     55,   hdgJumpRange:      8,   spdJumpRange:      6,
    jumpMinInterval:   6,   jumpMaxInterval:   9,
  },
  hard: {
    altDisturbSigma:  45,   hdgDisturbSigma:  9.0,  spdDisturbSigma:  6.5,
    // Drift: altitude bumped to 45 (was 30) to keep the medium → hard
    // step meaningful after the medium bump.
    altDriftSigma:    45,   hdgDriftSigma:    4.5,  spdDriftSigma:    2.2,
    altDriftTau:      32,   hdgDriftTau:      30,   spdDriftTau:      24,
    altJumpRange:     65,   hdgJumpRange:     10,   spdJumpRange:      7,
    jumpMinInterval:   5,   jumpMaxInterval:   8,
  },
  expert: {
    altDisturbSigma:  60,   hdgDisturbSigma: 12.0,  spdDisturbSigma:  9.0,
    // Drift: altitude bumped to 55 (was 35). Still well below the old
    // expert (80) that the tester called "jumping too much".
    altDriftSigma:    55,   hdgDriftSigma:    5.5,  spdDriftSigma:    2.6,
    altDriftTau:      28,   hdgDriftTau:      25,   spdDriftTau:      21,
    // Irregular jumps unchanged from the previous recalibration:
    // ±75ft every 5–7s — distinct from hard's smooth drift, no longer violent.
    altJumpRange:     80,   hdgJumpRange:     18,   spdJumpRange:      10,
    jumpMinInterval:   4,   jumpMaxInterval:   6,
    altIrregularSmoothTau: 2.5,
    hdgIrregularSmoothTau: 2.5,
  },
};

/**
 * Visual-smoothing time constant for the consistent-drift output. The OU
 * process produces high-frequency per-step noise that reads as "shaking"
 * to the user. A first-order low-pass filter on the OU output strips
 * that out without changing the drift envelope. Unchanged from previous
 * version — easy is calibrated against the real exam with this value.
 */
const CONSISTENT_DRIFT_SMOOTH_TAU = 1.5; // seconds

export function buildFlightConfig(difficulty = 'medium', overrides = {}) {
  const d = difficultyPresets[difficulty] ?? difficultyPresets.medium;
  return {
    altitude: {
      initial: 8000,
      target: 8000,
      gainPitch: 120,
      rateLag: 1.2,
      disturbanceSigma: d.altDisturbSigma,
      disturbanceTau: 20,
      tolerance: { green: 20, yellow: 50 },
      tapeSpan: 133,
      majorStep: 50,    // was 100
      minorStep: 5,

      consistentDriftSigma:     d.altDriftSigma,
      consistentDriftTau:       d.altDriftTau,
      consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
      irregularJumpRange:       d.altJumpRange,
      irregularMinInterval:     d.jumpMinInterval,
      irregularMaxInterval:     d.jumpMaxInterval,
      irregularSmoothTau:       d.altIrregularSmoothTau ?? 0,

      ...overrides.altitude,
    },
    heading: {
      initial: 0,
      target: 0,
      gainRoll: 20,
      rateLag: 0.8,
      disturbanceSigma: d.hdgDisturbSigma,
      disturbanceTau: 8,
      tolerance: { green: 5, yellow: 10 },
      tapeSpan: 35,
      majorStep: 5,
      minorStep: 1,

      consistentDriftSigma:     d.hdgDriftSigma,
      consistentDriftTau:       d.hdgDriftTau,
      consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
      irregularJumpRange:       d.hdgJumpRange,
      irregularMinInterval:     d.jumpMinInterval,
      irregularMaxInterval:     d.jumpMaxInterval,
      irregularSmoothTau:       d.hdgIrregularSmoothTau ?? 0,

      ...overrides.heading,
    },
    speed: {
      initial: 150,
      target: 150,
      minThrottleSpeed: 100,
      maxThrottleSpeed: 200,
      initialThrottle: 0.5,
      rateLag: 2.0,
      altRateCouplingGain: 0.3,   // kt of speed shift per ft/sec of vSpeed
      disturbanceSigma: d.spdDisturbSigma,
      disturbanceTau: 8,
      tolerance: { green: 3, yellow: 7 },
      tapeSpan: 20,
      majorStep: 25,
      minorStep: 1,

      consistentDriftSigma:     d.spdDriftSigma,
      consistentDriftTau:       d.spdDriftTau,
      consistentDriftSmoothTau: CONSISTENT_DRIFT_SMOOTH_TAU,
      irregularJumpRange:       d.spdJumpRange,
      irregularMinInterval:     d.jumpMinInterval,
      irregularMaxInterval:     d.jumpMaxInterval,

      ...overrides.speed,
    },
  };
}