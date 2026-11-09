import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { bannerPng } from "../../../scripts/demo-images";
import { PASSWORD, uniqueEmail } from "./helpers";
import { anonClient, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

/** Aides des tests publicitaires (M10b) : campagnes diffusées, tickets et écrans, comme depuis l'application. */
export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());

export async function signedIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  expect(error).toBeNull();
  return client;
}

export async function platformAdmin() {
  const email = uniqueEmail("wintek");
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  await admin.from("platform_admins").insert({ user_id: created.data.user!.id });
  return { email, client: await signedIn(email) };
}

const QUIZ = {
  title: "Quiz du Littoral",
  reward_text: "-15 % sur le pain",
  coupon_validity_days: 30,
  max_coupons: null,
  questions: [
    { question: "Couleur du ciel ?", answers: [{ text: "Bleu", correct: true }, { text: "Vert" }] },
    { question: "Capitale économique ?", answers: [{ text: "Douala", correct: true }, { text: "Kribi" }] },
    { question: "Fleuve de Douala ?", answers: [{ text: "Le Wouri", correct: true }, { text: "La Seine" }] },
  ],
};

/**
 * Campagne Or diffusée (TV, application, jeux, quiz) créée par les RPC, comme depuis l'espace annonceur, puis validée
 * et payée (faux fournisseur). Formule sans plafond d'agences : toutes les agences existantes à la validation sont
 * ciblées (la base de test en compte bien plus que les 15 de la formule Argent).
 */
export async function activeCampaign(name: string, city: string | null = null) {
  const email = uniqueEmail("annonceur");
  await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  const adv = await signedIn(email);
  const advertiserId = await rpc<string>(adv, "create_advertiser", { p_name: `Boulangerie ${name}`, p_sector: "food", p_phone: null, p_city: "Douala" });
  const campaignId = await rpc<string>(adv, "save_campaign", {
    p_campaign: null,
    p_advertiser: advertiserId,
    p_organization: null,
    p_fields: { name, package_code: "or", sector: "food", starts_on: today(), surfaces: ["tv", "app", "game"], target_cities: city ? [city] : [], target_org_types: [], schedules: [] },
  });
  const path = `${advertiserId}/${campaignId}/visuel.png`;
  const up = await adv.storage.from("ad-creatives").upload(path, bannerPng("#F58B1F", "#B5651A"), { contentType: "image/png" });
  expect(up.error).toBeNull();
  await rpc(adv, "save_creative", {
    p_campaign: campaignId,
    p_creative: null,
    p_fields: { storage_path: path, kind: "image", headline: `Pain chaud ${name}`, offer_text: "-20 %", cta_url: "", duration_seconds: 8 },
  });
  await rpc(adv, "save_quiz", { p_campaign: campaignId, p_fields: QUIZ });
  await rpc(adv, "submit_campaign", { p_campaign: campaignId });
  const wintek = await platformAdmin();
  await rpc(wintek.client, "review_campaign", { p_campaign: campaignId, p_approve: true, p_note: "" });
  const checkout = await rpc<{ pay_token: string }>(adv, "campaign_checkout", { p_campaign: campaignId });
  const started = await rpc<{ external_id: string }>(admin, "start_payment", {
    p_token: checkout.pay_token,
    p_provider: "fake",
    p_channel: "mtn_momo",
    p_msisdn: "+237677123456",
  });
  await rpc(admin, "confirm_payment", { p_external_id: started.external_id, p_status: "succeeded", p_provider_ref: "e2e" });
  return { email, advertiserId, campaignId };
}

/**
 * Agence dans une ville qui lui est propre, et campagne ciblant cette ville : la rotation et le quiz proposés sont
 * ceux du test, même si d'autres campagnes (démo, tests en parallèle) sont diffusées ailleurs.
 */
export async function branchWithCampaign(label: string) {
  const b = await setUpBranch(`Clinique ${label}`);
  const city = `Ville ${label} ${Date.now()}`;
  const updated = await b.staff.from("branches").update({ city }).eq("id", b.branchId).select("id");
  expect(updated.data).toHaveLength(1);
  const c = await activeCampaign(`${label} ${Date.now()}`, city);
  return { b, c };
}

/** Ticket pris comme un client (session anonyme, API) : jeton du lien `/t/<jeton>`. */
export async function takeTicket(page: Page, b: Awaited<ReturnType<typeof setUpBranch>>) {
  const visitor = anonClient();
  const { data } = await visitor.auth.signInAnonymously();
  const res = await page.request.post("/api/tickets", {
    headers: { Authorization: `Bearer ${data.session!.access_token}` },
    data: { serviceId: b.serviceId, source: "qr", entryCode: b.entryCode },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { ticket: { publicToken: string } }).ticket.publicToken;
}


/**
 * Écran TV appairé comme dans l'application : code demandé par l'écran, appairage par le personnel (publicité
 * affichée ou non), puis jeton d'appareil récupéré par l'écran.
 */
export async function pairDisplay(request: APIRequestContext, staff: SupabaseClient, branchId: string, showAds: boolean) {
  const pairing = (await (await request.post("/api/tv/pair")).json()) as { displayId: string; code: string; pollSecret: string };
  await rpc(staff, "pair_display", { p_code: pairing.code, p_branch: branchId, p_name: "Salle d'attente", p_service_ids: null, p_show_ads: showAds });
  const poll = (await (await request.post("/api/tv/pair/poll", { data: { displayId: pairing.displayId, pollSecret: pairing.pollSecret } })).json()) as {
    deviceToken: string;
  };
  expect(poll.deviceToken).toBeTruthy();
  return poll.deviceToken;
}
