/**
 * Données de démo NextIn — idempotent (relançable sans doublons).
 * Enrichi à chaque module. M1 : comptes, établissements, personnel. M2 : agences, spécialités, praticiens,
 * services, guichets/cabinets, horaires et QR codes. M3 : file du jour (tickets en attente). M10b : annonceurs,
 * campagnes (diffusée, en validation), annonce Maison.
 *
 * Usage : NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SEED_DEMO_PASSWORD=… pnpm seed:demo
 */
import { createClient } from "@supabase/supabase-js";
import { bannerPng, coinLogoPng, demoVisaPdf } from "./demo-images";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_DEMO_PASSWORD;

if (!url || !serviceKey || !password) {
  console.error("Variables requises : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_DEMO_PASSWORD");
  process.exit(1);
}
if (password.length < 10 || !/\d/.test(password) || !/[a-z]/i.test(password)) {
  console.error("SEED_DEMO_PASSWORD : au moins 10 caractères, lettres et chiffres.");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

type DemoUser = { email: string; fullName: string };

const USERS = {
  wintek: { email: "superadmin@nextin.demo", fullName: "Support Wintek" },
  clinicAdmin: { email: "directeur@doualaclinic.demo", fullName: "Dr Ngo Biyong" },
  clinicReception: { email: "accueil@doualaclinic.demo", fullName: "Mireille Ekambi" },
  clinicDoctor: { email: "dr.mbarga@doualaclinic.demo", fullName: "Dr Paul Mbarga" },
  eneoAdmin: { email: "chef.agence@eneo.demo", fullName: "Serge Tchoupo" },
  eneoAgent: { email: "guichet1@eneo.demo", fullName: "Aïcha Bello" },
  advertiser: { email: "marketing@saveurs-littoral.demo", fullName: "Saveurs du Littoral" },
  pharmacy: { email: "contact@pharmacie-bonapriso.demo", fullName: "Pharmacie de Bonapriso" },
} satisfies Record<string, DemoUser>;

async function ensureUser(u: DemoUser): Promise<string> {
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((x) => x.email === u.email);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }
  const { data, error } = await db.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: u.fullName, locale: "fr" },
  });
  if (error) throw error;
  return data.user.id;
}

async function ensureOrg(slug: string, name: string, type: "clinic" | "utility", createdBy: string): Promise<string> {
  const { data: existing, error: readErr } = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing.id;
  const { data, error } = await db
    .from("organizations")
    .insert({ slug, name, type, status: "active", created_by: createdBy, validated_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function ensureMember(organizationId: string, userId: string, role: "org_admin" | "receptionist" | "agent") {
  const { data } = await db
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("branch_id", null)
    .maybeSingle();
  if (data) return;
  const { error } = await db.from("memberships").insert({ organization_id: organizationId, user_id: userId, role });
  if (error) throw error;
}

type Db = typeof db;

type ServiceSeed = { prefix: string; name: string; nameEn: string; color: string; minutes: number; specialty?: string };
type CounterSeed = { kind: "cabinet" | "guichet" | "caisse" | "laboratoire" | "accueil"; number: number; services: string[]; practitioner?: string };
type BranchSeed = {
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  specialties: { name: string; nameEn: string }[];
  practitioners: { title: string; name: string; specialty: string }[];
  services: ServiceSeed[];
  counters: CounterSeed[];
};

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

/** Agence complète (idempotent) : réglages, horaires, spécialités, praticiens, services, guichets, QR code. */
async function ensureBranch(client: Db, orgId: string, seed: BranchSeed) {
  let branch = await must(client.from("branches").select("id").eq("organization_id", orgId).eq("name", seed.name).maybeSingle());
  if (!branch) {
    branch = await must(
      client
        .from("branches")
        .insert({ organization_id: orgId, name: seed.name, address: seed.address, city: seed.city, location: `SRID=4326;POINT(${seed.lng} ${seed.lat})` })
        .select("id")
        .single(),
    );
    await must(client.from("branch_settings").insert({ branch_id: branch.id, organization_id: orgId }));
    await must(
      client.from("opening_hours").insert([
        ...[1, 2, 3, 4, 5].map((weekday) => ({ organization_id: orgId, branch_id: branch!.id, weekday, opens_at: "07:30", closes_at: "17:00" })),
        { organization_id: orgId, branch_id: branch.id, weekday: 6, opens_at: "08:00", closes_at: "12:00" },
      ]),
    );
  }
  const branchId = branch.id;
  const active = await must(client.from("qr_codes").select("id").eq("branch_id", branchId).is("service_id", null).eq("active", true));
  if (!active.length) await must(client.rpc("issue_qr_code", { p_branch: branchId }));

  const specialtyIds = new Map<string, string>();
  for (const sp of seed.specialties) {
    let row = await must(client.from("specialties").select("id").eq("organization_id", orgId).eq("name", sp.name).maybeSingle());
    row ??= await must(client.from("specialties").insert({ organization_id: orgId, name: sp.name, name_en: sp.nameEn }).select("id").single());
    specialtyIds.set(sp.name, row.id);
  }

  const practitionerIds = new Map<string, string>();
  for (const p of seed.practitioners) {
    let row = await must(client.from("practitioners").select("id").eq("branch_id", branchId).eq("display_name", p.name).maybeSingle());
    row ??= await must(
      client
        .from("practitioners")
        .insert({ organization_id: orgId, branch_id: branchId, title: p.title, display_name: p.name, specialty_id: specialtyIds.get(p.specialty) ?? null })
        .select("id")
        .single(),
    );
    practitionerIds.set(p.name, row.id);
  }

  const serviceIds = new Map<string, string>();
  for (const [i, sv] of seed.services.entries()) {
    let row = await must(client.from("services").select("id").eq("branch_id", branchId).eq("prefix", sv.prefix).maybeSingle());
    row ??= await must(
      client
        .from("services")
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          prefix: sv.prefix,
          name: sv.name,
          name_en: sv.nameEn,
          color: sv.color,
          default_service_seconds: sv.minutes * 60,
          specialty_id: sv.specialty ? (specialtyIds.get(sv.specialty) ?? null) : null,
          sort_order: i + 1,
        })
        .select("id")
        .single(),
    );
    serviceIds.set(sv.prefix, row.id);
  }

  for (const c of seed.counters) {
    let row = await must(client.from("counters").select("id").eq("branch_id", branchId).eq("kind", c.kind).eq("number", c.number).maybeSingle());
    row ??= await must(
      client
        .from("counters")
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          kind: c.kind,
          number: c.number,
          default_practitioner_id: c.practitioner ? (practitionerIds.get(c.practitioner) ?? null) : null,
        })
        .select("id")
        .single(),
    );
    await must(
      client.from("counter_services").upsert(
        c.services.map((prefix) => ({ organization_id: orgId, counter_id: row!.id, service_id: serviceIds.get(prefix)! })),
        { onConflict: "counter_id,service_id", ignoreDuplicates: true },
      ),
    );
  }
  return { branchId, serviceIds };
}

/**
 * File du jour (M3) : quelques tickets en attente créés par l'accueil, seulement si la file du jour est vide
 * (la numérotation repart chaque jour). Aucun nom de client : les tickets d'accueil n'en portent pas.
 */
async function ensureDemoQueue(staffEmail: string, branch: { branchId: string; serviceIds: Map<string, string> }, perService: Record<string, number>) {
  const staff = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await staff.auth.signInWithPassword({ email: staffEmail, password: password! });
  if (error) throw error;
  const active = await must(
    db.from("tickets").select("id").eq("branch_id", branch.branchId).in("status", ["waiting", "called", "serving"]).limit(1),
  );
  if (active.length) return;
  for (const [prefix, count] of Object.entries(perService)) {
    for (let i = 0; i < count; i++) {
      const reason = prefix === "C" && i === 2 ? "pregnancy" : null;
      await must(staff.rpc("reception_create_ticket", { p_service: branch.serviceIds.get(prefix)!, p_priority_reason: reason as never }));
    }
  }
  await staff.auth.signOut();
}

/**
 * Rendez-vous (M5b) : horaires de consultation des médecins d'Akwa (lundi au vendredi, matin et après-midi,
 * créneaux de 20 min), puis quelques rendez-vous sur les sept prochains jours, pris par l'accueil, seulement
 * si aucun rendez-vous n'est à venir. Repères de patient fictifs (initiales), jamais de nom.
 */
async function ensureDemoAppointments(staffEmail: string, orgId: string, branch: { branchId: string; serviceIds: Map<string, string> }) {
  const doctors = await must(db.from("practitioners").select("id, display_name").eq("branch_id", branch.branchId));
  const plan: Record<string, { service: string; ranges: [string, string][] }> = {
    "Paul Mbarga": { service: "C", ranges: [["08:00", "12:00"], ["14:00", "17:00"]] },
    "Samuel Nkeng": { service: "C", ranges: [["08:00", "12:00"]] },
    "Aline Ngo Biyong": { service: "P", ranges: [["08:30", "12:30"], ["14:00", "16:00"]] },
  };
  for (const d of doctors) {
    const p = plan[d.display_name];
    if (!p) continue;
    const existing = await must(db.from("practitioner_schedules").select("id").eq("practitioner_id", d.id).limit(1));
    if (existing.length) continue;
    await must(
      db.from("practitioner_schedules").insert(
        [1, 2, 3, 4, 5].flatMap((weekday) =>
          p.ranges.map(([starts_at, ends_at]) => ({
            organization_id: orgId,
            branch_id: branch.branchId,
            practitioner_id: d.id,
            service_id: branch.serviceIds.get(p.service)!,
            weekday,
            starts_at,
            ends_at,
            slot_minutes: 20,
          })),
        ),
      ),
    );
  }

  const upcoming = await must(
    db.from("appointments").select("id").eq("branch_id", branch.branchId).gte("starts_at", new Date().toISOString()).limit(1),
  );
  if (upcoming.length) return;
  const staff = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await staff.auth.signInWithPassword({ email: staffEmail, password: password! });
  if (error) throw error;
  const labels = ["M.N.", "A.T.", "J.K.", "B.E.", "C.F.", "R.M.", "S.O.", "L.D."];
  let n = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const d of doctors.filter((x) => plan[x.display_name])) {
    const slots = (await must(staff.rpc("available_slots", { p_practitioner: d.id, p_from: today, p_days: 7 }))) as unknown as { starts_at: string }[];
    // Deux à trois rendez-vous par jour et par médecin, pour un agenda réaliste sur la semaine.
    const byDay = new Map<string, { starts_at: string }[]>();
    for (const slot of slots) byDay.set(slot.starts_at.slice(0, 10), [...(byDay.get(slot.starts_at.slice(0, 10)) ?? []), slot]);
    const picked = [...byDay.values()].flatMap((daySlots) => daySlots.filter((_, i) => i === 1 || i === 4 || i === 9));
    for (const slot of picked) {
      await must(
        staff.rpc("book_appointment", {
          p_practitioner: d.id,
          p_starts_at: slot.starts_at,
          p_customer_label: labels[n % labels.length]!,
          p_phone_e164: (n % 4 === 0 ? `+23769900${String(100 + n).padStart(4, "0")}` : null) as string,
          p_consent: n % 4 === 0,
          p_locale: "fr",
        }),
      );
      n++;
    }
  }
  await staff.auth.signOut();
}

/**
 * M9 : ticket à distance et demandes de rendez-vous activés sur les agences de démo (la caisse reste sur place),
 * et deux demandes de patients en attente à l'accueil d'Akwa (numéros fictifs, déjà vérifiés).
 */
async function ensureDemoRemote(
  akwa: { branchId: string; serviceIds: Map<string, string> },
  bonanjo: { branchId: string; serviceIds: Map<string, string> },
  requester: string,
) {
  await must(
    db
      .from("branch_settings")
      .update({ remote_tickets_enabled: true, remote_max_distance_km: 15, appointment_requests_enabled: true })
      .eq("branch_id", akwa.branchId)
      .select("branch_id"),
  );
  await must(db.from("services").update({ allow_remote: false }).eq("id", akwa.serviceIds.get("K")!).select("id"));
  await must(db.from("branch_settings").update({ remote_tickets_enabled: true }).eq("branch_id", bonanjo.branchId).select("branch_id"));

  const existing = await must(db.from("appointment_requests").select("id").eq("branch_id", akwa.branchId).limit(1));
  if (existing.length) return;
  const today = new Date().toISOString().slice(0, 10);
  const mbarga = (await must(db.from("practitioners").select("id").eq("branch_id", akwa.branchId).eq("display_name", "Paul Mbarga")))[0]!;
  const slots = (await must(db.rpc("practitioner_free_slots", { p_practitioner: mbarga.id, p_from: today, p_days: 7 }))) as unknown as {
    starts_at: string;
  }[];
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const requests = [
    { practitioner: mbarga.id, startsAt: slots[3]?.starts_at ?? null, day: null, period: null, phone: "+237699001201", label: "E.M." },
    { practitioner: null, startsAt: null, day: day(2), period: "morning", phone: "+237699001202", label: null },
  ];
  for (const r of requests) {
    const created = (await must(
      db.rpc("create_appointment_request", {
        p_branch: akwa.branchId,
        p_service: akwa.serviceIds.get("C")!,
        p_practitioner: r.practitioner as string,
        p_starts_at: r.startsAt as string,
        p_day: r.day as string,
        p_period: r.period as string,
        p_phone_e164: r.phone,
        p_label: r.label as string,
        p_locale: "fr",
        p_customer: requester,
      }),
    )) as unknown as { id: string };
    // Démo : numéro considéré comme vérifié, aucun code envoyé.
    await must(db.from("notification_jobs").update({ status: "cancelled", payload: {} }).eq("appointment_request_id", created.id).select("id"));
    await must(
      db.from("appointment_requests").update({ status: "pending", verified_at: new Date().toISOString(), code_hash: null }).eq("id", created.id).select("id"),
    );
  }
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : historique de démo identique à chaque exécution. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Historique (M8) : quatre semaines de passages terminés (jours ouvrés, pics à 9 h et 13 h), sessions des postes,
 * quelques notes et absents, puis cumul des statistiques. Seulement si l'agence n'a aucun ticket des jours passés.
 * Tickets anonymes (accueil), sans jeton ni numéro de téléphone.
 */
async function ensureDemoHistory(orgId: string, branch: { branchId: string; serviceIds: Map<string, string> }, perDay: Record<string, number>, seed: number) {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const past = await must(db.from("tickets").select("id").eq("branch_id", branch.branchId).lt("service_day", todayIso).limit(1));
  if (past.length) return;
  const rand = prng(seed);
  const counters = await must(
    db.from("counters").select("id, counter_services(service_id)").eq("branch_id", branch.branchId).eq("active", true),
  );
  const services = await must(db.from("services").select("id, prefix, default_service_seconds").eq("branch_id", branch.branchId));
  // Poids horaires (7 h → 16 h) : pic du matin et reprise après midi.
  const weights = [3, 8, 12, 10, 7, 5, 8, 7, 4, 2];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pickHour = () => {
    let r = rand() * totalWeight;
    for (let i = 0; i < weights.length; i++) if ((r -= weights[i]!) < 0) return 7 + i;
    return 16;
  };
  for (let back = 28; back >= 1; back--) {
    const day = new Date(today.getTime() - back * 86_400_000);
    const iso = day.toISOString().slice(0, 10);
    const dow = day.getUTCDay();
    if (dow === 0) continue;
    const dayFactor = dow === 6 ? 0.45 : dow === 1 ? 1.2 : 0.9 + rand() * 0.25;
    const rows: Record<string, unknown>[] = [];
    for (const svc of services) {
      const count = Math.round((perDay[svc.prefix] ?? 0) * dayFactor);
      const servingCounters = counters.filter((c) => (c.counter_services ?? []).some((cs) => cs.service_id === svc.id));
      if (!count || !servingCounters.length) continue;
      const arrivals = Array.from({ length: count }, () => {
        const h = pickHour();
        return Date.parse(`${iso}T${String(h - 1).padStart(2, "0")}:00:00Z`) + Math.floor(rand() * 3_600_000);
      }).sort((a, b) => a - b);
      arrivals.forEach((created, i) => {
        const wait = (4 + rand() * (svc.prefix === "L" ? 30 : 22)) * 60_000;
        const service = svc.default_service_seconds * (0.6 + rand() * 0.9) * 1000;
        const r = rand();
        const status = r < 0.05 ? "no_show" : r < 0.09 ? "cancelled" : "served";
        const called = status === "cancelled" ? null : created + wait;
        const counter = servingCounters[Math.floor(rand() * servingCounters.length)]!.id;
        rows.push({
          organization_id: orgId,
          branch_id: branch.branchId,
          service_id: svc.id,
          service_day: iso,
          number: i + 1,
          display_code: `${svc.prefix}-${String(i + 1).padStart(3, "0")}`,
          public_token: null,
          source: rand() < 0.7 ? "qr" : "reception",
          status,
          sort_key: created * 1000,
          counter_id: called ? counter : null,
          created_at: new Date(created).toISOString(),
          called_at: called ? new Date(called).toISOString() : null,
          serving_started_at: status === "served" ? new Date(called! + 60_000).toISOString() : null,
          finished_at: status === "served" ? new Date(called! + 60_000 + service).toISOString() : status === "cancelled" ? new Date(created + wait / 2).toISOString() : new Date(called! + 180_000).toISOString(),
          rating: status === "served" && rand() < 0.3 ? (rand() < 0.75 ? 5 : rand() < 0.7 ? 4 : 3) : null,
        });
      });
    }
    for (let i = 0; i < rows.length; i += 500) await must(db.from("tickets").insert(rows.slice(i, i + 500)).select("id"));
    // Postes ouverts de 7 h 30 à 17 h (heure de Douala), avec une courte pause.
    await must(
      db.from("counter_sessions").insert(
        counters.map((c) => ({
          organization_id: orgId,
          branch_id: branch.branchId,
          counter_id: c.id,
          started_at: `${iso}T06:30:00Z`,
          ended_at: `${iso}T16:00:00Z`,
        })),
      ).select("id"),
    );
  }
  const from = new Date(today.getTime() - 28 * 86_400_000).toISOString().slice(0, 10);
  const yesterday = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);
  await must(db.rpc("rollup_daily_stats_range", { p_from: from, p_to: yesterday }));
}

/**
 * M10a — abonnement de démo (idempotent) : `paid` = formule Pro payée par le faux fournisseur (facture réglée par
 * MTN MoMo, abonnement actif) ; `trial` = essai Pro qui se termine dans 5 jours (bandeau visible).
 */
async function ensureDemoSubscription(orgId: string, mode: "paid" | "trial", phone: string, email: string) {
  const existing = await must(db.from("subscriptions").select("id").eq("organization_id", orgId).maybeSingle());
  if (existing) return;
  const pro = await must(db.from("plans").select("id").eq("code", "pro").single());
  const sub = await must(
    db
      .from("subscriptions")
      .insert({
        organization_id: orgId,
        plan_id: pro.id,
        status: "trialing",
        trial_ends_at: new Date(Date.now() + (mode === "trial" ? 5 : 1) * 86_400_000).toISOString(),
        billing_phone_e164: phone,
        billing_email: email,
      })
      .select("id")
      .single(),
  );
  await must(db.from("subscription_events").insert({ subscription_id: sub.id, organization_id: orgId, type: "trial_started", payload: { trial_days: 14 } }));
  if (mode === "trial") return;
  const invoice = await must(db.rpc("issue_invoice", { p_subscription: sub.id }));
  const token = await must(db.rpc("create_pay_link", { p_invoice: (invoice as { id: string }).id }));
  const started = (await must(
    db.rpc("start_payment", { p_token: token as string, p_provider: "fake", p_channel: "mtn_momo", p_msisdn: phone }),
  )) as { external_id: string };
  await must(db.rpc("confirm_payment", { p_external_id: started.external_id, p_status: "succeeded", p_provider_ref: "fake_demo" }));
}

/** Client connecté (RPC exécutées avec les droits du compte, comme depuis l'application). */
async function signedIn(email: string) {
  const client = createClient(url!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: password! });
  if (error) throw error;
  return client;
}

async function upload(bucket: "ad-creatives" | "ad-documents", path: string, body: Buffer, contentType: string) {
  const { error } = await db.storage.from(bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`${bucket}/${path} : ${error.message}`);
}

type CreativeSeed = { file: string; from: string; to: string; headline: string; offer: string };

async function addCreatives(client: Db, folder: string, campaignId: string, creatives: CreativeSeed[]) {
  for (const c of creatives) {
    const path = `${folder}/${campaignId}/${c.file}`;
    await upload("ad-creatives", path, bannerPng(c.from, c.to), "image/png");
    await must(client.rpc("save_creative", {
      p_campaign: campaignId,
      p_creative: null as unknown as string,
      p_fields: { storage_path: path, kind: "image", headline: c.headline, offer_text: c.offer, cta_url: "", duration_seconds: 8 },
    }));
  }
}

/**
 * M10b — publicité de démo (idempotent) : « Saveurs du Littoral » (formule Or, diffusée partout : TV, application,
 * quiz et habillage de Sky Catch, payée par le faux fournisseur), « Pharmacie de Bonapriso » (Bronze, visa santé,
 * en attente de validation dans la console) et une annonce Maison de DOUALA CLINIC.
 */
async function ensureDemoAds(clinicId: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());

  const adv = await signedIn(USERS.advertiser.email);
  const existing = await must(adv.from("advertisers").select("id").limit(1));
  if (!existing.length) {
    const advertiserId = (await must(adv.rpc("create_advertiser", { p_name: "Saveurs du Littoral", p_sector: "food", p_phone: "+237677300301", p_city: "Douala" }))) as string;
    const campaignId = (await must(adv.rpc("save_campaign", {
      p_campaign: null as unknown as string,
      p_advertiser: advertiserId,
      p_organization: null as unknown as string,
      p_fields: { name: "Petit-déjeuner du Littoral", package_code: "or", sector: "food", starts_on: today, surfaces: ["tv", "app", "game"], target_cities: [], target_org_types: [], schedules: [] },
    }))) as string;
    await addCreatives(adv, advertiserId, campaignId, [
      { file: "croissants.png", from: "#F58B1F", to: "#B5651A", headline: "Croissants tout chauds dès 6 h", offer: "-20 % sur présentation du bon" },
      { file: "jus.png", from: "#2E8B57", to: "#13798A", headline: "Jus de fruits pressés du jour", offer: "Le deuxième offert" },
    ]);
    await must(adv.rpc("save_quiz", {
      p_campaign: campaignId,
      p_fields: {
        title: "Les saveurs du Cameroun",
        reward_text: "-10 % sur votre prochain petit-déjeuner",
        coupon_validity_days: 30,
        max_coupons: null,
        questions: [
          { question: "Avec quoi prépare-t-on le ndolé ?", answers: [{ text: "Des feuilles amères", correct: true }, { text: "Du manioc" }, { text: "Des arachides seules" }] },
          { question: "Les beignets-haricots se mangent surtout…", answers: [{ text: "Le soir" }, { text: "Le matin", correct: true }] },
          { question: "Quel fruit pousse en abondance à Njombé ?", answers: [{ text: "La banane", correct: true }, { text: "La pomme" }, { text: "La poire" }] },
        ],
      },
    }));
    const logo = `${advertiserId}/${campaignId}/piece.png`;
    await upload("ad-creatives", logo, coinLogoPng("#B5651A"), "image/png");
    await must(adv.rpc("save_game_skin", {
      p_campaign: campaignId,
      p_fields: {
        plane_primary: "#B5651A",
        plane_secondary: "#F58B1F",
        coin_logo_path: logo,
        end_title: "Bravo, pilote gourmand !",
        reward_text: "Un croissant offert",
        coupon_validity_days: 14,
        max_coupons: null,
        min_levels: 2,
      },
    }));
    await must(adv.rpc("submit_campaign", { p_campaign: campaignId }));
    const wintek = await signedIn(USERS.wintek.email);
    await must(wintek.rpc("review_campaign", { p_campaign: campaignId, p_approve: true, p_note: "Conforme" }));
    const checkout = (await must(adv.rpc("campaign_checkout", { p_campaign: campaignId }))) as { pay_token: string };
    const started = (await must(
      db.rpc("start_payment", { p_token: checkout.pay_token, p_provider: "fake", p_channel: "mtn_momo", p_msisdn: "+237677300301" }),
    )) as { external_id: string };
    await must(db.rpc("confirm_payment", { p_external_id: started.external_id, p_status: "succeeded", p_provider_ref: "fake_demo" }));
  }

  const pharmacy = await signedIn(USERS.pharmacy.email);
  const pharmacyExisting = await must(pharmacy.from("advertisers").select("id").limit(1));
  if (!pharmacyExisting.length) {
    const advertiserId = (await must(pharmacy.rpc("create_advertiser", { p_name: "Pharmacie de Bonapriso", p_sector: "pharmacy", p_phone: "+237699300302", p_city: "Douala" }))) as string;
    const campaignId = (await must(pharmacy.rpc("save_campaign", {
      p_campaign: null as unknown as string,
      p_advertiser: advertiserId,
      p_organization: null as unknown as string,
      p_fields: { name: "Semaine de la vitamine C", package_code: "bronze", sector: "pharmacy", starts_on: today, surfaces: ["tv"], target_cities: ["Douala"], target_org_types: ["clinic"], schedules: [] },
    }))) as string;
    await addCreatives(pharmacy, advertiserId, campaignId, [
      { file: "vitamine.png", from: "#13798A", to: "#1A6BB5", headline: "Vitamine C : renforcez vos défenses", offer: "Conseils gratuits en officine" },
    ]);
    const visa = `${advertiserId}/${campaignId}/visa.pdf`;
    await upload("ad-documents", visa, demoVisaPdf("MINSANTE-DEMO-0042"), "application/pdf");
    await must(pharmacy.rpc("save_campaign", {
      p_campaign: campaignId,
      p_advertiser: null as unknown as string,
      p_organization: null as unknown as string,
      p_fields: {
        name: "Semaine de la vitamine C", package_code: "bronze", sector: "pharmacy", starts_on: today, surfaces: ["tv"],
        target_cities: ["Douala"], target_org_types: ["clinic"], schedules: [],
        health_visa_number: "MINSANTE-DEMO-0042", health_visa_document_path: visa,
      },
    }));
    // Laissée « En validation » : la console Wintek a une campagne à examiner.
    await must(pharmacy.rpc("submit_campaign", { p_campaign: campaignId }));
  }

  const house = await must(db.from("ad_campaigns").select("id").eq("organization_id", clinicId).limit(1));
  if (!house.length) {
    const admin = await signedIn(USERS.clinicAdmin.email);
    const campaignId = (await must(admin.rpc("save_campaign", {
      p_campaign: null as unknown as string,
      p_advertiser: null as unknown as string,
      p_organization: clinicId,
      p_fields: { name: "Vaccination le samedi", package_code: "maison", sector: "health", starts_on: today, surfaces: ["tv", "app"], target_cities: [], target_org_types: [], schedules: [] },
    }))) as string;
    await addCreatives(admin, `org-${clinicId}`, campaignId, [
      { file: "vaccination.png", from: "#0D2C54", to: "#1A6BB5", headline: "Vaccination sans rendez-vous le samedi", offer: "De 8 h à 12 h, agence Akwa" },
    ]);
    await must(admin.rpc("submit_campaign", { p_campaign: campaignId }));
  }
}

const COLORS = { blue: "#1A6BB5", green: "#2E8B57", purple: "#8E5BB5", ochre: "#B5651A", teal: "#13798A" };

async function main() {
  const ids = Object.fromEntries(
    await Promise.all(Object.entries(USERS).map(async ([k, u]) => [k, await ensureUser(u)] as const)),
  ) as Record<keyof typeof USERS, string>;

  const { error: adminErr } = await db.from("platform_admins").upsert({ user_id: ids.wintek }, { onConflict: "user_id" });
  if (adminErr) throw adminErr;

  const clinic = await ensureOrg("douala-clinic", "DOUALA CLINIC", "clinic", ids.clinicAdmin);
  await ensureMember(clinic, ids.clinicAdmin, "org_admin");
  await ensureMember(clinic, ids.clinicReception, "receptionist");
  await ensureMember(clinic, ids.clinicDoctor, "agent");

  const eneo = await ensureOrg("eneo-douala", "Eneo — Douala", "utility", ids.eneoAdmin);
  await ensureMember(eneo, ids.eneoAdmin, "org_admin");
  await ensureMember(eneo, ids.eneoAgent, "agent");

  const akwa = await ensureBranch(db, clinic, {
    name: "Akwa",
    address: "Boulevard de la Liberté",
    city: "Douala",
    lat: 4.0483,
    lng: 9.6996,
    specialties: [
      { name: "Médecine générale", nameEn: "General medicine" },
      { name: "Pédiatrie", nameEn: "Pediatrics" },
      { name: "Biologie", nameEn: "Laboratory medicine" },
    ],
    practitioners: [
      { title: "Dr", name: "Paul Mbarga", specialty: "Médecine générale" },
      { title: "Dr", name: "Samuel Nkeng", specialty: "Médecine générale" },
      { title: "Dr", name: "Aline Ngo Biyong", specialty: "Pédiatrie" },
    ],
    services: [
      { prefix: "C", name: "Consultation générale", nameEn: "General consultation", color: COLORS.blue, minutes: 15, specialty: "Médecine générale" },
      { prefix: "P", name: "Pédiatrie", nameEn: "Pediatrics", color: COLORS.green, minutes: 12, specialty: "Pédiatrie" },
      { prefix: "L", name: "Laboratoire", nameEn: "Laboratory", color: COLORS.purple, minutes: 8, specialty: "Biologie" },
      { prefix: "K", name: "Caisse", nameEn: "Cashier", color: COLORS.ochre, minutes: 3 },
    ],
    counters: [
      { kind: "cabinet", number: 1, services: ["C"], practitioner: "Paul Mbarga" },
      { kind: "cabinet", number: 2, services: ["C"], practitioner: "Samuel Nkeng" },
      { kind: "cabinet", number: 3, services: ["P"], practitioner: "Aline Ngo Biyong" },
      { kind: "cabinet", number: 4, services: ["C", "P"] },
      { kind: "laboratoire", number: 1, services: ["L"] },
      { kind: "caisse", number: 1, services: ["K"] },
    ],
  });

  const bonanjo = await ensureBranch(db, eneo, {
    name: "Bonanjo",
    address: "Avenue du Général de Gaulle",
    city: "Douala",
    lat: 4.043,
    lng: 9.689,
    specialties: [
      { name: "Réclamations", nameEn: "Complaints" },
      { name: "Abonnements", nameEn: "Subscriptions" },
    ],
    practitioners: [
      { title: "", name: "Aïcha Bello", specialty: "Réclamations" },
      { title: "", name: "Jean Tchoupo", specialty: "Abonnements" },
    ],
    services: [
      { prefix: "R", name: "Réclamations", nameEn: "Complaints", color: COLORS.blue, minutes: 10, specialty: "Réclamations" },
      { prefix: "A", name: "Abonnements", nameEn: "Subscriptions", color: COLORS.green, minutes: 15, specialty: "Abonnements" },
      { prefix: "F", name: "Paiement de facture", nameEn: "Bill payment", color: COLORS.ochre, minutes: 4 },
    ],
    counters: [
      { kind: "guichet", number: 1, services: ["F"] },
      { kind: "guichet", number: 2, services: ["F"] },
      { kind: "guichet", number: 3, services: ["R"], practitioner: "Aïcha Bello" },
      { kind: "guichet", number: 4, services: ["A"], practitioner: "Jean Tchoupo" },
      { kind: "guichet", number: 5, services: ["R", "A"] },
    ],
  });

  await ensureDemoSubscription(clinic, "paid", "+237677000101", USERS.clinicAdmin.email);
  await ensureDemoSubscription(eneo, "trial", "+237699000202", USERS.eneoAdmin.email);

  await ensureDemoQueue(USERS.clinicReception.email, akwa, { C: 5, P: 3, L: 2, K: 1 });
  await ensureDemoAppointments(USERS.clinicReception.email, clinic, akwa);
  await ensureDemoHistory(clinic, akwa, { C: 38, P: 22, L: 30, K: 45 }, 2026);
  await ensureDemoHistory(eneo, bonanjo, { F: 70, R: 25, A: 18 }, 237);
  await ensureDemoQueue(USERS.eneoAdmin.email, bonanjo, { F: 6, R: 3, A: 2 });
  await ensureDemoRemote(akwa, bonanjo, ids.clinicAdmin);
  await ensureDemoAds(clinic);

  console.log("✓ Démo prête : DOUALA CLINIC (agence Akwa, Pro payé) et Eneo — Douala (agence Bonanjo, essai Pro)");
  console.log("  Console Wintek : /admin avec superadmin@nextin.demo");
  console.log("  Espace annonceur : /ads avec marketing@saveurs-littoral.demo (campagne Or diffusée)");
  for (const u of Object.values(USERS)) console.log(`  ${u.email}`);
  console.log("  (mot de passe : valeur de SEED_DEMO_PASSWORD)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
