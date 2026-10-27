import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ReceptionDesk } from "@/components/desk/reception-desk";
import { requireStaffSession } from "@/lib/auth/session";
import { loadReception } from "@/lib/desk/reception";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ branchId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reception");
  return { title: t("title") };
}

/** Poste d'accueil d'une agence. */
export default async function ReceptionPage({ params }: Props) {
  const { branchId } = await params;
  await requireStaffSession(`/desk/reception/${branchId}`);
  if (!/^[0-9a-f-]{36}$/i.test(branchId)) notFound();
  const data = await loadReception(await getSupabaseServerClient(), branchId);
  if (!data) notFound();
  return <ReceptionDesk initial={data} />;
}
