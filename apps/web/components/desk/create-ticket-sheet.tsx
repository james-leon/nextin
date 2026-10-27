"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer, UserRoundCheck } from "lucide-react";
import { normalizeCameroonPhone } from "@nextin/shared";
import { PRIORITY_REASONS, type PriorityReason } from "@nextin/shared/queue/live";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ServiceTile } from "@/components/ui/service-tile";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { uuidV4 } from "@/lib/desk/uuid";
import type { ReceptionData } from "@/lib/desk/reception";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Created = { id: string; code: string; rerouted: boolean };

/**
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
  const tr = useTranslations("client.service.reasons");
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const [serviceId, setServiceId] = useState<string | null>(data.services[0]?.id ?? null);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [priority, setPriority] = useState(false);
  const [reason, setReason] = useState<PriorityReason>("appointment");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [messagesLocale, setMessagesLocale] = useState(locale === "en" ? "en" : "fr");
  const [pending, setPending] = useState(false);
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
    setConsent(false);
    setError(null);
    setOpId(uuidV4());
  }

  async function submit() {
    if (!serviceId) return;
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
    });
    setPending(false);
    if (e) return setError(te.has(e.message as never) ? te(e.message as never) : te("generic"));
    const r = res as { id: string; display_code: string; rerouted: boolean };
    setCreated({ id: r.id, code: r.display_code, rerouted: r.rerouted });
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
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <p className="text-hero font-extrabold text-ticket-number" aria-live="polite">
            {created.code}
          </p>
          {created.rerouted ? (
            <CalloutCard icon={<UserRoundCheck />} tone="accent">
              {t("createdRerouted")}
            </CalloutCard>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6 pt-2">
          <ListSection header={t("service")} radioGroupLabel={t("service")}>
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

          {practitioners.length ? (
            <ListSection header={t("practitioner")} radioGroupLabel={t("practitioner")}>
              <ListRow role="radio" selected={practitionerId === null} onClick={() => setPractitionerId(null)} title={t("anyPractitioner")} accessory="check" />
              {practitioners.map((p) => (
                <ListRow
                  key={p.id}
                  role="radio"
                  selected={practitionerId === p.id}
                  onClick={() => setPractitionerId(p.id)}
                  title={p.name}
                  accessory="check"
                />
              ))}
            </ListSection>
          ) : null}

          {priorityAllowed ? (
            <>
              <ListSection>
                <ListSwitchRow title={t("priority")} subtitle={t("priorityHint")} checked={priority} onCheckedChange={setPriority} />
              </ListSection>
              {priority ? (
                <ListSection header={t("reason")} radioGroupLabel={t("reason")}>
                  {PRIORITY_REASONS.map((r) => (
                    <ListRow key={r} role="radio" selected={reason === r} onClick={() => setReason(r)} title={tr(r)} accessory="check" />
                  ))}
                </ListSection>
              ) : null}
            </>
          ) : null}

          <TextField
            label={t("phone")}
            hint={t("phoneHint")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
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
