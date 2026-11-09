"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FILE_NUMBER_MAX, NAME_MAX, parseIdentity, type IdentityRules } from "@nextin/shared/identity";
import type { DeskTicket } from "@nextin/shared/desk";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Saisie ou correction du nom d'un ticket (patient sans téléphone, ticket imprimé) : `set_ticket_identity`,
 * journalisé sans le nom. Le nom n'est jamais affiché sur l'écran TV, annoncé ni envoyé.
 */
export function IdentitySheet({
  open,
  onOpenChange,
  ticketId,
  code,
  rules,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  code: string;
  rules: IdentityRules;
  initial: DeskTicket["identity"];
  onSaved?: () => void;
}) {
  const t = useTranslations("identity");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [age, setAge] = useState(initial?.age != null ? String(initial.age) : "");
  const [fileNumber, setFileNumber] = useState(initial?.fileNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formId = `identity-${ticketId}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // L'accueil peut effacer le nom (champ vide) ; seules les valeurs invalides sont refusées.
    const parsed = parseIdentity({ ...rules, mode: rules.mode === "required" ? "optional" : rules.mode }, { name, age, fileNumber });
    if (!parsed.ok) return setError(te(parsed.error));
    setPending(true);
    const { error: rpcError } = await getSupabaseBrowserClient().rpc("set_ticket_identity", {
      p_ticket: ticketId,
      p_name: parsed.identity.name ?? "",
      p_age: parsed.identity.age ?? undefined,
      p_file_number: parsed.identity.fileNumber ?? undefined,
    });
    setPending(false);
    if (rpcError) return setError(te.has(rpcError.message as never) ? te(rpcError.message as never) : te("generic"));
    toast(t("saved"));
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("sheetTitle", { code })}
      description={t("staffFooter")}
      closeLabel={tc("close")}
      footer={
        <Button type="submit" form={formId} block loading={pending}>
          {t("save")}
        </Button>
      }
    >
      <form id={formId} onSubmit={save} noValidate className="flex flex-col gap-4 pt-2">
        <TextField
          label={t("staffName")}
          placeholder={t("staffNamePlaceholder")}
          autoComplete="off"
          autoCapitalize="words"
          maxLength={NAME_MAX}
          value={name}
          error={error ?? undefined}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          autoFocus
        />
        {rules.extra === "age" ? (
          <TextField
            label={t("staffAge")}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            value={age}
            onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))}
          />
        ) : null}
        {rules.extra === "file_number" ? (
          <TextField
            label={t("staffFileNumber")}
            placeholder={t("fileNumberPlaceholder")}
            autoComplete="off"
            maxLength={FILE_NUMBER_MAX}
            value={fileNumber}
            onChange={(e) => setFileNumber(e.target.value)}
          />
        ) : null}
      </form>
    </Sheet>
  );
}
