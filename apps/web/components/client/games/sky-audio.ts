import { SOUND_PREFS_KEY } from "@nextin/shared/ads/sky-catch";
import { createAudioCore } from "./game-audio";

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

type Gains = { music: GainNode; sfx: GainNode };

export function createSkyAudio(initial: SoundPrefs) {
  let gains: Gains | null = null;
  let prefs = initial;
  let timer: ReturnType<typeof setInterval> | null = null;
  let beat = 0;
  let level = 1;
  // Socle commun des jeux (`game-audio.ts`) : musique et effets sur deux sorties séparées.
  const core = createAudioCore((ac) => {
    const music = ac.createGain();
    music.gain.value = 0.3;
    music.connect(ac.destination);
    const sfx = ac.createGain();
    sfx.connect(ac.destination);
    gains = { music, sfx };
  });
  /** À appeler dans un geste de l'utilisateur : crée ou réveille le contexte audio. */
  const unlock = core.unlock;

  function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, dest?: AudioNode, slideTo?: number) {
    if (!gains) return;
    core.tone(freq, dur, type, vol, when, dest ?? gains.sfx, slideTo);
  }

  function noise(dur: number, vol: number) {
    if (gains) core.noise(dur, vol, gains.sfx);
  }

  function musicTick() {
    if (!gains || !prefs.music) return;
    const scale = SCALES[(level - 1) % 4]!;
    const note = MELODY[beat % 16]!;
    tone(scale[note]! * 2, 0.18, "triangle", 0.5, 0, gains.music);
    if (beat % 4 === 0) tone(scale[0]! / 2, 0.36, "sine", 0.7, 0, gains.music);
    if (beat % 8 === 6) tone(scale[2]! / 2, 0.3, "sine", 0.5, 0, gains.music);
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
      if (prefs.sfx && gains) effects[effect]();
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
      core.close();
      gains = null;
    },
  };
}

export type SkyAudio = ReturnType<typeof createSkyAudio>;
