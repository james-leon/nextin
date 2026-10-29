"use client";

import { useActionState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock, ScanLine, Ticket, XCircle } from "lucide-react";
import { redeemCoupon } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { TextField } from "@/components/ui/text-field";
import { formatDay } from "@/lib/billing/format";
import { useQrCamera } from "@/lib/client/qr-camera";

/** Jeton d'un bon lu dans un QR code (`…/coupon/<jeton>`) ou code saisi tel quel. */
function couponFromScan(text: string): string | null {
  const fromUrl = /\/coupon\/([A-Za-z0-9]{22})(?:[/?#]|$)/.exec(text.trim());
  if (fromUrl) return fromUrl[1]!;
  return /^([A-Za-z0-9]{22}|[A-Za-z0-9]{8})$/.test(text.trim()) ? text.trim() : null;
}

/**
 * Validation d'un bon en caisse : vérification (récompense, validité) puis validation explicite. Le QR code du client
 * se scanne ici avec la caméra (page sécurisée), ou ouvre `/coupon/<jeton>` qui renvoie ici avec le jeton pré-rempli ;
 * sinon, saisie du code.
 */
export function RedeemForm({ initialCode }: { initialCode: string }) {
  const t = useTranslations("ads");
  const locale = useLocale() === "en" ? "en" : "fr";
  const [state, action, pending] = useActionState(redeemCoupon, null);
  const { field, top } = useFormErrors(state);
  const coupon = state?.ok ? state.coupon : undefined;
  const reward = coupon ? (locale === "en" && coupon.reward_en ? coupon.reward_en : coupon.reward) : "";
  const usable = coupon && !coupon.redeemed_at && !coupon.expired;
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { video, phase, scanning, start, stop } = useQrCamera((text) => {
    const code = couponFromScan(text);
    if (!code || !inputRef.current) return false;
    inputRef.current.value = code;
    formRef.current?.requestSubmit();
    return true;
  });
  const cameraMessage =
    phase === "invalid" ? t("scanInvalid") : phase === "unavailable" ? t("scanUnavailable") : phase === "denied" ? t("scanDenied") : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="px-4 text-subheadline text-label-secondary">{t("redeemBody")}</p>
      <section className="flex flex-col gap-3">
        {/* Un seul élément vidéo (le flux de la caméra y est attaché), visible pendant la visée. */}
        <div
          className={
            scanning ? "squircle relative aspect-square w-full max-w-sm self-center overflow-hidden rounded-[var(--radius-xl)] bg-scanner" : "hidden"
          }
        >
          <video ref={video} muted playsInline aria-hidden className="absolute inset-0 size-full object-cover" />
          <span className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-black/60 px-3 py-1 text-footnote text-white">{t("scanAim")}</span>
        </div>
        <Button type="button" variant="tinted" leadingIcon={<ScanLine />} onClick={scanning ? stop : start} className="self-start">
          {scanning ? t("scanStop") : t("scan")}
        </Button>
        <p role="status" aria-live="polite" className="px-4 text-footnote text-label-secondary empty:hidden">
          {cameraMessage}
        </p>
      </section>
      <form ref={formRef} action={action} noValidate className="flex flex-col gap-4" id="redeem-check">
        <FormError message={top} />
        <TextField
          ref={inputRef}
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
        <Button type="submit" variant="gray" loading={pending && !usable} loadingLabel={t("checking")} className="self-start">
          {t("check")}
        </Button>
      </form>

      {coupon ? (
        <section aria-live="polite" className="squircle flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-7 text-center shadow-card">
          <span className="squircle flex size-14 items-center justify-center rounded-[16px] bg-accent-tint text-accent-on-tint">
            <Ticket aria-hidden className="size-7 stroke-[1.5]" />
          </span>
          <p className="font-mono text-title2 font-bold tracking-widest">{coupon.code}</p>
          <p className="text-headline">{reward}</p>
          <p className="text-subheadline text-label-secondary">{coupon.campaign}</p>
          {coupon.redeemed_at ? (
            <CalloutCard tone="green" icon={<CheckCircle2 />} role="status" className="w-full text-left">
              {t("redeemed", { date: formatDay(coupon.redeemed_at, locale) })}
            </CalloutCard>
          ) : coupon.expired ? (
            <CalloutCard tone="red" icon={<XCircle />} role="alert" className="w-full text-left">
              {t("expired", { date: formatDay(coupon.expires_at, locale) })}
            </CalloutCard>
          ) : (
            <p className="flex items-center gap-1.5 text-footnote text-label-secondary">
              <Clock aria-hidden className="size-4" />
              {t("validUntil", { date: formatDay(coupon.expires_at, locale) })}
            </p>
          )}
        </section>
      ) : null}

      {usable ? (
        <form action={action}>
          <input type="hidden" name="code" value={coupon.code} />
          <input type="hidden" name="confirm" value="1" />
          <BottomBar>
            <Button type="submit" block loading={pending} loadingLabel={t("checking")}>
              {t("redeem")}
            </Button>
          </BottomBar>
        </form>
      ) : null}
    </div>
  );
}
