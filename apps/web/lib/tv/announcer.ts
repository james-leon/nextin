import {
  announcementSegments,
  announcementText,
  inQuietHours,
  type AnnouncementInput,
  type AnnouncementLanguage,
} from "@nextin/shared/announcements";

export type AnnouncerSettings = {
  languages: AnnouncementLanguage[];
  volume: number;
  repeatCount: number;
  chimeEnabled: boolean;
  quietHours: { from: string; to: string }[];
  timeZone: string;
};

const SEGMENT_TIMEOUT_MS = 4_000;
const CACHE = "nextin-voices";

/**
 * Annonces vocales de l'écran TV (§5.6) : une annonce à la fois, répétitions, volume, plages de silence.
 * Segments préenregistrés (bucket public `voices`, liste dans manifest.json) mis en cache ;
 * s'il en manque un, la phrase entière passe par la synthèse vocale du navigateur.
 * Le son exige un premier geste (politique de lecture automatique) : `unlock()`.
 */
export class Announcer {
  private queue: AnnouncementInput[] = [];
  private playing = false;
  private audio: AudioContext | null = null;
  private available = new Set<string>();
  private settings: AnnouncerSettings = { languages: ["fr"], volume: 80, repeatCount: 1, chimeEnabled: true, quietHours: [], timeZone: "Africa/Douala" };

  constructor(private readonly voicesBase: string | null) {}

  get unlocked(): boolean {
    return this.audio?.state === "running";
  }

  /** Charge la liste des segments disponibles (absente : synthèse vocale seule). */
  async loadManifest(): Promise<void> {
    if (!this.voicesBase) return;
    try {
      const res = await fetch(`${this.voicesBase}/manifest.json`, { cache: "no-cache" });
      if (!res.ok) return;
      const body = (await res.json()) as { keys?: string[] };
      this.available = new Set(body.keys ?? []);
    } catch {
      this.available = new Set();
    }
  }

  async unlock(): Promise<boolean> {
    try {
      this.audio ??= new AudioContext();
      await this.audio.resume();
      // Réveille aussi la synthèse vocale (certains navigateurs l'exigent après un geste).
      if ("speechSynthesis" in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    } catch {
      return false;
    }
    return this.unlocked;
  }

  configure(settings: AnnouncerSettings) {
    this.settings = settings;
  }

  announce(input: Omit<AnnouncementInput, "languages" | "chime">) {
    if (inQuietHours(this.settings.quietHours, new Date(), this.settings.timeZone)) return;
    this.queue.push({ ...input, languages: this.settings.languages, chime: this.settings.chimeEnabled });
    void this.drain();
  }

  private async drain() {
    if (this.playing) return;
    this.playing = true;
    try {
      while (this.queue.length) {
        const next = this.queue.shift()!;
        for (let i = 0; i < this.settings.repeatCount; i++) {
          await this.play(next);
          await wait(600);
        }
      }
    } finally {
      this.playing = false;
    }
  }

  private async play(input: AnnouncementInput) {
    if (!this.unlocked) return;
    const segments = announcementSegments(input);
    const recorded = segments && this.voicesBase && segments.every((k) => k === "chime" || this.available.has(k));
    if (recorded) {
      for (const key of segments!) {
        if (key === "chime") await this.chime();
        else await this.playSegment(key);
      }
      return;
    }
    if (input.chime) await this.chime();
    for (const lang of input.languages) await speak(announcementText(lang, input), lang, this.settings.volume);
  }

  /** Carillon à deux notes, synthétisé (aucun fichier à charger). */
  private async chime() {
    const ctx = this.audio!;
    const t0 = ctx.currentTime;
    const gainMax = 0.35 * (this.settings.volume / 100);
    [659.25, 523.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.45);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainMax), t0 + i * 0.45 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.45 + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + i * 0.45);
      osc.stop(t0 + i * 0.45 + 0.95);
    });
    await wait(1_300);
  }

  private async playSegment(key: string) {
    const src = await cachedUrl(`${this.voicesBase}/${key}.mp3`);
    await new Promise<void>((resolve) => {
      const el = new Audio(src);
      el.volume = this.settings.volume / 100;
      const done = () => resolve();
      el.onended = done;
      el.onerror = done;
      setTimeout(done, SEGMENT_TIMEOUT_MS);
      el.play().catch(done);
    });
  }
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Segment servi depuis le cache local (Cache Storage, si disponible : https uniquement). */
async function cachedUrl(url: string): Promise<string> {
  if (typeof caches === "undefined") return url;
  try {
    const cache = await caches.open(CACHE);
    let res = await cache.match(url);
    if (!res) {
      const fresh = await fetch(url);
      if (!fresh.ok) return url;
      await cache.put(url, fresh.clone());
      res = fresh;
    }
    return URL.createObjectURL(await res.blob());
  } catch {
    return url;
  }
}

function speak(text: string, lang: AnnouncementLanguage, volume: number): Promise<void> {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "fr" ? "fr-FR" : "en-GB";
    u.volume = volume / 100;
    u.rate = 0.95;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang));
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    setTimeout(resolve, 10_000);
  });
}
