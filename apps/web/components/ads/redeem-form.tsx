"use client";

import { useActionState, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ScanLine, X } from "lucide-react";
import { redeemCoupon } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { formatDay } from "@/lib/billing/format";
import { useQrCamera } from "@/lib/client/qr-camera";
import { cn } from "@/lib/cn";

/** Jeton d'un bon lu dans un QR code (`…/coupon/<jeton>`) ou code saisi tel quel. */
function couponFromScan(text: string): string | null {
  const fromUrl = /\/coupon\/([A-Za-z0-9]{22})(?:[/?#]|$)/.exec(text.trim());
  if (fromUrl) return fromUrl[1]!;
  return /^([A-Za-z0-9]{22}|[A-Za-z0-9]{8})$/.test(text.trim()) ? text.trim() : null;
}

/**
 * Valider un bon en caisse (maquette v2 24) : zone sombre de la caméra (« Visez le QR code du client ») ou code saisi,
 * puis « Vérifier ». Résultat : grand rond vert « Bon valable » (offre, campagne, validité) et « Valider le bon » ;
 * après validation « Bon validé le … » ; bon expiré ou déjà utilisé : écran rouge avec la date. Remonté (clé) pour
 * vérifier un autre bon.
 */
export function RedeemForm({ initialCode }: { initialCode: string }) {
  const [round, setRound] = useState(0);
  return <RedeemRound key={round} initialCode={round ? "" : initialCode} onAnother={() => setRound((r) => r + 1)} />;
}

function RedeemRound({ initialCode, onAnother }: { initialCode: string; onAnother: () => void }) {
  const t = useTranslations("ads");
  const tr = useTranslations("ads.redeemResult");
  const locale = useLocale() === "en" ? "en" : "fr";
  const [state, action, pending] = useActionState(redeemCoupon, null);
  const { field, top } = useFormErrors(state);
  const coupon = state?.ok ? state.coupon : undefined;
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { video, phase, scanning, start, stop } = useQrCamera((text) => {
    const code = couponFromScan(text);
    if (!code || !inputRef.current) return false;
    inputRef.current.value = code;
    formRef.current?.requestSubmit();
    return true;
  });
  const cameraMessage = phase === "invalid" ? t("scanInvalid") : phase === "unavailable" ? t("scanUnavailable") : phase === "denied" ? t("scanDenied") : null;

  if (coupon) {
    const reward = locale === "en" && coupon.reward_en ? coupon.reward_en : coupon.reward;
    const confirmed = !!(state?.ok && state.confirmed && coupon.redeemed_at);
    const outcome = confirmed ? "redeemed" : coupon.redeemed_at ? "used" : coupon.expired ? "expired" : "valid";
    const good = outcome === "valid" || outcome === "redeemed";
    return (
      <section aria-live="polite" data-testid="coupon-result" data-outcome={outcome} className="flex flex-col items-center gap-5 text-center">
        <span aria-hidden className={cn("mt-4 flex size-18 items-center justify-center rounded-full text-white [&_svg]:size-9 [&_svg]:stroke-[2.6]", good ? "bg-green" : "bg-red")}>
          {good ? <Check /> : <X />}
        </span>
        <h2 className="text-title2 font-bold">{tr(outcome)}</h2>
        <dl className="squircle flex w-full flex-col gap-2.5 rounded-[var(--radius-lg)] bg-grouped-secondary p-4 text-left text-subheadline">
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-label-secondary">{tr("offer")}</dt>
            <dd className="min-w-0 text-right">{reward}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-label-secondary">{tr("campaign")}</dt>
            <dd className="min-w-0 text-right">{coupon.campaign}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="shrink-0 text-label-secondary">{tr("validUntil")}</dt>
            <dd className="min-w-0 text-right">{formatDay(coupon.expires_at, locale)}</dd>
          </div>
        </dl>
        <p role={good ? "status" : "alert"} className={cn("px-4 text-subheadline", good ? "text-label-secondary" : "font-semibold text-red-text")}>
          {outcome === "valid"
            ? tr("oneUse")
            : outcome === "redeemed"
              ? tr("redeemedOn", { date: formatDay(coupon.redeemed_at!, locale) })
              : outcome === "used"
                ? tr("usedOn", { date: formatDay(coupon.redeemed_at!, locale) })
                : tr("expiredOn", { date: formatDay(coupon.expires_at, locale) })}
        </p>
        <FormError message={top} />
        {outcome === "valid" ? (
          <form action={action} className="contents">
            <input type="hidden" name="code" value={coupon.code} />
            <input type="hidden" name="confirm" value="1" />
            <BottomBar dock={false} className="w-full">
              <Button type="submit" block loading={pending} loadingLabel={t("checking")}>
                {t("redeem")}
              </Button>
              <Button type="button" variant="plain" block onClick={onAnother}>
                {tr("another")}
              </Button>
            </BottomBar>
          </form>
        ) : (
          <BottomBar dock={false} className="w-full">
            <Button type="button" variant="tinted" block onClick={onAnother} leadingIcon={<ScanLine />}>
              {tr("another")}
            </Button>
          </BottomBar>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Zone sombre de la caméra : le flux s'y affiche pendant la visée (une seule balise vidéo). */}
      <div className="squircle relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[var(--radius-xl)] bg-scanner" data-testid="redeem-camera">
        <video ref={video} muted playsInline aria-hidden className={cn("absolute inset-0 size-full object-cover", !scanning && "hidden")} />
        <span aria-hidden className="absolute inset-[22%] rounded-[18px] shadow-[0_0_0_999px_rgb(0_0_0/0.45)]">
          <span className="absolute -top-0.5 -left-0.5 size-7 rounded-tl-[12px] border-t-4 border-l-4 border-white" />
          <span className="absolute -right-0.5 -bottom-0.5 size-7 rounded-br-[12px] border-r-4 border-b-4 border-white" />
        </span>
        {scanning ? (
          <Button type="button" variant="gray" size="md" onClick={stop} className="absolute top-3 right-3">
            {t("scanStop")}
          </Button>
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <Button type="button" variant="tinted" leadingIcon={<ScanLine />} onClick={start}>
              {t("scan")}
            </Button>
          </span>
        )}
        <span className="absolute inset-x-0 bottom-3 text-center text-footnote text-white">{t("scanAim")}</span>
      </div>
      <p role="status" aria-live="polite" className="px-4 text-footnote text-label-secondary empty:hidden">
        {cameraMessage}
      </p>
      <form ref={formRef} action={action} noValidate className="flex flex-col gap-4" id="redeem-check">
        <FormError message={top} />
        <FormGroup>
          <TextField
            ref={inputRef}
            grouped
            name="code"
            label={t("code")}
            defaultValue={initialCode}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={22}
            required
            error={field("code")}
            className="[&_input]:font-mono [&_input]:tracking-widest"
          />
        </FormGroup>
        <BottomBar dock={false}>
          <Button type="submit" variant="tinted" block loading={pending} loadingLabel={t("checking")}>
            {t("check")}
          </Button>
        </BottomBar>
      </form>
    </div>
  );
}
