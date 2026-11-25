/**
 * Socle des sons des jeux (Web Audio, aucun fichier à télécharger), tiré de Sky Catch : contexte audio créé seulement
 * dans un geste de l'utilisateur (les navigateurs bloquent le son avant), session « lecture » sur iPhone (son même en
 * mode silencieux) et tampon muet pour réveiller l'audio ; notes synthétisées et bruit filtré.
 * Utilisé par Sky Catch (`sky-audio.ts`), le quiz sans fin et les Paires (`game-sounds.ts`).
 */
export type AudioCore = ReturnType<typeof createAudioCore>;

export function createAudioCore(onCreate?: (ac: AudioContext) => void) {
  let ac: AudioContext | null = null;

  /** À appeler dans un geste de l'utilisateur : crée ou réveille le contexte audio. */
  function unlock(): void {
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
    } catch {
      // Sans effet ailleurs qu'en Safari.
    }
    if (!ac) {
      const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      try {
        ac = new AC();
        onCreate?.(ac);
      } catch {
        ac = null;
        return;
      }
    }
    if (ac.state !== "running") void ac.resume().catch(() => undefined);
    try {
      // Tampon muet : réveille l'audio d'iOS dans le geste.
      const buffer = ac.createBuffer(1, 1, 22050);
      const source = ac.createBufferSource();
      source.buffer = buffer;
      source.connect(ac.destination);
      source.start(0);
    } catch {
      // Sans incidence.
    }
  }

  /** Note : fréquence, durée (s), forme, volume, départ différé (s), sortie, glissement de fréquence. */
  function tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, dest?: AudioNode, slideTo?: number): void {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Bruit filtré qui s'éteint (choc sourd). */
  function noise(dur: number, vol: number, dest?: AudioNode): void {
    if (!ac) return;
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
    gain.connect(dest ?? ac.destination);
    source.start();
  }

  return {
    unlock,
    tone,
    noise,
    get ready() {
      return ac !== null;
    },
    close() {
      void ac?.close().catch(() => undefined);
      ac = null;
    },
  };
}
