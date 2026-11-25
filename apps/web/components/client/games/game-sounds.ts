"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_TUNES, type GameTune } from "@/lib/games/game-tunes";
import { createAudioCore, type AudioCore } from "./game-audio";

/**
 * Sons du quiz sans fin et des Paires (maquettes v2 10 et 11), fréquences exactes des maquettes, générés par Web Audio
 * (`game-audio.ts`, aucun fichier). Rien ne sonne avant un geste : le contexte audio est créé au premier toucher,
 * clic ou touche dans la feuille de jeu. Bouton « Sons » commun aux deux jeux, réglage gardé sur l'appareil.
 */
export const GAMES_SOUND_KEY = "nextin.games.sound";

export function readGamesSound(): boolean {
  try {
    return localStorage.getItem(GAMES_SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeGamesSound(on: boolean) {
  try {
    localStorage.setItem(GAMES_SOUND_KEY, on ? "on" : "off");
  } catch {
    // Réglage non gardé (stockage indisponible) : il vaut pour la partie en cours.
  }
}


let shared: AudioCore | null = null;

/**
 * Sons d'un jeu : `on` (réglage de l'appareil), `toggle` (bouton « Sons ») et `play(air)`. Le contexte audio est
 * débloqué au premier geste dans la page (capture : avant le clic du jeu lui-même).
 */
export function useGameSounds() {
  const [on, setOn] = useState(readGamesSound);
  const onRef = useRef(on);
  useEffect(() => {
    onRef.current = on;
  }, [on]);

  useEffect(() => {
    shared ??= createAudioCore();
    const core = shared;
    const events = ["pointerdown", "touchstart", "keydown"] as const;
    const unlock = () => {
      core.unlock();
      for (const e of events) document.removeEventListener(e, unlock, true);
    };
    for (const e of events) document.addEventListener(e, unlock, { capture: true, passive: true });
    return () => {
      for (const e of events) document.removeEventListener(e, unlock, true);
    };
  }, []);

  const play = useCallback((tune: GameTune) => {
    if (!onRef.current || !shared?.ready) return;
    for (const n of GAME_TUNES[tune]) shared.tone(n.f, n.d, n.type, n.v, n.at, undefined, n.to);
  }, []);

  const toggle = useCallback(() => {
    setOn((value) => {
      writeGamesSound(!value);
      return !value;
    });
  }, []);

  return { on, toggle, play };
}
