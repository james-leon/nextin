"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { formatElapsed } from "@nextin/shared";
import { boardTopic, REALTIME_EVENTS } from "@nextin/shared/queue/realtime";
import { testDeskCommand } from "@/app/(staff)/app/o/[orgId]/_actions/test-desk";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { subscribeBroadcast } from "@/lib/client/realtime";
import type { ActionResult } from "@/lib/auth/errors";

export type TestDeskTicket = { id: string; code: string; status: "called" | "serving"; servingStartedAt: string | null };

/**
 * Poste de test temporaire : « Alerter le suivant » puis « Admettre » (chrono à l'admission),
 * terminer, rappeler, absent. Se met à jour en direct (tableau de l'agence).
 */
export function TestDesk({
  path,
  branchId,
  counterId,
  counterOpen,
  current,
  waiting,
}: {
  path: string;
  branchId: string;
  counterId: string;
  counterOpen: boolean;
  current: TestDeskTicket | null;
  waiting: string[];
}) {
  const t = useTranslations("testDesk");
  const te = useTranslations("errors");
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(testDeskCommand.bind(null, path), null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribeBroadcast(boardTopic(branchId), REALTIME_EVENTS.board, () => router.refresh()), [branchId, router]);
  useEffect(() => {
    if (current?.status !== "serving") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [current?.status]);

  const elapsed = current?.servingStartedAt ? Math.max(0, (now - new Date(current.servingStartedAt).getTime()) / 1000) : 0;
  const ticketButton = (command: string, label: string) => (
    <button
      type="submit"
      name="command"
      value={command}
      disabled={pending}
      className="pressable h-11 w-full truncate rounded-[12px] bg-on-navy-control px-2 text-callout font-semibold text-white disabled:opacity-60"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      {state && !state.ok ? (
        <p role="alert" className="px-4 text-subheadline text-red-text">
          {te(state.error)}
        </p>
      ) : null}

      <section className="squircle rounded-[var(--radius-xl)] bg-navy p-5 text-white" aria-live="polite">
        <p className="text-footnote font-semibold tracking-[0.08em] text-white/80 uppercase">{t("current")}</p>
        {current ? (
          <>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-display font-extrabold whitespace-nowrap">{current.code}</p>
              <p className="pb-1 text-title3 font-semibold text-white tabular">
                {current.status === "serving" ? `${t("serving")} · ${formatElapsed(elapsed)}` : t("called")}
              </p>
            </div>
            <form action={action} className="mt-4 grid grid-cols-2 gap-2">
              <input type="hidden" name="ticketId" value={current.id} />
              {current.status === "called" ? (
                <>
                  {ticketButton("recall", t("recall"))}
                  {ticketButton("no_show", t("noShow"))}
                </>
              ) : (
                <div className="col-span-2">{ticketButton("finish", t("finish"))}</div>
              )}
            </form>
          </>
        ) : (
          <p className="mt-2 text-title3 text-white/80">{t("none")}</p>
        )}
      </section>

      <ListSection header={t("waiting", { count: waiting.length })} footer={waiting.length ? undefined : t("queueEmpty")}>
        {waiting.slice(0, 8).map((code) => (
          <ListRow key={code} title={<span className="font-semibold">{code}</span>} />
        ))}
      </ListSection>

      <form action={action}>
        <input type="hidden" name="counterId" value={counterId} />
        <Button type="submit" name="command" value={counterOpen ? "close" : "open"} variant="gray" block disabled={pending || !!current}>
          {counterOpen ? t("closeCounter") : t("openCounter")}
        </Button>
      </form>

      <BottomBar>
        {current?.status === "called" ? (
          <form action={action}>
            <input type="hidden" name="ticketId" value={current.id} />
            <Button type="submit" name="command" value="admit" block loading={pending}>
              {t("admit")}
            </Button>
          </form>
        ) : (
          <form action={action}>
            <input type="hidden" name="counterId" value={counterId} />
            <Button
              type="submit"
              name="command"
              value="next"
              block
              loading={pending}
              disabled={!counterOpen || current?.status === "serving"}
              trailingIcon={<ArrowRight aria-hidden className="size-5 stroke-[2.25]" />}
            >
              {t("alertNext")}
            </Button>
          </form>
        )}
      </BottomBar>
    </div>
  );
}
