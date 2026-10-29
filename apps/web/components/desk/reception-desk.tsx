"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, Ban, CalendarDays, Inbox, Plus, Printer, ScanLine, Shuffle, Star, StarOff, UserRound, UserRoundX } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { isActiveCall, PRIORITY_REASONS, type PriorityReason } from "@nextin/shared/queue/live";
import { staffTopic } from "@nextin/shared/queue/realtime";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { ServiceTile } from "@/components/ui/service-tile";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { loadReception, type ReceptionData, type ReceptionPractitioner, type ReceptionTicket } from "@/lib/desk/reception";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AbsenceSheet } from "./absence-sheet";
import { CreateTicketSheet } from "./create-ticket-sheet";
import { TransferSheet } from "./transfer-sheet";

/** Poste d'accueil : créer des tickets, priorités, réorientations, absences des praticiens, vue en direct. */
export function ReceptionDesk({ initial }: { initial: ReceptionData }) {
  const t = useTranslations("reception");
  const td = useTranslations("desk");
  const ta = useTranslations("absence");
  const tk = useTranslations("counterKinds");
  const tr = useTranslations("client.service.reasons");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const tap = useTranslations("appointments");
  const locale = useLocale();
  const toast = useToast();
  const supabase = getSupabaseBrowserClient();
  const [data, setData] = useState(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ReceptionTicket | null>(null);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [absenceFor, setAbsenceFor] = useState<ReceptionPractitioner | null>(null);

  const branchId = initial.branch.id;
  const refresh = useCallback(async () => {
    const next = await loadReception(supabase, branchId).catch(() => null);
    if (next) setData(next);
  }, [branchId, supabase]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(staffTopic(branchId), { config: { private: true } })
      .on("broadcast", { event: "board" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 250);
      })
      .subscribe();
    const poll = setInterval(() => void refresh(), 15_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
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

  return (
    <main className="min-h-dvh pb-40">
      <NavigationBar
        title={t("title")}
        eyebrow={`${data.branch.organizationName} · ${data.branch.name}`}
        back={{ href: "/desk", label: td("title") }}
        trailing={
          <Badge shape="pill" tone="green">
            <span aria-hidden className="size-2 rounded-full bg-green" />
            {t("live")}
          </Badge>
        }
        contentClassName="max-w-5xl"
      />
      <div className="mx-auto grid grid-cols-1 max-w-5xl gap-7 px-4 pt-3 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-7">
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
                    title={<span className="font-semibold">{c.code}</span>}
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

        <ListSection header={t("queueHeader", { count: data.waiting.length })} footer={data.waiting.length ? undefined : t("queueEmpty")}>
          {data.waiting.map((tk2) => {
            const service = serviceById.get(tk2.serviceId);
            const doctor = practitionerOfCounter(tk2.preferredCounterId);
            return (
              <ListRow
                key={tk2.id}
                onClick={() => setSelected(tk2)}
                icon={service ? <ServiceTile letter={service.prefix} color={service.color} /> : undefined}
                title={
                  <span className="flex items-baseline gap-3">
                    <span className="w-16 shrink-0 font-semibold">{tk2.code}</span>
                    <span className="truncate text-label-secondary">
                      {td(`source.${tk2.source}`)} · {time(tk2.createdAt)}
                    </span>
                  </span>
                }
                subtitle={
                  tk2.remote ? (
                    <span className={tk2.remote.confirmed ? "text-green-text" : "text-orange-text"}>
                      {tk2.remote.confirmed ? t("remoteHere") : tk2.remote.onMyWay ? t("remoteOnWay") : t("remotePending")}
                      {tk2.remote.delays ? ` · ${t("remoteDelayed", { count: tk2.remote.delays })}` : ""}
                    </span>
                  ) : doctor ? (
                    t("forPractitioner", { name: doctor.name })
                  ) : undefined
                }
                accessory={
                  tk2.priorityReason ? <Badge tone="orange">{tk2.priorityReason === "appointment" ? "RDV" : tr(tk2.priorityReason)}</Badge> : "chevron"
                }
              />
            );
          })}
        </ListSection>
      </div>

      <BottomBar>
        <Button block onClick={() => setCreateOpen(true)} leadingIcon={<Plus aria-hidden className="size-5 stroke-[2.25]" />}>
          {t("newTicket")}
        </Button>
      </BottomBar>

      <CreateTicketSheet data={data} open={createOpen} onOpenChange={setCreateOpen} onCreated={() => void refresh()} />

      {selected ? (
        <Sheet
          open={!!selected && !transferOpen && !cancelOpen && !priorityOpen}
          onOpenChange={(o) => !o && setSelected(null)}
          title={t("ticketActions", { code: selected.code })}
          closeLabel={tc("close")}
        >
          <div className="flex flex-col gap-4 pt-2">
            {selected.remote && !selected.remote.confirmed ? (
              <ListSection>
                <ListRow
                  onClick={() => command("staff_confirm_presence", { p_ticket: selected.id })}
                  icon={<ListIcon color="var(--green-fill)"><ScanLine /></ListIcon>}
                  title={t("confirmPresence")}
                />
              </ListSection>
            ) : null}
            <ListSection>
              {selected.priorityReason ? (
                <ListRow
                  onClick={() => command("set_ticket_priority", { p_ticket: selected.id, p_reason: null })}
                  icon={<ListIcon color="var(--orange-fill)"><StarOff /></ListIcon>}
                  title={t("removePriority")}
                />
              ) : (
                <ListRow
                  onClick={() => setPriorityOpen(true)}
                  icon={<ListIcon color="var(--orange-fill)"><Star /></ListIcon>}
                  title={t("setPriority")}
                  accessory="chevron"
                />
              )}
              <ListRow
                onClick={() => setTransferOpen(true)}
                icon={<ListIcon color="var(--accent-fill)"><Shuffle /></ListIcon>}
                title={t("reorient")}
                accessory="chevron"
              />
              <ListRow
                onClick={() => command("move_back_ticket", { p_ticket: selected.id, p_places: 3 })}
                icon={<ListIcon color="var(--brand-tile)"><ArrowDown /></ListIcon>}
                title={t("moveBack")}
              />
              <ListRow
                href={`/desk/print/${selected.id}`}
                icon={<ListIcon color="var(--brand-tile)"><Printer /></ListIcon>}
                title={t("print")}
                accessory="chevron"
              />
            </ListSection>
            <ListSection>
              <ListRow onClick={() => setCancelOpen(true)} icon={<ListIcon color="var(--red-fill)"><Ban /></ListIcon>} title={t("cancelTicket")} destructive />
            </ListSection>
          </div>
        </Sheet>
      ) : null}

      {selected ? (
        <Sheet open={priorityOpen} onOpenChange={setPriorityOpen} title={t("setPriority")} closeLabel={tc("close")}>
          <ListSection radioGroupLabel={t("reason")}>
            {PRIORITY_REASONS.map((r: PriorityReason) => (
              <ListRow
                key={r}
                onClick={() => {
                  setPriorityOpen(false);
                  void command("set_ticket_priority", { p_ticket: selected.id, p_reason: r });
                }}
                title={tr(r)}
              />
            ))}
          </ListSection>
        </Sheet>
      ) : null}

      {selected ? (
        <TransferSheet
          code={selected.code}
          services={data.services.filter((s) => s.id !== selected.serviceId)}
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
          practitioner={{ id: absenceFor.id, name: absenceFor.name }}
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
  );
}
