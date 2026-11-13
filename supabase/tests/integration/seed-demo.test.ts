/**
 * Données de démo (`scripts/seed-demo.ts`) contre le Supabase local : relancer le seed ne crée aucun doublon, et une
 * agence ou un praticien renommés dans l'application sont retrouvés sans être recréés ni remis à leur nom d'origine.
 * Mot de passe des comptes de démo : `SEED_DEMO_PASSWORD` s'il est défini, sinon une valeur de test locale.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.IT_SUPABASE_URL!;
const anonKey = process.env.IT_ANON_KEY!;
const serviceKey = process.env.IT_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function runSeed() {
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/seed-demo.ts"], {
    encoding: "utf8",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      SEED_DEMO_PASSWORD: process.env.SEED_DEMO_PASSWORD ?? "DemoLocale2026",
    },
    timeout: 300_000,
  });
  assert.equal(r.status, 0, `seed en échec :\n${r.stdout}\n${r.stderr}`);
  return `${r.stdout}\n${r.stderr}`;
}

async function orgId(slug: string) {
  const { data, error } = await admin.from("organizations").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id as string;
}

async function count(table: string, column: string, value: string, extra?: (q: any) => any) {
  let q = admin.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (extra) q = extra(q);
  const { count: n, error } = await q;
  if (error) throw error;
  return n ?? 0;
}

/** Comptes qui ne doivent pas bouger d'une exécution à l'autre. */
async function snapshot() {
  const clinic = await orgId("douala-clinic");
  const eneo = await orgId("eneo-douala");
  const future = (q: any) => q.gte("starts_at", new Date().toISOString());
  return {
    branches: (await count("branches", "organization_id", clinic)) + (await count("branches", "organization_id", eneo)),
    practitioners: (await count("practitioners", "organization_id", clinic)) + (await count("practitioners", "organization_id", eneo)),
    services: (await count("services", "organization_id", clinic)) + (await count("services", "organization_id", eneo)),
    counters: (await count("counters", "organization_id", clinic)) + (await count("counters", "organization_id", eneo)),
    specialties: (await count("specialties", "organization_id", clinic)) + (await count("specialties", "organization_id", eneo)),
    futureAppointments: await count("appointments", "organization_id", clinic, future),
    requests: await count("appointment_requests", "organization_id", clinic),
  };
}

describe("seed de démo", () => {
  let clinic = "";
  let branch = { id: "", name: "", address: "" };
  let doctor = { id: "", display_name: "" };
  let maxDistance = 0;

  before(async () => {
    runSeed();
    clinic = await orgId("douala-clinic");
    const { data: b } = await admin.from("branches").select("id, name, address").eq("organization_id", clinic).order("created_at").limit(1).single();
    branch = b!;
    const { data: p } = await admin.from("practitioners").select("id, display_name").eq("branch_id", branch.id).eq("display_name", "Samuel Nkeng").single();
    doctor = p!;
    const { data: s } = await admin.from("branch_settings").select("remote_max_distance_km").eq("branch_id", branch.id).single();
    maxDistance = s!.remote_max_distance_km;
  });

  after(async () => {
    // Démo locale remise comme avant le test.
    await admin.from("branches").update({ name: branch.name, address: branch.address }).eq("id", branch.id);
    await admin.from("practitioners").update({ display_name: doctor.display_name }).eq("id", doctor.id);
    await admin.from("branch_settings").update({ remote_max_distance_km: maxDistance }).eq("branch_id", branch.id);
  });

  it("relancé deux fois : mêmes agences, praticiens, services, guichets et rendez-vous futurs", async () => {
    const first = await snapshot();
    runSeed();
    assert.deepEqual(await snapshot(), first);
    runSeed();
    assert.deepEqual(await snapshot(), first);
  });

  it("agence et praticien renommés dans l'application : retrouvés, ni recréés ni renommés, réglages gardés", async () => {
    const before = await snapshot();
    const renamed = { name: "Makepe", address: "Rue de Makepe, carrefour Bonamoussadi" };
    await admin.from("branches").update(renamed).eq("id", branch.id).select("id").throwOnError();
    await admin.from("practitioners").update({ display_name: "Samuel Nkeng-Ebanda" }).eq("id", doctor.id).select("id").throwOnError();
    await admin.from("branch_settings").update({ remote_max_distance_km: maxDistance + 7 }).eq("branch_id", branch.id).select("branch_id").throwOnError();

    const output = runSeed();
    assert.doesNotMatch(output, /plan_limit/, "aucune limite de la formule touchée");
    assert.deepEqual(await snapshot(), before, "aucune agence, aucun praticien ni service en plus");

    const { data: b } = await admin.from("branches").select("name, address").eq("id", branch.id).single();
    assert.deepEqual(b, renamed, "nom et adresse modifiés à la main conservés");
    const { data: p } = await admin.from("practitioners").select("display_name").eq("id", doctor.id).single();
    assert.equal(p!.display_name, "Samuel Nkeng-Ebanda", "nom du praticien conservé");
    const { data: s } = await admin.from("branch_settings").select("remote_max_distance_km").eq("branch_id", branch.id).single();
    assert.equal(s!.remote_max_distance_km, maxDistance + 7, "réglage de l'agence conservé");
    assert.match(output, /agence « Makepe »/, "le récapitulatif donne le nom actuel de l'agence");
  });
});
