// Procedural music engine using Web Audio API
// Two tracks: ambient menu theme and dynamic gameplay theme

const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let currentTrack: "menu" | "gameplay" | null = null;
let loopTimer: number | null = null;
let intensity = 0; // 0-1, controls gameplay urgency
let isRunning = false;

// D minor pentatonic scale — moody, works for both chill and tense
const NOTE_FREQS: Record<string, number> = {
  D3: 146.83, F3: 174.61, G3: 196.00, A3: 220.00, C4: 261.63,
  D4: 293.66, F4: 349.23, G4: 392.00, A4: 440.00, C5: 523.25,
  D5: 587.33, F5: 698.46, G5: 783.99, A5: 880.00, C6: 1046.50,
  D2: 73.42, A2: 110.00, F2: 87.31, G2: 98.00,
};

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

function getMaster(): GainNode {
  getCtx();
  return masterGain!;
}

// --- Synth primitives ---

function playNote(
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  destination: AudioNode,
  attack: number = 0.02,
  release: number = 0.1,
): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + attack);
  gain.gain.setValueAtTime(volume, startTime + duration - release);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playPad(
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  destination: AudioNode,
): void {
  const ac = getCtx();

  // Two detuned oscillators for width
  for (const detune of [-7, 7]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;
    osc.detune.value = detune;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.3);
    gain.gain.setValueAtTime(volume, startTime + duration - 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
  }
}

// --- Menu track: dreamy arpeggios ---

const MENU_PATTERNS = [
  ["D4", "A4", "F5", "A4", "D4", "C5", "F4", "C5"],
  ["F4", "C5", "A5", "C5", "F4", "G4", "D5", "G4"],
  ["G4", "D5", "A5", "D5", "G4", "A4", "F5", "A4"],
  ["A4", "D5", "F5", "D5", "A4", "G4", "C5", "G4"],
];

const MENU_BASS = [
  ["D3", "D3", "D3", "D3"],
  ["F3", "F3", "F3", "F3"],
  ["G3", "G3", "G3", "G3"],
  ["A3", "A3", "A3", "A3"],
];

let menuBarIndex = 0;

function scheduleMenuBar(): void {
  if (currentTrack !== "menu" || !isRunning) return;

  const ac = getCtx();
  const dest = getMaster();
  const now = ac.currentTime + 0.05;
  const noteLen = 0.35;
  const barDuration = noteLen * 8;
  const pattern = MENU_PATTERNS[menuBarIndex % MENU_PATTERNS.length];
  const bass = MENU_BASS[menuBarIndex % MENU_BASS.length];

  // Arpeggio
  for (let i = 0; i < pattern.length; i++) {
    const freq = NOTE_FREQS[pattern[i]];
    playNote(freq, now + i * noteLen, noteLen * 0.9, "sine", 0.06, dest, 0.01, 0.15);
  }

  // Bass pad
  for (let i = 0; i < bass.length; i++) {
    const freq = NOTE_FREQS[bass[i]];
    playPad(freq, now + i * (barDuration / 4), barDuration / 4, 0.03, dest);
  }

  // High shimmery notes (every other bar)
  if (menuBarIndex % 2 === 0) {
    const shimmer = ["D5", "A5"];
    for (let i = 0; i < shimmer.length; i++) {
      playNote(NOTE_FREQS[shimmer[i]], now + i * (barDuration / 2), barDuration / 2, "sine", 0.02, dest, 0.1, 0.3);
    }
  }

  menuBarIndex++;

  loopTimer = window.setTimeout(scheduleMenuBar, barDuration * 1000 - 50);
}

// --- Gameplay track: driving, dynamic intensity ---

const GAMEPLAY_BASS_PATTERNS = [
  ["D2", "D2", "F2", "G2"],
  ["D2", "A2", "F2", "G2"],
  ["F2", "F2", "G2", "A2"],
  ["A2", "G2", "F2", "D2"],
];

const GAMEPLAY_MELODY_CALM = [
  ["D4", null, "F4", null, "A4", null, "G4", null],
  ["F4", null, "G4", null, "A4", null, "C5", null],
];

const GAMEPLAY_MELODY_MID = [
  ["D4", "F4", "A4", "G4", "F4", "A4", "C5", "D5"],
  ["A4", "C5", "D5", "F5", "D5", "C5", "A4", "G4"],
  ["F4", "G4", "A4", "D5", "C5", "A4", "G4", "F4"],
];

const GAMEPLAY_MELODY_INTENSE = [
  ["D5", "F5", "A5", "F5", "D5", "C5", "D5", "F5"],
  ["A4", "D5", "F5", "A5", "F5", "D5", "A4", "D5"],
  ["G4", "A4", "C5", "D5", "F5", "D5", "C5", "A4"],
  ["F5", "D5", "C5", "A4", "D5", "F5", "A5", "C6"],
];

let gameBarIndex = 0;

function scheduleGameplayBar(): void {
  if (currentTrack !== "gameplay" || !isRunning) return;

  const ac = getCtx();
  const dest = getMaster();
  const now = ac.currentTime + 0.05;

  // Tempo increases with intensity: 130 BPM at calm → 180 BPM at max
  const bpm = 130 + intensity * 50;
  const eighthNote = 60 / bpm / 2;
  const barDuration = eighthNote * 8;

  const bassPattern = GAMEPLAY_BASS_PATTERNS[gameBarIndex % GAMEPLAY_BASS_PATTERNS.length];

  // Bass: gets louder and more distorted with intensity
  const bassVol = 0.04 + intensity * 0.04;
  const bassType: OscillatorType = intensity > 0.6 ? "sawtooth" : "square";
  for (let i = 0; i < 4; i++) {
    const freq = NOTE_FREQS[bassPattern[i]];
    playNote(freq, now + i * eighthNote * 2, eighthNote * 1.8, bassType, bassVol, dest, 0.01, 0.05);
  }

  // Melody: changes pattern set based on intensity
  let melodyPool: (string | null)[][];
  let melodyVol: number;
  let melodyType: OscillatorType;

  if (intensity < 0.35) {
    melodyPool = GAMEPLAY_MELODY_CALM;
    melodyVol = 0.04;
    melodyType = "sine";
  } else if (intensity < 0.65) {
    melodyPool = GAMEPLAY_MELODY_MID;
    melodyVol = 0.05;
    melodyType = "triangle";
  } else {
    melodyPool = GAMEPLAY_MELODY_INTENSE;
    melodyVol = 0.06;
    melodyType = "sawtooth";
  }

  const melody = melodyPool[gameBarIndex % melodyPool.length];
  for (let i = 0; i < melody.length; i++) {
    const note = melody[i];
    if (note === null) continue;
    const freq = NOTE_FREQS[note];
    playNote(freq, now + i * eighthNote, eighthNote * 0.85, melodyType, melodyVol, dest, 0.01, 0.08);
  }

  // Percussion: kick-like thump on beats 1 and 3
  for (const beat of [0, 4]) {
    const kickOsc = ac.createOscillator();
    const kickGain = ac.createGain();
    kickOsc.type = "sine";
    kickOsc.frequency.setValueAtTime(120, now + beat * eighthNote);
    kickOsc.frequency.exponentialRampToValueAtTime(40, now + beat * eighthNote + 0.1);
    kickGain.gain.setValueAtTime(0.06 + intensity * 0.04, now + beat * eighthNote);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + beat * eighthNote + 0.15);
    kickOsc.connect(kickGain);
    kickGain.connect(dest);
    kickOsc.start(now + beat * eighthNote);
    kickOsc.stop(now + beat * eighthNote + 0.2);
  }

  // Hi-hat: 8th notes when intensity > 0.3, 16ths when > 0.7
  if (intensity > 0.3) {
    const hatCount = intensity > 0.7 ? 16 : 8;
    const hatInterval = barDuration / hatCount;
    for (let i = 0; i < hatCount; i++) {
      const hatTime = now + i * hatInterval;
      const bufSize = Math.floor(ac.sampleRate * 0.03);
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufSize, 3);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const hatGain = ac.createGain();
      const vol = (i % 2 === 0 ? 0.03 : 0.015) * (0.5 + intensity * 0.5);
      hatGain.gain.setValueAtTime(vol, hatTime);
      hatGain.gain.exponentialRampToValueAtTime(0.001, hatTime + 0.04);
      src.connect(hatGain);
      hatGain.connect(dest);
      src.start(hatTime);
    }
  }

  // Tension pad at high intensity
  if (intensity > 0.5) {
    const padFreq = NOTE_FREQS["D3"];
    const padVol = (intensity - 0.5) * 0.04;
    playPad(padFreq, now, barDuration, padVol, dest);
  }

  gameBarIndex++;

  loopTimer = window.setTimeout(scheduleGameplayBar, barDuration * 1000 - 50);
}

// --- Public API ---

export function startMenuMusic(): void {
  if (currentTrack === "menu") return;
  stopMusic();
  getCtx();
  currentTrack = "menu";
  isRunning = true;
  menuBarIndex = 0;
  scheduleMenuBar();
}

export function startGameplayMusic(): void {
  if (currentTrack === "gameplay") return;
  stopMusic();
  getCtx();
  currentTrack = "gameplay";
  isRunning = true;
  gameBarIndex = 0;
  intensity = 0;
  scheduleGameplayBar();
}

export function setIntensity(value: number): void {
  intensity = Math.max(0, Math.min(1, value));
}

export function stopMusic(): void {
  isRunning = false;
  currentTrack = null;
  if (loopTimer !== null) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

export function setVolume(value: number): void {
  const gain = getMaster();
  gain.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), getCtx().currentTime, 0.1);
}
