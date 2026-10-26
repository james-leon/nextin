import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "./helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Agence ouverte en permanence, un service « Consultation » et un cabinet ouvert. */
async function setUpBranch() {
  const staff = createClient(url, anonKey, opts);
  const { error } = await staff.auth.signUp({ email: uniqueEmail("m3"), password: PASSWORD });
  expect(error).toBeNull();
  const orgId = await rpc<string>(staff, "create_organization", { p_name: "Clinique M3", p_slug: `m3-${randomUUID().slice(0, 8)}`, p_type: "clinic" });
  const branchId = await rpc<string>(staff, "create_branch", { p_org: orgId, p_name: "Akwa" });
  await staff.from("opening_hours").upsert(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ organization_id: orgId, branch_id: branchId, weekday, opens_at: "00:00", closes_at: "23:59:59" })),
    { onConflict: "branch_id,weekday" },
  );
  const service = await staff
    .from("services")
    .insert({ organization_id: orgId, branch_id: branchId, name: "Consultation", prefix: "C", default_service_seconds: 600 })
    .select("id")
    .single();
  const counter = await staff.from("counters").insert({ organization_id: orgId, branch_id: branchId, kind: "cabinet", number: 3 }).select("id").single();
  await staff.from("counter_services").insert({ organization_id: orgId, counter_id: counter.data!.id, service_id: service.data!.id });
  await rpc(staff, "open_counter", { p_counter: counter.data!.id });
  const qr = await staff.from("qr_codes").select("token").eq("branch_id", branchId).eq("active", true).single();
  return { staff, serviceId: service.data!.id, counterId: counter.data!.id, entryCode: qr.data!.token };
}

test.describe("M3 — prise de ticket et appel en deux temps", () => {
  test("API /api/tickets → alerte → admission", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "parcours API, indépendant de l'appareil");
    const { staff, serviceId, counterId, entryCode } = await setUpBranch();
    const visitor = createClient(url, anonKey, opts);
    const { data: anon, error } = await visitor.auth.signInAnonymously();
    expect(error).toBeNull();
    const headers = { Authorization: `Bearer ${anon.session!.access_token}` };

    // Garde-fous : JSON uniquement, session requise, code d'entrée valide.
    expect((await request.post("/api/tickets", { headers, form: { serviceId } })).status()).toBe(415);
    const noSession = await request.post("/api/tickets", { data: { serviceId, source: "qr", entryCode } });
    expect(noSession.status()).toBe(401);
    const badEntry = await request.post("/api/tickets", { headers, data: { serviceId, source: "qr", entryCode: "ZZZZZZZZZZ" } });
    expect(badEntry.status()).toBe(422);
    expect(await badEntry.json()).toEqual({ ok: false, error: "invalid_entry" });

    // Prise de ticket : C-001, lien vers /t/<jeton> construit depuis APP_URL.
    const created = await request.post("/api/tickets", { headers, data: { serviceId, source: "qr", entryCode } });
    expect(created.status()).toBe(201);
    const body = await created.json();
    expect(body.ticket.displayCode).toBe("C-001");
    expect(body.ticket.url).toBe(`${process.env.APP_URL}/t/${body.ticket.publicToken}`);
    expect(created.headers()["cache-control"]).toContain("no-store");

    // Deuxième demande : le ticket actif est rendu.
    const again = await request.post("/api/tickets", { headers, data: { serviceId, source: "short_code", entryCode } });
    expect(again.status()).toBe(409);
    expect(await again.json()).toEqual({ ok: false, error: "active_ticket_exists", ticketUrl: body.ticket.url });

    // Suivi public : en attente, 1er de la file.
    const waiting = await rpc<{ status: string; position: number }>(visitor, "get_ticket", { p_token: body.ticket.publicToken });
    expect(waiting).toMatchObject({ status: "waiting", position: 1 });

    // « Alerter le suivant » puis « Admettre » : chrono démarré à l'admission seulement.
    const called = await rpc<{ id: string; status: string; serving_started_at: string | null }>(staff, "call_next", { p_counter: counterId });
    expect(called).toMatchObject({ status: "called", serving_started_at: null });
    const view = await rpc<{ status: string; counter: { kind: string; number: number } }>(visitor, "get_ticket", { p_token: body.ticket.publicToken });
    expect(view).toMatchObject({ status: "called", counter: { kind: "cabinet", number: 3 } });
    const admitted = await rpc<{ status: string; serving_started_at: string | null }>(staff, "admit_ticket", { p_ticket: called.id });
    expect(admitted.status).toBe("serving");
    expect(admitted.serving_started_at).not.toBeNull();
  });
});
