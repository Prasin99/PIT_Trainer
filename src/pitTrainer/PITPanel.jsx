import React from 'react';
import { AirspeedDialClassic } from '../flightCore/instruments/AirspeedDialClassic';
import { AttitudeIndicator } from '../flightCore/instruments/AttitudeIndicator';
import { AltimeterDialClassic } from '../flightCore/instruments/AltimeterDialClassic';
import { TachometerDial } from '../flightCore/instruments/TachometerDial';
import { CompassDial } from '../flightCore/instruments/CompassDial';
import { VariometerDial } from '../flightCore/instruments/VariometerDial';
import { StopwatchDial } from '../flightCore/instruments/StopwatchDial';

const RIVET_POS = [
  { top: 14, left: 14 }, { top: 14, right: 14 },
  { bottom: 14, left: 14 }, { bottom: 14, right: 14 },
];

function Rivet({ style }) {
  return (
    <div
      style={{
        position: 'absolute', width: 14, height: 14, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #c7d0d6, #808a93 60%, #565f66)',
        boxShadow: 'inset 0 0 2px rgba(0,0,0,0.6)',
        ...style,
      }}
    />
  );
}

function Bezel({ size, children }) {
  const pad = Math.round(size * 0.05);
  const total = size + pad * 2;
  return (
    <div className="relative" style={{ width: total, height: total }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle at 38% 32%, #2b2b2b, #050505 68%)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.55)',
        }}
      />
      {RIVET_POS.map((p, i) => <Rivet key={i} style={p} />)}
      <div className="absolute" style={{ top: pad, left: pad }}>{children}</div>
    </div>
  );
}

/**
 * PIT (Panel Instrument Test) instrument panel — the classic 3x3 round-dial
 * cockpit layout: Speed / Artificial Horizon / Altitude on top, RPM /
 * Compass / Variometer in the middle, Stopwatch bottom-left. Styled to
 * match the grey riveted metal panel of the reference photo.
 */
export function PITPanel({
  speed = 120,
  heading = 0,
  altitude = 450,
  rpm = 19,
  vspeed = 0,
  elapsedSec = 0,
  pitch = 0,
  bank = 0,
  dialSize = 260,
  smallSize = 190,
}) {
  return (
    <div
      className="relative inline-block"
      style={{
        background: 'linear-gradient(155deg,#8b929b 0%,#767e88 45%,#6a7178 100%)',
        padding: '40px 48px 34px',
        borderBottom: '9px solid #6b4a2e',
      }}
    >
      <div className="grid grid-cols-3" style={{ columnGap: 56, rowGap: 30 }}>
        <div className="flex justify-center">
          <Bezel size={dialSize}><AirspeedDialClassic value={speed} size={dialSize} /></Bezel>
        </div>
        <div className="flex justify-center">
          <Bezel size={dialSize}><AttitudeIndicator pitch={pitch} bank={bank} size={dialSize} /></Bezel>
        </div>
        <div className="flex justify-center">
          <Bezel size={dialSize}><AltimeterDialClassic value={altitude} size={dialSize} /></Bezel>
        </div>

        <div className="flex justify-center items-start" style={{ paddingTop: (dialSize - smallSize) / 2 + 8 }}>
          <Bezel size={smallSize}><TachometerDial value={rpm} size={smallSize} /></Bezel>
        </div>
        <div className="flex justify-center">
          <Bezel size={dialSize}><CompassDial value={heading} size={dialSize} /></Bezel>
        </div>
        <div className="flex justify-center items-start" style={{ paddingTop: (dialSize - smallSize) / 2 + 8 }}>
          <Bezel size={dialSize}><VariometerDial value={vspeed} size={dialSize} /></Bezel>
        </div>

        <div className="flex justify-center items-start">
          <Bezel size={smallSize}><StopwatchDial value={elapsedSec} size={smallSize} /></Bezel>
        </div>
        <div />
        <div />
      </div>
    </div>
  );
}
