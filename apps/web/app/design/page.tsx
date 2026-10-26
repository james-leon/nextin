import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { DesignShowcase } from "@/components/design/design-showcase";
import { ToastProvider } from "@/components/ui/toast";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("design");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function DesignPage() {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ common: messages.common, theme: messages.theme, design: messages.design }}>
      <ToastProvider>
        <main>
          <DesignShowcase />
        </main>
      </ToastProvider>
    </NextIntlClientProvider>
  );
}
