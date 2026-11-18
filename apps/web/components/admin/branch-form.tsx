"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LocateFixed, MapPin, X } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { AutoSaveStatus, useAutoSave } from "./use-auto-save";
import { useFormErrors } from "./use-form-errors";

type Branch = { name: string; address: string | null; city: string | null; phone: string | null; lat: number | null; lng: number | null };

/**
 * Fiche d'une agence (maquette v2 17) : nom, adresse, ville et téléphone groupés, position GPS. Création : un seul
 * bouton (« Créer l'agence ») ; modification (« Informations ») : enregistrement automatique.
 */
export function BranchForm({
  action,
  initial,
  submitLabel,
  submittingLabel,
  disabled,
}: {
  action: (prev: ActionResult | null, data: FormData) => Promise<ActionResult>;
  initial?: Branch;
  submitLabel: string;
  submittingLabel: string;
  disabled?: boolean;
}) {
  const t = useTranslations("branches");
  const editing = !!initial;
  const [createState, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, action, editing && !disabled);
  const { field, top } = useFormErrors(editing ? saveState.result : createState);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null,
  );
  const [cleared, setCleared] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) return setLocError(true);
    setLocating(true);
    setLocError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setCleared(false);
        setLocating(false);
      },
      () => {
        setLocError(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <form
      ref={formRef}
      action={editing ? undefined : formAction}
      onSubmit={editing ? (e) => e.preventDefault() : undefined}
      noValidate
      className="flex flex-col gap-5"
    >
      {editing ? <input type="hidden" name="autosave" value="1" /> : <FormError message={top} />}
      <FormGroup>
        <TextField grouped name="name" label={t("name")} placeholder={t("namePlaceholder")} defaultValue={initial?.name} required error={field("name")} disabled={disabled} />
        <TextField grouped name="address" label={t("address")} placeholder={t("addressPlaceholder")} defaultValue={initial?.address ?? ""} autoComplete="street-address" error={field("address")} disabled={disabled} />
        <TextField grouped name="city" label={t("city")} placeholder={t("cityPlaceholder")} defaultValue={initial?.city ?? ""} autoComplete="address-level2" error={field("city")} disabled={disabled} />
        <TextField
          grouped
          name="phone"
          type="tel"
          inputMode="tel"
          label={t("phone")}
          placeholder={t("phonePlaceholder")}
          defaultValue={initial?.phone ?? ""}
          autoComplete="tel-national"
          error={field("phone")}
          disabled={disabled}
        />
      </FormGroup>

      <section aria-labelledby="branch-location" className="flex flex-col gap-1.5">
        <h2 id="branch-location" className="px-4 text-footnote uppercase text-label-secondary">
          {t("location")}
        </h2>
        <div className="squircle flex flex-col gap-3 rounded-[var(--radius-md)] bg-grouped-secondary p-4">
          {coords ? (
            <p className="flex items-center gap-2 text-body">
              <MapPin aria-hidden className="size-5 shrink-0 stroke-[1.75] text-accent-text" />
              <span className="tabular">{t("locationSet", { lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5) })}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="tinted"
              size="md"
              onClick={locate}
              disabled={disabled}
              loading={locating}
              loadingLabel={t("locating")}
              leadingIcon={<LocateFixed aria-hidden className="size-5" />}
            >
              {t("useMyLocation")}
            </Button>
            {coords ? (
              <Button
                type="button"
                variant="gray"
                size="md"
                onClick={() => {
                  setCoords(null);
                  setCleared(true);
                }}
                leadingIcon={<X aria-hidden className="size-5" />}
              >
                {t("clearLocation")}
              </Button>
            ) : null}
          </div>
          {locError ? (
            <p role="alert" className="text-footnote text-red-text">
              {t("locationUnavailable")}
            </p>
          ) : null}
        </div>
        <p className="px-4 text-footnote text-label-secondary">{t("locationHint")}</p>
        <input type="hidden" name="lat" value={coords?.lat ?? ""} />
        <input type="hidden" name="lng" value={coords?.lng ?? ""} />
        <input type="hidden" name="clearLocation" value={cleared ? "1" : ""} />
      </section>

      {editing ? (
        disabled ? null : <AutoSaveStatus state={saveState} className="justify-center" />
      ) : (
        <BottomBar>
          <Button type="submit" block loading={pending} loadingLabel={submittingLabel}>
            {submitLabel}
          </Button>
        </BottomBar>
      )}
    </form>
  );
}
