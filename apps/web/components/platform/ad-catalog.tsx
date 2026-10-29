"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, ShieldCheck } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { updateAdPackage, upsertAdSector } from "@/app/(staff)/admin/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import type { AdSurface, PackageRow, SectorRow } from "@/lib/ads/types";

const SURFACES: AdSurface[] = ["tv", "app", "game"];

/** Formules publicitaires et secteurs (super admin) : chaque ligne s'ouvre dans une feuille d'édition. */
export function AdCatalog({ packages, sectors }: { packages: PackageRow[]; sectors: SectorRow[] }) {
  const t = useTranslations("adsAdmin");
  const ta = useTranslations("ads");
  const locale = useLocale() === "en" ? "en" : "fr";
  const [pkg, setPkg] = useState<PackageRow | null>(null);
  const [sector, setSector] = useState<SectorRow | "new" | null>(null);
  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:items-start">
      <ListSection header={ta("package")}>
        {packages.map((p) => (
          <ListRow
            key={p.code}
            onClick={() => setPkg(p)}
            title={<span className="font-semibold">{locale === "en" ? p.name_en : p.name}</span>}
            subtitle={`${p.price_xaf ? formatXaf(p.price_xaf, locale) : ta("free")} · ${p.duration_days} j · ${p.share_of_voice} % · ${p.surfaces.map((s) => ta(`surfaces.${s}`)).join(", ")}`}
            accessory={p.active ? "chevron" : <Badge tone="neutral">{t("inactive")}</Badge>}
          />
        ))}
      </ListSection>
      <div className="flex flex-col gap-3">
        <ListSection header={t("sectors")}>
          {sectors.map((s) => (
            <ListRow
              key={s.code}
              onClick={() => setSector(s)}
              icon={s.requires_health_visa ? <ShieldCheck aria-label={t("requiresVisa")} className="size-5 text-accent-text" /> : undefined}
              title={locale === "en" ? s.name_en : s.name}
              subtitle={s.code}
              accessory={s.active ? "chevron" : <Badge tone="neutral">{t("inactive")}</Badge>}
            />
          ))}
        </ListSection>
        <Button variant="gray" leadingIcon={<Plus />} onClick={() => setSector("new")} className="self-start">
          {t("addSector")}
        </Button>
      </div>
      {pkg ? <PackageSheet key={pkg.code} pkg={pkg} onClose={() => setPkg(null)} /> : null}
      {sector ? <SectorSheet key={sector === "new" ? "new" : sector.code} sector={sector === "new" ? null : sector} onClose={() => setSector(null)} /> : null}
    </div>
  );
}

function PackageSheet({ pkg, onClose }: { pkg: PackageRow; onClose: () => void }) {
  const t = useTranslations("adsAdmin");
  const ta = useTranslations("ads");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(updateAdPackage, null);
  const { field, top } = useFormErrors(state);
  const [surfaces, setSurfaces] = useState<AdSurface[]>(pkg.surfaces);
  const [quiz, setQuiz] = useState(pkg.quiz_allowed);
  const [skin, setSkin] = useState(pkg.game_skin_allowed);
  const [active, setActive] = useState(pkg.active);
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={pkg.name}
      closeLabel={tc("close")}
      footer={
        <Button type="submit" form="package-form" block loading={pending} loadingLabel={ta("saving")}>
          {ta("save")}
        </Button>
      }
    >
      <form id="package-form" action={action} noValidate className="flex flex-col gap-5 pt-2">
        <FormError message={top} />
        <input type="hidden" name="code" value={pkg.code} />
        <div className="grid grid-cols-2 gap-3">
          <TextField name="priceXaf" type="number" inputMode="numeric" min={0} label={t("packageFields.price")} defaultValue={pkg.price_xaf} error={field("priceXaf")} />
          <TextField name="durationDays" type="number" inputMode="numeric" min={1} max={365} label={t("packageFields.duration")} defaultValue={pkg.duration_days} error={field("durationDays")} />
          <TextField name="maxBranches" type="number" inputMode="numeric" min={1} label={t("packageFields.maxBranches")} defaultValue={pkg.max_branches ?? ""} error={field("maxBranches")} />
          <TextField name="shareOfVoice" type="number" inputMode="numeric" min={0} max={100} label={t("packageFields.share")} defaultValue={pkg.share_of_voice} error={field("shareOfVoice")} />
        </div>
        <ListSection header={t("packageFields.surfaces")} checkboxGroupLabel={t("packageFields.surfaces")}>
          {SURFACES.map((s) => {
            const checked = surfaces.includes(s);
            return (
              <ListRow
                key={s}
                role="checkbox"
                selected={checked}
                onClick={() => setSurfaces((cur) => (checked ? cur.filter((x) => x !== s) : [...cur, s]))}
                title={ta(`surfaces.${s}`)}
                accessory="check"
              />
            );
          })}
        </ListSection>
        {surfaces.map((s) => (
          <input key={s} type="hidden" name="surfaces" value={s} />
        ))}
        <ListSection>
          <ListSwitchRow title={t("packageFields.quiz")} checked={quiz} onCheckedChange={setQuiz} />
          <ListSwitchRow title={t("packageFields.skin")} checked={skin} onCheckedChange={setSkin} />
          <ListSwitchRow title={t("packageFields.active")} checked={active} onCheckedChange={setActive} />
        </ListSection>
        <input type="hidden" name="quizAllowed" value={String(quiz)} />
        <input type="hidden" name="gameSkinAllowed" value={String(skin)} />
        <input type="hidden" name="active" value={String(active)} />
      </form>
    </Sheet>
  );
}

function SectorSheet({ sector, onClose }: { sector: SectorRow | null; onClose: () => void }) {
  const t = useTranslations("adsAdmin");
  const ta = useTranslations("ads");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(upsertAdSector, null);
  const { field, top } = useFormErrors(state);
  const [visa, setVisa] = useState(sector?.requires_health_visa ?? false);
  const [active, setActive] = useState(sector?.active ?? true);
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={sector?.name ?? t("addSector")}
      closeLabel={tc("close")}
      footer={
        <Button type="submit" form="sector-form" block loading={pending} loadingLabel={ta("saving")}>
          {ta("save")}
        </Button>
      }
    >
      <form id="sector-form" action={action} noValidate className="flex flex-col gap-5 pt-2">
        <FormError message={top} />
        {sector ? (
          <input type="hidden" name="code" value={sector.code} />
        ) : (
          <TextField name="code" label={t("sectorCode")} pattern="[a-z][a-z0-9_]{1,30}" autoCapitalize="none" required error={field("code")} />
        )}
        <TextField name="name" label={t("sectorName")} defaultValue={sector?.name ?? ""} maxLength={60} required error={field("name")} />
        <TextField name="nameEn" label={t("sectorNameEn")} defaultValue={sector?.name_en ?? ""} maxLength={60} required error={field("nameEn")} />
        <ListSection>
          <ListSwitchRow title={t("requiresVisa")} checked={visa} onCheckedChange={setVisa} />
          <ListSwitchRow title={t("sectorActive")} checked={active} onCheckedChange={setActive} />
        </ListSection>
        <input type="hidden" name="requiresHealthVisa" value={String(visa)} />
        <input type="hidden" name="active" value={String(active)} />
      </form>
    </Sheet>
  );
}
