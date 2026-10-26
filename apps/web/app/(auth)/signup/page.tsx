import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { safeNextPath } from "@nextin/shared";
import { SignupForm } from "@/components/auth/signup-form";
import { captchaConfig } from "@/lib/security/captcha";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signupTitle") };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next } = await searchParams;
  return <SignupForm next={safeNextPath(next)} siteKey={captchaConfig().siteKey} />;
}
