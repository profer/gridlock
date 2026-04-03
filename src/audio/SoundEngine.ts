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

export function playPowerUpSpawn(): void {
  playTone(523, 0.12, "sine", 0.08);
  setTimeout(() => playTone(659, 0.12, "sine", 0.08), 60);
  setTimeout(() => playTone(784, 0.15, "sine", 0.1), 120);
}

export function playBombCollect(): void {
  playTone(200, 0.15, "square", 0.1);
  setTimeout(() => playTone(300, 0.15, "square", 0.08), 80);
}

export function playBombUse(): void {
  // Seismic charge: brief silence → ascending whine → massive BOOM
  const ac = getCtx();

  // Phase 1: Sharp ascending whine (0 - 0.3s)
  const whine = ac.createOscillator();
  const whineGain = ac.createGain();
  whine.type = "sine";
  whine.frequency.setValueAtTime(200, ac.currentTime);
  whine.frequency.exponentialRampToValueAtTime(2000, ac.currentTime + 0.25);
  whineGain.gain.setValueAtTime(0.08, ac.currentTime);
  whineGain.gain.exponentialRampToValueAtTime(0.15, ac.currentTime + 0.2);
  whineGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
  whine.connect(whineGain);
  whineGain.connect(ac.destination);
  whine.start(ac.currentTime);
  whine.stop(ac.currentTime + 0.35);

  // Phase 2: The BOOM (0.25s) — deep bass drop + distortion
  const boomTime = ac.currentTime + 0.25;

  // Sub bass
  const boom = ac.createOscillator();
  const boomGain = ac.createGain();
  boom.type = "sine";
  boom.frequency.setValueAtTime(80, boomTime);
  boom.frequency.exponentialRampToValueAtTime(20, boomTime + 0.8);
  boomGain.gain.setValueAtTime(0.3, boomTime);
  boomGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 1.0);
  boom.connect(boomGain);
  boomGain.connect(ac.destination);
  boom.start(boomTime);
  boom.stop(boomTime + 1.1);

  // Mid crunch layer
  const crunch = ac.createOscillator();
  const crunchGain = ac.createGain();
  crunch.type = "sawtooth";
  crunch.frequency.setValueAtTime(150, boomTime);
  crunch.frequency.exponentialRampToValueAtTime(30, boomTime + 0.5);
  crunchGain.gain.setValueAtTime(0.12, boomTime);
  crunchGain.gain.exponentialRampToValueAtTime(0.001, boomTime + 0.6);
  crunch.connect(crunchGain);
  crunchGain.connect(ac.destination);
  crunch.start(boomTime);
  crunch.stop(boomTime + 0.7);

  // Noise burst (debris/shrapnel)
  setTimeout(() => playNoise(0.5, 0.2), 250);

  // Reverb tail — descending echo pings
  for (let i = 1; i <= 3; i++) {
    const delay = 0.25 + i * 0.15;
    const vol = 0.08 / i;
    const echoOsc = ac.createOscillator();
    const echoGain = ac.createGain();
    echoOsc.type = "sine";
    echoOsc.frequency.setValueAtTime(60 / i, ac.currentTime + delay);
    echoOsc.frequency.exponentialRampToValueAtTime(15, ac.currentTime + delay + 0.4);
    echoGain.gain.setValueAtTime(vol, ac.currentTime + delay);
    echoGain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + 0.5);
    echoOsc.connect(echoGain);
    echoGain.connect(ac.destination);
    echoOsc.start(ac.currentTime + delay);
    echoOsc.stop(ac.currentTime + delay + 0.6);
  }
}

export function playSpeedSmash(): void {
  // Punchy wall break
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(100, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.12);
  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + 0.2);
  playNoise(0.08, 0.1);
}

export function playFreezeCollect(): void {
  // Icy shimmer: high descending sine
  playTone(1200, 0.2, "sine", 0.1);
  setTimeout(() => playTone(900, 0.2, "sine", 0.08), 80);
  setTimeout(() => playTone(1100, 0.25, "sine", 0.06), 160);
}

export function playFreezeEnd(): void {
  playTone(400, 0.15, "sine", 0.06);
  setTimeout(() => playTone(300, 0.2, "sine", 0.05), 80);
}

export function playSpeedCollect(): void {
  // Quick ascending burst
  playTone(440, 0.08, "sawtooth", 0.08);
  setTimeout(() => playTone(660, 0.08, "sawtooth", 0.08), 40);
  setTimeout(() => playTone(880, 0.08, "sawtooth", 0.08), 80);
  setTimeout(() => playTone(1100, 0.12, "sawtooth", 0.1), 120);
}

export function playSpeedEnd(): void {
  playTone(600, 0.1, "sawtooth", 0.06);
  setTimeout(() => playTone(400, 0.15, "sawtooth", 0.05), 60);
}

export function initAudio(): void {
  // Call on first user interaction to unlock audio context
  getCtx();
}
