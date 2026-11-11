"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, RotateCw } from "lucide-react";
import type { ResendResult } from "@/lib/admin/invitations";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CopyButton } from "./copy-button";

/**
 * P2 — « Renvoyer » une invitation en attente : nouveau lien de 7 jours envoyé par e-mail (l'ancien ne fonctionne
 * plus). Si l'e-mail ne part pas, le nouveau lien est proposé à la copie.
 */
export function ResendInvitationButton({ email, action }: { email: string; action: () => Promise<ResendResult> }) {
  const t = useTranslations("staffMgmt");
  const te = useTranslations("errors");
  const toast = useToast();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  if (link) {
    return <CopyButton value={link} label={t("copyLink")} copiedLabel={t("copied")} variant="tinted" />;
  }
  return (
    <Button
      type="button"
      variant="plain"
      size="md"
      loading={pending}
      aria-label={t("resendLabel", { email })}
      leadingIcon={<RotateCw aria-hidden className="size-4" />}
      onClick={() =>
        start(async () => {
          const r = await action();
          if (!r.ok) toast(te(r.error));
          else if (r.mailSent) toast(t("resent", { email: r.email }), <CheckCircle2 aria-hidden />);
          else {
            toast(t("resendFailed"));
            setLink(r.link);
          }
        })
      }
    >
      {t("resend")}
    </Button>
  );
}
