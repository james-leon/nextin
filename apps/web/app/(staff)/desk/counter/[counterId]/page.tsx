import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AgentDesk } from "@/components/desk/agent-desk";
import { requireStaffSession } from "@/lib/auth/session";
import { counterName, practitionerName } from "@/lib/desk/counter-name";
import { loadDeskSnapshot } from "@/lib/desk/snapshot";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ counterId: string }> };

async function loadCounter(counterId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(counterId)) notFound();
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("counters")
    .select(
      "id, kind, number, label, branch_id, default_practitioner_id, branch:branches(id, name, timezone), counter_services(service:services(id, name, active))",
    )
    .eq("id", counterId)
    .eq("active", true)
    .maybeSingle();
  if (!data || !data.branch) notFound();
  return { supabase, counter: data };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { counterId } = await params;
  await requireStaffSession(`/desk/counter/${counterId}`);
  const { counter } = await loadCounter(counterId);
  const tk = await getTranslations("counterKinds");
  return { title: counterName(counter, (k) => tk(k as "cabinet")) };
}

/** Poste agent / cabinet (maquette 04). */
export default async function CounterDeskPage({ params }: Props) {
  const { counterId } = await params;
  await requireStaffSession(`/desk/counter/${counterId}`);
  const { supabase, counter } = await loadCounter(counterId);
  const tk = await getTranslations("counterKinds");
  const branch = counter.branch as { id: string; name: string; timezone: string };
  const ownServices = (counter.counter_services ?? [])
    .map((cs) => cs.service as { id: string; name: string; active: boolean } | null)
    .filter((s): s is { id: string; name: string; active: boolean } => !!s && s.active);

  const [services, practitioner, absence] = await Promise.all([
    supabase.from("services").select("id, name, prefix, color").eq("branch_id", branch.id).eq("active", true).order("sort_order"),
    counter.default_practitioner_id
      ? supabase.from("practitioners").select("id, title, display_name").eq("id", counter.default_practitioner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    counter.default_practitioner_id
      ? supabase
          .from("practitioner_absences")
          .select("id, kind, until")
          .eq("practitioner_id", counter.default_practitioner_id)
          .is("ended_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const deskCounter = { id: counter.id, branchId: branch.id, serviceIds: ownServices.map((s) => s.id), timeZone: branch.timezone };
  const initial = await loadDeskSnapshot(supabase, deskCounter);
  const activeAbsence =
    absence.data && (!absence.data.until || new Date(absence.data.until) > new Date())
      ? { id: absence.data.id, kind: absence.data.kind, until: absence.data.until }
      : null;
  const doctor = practitioner.data ? { id: practitioner.data.id, name: practitionerName(practitioner.data) } : null;

  return (
    <AgentDesk
      counter={deskCounter}
      title={counterName(counter, (k) => tk(k as "cabinet"))}
      subtitle={[ownServices.map((s) => s.name).join(", "), doctor?.name, branch.name].filter(Boolean).join(" · ")}
      initial={initial}
      services={services.data ?? []}
      practitioner={doctor}
      absence={activeAbsence}
    />
  );
}
