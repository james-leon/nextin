"use client";

import { useNow } from "@/lib/desk/now";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, ArrowRight, ChevronLeft, CloudOff, Eye, EyeOff, Keyboard, Maximize2, Minimize2, RefreshCw, UserRoundX } from "lucide-react";
import { formatElapsed } from "@nextin/shared";
import type { PriorityReason } from "@nextin/shared/queue/live";
import { identityLine, type IdentityRules } from "@nextin/shared/identity";
import { useNameMask } from "@/lib/desk/name-mask";
import {
  averageServiceSeconds,
  DESK_SHORTCUTS,
  deskShortcut,
  primaryAction,
  shortcutTargetAllowed,
  type DeskCommand,
  type DeskSnapshot,
  type DeskTicket,
} from "@nextin/shared/desk";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NowServingCard } from "@/components/ui/now-serving-card";
import { Sheet, SheetAction } from "@/components/ui/sheet";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { PractitionerAppointments } from "@/components/appointments/practitioner-appointments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AbsenceSheet, type ActiveAbsence } from "./absence-sheet";
import { TicketMenu } from "./ticket-menu";
import { TransferSheet, type BranchService } from "./transfer-sheet";
import { setDeskCompact, useDeskCompact } from "@/lib/desk/compact";
import { useDesk, type DeskCounter } from "./use-desk";

const MAX_ROWS = 6;

/**
 * Poste agent / cabinet (maquette 04) : appel en deux temps, un seul bouton principal qui change de rôle.
 * Tablette et ordinateur : deux colonnes (patient en cours et bouton principal ; à suivre, statistiques, actions) et raccourcis
 * clavier (aide « ? »). Mode compact mémorisé sur l'appareil : numéro, chrono, bouton principal, nombre en attente.
 */
export function AgentDesk({
  counter,
  title,
  eyebrow,
  subtitle,
  initial,
  services,
  practitioner,
  absence,
  identityRules = { mode: "off", extra: "none" },
}: {
  counter: DeskCounter;
  /** Nom du client demandé par l'agence : affiché au personnel, masquable (l'écran peut être vu du public). */
  identityRules?: IdentityRules;
  title: string;
  /** Sur-titre (maquette v2 20) : agence · praticien attitré. */
  eyebrow?: string;
  subtitle: string;
  initial: DeskSnapshot;
  /** Services de l'agence (réorientation). */
  services: BranchService[];
  practitioner: { id: string; name: string } | null;
  absence: ActiveAbsence;
}) {
  const t = useTranslations("desk");
  const ta = useTranslations("absence");
  const te = useTranslations("errors");
  const tr = useTranslations("priorityReasons");
  const tc = useTranslations("common");
  const ti = useTranslations("identity");
  const nameMask = useNameMask();
  const namesOn = identityRules.mode !== "off";
  // Nom (et âge ou numéro de dossier) du client, ou « Nom masqué » ; rien si l'agence ne demande pas le nom.
  const nameOf = (tk: DeskTicket) => {
    if (!namesOn || !tk.identity) return null;
    if (nameMask.hidden) return ti("hidden");
    return identityLine(tk.identity, { age: (age) => ti("ageValue", { age }), file: (value) => ti("fileValue", { value }) });
  };
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const { view, pending, online, busy, notices, perform, setStatus, dismiss, refresh } = useDesk(counter, initial);
  const [transferOpen, setTransferOpen] = useState(false);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmAbsent, setConfirmAbsent] = useState(false);
  const compact = useDeskCompact();

  // Chrono du client en cours : heure du navigateur seulement (jamais celle du serveur : hydratation identique).
  const now = useNow(1000, !!view.current);

  const current = view.current;
  const action = primaryAction(view);
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: counter.timeZone }).format(new Date(iso));
  const since = (iso: string | null) => (iso && now !== null ? Math.max(0, (now - new Date(iso).getTime()) / 1000) : 0);
  const avg = averageServiceSeconds(view);
  const statusTone = view.counterStatus === "open" ? "green" : view.counterStatus === "paused" ? "orange" : "neutral";
  const offlineOnly = () => toast(t("onlineOnly"), <CloudOff aria-hidden />);

  // Priorité accordée par le personnel (en ligne uniquement, journalisée par la base).
  async function grantPriority(ticketId: string, reason: PriorityReason) {
    if (!online) return offlineOnly();
    const { error } = await getSupabaseBrowserClient().rpc("set_ticket_priority", { p_ticket: ticketId, p_reason: reason });
    if (error) toast(te.has(error.message as never) ? te(error.message as never) : te("generic"));
    else toast(t("priorityGranted"));
    await refresh();
  }

  const primary = {
    open: { label: t("openCounter"), run: () => setStatus("open") },
    resume: { label: t("resume"), run: () => setStatus("open") },
    alert: { label: t("alertNext"), run: () => perform("call") },
    admit: { label: t("admit"), run: () => perform("admit", { ticketId: current?.id, code: current?.code }) },
    finish_and_alert: {
      label: view.waiting.length ? t("finishAndAlert") : t("finish"),
      run: () =>
        view.waiting.length
          ? perform("call", { finishCurrent: true })
          : perform("finish", { ticketId: current?.id, code: current?.code }),
    },
    none: { label: t("nobody"), run: () => undefined },
  }[action];

  // Raccourcis : mêmes commandes que les boutons (hors ligne compris).
  const runCommand = (command: DeskCommand) => {
    if (command === "help") return setHelpOpen(true);
    if (busy) return;
    if (command === "primary") return primary.run();
    if (!current && command !== "pause" && command !== "resume") return;
    if (command === "admit") return perform("admit", { ticketId: current!.id, code: current!.code });
    if (command === "recall") return perform("recall", { ticketId: current!.id, code: current!.code });
    if (command === "transfer") return setTransferOpen(true);
    if (command === "absent") return setConfirmAbsent(true);
    if (command === "pause") return online ? setStatus("paused") : offlineOnly();
    if (command === "resume") return online ? setStatus("open") : offlineOnly();
  };
  const latest = useRef({ view, runCommand });
  useEffect(() => {
    latest.current = { view, runCommand };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dialogOpen = !!document.querySelector("[role=dialog], [role=alertdialog]");
      if (!shortcutTargetAllowed(e.target as HTMLElement | null, dialogOpen, e.key)) return;
      const command = deskShortcut(e, latest.current.view);
      if (!command) return;
      e.preventDefault();
      latest.current.runCommand(command);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Rang dans la file (1 = prochain), numéro, nom, origine et badges.
  const row = (tk: DeskTicket, rank: number) => (
    <ListRow
      key={tk.id}
      icon={
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill-tertiary text-footnote font-semibold text-label tabular">
          {rank}
        </span>
      }
      title={
        <span className="flex items-baseline gap-4">
          <span className="w-20 shrink-0 font-rounded text-title3 font-bold text-ticket-number">{tk.code}</span>
          <span className="truncate text-label-secondary">
            {t(`source.${tk.source}`)} · {time(tk.createdAt)}
          </span>
        </span>
      }
      accessory={
        tk.priorityReason || tk.preferredCounterId === counter.id ? (
          <span className="flex shrink-0 gap-1.5">
            {tk.priorityReason ? <Badge tone="orange">{tk.priorityReason === "appointment" ? "RDV" : tr(tk.priorityReason)}</Badge> : null}
            {tk.preferredCounterId === counter.id ? <Badge tone="accent">{t("forYou")}</Badge> : null}
          </span>
        ) : undefined
      }
      subtitle={nameOf(tk) ?? undefined}
      trailing={
        <TicketMenu
          ticket={tk}
          rules={identityRules}
          canPrioritize={online}
          onGrantPriority={(r) => void grantPriority(tk.id, r)}
          onIdentitySaved={() => void refresh()}
        />
      }
    />
  );

  // Le bouton principal montre son raccourci (« Espace ») sur ordinateur, où le clavier sert (maquette v2 20).
  const primaryButton = (
    <Button
      block
      onClick={primary.run}
      loading={busy}
      disabled={action === "none"}
      aria-keyshortcuts={action === "none" ? undefined : "Space"}
      trailingIcon={
        action === "none" ? undefined : (
          <kbd aria-hidden className="hidden rounded-[6px] bg-black/25 px-1.5 py-0.5 font-sans text-footnote font-semibold lg:inline">
            {t("shortcuts.space")}
          </kbd>
        )
      }
    >
      {primary.label}
    </Button>
  );
  const statusBadge = (
    <Badge shape="pill" tone={statusTone} role="status">
      <span aria-hidden className={view.counterStatus === "open" ? "size-2 rounded-full bg-green" : "size-2 rounded-full bg-current"} />
      {t(`status.${view.counterStatus}`)}
    </Badge>
  );
  const sheets = (
    <>
      {current ? (
        <TransferSheet
          code={current.code}
          services={services.filter((s) => s.id !== current.serviceId)}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          onConfirm={(serviceId) => perform("transfer", { ticketId: current.id, code: current.code, targetServiceId: serviceId })}
        />
      ) : null}
      {current && confirmAbsent ? (
        <AlertDialog
          open
          onOpenChange={setConfirmAbsent}
          title={t("absentTitle", { code: current.code })}
          description={t("absentBody")}
          cancelLabel={tc("cancel")}
          actionLabel={t("absent")}
          destructive
          onAction={() => perform("no_show", { ticketId: current.id, code: current.code })}
        />
      ) : null}
      <Sheet
        open={helpOpen}
        onOpenChange={setHelpOpen}
        title={t("shortcuts.title")}
        description={t("shortcuts.hint")}
        closeLabel={tc("close")}
        action={<SheetAction onClick={() => setHelpOpen(false)}>{tc("done")}</SheetAction>}
      >
        <ListSection footer={t("shortcuts.hint")}>
          {DESK_SHORTCUTS.map((sc) => (
            <ListRow
              key={sc.key}
              icon={
                <kbd className="min-w-7 rounded-[6px] bg-fill-tertiary px-1.5 py-0.5 text-center font-sans text-footnote font-semibold text-label" style={{ boxShadow: "inset 0 -1px 0 var(--separator)" }}>
                  {sc.key === "space" ? t("shortcuts.space") : sc.key === "enter" ? t("shortcuts.enter") : sc.key.toUpperCase()}
                </kbd>
              }
              title={t(`shortcuts.${sc.command as Exclude<DeskCommand, "resume">}`)}
            />
          ))}
        </ListSection>
      </Sheet>
      {practitioner ? (
        <AbsenceSheet
          practitioner={practitioner}
          active={absence}
          open={absenceOpen}
          onOpenChange={setAbsenceOpen}
          onDone={(message) => {
            toast(message, <UserRoundX aria-hidden />);
            router.refresh();
            void refresh();
          }}
        />
      ) : null}
    </>
  );

  // Mode compact (maquette v2 20) : petite fenêtre à côté du logiciel médical — état et chrono, numéro, à suivre,
  // bouton principal, puis Rappeler / Transférer / Absent en liens. « Quitter le mode compact » en haut.
  if (compact) {
    const upNext = view.waiting.slice(0, 2).map((w) => w.code);
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          {statusBadge}
          <IconButton label={t("exitCompact")} icon={<Maximize2 />} variant="plain" onClick={() => setDeskCompact(false)} />
        </div>
        <section aria-live="polite" className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-footnote uppercase text-label-secondary">
              {current ? (current.status === "called" ? t("alerted") : t("compactCurrent")) : title}
            </p>
            {current ? (
              <p className="font-rounded text-subheadline text-label-secondary tabular">
                <span className="sr-only">{current.status === "serving" ? t("elapsed") : t("sinceAlert")} : </span>
                {formatElapsed(since(current.status === "serving" ? current.servingStartedAt : current.calledAt))}
              </p>
            ) : null}
          </div>
          <p className="font-rounded text-large-title font-extrabold whitespace-nowrap text-ticket-number">{current ? current.code : "—"}</p>
          {current && nameOf(current) ? <p className="truncate text-subheadline">{nameOf(current)}</p> : null}
          <p className="text-footnote text-label-secondary">
            {upNext.length ? `${t("compactNext", { codes: upNext.join(" · ") })} · ` : ""}
            {t("waitingCount", { count: view.waiting.length })}
          </p>
        </section>
        {!online ? (
          <p role="status" className="flex items-center gap-1.5 text-footnote font-semibold text-orange-text">
            <CloudOff aria-hidden className="size-4" />
            {t("offline")}
            {pending.length ? ` · ${t("pending", { count: pending.length })}` : null}
          </p>
        ) : null}
        {primaryButton}
        {current ? (
          <div className="flex items-center justify-between gap-2">
            {current.status === "called" ? (
              <Button variant="plain" size="md" className="px-0" onClick={() => perform("recall", { ticketId: current.id, code: current.code })}>
                {t("recall")}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="plain" size="md" className="px-0" onClick={() => setTransferOpen(true)}>
              {t("transfer")}
            </Button>
            {current.status === "called" ? (
              <Button variant="destructive-plain" size="md" className="px-0" onClick={() => setConfirmAbsent(true)}>
                {t("absent")}
              </Button>
            ) : (
              <span />
            )}
          </div>
        ) : null}
        {sheets}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-40 md:max-w-7xl md:px-8 md:pb-12 lg:px-10">
      <div className="flex h-11 items-center justify-between gap-2">
        <Button asChild variant="plain" size="md" className="-ml-3 px-3">
          <Link href="/desk">
            <ChevronLeft aria-hidden className="size-5 stroke-[2.25]" />
            {t("title")}
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <IconButton label={t("shortcuts.title")} icon={<Keyboard />} variant="plain" className="hidden lg:inline-flex" onClick={() => setHelpOpen(true)} />
          <IconButton label={t("compact")} icon={<Minimize2 />} variant="plain" onClick={() => setDeskCompact(true)} />
          {view.counterStatus === "open" ? (
            <Button variant="plain" size="md" disabled={!!current || busy} onClick={() => (online ? setStatus("paused") : offlineOnly())}>
              {t("pause")}
            </Button>
          ) : view.counterStatus === "paused" ? (
            <Button variant="plain" size="md" disabled={busy} onClick={() => (online ? setStatus("open") : offlineOnly())}>
              {t("resume")}
            </Button>
          ) : null}
        </div>
      </div>

      <header className="pt-3 pb-5">
        {eyebrow ? <p className="text-footnote uppercase text-label-secondary">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h1 className="text-large-title font-bold [text-wrap:balance]">{title}</h1>
          {statusBadge}
        </div>
        <p className="mt-1 text-subheadline text-label-secondary">{subtitle}</p>
      </header>

      <div className="flex flex-col gap-5 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-5">
          {!online || pending.length ? (
            // Maquette v2 20 : bandeau orange qui compte les actions en attente ; rien n'est bloqué.
            <CalloutCard icon={online ? <RefreshCw /> : <CloudOff />} tone={online ? "accent" : "orange"} role="status">
              <strong className={online ? "font-semibold" : "font-semibold text-orange-text"}>
                {online ? t("syncing") : t("offline")}
                {pending.length ? ` · ${t("pending", { count: pending.length })}` : null}
              </strong>
              {!online ? <span className="block text-subheadline text-label-secondary">{t("offlineHint")}</span> : null}
            </CalloutCard>
          ) : null}

          {notices.map((n, i) => (
            <CalloutCard key={i} icon={<AlertTriangle />} tone="orange" role="alert">
              {n.kind === "conflict"
                ? n.called
                  ? t("conflict", { requested: n.requested, called: n.called })
                  : t("conflictEmpty", { requested: n.requested })
                : n.kind === "ignored"
                  ? t("ignored", { action: t(n.action === "call" ? "alertNext" : n.action === "no_show" ? "absent" : n.action), code: n.code })
                  : te.has(n.code as never)
                    ? te(n.code as never)
                    : te("generic")}{" "}
              <button type="button" className="font-semibold text-accent-text" onClick={() => dismiss(i)}>
                OK
              </button>
            </CalloutCard>
          ))}

          {view.counterStatus === "closed" ? (
            <CalloutCard icon={<ArrowRight />} tone="accent">
              {t("counterClosedHint")}
            </CalloutCard>
          ) : view.counterStatus === "paused" ? (
            <CalloutCard icon={<ArrowRight />}>{t("pausedHint")}</CalloutCard>
          ) : null}

          {current ? (
            <div aria-live="polite">
              <NowServingCard
                label={current.status === "called" ? t("alerted") : t("current")}
                code={current.code}
                elapsedSeconds={since(current.status === "serving" ? current.servingStartedAt : current.calledAt)}
                elapsedLabel={current.status === "serving" ? t("elapsed") : t("sinceAlert")}
                subtitle={nameOf(current)}
                actions={
                  current.status === "called"
                    ? [
                        { label: t("recall"), onClick: () => perform("recall", { ticketId: current.id, code: current.code }) },
                        { label: t("transfer"), onClick: () => setTransferOpen(true) },
                        { label: t("absent"), onClick: () => setConfirmAbsent(true), destructive: true },
                      ]
                    : [
                        { label: t("transfer"), onClick: () => setTransferOpen(true) },
                        { label: t("finish"), onClick: () => perform("finish", { ticketId: current.id, code: current.code }) },
                      ]
                }
              />
              {current.recallCount > 0 ? (
                <p className="px-4 pt-2 text-subheadline text-label-secondary">{t("recalled", { count: current.recallCount })}</p>
              ) : null}
            </div>
          ) : null}

          {/* Ordinateur : bouton principal sous le patient en cours (la barre du bas reste pour le téléphone). */}
          <div className="hidden md:block">{primaryButton}</div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {namesOn ? (
            <Button
              variant="gray"
              size="md"
              className="self-end"
              leadingIcon={nameMask.hidden ? <Eye aria-hidden className="size-5" /> : <EyeOff aria-hidden className="size-5" />}
              onClick={nameMask.toggle}
              aria-pressed={nameMask.hidden}
            >
              {nameMask.hidden ? ti("show") : ti("hide")}
            </Button>
          ) : null}
          <ListSection
            header={t("nextHeader", { count: view.waiting.length })}
            footer={view.waiting.length > MAX_ROWS ? t("more", { count: view.waiting.length - MAX_ROWS }) : undefined}
          >
            {view.waiting.length ? view.waiting.slice(0, MAX_ROWS).map((tk, i) => row(tk, i + 1)) : <ListRow title={<span className="text-label-secondary">{t("nobody")}</span>} />}
          </ListSection>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t("served")} value={String(view.servedToday)} />
            <StatCard label={t("avgDuration")} value={avg ? t("minutes", { count: Math.max(1, Math.round(avg / 60)) }) : "—"} />
          </div>

          <ListSection>
            {practitioner ? <PractitionerAppointments branchId={counter.branchId} practitionerId={practitioner.id} timeZone={counter.timeZone} /> : null}
            {practitioner ? (
              <ListRow
                onClick={() => (online ? setAbsenceOpen(true) : offlineOnly())}
                icon={
                  <ListIcon color="var(--orange-fill)">
                    <UserRoundX />
                  </ListIcon>
                }
                title={t("absence")}
                detail={absence ? (absence.kind === "late" && absence.until ? ta("activeLate", { time: time(absence.until) }) : ta("activeAbsent")) : undefined}
                accessory="chevron"
              />
            ) : null}
            {view.counterStatus !== "closed" && !current ? (
              <ListRow onClick={() => (online ? setStatus("closed") : offlineOnly())} title={t("closeCounter")} destructive />
            ) : null}
            <ListRow href="/desk" title={t("switch")} accessory="chevron" />
          </ListSection>
        </div>
      </div>

      <BottomBar dock={false} className="md:hidden">
        {primaryButton}
      </BottomBar>
      {sheets}
    </main>
  );
}
