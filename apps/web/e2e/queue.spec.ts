import { expect, test } from "@playwright/test";
import { anonClient, rpc, setUpBranch } from "./queue-helpers";

test.describe("M3 — prise de ticket et appel en deux temps", () => {
  test("API /api/tickets → alerte → admission", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "parcours API, indépendant de l'appareil");
    const { staff, serviceId, counterId, entryCode } = await setUpBranch();
    const visitor = anonClient();
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
