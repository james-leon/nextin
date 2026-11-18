"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Check } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

export type AutoSaveState = {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
  /** Dernière réponse de l'action (erreurs par champ comprises), pour `useFormErrors`. */
  result: ActionResult | null;
};

/** Délai après le dernier changement avant l'enregistrement (les « + » successifs partent en une fois). */
const DELAY_MS = 600;

/** Instantané comparable du formulaire (champs cachés compris). */
function snapshot(form: HTMLFormElement): string {
  return new URLSearchParams(Array.from(new FormData(form), ([k, v]) => [k, typeof v === "string" ? v : v.name])).toString();
}

/**
 * Enregistrement automatique d'un formulaire de réglages (maquette v2 07, comme Réglages sur iPhone) : après chaque
 * rendu, l'état du formulaire est comparé au dernier envoyé ; s'il a changé, il part 600 ms après le dernier
 * changement. Les envois ne se chevauchent pas : un changement fait pendant un envoi repart juste après.
 */
export function useAutoSave(
  form: RefObject<HTMLFormElement | null>,
  action: (prev: ActionResult | null, data: FormData) => Promise<ActionResult>,
  enabled = true,
): AutoSaveState {
  const [state, setState] = useState<AutoSaveState>({ status: "idle", error: null, result: null });
  const sent = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const busy = useRef(false);
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  // Compare l'état du formulaire au dernier envoyé et programme l'envoi (après un rendu ou une saisie au clavier).
  const check = useRef(() => {});
  useEffect(() => {
    check.current = () => {
      const el = form.current;
      if (!el || !enabled) return;
      if (sent.current === null) {
        sent.current = snapshot(el);
        return;
      }
      if (snapshot(el) === sent.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      const run = async () => {
        if (!form.current) return;
        if (busy.current) {
          timer.current = window.setTimeout(run, DELAY_MS);
          return;
        }
        const data = new FormData(form.current);
        const next = snapshot(form.current);
        busy.current = true;
        setState((prev) => ({ status: "saving", error: null, result: prev.result }));
        try {
          const result = await actionRef.current(null, data);
          sent.current = next;
          setState(result.ok ? { status: "saved", error: null, result } : { status: "error", error: result.error, result });
        } catch {
          setState({ status: "error", error: "generic", result: null });
        } finally {
          busy.current = false;
        }
      };
      timer.current = window.setTimeout(run, DELAY_MS);
    };
  }, [form, enabled]);

  // Après chaque rendu (champs contrôlés, cases, interrupteurs) …
  useEffect(() => {
    check.current();
  });
  // … à chaque saisie dans un champ non contrôlé, et à chaque changement d'un champ caché.
  useEffect(() => {
    const el = form.current;
    if (!el || !enabled) return;
    const onInput = () => check.current();
    el.addEventListener("input", onInput);
    el.addEventListener("change", onInput);
    // Champs cachés tenus par des sous-composants (interrupteurs, cases) : valeur modifiée, ajoutés ou retirés.
    const observer = new MutationObserver(onInput);
    observer.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["value"] });
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("change", onInput);
      observer.disconnect();
    };
  }, [form, enabled]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );
  return state;
}

/** « Enregistré automatiquement » (coche verte), « Enregistrement… » ou la raison d'un refus, annoncés poliment. */
export function AutoSaveStatus({ state, className }: { state: AutoSaveState; className?: string }) {
  const t = useTranslations("admin");
  const te = useTranslations("errors");
  return (
    <p role="status" aria-live="polite" className={cn("flex min-h-6 items-center justify-end gap-1.5 text-footnote", className)}>
      {state.status === "saving" ? (
        <>
          <span aria-hidden className="inline-flex"><Spinner className="size-3.5" /></span>
          <span className="text-label-secondary">{t("saving")}</span>
        </>
      ) : state.status === "saved" ? (
        <>
          <Check aria-hidden className="size-4 stroke-[2.25] text-green-text" />
          <span className="text-green-text">{t("autoSaved")}</span>
        </>
      ) : state.status === "error" ? (
        <>
          <AlertCircle aria-hidden className="size-4 text-red-text" />
          <span className="text-red-text">{te((state.error ?? "generic") as never)}</span>
        </>
      ) : (
        <span className="text-label-secondary">{t("autoSaveHint")}</span>
      )}
    </p>
  );
}
