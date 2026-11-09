import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { safeNextPath } from "@nextin/shared";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { requireStaffSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("resetTitle") };
}

/** Choix d'un nouveau mot de passe, après connexion par code (« Mot de passe oublié ? »). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next);
  await requireStaffSession(`/reset-password?next=${encodeURIComponent(target)}`);
  return <ResetPasswordForm next={target} />;
}
