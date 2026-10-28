import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppointmentsView } from "@/components/appointments/appointments-view";
import { requireStaffSession } from "@/lib/auth/session";
import { loadAppointmentsContext } from "@/lib/desk/appointments";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ branchId: string }>; searchParams: Promise<{ view?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments");
  return { title: t("title") };
}

/** Rendez-vous de l'agence : jour, semaine, prise de rendez-vous et arrivées (accueil, M5b). */
export default async function AppointmentsPage({ params, searchParams }: Props) {
  const { branchId } = await params;
  const { view } = await searchParams;
  await requireStaffSession(`/desk/reception/${branchId}/appointments`);
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) notFound();
  const supabase = await getSupabaseServerClient();
  const ctx = await loadAppointmentsContext(supabase, branchId);
  if (!ctx) notFound();
  // Demandes des patients (M9) : nombre en attente dans le sélecteur, vue directe depuis l'accueil.
  const { count } = await supabase
    .from("appointment_requests")
    .select("id", { count: "exact", head: true })
    .eq("branch_id", branchId)
    .eq("status", "pending");
  return <AppointmentsView ctx={ctx} initialView={view === "requests" ? "requests" : "day"} pendingRequests={count ?? 0} />;
}
