"use client";

import { useEffect, useRef, useState } from "react";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
export type QrCameraPhase = "idle" | "scanning" | "denied" | "unavailable" | "invalid";

/**
 * Caméra arrière et décodage de QR code (BarcodeDetector natif, sinon jsQR chargé à la demande). `accept` reçoit
 * chaque texte lu : `true` arrête la caméra (code reconnu), `false` signale un QR code étranger et continue.
 * La caméra exige une page sécurisée (https) : sinon `unavailable`, et l'interface propose la saisie du code.
 */
export function useQrCamera(accept: (text: string) => boolean) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const acceptRef = useRef(accept);
  const [phase, setPhase] = useState<QrCameraPhase>("idle");

  useEffect(() => {
    acceptRef.current = accept;
  });

  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => stop, []);

  async function start() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return setPhase("unavailable");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch (e) {
      return setPhase((e as DOMException)?.name === "NotAllowedError" ? "denied" : "unavailable");
    }
    setPhase("scanning");
    const el = video.current!;
    el.srcObject = stream.current;
    await el.play().catch(() => undefined);

    const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const native = Native ? new Native({ formats: ["qr_code"] }) : null;
    const jsQR = native ? null : (await import("jsqr")).default;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = async () => {
      if (!stream.current) return;
      let text: string | null = null;
      if (el.readyState >= 2) {
        if (native) {
          text = (await native.detect(el).catch(() => []))[0]?.rawValue ?? null;
        } else if (jsQR && ctx) {
          canvas.width = el.videoWidth;
          canvas.height = el.videoHeight;
          ctx.drawImage(el, 0, 0);
          text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data ?? null;
        }
      }
      if (text) {
        if (acceptRef.current(text)) {
          navigator.vibrate?.(60);
          stop();
          setPhase("idle");
          return;
        }
        setPhase("invalid");
      }
      setTimeout(tick, 250);
    };
    void tick();
  }

  return {
    video,
    phase,
    scanning: phase === "scanning" || phase === "invalid",
    start,
    stop: () => {
      stop();
      setPhase("idle");
    },
  };
}
