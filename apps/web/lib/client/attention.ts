/**
 * Signal « c'est votre tour » quand la page est ouverte : vibration et deux notes courtes.
 * Le son exige un premier geste de l'utilisateur sur certains téléphones : `primeAttention` prépare
 * le contexte audio au premier toucher.
 */
let audio: AudioContext | null = null;

export function primeAttention() {
  const unlock = () => {
    try {
      audio ??= new AudioContext();
      void audio.resume();
    } catch {
      audio = null;
    }
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  return () => window.removeEventListener("pointerdown", unlock);
}

export function signalAttention() {
  navigator.vibrate?.([300, 150, 300, 150, 600]);
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  [880, 1175].forEach((freq, i) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + i * 0.28);
    gain.gain.exponentialRampToValueAtTime(0.3, now + i * 0.28 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.28 + 0.25);
    osc.connect(gain).connect(audio!.destination);
    osc.start(now + i * 0.28);
    osc.stop(now + i * 0.28 + 0.26);
  });
}
