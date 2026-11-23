"use client";

// Tiny chiptune sound kit synthesized with WebAudio, so the game needs no audio files.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let music: GainNode | null = null;
let muted = false;
let loop: number | undefined;

const key = "wedding-game-muted";

export function isMuted() {
  try { muted = localStorage.getItem(key) === "1"; } catch { /* Storage is optional. */ }
  return muted;
}

export function setMuted(next: boolean) {
  muted = next;
  try { localStorage.setItem(key, next ? "1" : "0"); } catch { /* Storage is optional. */ }
  if (ctx && master) master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, .05);
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    ctx = new Context();
    master = ctx.createGain();
    master.gain.value = isMuted() ? 0 : 1;
    master.connect(ctx.destination);
    music = ctx.createGain();
    music.gain.value = .45;
    music.connect(master);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

type Tone = { freq: number; type?: OscillatorType; dur?: number; vol?: number; at?: number; slide?: number; out?: AudioNode | null };
function tone({ freq, type = "square", dur = .1, vol = .1, at = 0, slide = 0, out = master }: Tone) {
  if (!ctx || !out) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gain.gain.setValueAtTime(.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + .01);
  gain.gain.exponentialRampToValueAtTime(.0001, t + dur);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + dur + .03);
}

function noise(dur: number, vol: number) {
  if (!ctx || !master) return;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = vol;
  source.buffer = buffer;
  source.connect(gain).connect(master);
  source.start();
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export const sfx = {
  select: () => tone({ freq: 660, dur: .07, vol: .06 }),
  start: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: .12, vol: .08, at: i * .07 })),
  heart: (combo = 1) => {
    const base = 880 * 2 ** (Math.min(combo - 1, 6) / 12);
    tone({ freq: base, dur: .06, vol: .07 });
    tone({ freq: base * 1.5, dur: .14, vol: .07, at: .05 });
  },
  keepsake: () => [659, 784, 988, 1319].forEach((f, i) => tone({ freq: f, dur: .13, vol: .08, at: i * .06, type: "triangle" })),
  star: () => [1047, 1319, 1568, 2093, 1568, 2093].forEach((f, i) => tone({ freq: f, dur: .09, vol: .06, at: i * .05 })),
  power: () => tone({ freq: 300, dur: .35, vol: .08, slide: 900, type: "triangle" }),
  dash: () => noise(.12, .07),
  hit: () => { noise(.2, .12); tone({ freq: 220, dur: .25, vol: .09, slide: -150, type: "sawtooth" }); },
  swipe: () => { noise(.07, .05); tone({ freq: 900, dur: .08, vol: .04, slide: -500, type: "sawtooth" }); },
  toss: () => tone({ freq: 500, dur: .16, vol: .05, slide: 500, type: "triangle" }),
  bonk: () => { tone({ freq: 180, dur: .1, vol: .1, slide: -60 }); tone({ freq: 1200, dur: .05, vol: .04, at: .02 }); },
  defeat: () => { noise(.18, .06); [784, 988, 1319].forEach((f, i) => tone({ freq: f, dur: .09, vol: .06, at: .04 + i * .05, type: "triangle" })); },
  coo: () => tone({ freq: 420, dur: .18, vol: .03, slide: -120, type: "sine" }),
  count: (go = false) => tone({ freq: go ? 1047 : 523, dur: go ? .3 : .12, vol: .08 }),
  clear: () => {
    const seq: [number, number][] = [[72, .12], [76, .12], [79, .12], [84, .28], [79, .12], [84, .5]];
    let at = 0;
    seq.forEach(([m, d]) => { tone({ freq: hz(m), dur: d, vol: .09, at }); tone({ freq: hz(m - 12), dur: d, vol: .05, at, type: "triangle" }); at += d * .9; });
  },
  over: () => [392, 370, 349, 330].forEach((f, i) => tone({ freq: f, dur: i === 3 ? .5 : .2, vol: .08, at: i * .2, type: "triangle" })),
};

// A short, original, looping chiptune.
const lead = "64 67 72 71 69 67 64 67 65 69 74 72 71 69 67 - 64 67 72 71 69 67 64 60 62 64 65 62 60 - - -".split(" ");
const bass = "48 43 48 43 53 48 43 47 45 52 53 43 43 43 48 48".split(" ");

export function startMusic() {
  if (!ctx || loop !== undefined) return;
  const eighth = 60 / 132 / 2;
  let step = 0;
  let next = ctx.currentTime + .1;
  loop = window.setInterval(() => {
    if (!ctx) return;
    while (next < ctx.currentTime + .2) {
      const at = next - ctx.currentTime;
      const note = lead[step % lead.length];
      if (note !== "-") {
        let length = 1;
        while (lead[(step + length) % lead.length] === "-") length++;
        tone({ freq: hz(+note), dur: eighth * length * .9, vol: .03, at, out: music });
      }
      if (step % 2 === 0) tone({ freq: hz(+bass[(step / 2) % bass.length]), dur: eighth * 1.8, vol: .08, at, out: music, type: "triangle" });
      step++;
      next += eighth;
    }
  }, 50);
}

export function stopMusic() {
  window.clearInterval(loop);
  loop = undefined;
}
