import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "./helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabaseOptions = { auth: { persistSession: false, autoRefreshToken: false } };

export function anonClient() {
  return createClient(url, anonKey, supabaseOptions);
}

/** Numéro camerounais aléatoire (jamais en 99999, réservé aux échecs simulés). */
export function randomCameroonPhone(): string {
  return `+2376${String(Math.floor(Math.random() * 1e8)).padStart(8, "0").replace(/99999$/, "12345")}`;
}

/**
 * Inscription d'un établissement comme dans l'application (M10a) : code envoyé au téléphone (lu dans la file d'envoi),
 * vérifié par le directeur, puis `self_service_signup`. Par défaut, l'abonnement d'essai est retiré : établissement
 * « pilote », tout compris, comme ceux créés avant le M10a (les parcours des autres modules n'en dépendent pas).
 */
export async function signUpOrganization(staff: SupabaseClient, name: string, options: { pilot?: boolean; phone?: string } = {}) {
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);
  const { data: user } = await staff.auth.getUser();
  const verification = await rpc<string>(admin, "request_phone_code", {
    p_user: user.user!.id,
    p_phone: options.phone ?? randomCameroonPhone(),
    p_locale: "fr",
  });
  const message = await admin.from("account_messages").select("payload").eq("dedupe_key", `phone_code:${verification}:whatsapp`).single();
  await rpc(staff, "verify_phone_code", { p_verification: verification, p_code: (message.data!.payload as { code: string }).code });
  const signup = await rpc<{ organization_id: string }>(staff, "self_service_signup", {
    p_name: name,
    p_slug: `e2e-${randomUUID().slice(0, 8)}`,
    p_type: "clinic",
    p_default_locale: "fr",
    p_verification: verification,
  });
  if (options.pilot !== false) await admin.from("subscriptions").delete().eq("organization_id", signup.organization_id);
  return signup.organization_id;
}

export async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/**
 * Établissement de test : agence ouverte en permanence, services « Consultation » (C) et « Pédiatrie » (P),
 * cabinet 3 ouvert pour la consultation. Renvoie le compte du personnel et les codes d'entrée.
 */
export async function setUpBranch(name = "Clinique E2E") {
  const staff = anonClient();
  const email = uniqueEmail("queue");
  const { error } = await staff.auth.signUp({ email, password: PASSWORD });
  expect(error).toBeNull();
  const orgId = await signUpOrganization(staff, name);
  const branchId = await rpc<string>(staff, "create_branch", { p_org: orgId, p_name: "Akwa" });
  await staff.from("opening_hours").upsert(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ organization_id: orgId, branch_id: branchId, weekday, opens_at: "00:00", closes_at: "23:59:59" })),
    { onConflict: "branch_id,weekday" },
  );
  const services = await staff
    .from("services")
    .insert([
      { organization_id: orgId, branch_id: branchId, name: "Consultation", prefix: "C", default_service_seconds: 600, sort_order: 1, color: "#1A6BB5" },
      { organization_id: orgId, branch_id: branchId, name: "Pédiatrie", prefix: "P", default_service_seconds: 720, sort_order: 2, color: "#2E8B57" },
    ])
    .select("id, prefix");
  expect(services.error).toBeNull();
  const consultation = services.data!.find((s) => s.prefix === "C")!.id;
  const counter = await staff.from("counters").insert({ organization_id: orgId, branch_id: branchId, kind: "cabinet", number: 3 }).select("id").single();
  await staff.from("counter_services").insert({ organization_id: orgId, counter_id: counter.data!.id, service_id: consultation });
  await rpc(staff, "open_counter", { p_counter: counter.data!.id });
  const qr = await staff.from("qr_codes").select("token, short_code").eq("branch_id", branchId).eq("active", true).single();
  return {
    staff,
    email,
    orgId,
    branchId,
    serviceId: consultation,
    counterId: counter.data!.id,
    entryCode: qr.data!.token,
    shortCode: qr.data!.short_code,
  };
}

type Branch = Awaited<ReturnType<typeof setUpBranch>>;

/** Deux médecins de même spécialité : Dr Abena au cabinet 3 (existant), Dr Bilong au cabinet 4 (ouvert). */
export async function addDoctors(b: Branch) {
  const spec = await b.staff.from("specialties").insert({ organization_id: b.orgId, name: "Médecine générale" }).select("id").single();
  const docs = await b.staff
    .from("practitioners")
    .insert([
      { organization_id: b.orgId, branch_id: b.branchId, title: "Dr", display_name: "Abena", specialty_id: spec.data!.id },
      { organization_id: b.orgId, branch_id: b.branchId, title: "Dr", display_name: "Bilong", specialty_id: spec.data!.id },
    ])
    .select("id, display_name");
  const abena = docs.data!.find((d) => d.display_name === "Abena")!.id;
  const bilong = docs.data!.find((d) => d.display_name === "Bilong")!.id;
  await b.staff.from("counters").update({ default_practitioner_id: abena }).eq("id", b.counterId).select("id");
  const cab4 = await b.staff
    .from("counters")
    .insert({ organization_id: b.orgId, branch_id: b.branchId, kind: "cabinet", number: 4, default_practitioner_id: bilong })
    .select("id")
    .single();
  await b.staff.from("counter_services").insert({ organization_id: b.orgId, counter_id: cab4.data!.id, service_id: b.serviceId });
  await rpc(b.staff, "open_counter", { p_counter: cab4.data!.id });
  return { abena, bilong, cab4: cab4.data!.id };
}
