import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { NewOrganizationForm } from "@/components/staff/new-organization-form";
import { requireStaffSession } from "@/lib/auth/session";
import { maskEmail } from "@nextin/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { captchaConfig } from "@/lib/security/captcha";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orgNew");
  return { title: t("title") };
}

export default async function NewOrganizationPage() {
  const session = await requireStaffSession("/app/new");
  const locale = await getLocale();
  // Formule de l'essai gratuit (réglée par le super admin, Business par défaut).
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.rpc("trial_plan");
  const plan = data as { name: string; name_en: string | null } | null;
  const trialPlan = plan ? (locale === "en" ? (plan.name_en ?? plan.name) : plan.name) : "";
  // Canal du code d'inscription (console Wintek) : e-mail du compte par défaut, SMS quand un fournisseur est prêt.
  const { data: settings } = await supabase.from("platform_settings").select("signup_code_channel").maybeSingle();
  const codeChannel = settings?.signup_code_channel === "sms" ? "phone" : "email";
  return (
    <main>
      <NewOrganizationForm
        siteKey={captchaConfig().siteKey}
        defaultLocale={locale}
        trialPlan={trialPlan}
        codeChannel={codeChannel}
        emailMasked={session.email ? maskEmail(session.email) : ""}
      />
    </main>
  );
}
