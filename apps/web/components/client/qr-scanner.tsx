"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiteT } from "@/lib/i18n/lite";
import { ScannerFrame } from "@/components/ui/scanner-frame";
import { entryCodeFromScan } from "@/lib/client/entry-code";

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type Phase = "idle" | "scanning" | "denied" | "unavailable" | "invalid";

/**
 * Visée du QR code dans le cadre (maquette 01). Caméra arrière à la demande ;
 * décodage natif (BarcodeDetector) ou, à défaut, jsQR chargé seulement à ce moment-là.
 * La caméra exige une page sécurisée (https) : sinon on invite à utiliser l'appareil photo du téléphone.
 */
export function QrScanner() {
  const t = useLiteT("client.scanner");
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

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
        const code = entryCodeFromScan(text);
        if (code) {
          navigator.vibrate?.(60);
          stop();
          router.push(`/q/${code}`);
          return;
        }
        setPhase("invalid");
      }
      setTimeout(tick, 250);
    };
    tick();
  }

  const scanning = phase === "scanning" || phase === "invalid";
  const message =
    phase === "denied" ? t("cameraDenied") : phase === "unavailable" ? t("cameraUnavailable") : phase === "invalid" ? t("notNextin") : null;

  return (
    <div className="flex w-full max-w-64 flex-col items-center gap-4">
      <button
        type="button"
        onClick={scanning ? () => (stop(), setPhase("idle")) : start}
        aria-label={scanning ? t("stop") : t("start")}
        className="pressable w-full rounded-[18%]"
      >
        <ScannerFrame scanning>
          <div className="relative flex h-full items-end justify-center bg-scanner-surface pb-12">
            <video ref={video} muted playsInline aria-hidden className={scanning ? "absolute inset-0 size-full object-cover" : "hidden"} />
            {!scanning ? (
              <span className="text-footnote text-white/75">{t("start")}</span>
            ) : (
              <span className="relative rounded-full bg-black/50 px-3 py-1 text-footnote text-white">{t("aim")}</span>
            )}
          </div>
        </ScannerFrame>
      </button>
      <p role="status" aria-live="polite" className="min-h-10 text-center text-subheadline text-white/80">
        {message}
      </p>
    </div>
  );
}
