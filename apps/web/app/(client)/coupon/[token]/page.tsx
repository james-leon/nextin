import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, Ticket, XCircle } from "lucide-react";
import { absoluteUrl } from "@nextin/shared";
import { formatCouponCode } from "@nextin/shared/ads";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { callRpc } from "@/lib/client/supabase-public";
import { QrImage } from "@/components/admin/qr-image";

type CouponView = { code: string; reward: string; reward_en: string | null; expires_at: string; redeemed_at: string | null; advertiser: string };

const TOKEN = /^[A-Za-z0-9]{22}$/;

/** Bon expiré à l'heure du rendu (page dynamique, jamais mise en cache). */
function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("coupon");
  // Lien personnel : jamais indexé, jamais transmis comme référent.
  return { title: t("title"), robots: { index: false }, referrer: "no-referrer" };
}

/**
 * Bon de réduction gagné pendant l'attente : QR code et code court à présenter en caisse. Le commerçant connecté le
 * valide depuis son espace annonceur (le QR code ouvre cette page, qui y renvoie).
 */
export default async function CouponPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("coupon");
  const locale = await getLocale();
  const { data: coupon } = TOKEN.test(token) ? await callRpc<CouponView | null>("coupon_view", { p_qr_token: token }) : { data: null };
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Douala" }).format(new Date(iso));

  if (!coupon) {
    return (
      <main className="min-h-dvh pb-16">
        <NavigationBar title={t("title")} back={{ href: "/t", label: t("back") }} contentClassName="max-w-lg" />
        <div className="mx-auto max-w-lg px-4 pt-3">
          <CalloutCard icon={<Ticket />} tone="red" role="alert">
            {t("notFound")}
          </CalloutCard>
        </div>
      </main>
    );
  }

  const expired = isPast(coupon.expires_at);
  const reward = locale === "en" && coupon.reward_en ? coupon.reward_en : coupon.reward;
  const usable = !coupon.redeemed_at && !expired;
  // Maquette v2 21 : un vrai bon à découper — en-tête de couleur (annonceur et avantage), pointillés, QR et code ;
  // utilisé ou expiré : QR grisé et pastille d'état.
  return (
    <main className="min-h-dvh pb-16">
      <NavigationBar title={t("title")} back={{ href: "/t", label: t("back") }} contentClassName="max-w-lg" />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-3">
        <section className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary">
          <div className={usable ? "bg-called px-5 py-4 text-white" : "bg-fill-secondary px-5 py-4"}>
            <p className={usable ? "text-footnote" : "text-footnote text-label-secondary"}>{t("by", { advertiser: coupon.advertiser })}</p>
            <h1 className="text-title2 font-bold [text-wrap:balance]">{reward}</h1>
          </div>
          <div aria-hidden className={usable ? "border-t-2 border-dashed border-called" : "border-t-2 border-dashed border-separator"} />
          <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
            <QrImage
              value={absoluteUrl(`/coupon/${token}`)}
              label={t("title")}
              className={usable ? "size-48 rounded-[12px]" : "size-48 rounded-[12px] opacity-30 grayscale"}
            />
            <p className="text-footnote text-label-secondary">{t("code")}</p>
            <p className="font-rounded text-title1 font-bold tracking-widest text-ticket-number">{formatCouponCode(coupon.code)}</p>
            {coupon.redeemed_at ? (
              <Badge shape="pill" tone="neutral" role="status">
                <CheckCircle2 aria-hidden />
                {t("redeemed", { date: day(coupon.redeemed_at) })}
              </Badge>
            ) : expired ? (
              <Badge shape="pill" tone="red" role="status">
                <XCircle aria-hidden />
                {t("expired")}
              </Badge>
            ) : (
              <Badge shape="pill" tone="green">
                <Clock aria-hidden />
                {t("validUntil", { date: day(coupon.expires_at) })}
              </Badge>
            )}
          </div>
        </section>
        {usable ? (
          <div className="flex flex-col items-start gap-1 px-4">
            <p className="text-footnote text-label-secondary">
              {t("show")} {t("merchant")}
            </p>
            <Link href={`/ads/redeem?code=${token}`} prefetch={false} className="inline-flex min-h-11 items-center text-subheadline font-semibold text-accent-text">
              {t("redeem")}
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
