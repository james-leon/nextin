import { createElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { getAppUrl, qrEntryUrl, slugify } from "@nextin/shared";
import { displayDomain, servicesLine } from "@/lib/pdf/poster-colors";
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
  // Session vérifiée auprès de Supabase (une session révoquée est refusée), comme partout ailleurs.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return new Response("Unauthorized", { status: 401 });

  const [{ data: org }, { data: branch }, { count: branchCount }, qrResult, serviceResult, { data: services }] = await Promise.all([
    supabase.from("organizations").select("name, default_locale").eq("id", orgId).maybeSingle(),
    supabase.from("branches").select("name").eq("id", branchId).eq("organization_id", orgId).maybeSingle(),
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
    service
      ? supabase.from("qr_codes").select("token, short_code").eq("branch_id", branchId).eq("service_id", service).eq("active", true).maybeSingle()
      : supabase.from("qr_codes").select("token, short_code").eq("branch_id", branchId).is("service_id", null).eq("active", true).maybeSingle(),
    service ? supabase.from("services").select("name").eq("id", service).eq("branch_id", branchId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("services").select("name, name_en").eq("branch_id", branchId).eq("active", true).order("sort_order"),
  ]);
  if (!org || !branch || !qrResult.data) return new Response("Not found", { status: 404 });

  const locale: Locale = isLocale(org.default_locale) ? org.default_locale : "fr";
  const t = await getTranslations({ locale, namespace: "poster" });
  const serviceName = serviceResult.data?.name;

  const element = createElement(QrPosterDocument, {
    format: format as PosterFormat,
    orgName: org.name,
    branchLine: (branchCount ?? 1) > 1 ? t("branchOf", { name: branch.name }) : undefined,
    url: qrEntryUrl(qrResult.data.token),
    domain: displayDomain(getAppUrl()),
    shortCode: qrResult.data.short_code,
    text: {
      headline: t("headline"),
      secondary: t("secondary"),
      scanTag: t("scanTag"),
      noCamera: t("noCamera"),
      enterCode: t("enterCode"),
      steps: [
        { title: t("scanTitle"), text: t("scanText") },
        // Affiche d'un service : pas de choix à faire, phrase générique.
        { title: t("chooseTitle"), text: serviceName ? t("chooseText") : servicesLine((services ?? []).map((x) => (locale === "en" ? (x.name_en ?? x.name) : x.name)), t("chooseText")) },
        { title: t("waitTitle"), text: t("waitText") },
      ],
      footerTitle: t("footerTitle"),
      footerText: t("footerText"),
      serviceLine: serviceName ? t("serviceLine", { name: serviceName }) : undefined,
    },
  }) as unknown as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  // Démarrage (maquette v2 19) : supports QR téléchargés = étape « Imprimer le QR code » faite. Réservé aux
  // administrateurs par la base ; un autre rôle obtient quand même son PDF (erreur ignorée).
  await supabase.rpc("set_onboarding_step", { p_org: orgId, p_step: 4 });

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
