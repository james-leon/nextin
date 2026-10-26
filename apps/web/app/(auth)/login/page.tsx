import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { safeNextPath } from "@nextin/shared";
import { messages } from "@nextin/shared/i18n";
import { LoginForm } from "@/components/auth/login-form";
import { captchaConfig } from "@/lib/security/captcha";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next, error } = await searchParams;
  const initialError = error && error in messages.fr.errors ? error : undefined;
  return <LoginForm next={safeNextPath(next)} siteKey={captchaConfig().siteKey} initialError={initialError} />;
}
