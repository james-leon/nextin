"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { useThemePreference, type ThemePreference } from "@/components/theme/theme";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";

function Group({ header, footer, children }: { header: React.ReactNode; footer?: string; children: React.ReactNode }) {
  return (
    <section className="w-full">
      <h3 className="flex items-center gap-2 px-4 pb-1.5 text-footnote uppercase text-label-secondary">{header}</h3>
      <div className="squircle rounded-[var(--radius-md)] bg-grouped-secondary p-2">{children}</div>
      {footer ? <p className="px-4 pt-1.5 text-footnote text-label-secondary">{footer}</p> : null}
    </section>
  );
}

/**
 * Réglages Apparence (Auto / Clair / Sombre, enregistré sur l'appareil) et Langue (FR / EN, cookie
 * NEXTIN_LOCALE). Utilisé sur le profil client et dans les réglages du personnel.
 */
export function Preferences({ appearanceFooter, showAppearance = true }: { appearanceFooter?: string; showAppearance?: boolean }) {
  const tt = useTranslations("theme");
  const tc = useTranslations("common");
  const [pref, setPref] = useThemePreference();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      {showAppearance ? (
        <Group header={tt("label")} footer={appearanceFooter}>
          <SegmentedControl<ThemePreference>
            label={tt("label")}
            value={pref}
            onValueChange={setPref}
            options={[
              { value: "auto", label: tt("auto") },
              { value: "light", label: tt("light") },
              { value: "dark", label: tt("dark") },
            ]}
          />
        </Group>
      ) : null}
      <Group
        header={
          <>
            {tc("language")}
            {pending ? <Spinner className="size-3.5" /> : null}
          </>
        }
      >
        <SegmentedControl
          label={tc("language")}
          value={locale}
          onValueChange={(v) =>
            startTransition(async () => {
              await setLocale(v);
              router.refresh();
            })
          }
          options={[
            { value: "fr", label: tc("french") },
            { value: "en", label: tc("english") },
          ]}
        />
      </Group>
    </div>
  );
}
