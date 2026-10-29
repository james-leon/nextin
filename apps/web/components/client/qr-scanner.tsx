"use client";

import { useRouter } from "next/navigation";
import { useLiteT } from "@/lib/i18n/lite";
import { ScannerFrame } from "@/components/ui/scanner-frame";
import { entryCodeFromScan } from "@/lib/client/entry-code";
import { useQrCamera } from "@/lib/client/qr-camera";

/**
 * Visée du QR code dans le cadre (maquette 01). Caméra arrière à la demande ;
 * décodage natif (BarcodeDetector) ou, à défaut, jsQR chargé seulement à ce moment-là.
 * La caméra exige une page sécurisée (https) : sinon on invite à utiliser l'appareil photo du téléphone.
 */
export function QrScanner() {
  const t = useLiteT("client.scanner");
  const router = useRouter();
  const { video, phase, start, stop } = useQrCamera((text) => {
    const code = entryCodeFromScan(text);
    if (code) router.push(`/q/${code}`);
    return !!code;
  });

  const scanning = phase === "scanning" || phase === "invalid";
  const message =
    phase === "denied" ? t("cameraDenied") : phase === "unavailable" ? t("cameraUnavailable") : phase === "invalid" ? t("notNextin") : null;

  return (
    <div className="flex w-full max-w-64 flex-col items-center gap-4">
      <button
        type="button"
        onClick={scanning ? stop : start}
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
