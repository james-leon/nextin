import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { safeNextPath } from "@nextin/shared";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { requireStaffSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mfa");
  return { title: t("challengeTitle") };
}

/** Saisie du code de double authentification (B5), après la connexion ou avant une action sensible. */
export default async function MfaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next);
  const session = await requireStaffSession(`/mfa?next=${encodeURIComponent(target)}`, { mfa: false });
  // Aucun facteur : configuration d'abord.
  if (!session.mfa.enrolled) redirect(`/app/settings/security?setup=1&next=${encodeURIComponent(target)}`);
  return <MfaChallengeForm next={target} />;
}
