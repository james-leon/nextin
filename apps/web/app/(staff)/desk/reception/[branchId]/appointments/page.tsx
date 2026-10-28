import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppointmentsView } from "@/components/appointments/appointments-view";
import { requireStaffSession } from "@/lib/auth/session";
import { loadAppointmentsContext } from "@/lib/desk/appointments";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ branchId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("appointments");
  return { title: t("title") };
}

/** Rendez-vous de l'agence : jour, semaine, prise de rendez-vous et arrivées (accueil, M5b). */
export default async function AppointmentsPage({ params }: Props) {
  const { branchId } = await params;
  await requireStaffSession(`/desk/reception/${branchId}/appointments`);
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) notFound();
  const ctx = await loadAppointmentsContext(await getSupabaseServerClient(), branchId);
  if (!ctx) notFound();
  return <AppointmentsView ctx={ctx} />;
}
