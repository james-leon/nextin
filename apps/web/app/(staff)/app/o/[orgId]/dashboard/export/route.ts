import type { NextRequest } from "next/server";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { toCsv, toMinutes } from "@nextin/shared/stats";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const params = z.object({
  kind: z.enum(["services", "counters"]),
  from: z.iso.date(),
  to: z.iso.date(),
  branch: z.uuid().optional(),
});

type ServiceRow = {
  day: string; branch: string; service: string; prefix: string; issued: number; served: number; no_show: number; cancelled: number;
  transferred: number; remote: number; appointment: number; wait_avg_seconds: number | null; max_wait_seconds: number;
  service_avg_seconds: number | null; rating_avg: number | null; rating_count: number;
};
type CounterRow = {
  day: string; branch: string; kind: string; number: number; label: string | null; practitioner: string | null; called: number;
  served: number; no_show: number; service_avg_seconds: number | null; rating_avg: number | null; open_seconds: number; pause_seconds: number;
};

/**
 * GET /app/o/<org>/dashboard/export — CSV du tableau de bord (par jour et service, ou par jour et poste), pour la
 * période et l'agence affichées. Droits vérifiés par `stats_export` (administrateur ou responsable d'agence).
 */
export async function GET(request: NextRequest, { params: route }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await route;
  const parsed = params.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!z.uuid().safeParse(orgId).success || !parsed.success) return new Response("Bad request", { status: 400 });
  const { kind, from, to, branch } = parsed.data;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await supabase.rpc("stats_export", {
    p_org: orgId,
    p_branch: (branch ?? null) as string,
    p_from: from,
    p_to: to,
    p_kind: kind,
  });
  if (error) return new Response("Forbidden", { status: error.code === "42501" || error.message === "feature_unavailable" ? 403 : 400 });
  const t = await getTranslations("dashboard.csv");
  const tk = await getTranslations("counterKinds");
  const csv =
    kind === "services"
      ? toCsv([
          [t("day"), t("branch"), t("service"), t("prefix"), t("issued"), t("served"), t("noShow"), t("cancelled"), t("transferred"),
            t("remote"), t("appointment"), t("waitAvg"), t("maxWait"), t("serviceAvg"), t("rating"), t("ratingCount")],
          ...((data ?? []) as unknown as ServiceRow[]).map((r) => [
            r.day, r.branch, r.service, r.prefix, r.issued, r.served, r.no_show, r.cancelled, r.transferred, r.remote, r.appointment,
            toMinutes(r.wait_avg_seconds), toMinutes(r.max_wait_seconds), toMinutes(r.service_avg_seconds), r.rating_avg, r.rating_count,
          ]),
        ])
      : toCsv([
          [t("day"), t("branch"), t("counter"), t("practitioner"), t("called"), t("served"), t("noShow"), t("serviceAvg"), t("rating"),
            t("openMinutes"), t("pauseMinutes")],
          ...((data ?? []) as unknown as CounterRow[]).map((r) => [
            r.day, r.branch, r.label ?? `${tk(r.kind as "cabinet")} ${r.number}`, r.practitioner, r.called, r.served, r.no_show,
            toMinutes(r.service_avg_seconds), r.rating_avg, toMinutes(r.open_seconds), toMinutes(r.pause_seconds),
          ]),
        ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nextin-${kind}-${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
