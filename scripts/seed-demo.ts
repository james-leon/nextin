/**
 * Données de démo NextIn — idempotent (relançable sans doublons).
 * Enrichi à chaque module. M1 : comptes, établissements, personnel. M2 : agences, spécialités, praticiens,
 * services, guichets/cabinets, horaires et QR codes. M3 : file du jour (tickets en attente).
 *
 * Usage : NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… SEED_DEMO_PASSWORD=… pnpm seed:demo
 */
import { createClient } from "@supabase/supabase-js";

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

  await ensureDemoQueue(USERS.clinicReception.email, akwa, { C: 5, P: 3, L: 2, K: 1 });
  await ensureDemoAppointments(USERS.clinicReception.email, clinic, akwa);
  await ensureDemoQueue(USERS.eneoAdmin.email, bonanjo, { F: 6, R: 3, A: 2 });

  console.log("✓ Démo prête : DOUALA CLINIC (agence Akwa) et Eneo — Douala (agence Bonanjo)");
  for (const u of Object.values(USERS)) console.log(`  ${u.email}`);
  console.log("  (mot de passe : valeur de SEED_DEMO_PASSWORD)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
