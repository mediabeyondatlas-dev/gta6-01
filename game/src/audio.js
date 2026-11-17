// Every sound in Solmarina is synthesized with WebAudio: no audio files, no
// network. A low engine hum, a two-tone siren, gunshots, crashes, pickups and
// a little mission fanfare, all from oscillators and filtered noise.

export function makeAudio() {
  let ctx = null;
  let bus = null;
  let humOsc = null;
  let humLevel = null;
  let wailOsc = null;
  let wailLevel = null;
  let muted = false;
  let wailClock = 0;

  function setup() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      bus = ctx.createGain();
      bus.gain.value = 0.35;
      bus.connect(ctx.destination);
      humOsc = ctx.createOscillator();
      humOsc.type = 'sawtooth';
      humOsc.frequency.value = 55;
      humLevel = ctx.createGain();
      humLevel.gain.value = 0;
      humOsc.connect(humLevel);
      humLevel.connect(bus);
      humOsc.start();
      wailOsc = ctx.createOscillator();
      wailOsc.type = 'triangle';
      wailOsc.frequency.value = 660;
      wailLevel = ctx.createGain();
      wailLevel.gain.value = 0;
      wailOsc.connect(wailLevel);
      wailLevel.connect(bus);
      wailOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, seconds, kind, volume, glideTo) {
    if (!setup() || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + seconds);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
      osc.connect(gain);
      gain.connect(bus);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch {
      // Sound is garnish; a failure never stops the game.
    }
  }

  function burst(seconds, volume, cutoff) {
    if (!setup() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * seconds);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      source.start();
    } catch {
      // Sound is garnish; a failure never stops the game.
    }
  }

  return {
    resume() {
      if (setup() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      if (bus) bus.gain.value = muted ? 0 : 0.35;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Continuous engine note; pitch follows speed from 0 to 1. */
    engine(speedRatio, driving) {
      if (!setup() || muted) return;
      try {
        humLevel.gain.value = driving ? 0.05 + speedRatio * 0.06 : 0;
        humOsc.frequency.value = 52 + speedRatio * 130;
      } catch {
        // Ignore.
      }
    },
    /** Two-tone siren while any cop is close; call every frame. */
    siren(on, dt) {
      if (!setup() || muted) return;
      try {
        if (on) {
          wailClock += dt;
          const high = Math.floor(wailClock / 0.45) % 2 === 0;
          wailOsc.frequency.value = high ? 880 : 660;
          wailLevel.gain.value = 0.035;
        } else {
          wailLevel.gain.value = 0;
        }
      } catch {
        // Ignore.
      }
    },
    gunshot() {
      burst(0.14, 0.5, 2400);
    },
    crash() {
      burst(0.3, 0.45, 500);
      tone(70, 0.25, 'sine', 0.4, 40);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.3);
      setTimeout(() => tone(990, 0.12, 'sine', 0.3), 80);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.3), i * 110));
    },
    busted() {
      tone(330, 0.3, 'sawtooth', 0.25, 110);
      tone(220, 0.5, 'sawtooth', 0.25, 80);
    },
  };
}
