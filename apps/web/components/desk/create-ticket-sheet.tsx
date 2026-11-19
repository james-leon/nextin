"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown, Printer, UserRoundCheck } from "lucide-react";
import { normalizeCameroonPhone } from "@nextin/shared";
import { PRIORITY_REASONS, type PriorityReason } from "@nextin/shared/queue/live";
import { FILE_NUMBER_MAX, NAME_MAX, parseIdentity } from "@nextin/shared/identity";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ServiceTile } from "@/components/ui/service-tile";
import { Sheet, SheetAction } from "@/components/ui/sheet";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { uuidV4 } from "@/lib/desk/uuid";
import type { ReceptionData } from "@/lib/desk/reception";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Created = { id: string; code: string; rerouted: boolean; serviceName: string; ahead: number | null };

/**
 * Nouveau ticket et « Ticket créé » (maquette v2 20) : service, praticien, nom, accès prioritaire, WhatsApp ; puis le
 * numéro en très grand pour le dire au patient, « Imprimer le ticket » (action principale) et « Nouveau ticket ».
 * Le consentement WhatsApp n'apparaît qu'après la saisie d'un numéro.
 * Ticket pour un patient sans smartphone (§5.1) : service, praticien éventuel, priorité,
 * numéro WhatsApp seulement avec son accord explicite ; puis impression 80 mm.
 */
export function CreateTicketSheet({
  data,
  open,
  onOpenChange,
  onCreated,
}: {
  data: ReceptionData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const t = useTranslations("reception");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tr = useTranslations("priorityReasons");
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const [serviceId, setServiceId] = useState<string | null>(data.services[0]?.id ?? null);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [priority, setPriority] = useState(false);
  const [reason, setReason] = useState<PriorityReason>("appointment");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [fileNumber, setFileNumber] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const ti = useTranslations("identity");
  const rules = data.branch.identityRules;
  const [consent, setConsent] = useState(false);
  const [messagesLocale, setMessagesLocale] = useState(locale === "en" ? "en" : "fr");
  const [pending, setPending] = useState(false);
  const [pickPractitioner, setPickPractitioner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  // Un identifiant par ticket : un double appui ou un rejeu ne crée jamais deux tickets.
  const [opId, setOpId] = useState(uuidV4);

  const service = data.services.find((s) => s.id === serviceId) ?? null;
  const practitioners = data.practitioners.filter((p) => !serviceId || p.serviceIds.includes(serviceId));
  const priorityAllowed = data.branch.prioritiesEnabled && !!service?.allowPriority;
  const phoneE164 = phone.trim() ? normalizeCameroonPhone(phone) : null;

  function reset() {
    setCreated(null);
    setPractitionerId(null);
    setPriority(false);
    setPhone("");
    setName("");
    setAge("");
    setFileNumber("");
    setNameError(null);
    setConsent(false);
    setError(null);
    setOpId(uuidV4());
  }

  async function submit() {
    if (!serviceId) return;
    // Nom demandé par l'agence : exigé ici comme sur la page client (la base l'accepte vide pour ne pas bloquer l'accueil).
    const parsed = parseIdentity(rules, { name, age, fileNumber });
    if (!parsed.ok) return setNameError(te(parsed.error));
    setNameError(null);
    if (phone.trim() && !phoneE164) return setError(te("phone_invalid"));
    if (phoneE164 && !consent) return setError(te("consent_required"));
    setPending(true);
    setError(null);
    const { data: res, error: e } = await supabase.rpc("reception_create_ticket", {
      p_service: serviceId,
      p_priority_reason: (priority && priorityAllowed ? reason : null) as PriorityReason,
      p_client_op_id: opId,
      p_practitioner: practitionerId as string,
      p_phone_e164: phoneE164 as string,
      p_consent: !!phoneE164 && consent,
      p_locale: messagesLocale,
      p_customer_name: parsed.identity.name ?? undefined,
      p_customer_age: parsed.identity.age ?? undefined,
      p_customer_file_number: parsed.identity.fileNumber ?? undefined,
    });
    setPending(false);
    if (e) return setError(te.has(e.message as never) ? te(e.message as never) : te("generic"));
    const r = res as { id: string; display_code: string; rerouted: boolean };
    // Personnes devant : lu sur la vue publique du ticket (même calcul que la page du patient et le ticket imprimé).
    const { data: row } = await supabase.from("tickets").select("public_token").eq("id", r.id).maybeSingle();
    const { data: view } = row?.public_token ? await supabase.rpc("get_ticket", { p_token: row.public_token }) : { data: null };
    const position = (view as { position: number | null } | null)?.position ?? null;
    setCreated({ id: r.id, code: r.display_code, rerouted: r.rerouted, serviceName: service?.name ?? "", ahead: position ? position - 1 : null });
    onCreated();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o && created) reset();
      }}
      title={created ? t("created") : t("createTitle")}
      description={created ? undefined : t("createBody")}
      closeLabel={tc("close")}
      cancelLabel={created ? undefined : tc("cancel")}
      titleHidden={!!created}
      action={
        created ? (
          <SheetAction
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            {t("done")}
          </SheetAction>
        ) : undefined
      }
      footer={
        created ? (
          <div className="flex flex-col gap-2">
            <Button asChild block>
              <a href={`/desk/print/${created.id}`} target="_blank" rel="noopener">
                <Printer aria-hidden className="size-5" />
                {t("print")}
              </a>
            </Button>
            <Button block variant="tinted" onClick={reset}>
              {t("another")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {error ? (
              <p role="alert" className="text-center text-subheadline text-red-text">
                {error}
              </p>
            ) : null}
            <Button block onClick={submit} loading={pending} disabled={!serviceId}>
              {t("create")}
            </Button>
          </div>
        )
      }
    >
      {created ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-green text-white">
            <Check className="size-8 stroke-[2.5]" />
          </span>
          <p className="mt-2 text-footnote uppercase text-label-secondary">{t("created")}</p>
          <p className="text-hero font-extrabold text-ticket-number" aria-live="polite">
            {created.code}
          </p>
          <p className="text-subheadline text-label-secondary">
            {created.ahead === null ? created.serviceName : t("createdAhead", { service: created.serviceName, count: created.ahead })}
          </p>
          {created.rerouted ? (
            <CalloutCard icon={<UserRoundCheck />} tone="accent">
              {t("createdRerouted")}
            </CalloutCard>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6 pt-2">
          <ListSection radioGroupLabel={t("service")}>
            {data.services.map((s) => (
              <ListRow
                key={s.id}
                role="radio"
                selected={serviceId === s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setPractitionerId(null);
                }}
                icon={<ServiceTile letter={s.prefix} color={s.color} />}
                title={s.name}
                accessory="check"
              />
            ))}
          </ListSection>

          <div className="flex flex-col gap-5">
            <ListSection>
              {practitioners.length ? (
                <li className="group/row">
                  <button
                    type="button"
                    aria-expanded={pickPractitioner}
                    onClick={() => setPickPractitioner((v) => !v)}
                    className="pressable flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <span className="flex-1 text-body">{t("practitionerShort")}</span>
                    <span className="min-w-0 truncate text-body text-label-secondary">{practitioners.find((p) => p.id === practitionerId)?.name ?? t("anyPractitioner")}</span>
                    <ChevronDown aria-hidden className={`size-4 shrink-0 stroke-[2.25] text-label-tertiary transition-transform ${pickPractitioner ? "rotate-180" : ""}`} />
                  </button>
                </li>
              ) : null}
              {priorityAllowed ? <ListSwitchRow title={t("priority")} checked={priority} onCheckedChange={setPriority} /> : null}
            </ListSection>
            {practitioners.length && pickPractitioner ? (
              <ListSection radioGroupLabel={t("practitioner")}>
                <ListRow
                  role="radio"
                  selected={practitionerId === null}
                  onClick={() => {
                    setPractitionerId(null);
                    setPickPractitioner(false);
                  }}
                  title={t("anyPractitioner")}
                  accessory="check"
                />
                {practitioners.map((p) => (
                  <ListRow
                    key={p.id}
                    role="radio"
                    selected={practitionerId === p.id}
                    onClick={() => {
                      setPractitionerId(p.id);
                      setPickPractitioner(false);
                    }}
                    title={p.name}
                    accessory="check"
                  />
                ))}
              </ListSection>
            ) : null}
            {priorityAllowed && priority ? (
              <ListSection header={t("reason")} radioGroupLabel={t("reason")}>
                {PRIORITY_REASONS.map((r) => (
                  <ListRow key={r} role="radio" selected={reason === r} onClick={() => setReason(r)} title={tr(r)} accessory="check" />
                ))}
              </ListSection>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <FormGroup>
              {rules.mode !== "off" ? (
                <>
                  <TextField
                    grouped
                    label={rules.mode === "required" ? ti("staffName") : ti("staffNameOptional")}
                    placeholder={ti("staffNamePlaceholder")}
                    autoComplete="off"
                    autoCapitalize="words"
                    maxLength={NAME_MAX}
                    value={name}
                    error={nameError ?? undefined}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError(null);
                    }}
                  />
                  {rules.extra === "age" ? (
                    <TextField grouped label={ti("staffAge")} inputMode="numeric" pattern="[0-9]*" maxLength={3} value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} />
                  ) : null}
                  {rules.extra === "file_number" ? (
                    <TextField grouped label={ti("staffFileNumber")} autoComplete="off" maxLength={FILE_NUMBER_MAX} value={fileNumber} onChange={(e) => setFileNumber(e.target.value)} />
                  ) : null}
                </>
              ) : null}
              <TextField
                grouped
                label={t("phone")}
                placeholder={t("phoneHint")}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </FormGroup>
            {rules.mode !== "off" ? <p className="px-4 text-footnote text-label-secondary">{ti("staffFooter")}</p> : null}
          </div>
          {phone.trim() ? (
            <>
              <ListSection footer={t("consentHint")}>
                <ListSwitchRow title={t("consent")} checked={consent} onCheckedChange={setConsent} />
              </ListSection>
              <div className="flex flex-col gap-1.5">
                <span className="px-4 text-footnote uppercase text-label-secondary">{t("messagesLanguage")}</span>
                <SegmentedControl
                  label={t("messagesLanguage")}
                  value={messagesLocale}
                  onValueChange={setMessagesLocale}
                  options={[
                    { value: "fr", label: tc("french") },
                    { value: "en", label: tc("english") },
                  ]}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
