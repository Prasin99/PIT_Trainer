// PIT instruction sequence ("legs"), in the style of the PIT flight-plan
// chart. Two kinds of instruction:
//   - heading leg: "Heading 145° for 15 s" (+ altitude / vertical speed)
//   - turn leg:    "Turn right 270°" (a relative turn / full circle, like the
//                  loops and "+270°" / "+90°" on the chart)
// When an instruction's time is over, the next one starts.
//
// Also provides the "required" (ideal) flight profile used for scoring and
// for the track map: the ideal aircraft turns at IDEAL_TURN_RATE and
// climbs/descends at the instructed VS until it reaches the instructed
// altitude, flying at IDEAL_SPEED_KT.

export const START = { heading: 0, altitude: 3000, speed: 120 };
export const ALT_MIN = 2000;
export const ALT_MAX = 5000;

export const IDEAL_TURN_RATE = 10;  // deg/s for turn instructions (circles / "+270°")
export const HEADING_TURN_RATE = 20; // deg/s for heading changes -> short corners, straight legs
export const IDEAL_SPEED_KT = 120;  // speed of the required track

export const DEFAULT_COUNT = 20;    // instructions per session (like the chart)

const DURATIONS = [10, 10, 15, 15, 20, 30];   // seconds per heading leg
const VS_OPTIONS = [0, 0, 500, 1000, 1000];    // ft/min (0 = level flight)
const TURN_OPTIONS = [90, 180, 270, 360];      // relative turns (deg)
const TURNS_PER_20 = 3;                        // turn instructions per 20 (like the chart)

// 8-point compass names used in some instructions ("Heading E")
const COMPASS_NAMES = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };

const wrap360 = (d) => ((d % 360) + 360) % 360;
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
const fmtHdg = (h) => `${String(Math.round(h)).padStart(3, '0')}°`;

/**
 * Generate `count` instructions.
 * Each leg: { type: 'heading' | 'turn', heading, headingLabel, turn,
 *             altitude, altChange, vs, duration, startT }
 *   turn: signed degrees for turn legs (+ = right, - = left), else 0.
 *   vs is the instructed rate (ft/min, >= 0); climb or descent follows from
 *   `altitude` vs. the previous altitude.
 *
 * Route planning (like a chart designer): for every instruction several
 * candidate headings / turns are tried; the one whose required track stays
 * clear of the route flown so far, and inside a roughly square area, wins.
 * This gives a route that wanders across the "page" like the PIT chart
 * instead of tangling up on itself.
 */
const CLEARANCE_NM = 0.22;   // keep new legs this far from earlier legs
const AREA_NM = 2.6;         // half-size of the square the route should stay in
const CANDIDATES = 24;

export function generateLegs(count = DEFAULT_COUNT, rng = Math.random) {
    const legs = [];
    let t = 0;
    let alt = START.altitude;
    const ideal = { heading: START.heading, altitude: START.altitude, x: 0, y: 0 };
    const path = [{ x: 0, y: 0 }];   // required track so far (for clearance checks)

    // Pick which instructions are turns: never the first, never two in a row.
    const nTurns = Math.max(1, Math.round((count * TURNS_PER_20) / 20));
    const turnAt = new Set();
    for (let tries = 0; turnAt.size < nTurns && tries < 200; tries++) {
        const i = 1 + Math.floor(rng() * (count - 1));
        if (!turnAt.has(i) && !turnAt.has(i - 1) && !turnAt.has(i + 1)) turnAt.add(i);
    }

    for (let i = 0; i < count; i++) {
        const isTurn = turnAt.has(i);
        const hdg = ideal.heading;

        // Vertical part (does not affect the route on the map)
        const vsPick = pick(VS_OPTIONS, rng);
        const dirPick = rng() < 0.5 ? 1 : -1;

        let best = null;
        for (let c = 0; c < (i === 0 ? 1 : CANDIDATES); c++) {
            const cand = makeCandidate(isTurn, hdg, rng);
            const score = scoreCandidate(cand, ideal, path);
            if (!best || score < best.score) best = { ...cand, score };
            if (score === 0 && c >= 3) break;
        }

        // vertical: level, or climb/descend at VS for (at most) the leg time
        let altitude = alt;
        if (vsPick > 0) {
            const change = Math.max(50, Math.round((vsPick * best.duration) / 60 / 10) * 10); // ft
            let dir = dirPick;
            if (alt + dir * change > ALT_MAX || alt + dir * change < ALT_MIN) dir = -dir;
            altitude = alt + dir * change;
        }

        const leg = {
            type: best.type, heading: best.heading, headingLabel: best.headingLabel, turn: best.turn,
            altitude, altChange: altitude - alt,
            vs: altitude === alt ? 0 : vsPick,
            duration: best.duration, startT: t,
        };
        legs.push(leg);

        // advance the ideal aircraft through the chosen leg and extend the path
        const dt = 0.1;
        for (let k = 0; k < Math.round(leg.duration / dt); k++) {
            stepIdeal(ideal, leg, dt);
            if (k % 3 === 0) path.push({ x: ideal.x, y: ideal.y });
        }
        t += leg.duration;
        alt = altitude;
    }
    return legs;
}

function makeCandidate(isTurn, hdg, rng) {
    if (isTurn) {
        const turn = pick(TURN_OPTIONS, rng) * (rng() < 0.5 ? -1 : 1);
        const heading = wrap360(hdg + turn);
        return {
            type: 'turn', turn, heading, headingLabel: fmtHdg(heading),
            duration: Math.ceil(Math.abs(turn) / IDEAL_TURN_RATE)
        };
    }
    const duration = pick(DURATIONS, rng);
    // Turn 30-150 deg left or right, rounded to 10 deg; sometimes an 8-point
    // compass name instead.
    if (rng() < 0.3) {
        const opts = Object.keys(COMPASS_NAMES).map(Number)
            .filter((h) => { const d = Math.abs(((h - hdg + 540) % 360) - 180); return d >= 30 && d <= 150; });
        const heading = pick(opts, rng);
        return { type: 'heading', turn: 0, heading, headingLabel: COMPASS_NAMES[heading], duration };
    }
    const tr = (30 + Math.floor(rng() * 13) * 10) * (rng() < 0.5 ? -1 : 1);
    const heading = wrap360(Math.round((hdg + tr) / 10) * 10);
    return { type: 'heading', turn: 0, heading, headingLabel: fmtHdg(heading), duration };
}

/** Lower = better: how close the candidate's track comes to the earlier route / area edge. */
function scoreCandidate(cand, ideal, path) {
    const sim = { heading: ideal.heading, altitude: ideal.altitude, x: ideal.x, y: ideal.y };
    const leg = { ...cand, altitude: ideal.altitude, vs: 0 };
    // ignore the most recent part of the route (we are still attached to it)
    const older = path.slice(0, Math.max(0, path.length - 12));
    const dt = 0.1;
    const n = Math.round(cand.duration / dt);
    let score = 0;
    for (let k = 0; k < n; k++) {
        stepIdeal(sim, leg, dt);
        if (k % 3 !== 0) continue;
        for (let j = 0; j < older.length; j += 2) {
            const d = Math.hypot(sim.x - older[j].x, sim.y - older[j].y);
            if (d < CLEARANCE_NM) score += (CLEARANCE_NM - d) * 10;
        }
        const out = Math.max(0, Math.abs(sim.x) - AREA_NM) + Math.max(0, Math.abs(sim.y) - AREA_NM);
        score += out * 20;
    }
    return score;
}

/** Total session length (s) for a list of legs. */
export function totalDuration(legs) {
    const last = legs[legs.length - 1];
    return last ? last.startT + last.duration : 0;
}

/** Rough session length for `count` instructions (for the start page). */
export function estimateDuration(count) {
    const avgHeading = DURATIONS.reduce((a, b) => a + b, 0) / DURATIONS.length;
    const avgTurn = TURN_OPTIONS.reduce((a, b) => a + b, 0) / TURN_OPTIONS.length / IDEAL_TURN_RATE;
    const share = TURNS_PER_20 / 20;
    return Math.round(count * ((1 - share) * avgHeading + share * avgTurn));
}

/** Lines shown on screen, like "Heading 320° / Altitude 3500ft / VS 1000ft/min / Time 20 s". */
export function legLines(leg) {
    const first = leg.type === 'turn'
        ? { label: 'Turn', value: `${leg.turn > 0 ? 'Right' : 'Left'} ${Math.abs(leg.turn)}°` }
        : { label: 'Heading', value: leg.headingLabel };
    return [
        first,
        { label: 'Altitude', value: `${leg.altitude}ft` },
        { label: 'VS', value: `${leg.vs}ft/min` },
        { label: 'Time', value: `${leg.duration} s` },
    ];
}

/** Short label for the map, like the chart: "145° / 15″" or "+270°". */
export function legMapLabel(leg) {
    if (leg.type === 'turn') return `${leg.turn > 0 ? '+' : '−'}${Math.abs(leg.turn)}°`;
    return `${leg.headingLabel} / ${leg.duration}″`;
}

// --- spoken version -------------------------------------------------------
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'niner'];
const NAME_WORDS = { N: 'north', NE: 'north east', E: 'east', SE: 'south east', S: 'south', SW: 'south west', W: 'west', NW: 'north west' };

function digitsOf(n) {
    return String(n).padStart(3, '0').split('').map((d) => DIGITS[Number(d)]).join(' ');
}

function altitudeWords(ft) {
    const th = Math.floor(ft / 1000);
    const rest = ft % 1000;
    let s = th > 0 ? `${th} thousand` : '';
    if (rest > 0) s += `${s ? ' ' : ''}${rest}`;
    return `${s} feet`;
}

/** Sentence read aloud by speech synthesis. */
export function legSpeech(leg, prevAltitude) {
    let lateral;
    if (leg.type === 'turn') {
        lateral = `Turn ${leg.turn > 0 ? 'right' : 'left'} ${Math.abs(leg.turn)} degrees.`;
    } else {
        const hdg = NAME_WORDS[leg.headingLabel] ?? digitsOf(leg.heading);
        lateral = `Heading ${hdg}.`;
    }
    let vertical;
    if (leg.vs === 0 || leg.altitude === prevAltitude) {
        vertical = `Maintain ${altitudeWords(leg.altitude)}.`;
    } else {
        const verb = leg.altitude > prevAltitude ? 'Climb' : 'Descend';
        vertical = `${verb} to ${altitudeWords(leg.altitude)}, vertical speed ${leg.vs} feet per minute.`;
    }
    return `${lateral} ${vertical} For ${leg.duration} seconds.`;
}

// --- ideal (required) profile -------------------------------------------
/**
 * Advance the ideal aircraft `ideal` = {heading, altitude, x, y} by dt
 * toward `leg`. Heading legs turn the short way; turn legs turn the
 * instructed direction by the instructed amount (e.g. a full 360° circle).
 */
export function stepIdeal(ideal, leg, dt) {
    if (ideal.leg !== leg) {
        ideal.leg = leg;
        ideal.turnLeft = leg.type === 'turn' ? leg.turn : null;
    }

    const maxTurn = IDEAL_TURN_RATE * dt;
    if (ideal.turnLeft != null) {
        const d = Math.sign(ideal.turnLeft) * Math.min(maxTurn, Math.abs(ideal.turnLeft));
        ideal.heading = wrap360(ideal.heading + d);
        ideal.turnLeft -= d;
    } else {
        const maxHdgTurn = HEADING_TURN_RATE * dt;
        const diff = ((leg.heading - ideal.heading + 540) % 360) - 180;
        ideal.heading = wrap360(ideal.heading + Math.max(-maxHdgTurn, Math.min(maxHdgTurn, diff)));
    }

    // altitude: move at the instructed VS until the instructed altitude
    const dAlt = leg.altitude - ideal.altitude;
    const maxClimb = ((leg.vs || 0) / 60) * dt;
    const step = Math.max(-maxClimb, Math.min(maxClimb, dAlt));
    ideal.altitude += step;
    ideal.vmode = step > 1e-6 ? 'climb' : step < -1e-6 ? 'descent' : 'level';

    // position (nautical miles; x = east, y = north)
    advancePos(ideal, ideal.heading, IDEAL_SPEED_KT, dt);
}

/** Move a {x, y} point along `headingDeg` at `speedKt` for dt seconds. */
export function advancePos(p, headingDeg, speedKt, dt) {
    const nm = (speedKt / 3600) * dt;
    const a = (headingDeg * Math.PI) / 180;
    p.x += Math.sin(a) * nm;
    p.y += Math.cos(a) * nm;
}

/**
 * The complete required track for all legs, computed up front (not shown
 * during the test). Used to give the maps a fixed frame from the start,
 * like a printed chart.
 */
export function buildRequiredTrack(legs, sampleSec = 0.25, dt = 0.05) {
    const ideal = { heading: START.heading, altitude: START.altitude, x: 0, y: 0 };
    const pts = [{ x: 0, y: 0, leg: 0, v: 'level' }];
    const total = totalDuration(legs);
    let li = 0;
    let acc = 0;
    for (let t = 0; t < total; t += dt) {
        while (li + 1 < legs.length && t >= legs[li + 1].startT) li++;
        stepIdeal(ideal, legs[li], dt);
        acc += dt;
        if (acc >= sampleSec - 1e-9) {
            acc = 0;
            pts.push({ x: ideal.x, y: ideal.y, leg: li, v: ideal.vmode });
        }
    }
    return pts;
}
