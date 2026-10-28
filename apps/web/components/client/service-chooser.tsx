"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { useRouter } from "next/navigation";
import { Check, Clock } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { PRIORITY_REASONS, type BranchBoard, type BoardService, type PriorityReason } from "@nextin/shared/queue/live";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { ServiceTile } from "@/components/ui/service-tile";
import { remoteTicketsFor, saveTicket } from "@/lib/client/my-tickets";
import { callRpc } from "@/lib/client/supabase-public";
import { subscribeBoard } from "@/lib/client/board-feed";
import { takeTicket } from "@/lib/client/take-ticket";
import type { EntryInfo, TicketView } from "@/lib/client/types";

/** Écran 02 « Choisir un service » : files en direct, accès prioritaire, une action principale. */
export function ServiceChooser({ entry, captchaSiteKey }: { entry: EntryInfo; captchaSiteKey: string | null }) {
  const t = useLiteT("client.service");
  const te = useLiteT("errors");
  const locale = useLiteLocale();
  const router = useRouter();
  const captchaRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<BranchBoard>(entry.board);
  const services = useMemo(
    () => board.services.filter((s) => !entry.service_id || s.id === entry.service_id),
    [board, entry.service_id],
  );
  const [selected, setSelected] = useState<string | null>(entry.service_id ?? services[0]?.id ?? null);
  const [priority, setPriority] = useState(false);
  const [reason, setReason] = useState<PriorityReason>("appointment");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Files mises à jour en direct ; rechargement complet à chaque (re)connexion.
  useEffect(() => subscribeBoard(entry.branch.id, setBoard), [entry.branch.id]);

  // Ticket à distance de cet appareil dans cette agence (M9) : scanner le QR code de l'accueil confirme la présence.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const saved of remoteTicketsFor(entry.branch.id)) {
        const { data } = await callRpc<TicketView>("confirm_presence", { p_token: saved.token, p_entry_code: entry.entry_code });
        if (cancelled) return;
        if (data && (data.status === "waiting" || data.status === "called")) {
          router.replace(`/t/${saved.token}`);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.branch.id, entry.entry_code, router]);

  const name = (s: BoardService) => (locale === "en" && s.name_en ? s.name_en : s.name);
  const summary = (s: BoardService) => {
    const minutes = waitMinutes(s.wait_seconds);
    return s.waiting.length === 0 && minutes === 0 ? t("noWait") : t("people", { count: s.waiting.length, minutes });
  };
  const current = services.find((s) => s.id === selected) ?? null;
  const priorityAllowed = entry.priorities_enabled && !!current && entry.priority_service_ids.includes(current.id);

  async function submit() {
    if (!current) return;
    setPending(true);
    setError(null);
    const outcome = await takeTicket(
      {
        serviceId: current.id,
        source: entry.source,
        entryCode: entry.entry_code,
        priorityReason: priority && priorityAllowed ? reason : null,
      },
      { siteKey: captchaSiteKey, container: captchaRef.current },
    );
    if (outcome.ok) {
      saveTicket({ token: outcome.token, code: outcome.code, entry: entry.entry_code });
      router.push(`/t/${outcome.token}`);
      return;
    }
    if (outcome.existingPath) {
      router.push(outcome.existingPath);
      return;
    }
    setPending(false);
    setError(te.has(outcome.error) ? te(outcome.error) : te("generic"));
  }

  return (
    <main className="min-h-dvh pb-48">
      <NavigationBar
        title={t("title")}
        eyebrow={entry.organization.name}
        back={{ href: "/", label: t("back") }}
        trailing={
          <Badge shape="pill" tone="green">
            <Check aria-hidden />
            {entry.source === "qr" ? t("recognized") : t("codeRecognized")}
          </Badge>
        }
        contentClassName="max-w-lg"
      >
        <p className="mt-1 text-subheadline text-label-secondary">
          {entry.branch.name} · {t("subtitle")}
        </p>
      </NavigationBar>

      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3">
        {!entry.branch.is_open ? (
          <CalloutCard icon={<Clock />} role="status">
            {t("branchClosed")}
          </CalloutCard>
        ) : null}
        {services.length === 0 ? (
          <CalloutCard icon={<Clock />}>{t("empty")}</CalloutCard>
        ) : (
          <ListSection header={t("header")} radioGroupLabel={t("header")}>
            {services.map((s) => (
              <ListRow
                key={s.id}
                role="radio"
                selected={selected === s.id}
                onClick={() => setSelected(s.id)}
                icon={<ServiceTile letter={s.prefix} color={s.color} />}
                title={name(s)}
                subtitle={<span className="tabular">{summary(s)}</span>}
                accessory="check"
              />
            ))}
          </ListSection>
        )}

        {priorityAllowed ? (
          <>
            <ListSection>
              <ListSwitchRow title={t("priority")} subtitle={t("priorityHint")} checked={priority} onCheckedChange={setPriority} />
            </ListSection>
            {priority ? (
              <ListSection header={t("reasonHeader")} footer={t("reasonFooter")} radioGroupLabel={t("reasonHeader")}>
                {PRIORITY_REASONS.map((r) => (
                  <ListRow
                    key={r}
                    role="radio"
                    selected={reason === r}
                    onClick={() => setReason(r)}
                    title={t(`reasons.${r}`)}
                    accessory="check"
                  />
                ))}
              </ListSection>
            ) : null}
          </>
        ) : null}
        <div ref={captchaRef} className="flex justify-center empty:hidden" />
      </div>

      <BottomBar
        summary={
          error ? (
            <span role="alert" className="text-red-text">
              {error}
            </span>
          ) : current ? (
            <span className="tabular">
              {name(current)} · {summary(current)}
            </span>
          ) : undefined
        }
      >
        <Button block onClick={submit} loading={pending} loadingLabel={t("taking")} disabled={!current || !entry.branch.is_open}>
          {t("take")}
        </Button>
      </BottomBar>
    </main>
  );
}
