/**
 * Données de démo NextIn — idempotent (relançable sans doublons).
 * Enrichi à chaque module. M1 : comptes, établissements DOUALA CLINIC et Eneo Douala, personnel.
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

  console.log("✓ Démo prête :");
  for (const u of Object.values(USERS)) console.log(`  ${u.email}`);
  console.log("  (mot de passe : valeur de SEED_DEMO_PASSWORD)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
