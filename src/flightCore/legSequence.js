/**
 * Leg sequence utilities â€” shared across all flight-core modules.
 *
 * A "leg" is a phase of a tracking task with a specific subset of channels
 * active. Between legs, a briefing modal tells the user which channels will
 * be active for the upcoming leg. While the briefing is shown, both physics
 * and the elapsed-time counter pause â€” so `duration` represents total
 * flying time, not wall-clock time.
 *
 * This file contains ONLY generic utilities. Each module defines its own
 * leg array (PFD's defaultLegs lives in pfdTracking/legs.js, MIC's would
 * live in mic/legs.js, etc.) â€” they all use the same shape:
 *
 *   {
 *     durationSec: number,
 *     active: { altitude: bool, heading: bool, speed: bool },
 *     briefing: { en: string[], de: string[] }
 *   }
 */

/**
 * Pick the leg whose cumulative duration covers the given elapsed time.
 * Cycles through `legs` if `elapsedSec` exceeds the total.
 *
 * Returns { index, leg, legElapsed } or null if legs is empty.
 */
export function legAt(legs, elapsedSec) {
  if (!legs || legs.length === 0) return null;
  const total = totalLegsDuration(legs);
  const wrapped = total > 0 ? elapsedSec % total : 0;
  let acc = 0;
  for (let i = 0; i < legs.length; i++) {
    acc += legs[i].durationSec;
    if (wrapped < acc) {
      return {
        index: i,
        leg: legs[i],
        legElapsed: wrapped - (acc - legs[i].durationSec),
      };
    }
  }
  return {
    index: legs.length - 1,
    leg: legs[legs.length - 1],
    legElapsed: legs[legs.length - 1].durationSec,
  };
}

/** Sum of all leg durations in seconds. */
export function totalLegsDuration(legs) {
  return (legs || []).reduce((sum, l) => sum + (l.durationSec || 0), 0);
}