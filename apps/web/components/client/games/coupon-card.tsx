"use client";

import { Ticket } from "lucide-react";
import { formatCouponCode } from "@nextin/shared/ads";
import { QrImage } from "@/components/admin/qr-image";
import type { Coupon } from "@/lib/client/games";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";

/** Bon de réduction gagné : QR code (lien `/coupon/<jeton>`, scanné en caisse) et code court lisible. */
export function CouponCard({ coupon, couponBaseUrl, advertiser }: { coupon: Coupon; couponBaseUrl: string; advertiser?: string }) {
  const t = useLiteT("games");
  const locale = useLiteLocale();
  const reward = locale === "en" && coupon.reward_en ? coupon.reward_en : coupon.reward;
  const until = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", timeZone: "Africa/Douala" }).format(new Date(coupon.expires_at));
  return (
    <section aria-labelledby="coupon-title" className="squircle flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-6 text-center shadow-card">
      <p id="coupon-title" className="flex items-center gap-2 text-headline">
        <Ticket aria-hidden className="size-5 text-accent-text" />
        {t("couponTitle")}
      </p>
      <p className="text-title3 font-bold">{reward}</p>
      {advertiser ? <p className="text-subheadline text-label-secondary">{t("sponsoredBy", { advertiser })}</p> : null}
      <QrImage value={`${couponBaseUrl}${coupon.qr_token}`} label={t("couponHint")} className="size-44 rounded-[12px]" />
      <p className="font-mono text-title2 font-bold tracking-widest">{formatCouponCode(coupon.code)}</p>
      <p className="text-footnote text-label-secondary">
        {t("couponHint")} {t("couponValid", { date: until })}
      </p>
    </section>
  );
}
