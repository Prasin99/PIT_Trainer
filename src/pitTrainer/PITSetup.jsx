import React, { useState } from 'react';

/**
 * PIT (Panel Instrument Test) setup screen.
 *
 * Kept intentionally minimal for now — this module is being built up one
 * relationship at a time (see flightCore README). Duration is the only
 * control until the instrument-coupling rules are defined.
 */
export function PITSetup({ onStart, onBack }) {
  const [duration, setDuration] = useState(120);
  const minutes = Math.floor(duration / 60);
  const seconds = String(duration % 60).padStart(2, '0');

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 p-3">
      <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm h-full px-6 py-5 flex flex-col items-center justify-center gap-6">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to menu
          </button>
        )}

        <header className="text-center">
          <h1 className="text-2xl font-bold text-slate-950">PIT Trainer</h1>
          <p className="text-slate-600 mt-1 text-sm max-w-md">
            Panel Instrument Test — scan the round-dial cockpit panel (speed,
            attitude, altitude, RPM, compass, variometer, stopwatch) and keep
            every reading where it belongs.
          </p>
        </header>

        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <label className="font-semibold text-slate-800">
              Duration: <span className="font-bold">{minutes}:{seconds}</span>
            </label>
          </div>
          <input
            type="range"
            min={30}
            max={300}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </div>

        <button
          type="button"
          onClick={() => onStart({ duration })}
          className="px-16 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base transition shadow"
        >
          ▶ Start
        </button>
      </div>
    </div>
  );
}
