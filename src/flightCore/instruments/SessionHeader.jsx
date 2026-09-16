import React from 'react';

/**
 * Top header strip used by every flightCore module: timer (countdown or
 * count-up), pause button, exit button. Pure presentational.
 */
export function SessionHeader({
  remainingSec,        // null = count up
  elapsedSec,
  paused,
  onPauseToggle,
  onExit,
  labels = { pause: 'Pause', resume: 'Resume', exit: 'Exit', time: 'Time' },
}) {
  const display = remainingSec != null ? remainingSec : elapsedSec;
  const lowTime = remainingSec != null && remainingSec <= 30;
  const m = Math.floor(Math.max(0, display) / 60);
  const s = Math.floor(Math.max(0, display) % 60);
  const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 bg-blue-50 border-b border-blue-200">
      <div
        className={`font-mono text-sm px-3 py-1 rounded ${
          lowTime ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-900'
        }`}
      >
        {labels.time}: {timeStr}
      </div>
      <button
        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
        onClick={onPauseToggle}
      >
        {paused ? labels.resume : labels.pause}
      </button>
      <button
        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
        onClick={onExit}
      >
        {labels.exit}
      </button>
    </div>
  );
}
