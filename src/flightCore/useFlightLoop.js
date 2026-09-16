import { useEffect, useRef } from 'react';

/**
 * RAF loop with bounded dt. Calls onTick(dt) every frame while
 * runningRef.current === true. Pause/resume just flips the ref —
 * the loop itself never stops, so timing stays continuous.
 */
export function useFlightLoop(onTick, runningRef) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const step = (now) => {
      // Clamp both ends: cap the top to avoid a huge dt after a tab switch,
      // and floor at 0 because the very first rAF callback can report a
      // timestamp earlier than the performance.now() used to seed `last`
      // (the two clocks aren't guaranteed to agree on that first frame),
      // which would otherwise produce a negative dt and poison every
      // downstream physics accumulator with NaN.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      if (runningRef.current) onTickRef.current(dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [runningRef]);
}