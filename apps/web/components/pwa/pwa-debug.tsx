"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";

export type PwaDebugLabels = Record<
  | "title" | "intro" | "swSection" | "state" | "active" | "installing" | "none" | "unsupported" | "disabled" | "version"
  | "unknown" | "appSection" | "standalone" | "yes" | "no" | "cachesSection" | "noCaches" | "entriesOne" | "entriesOther"
  | "errorSection" | "noError" | "reset" | "resetting" | "resetHint",
  string
>;

type LastError = { at: number; kind: string; message: string; path?: string };
type Report = {
  sw: "unsupported" | "none" | "installing" | "active";
  version: string | null;
  standalone: boolean;
  caches: { name: string; entries: number }[];
  lastError: LastError | null;
};

/** Version du service worker actif (il répond au message « version » ; une seconde au plus). */
function askVersion(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), 1000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(typeof event.data === "string" ? event.data : null);
    };
    worker.postMessage("version", [channel.port2]);
  });
}

async function collect(): Promise<Report> {
  const standalone = !!((navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia("(display-mode: standalone)").matches);
  let lastError: LastError | null = null;
  try {
    const raw = localStorage.getItem("nextin-last-error");
    lastError = raw ? (JSON.parse(raw) as LastError) : null;
  } catch {
    lastError = null;
  }
  const list: Report["caches"] = [];
  if (typeof caches !== "undefined") {
    for (const name of await caches.keys()) list.push({ name, entries: (await (await caches.open(name)).keys()).length });
  }
  if (!("serviceWorker" in navigator)) return { sw: "unsupported", version: null, standalone, caches: list, lastError };
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.active ?? null;
  const sw = worker ? "active" : registration?.installing || registration?.waiting ? "installing" : "none";
  return { sw, version: worker ? await askVersion(worker) : null, standalone, caches: list, lastError };
}

export function PwaDebug({ labels: l, locale, enabled }: { labels: PwaDebugLabels; locale: string; enabled: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let alive = true;
    void collect().then((r) => alive && setReport(r));
    return () => {
      alive = false;
    };
  }, []);

  async function reset() {
    setResetting(true);
    try {
      if ("serviceWorker" in navigator) {
        await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
      }
      if (typeof caches !== "undefined") await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
      localStorage.removeItem("nextin-last-error");
    } catch {
      // Réinitialisation au mieux : la page est rechargée dans tous les cas.
    }
    window.location.reload();
  }

  const swLabel = !report ? "…" : !enabled && report.sw === "none" ? l.disabled : l[report.sw];
  const when = (at: number) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Douala" }).format(at);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[40rem] flex-col gap-6 px-4 pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <header className="flex flex-col gap-2 px-1">
        <h1 className="text-large-title font-bold text-balance">{l.title}</h1>
        <p className="text-subheadline text-label-secondary">{l.intro}</p>
      </header>

      <ListSection header={l.swSection}>
        <ListRow title={l.state} detail={swLabel} />
        <ListRow title={l.version} detail={report ? (report.version ?? l.unknown) : "…"} />
      </ListSection>

      <ListSection header={l.appSection}>
        <ListRow title={l.standalone} detail={report ? (report.standalone ? l.yes : l.no) : "…"} />
      </ListSection>

      <ListSection header={l.cachesSection}>
        {report && report.caches.length === 0 ? <ListRow title={l.noCaches} /> : null}
        {report?.caches.map((c) => (
          <ListRow key={c.name} title={<span className="font-mono text-subheadline">{c.name}</span>} detail={(c.entries === 1 ? l.entriesOne : l.entriesOther).replace("#", String(c.entries))} />
        ))}
      </ListSection>

      <ListSection header={l.errorSection}>
        {report?.lastError ? (
          <ListRow
            title={<span className="break-words">{report.lastError.message || report.lastError.kind}</span>}
            subtitle={[when(report.lastError.at), report.lastError.path].filter(Boolean).join(" · ")}
          />
        ) : (
          <ListRow title={report ? l.noError : "…"} />
        )}
      </ListSection>

      <div className="flex flex-col gap-2">
        <Button block variant="filled" onClick={reset} loading={resetting} loadingLabel={l.resetting} leadingIcon={<RotateCcw aria-hidden />}>
          {l.reset}
        </Button>
        <p className="px-1 text-footnote text-label-secondary">{l.resetHint}</p>
      </div>
    </main>
  );
}
