import { angularDiff } from './flightDynamics.js';

export function createToleranceTracker(channels) {
  const stats = {};
  for (const name of Object.keys(channels)) {
    stats[name] = { tg: 0, ty: 0, tr: 0, sqe: 0, t: 0 };
  }

  return {
    record(name, current, target, dt) {
      const c = channels[name];
      if (!c) return;
      const s = stats[name];
      const err = c.circular ? angularDiff(current, target) : current - target;
      const ae = Math.abs(err);
      if (ae <= c.tolerance.green)       s.tg += dt;
      else if (ae <= c.tolerance.yellow) s.ty += dt;
      else                               s.tr += dt;
      s.sqe += err * err * dt;
      s.t   += dt;
    },
    summary() {
      const out = {};
      for (const name of Object.keys(channels)) {
        const s = stats[name];
        const t = Math.max(s.t, 1e-6);
        out[name] = {
          timeInGreen: s.tg, timeInYellow: s.ty, timeInRed: s.tr,
          totalTime: s.t,
          rmsError: Math.sqrt(s.sqe / t),
          fractionGreen: s.tg / t,
        };
      }
      return out;
    },
  };
}