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
import { CheckPicker } from "@/components/ui/check-picker";
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

/**
 * Réglages d'une campagne : formule, informations, surfaces, ciblage, plages. Une seule action : « Enregistrer ».
 * Ordinateur : deux colonnes, récapitulatif (prix, période, ciblage) collé à droite.
 */
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

  const summary = (
    <aside aria-labelledby="summary-title" className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
      <h2 id="summary-title" className="text-headline">
        {t("summaryTitle")}
      </h2>
      {pkg ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-subheadline text-label-secondary">{label(pkg)}</p>
          <p className="text-title1 font-bold tabular">{pkg.price_xaf ? formatXaf(pkg.price_xaf, locale) : t("free")}</p>
          <p className="text-subheadline text-label-secondary">{t("period", { from: day(startsOn), to: day(endsOn) })}</p>
        </div>
      ) : null}
      <dl className="flex flex-col gap-2 text-subheadline">
        <div className="flex flex-wrap gap-1">
          <dt className="sr-only">{t("surfacesTitle")}</dt>
          {(allowed.length ? allowed : (pkg?.surfaces.slice(0, 1) ?? [])).map((x) => (
            <dd key={x}>
              <Badge>{t(`surfaces.${x}`)}</Badge>
            </dd>
          ))}
        </div>
        {mode === "advertiser" ? (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-label-secondary">{t("cities")}</dt>
              <dd className="text-right">{t("summaryCities", { count: targetCities.length })}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-label-secondary">{t("orgTypes")}</dt>
              <dd className="text-right">{t("summaryTypes", { count: targetOrgTypes.length })}</dd>
            </div>
          </>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-label-secondary">{t("schedules")}</dt>
          <dd className="text-right">{t("summarySchedules", { count: schedules.length })}</dd>
        </div>
      </dl>
    </aside>
  );

  return (
    <form action={formAction} noValidate className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Ordinateur : récapitulatif du prix collé à droite pendant le défilement. */}
      <div className="hidden lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:block">{summary}</div>
      <div className="flex min-w-0 flex-col gap-7 lg:col-start-1 lg:row-start-1">
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
              <CheckPicker
                label={t("cities")}
                footer={t("citiesHint")}
                options={cities.map((c) => ({ value: c, label: c }))}
                selected={targetCities}
                onChange={setTargetCities}
                search={
                  cities.length > 8
                    ? { label: t("searchCities"), clearLabel: t("clearSearch"), empty: t("noMatch"), countLabel: t("selectedCount", { count: targetCities.length }) }
                    : undefined
                }
              />
              <CheckPicker
                label={t("orgTypes")}
                footer={t("orgTypesHint")}
                options={ORG_TYPES.map((o) => ({ value: o, label: tt(o) }))}
                selected={targetOrgTypes}
                onChange={setTargetOrgTypes}
              />
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

      </div>

      <BottomBar className="lg:col-span-2">
        <Button type="submit" block loading={pending} loadingLabel={t("saving")}>
          {t("save")}
        </Button>
      </BottomBar>
    </form>
  );
}
