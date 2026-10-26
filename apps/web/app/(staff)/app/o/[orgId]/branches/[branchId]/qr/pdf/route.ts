import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { qrEntryUrl, slugify } from "@nextin/shared";
import { QrPosterDocument, type PosterFormat } from "@/lib/pdf/qr-poster";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const query = z.object({
  format: z.enum(["a5", "a4"]),
  service: z.uuid().optional(),
});

/**
 * Support QR à imprimer (PDF déjà rempli) : chevalet A5 ou affiche A4, pour l'agence ou un service.
 * L'accès passe par la session du personnel : RLS ne renvoie l'agence qu'à son personnel.
 */
export async function GET(request: Request, { params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  const url = new URL(request.url);
  const parsed = query.safeParse({ format: url.searchParams.get("format"), service: url.searchParams.get("service") ?? undefined });
  if (!parsed.success || !z.uuid().safeParse(orgId).success || !z.uuid().safeParse(branchId).success) {
    return new Response("Bad request", { status: 400 });
  }
  const { format, service } = parsed.data;

  const supabase = await getSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims || claims.claims.is_anonymous) return new Response("Unauthorized", { status: 401 });

  const [{ data: org }, { data: branch }, { count: branchCount }, qrResult, serviceResult] = await Promise.all([
    supabase.from("organizations").select("name, default_locale").eq("id", orgId).maybeSingle(),
    supabase.from("branches").select("name").eq("id", branchId).eq("organization_id", orgId).maybeSingle(),
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    service
      ? supabase.from("qr_codes").select("token, short_code").eq("branch_id", branchId).eq("service_id", service).eq("active", true).maybeSingle()
      : supabase.from("qr_codes").select("token, short_code").eq("branch_id", branchId).is("service_id", null).eq("active", true).maybeSingle(),
    service ? supabase.from("services").select("name").eq("id", service).eq("branch_id", branchId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!org || !branch || !qrResult.data) return new Response("Not found", { status: 404 });

  const locale: Locale = isLocale(org.default_locale) ? org.default_locale : "fr";
  const t = await getTranslations({ locale, namespace: "poster" });
  const serviceName = serviceResult.data?.name;

  const element = createElement(QrPosterDocument, {
    format: format as PosterFormat,
    orgName: org.name,
    branchName: (branchCount ?? 1) > 1 ? branch.name : undefined,
    url: qrEntryUrl(qrResult.data.token),
    shortCode: qrResult.data.short_code,
    text: {
      headline: t("headline"),
      subtitle: t("subtitle"),
      steps: [t("step1"), t("step2"), t("step3")],
      footer: t("footer"),
      secondary: t("secondary"),
      serviceLine: serviceName ? t("serviceLine", { name: serviceName }) : undefined,
    },
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);

  const name = ["nextin", slugify(org.name), slugify(branch.name), serviceName ? slugify(serviceName) : null, format === "a5" ? "chevalet-a5" : "affiche-a4"]
    .filter(Boolean)
    .join("-");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
