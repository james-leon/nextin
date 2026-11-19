import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { buildIcs } from "@/lib/calendar/ics";
import { callRpc } from "@/lib/client/supabase-public";
import type { RequestView } from "@/lib/client/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /r/<jeton>/calendar — « Ajouter au calendrier » d'une demande de rendez-vous acceptée (LOT 5a, B10) : fichier
 * .ics à l'heure de Douala avec un rappel une heure avant. Le jeton secret du lien suffit ; aucune donnée personnelle
 * ni dans l'adresse ni dans le fichier (service, praticien et agence seulement).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9]{22}$/.test(token)) return new NextResponse(null, { status: 404 });
  const { data: view } = await callRpc<RequestView | null>("get_appointment_request", { p_token: token });
  if (!view?.appointment || (view.status !== "accepted" && view.status !== "modified")) return new NextResponse(null, { status: 404 });
  // Fin du rendez-vous (absente de la vue publique) : lue sur le serveur, par le jeton du lien.
  const { data: row } = await getSupabaseAdminClient()
    .from("appointment_requests")
    .select("appointment:appointments(id, starts_at, ends_at)")
    .eq("public_token", token)
    .maybeSingle();
  const appointment = row?.appointment as { id: string; starts_at: string; ends_at: string } | null;
  if (!appointment) return new NextResponse(null, { status: 404 });
  const locale = await getLocale();
  const t = await getTranslations("client.requestStatus");
  const service = locale === "en" && view.service.name_en ? view.service.name_en : view.service.name;
  const place = `${view.organization.name} – ${view.branch.name}`;
  const ics = buildIcs({
    uid: `${appointment.id}@nextin`,
    start: new Date(appointment.starts_at),
    end: new Date(appointment.ends_at),
    summary: `${service} · ${place}`,
    location: [place, view.branch.address, view.branch.city].filter(Boolean).join(", "),
    description: `${t("with", { name: view.appointment.practitioner })}. ${t("arrival")}`,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${locale === "en" ? "appointment" : "rendez-vous"}.ics"`,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
