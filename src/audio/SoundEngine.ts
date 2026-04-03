const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.15,
  detune: number = 0,
): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start();
  osc.stop(ac.currentTime + duration);
}

function playNoise(duration: number, volume: number = 0.1): void {
  const ac = getCtx();
  const bufferSize = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  }

  const source = ac.createBufferSource();
  source.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

  source.connect(gain);
  gain.connect(ac.destination);
  source.start();
}

export function playMove(): void {
  playTone(220, 0.08, "sine", 0.06);
}

export function playPickup(comboLevel: number): void {
  const baseFreq = 440 + comboLevel * 80;
  playTone(baseFreq, 0.15, "sine", 0.12);
  setTimeout(() => playTone(baseFreq * 1.5, 0.12, "sine", 0.08), 50);
}

export function playCombo(level: number): void {
  const freqs = [523, 659, 784, 1047]; // C5, E5, G5, C6
  for (let i = 0; i < Math.min(level, freqs.length); i++) {
    setTimeout(() => playTone(freqs[i], 0.2, "triangle", 0.1), i * 60);
  }
}

export function playWallSpawn(): void {
  playTone(80, 0.15, "square", 0.04, -10);
}

export function playWallClear(): void {
  playTone(600, 0.2, "sine", 0.1);
  setTimeout(() => playTone(800, 0.15, "sine", 0.08), 80);
}

export function playCrush(): void {
  // Ominous descending tone
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(300, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 1.2);
  gain.gain.setValueAtTime(0.15, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.5);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 1.5);

  // Crunch noise
  setTimeout(() => playNoise(0.4, 0.15), 200);
  setTimeout(() => playNoise(0.3, 0.1), 500);
}

export function playGameOver(): void {
  // Low rumble + descending notes
  setTimeout(() => playTone(200, 0.3, "sawtooth", 0.08), 0);
  setTimeout(() => playTone(160, 0.3, "sawtooth", 0.08), 150);
  setTimeout(() => playTone(120, 0.5, "sawtooth", 0.1), 300);
}

export function playGameStart(): void {
  playTone(330, 0.1, "sine", 0.1);
  setTimeout(() => playTone(440, 0.1, "sine", 0.1), 80);
  setTimeout(() => playTone(660, 0.15, "sine", 0.12), 160);
}

export function initAudio(): void {
  // Call on first user interaction to unlock audio context
  getCtx();
}
