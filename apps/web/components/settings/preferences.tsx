"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { useThemePreference, type ThemePreference } from "@/components/theme/theme";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";

export type PreferencesLabels = {
  appearance: string;
  auto: string;
  light: string;
  dark: string;
  appearanceFooter?: string;
  language: string;
  french: string;
  english: string;
};

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
 * NEXTIN_LOCALE). Textes fournis par le serveur : utilisable sur les pages client comme dans l'espace du personnel.
 */
export function Preferences({ labels, locale }: { labels: PreferencesLabels; locale: string }) {
  const [pref, setPref] = useThemePreference();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <Group header={labels.appearance} footer={labels.appearanceFooter}>
        <SegmentedControl<ThemePreference>
          label={labels.appearance}
          value={pref}
          onValueChange={setPref}
          options={[
            { value: "auto", label: labels.auto },
            { value: "light", label: labels.light },
            { value: "dark", label: labels.dark },
          ]}
        />
      </Group>
      <Group
        header={
          <>
            {labels.language}
            {pending ? <Spinner className="size-3.5" /> : null}
          </>
        }
      >
        <SegmentedControl
          label={labels.language}
          value={locale}
          onValueChange={(v) =>
            startTransition(async () => {
              await setLocale(v);
              router.refresh();
            })
          }
          options={[
            { value: "fr", label: labels.french },
            { value: "en", label: labels.english },
          ]}
        />
      </Group>
    </div>
  );
}
