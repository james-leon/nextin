import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, Ticket, XCircle } from "lucide-react";
import { absoluteUrl } from "@nextin/shared";
import { formatCouponCode } from "@nextin/shared/ads";
import { Button } from "@/components/ui/button";
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
        <NavigationBar variant="inline" title={t("title")} back={{ href: "/", label: t("title") }} contentClassName="max-w-lg" />
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
  return (
    <main className="min-h-dvh pb-16">
      <NavigationBar variant="inline" title={t("title")} contentClassName="max-w-lg" />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3">
        <section className="squircle flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-7 text-center shadow-card">
          <p className="text-subheadline text-label-secondary">{t("by", { advertiser: coupon.advertiser })}</p>
          <h1 className="text-title1 font-bold">{reward}</h1>
          <QrImage value={absoluteUrl(`/coupon/${token}`)} label={t("title")} className="size-52 rounded-[12px]" />
          <p className="text-footnote uppercase text-label-secondary">{t("code")}</p>
          <p className="font-mono text-title1 font-bold tracking-widest">{formatCouponCode(coupon.code)}</p>
        </section>
        {coupon.redeemed_at ? (
          <CalloutCard tone="green" icon={<CheckCircle2 />} role="status">
            {t("redeemed", { date: day(coupon.redeemed_at) })}
          </CalloutCard>
        ) : expired ? (
          <CalloutCard tone="red" icon={<XCircle />} role="status">
            {t("expired")}
          </CalloutCard>
        ) : (
          <CalloutCard tone="accent" icon={<Clock />}>
            {t("validUntil", { date: day(coupon.expires_at) })}
          </CalloutCard>
        )}
        {!coupon.redeemed_at && !expired ? (
          <div className="flex flex-col items-center gap-1 pt-2">
            <p className="text-footnote text-label-secondary">{t("merchant")}</p>
            <Button asChild variant="plain">
              <Link href={`/ads/redeem?code=${token}`} prefetch={false}>
                {t("redeem")}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
