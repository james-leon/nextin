import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { BranchBoard } from "@nextin/shared/queue/live";
import { AdminPage } from "@/components/admin/admin-page";
import { TestDesk, type TestDeskTicket } from "@/components/admin/test-desk";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { FlaskConical } from "lucide-react";

type Props = { params: Promise<{ orgId: string; branchId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("testDesk");
  return { title: t("title") };
}

/** Poste de test temporaire (M4) pour éprouver le suivi client avant le poste de l'agent (M5). */
export default async function TestDeskPage({ params, searchParams }: Props) {
  const { orgId, branchId } = await params;
  const { counter: counterParam } = await searchParams;
  const { ctx, branch } = await getBranch(orgId, branchId);
  const t = await getTranslations("testDesk");
  const tk = await getTranslations("counterKinds");
  const supabase = await getSupabaseServerClient();
  const base = `/app/o/${orgId}/branches/${branchId}`;
  const path = `${base}/test-desk`;

  const { data: counters } = await supabase
    .from("counters")
    .select("id, kind, number, label, status, counter_services(service_id)")
    .eq("branch_id", branchId)
    .eq("active", true)
    .order("kind")
    .order("number");
  const counter = counters?.find((c) => c.id === counterParam) ?? counters?.[0];

  let current: TestDeskTicket | null = null;
  let waiting: string[] = [];
  if (counter) {
    const [{ data: ticket }, { data: board }] = await Promise.all([
      supabase
        .from("tickets")
        .select("id, display_code, status, serving_started_at")
        .eq("counter_id", counter.id)
        .in("status", ["called", "serving"])
        .maybeSingle(),
      supabase.rpc("get_branch_board", { p_branch: branchId }),
    ]);
    if (ticket) {
      current = {
        id: ticket.id,
        code: ticket.display_code,
        status: ticket.status as TestDeskTicket["status"],
        servingStartedAt: ticket.serving_started_at,
      };
    }
    const served = new Set(counter.counter_services.map((s) => s.service_id));
    waiting = ((board as BranchBoard | null)?.services ?? []).filter((s) => served.has(s.id)).flatMap((s) => s.waiting);
  }

  const name = (c: { kind: string; number: number; label: string | null }) => c.label ?? `${tk(c.kind as "cabinet")} ${c.number}`;

  return (
    <AdminPage title={t("title")} eyebrow={`${ctx.org.name} · ${branch.name}`} subtitle={t("body")} back={{ href: base, label: branch.name }}>
      <CalloutCard icon={<FlaskConical />} tone="orange">
        {t("linkHint")}
      </CalloutCard>
      {!counter ? (
        <CalloutCard icon={<FlaskConical />}>{t("noCounters")}</CalloutCard>
      ) : (
        <>
          <ListSection header={t("counterHeader")}>
            {counters!.map((c) => (
              <ListRow
                key={c.id}
                href={`${path}?counter=${c.id}`}
                title={name(c)}
                detail={
                  <Badge tone={c.status === "open" ? "green" : c.status === "paused" ? "orange" : "neutral"}>{t(`status.${c.status}`)}</Badge>
                }
                accessory={c.id === counter.id ? "check" : undefined}
                selected={c.id === counter.id}
              />
            ))}
          </ListSection>
          <TestDesk
            key={counter.id}
            path={path}
            branchId={branchId}
            counterId={counter.id}
            counterOpen={counter.status === "open"}
            current={current}
            waiting={waiting}
          />
        </>
      )}
    </AdminPage>
  );
}
