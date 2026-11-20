import { SOUND_PREFS_KEY } from "@nextin/shared/ads/sky-catch";

/**
 * Sons de Sky Catch (maquette v2 12), tous générés par Web Audio : aucun fichier à télécharger (3G). Le contexte audio
 * n'est créé qu'au premier geste de l'utilisateur (« Jouer », un bouton de son) : les navigateurs bloquent le son
 * avant. Musique et effets se coupent séparément ; le choix est gardé sur l'appareil.
 */
export type SoundPrefs = { music: boolean; sfx: boolean };

export function readSoundPrefs(): SoundPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(SOUND_PREFS_KEY) ?? "null") as Partial<SoundPrefs> | null;
    return { music: raw?.music !== false, sfx: raw?.sfx !== false };
  } catch {
    return { music: true, sfx: true };
  }
}

export function saveSoundPrefs(prefs: SoundPrefs): void {
  try {
    localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Préférence non gardée (stockage indisponible) : elle vaut pour la partie en cours.
  }
}

// Musique : gamme pentatonique par décor, mélodie de 16 temps, basse tous les 4 temps.
const SCALES = [
  [262, 294, 330, 392, 440],
  [247, 277, 330, 370, 415],
  [220, 247, 294, 330, 392],
  [196, 233, 262, 294, 349],
];
const MELODY = [0, 2, 4, 2, 3, 1, 2, 0, 4, 3, 2, 4, 1, 2, 0, 2];

type Ctx = { ac: AudioContext; music: GainNode; sfx: GainNode };

export function createSkyAudio(initial: SoundPrefs) {
  let ctx: Ctx | null = null;
  let prefs = initial;
  let timer: ReturnType<typeof setInterval> | null = null;
  let beat = 0;
  let level = 1;

  /** À appeler dans un geste de l'utilisateur : crée ou réveille le contexte audio. */
  function unlock(): void {
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback"; // iPhone : son même en mode silencieux
    } catch {
      // Sans effet ailleurs.
    }
    if (!ctx) {
      const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        const ac = new AC();
        const music = ac.createGain();
        music.gain.value = 0.3;
        music.connect(ac.destination);
        const sfx = ac.createGain();
        sfx.connect(ac.destination);
        ctx = { ac, music, sfx };
      } catch {
        return;
      }
    }
    if (ctx.ac.state !== "running") void ctx.ac.resume().catch(() => undefined);
  }

  function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, dest?: AudioNode, slideTo?: number) {
    if (!ctx) return;
    const t = ctx.ac.currentTime + when;
    const o = ctx.ac.createOscillator();
    const g = ctx.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? ctx.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur: number, vol: number) {
    if (!ctx) return;
    const { ac } = ctx;
    const length = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 900;
    gain.gain.value = vol;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.sfx);
    source.start();
  }

  function musicTick() {
    if (!ctx || !prefs.music) return;
    const scale = SCALES[(level - 1) % 4]!;
    const note = MELODY[beat % 16]!;
    tone(scale[note]! * 2, 0.18, "triangle", 0.5, 0, ctx.music);
    if (beat % 4 === 0) tone(scale[0]! / 2, 0.36, "sine", 0.7, 0, ctx.music);
    if (beat % 8 === 6) tone(scale[2]! / 2, 0.3, "sine", 0.5, 0, ctx.music);
    beat += 1;
  }

  const effects = {
    /** Pièce : petit tintement montant. */
    coin: () => {
      tone(988, 0.09, "square", 0.12);
      tone(1319, 0.16, "square", 0.12, 0.07);
    },
    /** Gemme : carillon à trois notes. */
    gem: () => [1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, "triangle", 0.22, i * 0.07)),
    /** Obstacle : choc sourd. */
    hit: () => {
      noise(0.28, 0.7);
      tone(180, 0.35, "sawtooth", 0.25, 0, undefined, 60);
    },
    /** Nouveau niveau : courte fanfare. */
    level: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, "square", 0.12, i * 0.1));
      tone(1047, 0.5, "triangle", 0.2, 0.4);
    },
    /** Fin de partie : mélodie descendante. */
    over: () => {
      [659, 587, 523, 392].forEach((f, i) => tone(f, 0.32, "triangle", 0.28, i * 0.22));
      tone(196, 0.8, "sine", 0.3, 0.9);
    },
  };

  return {
    unlock,
    play(effect: keyof typeof effects) {
      if (prefs.sfx && ctx) effects[effect]();
    },
    /** Musique en boucle, tempo selon le niveau (plus vive à chaque niveau). */
    startMusic(currentLevel: number) {
      level = currentLevel;
      if (timer) clearInterval(timer);
      timer = setInterval(musicTick, 60000 / (112 + ((currentLevel - 1) % 8) * 10) / 2);
    },
    stopMusic() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    setPrefs(next: SoundPrefs) {
      prefs = next;
      saveSoundPrefs(next);
    },
    close() {
      if (timer) clearInterval(timer);
      timer = null;
      void ctx?.ac.close().catch(() => undefined);
      ctx = null;
    },
  };
}

export type SkyAudio = ReturnType<typeof createSkyAudio>;
