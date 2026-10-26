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
  const orgId = await rpc<string>(staff, "create_organization", { p_name: name, p_slug: `e2e-${randomUUID().slice(0, 8)}`, p_type: "clinic" });
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
