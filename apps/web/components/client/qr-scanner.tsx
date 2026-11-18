"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Flashlight, Keyboard, QrCode } from "lucide-react";
import { useLiteT } from "@/lib/i18n/lite";
import { entryCodeFromScan } from "@/lib/client/entry-code";
import { useQrCamera } from "@/lib/client/qr-camera";

const glass = "pressable inline-flex h-11 items-center gap-2 rounded-full bg-white/18 px-4 text-subheadline font-semibold text-white [&_svg]:size-5 [&_svg]:stroke-2";

/**
 * Scanner plein écran (maquette v2 02), toujours sombre : vue de la caméra arrière, cadre de visée, consigne et
 * boutons « verre » en bas (saisir le code, lampe si l'appareil la propose). La caméra démarre seule ; si le
 * navigateur la refuse, un message explique quoi faire et le cadre redevient un bouton. Décodage natif
 * (BarcodeDetector) ou, à défaut, jsQR chargé seulement à ce moment-là. La caméra exige une page sécurisée (https).
 */
export function QrScanner() {
  const t = useLiteT("client.scanner");
  const router = useRouter();
  const { video, phase, scanning, start, stop, torch, toggleTorch } = useQrCamera((text) => {
    const code = entryCodeFromScan(text);
    if (code) router.push(`/q/${code}`);
    return !!code;
  });

  useEffect(() => {
    void start();
    // Démarrage unique à l'ouverture ; la caméra est coupée en quittant la page (useQrCamera).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message =
    phase === "denied" ? t("cameraDenied") : phase === "unavailable" ? t("cameraUnavailable") : phase === "invalid" ? t("notNextin") : null;

  return (
    <main data-theme="dark" className="fixed inset-0 flex flex-col overflow-hidden bg-black text-white">
      <h1 className="sr-only">{t("title")}</h1>
      <video ref={video} muted playsInline aria-hidden className={scanning ? "absolute inset-0 size-full object-cover" : "hidden"} />
      <Link
        href="/"
        prefetch={false}
        aria-label={t("back")}
        className="pressable absolute top-[max(env(safe-area-inset-top),0.75rem)] left-3 z-10 flex size-11 items-center justify-center rounded-full bg-white/18"
      >
        <ChevronLeft aria-hidden className="size-6 stroke-[2.25]" />
      </Link>

      {/* Cadre de visée : quatre coins blancs ; sans caméra, il devient le bouton qui la démarre. */}
      <div className="relative flex flex-1 items-center justify-center pb-40">
        <button
          type="button"
          onClick={scanning ? stop : start}
          aria-label={scanning ? t("stop") : t("start")}
          className="relative aspect-square w-[min(62vw,18rem)]"
        >
          {(["top-0 left-0 border-r-0 border-b-0 rounded-tl-[18px]", "top-0 right-0 border-b-0 border-l-0 rounded-tr-[18px]", "bottom-0 left-0 border-t-0 border-r-0 rounded-bl-[18px]", "right-0 bottom-0 border-t-0 border-l-0 rounded-br-[18px]"] as const).map((c) => (
            <span key={c} aria-hidden className={`absolute size-[26%] border-4 border-white ${c}`} />
          ))}
          {!scanning ? (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-subheadline text-white/80">
              <QrCode aria-hidden className="size-10 stroke-[1.5]" />
              {t("start")}
            </span>
          ) : null}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-1.5 bg-black/55 px-5 pt-5 pb-[max(env(safe-area-inset-bottom),1.75rem)] text-center">
        <p className="text-headline">{t("aimTitle")}</p>
        <p className="text-footnote text-white/80">{t("aimBody")}</p>
        <p role="status" aria-live="polite" className="text-footnote text-white empty:hidden">
          {message}
        </p>
        <div className="mt-2.5 flex items-center justify-center gap-2.5">
          <Link href="/c" prefetch={false} className={glass}>
            <Keyboard aria-hidden />
            {t("code")}
          </Link>
          {torch !== null ? (
            <button type="button" onClick={toggleTorch} aria-pressed={torch} aria-label={t("torch")} className={`${glass} w-11 justify-center px-0`}>
              <Flashlight aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
