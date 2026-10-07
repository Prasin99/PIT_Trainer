import React, { useState } from 'react';
import { DEFAULT_COUNT, estimateDuration } from './instructions';
import { primeSpeech } from './speech';

/**
 * PIT (Panel Instrument Test) description / setup screen.
 * Layout follows the MIC Test setup screen; content describes the PIT panel.
 */

const TARGETS = [
  { title: 'Heading', value: 'as instructed', tol: '±5° green · ±10° yellow' },
  { title: 'Altitude', value: 'as instructed (start 3000 ft)', tol: '±20 ft green · ±50 ft yellow' },
  { title: 'Airspeed', value: '120 kt', tol: '±5 kt green · ±10 kt yellow' },
];

const INSTRUMENTS = [
  {
    title: 'Airspeed Indicator',
    tag: 'hold 120 kt',
    description:
      'Shows speed in knots. At constant RPM it rises when you descend and falls when you climb.',
    control: 'Throttle / Q·A · also reacts to climb & descent',
  },
  {
    title: 'Artificial Horizon',
    tag: 'rate of turn',
    description:
      'The sky/ground banks and the top triangle moves with your rate of turn. Triangle centred = no turn.',
    control: 'Stick L/R · ←→',
  },
  {
    title: 'Altimeter',
    tag: 'as instructed',
    description: 'Altitude in feet: the needle shows hundreds (one turn = 1,000 ft), the small window the thousands.',
    control: 'Stick fwd/back · ↑↓ (back = climb)',
  },
  {
    title: 'RPM Indicator',
    tag: 'engine',
    description: 'Shows the throttle setting. More RPM = more speed.',
    control: 'Throttle / Q·A',
  },
  {
    title: 'Compass',
    tag: 'as instructed',
    description: 'Shows your heading. It turns whenever the horizon is banked.',
    control: 'Stick L/R · ←→',
  },
  {
    title: 'Variometer',
    tag: 'vertical speed',
    description: 'Shows climb (up) or descent (down) in 100 ft/min. Zero = level flight.',
    control: 'Stick fwd/back · ↑↓',
  },
];

function InfoRow({ title, tag, description, control }) {
  return (
    <div className="border border-slate-200 rounded-lg bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-emerald-500" />
        <span className="font-semibold text-slate-900">{title}</span>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded uppercase whitespace-nowrap bg-emerald-50 text-emerald-700">
          {tag}
        </span>
      </div>
      <div className="text-xs text-slate-600 mt-1 leading-snug">{description}</div>
      <div className="text-xs font-mono text-slate-400 mt-1">{control}</div>
    </div>
  );
}

export function PITSetup({ onStart, onBack }) {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const est = estimateDuration(count);
  const minutes = Math.floor(est / 60);
  const seconds = String(est % 60).padStart(2, '0');

  return (
    <div className="min-h-screen xl:h-screen xl:overflow-hidden bg-slate-50 text-slate-900 p-3">
      <div className="relative bg-white border border-slate-200 rounded-xl shadow-sm xl:h-full px-6 py-5 flex flex-col">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-4 left-1/2 -translate-x-1/2 text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to menu
          </button>
        )}

        <header className="mb-3 pt-8">
          <h1 className="text-2xl font-bold text-slate-950">PIT Trainer</h1>
          <p className="text-slate-600 mt-1 text-sm">
            Panel Instrument Test — fly using the classic round-dial cockpit panel.
            Follow the heading, altitude and vertical-speed
            instructions, scan all instruments, and keep airspeed at 120 kt.
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_1fr] gap-6 xl:flex-1 xl:min-h-0 xl:pb-20 xl:overflow-y-auto">
          {/* Left side */}
          <section className="xl:min-h-0">
            <h2 className="font-semibold text-slate-800 mb-2">Your task</h2>
            <div className="space-y-2">
              {TARGETS.map((t) => (
                <div
                  key={t.title}
                  className="flex items-center justify-between gap-4 border border-slate-200 rounded px-4 py-1.5"
                >
                  <span className="text-slate-800">
                    <span className="font-semibold">{t.title}</span>:{' '}
                    <span className="font-bold">{t.value}</span>
                  </span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{t.tol}</span>
                </div>
              ))}
            </div>

            <h2 className="font-semibold text-slate-800 mt-5 mb-2">How the instruments work together</h2>
            <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
              <li>
                <span className="font-semibold text-slate-800">Instructions:</span> a new heading (or a turn such as
                "Turn right 360°"), altitude and vertical speed is given for a set time (e.g. 20 s). When the time is over, the next
                instruction follows. Choose <span className="font-semibold">Text</span> or{' '}
                <span className="font-semibold">Audio</span> at the top of the screen;{' '}
                <span className="font-semibold">View track</span> shows your track vs. the required one.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Turn:</span> stick left/right →
                horizon banks and the compass turns. Centre the triangle to stop the turn.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Climb / descend:</span> stick
                back/forward → altimeter and variometer move, and airspeed changes in the
                opposite direction (descend = faster, climb = slower).
              </li>
              <li>
                <span className="font-semibold text-slate-800">Power:</span> throttle → RPM and
                airspeed rise or fall together.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Stopwatch:</span> shows the elapsed session time.
              </li>
              <li>
                The aircraft drifts on its own — keep scanning and correct small deviations early.
              </li>
            </ul>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="font-semibold text-slate-800">
                  Number of instructions: <span className="font-bold">{count}</span>
                </label>
                <span className="text-sm text-slate-500">Session: about {minutes}:{seconds}</span>
              </div>
              <input
                type="range"
                min={8}
                max={24}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </section>

          {/* Right side */}
          <section className="xl:min-h-0">
            <h2 className="font-semibold text-slate-800">Instrument panel</h2>
            <p className="text-sm text-slate-500 mb-2">What each dial shows and how you control it</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {INSTRUMENTS.map((i) => (
                <InfoRow key={i.title} {...i} />
              ))}

              <div className="rounded-lg border border-blue-200 bg-blue-50 lg:col-span-2 px-4 py-3 text-sm text-blue-800">
                <p>
                  <span className="font-semibold">Recommended browser:</span> Google Chrome
                </p>
                <p>
                  <span className="font-semibold">Joystick:</span> click the page, then press any joystick button once.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 flex justify-center xl:mt-0 xl:absolute xl:left-0 xl:right-0 xl:bottom-5">
          <button
            type="button"
            onClick={() => { primeSpeech(); onStart({ instructionCount: count }); }}
            className="px-16 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base transition shadow"
          >
            ▶ Start
          </button>
        </div>
      </div>
    </div>
  );
}
