// Spoken instructions for the PIT trainer (browser speech synthesis).
//
// Clarity:
//  - picks the clearest English voice the browser offers (the online
//    "Google" voices in Chrome and the "Natural" voices in Edge sound far
//    clearer than the default system voice);
//  - speaks a little slower than normal, at full volume;
//  - speaks one sentence at a time (Chrome can cut off long utterances).

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

/** Stop anything being spoken right now. */
export function stopSpeech() {
    if (hasSpeech()) window.speechSynthesis.cancel();
}

/** Speak `text` clearly, sentence by sentence (replaces anything playing). */
export function speak(text) {
    if (!hasSpeech()) return;
    stopSpeech();
    const voice = chosenVoice || pickVoice();
    const sentences = String(text).split(/(?<=\.)\s+/).filter(Boolean);
    for (const sentence of sentences) {
        const u = new SpeechSynthesisUtterance(sentence);
        if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-GB'; }
        u.rate = 0.88;   // a bit slower than normal = easier to follow
        u.pitch = 1.0;
        u.volume = 1.0;
        window.speechSynthesis.speak(u);
    }
}

/** Call from a click handler (e.g. Start) so browsers allow speech later. */
export function primeSpeech() {
    if (!hasSpeech()) return;
    pickVoice();
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
}