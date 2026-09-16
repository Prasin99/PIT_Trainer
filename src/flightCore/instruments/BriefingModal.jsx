import React, { useEffect } from 'react';

/**
 * "Next leg" briefing modal — shown above the active task while paused.
 * Dismissable via Space, Enter, click on the overlay, or any gamepad
 * button press. The gamepad polling is rising-edge: a button that's
 * already held when the modal opens won't auto-dismiss it.
 *
 * Generic across modules: PFD uses it for instrument-active briefings,
 * MIC will use it for listening-task phase briefings, etc. The caller
 * controls the title, body lines, and footer hint.
 *
 * Props:
 *   title:     string   — e.g. "Next leg" / "Nächster Abschnitt"
 *   lines:     string[] — bullet list shown in the modal body
 *   hint:      string   — small footer line, e.g. "Press SPACE to continue"
 *   onDismiss: () => void
 */
export function BriefingModal({ title, lines, hint, onDismiss }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  // Joystick / gamepad button press also dismisses. Polled via RAF since
  // the Gamepad API doesn't fire DOM events; rising-edge so a button
  // that was already held when the modal opened doesn't auto-dismiss.
  useEffect(() => {
    let raf = 0;
    let prevPressed = true; // start as "pressed" so a held-from-start button won't trigger
    const tick = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = Array.from(pads).find((p) => p && p.connected);
      if (pad) {
        const anyPressed = pad.buttons.some((b) => b?.pressed);
        if (anyPressed && !prevPressed) {
          onDismiss();
          return; // stop the loop
        }
        prevPressed = anyPressed;
      } else {
        prevPressed = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDismiss]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/40 z-50 cursor-pointer"
      onClick={onDismiss}
    >
      <div
        className="bg-blue-700 text-white px-12 py-8 rounded shadow-lg max-w-lg"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
      >
        <div className="text-xl font-semibold mb-3">{title}</div>
        <ul className="space-y-1 text-base">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        {hint && (
          <div className="mt-5 text-sm text-blue-200">{hint}</div>
        )}
      </div>
    </div>
  );
}
