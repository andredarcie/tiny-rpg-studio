type SoundName =
  | 'playerAttack'
  | 'playerHit'
  | 'playerDeath'
  | 'enemyHit'
  | 'enemyDeath'
  | 'itemPickup'
  | 'levelUp'
  | 'miss'
  | 'backstab'
  | 'roomTransition'
  | 'dialog'
  | 'switchToggle'
  | 'doorUnlock'
  | 'victory'
  | 'gameStart'
  | 'skillPick';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    const Win = window as Window & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    const Ctor = Win.AudioContext ?? Win.webkitAudioContext;
    if (!Ctor) return null;
    if (!this.ctx) {
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // Plays a single oscillator note with optional frequency sweep and volume envelope
  private tone(
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    volume = 0.25,
    freqEnd?: number,
  ): void {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), startTime + duration);
    }

    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }

  play(sound: SoundName): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;

    switch (sound) {
      case 'playerAttack':   this.sfxPlayerAttack(t);   break;
      case 'playerHit':      this.sfxPlayerHit(t);      break;
      case 'playerDeath':    this.sfxPlayerDeath(t);    break;
      case 'enemyHit':       this.sfxEnemyHit(t);       break;
      case 'enemyDeath':     this.sfxEnemyDeath(t);     break;
      case 'itemPickup':     this.sfxItemPickup(t);     break;
      case 'levelUp':        this.sfxLevelUp(t);        break;
      case 'miss':           this.sfxMiss(t);           break;
      case 'backstab':       this.sfxBackstab(t);       break;
      case 'roomTransition': this.sfxRoomTransition(t); break;
      case 'dialog':         this.sfxDialog(t);         break;
      case 'switchToggle':   this.sfxSwitchToggle(t);   break;
      case 'doorUnlock':     this.sfxDoorUnlock(t);     break;
      case 'victory':        this.sfxVictory(t);        break;
      case 'gameStart':      this.sfxGameStart(t);      break;
      case 'skillPick':      this.sfxSkillPick(t);      break;
    }
  }

  // --- Combat ---

  // Sword swing: sharp descending sweep, two-stage
  private sfxPlayerAttack(t: number): void {
    this.tone(880, 'square', t, 0.04, 0.26, 330);
    this.tone(330, 'square', t + 0.03, 0.05, 0.16, 165);
  }

  // Backstab: two rapid high-pitched strikes (sneaky critical)
  private sfxBackstab(t: number): void {
    this.tone(1320, 'square', t, 0.03, 0.24, 660);
    this.tone(1760, 'square', t + 0.025, 0.04, 0.20, 880);
  }

  // Damage taken: descending low thud
  private sfxPlayerHit(t: number): void {
    this.tone(260, 'square', t, 0.18, 0.30, 85);
  }

  // Death: slow sad descending 6-note minor walk
  private sfxPlayerDeath(t: number): void {
    const notes = [494, 392, 330, 294, 262, 220]; // B4 G4 E4 D4 C4 A3
    notes.forEach((freq, i) => {
      this.tone(freq, 'square', t + i * 0.19, 0.17, 0.24);
    });
  }

  // Enemy takes a hit: short high blip
  private sfxEnemyHit(t: number): void {
    this.tone(880, 'square', t, 0.055, 0.20, 440);
  }

  // Enemy death: classic 4-note descending death jingle
  private sfxEnemyDeath(t: number): void {
    const notes = [784, 659, 523, 392]; // G5 E5 C5 G4
    notes.forEach((freq, i) => {
      this.tone(freq, 'square', t + i * 0.075, 0.07, 0.20);
    });
  }

  // Miss: single short low boop
  private sfxMiss(t: number): void {
    this.tone(165, 'square', t, 0.09, 0.13);
  }

  // --- Exploration ---

  // Room transition: soft ascending warp sweep
  private sfxRoomTransition(t: number): void {
    this.tone(330, 'triangle', t, 0.12, 0.16, 660);
    this.tone(660, 'triangle', t + 0.07, 0.10, 0.12, 1320);
  }

  // Dialog opens: brief soft text-blip
  private sfxDialog(t: number): void {
    this.tone(523, 'square', t, 0.04, 0.10);
  }

  // Switch toggled on/off: mechanical click-chunk
  private sfxSwitchToggle(t: number): void {
    this.tone(330, 'square', t, 0.03, 0.22, 220);
    this.tone(440, 'square', t + 0.03, 0.05, 0.16);
  }

  // Door unlocked: down-then-up key-turn sound
  private sfxDoorUnlock(t: number): void {
    this.tone(440, 'square', t, 0.04, 0.18, 220);
    this.tone(330, 'square', t + 0.05, 0.04, 0.14, 554);
    this.tone(659, 'square', t + 0.09, 0.10, 0.20);
  }

  // --- UI / Progression ---

  // Game start / intro dismissed: short 4-note title jingle
  private sfxGameStart(t: number): void {
    const notes = [262, 330, 392, 523]; // C4 E4 G4 C5
    notes.forEach((freq, i) => {
      this.tone(freq, 'square', t + i * 0.09, 0.12, 0.20);
    });
  }

  // Skill selected: bright two-note confirmation G5→C6
  private sfxSkillPick(t: number): void {
    this.tone(784, 'square', t, 0.06, 0.20);
    this.tone(1047, 'square', t + 0.055, 0.10, 0.18);
  }

  // Level up: triumphant ascending fanfare + sustained final chord
  private sfxLevelUp(t: number): void {
    const notes = [523, 659, 784, 1047, 1319, 1568]; // C5→E5→G5→C6→E6→G6
    notes.forEach((freq, i) => {
      this.tone(freq, 'square', t + i * 0.1, 0.14, 0.20);
    });
    const chord = t + notes.length * 0.1;
    this.tone(1047, 'square', chord, 0.38, 0.18);
    this.tone(1319, 'square', chord, 0.38, 0.14);
    this.tone(1568, 'square', chord, 0.38, 0.11);
  }

  // Item collected: ascending 5-note jingle C5→E5→G5→C6→E6
  private sfxItemPickup(t: number): void {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      this.tone(freq, 'square', t + i * 0.065, 0.06, 0.17);
    });
  }

  // Victory / game completion: big triumphant fanfare in two waves
  private sfxVictory(t: number): void {
    // First wave: C4 ascending arpeggio
    const wave1 = [262, 330, 392, 523, 659, 784];
    wave1.forEach((freq, i) => {
      this.tone(freq, 'square', t + i * 0.09, 0.13, 0.18);
    });
    // Second wave: higher register C5 arpeggio
    const offset = wave1.length * 0.09 + 0.05;
    const wave2 = [523, 659, 784, 1047, 1319, 1568];
    wave2.forEach((freq, i) => {
      this.tone(freq, 'square', t + offset + i * 0.08, 0.12, 0.16);
    });
    // Final sustained chord
    const chord = t + offset + wave2.length * 0.08 + 0.02;
    this.tone(523,  'square', chord, 0.5, 0.16);
    this.tone(659,  'square', chord, 0.5, 0.13);
    this.tone(784,  'square', chord, 0.5, 0.11);
    this.tone(1047, 'square', chord, 0.5, 0.09);
  }
}

export type { SoundName };
export const soundEngine = new SoundEngine();
