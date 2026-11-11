"use client";

import { startTransition, useOptimistic, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, MailOpen, X } from "lucide-react";
import { resendInvitation, withdrawInvitation } from "@/app/(staff)/app/o/[orgId]/_actions/people";
import { useMfaStepUp } from "@/components/security/use-mfa-step-up";
import { Button } from "@/components/ui/button";
import { DataTable, td, th } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSection } from "@/components/ui/list";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ResendInvitationButton } from "./resend-invitation-button";

export type PendingInvitation = { id: string; email: string; role: string; scope: string; expires: string };

const UNDO_MS = 5_000;

/**
 * Invitations en attente (U1) : « Annuler l'invitation » la masque aussitôt (mise à jour optimiste) et propose
 * « Annuler » pendant 5 secondes ; passé ce délai, la base la retire. Refus (droits, double authentification
 * abandonnée…) : la ligne réapparaît et un message l'explique. « Renvoyer » (P2) reste sur chaque ligne.
 * Téléphone et tablette : liste groupée ; ordinateur : tableau.
 */
export function PendingInvitations({ orgId, invitations }: { orgId: string; invitations: PendingInvitation[] }) {
  const t = useTranslations("staffMgmt");
  const ta = useTranslations("admin");
  const te = useTranslations("errors");
  const toast = useToast();
  const stepUp = useMfaStepUp();
  // Masquées pendant le délai d'annulation (état local), puis pendant l'envoi (optimiste, revient si refus).
  const [waiting, setWaiting] = useState<Set<string>>(new Set());
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [sending, markSending] = useOptimistic(gone, (state, id: string) => new Set(state).add(id));
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const visible = invitations.filter((i) => !waiting.has(i.id) && !sending.has(i.id));

  const withdraw = (inv: PendingInvitation) => {
    setWaiting((s) => new Set(s).add(inv.id));
    const restore = () => {
      clearTimeout(timers.current.get(inv.id));
      timers.current.delete(inv.id);
      setWaiting((s) => {
        const next = new Set(s);
        next.delete(inv.id);
        return next;
      });
    };
    toast(t("withdrawn", { email: inv.email }), <CheckCircle2 aria-hidden />, {
      durationMs: UNDO_MS,
      action: { label: t("undo"), onClick: restore },
    });
    timers.current.set(
      inv.id,
      setTimeout(() => {
        timers.current.delete(inv.id);
        startTransition(async () => {
          markSending(inv.id);
          setWaiting((s) => {
            const next = new Set(s);
            next.delete(inv.id);
            return next;
          });
          const r = await stepUp.run(() => withdrawInvitation(orgId, inv.id));
          if (r.ok) setGone((s) => new Set(s).add(inv.id));
          else toast(te(r.error));
        });
      }, UNDO_MS),
    );
  };

  const actions = (inv: PendingInvitation) => (
    <span className="flex shrink-0 items-center gap-1">
      <ResendInvitationButton email={inv.email} action={resendInvitation.bind(null, orgId, inv.id)} />
      <Button
        variant="destructive-plain"
        size="md"
        aria-label={t("withdrawLabel", { email: inv.email })}
        leadingIcon={<X aria-hidden className="size-4" />}
        onClick={() => withdraw(inv)}
      >
        {ta("cancel")}
      </Button>
    </span>
  );

  return (
    <>
      {stepUp.dialog}
      <ListSection header={t("invitations")} className={visible.length ? "lg:hidden" : undefined}>
        {visible.length ? (
          visible.map((inv) => (
            <li key={inv.id} className="group/row pl-4">
              <span className="list-separator flex min-h-11 items-center justify-between gap-3 py-2 pr-2">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-body">{inv.email}</span>
                  <span className="line-clamp-2 text-subheadline text-label-secondary">
                    {[inv.role, inv.scope, t("expires", { date: inv.expires })].join(" · ")}
                  </span>
                </span>
                {actions(inv)}
              </span>
            </li>
          ))
        ) : (
          <EmptyState variant="inline" title={t("noInvitations")} icon={<MailOpen />} />
        )}
      </ListSection>
      {visible.length ? (
        <section aria-labelledby="invitations-title" className="hidden flex-col gap-1.5 lg:flex">
          <h2 id="invitations-title" className="px-4 text-footnote uppercase text-label-secondary">
            {t("invitations")}
          </h2>
          <DataTable
            label={t("invitations")}
            head={
              <>
                <th scope="col" className={th}>{t("colEmail")}</th>
                <th scope="col" className={th}>{t("colRole")}</th>
                <th scope="col" className={th}>{t("colScope")}</th>
                <th scope="col" className={th}>{t("colExpires")}</th>
                <th scope="col" className={cn(th, "text-right")}>{t("colActions")}</th>
              </>
            }
          >
            {visible.map((inv) => (
              <tr key={inv.id}>
                <td className={cn(td, "max-w-80 truncate")}>{inv.email}</td>
                <td className={cn(td, "whitespace-nowrap")}>{inv.role}</td>
                <td className={td}>{inv.scope}</td>
                <td className={cn(td, "whitespace-nowrap text-label-secondary")}>{inv.expires}</td>
                <td className={cn(td, "text-right")}>
                  <span className="inline-flex justify-end">{actions(inv)}</span>
                </td>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}
    </>
  );
}
