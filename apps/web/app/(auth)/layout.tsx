import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { LocaleSwitch } from "@/components/auth/locale-switch";
import { Logo } from "@/components/ui/logo";

/** Écrans d'authentification : colonne étroite centrée, marque en tête, langue en pied. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const m = await getMessages();
  return (
    <NextIntlClientProvider messages={{ common: m.common, auth: m.auth, errors: m.errors }}>
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),2.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <Logo className="mb-10 self-center" />
        <div className="flex-1">{children}</div>
        <LocaleSwitch className="mt-10" />
      </main>
    </NextIntlClientProvider>
  );
}
