const MELODY = [76, 79, 83, 79, 74, 77, 81, 77, 72, 76, 79, 76, 74, 77, 81, 77];
const BASS = [48, 48, 55, 55, 45, 45, 52, 52, 41, 41, 48, 48, 43, 43, 50, 50];
const BAR_ROOT_SHIFT = [0, -2, -7, -5];

export class RetroAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.timer = null;
    this.enabled = true;
    this.systemEnabled = true;
    this.nextStepTime = 0;
    this.step = 0;
  }

  start() {
    if (!this.context) {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) {
        console.warn("Web Audio is unavailable; the game will run without sound.");
        this.enabled = false;
        return;
      }
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.systemEnabled ? 0.32 : 0;
      this.master.connect(this.context.destination);
    }
    this.context.resume();
    if (this.enabled) this.startMusic();
  }

  startMusic() {
    if (!this.context || !this.enabled || this.timer !== null) return;
    this.nextStepTime = this.context.currentTime + 0.05;
    this.timer = window.setInterval(() => this.scheduleMusic(), 25);
  }

  stopMusic() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause() {
    this.stopMusic();
    if (this.context?.state === "running") this.context.suspend();
  }

  resume() {
    if (!this.context) return;
    this.context.resume();
    if (this.enabled) this.startMusic();
  }

  toggleMusic() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.context?.resume();
      this.startMusic();
    } else {
      this.stopMusic();
    }
    return this.enabled;
  }

  setSystemEnabled(enabled) {
    this.systemEnabled = enabled;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(enabled ? 0.32 : 0, this.context.currentTime, 0.015);
    }
  }

  scheduleMusic() {
    if (!this.context || this.context.state !== "running") return;
    while (this.nextStepTime < this.context.currentTime + 0.12) {
      const stepInBar = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const shift = BAR_ROOT_SHIFT[bar];
      if (stepInBar % 2 === 0) {
        const note = MELODY[stepInBar] + shift;
        this.tone(note, this.nextStepTime, 0.105, "square", 0.055);
      }
      if (stepInBar % 4 === 0) {
        this.tone(BASS[stepInBar] + shift, this.nextStepTime, 0.18, "triangle", 0.1);
      }
      if (stepInBar % 4 === 2) {
        this.tone(MELODY[stepInBar] + shift - 12, this.nextStepTime, 0.07, "square", 0.025);
      }
      this.nextStepTime += 0.125;
      this.step = (this.step + 1) % 64;
    }
  }

  tone(midi, when, duration, type = "square", volume = 0.1, endMidi = midi) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), when);
    if (endMidi !== midi) {
      oscillator.frequency.exponentialRampToValueAtTime(440 * 2 ** ((endMidi - 69) / 12), when + duration);
    }
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.01);
  }

  play(name) {
    if (!this.context || this.context.state !== "running") return;
    const now = this.context.currentTime + 0.005;
    const effects = {
      shoot: [84, 0.045, "square", 0.035, 72],
      hit: [58, 0.18, "sawtooth", 0.08, 36],
      explosion: [65, 0.12, "triangle", 0.07, 42],
      powerup: [72, 0.18, "square", 0.07, 96],
      level: [60, 0.42, "square", 0.08, 84],
      wave: [67, 0.18, "square", 0.06, 79],
      missile: [55, 0.22, "sawtooth", 0.08, 32],
      gameover: [62, 0.5, "triangle", 0.08, 38],
    };
    const effect = effects[name];
    if (effect) this.tone(effect[0], now, effect[1], effect[2], effect[3], effect[4]);
  }
}
