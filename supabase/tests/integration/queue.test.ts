/**
 * M3 — intégration contre le Supabase local : appels simultanés (aucun ticket alerté deux fois)
 * et diffusion Realtime (tableau public, ticket du client, canal privé du personnel).
 * Les données créées (établissement « it-… ») restent dans la base locale : le journal d'audit est append-only.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { boardTopic, staffTopic, ticketTopic } from "../../../packages/shared/src/queue/realtime";

const url = process.env.IT_SUPABASE_URL!;
const anonKey = process.env.IT_ANON_KEY!;
const serviceKey = process.env.IT_SERVICE_ROLE_KEY!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const admin = createClient(url, serviceKey, opts);
const staff = createClient(url, anonKey, opts);
const visitor = createClient(url, anonKey, opts);
const COUNTERS = 6;

let orgId = "";
let branchId = "";
let serviceId = "";
let counterIds: string[] = [];
const channels: RealtimeChannel[] = [];
let boardFeed: Awaited<ReturnType<typeof listen>>;

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

/** Un abonnement : statut final (SUBSCRIBED, CHANNEL_ERROR, TIMEOUT…). */
function subscribe(channel: RealtimeChannel) {
  return new Promise<string>((resolve) => {
    channel.subscribe((s) => {
      if (s !== "CLOSED") resolve(s);
    });
    setTimeout(() => resolve("TIMEOUT"), 10_000);
  });
}

/**
 * Abonnement à un canal ; `waitFor` résout dès qu'un message satisfait le prédicat.
 * `expectJoin` : réessaie tant que Realtime refuse (service qui redémarre juste après `db:reset`).
 */
async function listen(client: SupabaseClient, topic: string, event: string, isPrivate = false, expectJoin = true) {
  const received: unknown[] = [];
  const waiters: { test: (p: unknown) => boolean; resolve: (p: unknown) => void }[] = [];
  let status = "";
  for (let attempt = 0; ; attempt++) {
    const channel = client.channel(topic, { config: { private: isPrivate } });
    channel.on("broadcast", { event }, ({ payload }) => {
      received.push(payload);
      for (const w of [...waiters]) if (w.test(payload)) w.resolve(payload);
    });
    status = await subscribe(channel);
    if (status === "SUBSCRIBED" || !expectJoin || attempt >= 10) {
      channels.push(channel);
      break;
    }
    await client.removeChannel(channel);
    await new Promise((r) => setTimeout(r, 2_000));
  }
  const waitFor = <T>(test: (p: T) => boolean, ms = 10_000) =>
    new Promise<T>((resolve, reject) => {
      const hit = received.find((p) => test(p as T));
      if (hit) return resolve(hit as T);
      const timer = setTimeout(
        () => reject(new Error(`no matching ${event} message on ${topic} (${received.length} received)`)),
        ms,
      );
      waiters.push({ test: (p) => test(p as T), resolve: (p) => (clearTimeout(timer), resolve(p as T)) });
    });
  return { status, waitFor };
}

type Board = { services: { id: string; waiting: string[] }[]; calls: { code: string; status: string }[] };

before(async () => {
  const email = `it-${randomUUID().slice(0, 8)}@nextin.test`;
  const password = `It${randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.ifError(created.error);
  const login = await staff.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  await staff.realtime.setAuth(login.data.session!.access_token);

  orgId = await rpc<string>(staff, "create_organization", { p_name: "IT Clinic", p_slug: `it-${randomUUID().slice(0, 8)}`, p_type: "clinic" });
  branchId = await rpc<string>(staff, "create_branch", { p_org: orgId, p_name: "Akwa" });
  // Ouverte toute la journée : le test ne dépend pas de l'heure d'exécution.
  const hours = await staff.from("opening_hours").upsert(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ organization_id: orgId, branch_id: branchId, weekday, opens_at: "00:00", closes_at: "23:59:59" })),
    { onConflict: "branch_id,weekday" },
  );
  assert.ifError(hours.error);
  const svc = await staff
    .from("services")
    .insert({ organization_id: orgId, branch_id: branchId, name: "Consultation", prefix: "C", default_service_seconds: 600 })
    .select("id")
    .single();
  assert.ifError(svc.error);
  serviceId = svc.data.id;
  const ctr = await staff
    .from("counters")
    .insert(Array.from({ length: COUNTERS }, (_, i) => ({ organization_id: orgId, branch_id: branchId, kind: "cabinet" as const, number: i + 1 })))
    .select("id");
  assert.ifError(ctr.error);
  counterIds = ctr.data.map((c) => c.id);
  const links = await staff.from("counter_services").insert(counterIds.map((counter_id) => ({ organization_id: orgId, counter_id, service_id: serviceId })));
  assert.ifError(links.error);
  await Promise.all(counterIds.map((id) => rpc(staff, "open_counter", { p_counter: id })));

  // Préchauffage : sur une pile fraîchement démarrée, Realtime met quelques secondes à relayer la base.
  boardFeed = await listen(visitor, boardTopic(branchId), "board");
  assert.equal(boardFeed.status, "SUBSCRIBED");
  const last = counterIds[COUNTERS - 1]!;
  for (let attempt = 0; ; attempt++) {
    await rpc(staff, attempt % 2 ? "open_counter" : "pause_counter", { p_counter: last });
    try {
      await boardFeed.waitFor(() => true, 2_000);
      break;
    } catch (e) {
      if (attempt >= 15) throw e;
    }
  }
  await rpc(staff, "open_counter", { p_counter: last });
});

after(async () => {
  await Promise.all(channels.map((c) => c.unsubscribe()));
  await Promise.all([staff.removeAllChannels(), visitor.removeAllChannels()]);
});

describe("appels simultanés", () => {
  it("chaque ticket n'est alerté qu'une fois, même quand tous les postes appellent en même temps", async () => {
    for (let i = 0; i < COUNTERS; i++) await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    const calls = await Promise.all(counterIds.map((id) => rpc<{ id: string; display_code: string }>(staff, "call_next", { p_counter: id })));
    assert.equal(new Set(calls.map((c) => c.id)).size, COUNTERS);
    assert.deepEqual(calls.map((c) => c.display_code).sort(), ["C-001", "C-002", "C-003", "C-004", "C-005", "C-006"]);
  });

  it("deux appels simultanés sur un même poste : un seul aboutit", async () => {
    const counter = counterIds[0]!;
    const current = await staff.from("tickets").select("id").eq("counter_id", counter).eq("status", "called").single();
    assert.ifError(current.error);
    await rpc(staff, "admit_ticket", { p_ticket: current.data.id });
    await rpc(staff, "finish_ticket", { p_ticket: current.data.id });
    await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    const results = await Promise.all([0, 1].map(() => staff.rpc("call_next", { p_counter: counter })));
    const ok = results.filter((r) => !r.error);
    assert.equal(ok.length, 1);
    assert.equal(results.find((r) => r.error)?.error?.message, "counter_busy");
  });

  it("une commande rejouée en parallèle n'appelle qu'un ticket", async () => {
    const counter = counterIds[1]!;
    const current = await staff.from("tickets").select("id").eq("counter_id", counter).eq("status", "called").single();
    assert.ifError(current.error);
    await rpc(staff, "admit_ticket", { p_ticket: current.data.id });
    const op = randomUUID();
    const results = await Promise.all([0, 1, 2].map(() => staff.rpc("call_next", { p_counter: counter, p_client_op_id: op, p_finish_current: true })));
    const ids = new Set(results.filter((r) => !r.error).map((r) => (r.data as { id: string }).id));
    assert.equal(ids.size, 1);
    const called = await staff.from("tickets").select("id").eq("counter_id", counter).in("status", ["called", "serving"]);
    assert.equal(called.data?.length, 1);
  });
});

describe("temps réel", () => {
  it("le tableau public d'une agence est diffusé à chaque changement", async () => {
    const created = await rpc<{ display_code: string }>(staff, "reception_create_ticket", { p_service: serviceId });
    const payload = await boardFeed.waitFor<Board>((b) => b.services.some((s) => s.waiting.includes(created.display_code)));
    assert.ok(!JSON.stringify(payload).includes("customer"), "aucune donnée client sur le tableau");
  });

  it("le client suit son ticket sur le canal de son jeton", async () => {
    const anon = await visitor.auth.signInAnonymously();
    assert.ifError(anon.error);
    const qr = await staff.from("qr_codes").select("token").eq("branch_id", branchId).eq("active", true).single();
    assert.ifError(qr.error);
    const ticket = await rpc<{ ticket_id: string; public_token: string }>(admin, "take_ticket", {
      p_service: serviceId,
      p_source: "qr",
      p_entry_code: qr.data.token,
      p_priority_reason: null,
      p_customer: anon.data.user!.id,
    });
    const mine = await listen(visitor, ticketTopic(ticket.public_token), "ticket");
    assert.equal(mine.status, "SUBSCRIBED");
    await rpc(staff, "set_ticket_priority", { p_ticket: ticket.ticket_id, p_reason: "elderly" });
    const view = await mine.waitFor<{ priority_reason: string | null; position: number }>((t) => t.priority_reason === "elderly");
    assert.equal(view.position, 1);
  });

  it("le canal privé est réservé au personnel de l'agence", async () => {
    const own = await listen(staff, staffTopic(branchId), "board", true);
    assert.equal(own.status, "SUBSCRIBED");
    const intruder = createClient(url, anonKey, opts);
    const anon = await intruder.auth.signInAnonymously();
    assert.ifError(anon.error);
    await intruder.realtime.setAuth(anon.data.session!.access_token);
    const denied = await listen(intruder, staffTopic(branchId), "board", true, false);
    assert.notEqual(denied.status, "SUBSCRIBED");
    await rpc(staff, "close_counter", { p_counter: counterIds[5]! }).catch(() => undefined);
    await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    await own.waitFor<Board>(() => true);
    await intruder.removeAllChannels();
  });
});
