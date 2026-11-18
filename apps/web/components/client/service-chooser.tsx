"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { useRouter } from "next/navigation";
import { Accessibility, Check, Clock, Info } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { parseIdentity, type IdentityRules } from "@nextin/shared/identity";
import type { BranchBoard, BoardService } from "@nextin/shared/queue/live";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { QueueDots } from "@/components/ui/queue-dots";
import { ServiceTile } from "@/components/ui/service-tile";
import { remoteTicketsFor, saveTicket } from "@/lib/client/my-tickets";
import { callRpc } from "@/lib/client/supabase-public";
import { subscribeBoard } from "@/lib/client/board-feed";
import { takeTicket } from "@/lib/client/take-ticket";
import { isOnlineUnavailable } from "@/lib/client/online-unavailable";
import { CustomerIdentityFields, saveIdentity, useIdentityValue } from "./customer-identity-fields";
import type { EntryInfo, TicketView } from "@/lib/client/types";

type Taken = { token: string; code: string; ahead: number; minutes: number };

/**
 * Prise de ticket (maquette v2 02), en étapes sur la même page :
 * 1. « Choisissez un service » : liste groupée en direct (pastille, attente) ; un service sans poste ouvert reste
 *    choisissable (le ticket attend son ouverture) ;
 * 2. « Votre nom », seulement si l'établissement le demande ;
 * 3. « Ticket pris » : le numéro et la file en points, puis « Mon ticket » (automatiquement après un instant).
 * Prise en ligne indisponible (abonnement, quota…) : encadré neutre, sans la raison, services grisés.
 * L'accès prioritaire n'est jamais demandé ici : une ligne d'information renvoie vers l'accueil.
 */
export function ServiceChooser({
  entry,
  presenceCode = null,
  captchaSiteKey,
  identityRules = { mode: "off", extra: "none" },
}: {
  entry: EntryInfo;
  /** Nom du client demandé par l'agence (non demandé, facultatif ou obligatoire). */
  identityRules?: IdentityRules;
  /** Code de présence tournant du QR code de l'écran TV (`?p=`), sinon le code d'entrée imprimé. */
  presenceCode?: string | null;
  captchaSiteKey: string | null;
}) {
  const t = useLiteT("client.service");
  const tc = useLiteT("common");
  const te = useLiteT("errors");
  const locale = useLiteLocale();
  const router = useRouter();
  const captchaRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<BranchBoard>(entry.board);
  const services = useMemo(() => board.services.filter((s) => !entry.service_id || s.id === entry.service_id), [board, entry.service_id]);
  const [selected, setSelected] = useState<string | null>(entry.service_id ?? null);
  const [step, setStep] = useState<"choose" | "name">("choose");
  const [taken, setTaken] = useState<Taken | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useIdentityValue(identityRules.mode !== "off");
  const [nameError, setNameError] = useState<string | null>(null);

  // Files mises à jour en direct ; rechargement complet à chaque (re)connexion.
  useEffect(() => subscribeBoard(entry.branch.id, setBoard), [entry.branch.id]);

  // Ticket à distance de cet appareil dans cette agence (M9) : scanner le QR code de l'écran TV (code tournant) ou,
  // si l'agence l'accepte, celui de l'accueil confirme la présence.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const saved of remoteTicketsFor(entry.branch.id)) {
        const { data } = await callRpc<TicketView>("confirm_presence", { p_token: saved.token, p_entry_code: presenceCode ?? entry.entry_code });
        if (cancelled) return;
        if (data && (data.status === "waiting" || data.status === "called")) {
          router.replace(`/t/${saved.token}`);
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.branch.id, entry.entry_code, presenceCode, router]);

  // « Ticket pris » : une confirmation d'un instant, puis la page du ticket.
  useEffect(() => {
    if (!taken) return;
    const id = setTimeout(() => router.push(`/t/${taken.token}`), 2200);
    return () => clearTimeout(id);
  }, [taken, router]);

  // Prise en ligne indisponible (abonnement, quota) : connu dès l'ouverture, sans la raison.
  const [online, setOnline] = useState(entry.online_open !== false);
  const name = (s: BoardService) => (locale === "en" && s.name_en ? s.name_en : s.name);
  const summary = (s: BoardService) => {
    const minutes = waitMinutes(s.wait_seconds);
    if (!s.open) return t("noCounter");
    return s.waiting.length === 0 && minutes === 0 ? t("noWait") : t("people", { count: s.waiting.length, minutes });
  };
  const current = services.find((s) => s.id === selected) ?? null;
  const priorityOffered = entry.priorities_enabled && entry.priority_service_ids.length > 0;
  const canTake = online && entry.branch.is_open;
  const place = `${entry.organization.name} · ${entry.branch.name}`;

  async function submit(service: BoardService) {
    const parsed = parseIdentity(identityRules, identity);
    if (!parsed.ok) {
      // Message sous le champ (annoncé par le lecteur d'écran) et focus dessus.
      setNameError(te(parsed.error));
      document.querySelector<HTMLInputElement>('input[name="customerName"]')?.focus();
      return;
    }
    setNameError(null);
    setPending(true);
    setError(null);
    const ahead = service.waiting.length;
    const minutes = waitMinutes(service.wait_seconds);
    const outcome = await takeTicket(
      { serviceId: service.id, source: entry.source, entryCode: entry.entry_code, identity: parsed.identity },
      { siteKey: captchaSiteKey, container: captchaRef.current },
    );
    if (outcome.ok) {
      if (identityRules.mode !== "off") saveIdentity(identity);
      saveTicket({ token: outcome.token, code: outcome.code, entry: entry.entry_code });
      setTaken({ token: outcome.token, code: outcome.code, ahead, minutes });
      return;
    }
    if (outcome.existingPath) {
      router.push(outcome.existingPath);
      return;
    }
    setPending(false);
    // Devenu indisponible depuis l'ouverture de la page : même encadré neutre, jamais la raison.
    if (isOnlineUnavailable(outcome.error)) {
      setStep("choose");
      return setOnline(false);
    }
    setError(te.has(outcome.error) ? te(outcome.error) : te("generic"));
  }

  function choose(service: BoardService) {
    setSelected(service.id);
    setError(null);
    if (identityRules.mode === "off") void submit(service);
    else setStep("name");
  }

  const captcha = <div ref={captchaRef} className="flex justify-center empty:hidden" />;

  if (taken) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2.5 px-6 py-10 text-center" aria-live="polite">
        <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-green text-white">
          <Check className="size-9 stroke-[2.75]" />
        </span>
        <h1 className="text-headline">{t("takenTitle")}</h1>
        <p className="text-hero font-bold text-ticket-number">{taken.code}</p>
        <p className="text-subheadline text-label-secondary">
          {current ? name(current) : ""} · {entry.organization.name}
        </p>
        <QueueDots ahead={taken.ahead} done={2} className="mt-3" />
        <p className="text-subheadline font-semibold">
          {t("takenAhead", { count: taken.ahead })}
          {taken.ahead > 0 ? ` · ${t("takenWait", { minutes: taken.minutes })}` : ""}
        </p>
        <div className="mt-5 flex w-full max-w-sm flex-col gap-2">
          <Button block onClick={() => router.push(`/t/${taken.token}`)}>
            {t("seeTicket")}
          </Button>
          <p className="text-caption text-label-secondary">{t("takenFine")}</p>
        </div>
      </main>
    );
  }

  if (step === "name" && current) {
    return (
      <main className="min-h-dvh pb-40 md:pb-8">
        <NavigationBar
          title={t("nameTitle")}
          eyebrow={`${name(current)} · ${summary(current)}`}
          back={{ onClick: () => setStep("choose"), label: t("nameBack") }}
          contentClassName="max-w-lg lg:max-w-[40rem]"
        >
          <p className="mt-1 text-subheadline text-label-secondary">{t("nameLead")}</p>
        </NavigationBar>
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-3 lg:max-w-[40rem]">
          <CustomerIdentityFields
            rules={identityRules}
            value={identity}
            onChange={(v) => {
              setIdentity(v);
              if (nameError) setNameError(null);
            }}
            nameError={nameError ?? undefined}
          />
          {captcha}
        </div>
        <BottomBar
          className="lg:static lg:bg-none lg:pt-2"
          contentClassName="lg:max-w-[40rem]"
          summary={error ? <span role="alert" className="text-red-text">{error}</span> : <span>{t("nameFine")}</span>}
        >
          <Button block onClick={() => submit(current)} loading={pending} loadingLabel={t("taking")} disabled={!canTake}>
            {t("take")}
          </Button>
        </BottomBar>
      </main>
    );
  }

  return (
    <main className="min-h-dvh pb-12">
      <NavigationBar title={t("title")} eyebrow={place} back={{ href: "/", label: t("back"), prefetch: false }} contentClassName="max-w-lg lg:max-w-[40rem]" />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3 lg:max-w-[40rem]">
        {!online ? (
          <CalloutCard icon={<Info />} tone="neutral" role="status" data-testid="online-unavailable">
            {tc("onlineUnavailable")}
          </CalloutCard>
        ) : !entry.branch.is_open ? (
          <CalloutCard icon={<Clock />} role="status">
            {t("branchClosed")}
          </CalloutCard>
        ) : null}
        {error ? (
          <p role="alert" className="px-4 text-subheadline text-red-text">
            {error}
          </p>
        ) : null}
        {services.length === 0 ? (
          <CalloutCard icon={<Clock />}>{t("empty")}</CalloutCard>
        ) : (
          <ListSection
            aria-label={t("header")}
            footer={canTake && identityRules.mode !== "off" ? t("nameNext") : undefined}
          >
            {services.map((s) => (
              <ListRow
                key={s.id}
                onClick={() => choose(s)}
                disabled={!canTake || pending}
                current={pending && selected === s.id}
                icon={<ServiceTile letter={s.prefix} color={canTake ? s.color : "var(--label-tertiary)"} />}
                title={name(s)}
                subtitle={canTake ? <span className="tabular">{summary(s)}</span> : undefined}
                accessory={pending && selected === s.id ? <span className="text-footnote text-label-secondary">{t("taking")}</span> : canTake ? "chevron" : undefined}
              />
            ))}
          </ListSection>
        )}
        {priorityOffered && canTake ? (
          <CalloutCard icon={<Accessibility />} tone="accent">
            {t("priorityInfo")}
          </CalloutCard>
        ) : null}
        {captcha}
      </div>
    </main>
  );
}
