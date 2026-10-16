// AUA-style instruction levels for the PIT trainer (Stufe 1, 2, 3).
//
// Built from the three AUA instruction lists (AUA_Instructions_Stufe1/2/3):
//   Level 1 -- level flight only: straight legs, relative turns, "shortest
//              way" traps, compass-direction questions, turns onto compass
//              points (headings mostly in tens).
//   Level 2 -- adds climb / descent: turns onto headings / compass points
//              with a phase and a time, big turns (>270°, >360°), full
//              circles split into phases, "climb until heading east",
//              altitude-triggered turns, reciprocal of a compass point,
//              chains of manoeuvres.
//   Level 3 -- the chart: printed headings are flown as their RECIPROCAL,
//              line type = phase (solid = level, ladder = climb, hollow =
//              descent), relative turns, "HR" = name the compass direction,
//              action boxes (three relative turns with arrow + seconds)
//              followed by "via N / via S / shortest way onto K".
//
// Every test generates new instructions in the style of the chosen level.
//
// Output: legs in the SAME format as instructions.js (so the flight model,
// required track, scoring and maps work unchanged), plus:
//   group  -- instruction number (0-based); one instruction can consist of
//             several segments (legs) that follow each other without a pause
//   cont   -- true for the 2nd, 3rd ... segment of an instruction
//   lead   -- index of the first segment of the instruction
//   text   -- { en, de } instruction as shown on screen
//   speech -- (lang, remainingSec) => sentence read aloud
//   ask    -- { answer } compass-direction question (index 0-15), or null
//   mapLabel -- label for the required-track map

import { START, GAP_SEC, IDEAL_TURN_RATE, stepIdeal } from './instructions';

export const LEVELS = [1, 2, 3];
export const LEVEL_RATE = 1000;            // ft/min for climb / descent when no rate is given
const ALT_LO = 2200;
const ALT_HI = 4800;
const TIMES = [10, 15, 20, 25, 30];

// ── 16-point compass ─────────────────────────────────────────────
export const POINTS = [
    ['N', 'N', 'north', 'Nord'],
    ['NNE', 'NNO', 'north north east', 'Nord-Nordost'],
    ['NE', 'NO', 'north east', 'Nordost'],
    ['ENE', 'ONO', 'east north east', 'Ost-Nordost'],
    ['E', 'O', 'east', 'Ost'],
    ['ESE', 'OSO', 'east south east', 'Ost-Südost'],
    ['SE', 'SO', 'south east', 'Südost'],
    ['SSE', 'SSO', 'south south east', 'Süd-Südost'],
    ['S', 'S', 'south', 'Süd'],
    ['SSW', 'SSW', 'south south west', 'Süd-Südwest'],
    ['SW', 'SW', 'south west', 'Südwest'],
    ['WSW', 'WSW', 'west south west', 'West-Südwest'],
    ['W', 'W', 'west', 'West'],
    ['WNW', 'WNW', 'west north west', 'West-Nordwest'],
    ['NW', 'NW', 'north west', 'Nordwest'],
    ['NNW', 'NNW', 'north north west', 'Nord-Nordwest'],
].map(([en, de, enWords, deWords], i) => ({ i, deg: i * 22.5, en, de, enWords, deWords }));

const wrap = (d) => ((d % 360) + 360) % 360;
const diff = (from, to) => ((to - from + 540) % 360) - 180;     // shortest signed turn
const fmt = (h) => `${String(Math.round(wrap(h)) % 360).padStart(3, '0')}°`;
const nearestPoint = (h) => Math.round(wrap(h) / 22.5) % 16;
const recip = (h) => wrap(h + 180);
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const between = (lo, hi, step, rng) => lo + Math.floor(rng() * ((hi - lo) / step + 1)) * step;
const turnSecs = (deg) => Math.ceil(Math.abs(deg) / IDEAL_TURN_RATE);

/** Signed turn from `from` to `to` in a given direction (+1 right, -1 left). */
function dirTurn(from, to, dir) {
    const r = wrap(to - from);
    if (dir > 0) return r === 0 ? 360 : r;
    return r === 0 ? -360 : r - 360;
}

/** Signed turn from `from` to `to` that passes over north (0°) or south (180°). */
function viaTurn(from, to, via) {
    const right = dirTurn(from, to, 1);
    const left = dirTurn(from, to, -1);
    const crosses = (start, turn) => {
        // does the path start -> start+turn pass the point `via`?
        const off = turn > 0 ? wrap(via - start) : wrap(start - via);
        return off > 0 && off < Math.abs(turn);
    };
    return crosses(from, right) ? right : left;
}

// ── spoken numbers ───────────────────────────────────────────────
const DIG_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
const DIG_DE = ['null', 'eins', 'zwo', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const sayHdg = (h, lang) => String(Math.round(wrap(h)) % 360).padStart(3, '0').split('')
    .map((d) => (lang === 'de' ? DIG_DE : DIG_EN)[Number(d)]).join(' ');

// ── words ────────────────────────────────────────────────────────
const W = {
    en: {
        left: 'left', right: 'right', Left: 'Left', Right: 'Right',
        level: 'level flight', climb: 'climb', descent: 'descent',
        Level: 'Level flight', Climb: 'Climb', Descent: 'Descent',
        climbing: 'climbing', descending: 'descending', levelAdj: 'level',
        s: 's', secs: 'seconds', deg: 'degrees',
    },
    de: {
        left: 'links', right: 'rechts', Left: 'Links', Right: 'Rechts',
        level: 'Horizontalflug', climb: 'Steigflug', descent: 'Sinkflug',
        Level: 'Horizontalflug', Climb: 'Steigflug', Descent: 'Sinkflug',
        climbing: 'Steigflug', descending: 'Sinkflug', levelAdj: 'Horizontal',
        s: 's', secs: 'Sekunden', deg: 'Grad',
    },
};
const ARROW = { level: '→', climb: '↗', descent: '↘' };
const dirKey = (turn) => (turn > 0 ? 'right' : 'left');
const DirKey = (turn) => (turn > 0 ? 'Right' : 'Left');

/** Text + speech for both languages from one builder f(lang, w). */
function both(f) { return { en: f('en', W.en), de: f('de', W.de) }; }

// ── vertical phase choice (keeps the aircraft between 2200 and 4800 ft) ──
function feasible(v, alt, secs) {
    const ch = (LEVEL_RATE * secs) / 60;
    if (v === 'climb') return alt + ch <= ALT_HI;
    if (v === 'descent') return alt - ch >= ALT_LO;
    return true;
}
function pickVert(ctx, secs, options = ['level', 'climb', 'descent']) {
    const ok = options.filter((v) => feasible(v, ctx.alt, secs));
    return ok.length ? pick(ok, ctx.rng) : 'level';
}
function otherVert(ctx, v, secs) {
    return pickVert(ctx, secs, ['level', 'climb', 'descent'].filter((x) => x !== v));
}

// ── segments ─────────────────────────────────────────────────────
// A segment: { turn (signed deg, 0 = hold heading), vert, secs, timed }.
// Segments are applied to ctx (heading / altitude) as they are created.
function seg(ctx, { turn = 0, vert = 'level', secs, timed = false, altChange = null }) {
    const minSecs = turnSecs(turn) + (timed ? 3 : 1);
    let s = Math.max(secs ?? 0, minSecs);
    if (timed) s = Math.ceil(s / 5) * 5;          // announced times are whole 5 s (10, 15, 20 ...)
    const change = altChange ?? (vert === 'level' ? 0 : ((vert === 'climb' ? 1 : -1) * LEVEL_RATE * s) / 60);
    const out = { turn, vert, secs: s, timed, startHdg: ctx.h, startAlt: ctx.alt, altitude: ctx.alt + change };
    ctx.h = wrap(ctx.h + turn);
    ctx.alt += change;
    return out;
}
/** Shortest time from TIMES that leaves room for the turn. */
function timeFor(ctx, turn) {
    const need = turnSecs(turn) + 3;
    const ok = TIMES.filter((t) => t >= need);
    return ok.length ? pick(ok.slice(0, 3), ctx.rng) : Math.ceil(need / 5) * 5;
}
/** A heading "in tens" (90 %) or any whole degree (10 %), 30-150° away from h. */
function newHeading(ctx, minTurn = 30, maxTurn = 150, dir = null) {
    const d = dir ?? (ctx.rng() < 0.5 ? 1 : -1);
    const amt = ctx.rng() < 0.9 ? between(minTurn, maxTurn, 10, ctx.rng) : between(minTurn, maxTurn, 1, ctx.rng);
    return { target: ctx.rng() < 0.9 ? Math.round(wrap(ctx.h + d * amt) / 10) * 10 : Math.round(wrap(ctx.h + d * amt)), dir: d };
}

// ═════════════════════════════════════════════════════════════════
// Instruction builders. Each returns { text, say, segs, mapLabel, ask }.
//   say: (lang, remainingSec|null) => sentence
// ═════════════════════════════════════════════════════════════════

function firstStraight(ctx, level) {
    const n = ctx.rng() < 0.5 ? 15 : 20;
    const c = recip(ctx.h);
    const segs = [seg(ctx, { secs: n, timed: true })];
    if (level === 3) {
        return {
            segs, mapLabel: `${fmt(c)}/${n}″`,
            text: both((l, w) => (l === 'de' ? `Start: Karte ${fmt(c)} / ${n}″ · ${w.level}` : `Start: chart ${fmt(c)} / ${n}″ · ${w.level}`)),
            say: (l, rem) => (l === 'de'
                ? `Start. Kartenkurs ${sayHdg(c, l)}. ${timeSay(l, n, rem)} Horizontalflug.`
                : `Start. Chart heading ${sayHdg(c, l)}. ${timeSay(l, n, rem)} Level flight.`),
        };
    }
    if (level === 2) {
        return {
            segs, mapLabel: `→ ${n}″`,
            text: both((l) => (l === 'de' ? `Horizontalflug, geradeaus, ${n} s` : `Level flight, straight ahead, ${n} s`)),
            say: (l, rem) => (l === 'de' ? `Horizontalflug, geradeaus. ${timeSay(l, n, rem)}` : `Level flight, straight ahead. ${timeSay(l, n, rem)}`),
        };
    }
    return {
        segs, mapLabel: `→ ${n}″`,
        text: both((l) => (l === 'de' ? `${n} s geradeaus` : `${n} s straight ahead`)),
        say: (l, rem) => (rem == null
            ? (l === 'de' ? `${n} Sekunden geradeaus.` : `${n} seconds straight ahead.`)
            : timeSay(l, n, rem)),
    };
}

/** "For N seconds." -- or the time left when repeated. */
function timeSay(l, n, rem) {
    if (rem == null) return l === 'de' ? `${n} Sekunden.` : `${n} seconds.`;
    if (rem <= 0) return '';
    return l === 'de' ? `Noch ${rem} Sekunden.` : `${rem} more seconds.`;
}

// ── Level 1 ──────────────────────────────────────────────────────
const L1 = {
    straight(ctx) {
        const n = pick([10, 15, 20], ctx.rng);
        const segs = [seg(ctx, { secs: n, timed: true })];
        return {
            segs, mapLabel: `→ ${n}″`,
            text: both((l) => (l === 'de' ? `${n} s geradeaus` : `${n} s straight ahead`)),
            say: (l, rem) => (rem == null ? (l === 'de' ? `${n} Sekunden geradeaus.` : `${n} seconds straight ahead.`) : timeSay(l, n, rem)),
        };
    },
    relThenStraight(ctx) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        const x = ctx.rng() < 0.9 ? between(30, 150, 10, ctx.rng) : between(25, 150, 5, ctx.rng);
        const n = pick([10, 15, 20], ctx.rng);
        const segs = [seg(ctx, { turn: d * x }), seg(ctx, { secs: n, timed: true })];
        return {
            segs, mapLabel: `${d > 0 ? '+' : '−'}${x}° /${n}″`,
            text: both((l, w) => (l === 'de'
                ? `Drehen Sie ${x}° nach ${w[dirKey(d)]}, dann ${n} s geradeaus`
                : `Turn ${x}° to the ${w[dirKey(d)]}, then ${n} s straight ahead`)),
            say: (l, rem) => {
                const w = W[l];
                if (rem != null) return timeSay(l, n, rem);
                return l === 'de'
                    ? `Drehen Sie ${x} Grad nach ${w[dirKey(d)]}, dann ${n} Sekunden geradeaus.`
                    : `Turn ${x} degrees to the ${w[dirKey(d)]}, then ${n} seconds straight ahead.`;
            },
        };
    },
    trap(ctx) {
        // "turn onto the heading that is D° lower/higher, the shortest way" --
        // with D > 180 the shortest way is the OTHER direction (the trap).
        const lower = ctx.rng() < 0.5;
        const D = ctx.rng() < 0.75 ? between(190, 240, 10, ctx.rng) : between(40, 160, 10, ctx.rng);
        const target = wrap(ctx.h + (lower ? -D : D));
        const segs = [seg(ctx, { turn: diff(ctx.h, target) })];
        return {
            segs, mapLabel: `${lower ? '−' : '+'}${D}° (shortest)`,
            text: both((l) => (l === 'de'
                ? `Drehen Sie auf den um ${D}° ${lower ? 'geringeren' : 'höheren'} Kurs, auf kürzestem Weg`
                : `Turn onto the heading ${D}° ${lower ? 'lower' : 'higher'}, the shortest way`)),
            say: (l) => (l === 'de'
                ? `Achtung. Drehen Sie auf den um ${D} Grad ${lower ? 'geringeren' : 'höheren'} Kurs, auf kürzestem Weg.`
                : `Attention. Turn onto the heading ${D} degrees ${lower ? 'lower' : 'higher'}, the shortest way.`),
        };
    },
    askCurrent(ctx) {
        const p = nearestPoint(ctx.h);
        if (Math.abs(diff(POINTS[p].deg, ctx.h)) > 6) return null;   // not clearly one direction
        const h = Math.round(ctx.h);
        const segs = [seg(ctx, { secs: 10 })];
        return {
            segs, mapLabel: '?', ask: { answer: p },
            text: both((l) => (l === 'de' ? `Aktueller Kurs ${fmt(h)} – welche Himmelsrichtung?` : `Current heading ${fmt(h)} – which compass direction?`)),
            say: (l) => (l === 'de'
                ? `Aktueller Kurs ${sayHdg(h, l)}. Welche Himmelsrichtung?`
                : `Current heading ${sayHdg(h, l)}. Which compass direction?`),
        };
    },
    turnAndName(ctx) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        // land exactly on one of the 8 main points, 30-150° away
        const opts = [0, 45, 90, 135, 180, 225, 270, 315].filter((t) => {
            const a = Math.abs(dirTurn(ctx.h, t, d));
            return a >= 30 && a <= 150;
        });
        if (!opts.length) return null;
        const target = pick(opts, ctx.rng);
        const turn = dirTurn(ctx.h, target, d);
        const x = Math.round(Math.abs(turn));
        const segs = [seg(ctx, { turn }), seg(ctx, { secs: 6 })];
        return {
            segs, mapLabel: `${d > 0 ? '+' : '−'}${x}° HR`, ask: { answer: nearestPoint(target) },
            text: both((l, w) => (l === 'de'
                ? `Drehen Sie ${x}° nach ${w[dirKey(d)]} und nennen Sie die Himmelsrichtung`
                : `Turn ${x}° to the ${w[dirKey(d)]} and name the compass direction`)),
            say: (l) => {
                const w = W[l];
                return l === 'de'
                    ? `Fliegen Sie ${x} Grad nach ${w[dirKey(d)]} und nennen Sie die Himmelsrichtung.`
                    : `Turn ${x} degrees to the ${w[dirKey(d)]} and name the compass direction.`;
            },
        };
    },
    ontoPoint(ctx) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        const opts = POINTS.filter((p) => { const a = Math.abs(dirTurn(ctx.h, p.deg, d)); return a >= 30 && a <= 240; });
        const p = pick(opts, ctx.rng);
        const segs = [seg(ctx, { turn: dirTurn(ctx.h, p.deg, d) })];
        return {
            segs, mapLabel: `${d > 0 ? 'R' : 'L'} ${p.en}`,
            text: both((l) => (l === 'de' ? `${d > 0 ? 'Rechtskurve' : 'Linkskurve'} auf ${p.de}` : `${d > 0 ? 'Right' : 'Left'} turn onto ${p.en}`)),
            say: (l) => (l === 'de' ? `${d > 0 ? 'Rechtskurve' : 'Linkskurve'} auf ${p.deWords}.` : `${d > 0 ? 'Right' : 'Left'} turn onto ${p.enWords}.`),
        };
    },
};
const L1_WEIGHTS = [['straight', 2], ['relThenStraight', 3], ['trap', 1], ['askCurrent', 1], ['turnAndName', 1.5], ['ontoPoint', 1.5]];

// ── Level 2 ──────────────────────────────────────────────────────
const phaseText = (l, v) => W[l][v];
const L2 = {
    straightPhase(ctx) {
        const n = pick([15, 20, 30], ctx.rng);
        const v = pickVert(ctx, n);
        const segs = [seg(ctx, { vert: v, secs: n, timed: true })];
        return {
            segs, mapLabel: `→ ${n}″`,
            text: both((l, w) => (l === 'de' ? `${w[v[0].toUpperCase() + v.slice(1)]}, geradeaus, ${n} s` : `${w[v[0].toUpperCase() + v.slice(1)]}, straight ahead, ${n} s`)),
            say: (l, rem) => `${W[l][v[0].toUpperCase() + v.slice(1)]}, ${l === 'de' ? 'geradeaus' : 'straight ahead'}. ${timeSay(l, n, rem)}`,
        };
    },
    dirOntoHeading(ctx) {
        const { target, dir } = newHeading(ctx, 30, ctx.rng() < 0.25 ? 250 : 150);
        const turn = dirTurn(ctx.h, target, dir);
        const n = timeFor(ctx, turn);
        const v = pickVert(ctx, n);
        const segs = [seg(ctx, { turn, vert: v, secs: n, timed: true })];
        return {
            segs, mapLabel: `${dir > 0 ? 'R' : 'L'} ${fmt(target)}/${n}″`,
            text: both((l, w) => `${w[DirKey(dir)]} ${l === 'de' ? 'auf' : 'onto'} ${fmt(target)}, ${n} s ${phaseText(l, v)}`),
            say: (l, rem) => (rem != null ? `${timeSay(l, n, rem)} ${phaseText(l, v)}.`
                : `${W[l][DirKey(dir)]} ${l === 'de' ? 'auf' : 'onto'} ${sayHdg(target, l)}. ${n} ${W[l].secs} ${phaseText(l, v)}.`),
        };
    },
    dirOntoPoint(ctx) {
        const dir = ctx.rng() < 0.5 ? 1 : -1;
        const opts = POINTS.filter((p) => { const a = Math.abs(dirTurn(ctx.h, p.deg, dir)); return a >= 30 && a <= 250; });
        const p = pick(opts, ctx.rng);
        const turn = dirTurn(ctx.h, p.deg, dir);
        const n = timeFor(ctx, turn);
        const v = pickVert(ctx, n);
        const segs = [seg(ctx, { turn, vert: v, secs: n, timed: true })];
        return {
            segs, mapLabel: `${dir > 0 ? 'R' : 'L'} ${p.en}/${n}″`,
            text: both((l, w) => `${w[DirKey(dir)]} ${l === 'de' ? 'auf' : 'onto'} ${l === 'de' ? p.de : p.en}, ${n} s ${phaseText(l, v)}`),
            say: (l, rem) => (rem != null ? `${timeSay(l, n, rem)} ${phaseText(l, v)}.`
                : `${W[l][DirKey(dir)]} ${l === 'de' ? 'auf' : 'onto'} ${l === 'de' ? p.deWords : p.enWords}. ${n} ${W[l].secs} ${phaseText(l, v)}.`),
        };
    },
    shortestOnto(ctx) {
        const usePoint = ctx.rng() < 0.5;
        let target; let label; let words;
        if (usePoint) {
            const opts = POINTS.filter((p) => Math.abs(diff(ctx.h, p.deg)) >= 40);
            const p = pick(opts, ctx.rng);
            target = p.deg; label = { en: p.en, de: p.de }; words = { en: p.enWords, de: p.deWords };
        } else {
            target = newHeading(ctx, 40, 175).target;
            label = { en: fmt(target), de: fmt(target) }; words = { en: sayHdg(target, 'en'), de: sayHdg(target, 'de') };
        }
        const turn = diff(ctx.h, target);
        const n = timeFor(ctx, turn);
        const v = pickVert(ctx, n);
        const segs = [seg(ctx, { turn, vert: v, secs: n, timed: true })];
        const tail = (l) => (v === 'level' ? (l === 'de' ? 'geradeaus' : 'straight ahead') : phaseText(l, v));
        return {
            segs, mapLabel: `→${label.en}/${n}″`,
            text: both((l) => (l === 'de' ? `Auf schnellstem Weg nach ${label.de}, ${n} s ${tail(l)}` : `Fastest way to ${label.en}, ${n} s ${tail(l)}`)),
            say: (l, rem) => (rem != null ? `${timeSay(l, n, rem)} ${tail(l)}.`
                : (l === 'de' ? `Auf schnellstem Weg nach ${words.de}. ${n} Sekunden ${tail(l)}.` : `Fastest way to ${words.en}. ${n} seconds ${tail(l)}.`)),
        };
    },
    bigTurn(ctx) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        const x = ctx.rng() < 0.6 ? between(280, 340, 1, ctx.rng) : between(380, 460, 10, ctx.rng);
        const segs = [seg(ctx, { turn: d * x })];
        return {
            segs, mapLabel: `${d > 0 ? '+' : '−'}${x}°`,
            text: both((l) => (l === 'de' ? `${d > 0 ? 'Rechtskurve' : 'Linkskurve'} um ${x}°` : `${d > 0 ? 'Right' : 'Left'} turn by ${x}°`)),
            say: (l) => (l === 'de' ? `${d > 0 ? 'Rechtskurve' : 'Linkskurve'} um ${x} Grad.` : `${d > 0 ? 'Right' : 'Left'} turn by ${x} degrees.`),
        };
    },
    relThenPhase(ctx) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        const x = ctx.rng() < 0.7 ? between(30, 120, 10, ctx.rng) : between(25, 120, 5, ctx.rng);
        const n = pick([10, 15, 20], ctx.rng);
        const s1 = seg(ctx, { turn: d * x });
        const v = pickVert(ctx, n, ['climb', 'descent']);
        const segs = [s1, seg(ctx, { vert: v, secs: n, timed: true })];
        const verb = (l) => (l === 'de' ? (v === 'climb' ? 'steigen' : v === 'descent' ? 'sinken' : 'horizontal fliegen') : (v === 'climb' ? 'climb' : v === 'descent' ? 'descend' : 'fly level'));
        return {
            segs, mapLabel: `${d > 0 ? '+' : '−'}${x}° /${n}″`,
            text: both((l, w) => (l === 'de' ? `Drehen Sie ${x}° nach ${w[dirKey(d)]}, ${verb(l)} Sie dann ${n} s` : `Turn ${x}° to the ${w[dirKey(d)]}, then ${verb(l)} ${n} s`)),
            say: (l, rem) => (rem != null ? timeSay(l, n, rem)
                : (l === 'de' ? `Drehen Sie ${x} Grad nach ${W[l][dirKey(d)]}, ${verb(l)} Sie dann ${n} Sekunden.` : `Turn ${x} degrees to the ${W[l][dirKey(d)]}, then ${verb(l)} ${n} seconds.`)),
        };
    },
    fullCircle(ctx) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        const half = turnSecs(180) + 1;
        const v1 = pickVert(ctx, half, ['climb', 'descent', 'level']);
        const s1 = seg(ctx, { turn: d * 180, vert: v1 });
        const v2 = otherVert(ctx, v1, half);
        const segs = [s1, seg(ctx, { turn: d * 180, vert: v2 })];
        const adj = (l, v) => (l === 'de' ? W.de[v] : v === 'level' ? 'level' : v === 'climb' ? 'climbing' : 'descending');
        return {
            segs, mapLabel: `${d > 0 ? '+' : '−'}360°`,
            text: both((l, w) => (l === 'de'
                ? `Vollkreis nach ${w[dirKey(d)]}, erste 180° ${adj(l, v1)}, zweite 180° ${adj(l, v2)}`
                : `Full circle to the ${w[dirKey(d)]}, first 180° ${adj(l, v1)}, second 180° ${adj(l, v2)}`)),
            say: (l) => (l === 'de'
                ? `Vollkreis nach ${W[l][dirKey(d)]}. Erste 180 Grad ${adj(l, v1)}, zweite 180 Grad ${adj(l, v2)}.`
                : `Full circle to the ${W[l][dirKey(d)]}. First 180 degrees ${adj(l, v1)}, second 180 degrees ${adj(l, v2)}.`),
        };
    },
    halfSplit(ctx) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        const q = turnSecs(90) + 1;
        const v1 = pickVert(ctx, q, ['climb', 'descent']);
        const s1 = seg(ctx, { turn: d * 90, vert: v1 });
        const v2 = otherVert(ctx, v1, q);
        const s2 = seg(ctx, { turn: d * 90, vert: v2 });
        const n = 10;
        const segs = [s1, s2, seg(ctx, { secs: n, timed: true })];
        return {
            segs, mapLabel: `${d > 0 ? '+' : '−'}180°`,
            text: both((l, w) => (l === 'de'
                ? `180°-Kurve nach ${w[dirKey(d)]}, erste 90° ${w[v1]}, zweite 90° ${w[v2]}, dann ${n} s geradeaus`
                : `180° turn to the ${w[dirKey(d)]}, first 90° ${w[v1]}, second 90° ${w[v2]}, then ${n} s straight ahead`)),
            say: (l, rem) => (rem != null ? timeSay(l, n, rem) : (l === 'de'
                ? `180 Grad Kurve nach ${W[l][dirKey(d)]}. Erste 90 Grad ${W[l][v1]}, zweite 90 Grad ${W[l][v2]}, dann ${n} Sekunden geradeaus.`
                : `180 degree turn to the ${W[l][dirKey(d)]}. First 90 degrees ${W[l][v1]}, second 90 degrees ${W[l][v2]}, then ${n} seconds straight ahead.`)),
        };
    },
    untilHeading(ctx) {
        const opts = POINTS.filter((p) => p.i % 2 === 0 && Math.abs(diff(ctx.h, p.deg)) >= 60 && Math.abs(diff(ctx.h, p.deg)) <= 150);
        if (!opts.length) return null;
        const p = pick(opts, ctx.rng);
        const turn = diff(ctx.h, p.deg);
        const v = pickVert(ctx, turnSecs(turn) + 1, ['climb', 'descent']);
        if (v === 'level') return null;
        const segs = [seg(ctx, { turn, vert: v }), seg(ctx, { secs: 5 })];
        return {
            segs, mapLabel: `→ ${p.en}`,
            text: both((l) => (l === 'de'
                ? `${v === 'climb' ? 'Steigen' : 'Sinken'} Sie bis Kurs ${p.de}, dann horizontal`
                : `${v === 'climb' ? 'Climb' : 'Descend'} until heading ${p.en}, then level`)),
            say: (l) => (l === 'de'
                ? `${v === 'climb' ? 'Steigen' : 'Sinken'} Sie bis Kurs ${p.deWords}, dann horizontal.`
                : `${v === 'climb' ? 'Climb' : 'Descend'} until heading ${p.enWords}, then level.`),
        };
    },
    altitudeEvent(ctx) {
        const total = pick([400, 500, 600], ctx.rng);
        const half = total / 2;
        const v = feasible('descent', ctx.alt, (total / LEVEL_RATE) * 60) && ctx.rng() < 0.6 ? 'descent'
            : feasible('climb', ctx.alt, (total / LEVEL_RATE) * 60) ? 'climb' : null;
        if (!v) return null;
        const halfSecs = Math.round((half / LEVEL_RATE) * 60);
        const d1 = ctx.rng() < 0.5 ? 1 : -1;
        const a1 = between(40, Math.min(140, (halfSecs - 1) * IDEAL_TURN_RATE), 10, ctx.rng);
        const h1 = Math.round(wrap(ctx.h + d1 * a1) / 10) * 10;
        const t1 = dirTurn(ctx.h, h1, d1);
        const sign = v === 'climb' ? 1 : -1;
        const s1 = seg(ctx, { turn: t1, vert: v, secs: halfSecs, altChange: sign * half });
        const d2 = -d1;
        const a2 = between(60, 170, 10, ctx.rng);
        const h2 = Math.round(wrap(ctx.h + d2 * a2) / 10) * 10;
        const t2 = dirTurn(ctx.h, h2, d2);
        const s2 = seg(ctx, { turn: t2, vert: v, secs: halfSecs, altChange: sign * half });
        // the ideal climbs/descends at LEVEL_RATE until the change is done
        s1.vs = LEVEL_RATE; s2.vs = LEVEL_RATE;
        const verbEn = v === 'climb' ? 'climb' : 'descend';
        const verbDe = v === 'climb' ? 'steigen' : 'sinken';
        return {
            segs: [s1, s2], mapLabel: `${sign > 0 ? '+' : '−'}${total}ft`,
            text: both((l, w) => (l === 'de'
                ? `${w[DirKey(d1)]} auf ${fmt(h1)}, ${total} ft ${verbDe}, nach ${half} ft ${d2 > 0 ? 'Rechtskurve' : 'Linkskurve'} auf ${fmt(h2)} einleiten`
                : `${w[DirKey(d1)]} onto ${fmt(h1)}, ${verbEn} ${total} ft, after ${half} ft start a ${w[dirKey(d2)]} turn onto ${fmt(h2)}`)),
            say: (l) => (l === 'de'
                ? `${W[l][DirKey(d1)]} auf ${sayHdg(h1, l)}, ${total} Fuß ${verbDe}. Nach ${half} Fuß ${d2 > 0 ? 'Rechtskurve' : 'Linkskurve'} auf ${sayHdg(h2, l)} einleiten.`
                : `${W[l][DirKey(d1)]} onto ${sayHdg(h1, l)}, ${verbEn} ${total} feet. After ${half} feet start a ${W[l][dirKey(d2)]} turn onto ${sayHdg(h2, l)}.`),
        };
    },
    reciprocalPoint(ctx) {
        const dir = ctx.rng() < 0.5 ? 1 : -1;
        const opts = POINTS.filter((p) => { const a = Math.abs(dirTurn(ctx.h, recip(p.deg), dir)); return a >= 30 && a <= 220; });
        const p = pick(opts, ctx.rng);
        const turn = dirTurn(ctx.h, recip(p.deg), dir);
        const n = timeFor(ctx, turn);
        const v = pickVert(ctx, n);
        const segs = [seg(ctx, { turn, vert: v, secs: n, timed: true })];
        return {
            segs, mapLabel: `${dir > 0 ? 'R' : 'L'} GK ${p.en}/${n}″`,
            text: both((l, w) => (l === 'de'
                ? `${w[DirKey(dir)]} auf den Gegenkurs von ${p.de}, ${n} s ${w[v]}`
                : `${w[DirKey(dir)]} onto the reciprocal of ${p.en}, ${n} s ${w[v]}`)),
            say: (l, rem) => (rem != null ? `${timeSay(l, n, rem)} ${W[l][v]}.` : (l === 'de'
                ? `${W[l][DirKey(dir)]} auf den Gegenkurs von ${p.deWords}. ${n} Sekunden ${W[l][v]}.`
                : `${W[l][DirKey(dir)]} onto the reciprocal of ${p.enWords}. ${n} seconds ${W[l][v]}.`)),
        };
    },
    chain(ctx) {
        const n = pick([15, 20], ctx.rng);
        const s1 = seg(ctx, { secs: n, timed: true });
        const d2 = ctx.rng() < 0.5 ? 1 : -1;
        const x2 = between(60, 120, 10, ctx.rng);
        const v2 = pickVert(ctx, turnSecs(x2) + 1, ['climb', 'descent']);
        const s2 = seg(ctx, { turn: d2 * x2, vert: v2 });
        const d3 = -d2;
        const x3 = between(60, 150, 10, ctx.rng);
        const s3 = seg(ctx, { turn: d3 * x3 });
        const adj = (l, v) => (l === 'de' ? W.de[v] : v === 'climb' ? 'climbing' : v === 'descent' ? 'descending' : 'level');
        return {
            segs: [s1, s2, s3], mapLabel: `→ ${n}″ …`,
            text: both((l, w) => (l === 'de'
                ? `Horizontalflug geradeaus ${n} s, ${w[v2]} ${w[dirKey(d2)]} ${x2}°, Horizontalflug ${w[dirKey(d3)]} ${x3}°`
                : `Level flight straight ${n} s, ${adj(l, v2)} ${w[dirKey(d2)]} turn ${x2}°, level flight ${w[dirKey(d3)]} ${x3}°`)),
            say: (l, rem) => (rem != null ? timeSay(l, n, rem) : (l === 'de'
                ? `Horizontalflug geradeaus ${n} Sekunden. ${W[l][v2]} ${W[l][dirKey(d2)]} ${x2} Grad. Horizontalflug ${W[l][dirKey(d3)]} ${x3} Grad.`
                : `Level flight straight ${n} seconds. ${adj(l, v2)} ${W[l][dirKey(d2)]} turn ${x2} degrees. Level flight ${W[l][dirKey(d3)]} ${x3} degrees.`)),
        };
    },
};
const L2_WEIGHTS = [['straightPhase', 2], ['dirOntoHeading', 2.5], ['dirOntoPoint', 1.5], ['shortestOnto', 1.5], ['bigTurn', 1],
['relThenPhase', 1.5], ['fullCircle', 0.8], ['halfSplit', 0.8], ['untilHeading', 1], ['altitudeEvent', 0.8], ['reciprocalPoint', 1.2], ['chain', 0.8]];

// ── Level 3 (chart) ──────────────────────────────────────────────
const SYMBOL = { en: { level: 'level', climb: 'climb', descent: 'descent' }, de: { level: 'Horizontal', climb: 'Steigflug', descent: 'Sinkflug' } };
const signed = (x) => `${x > 0 ? '+' : '−'}${Math.abs(x)}°`;
const saySigned = (x, l) => `${x > 0 ? (l === 'de' ? 'Plus' : 'Plus') : (l === 'de' ? 'Minus' : 'Minus')} ${Math.abs(x)} ${W[l].deg}`;
const HR_TEXT = { en: ' · HR (name the compass direction)', de: ' · HR (Himmelsrichtung ansagen)' };
const HR_SAY = { en: ' Name the compass direction.', de: ' Himmelsrichtung ansagen.' };

const L3 = {
    chartHeading(ctx, { hr = false, via = null } = {}) {
        // printed heading C; the aircraft flies the reciprocal
        let target;
        if (hr) {
            const opts = POINTS.filter((p) => Math.abs(diff(ctx.h, p.deg)) >= 30 && Math.abs(diff(ctx.h, p.deg)) <= (via ? 300 : 150));
            target = wrap(pick(opts, ctx.rng).deg + between(-2, 2, 1, ctx.rng));
            target = Math.round(target);
        } else {
            target = Math.round(wrap(ctx.h + (ctx.rng() < 0.5 ? 1 : -1) * between(30, via ? 300 : 150, 1, ctx.rng)));
        }
        const c = Math.round(recip(target));
        const turn = via === 'N' || via === 'S' ? viaTurn(ctx.h, target, via === 'N' ? 0 : 180) : diff(ctx.h, target);
        const n = pick([10, 15, 15, 15, 20], ctx.rng);
        const v = pickVert(ctx, Math.max(n, turnSecs(turn) + 3));
        let segs;
        if (via) {
            segs = [seg(ctx, { turn }), seg(ctx, { vert: v, secs: n, timed: true })];
        } else {
            segs = [seg(ctx, { turn, vert: v, secs: Math.max(n, turnSecs(turn) + 3), timed: true })];
        }
        const secs = segs[segs.length - 1].secs;
        const pre = {
            en: via === 'N' ? 'Via north onto chart ' : via === 'S' ? 'Via south onto chart ' : via === 'K' ? 'Shortest way onto chart ' : 'Chart ',
            de: via === 'N' ? 'Über Nord auf Karte ' : via === 'S' ? 'Über Süd auf Karte ' : via === 'K' ? 'Auf kürzestem Weg auf Karte ' : 'Karte ',
        };
        const preSay = {
            en: via === 'N' ? 'Via north onto chart heading' : via === 'S' ? 'Via south onto chart heading' : via === 'K' ? 'Shortest way onto chart heading' : 'Chart heading',
            de: via === 'N' ? 'Über Nord auf Kartenkurs' : via === 'S' ? 'Über Süd auf Kartenkurs' : via === 'K' ? 'Auf kürzestem Weg auf Kartenkurs' : 'Kartenkurs',
        };
        return {
            segs, mapLabel: `${fmt(c)}/${secs}″`, ask: hr ? { answer: nearestPoint(target) } : null,
            text: both((l) => `${pre[l]}${fmt(c)} / ${secs}″ · ${SYMBOL[l][v]}${hr ? HR_TEXT[l] : ''}`),
            say: (l, rem) => (rem != null ? `${timeSay(l, secs, rem)} ${W[l][v]}.`
                : `${preSay[l]} ${sayHdg(c, l)}. ${secs} ${W[l].secs}. ${W[l][v[0].toUpperCase() + v.slice(1)]}.${hr ? HR_SAY[l] : ''}`),
        };
    },
    chartPoint(ctx) {
        const opts = POINTS.filter((p) => p.i % 2 === 0 && Math.abs(diff(ctx.h, recip(p.deg))) >= 30 && Math.abs(diff(ctx.h, recip(p.deg))) <= 150);
        const p = pick(opts, ctx.rng);
        const target = recip(p.deg);
        const turn = diff(ctx.h, target);
        const n = Math.ceil(Math.max(pick([15, 15, 20], ctx.rng), turnSecs(turn) + 3) / 5) * 5;
        const v = pickVert(ctx, n);
        const segs = [seg(ctx, { turn, vert: v, secs: n, timed: true })];
        return {
            segs, mapLabel: `${p.en}/${n}″`,
            text: both((l) => `${l === 'de' ? 'Karte' : 'Chart'} ${l === 'de' ? p.de : p.en} / ${n}″ · ${SYMBOL[l][v]}`),
            say: (l, rem) => (rem != null ? `${timeSay(l, n, rem)} ${W[l][v]}.`
                : `${l === 'de' ? 'Kartenkurs' : 'Chart heading'} ${l === 'de' ? p.deWords : p.enWords}. ${n} ${W[l].secs}. ${W[l][v[0].toUpperCase() + v.slice(1)]}.`),
        };
    },
    relative(ctx, { hr = false } = {}) {
        const d = ctx.rng() < 0.5 ? 1 : -1;
        let x;
        if (hr) {
            const opts = POINTS.filter((p) => { const a = Math.abs(dirTurn(ctx.h, p.deg, d)); return a >= 40 && a <= 160; });
            if (!opts.length) return null;
            const p = pick(opts, ctx.rng);
            x = Math.round(Math.abs(dirTurn(ctx.h, p.deg, d)));
        } else {
            x = between(40, 160, 1, ctx.rng);
        }
        const turn = d * x;
        const n = Math.ceil(Math.max(pick([15, 20, 25], ctx.rng), turnSecs(turn) + 3) / 5) * 5;
        const v = pickVert(ctx, n);
        const segs = [seg(ctx, { turn, vert: v, secs: n, timed: true })];
        return {
            segs, mapLabel: `${signed(turn)}/${n}″`, ask: hr ? { answer: nearestPoint(ctx.h) } : null,
            text: both((l) => `${signed(turn)} / ${n}″ · ${SYMBOL[l][v]}${hr ? HR_TEXT[l] : ''}`),
            say: (l, rem) => (rem != null ? `${timeSay(l, n, rem)} ${W[l][v]}.`
                : `${saySigned(turn, l)}. ${n} ${W[l].secs}. ${W[l][v[0].toUpperCase() + v.slice(1)]}.${hr ? HR_SAY[l] : ''}`),
        };
    },
    holdPhase(ctx) {
        const n = pick([10, 15], ctx.rng);
        const v = pickVert(ctx, n, ['climb', 'descent']);
        const segs = [seg(ctx, { vert: v, secs: n, timed: true })];
        return {
            segs, mapLabel: `/${n}″`,
            text: both((l) => `/ ${n}″ · ${SYMBOL[l][v]} (${l === 'de' ? 'Kurs halten' : 'hold heading'})`),
            say: (l, rem) => (rem != null ? `${timeSay(l, n, rem)} ${W[l][v]}.`
                : `${l === 'de' ? 'Kurs halten' : 'Hold heading'}. ${n} ${W[l].secs}. ${W[l][v[0].toUpperCase() + v.slice(1)]}.`),
        };
    },
    circle(ctx) {
        const d = ctx.rng() < 0.7 ? 1 : -1;
        const half = turnSecs(180) + 1;
        const v1 = pickVert(ctx, half, ['climb', 'descent']);
        const s1 = seg(ctx, { turn: d * 180, vert: v1 });
        const s2 = seg(ctx, { turn: d * 180 });
        return {
            segs: [s1, s2], mapLabel: `${d > 0 ? '+' : '−'}360°`,
            text: both((l, w) => (l === 'de'
                ? `Vollkreis nach ${w[dirKey(d)]} · erste Hälfte ${w[v1]}, zweite Hälfte Horizontalflug`
                : `Full circle to the ${w[dirKey(d)]} · first half ${w[v1]}, second half level flight`)),
            say: (l) => (l === 'de'
                ? `Vollkreis nach ${W[l][dirKey(d)]}. Erste Hälfte ${W[l][v1]}, zweite Hälfte Horizontalflug.`
                : `Full circle to the ${W[l][dirKey(d)]}. First half ${W[l][v1]}, second half level flight.`),
        };
    },
    box(ctx) {
        // three relative turns on the ACTUAL heading (no reciprocal), each with
        // an arrow (→ level, ↗ climb, ↘ descent) and seconds
        const lines = [];
        const segs = [];
        for (let k = 0; k < 3; k++) {
            const d = ctx.rng() < 0.5 ? 1 : -1;
            const x = between(35, 185, 1, ctx.rng);
            const n = Math.max(k === 2 ? 20 : 15, turnSecs(x) + 3);
            const v = k === 1 ? pickVert(ctx, n, ['climb', 'descent']) : pickVert(ctx, n, ['level', 'level', 'climb', 'descent']);
            segs.push(seg(ctx, { turn: d * x, vert: v, secs: n, timed: true }));
            lines.push({ turn: d * x, v, n: segs[k].secs });
        }
        const boxText = (l) => lines.map((b) => `${signed(b.turn)} ${ARROW[b.v]} ${b.n}″`).join('  |  ');
        return {
            segs, mapLabel: 'Box', box: true,
            text: both((l) => `${l === 'de' ? 'Kästchen' : 'Box'}: ${boxText(l)}`),
            say: (l) => `${l === 'de' ? 'Kästchen' : 'Box'}. ${lines.map((b) => `${saySigned(b.turn, l)}, ${W[l][b.v]}, ${b.n} ${W[l].secs}.`).join(' ')}`,
        };
    },
};

// ── generation ───────────────────────────────────────────────────
function weighted(list, rng) {
    const total = list.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
    return list[list.length - 1][0];
}

function nextItem(level, ctx, last) {
    for (let tries = 0; tries < 30; tries++) {
        if (level === 1) {
            const k = weighted(L1_WEIGHTS, ctx.rng);
            if ((k === 'askCurrent' || k === 'turnAndName') && (last === 'askCurrent' || last === 'turnAndName')) continue;
            if ((k === 'trap' || k === 'straight') && last === k) continue;
            if (k === 'straight' && last === 'first') continue;
            const snap = { h: ctx.h, alt: ctx.alt };
            const it = L1[k](ctx);
            if (it) return { k, it };
            Object.assign(ctx, snap);
        } else if (level === 2) {
            const k = weighted(L2_WEIGHTS, ctx.rng);
            if (k === last && k !== 'dirOntoHeading') continue;
            const snap = { h: ctx.h, alt: ctx.alt };
            const it = L2[k](ctx);
            if (it) return { k, it };
            Object.assign(ctx, snap);
        } else {
            const k = weighted([['chartHeading', 4], ['chartPoint', 1.5], ['relative', 2.5], ['holdPhase', 1], ['circle', 0.7], ['box', 1.2]], ctx.rng);
            if (k === last && (k === 'circle' || k === 'box' || k === 'holdPhase')) continue;
            const snap = { h: ctx.h, alt: ctx.alt };
            const hr = (k === 'chartHeading' || k === 'relative') && ctx.rng() < 0.2;
            const it = L3[k](ctx, { hr });
            if (it) return { k, it };
            Object.assign(ctx, snap);
        }
    }
    return { k: 'straight', it: level === 3 ? L3.holdPhase(ctx) : L1.straight(ctx) };
}

/**
 * Generate `count` instructions for AUA level 1, 2 or 3 (new every time).
 * Returns legs in the instructions.js format (see top of file).
 */
export function generateLevelLegs(level, count, rng = Math.random) {
    const ctx = { h: START.heading, alt: START.altitude, rng };
    const items = [{ k: 'first', it: firstStraight(ctx, level) }];
    while (items.length < count) {
        const last = items[items.length - 1].k;
        const { k, it } = nextItem(level, ctx, last);
        items.push({ k, it });
        // Level 3: an action box is always followed by "via N / via S /
        // shortest way onto K" (the next chart heading)
        if (it.box && items.length < count) {
            const via = pick(['N', 'S', 'K'], rng);
            items.push({ k: 'link', it: L3.chartHeading(ctx, { via }) });
        }
    }
    items.length = Math.min(items.length, count);

    // segments -> legs
    const legs = [];
    let t = 0;
    items.forEach(({ it }, g) => {
        const lead = legs.length;
        it.segs.forEach((s, k) => {
            const climb = s.altitude - s.startAlt;
            legs.push({
                form: 'lvl', level,
                type: s.turn ? 'turn' : 'heading',
                turn: s.turn,
                heading: wrap(s.startHdg + s.turn),
                headingLabel: fmt(s.startHdg + s.turn),
                altitude: s.altitude,
                altChange: climb,
                vs: climb === 0 ? 0 : (s.vs ?? LEVEL_RATE),
                duration: s.secs,
                startT: t,
                showVs: false,
                showTime: s.timed,
                group: g, cont: k > 0, lead,
                text: it.text,
                speech: it.say,
                ask: k === 0 ? (it.ask ?? null) : null,
                mapLabel: k === 0 ? it.mapLabel : '',
            });
            t += s.secs + GAP_SEC;      // 10 s pause after every step
        });
    });
    return legs;
}

/** Rough session length for the start page (average of a few generated tests). */
export function estimateLevelDuration(level, count) {
    let seed = 7;
    const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    let sum = 0;
    for (let r = 0; r < 4; r++) {
        const legs = generateLevelLegs(level, count, rng);
        const last = legs[legs.length - 1];
        sum += last.startT + last.duration;
    }
    return Math.round(sum / 4);
}

/** Check: does the ideal aircraft end each instruction on the planned heading? (dev/test only) */
export function _verifyLegs(legs) {
    const ideal = { heading: START.heading, altitude: START.altitude, x: 0, y: 0 };
    const errs = [];
    legs.forEach((leg, i) => {
        const dur = leg.duration + (legs[i + 1] ? GAP_SEC : 0);
        for (let k = 0; k < Math.round(dur / 0.05); k++) stepIdeal(ideal, leg, 0.05);
        const dh = Math.abs(((ideal.heading - leg.heading + 540) % 360) - 180);
        const da = Math.abs(ideal.altitude - leg.altitude);
        if (dh > 1 || da > 5) errs.push({ i, dh: Math.round(dh), da: Math.round(da) });
    });
    return errs;
}

/** Descriptions for the start page (Standard + AUA levels 1-3). */
export const LEVEL_INFO = [
    {
        id: 'standard', title: 'Standard', subtitle: 'Heading / altitude / vertical speed',
        rules: [
            'Heading only, altitude only, heading + altitude, or heading + vertical speed — always for a set time.',
            'The first instruction: hold heading and level flight for 15 or 20 s.',
        ],
    },
    {
        id: 1, title: 'Level 1', subtitle: 'Level flight only',
        rules: [
            'Straight legs ("20 s straight ahead") and relative turns ("Turn 30° to the left, then 10 s straight ahead").',
            'Turns onto compass points ("Left turn onto NNW") and "the shortest way" traps (a heading 210° lower is a right turn of 150°).',
            'Compass-direction questions: answer with the direction buttons (e.g. 045° = NE).',
            'Altitude stays the same the whole time.',
        ],
    },
    {
        id: 2, title: 'Level 2', subtitle: 'Climb and descent added',
        rules: [
            'Turns onto headings or compass points with a phase and a time ("Left onto 140°, 15 s descent").',
            'Big turns (over 270° or 360°), full circles in two phases, "climb until heading east, then level".',
            'Altitude-triggered turns ("descend 500 ft, after 250 ft start a left turn") and the reciprocal of a compass point.',
            `Climb / descent at ${LEVEL_RATE} ft/min unless stated otherwise. The time includes the turn.`,
        ],
    },
    {
        id: 3, title: 'Level 3', subtitle: 'Flight-plan chart',
        rules: [
            'Chart 303° / 15″ — fly the RECIPROCAL of the printed heading (303° → 123°) for 15 s.',
            'Phase per item: level, climb or descent. +95° / 20″ = turn 95° right from the current heading.',
            'HR = name the compass direction with the buttons. "Box" = three relative turns on the actual heading (→ level, ↗ climb, ↘ descent).',
            'After a box: "via north / via south / shortest way onto chart …" — turn in that way onto the reciprocal.',
        ],
    },
];
