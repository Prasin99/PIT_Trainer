import React from 'react';
import { TrackView } from './TrackView';

/**
 * PIT session summary. Layout follows the MIC Session Summary; rows are
 * the three PIT hold targets (altitude, heading, airspeed).
 */

function pct(samples, key, threshold) {
  const valid = (samples ?? []).filter((s) => Number.isFinite(s[key]));
  if (valid.length === 0) return 0;
  return Math.round((valid.filter((s) => s[key] <= threshold).length / valid.length) * 100);
}

function avg(samples, key) {
  const valid = (samples ?? []).filter((s) => Number.isFinite(s[key]));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, s) => sum + s[key], 0) / valid.length;
}

function formatDuration(seconds = 0) {
  const m = Math.floor(seconds / 60);
  const s = String(Math.round(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

export function PITSummary({ result, onTryAgain, onDone }) {
  if (!result || !result.samples) {
    return (
      <div className="w-screen h-screen bg-[#1a1a1a] text-white flex flex-col items-center justify-center gap-6">
        <h1 className="text-3xl font-bold">No result available</h1>
        <p className="text-slate-300">The session ended before a result was recorded.</p>
        <button
          onClick={onDone}
          className="px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
        >
          Back to Start
        </button>
      </div>
    );
  }

  const { duration, samples, tolerance = {}, targets = {}, legs = [], requiredTrack = [], flownTrack = [] } = result;
  const perInstruction = legs.length > 0;

  const rows = [
    { key: 'altitude', label: 'Altimeter', target: perInstruction ? 'per instruction' : `${Math.round(targets.altitude ?? 500)} ft`, devKey: 'altitudeDev', unit: 'ft', t: tolerance.altitude ?? { green: 20, yellow: 50 } },
    { key: 'heading', label: 'Compass (heading)', target: perInstruction ? 'per instruction' : `${String(Math.round(targets.heading ?? 0)).padStart(3, '0')}°`, devKey: 'headingDev', unit: 'degrees', t: tolerance.heading ?? { green: 5, yellow: 10 } },
    { key: 'speed', label: 'Airspeed', target: `${Math.round(targets.speed ?? 120)} kt`, devKey: 'speedDev', unit: 'kt', t: tolerance.speed ?? { green: 5, yellow: 10 } },
  ];

  const scored = rows.map((r) => ({
    ...r,
    average: avg(samples, r.devKey),
    green: pct(samples, r.devKey, r.t.green),
    yellow: pct(samples, r.devKey, r.t.yellow),
  }));

  const overallGreen = Math.round(scored.reduce((s, r) => s + r.green, 0) / scored.length);
  const overallYellow = Math.round(scored.reduce((s, r) => s + r.yellow, 0) / scored.length);

  return (
    <div className="w-screen min-h-screen bg-[#1a1a1a] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl p-8 shadow-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">PIT Session Summary</h1>
          <p className="text-slate-300 mt-2">
            Panel Instrument Test · Duration: {formatDuration(duration)}
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="text-sm text-slate-400">Overall in green</div>
            <div className="text-4xl font-bold text-green-400 mt-2">{overallGreen}%</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
            <div className="text-sm text-slate-400">Overall within yellow tolerance</div>
            <div className="text-4xl font-bold text-yellow-400 mt-2">{overallYellow}%</div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Instrument Performance</h2>
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-800 text-slate-300">
                <tr>
                  <th className="text-left p-3">Instrument</th>
                  <th className="text-right p-3">Target</th>
                  <th className="text-right p-3">Average deviation</th>
                  <th className="text-right p-3">In green</th>
                  <th className="text-right p-3">In yellow</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((r) => (
                  <tr key={r.key} className="border-t border-slate-700">
                    <td className="p-3 font-medium">{r.label}</td>
                    <td className="text-right p-3 text-slate-300">{r.target}</td>
                    <td className="text-right p-3">{r.average.toFixed(1)} {r.unit}</td>
                    <td className="text-right p-3 text-green-400 font-semibold">{r.green}%</td>
                    <td className="text-right p-3 text-yellow-400 font-semibold">{r.yellow}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Green: altitude ±{rows[0].t.green} ft · heading ±{rows[1].t.green}° · airspeed ±{rows[2].t.green} kt.
            Yellow: ±{rows[0].t.yellow} ft · ±{rows[1].t.yellow}° · ±{rows[2].t.yellow} kt.
          </p>
        </section>

        {perInstruction && requiredTrack.length > 1 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-1">Track</h2>
            <p className="text-sm text-slate-400 mb-4">
              Top: the track required by the {legs.length} instructions. Bottom: the track you flew
              (same scale, so you can compare them directly).
            </p>
            <div className="overflow-x-auto">
              <TrackView required={requiredTrack} flown={flownTrack} legs={legs} width={830} height={580} />
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-4 justify-end">
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
    </div>
  );
}
