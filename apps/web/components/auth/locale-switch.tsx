"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/cn";

/** Bascule FR / EN en pilule (contrôle segmenté compact), en haut à droite des écrans de connexion. */
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
    <div
      role="group"
      aria-label={t("language")}
      aria-busy={pending}
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-fill-tertiary p-0.5", className)}
    >
      {(["fr", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          aria-label={l === "fr" ? t("french") : t("english")}
          onClick={() => choose(l)}
          className={cn(
            "pressable min-h-11 min-w-12 rounded-full px-3 text-subheadline font-semibold transition-colors duration-200",
            locale === l ? "bg-white text-label shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] dark:bg-[#636366]" : "text-label",
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
