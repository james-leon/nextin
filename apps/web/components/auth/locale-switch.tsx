"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/cn";

/** Bascule FR / EN discrète en pied d'écran. */
export function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: "fr" | "en") =>
    start(async () => {
      await setLocale(l);
      router.refresh();
    });
  return (
    <div role="group" aria-label={t("language")} aria-busy={pending} className={cn("flex items-center justify-center gap-1", className)}>
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          onClick={() => choose(l)}
          className={cn(
            "pressable min-h-11 rounded-full px-3 text-subheadline",
            locale === l ? "font-semibold text-label" : "text-label-secondary",
          )}
        >
          {l === "fr" ? t("french") : t("english")}
        </button>
      ))}
    </div>
  );
}
