import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { NewOrganizationForm } from "@/components/staff/new-organization-form";
import { requireStaffSession } from "@/lib/auth/session";
import { captchaConfig } from "@/lib/security/captcha";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("orgNew");
  return { title: t("title") };
}

export default async function NewOrganizationPage() {
  await requireStaffSession("/app/new");
  const locale = await getLocale();
  return (
    <main>
      <NewOrganizationForm siteKey={captchaConfig().siteKey} defaultLocale={locale} />
    </main>
  );
}
