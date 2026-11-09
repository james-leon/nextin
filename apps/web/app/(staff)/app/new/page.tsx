import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { NewOrganizationForm } from "@/components/staff/new-organization-form";
import { requireStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { captchaConfig } from "@/lib/security/captcha";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orgNew");
  return { title: t("title") };
}

export default async function NewOrganizationPage() {
  await requireStaffSession("/app/new");
  const locale = await getLocale();
  // Formule de l'essai gratuit (réglée par le super admin, Business par défaut).
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.rpc("trial_plan");
  const plan = data as { name: string; name_en: string | null } | null;
  const trialPlan = plan ? (locale === "en" ? (plan.name_en ?? plan.name) : plan.name) : "";
  return (
    <main>
      <NewOrganizationForm siteKey={captchaConfig().siteKey} defaultLocale={locale} trialPlan={trialPlan} />
    </main>
  );
}
