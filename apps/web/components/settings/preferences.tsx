"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/i18n/actions";
import { useThemePreference, type ThemePreference } from "@/components/theme/theme";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";
import { ChevronRight, Globe, Moon } from "lucide-react";
import { ListIcon } from "@/components/ui/list";

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
export function Preferences({ labels, locale, variant = "segmented" }: { labels: PreferencesLabels; locale: string; variant?: "segmented" | "rows" }) {
  const [pref, setPref] = useThemePreference();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const changeLocale = (v: string) =>
    startTransition(async () => {
      await setLocale(v);
      router.refresh();
    });

  if (variant === "rows") {
    // Lignes de Réglages iOS (profil client, maquette v2 01) : la valeur à droite ; un toucher ouvre le sélecteur
    // natif du téléphone (<select> transparent posé sur la ligne, étiqueté pour les lecteurs d'écran).
    const row = (icon: React.ReactNode, color: string, title: string, value: string, select: React.ReactNode) => (
      <li className="group/row relative flex min-h-11 items-center gap-3 pl-4 focus-within:bg-fill-tertiary">
        <ListIcon color={color}>{icon}</ListIcon>
        <span className="flex min-h-11 flex-1 items-center gap-2 py-2.5 pr-4 list-separator">
          <span className="flex-1 text-body">{title}</span>
          <span className="text-body text-label-secondary">{value}</span>
          <ChevronRight aria-hidden className="size-[1.125rem] stroke-[2.25] text-label-tertiary" />
        </span>
        {select}
      </li>
    );
    const appearance = { auto: labels.auto, light: labels.light, dark: labels.dark }[pref];
    return (
      <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
        {row(
          <Globe />,
          "var(--accent-fill)",
          labels.language,
          pending ? "…" : locale === "en" ? labels.english : labels.french,
          <select
            aria-label={labels.language}
            value={locale}
            onChange={(e) => changeLocale(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
          >
            <option value="fr">{labels.french}</option>
            <option value="en">{labels.english}</option>
          </select>,
        )}
        {row(
          <Moon />,
          "var(--icon-indigo)",
          labels.appearance,
          appearance,
          <select
            aria-label={labels.appearance}
            value={pref}
            onChange={(e) => setPref(e.target.value as ThemePreference)}
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
          >
            <option value="auto">{labels.auto}</option>
            <option value="light">{labels.light}</option>
            <option value="dark">{labels.dark}</option>
          </select>,
        )}
      </ul>
    );
  }

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
          onValueChange={changeLocale}
          options={[
            { value: "fr", label: labels.french },
            { value: "en", label: labels.english },
          ]}
        />
      </Group>
    </div>
  );
}
