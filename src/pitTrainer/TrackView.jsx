import React, { useMemo } from 'react';
import { legMapLabel } from './instructions';

/**
 * Two maps in the style of the PIT flight-plan chart, side by side:
 *   1. Required track -- what the instructions asked for
 *   2. Your track     -- what the trainee actually flew
 *
 * Both are drawn as a thick band:
 *   solid           = level flight
 *   hatched/ladder  = climb
 *   open (white)    = descent
 * with a tick where each instruction starts and a label per instruction:
 *   required: "145° / 15″" (+ altitude change, e.g. "+230"), or "+270°" for turns
 *   flown:    the heading actually flown at the end of that instruction (or the
 *             turn actually made) and the actual altitude change.
 *
 * Props:
 *   required: [{x, y, leg, v}]        ideal positions in NM (x = east, y = north)
 *   flown:    [{x, y, leg, v, hdg, alt}] flown positions
 *   legs:     instruction legs
 *   frame:    optional points that define the map frame (e.g. the full
 *             required chart, so the frame is fixed from the start)
 *   width, height: size of EACH map
 *
 * Both maps use the SAME scale, so they can be compared directly.
 */
export function TrackView({ required = [], flown = [], legs = [], frame = null, width = 400, height = 420 }) {
    // Same SCALE on both maps (so distances compare directly), but each map
    // is centred on its own track so it fills its panel.
    const [reqToScreen, flownToScreen] = useMemo(() => {
        const bReq = boundsOf([frame || [], required]);
        const bFlown = boundsOf([flown]);
        const scale = Math.min(fitScale(bReq, width, height), fitScale(bFlown, width, height));
        return [projection(bReq, scale, width, height), projection(bFlown, scale, width, height)];
    }, [frame, required, flown, width, height]);

    const requiredMarks = useMemo(() => marksFor(required, (seg) => {
        const leg = legs[seg.leg];
        if (!leg) return null;
        return {
            label: legMapLabel(leg),
            sub: leg.altChange ? signed(leg.altChange) : null,
        };
    }), [required, legs]);

    const flownMarks = useMemo(() => marksFor(flown, (seg) => {
        const leg = legs[seg.leg];
        if (!leg) return null;
        const first = flown[seg.from];
        const last = flown[seg.to];
        let label;
        if (leg.type === 'turn') {
            // total turn actually made during this instruction
            let turned = 0;
            for (let i = seg.from + 1; i <= seg.to; i++) {
                turned += ((flown[i].hdg - flown[i - 1].hdg + 540) % 360) - 180;
            }
            label = `${turned >= 0 ? '+' : '−'}${Math.round(Math.abs(turned) / 5) * 5}°`;
        } else {
            label = `${String(Math.round(last.hdg) % 360).padStart(3, '0')}° / ${leg.duration}″`;
        }
        const change = Math.round((last.alt - first.alt) / 10) * 10;
        return { label, sub: Math.abs(change) >= 30 ? signed(change) : null };
    }), [flown, legs]);

    return (
        <div className="flex flex-wrap gap-3 justify-center">
            <MapPanel title="Required track" subtitle="from the instructions"
                points={required} marks={requiredMarks} width={width} height={height} ink="#111111" toScreen={reqToScreen} />
            <MapPanel title="Your track" subtitle="what you flew"
                points={flown} marks={flownMarks} width={width} height={height} ink="#1d4ed8" toScreen={flownToScreen} />
        </div>
    );
}

const signed = (n) => `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n))}`;

/** Split points into instruction segments and build a label for each. */
function marksFor(points, makeLabel) {
    const out = [];
    for (let i = 0; i < points.length; i++) {
        if (i === 0 || points[i - 1].leg !== points[i].leg) {
            let j = i;
            while (j + 1 < points.length && points[j + 1].leg === points[i].leg) j++;
            const seg = { leg: points[i].leg, from: i, to: j };
            const lab = makeLabel(seg);
            if (lab) out.push({ ...seg, mid: Math.floor((i + j) / 2), ...lab });
        }
    }
    return out;
}

const BAND = 11;            // band width (px)
const INNER = BAND - 4;     // white inside for climb/descent

const MAP_PAD = 40;

function boundsOf(lists) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const list of lists) {
        for (const p of list) {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
    }
    if (!Number.isFinite(minX)) { minX = maxX = minY = maxY = 0; }
    return { minX, maxX, minY, maxY };
}

function fitScale(b, width, height) {
    const spanX = Math.max(b.maxX - b.minX, 1);   // at least 1 NM so early tracks aren't blown up
    const spanY = Math.max(b.maxY - b.minY, 1);
    return Math.min((width - 2 * MAP_PAD) / spanX, (height - 2 * MAP_PAD - 30) / spanY);
}

/** North-up projection centred on bounds b (screen y grows downward). */
function projection(b, scale, width, height) {
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    return (p) => [width / 2 + (p.x - cx) * scale, height / 2 + 15 - (p.y - cy) * scale];
}

function MapPanel({ title, subtitle, points, marks, width, height, ink, toScreen }) {
    return (
        <div className="rounded-lg overflow-hidden border border-slate-300 bg-white" style={{ width }}>
            <div className="px-3 py-2 border-b border-slate-200 flex items-baseline gap-2">
                <span className="font-semibold text-slate-900">{title}</span>
                <span className="text-xs text-slate-500">{subtitle}</span>
            </div>
            <ChartMap points={points} marks={marks} width={width} height={height} ink={ink} toScreen={toScreen} />
        </div>
    );
}

function ChartMap({ points, marks, width, height, ink, toScreen }) {
    if (points.length < 2) {
        return (
            <div style={{ width, height }} className="flex items-center justify-center text-slate-400 text-sm">
                No track yet
            </div>
        );
    }

    const S = points.map((p) => toScreen(p));
    const pathOf = (arr) => arr.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

    // runs of the same vertical mode
    const runs = [];
    for (let i = 0; i < points.length; i++) {
        const v = points[i].v || 'level';
        const last = runs[runs.length - 1];
        if (!last || last.v !== v) runs.push({ v, pts: i > 0 ? [S[i - 1], S[i]] : [S[i]] });
        else last.pts.push(S[i]);
    }

    const dirAt = (i) => {
        const a = S[Math.max(0, i - 2)];
        const b = S[Math.min(S.length - 1, i + 2)];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        return [dx / len, dy / len];
    };

    const endIdx = S.length - 1;
    const [edx, edy] = dirAt(endIdx);
    const endAngle = Math.atan2(edx, -edy) * 180 / Math.PI;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block" style={{ overflow: 'hidden' }}>
            <rect x={0} y={0} width={width} height={height} fill="#ffffff" />

            {/* north arrow */}
            <g transform={`translate(${width - 18} 22)`}>
                <path d="M0 -10 L5 5 L0 2 L-5 5 Z" fill="#334155" />
                <text y={17} textAnchor="middle" fontSize={10} fontWeight={700} fill="#334155">N</text>
            </g>

            {/* band: outer ink for every run */}
            {runs.map((r, k) => r.pts.length > 1 && (
                <path key={`o${k}`} d={pathOf(r.pts)} fill="none" stroke={ink} strokeWidth={BAND}
                    strokeLinecap="butt" strokeLinejoin="round" />
            ))}
            {/* climb + descent: white inside; climb gets ladder rungs */}
            {runs.map((r, k) => r.pts.length > 1 && r.v !== 'level' && (
                <g key={`i${k}`}>
                    <path d={pathOf(r.pts)} fill="none" stroke="#ffffff" strokeWidth={INNER}
                        strokeLinecap="butt" strokeLinejoin="round" />
                    {r.v === 'climb' && (
                        <path d={pathOf(r.pts)} fill="none" stroke={ink} strokeWidth={INNER}
                            strokeDasharray="1.6 4" strokeLinecap="butt" strokeLinejoin="round" />
                    )}
                </g>
            ))}

            {/* start bar */}
            {(() => {
                const [dx, dy] = dirAt(0);
                const [x, y] = S[0];
                const n = [-dy, dx];
                return <line x1={x - n[0] * BAND} y1={y - n[1] * BAND} x2={x + n[0] * BAND} y2={y + n[1] * BAND} stroke={ink} strokeWidth={3} />;
            })()}

            {/* ticks + labels */}
            {marks.map(({ from, mid, label, sub, leg }) => {
                const [tdx, tdy] = dirAt(from);
                const [tx, ty] = S[from];
                const tn = [-tdy, tdx];
                const tick = from > 0 && (
                    <line x1={tx - tn[0] * (BAND + 3)} y1={ty - tn[1] * (BAND + 3)}
                        x2={tx + tn[0] * (BAND + 3)} y2={ty + tn[1] * (BAND + 3)} stroke={ink} strokeWidth={1.5} />
                );
                const [dx, dy] = dirAt(mid);
                const [mx, my] = S[mid];
                let ang = Math.atan2(dy, dx) * 180 / Math.PI;
                if (ang > 90) ang -= 180;
                if (ang < -90) ang += 180;
                const n = [-dy, dx];
                const side = n[1] > 0 ? -1 : 1; // prefer above the band
                const off = BAND + 9;
                const lx = mx + n[0] * off * side;
                const ly = my + n[1] * off * side;
                return (
                    <g key={leg}>
                        {tick}
                        <g transform={`translate(${lx} ${ly}) rotate(${ang})`}>
                            <text textAnchor="middle" fontSize={10.5} fontWeight={600} fill={ink}
                                stroke="#ffffff" strokeWidth={3} paintOrder="stroke" y={sub && side < 0 ? -6 : 0}>
                                {label}
                            </text>
                            {sub && (
                                <text textAnchor="middle" fontSize={10.5} fontWeight={600} fill={ink}
                                    stroke="#ffffff" strokeWidth={3} paintOrder="stroke" y={side < 0 ? 6 : 12}>
                                    {sub}
                                </text>
                            )}
                        </g>
                    </g>
                );
            })}

            {/* current / end position */}
            <g transform={`translate(${S[endIdx][0]} ${S[endIdx][1]}) rotate(${endAngle})`}>
                <path d="M0 -9 L6 7 L0 3 L-6 7 Z" fill={ink} stroke="#ffffff" strokeWidth={1} />
            </g>

            {/* legend */}
            <g transform="translate(12 14)" fontSize={10} fill="#334155">
                {[
                    ['level', 'Level'],
                    ['climb', 'Climb'],
                    ['descent', 'Descent'],
                ].map(([v, lab], i) => (
                    <g key={v} transform={`translate(${i * 68} 0)`}>
                        <line x1={0} y1={0} x2={22} y2={0} stroke={ink} strokeWidth={BAND - 3} />
                        {v !== 'level' && <line x1={0} y1={0} x2={22} y2={0} stroke="#fff" strokeWidth={INNER - 3} />}
                        {v === 'climb' && <line x1={0} y1={0} x2={22} y2={0} stroke={ink} strokeWidth={INNER - 3} strokeDasharray="1.6 4" />}
                        <text x={27} y={3.5}>{lab}</text>
                    </g>
                ))}
            </g>
        </svg>
    );
}
