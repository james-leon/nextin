"use client";

import { primeAttention, signalAttention } from "@/lib/client/attention";
import { alertEnabled } from "@/lib/desk/notification-prefs";
import { EmptyState } from "@/components/ui/empty-state";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowLeftRight, CalendarDays, Check, Eye, EyeOff, Hand, Inbox, Plus, Printer, Star, StarOff, UserRound, UserRoundX, X } from "lucide-react";
import { identityLine } from "@nextin/shared/identity";
import { useNameMask } from "@/lib/desk/name-mask";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { isActiveCall } from "@nextin/shared/queue/live";
import { staffTopic } from "@nextin/shared/queue/realtime";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { PageFrame } from "@/components/ui/page-frame";
import { ServiceTile } from "@/components/ui/service-tile";
import { ActionSheet } from "@/components/ui/action-sheet";
import { useToast } from "@/components/ui/toast";
import { loadReception, type ReceptionData, type ReceptionPractitioner, type ReceptionTicket } from "@/lib/desk/reception";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AbsenceSheet } from "./absence-sheet";
import { CreateTicketSheet } from "./create-ticket-sheet";
import { IdentitySheet } from "./identity-sheet";
import { PrioritySheet } from "./priority-sheet";
import { TransferSheet } from "./transfer-sheet";

/** Poste d'accueil : créer des tickets, priorités, réorientations, absences des praticiens, vue en direct. */
export function ReceptionDesk({ initial }: { initial: ReceptionData }) {
  const t = useTranslations("reception");
  const td = useTranslations("desk");
  const ta = useTranslations("absence");
  const tk = useTranslations("counterKinds");
  const tr = useTranslations("priorityReasons");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tap = useTranslations("appointments");
  const locale = useLocale();
  const toast = useToast();
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ReceptionTicket | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const ti = useTranslations("identity");
  const identityRules = data.branch.identityRules;
  const nameMask = useNameMask();
  // Nom du client (personnel uniquement) ; masqué d'un geste ou après 2 min sans activité.
  const nameOf = (tk: ReceptionTicket) => {
    if (identityRules.mode === "off" || !tk.identity) return null;
    if (nameMask.hidden) return ti("hidden");
    return identityLine(tk.identity, { age: (age) => ti("ageValue", { age }), file: (value) => ti("fileValue", { value }) });
  };
  const [absenceFor, setAbsenceFor] = useState<ReceptionPractitioner | null>(null);
  // Heure courante (minutes d'attente des lignes), avancée toutes les 30 s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const waitedMinutes = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));

  const branchId = initial.branch.id;
  const refresh = useCallback(async () => {
    const next = await loadReception(supabase, branchId).catch(() => null);
    if (next) setData(next);
    return next;
  }, [branchId, supabase]);
  // Demandes d'aide déjà connues : seule une nouvelle demande déclenche le son (pas une demande traitée ailleurs).
  const knownHelp = useRef(new Set(initial.helpRequests.map((h) => h.id)));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(staffTopic(branchId), { config: { private: true } })
      .on("broadcast", { event: "board" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 250);
      })
      .on("broadcast", { event: "identity" }, () => void refresh())
      // C3 : demande d'aide envoyée depuis la page d'un ticket (ou traitée sur un autre poste).
      .on("broadcast", { event: "help" }, () => {
        void refresh().then((next) => {
          if (!next) return;
          // Nouvelle demande : son et vibration si cet appareil l'accepte (Réglages → Notifications).
          const fresh = next.helpRequests.some((h) => !knownHelp.current.has(h.id));
          knownHelp.current = new Set(next.helpRequests.map((h) => h.id));
          if (fresh && alertEnabled("help")) signalAttention();
        });
      })
      .subscribe();
    const unprime = primeAttention();
    const poll = setInterval(() => void refresh(), 15_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      unprime();
      void supabase.removeChannel(channel);
    };
  }, [branchId, refresh, supabase]);

  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: data.branch.timeZone }).format(new Date(iso));
  const serviceById = new Map(data.services.map((s) => [s.id, s]));
  const counterById = new Map(data.counters.map((c) => [c.id, c]));
  const practitionerOfCounter = (counterId: string | null) => {
    const c = counterId ? counterById.get(counterId) : null;
    return c?.practitionerId ? data.practitioners.find((p) => p.id === c.practitionerId) : undefined;
  };
  const kindLabel = (k: string) => tk(k as "cabinet");
  // Appels en cours uniquement : le tableau contient aussi les derniers appels terminés (écran TV).
  const activeCalls = data.board?.calls.filter(isActiveCall) ?? [];

  async function command(
    fn: "set_ticket_priority" | "move_back_ticket" | "cancel_ticket" | "transfer_ticket" | "staff_confirm_presence",
    args: Record<string, unknown>,
  ) {
    const { error } = await supabase.rpc(fn as "cancel_ticket", args as { p_ticket: string });
    if (error) toast(te.has(error.message as never) ? te(error.message as never) : te("generic"));
    else toast(t("done"));
    setSelected(null);
    await refresh();
  }

  // « Cabinet 1 · 5 patients attitrés » : poste du praticien et tickets qui l'attendent (feuille d'absence).
  const absenceDetail = (practitionerId: string) => {
    const counter = data.counters.find((c) => c.practitionerId === practitionerId);
    if (!counter) return undefined;
    const name = counter.label ?? `${kindLabel(counter.kind)} ${counter.number}`;
    return ta("detail", { counter: name, count: data.waiting.filter((w) => w.preferredCounterId === counter.id).length });
  };

  const helpTickets = new Set(data.helpRequests.map((h) => h.ticketId));

  return (
    <PageFrame>
      <main className="min-h-dvh pb-40 md:pb-8">
        <NavigationBar
          title={t("title")}
          eyebrow={`${data.branch.organizationName} · ${data.branch.name}`}
          back={{ href: "/desk", label: td("title") }}
          trailing={
            <>
              {identityRules.mode !== "off" ? (
                <IconButton
                  label={nameMask.hidden ? ti("show") : ti("hide")}
                  icon={nameMask.hidden ? <Eye /> : <EyeOff />}
                  variant="plain"
                  aria-pressed={nameMask.hidden}
                  onClick={nameMask.toggle}
                />
              ) : null}
              <Badge shape="pill" tone="green">
                <span aria-hidden className="size-2 rounded-full bg-green" />
                {t("live")}
              </Badge>
            </>
          }
          contentClassName="max-w-7xl md:px-8 lg:px-10"
        />
        {/* Téléphone : une colonne ; tablette : rendez-vous en haut puis deux colonnes ;
            ordinateur : services et praticiens / file d'attente / rendez-vous du jour, sur toute la largeur. */}
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-7 px-4 pt-3 md:grid-cols-2 md:px-8 lg:grid-cols-3 lg:items-start lg:px-10">
          <div className="flex flex-col gap-7 md:col-span-2 lg:order-last lg:col-span-1">
            <ListSection>
              <ListRow
                href={`/desk/reception/${branchId}/appointments`}
                icon={
                  <ListIcon>
                    <CalendarDays />
                  </ListIcon>
                }
                title={tap("open")}
                subtitle={tap("upcoming", { count: data.upcomingAppointments })}
                accessory="chevron"
              />
              <ListRow
                href={`/desk/reception/${branchId}/appointments?view=requests`}
                icon={
                  <ListIcon color={data.pendingRequests ? "var(--orange-fill)" : "var(--accent-fill)"}>
                    <Inbox />
                  </ListIcon>
                }
                title={t("requestsTitle")}
                subtitle={t("requestsCount", { count: data.pendingRequests })}
                accessory={
                  data.pendingRequests ? (
                    <Badge tone="orange" className="mr-1 tabular">
                      {data.pendingRequests}
                    </Badge>
                  ) : (
                    "chevron"
                  )
                }
              />
            </ListSection>
            {data.nextAppointments.length ? (
              <ListSection header={t("todayHeader")} className="hidden lg:block">
                {data.nextAppointments.map((a) => {
                  const service = serviceById.get(a.serviceId);
                  const doctor = data.practitioners.find((p) => p.id === a.practitionerId);
                  return (
                    <ListRow
                      key={a.id}
                      href={`/desk/reception/${branchId}/appointments`}
                      icon={service ? <ServiceTile letter={service.prefix} color={service.color} /> : undefined}
                      title={<span className="font-semibold tabular">{time(a.startsAt)}</span>}
                      subtitle={[doctor?.name, service?.name].filter(Boolean).join(" · ") || undefined}
                      accessory="chevron"
                    />
                  );
                })}
              </ListSection>
            ) : (
              <p className="hidden px-4 text-footnote text-label-secondary lg:block">{t("todayEmpty")}</p>
            )}
          </div>
          <div className="flex flex-col gap-7">
            <ListSection header={t("servicesHeader")}>
              {data.services.map((s) => {
                const b = data.board?.services.find((x) => x.id === s.id);
                return (
                  <ListRow
                    key={s.id}
                    icon={<ServiceTile letter={s.prefix} color={s.color} />}
                    title={s.name}
                    subtitle={
                      <span className="tabular">
                        {b?.waiting.length ? t("waitingSummary", { count: b.waiting.length, minutes: waitMinutes(b.wait_seconds) }) : t("queueEmpty")}
                      </span>
                    }
                  />
                );
              })}
            </ListSection>

            {activeCalls.length ? (
              <ListSection header={t("callsHeader")}>
                {activeCalls.slice(0, 6).map((c) => {
                  const counter = c.counter_label ?? `${kindLabel(c.counter_kind)} ${c.counter_number}`;
                  return (
                    <ListRow
                      key={c.code}
                      title={<span className="font-rounded font-bold text-ticket-number">{c.code}</span>}
                      detail={c.status === "called" ? t("calledAt", { counter }) : t("servingAt", { counter })}
                    />
                  );
                })}
              </ListSection>
            ) : null}

            {data.practitioners.length ? (
              <ListSection header={t("practitionersHeader")}>
                {data.practitioners.map((p) => (
                  <ListRow
                    key={p.id}
                    onClick={() => setAbsenceFor(p)}
                    icon={
                      <ListIcon color={p.absence ? "var(--orange-fill)" : "var(--green-fill)"}>
                        {p.absence ? <UserRoundX /> : <UserRound />}
                      </ListIcon>
                    }
                    title={p.name}
                    detail={
                      p.absence
                        ? p.absence.kind === "late" && p.absence.until
                          ? ta("activeLate", { time: time(p.absence.until) })
                          : ta("activeAbsent")
                        : ta("present")
                    }
                    accessory="chevron"
                  />
                ))}
              </ListSection>
            ) : null}
          </div>

          <div className="order-first flex flex-col gap-7 md:order-none">
          {/* C3 : demandes d'aide des patients (page du ticket), à traiter en premier ; rien sur l'écran TV.
              Maquette v2 20 : un encadré orange par demande, « Traité » le fait disparaître. */}
          {data.helpRequests.length ? (
            <section aria-label={t("helpHeader", { count: data.helpRequests.length })} className="flex flex-col gap-2">
              {data.helpRequests.map((h) => (
                <div key={h.id} className="squircle flex items-center gap-3 rounded-[var(--radius-lg)] bg-orange-tint px-3 py-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-orange text-white">
                    <Hand className="size-5 stroke-[2]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-headline text-orange-text">{t("helpTitle", { code: h.code })}</span>
                    <span className="text-subheadline text-label-secondary">{t("helpSince", { time: time(h.requestedAt) })}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={t("helpDoneLabel", { code: h.code })}
                    className="pressable min-h-11 shrink-0 rounded-[var(--radius-md)] bg-grouped-secondary px-3.5 text-callout font-semibold text-accent-text"
                    onClick={async () => {
                      const { error } = await supabase.rpc("handle_ticket_help", { p_request: h.id });
                      if (error) toast(te("generic"));
                      await refresh();
                    }}
                  >
                    {t("helpDone")}
                  </button>
                </div>
              ))}
            </section>
          ) : null}
          <ListSection header={t("queueHeader", { count: data.waiting.length })}>
            {data.waiting.length ? null : <EmptyState variant="inline" title={t("queueEmpty")} icon={<Inbox />} />}
            {data.waiting.map((tk2) => {
              const service = serviceById.get(tk2.serviceId);
              const doctor = practitionerOfCounter(tk2.preferredCounterId);
              return (
                <ListRow
                  key={tk2.id}
                  onClick={() => setSelected(tk2)}
                  icon={service ? <ServiceTile letter={service.prefix} color={service.color} /> : undefined}
                  // Titre : le numéro et le nom (masquable) ; sous-titre : origine et heure, puis présence ou praticien.
                  // Actions secondaires (priorité, nom…) dans la feuille du ticket sélectionné : une seule action principale.
                  title={
                    <>
                      <span className="font-rounded font-bold text-ticket-number">{tk2.code}</span>
                      {tk2.priorityReason ? (
                        <>
                          <Star aria-hidden className="ml-1 inline size-3.5 fill-current stroke-0 align-[-0.05em] text-label" />
                          <span className="sr-only"> · {t("priorityStar")}</span>
                        </>
                      ) : null}
                      {helpTickets.has(tk2.id) ? (
                        <Badge tone="orange" className="ml-2 align-middle">
                          {t("helpBadge")}
                        </Badge>
                      ) : null}
                      {nameOf(tk2) ? <span className="text-label-secondary"> · {nameOf(tk2)}</span> : null}
                    </>
                  }
                  subtitle={
                    <>
                      {tk2.priorityReason ? tr(tk2.priorityReason) : td(`source.${tk2.source}`)}
                      <span className="tabular"> · {td("minutes", { count: waitedMinutes(tk2.createdAt) })}</span>
                      {tk2.remote ? (
                        <span className={tk2.remote.confirmed ? "text-green-text" : "text-orange-text"}>
                          {" · "}
                          {tk2.remote.confirmed ? t("remoteHere") : tk2.remote.onMyWay ? t("remoteOnWay") : t("remotePending")}
                          {tk2.remote.delays ? ` · ${t("remoteDelayed", { count: tk2.remote.delays })}` : ""}
                        </span>
                      ) : doctor ? (
                        ` · ${t("forPractitioner", { name: doctor.name })}`
                      ) : null}
                    </>
                  }
                  accessory="chevron"
                />
              );
            })}
          </ListSection>
          </div>
          {/* Tablette : barre collée en bas, à la largeur exacte du contenu ; ordinateur : dans la barre de titre. */}
          <BottomBar className="md:col-span-2 lg:col-span-3">
            <Button block onClick={() => setCreateOpen(true)} leadingIcon={<Plus aria-hidden className="size-5 stroke-[2.25]" />}>
              {t("newTicket")}
            </Button>
          </BottomBar>
        </div>

        <CreateTicketSheet data={data} open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void refresh()} />

        {selected ? (
          <ActionSheet
            open={!!selected && !transferOpen && !cancelOpen && !priorityOpen && !identityOpen}
            onOpenChange={(o) => !o && setSelected(null)}
            title={t("ticketActions", { code: selected.code })}
            subtitle={[
              serviceById.get(selected.serviceId)?.name,
              selected.remote ? td("source.remote").toLowerCase() : null,
              selected.remote ? (selected.remote.confirmed ? t("remoteHere") : selected.remote.onMyWay ? t("remoteOnWay") : t("remotePending")) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            closeLabel={tc("close")}
            items={[
              selected.priorityReason
                ? { key: "priority", label: t("removePriority"), icon: <StarOff />, onSelect: () => void command("set_ticket_priority", { p_ticket: selected.id, p_reason: null }) }
                : { key: "priority", label: t("setPriority"), icon: <Star />, onSelect: () => setPriorityOpen(true) },
              ...(identityRules.mode !== "off"
                ? [{ key: "name", label: selected.identity?.name ? ti("edit") : ti("enter"), icon: <UserRound />, onSelect: () => setIdentityOpen(true) }]
                : []),
              ...(selected.remote && !selected.remote.confirmed
                ? [{ key: "presence", label: t("confirmPresence"), icon: <Check />, onSelect: () => void command("staff_confirm_presence", { p_ticket: selected.id }) }]
                : []),
              { key: "transfer", label: t("reorient"), icon: <ArrowLeftRight />, onSelect: () => setTransferOpen(true) },
              { key: "back", label: t("moveBack"), icon: <ArrowDown />, onSelect: () => void command("move_back_ticket", { p_ticket: selected.id, p_places: 3 }) },
              { key: "print", label: t("print"), icon: <Printer />, href: `/desk/print/${selected.id}` },
              { key: "cancel", label: t("cancelTicket"), icon: <X />, onSelect: () => setCancelOpen(true), destructive: true },
            ]}
          />
        ) : null}

        {selected && priorityOpen ? (
          <PrioritySheet
            code={selected.code}
            open
            onOpenChange={setPriorityOpen}
            onGrant={(r) => void command("set_ticket_priority", { p_ticket: selected.id, p_reason: r })}
          />
        ) : null}

        {selected && identityOpen ? (
          <IdentitySheet
            open
            onOpenChange={(o) => {
              setIdentityOpen(o);
              if (!o) setSelected(null);
            }}
            ticketId={selected.id}
            code={selected.code}
            rules={identityRules}
            initial={selected.identity}
            onSaved={() => void refresh()}
          />
        ) : null}

        {selected ? (
          <TransferSheet
            code={selected.code}
            services={data.services
              .filter((s) => s.id !== selected.serviceId)
              .map((s) => ({ ...s, waiting: data.board?.services.find((x) => x.id === s.id)?.waiting.length ?? 0 }))}
            open={transferOpen}
            onOpenChange={setTransferOpen}
            onConfirm={(serviceId) => void command("transfer_ticket", { p_ticket: selected.id, p_target_service: serviceId })}
          />
        ) : null}

        {selected && cancelOpen ? (
          <AlertDialog
            open
            onOpenChange={setCancelOpen}
            title={t("cancelTitle", { code: selected.code })}
            description={t("cancelBody")}
            cancelLabel={t("keep")}
            actionLabel={t("cancelTicket")}
            destructive
            onAction={() => void command("cancel_ticket", { p_ticket: selected.id })}
          />
        ) : null}

        {absenceFor ? (
          <AbsenceSheet
            key={absenceFor.id}
            practitioner={{ id: absenceFor.id, name: absenceFor.name, detail: absenceDetail(absenceFor.id) }}
            active={absenceFor.absence}
            open
            onOpenChange={(o) => !o && setAbsenceFor(null)}
            onDone={(message) => {
              toast(message, <UserRoundX aria-hidden />);
              void refresh();
            }}
          />
        ) : null}
      </main>
    </PageFrame>
  );
}
