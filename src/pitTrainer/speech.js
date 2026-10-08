// Spoken instructions for the PIT trainer (browser speech synthesis).
//
// Clarity:
//  - picks the clearest English voice the browser offers (the online
//    "Google" voices in Chrome and the "Natural" voices in Edge sound far
//    clearer than the default system voice);
//  - speaks a little slower than normal, at full volume;
//  - speaks one sentence at a time (Chrome can cut off long utterances).
//
// Reliability: all sentences of an instruction are handed to the browser's
// own speech queue at once and kept referenced (Chrome otherwise sometimes
// drops its "finished" events). Whether the voice is still talking is read
// directly from the browser with isSpeaking().
//
// Pause / resume:
//  - pauseSpeech() stops the voice and remembers which sentence it was on;
//  - resumeSpeech() continues from that sentence (never from the start);
//    if everything was already spoken, nothing is repeated.

const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// Higher score = preferred. Checked against the voice name.
const PREFERRED = [
    [/Google UK English Female/i, 100],
    [/Google US English/i, 95],
    [/Google UK English Male/i, 90],
    [/(Aria|Jenny|Guy|Sonia|Ryan|Libby).*Natural/i, 88],   // Microsoft Edge natural voices
    [/Natural|Neural|Premium|Enhanced/i, 80],
    [/^(Samantha|Daniel|Karen|Moira|Serena|Kate|Oliver)\b/i, 70], // good macOS / iOS voices
    [/Microsoft (Zira|David|Hazel|George)/i, 50],
];

let chosenVoice = null;

function scoreVoice(v) {
    if (!/^en(-|_|$)/i.test(v.lang)) return -1;
    let score = 10;
    for (const [re, s] of PREFERRED) {
        if (re.test(v.name)) { score = Math.max(score, s); }
    }
    if (/en-(GB|US)/i.test(v.lang)) score += 2;
    return score;
}

function pickVoice() {
    if (!hasSpeech()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    let best = null;
    let bestScore = -1;
    for (const v of voices) {
        const s = scoreVoice(v);
        if (s > bestScore) { best = v; bestScore = s; }
    }
    chosenVoice = best;
    return best;
}

// Voices load asynchronously in Chrome -- pick again once they arrive.
if (hasSpeech()) {
    pickVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

const splitSentences = (text) => String(text).split(/(?<=\.)\s+/).filter(Boolean);

// ── state ───────────────────────────────────────────────────────
let queue = [];      // sentences of the current instruction
let index = 0;       // sentence currently being spoken (updated by onstart)
let paused = false;
let token = 0;       // bumps whenever speech is interrupted (ignores stale events)
let onDone = null;   // called once when the whole instruction has been spoken
let live = [];       // keep utterances referenced so the browser keeps their events

function finish(my) {
    if (my !== token) return;
    queue = [];
    index = 0;
    live = [];
    const done = onDone;
    onDone = null;
    if (done) done();
}

/** Hand sentences from `from` onwards to the browser's queue in one go. */
function enqueueFrom(from) {
    if (!hasSpeech()) return;
    token += 1;
    const my = token;
    const voice = chosenVoice || pickVoice();
    live = [];
    for (let k = from; k < queue.length; k++) {
        const u = new SpeechSynthesisUtterance(queue[k]);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-GB'; }
        u.rate = 0.88;   // a bit slower than normal = easier to follow
        u.pitch = 1.0;
        u.volume = 1.0;
        u.onstart = () => { if (my === token) index = k; };
        if (k === queue.length - 1) {
            u.onend = () => finish(my);
            u.onerror = () => finish(my);
        }
        live.push(u);
        window.speechSynthesis.speak(u);
    }
}

/** Stop anything being spoken right now and forget it. */
export function stopSpeech() {
    token += 1;
    queue = [];
    index = 0;
    paused = false;
    onDone = null;
    live = [];
    if (hasSpeech()) window.speechSynthesis.cancel();
}

/**
 * Speak `text` clearly, sentence by sentence (replaces anything playing).
 * `done` (optional) is called once the last sentence has finished.
 */
export function speak(text, done = null) {
    if (!hasSpeech()) { if (done) done(); return; }
    stopSpeech();
    queue = splitSentences(text);
    index = 0;
    onDone = done;
    enqueueFrom(0);
}

/** True while the browser is still speaking (or about to). */
export function isSpeaking() {
    if (!hasSpeech()) return false;
    return !!(window.speechSynthesis.speaking || window.speechSynthesis.pending);
}

/** Rough time (s) the voice needs for `text` -- used as a safety limit. */
export function estimateSpeechSeconds(text) {
    const words = String(text).trim().split(/\s+/).length;
    return words * 0.5 + 2;
}

/** Pause: stop the voice but remember which sentence it was on. */
export function pauseSpeech() {
    if (!hasSpeech() || paused) return;
    paused = true;
    token += 1;               // ignore events from the cancelled utterances
    window.speechSynthesis.cancel();
}

/** Resume: continue from the interrupted sentence (never from the start). */
export function resumeSpeech() {
    if (!hasSpeech() || !paused) return;
    paused = false;
    if (queue.length > 0 && index < queue.length) enqueueFrom(index);
}

/** True while paused in the middle of an instruction. */
export function isSpeechPaused() {
    return paused && queue.length > 0;
}

/** Call from a click handler (e.g. Start) so browsers allow speech later. */
export function primeSpeech() {
    if (!hasSpeech()) return;
    pickVoice();
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
}
