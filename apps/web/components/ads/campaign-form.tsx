"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Plus, Trash2 } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { ORG_TYPES } from "@nextin/shared/schemas";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import type { AdSurface, PackageRow, SectorRow } from "@/lib/ads/types";
import type { ActionResult } from "@/lib/auth/errors";
import { cn } from "@/lib/cn";

export type CampaignInitial = {
  name: string;
  packageCode: string;
  sector: string;
  startsOn: string;
  surfaces: AdSurface[];
  targetCities: string[];
  targetOrgTypes: string[];
  schedules: { weekday: number; start_time: string; end_time: string }[];
};

type Props = {
  mode: "advertiser" | "house";
  packages: PackageRow[];
  sectors: SectorRow[];
  cities: string[];
  today: string;
  initial?: CampaignInitial;
  /** Nouvelle campagne : secteur de l'annonceur. */
  defaultSector?: string;
  action: (prev: ActionResult | null, data: FormData) => Promise<ActionResult>;
};

const SURFACES: AdSurface[] = ["tv", "app", "game"];

/** Réglages d'une campagne : formule, informations, surfaces, ciblage, plages. Une seule action : « Enregistrer ». */
export function CampaignForm({ mode, packages, sectors, cities, today, initial, defaultSector, action }: Props) {
  const t = useTranslations("ads");
  const tt = useTranslations("orgTypes");
  const tw = useTranslations("weekdays");
  const locale = useLocale() as "fr" | "en";
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const offered = packages.filter((p) => p.house === (mode === "house"));
  const [packageCode, setPackageCode] = useState(initial?.packageCode ?? offered.find((p) => p.code === "argent")?.code ?? offered[0]?.code ?? "");
  const pkg = offered.find((p) => p.code === packageCode);
  const [name, setName] = useState(initial?.name ?? "");
  const [sector, setSector] = useState(initial?.sector ?? defaultSector ?? (mode === "house" ? "health" : (sectors[0]?.code ?? "")));
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? today);
  const [surfaces, setSurfaces] = useState<AdSurface[]>(initial?.surfaces ?? ["tv"]);
  const [targetCities, setTargetCities] = useState<string[]>(initial?.targetCities ?? []);
  const [targetOrgTypes, setTargetOrgTypes] = useState<string[]>(initial?.targetOrgTypes ?? []);
  const [schedules, setSchedules] = useState(initial?.schedules ?? []);
  const label = (p: { name: string; name_en: string | null }) => (locale === "en" ? (p.name_en ?? p.name) : p.name);
  const sectorLabel = (s: SectorRow) => (locale === "en" ? s.name_en : s.name);

  // Surfaces retenues : seulement celles de la formule choisie.
  const allowed = surfaces.filter((s) => pkg?.surfaces.includes(s));
  const payload = JSON.stringify({
    name,
    packageCode,
    sector,
    startsOn,
    surfaces: allowed.length ? allowed : (pkg?.surfaces.slice(0, 1) ?? []),
    targetCities,
    targetOrgTypes,
    schedules,
  });
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const endsOn = pkg ? new Date(Date.parse(`${startsOn}T00:00:00Z`) + (pkg.duration_days - 1) * 86_400_000).toISOString().slice(0, 10) : startsOn;
  const day = (iso: string) => new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  return (
    <form action={formAction} noValidate className="flex flex-col gap-7">
      <FormError message={top} />
      <input type="hidden" name="payload" value={payload} />

      {mode === "advertiser" ? (
        <section aria-labelledby="pkg-title" className="flex flex-col gap-3">
          <h2 id="pkg-title" className="px-4 text-title3 font-bold">
            {t("package")}
          </h2>
          <div role="radiogroup" aria-labelledby="pkg-title" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {offered.map((p) => {
              const selected = p.code === packageCode;
              return (
                <button
                  key={p.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPackageCode(p.code)}
                  className={cn(
                    "pressable squircle flex flex-col gap-2 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 text-left shadow-card",
                    "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-tint)]",
                    selected && "shadow-[0_0_0_2px_var(--accent-fill)]",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-headline">{label(p)}</span>
                    {selected ? <Check aria-hidden className="size-5 stroke-[2.5] text-accent-text" /> : null}
                  </span>
                  <span className="tabular text-title3 font-bold">{p.price_xaf ? formatXaf(p.price_xaf, locale) : t("free")}</span>
                  <span className="text-footnote text-label-secondary">
                    {p.duration_days} j · {p.max_branches ? t("maxBranches", { count: p.max_branches }) : t("allBranches")}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {p.surfaces.map((s) => (
                      <Badge key={s}>{t(`surfaces.${s}`)}</Badge>
                    ))}
                    {p.quiz_allowed ? <Badge tone="accent">{t("quizIncluded")}</Badge> : null}
                    {p.game_skin_allowed ? <Badge tone="accent">{t("skinIncluded")}</Badge> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextField
          label={t("name")}
          placeholder={t("namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          error={field("name")}
        />
        <SelectField label={t("sector")} value={sector} onChange={(e) => setSector(e.target.value)} options={sectors.map((s) => ({ value: s.code, label: sectorLabel(s) }))} />
        <TextField
          type="date"
          label={t("startsOn")}
          min={today}
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
          hint={pkg ? t("period", { from: day(startsOn), to: day(endsOn) }) : undefined}
          error={field("startsOn")}
        />
      </div>

      <ListSection header={t("surfacesTitle")} checkboxGroupLabel={t("surfacesTitle")}>
        {SURFACES.filter((s) => pkg?.surfaces.includes(s)).map((s) => (
          <ListRow key={s} role="checkbox" selected={allowed.includes(s)} onClick={() => setSurfaces((cur) => toggle(cur, s))} title={t(`surfaces.${s}`)} accessory="check" />
        ))}
      </ListSection>

      {mode === "advertiser" ? (
        <section aria-labelledby="target-title" className="flex flex-col gap-4">
          <h2 id="target-title" className="px-4 text-title3 font-bold">
            {t("targeting")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ListSection header={t("cities")} footer={t("citiesHint")} checkboxGroupLabel={t("cities")}>
              {cities.map((c) => (
                <ListRow key={c} role="checkbox" selected={targetCities.includes(c)} onClick={() => setTargetCities((cur) => toggle(cur, c))} title={c} accessory="check" />
              ))}
            </ListSection>
            <ListSection header={t("orgTypes")} footer={t("orgTypesHint")} checkboxGroupLabel={t("orgTypes")}>
              {ORG_TYPES.map((o) => (
                <ListRow key={o} role="checkbox" selected={targetOrgTypes.includes(o)} onClick={() => setTargetOrgTypes((cur) => toggle(cur, o))} title={tt(o)} accessory="check" />
              ))}
            </ListSection>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="sched-title" className="flex flex-col gap-3">
        <h2 id="sched-title" className="px-4 text-title3 font-bold">
          {t("schedules")}
        </h2>
        <p className="px-4 text-footnote text-label-secondary">{t("schedulesHint")}</p>
        {schedules.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <SelectField
              label={t("weekday")}
              value={String(s.weekday)}
              onChange={(e) => setSchedules((cur) => cur.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)))}
              options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: tw(String(d) as "1") }))}
            />
            <TextField type="time" label={t("from")} value={s.start_time} onChange={(e) => setSchedules((cur) => cur.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} />
            <TextField type="time" label={t("to")} value={s.end_time} onChange={(e) => setSchedules((cur) => cur.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))} />
            <IconButton label={t("removeSchedule")} icon={<Trash2 />} variant="plain" onClick={() => setSchedules((cur) => cur.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button
          type="button"
          variant="gray"
          size="md"
          className="self-start"
          leadingIcon={<Plus />}
          onClick={() => setSchedules((cur) => [...cur, { weekday: 1, start_time: "08:00", end_time: "12:00" }])}
        >
          {t("addSchedule")}
        </Button>
      </section>

      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={t("saving")}>
          {t("save")}
        </Button>
      </BottomBar>
    </form>
  );
}
