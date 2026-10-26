import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-hero font-bold text-label-tertiary tabular">404</p>
      <Link href="/" className="pressable text-body font-semibold text-accent-text">
        {t("back")}
      </Link>
    </main>
  );
}
