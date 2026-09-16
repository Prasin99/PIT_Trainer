import React from 'react';

export function PITSummary({ onTryAgain, onDone }) {
  return (
    <div className="w-screen h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center gap-8">
      <h1 className="text-3xl font-bold">Session Complete</h1>
      <p className="text-slate-300 max-w-md text-center">
        Scoring isn&apos;t wired up yet — this panel is still being built out
        instrument-relationship by instrument-relationship.
      </p>
      <div className="flex gap-4">
        <button
          onClick={onTryAgain}
          className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded transition"
        >
          Try Again
        </button>
        <button
          onClick={onDone}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
        >
          Back to Start
        </button>
      </div>
    </div>
  );
}
