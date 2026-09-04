/** A small procedural soundscape. Audio only starts after an explicit user gesture. */
export class Soundscape {
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private running = false;
  async toggle() {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0.32;
      this.gain.connect(this.context.destination);
      const buffer = this.context.createBuffer(
        1,
        this.context.sampleRate * 4,
        this.context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.018) / 1.018;
        data[i] = last * 3;
      }
      this.noise = this.context.createBufferSource();
      this.noise.buffer = buffer;
      this.noise.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 550;
      this.noise.connect(filter);
      filter.connect(this.gain);
      this.noise.start();
    }
    this.running = !this.running;
    if (this.running) {
      await this.context.resume();
      this.chime();
      this.timer = setInterval(() => this.chime(), 7000);
    } else {
      await this.context.suspend();
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }
    return this.running;
  }
  private chime() {
    if (!this.context || !this.gain || !this.running) return;
    const t = this.context.currentTime;
    const note = [523.25, 659.25, 783.99, 1046.5][Math.floor(Math.random() * 4)];
    for (const harmonic of [1, 2.76, 5.4]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = note * harmonic;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.035 / harmonic, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 4);
      oscillator.connect(gain);
      gain.connect(this.gain);
      oscillator.start(t);
      oscillator.stop(t + 4.1);
    }
  }
  dispose() {
    if (this.timer) clearInterval(this.timer);
    this.noise?.stop();
    void this.context?.close();
  }
}
