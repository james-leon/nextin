import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { absoluteUrl, spellTicketCode } from "@nextin/shared";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { PrintTrigger } from "@/components/desk/print-trigger";
import { Logo } from "@/components/ui/logo";
import { requireStaffSession } from "@/lib/auth/session";
import { qrMatrix } from "@/lib/qr/matrix";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ ticketId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reception");
  return { title: t("print"), robots: { index: false } };
}

/**
 * Ticket thermique 80 mm (ou 58 mm, mêmes éléments, QR plus petit) — maquette v2 20 : établissement, service, numéro en grand, position, attente,
 * QR code du lien de suivi /t/<jeton>. Noir sur blanc quel que soit le thème. Aucune donnée personnelle.
 */
export default async function PrintTicketPage({ params, searchParams }: Props) {
  const { ticketId } = await params;
  const { w } = await searchParams;
  await requireStaffSession(`/desk/print/${ticketId}`);
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) notFound();
  const supabase = await getSupabaseServerClient();
  const { data: ticket } = await supabase
    .from("tickets")
    .select("id, display_code, public_token, created_at, service:services(name), branch:branches(name, timezone, organization:organizations(name))")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) notFound();
  const t = await getTranslations("print");
  const locale = await getLocale();
  const branch = ticket.branch as { name: string; timezone: string; organization: { name: string } | null };
  const service = ticket.service as { name: string } | null;
  const { data: view } = ticket.public_token ? await supabase.rpc("get_ticket", { p_token: ticket.public_token }) : { data: null };
  const position = (view as { position: number | null; wait_seconds: number | null } | null) ?? null;
  const width = w === "58" ? "58" : "80";
  const url = ticket.public_token ? absoluteUrl(`/t/${ticket.public_token}`) : null;
  const qr = url ? qrMatrix(url, 2) : null;
  const created = new Date(ticket.created_at);
  const date = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: branch.timezone }).format(created);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: branch.timezone }).format(created);

  return (
    <main data-theme="light" className="flex min-h-dvh flex-col items-center gap-6 bg-grouped py-8 print:block print:bg-white print:py-0">
      {/* Mise en page du ticket en millimètres : propre à cette page (rien dans la feuille de style commune). */}
      <style>{`@page { size: ${width}mm auto; margin: 0 } @media print { html, body { background: #fff } }
.tk { padding: 4mm 3mm } .tk hr { margin: 2mm 0; border: 0; border-top: 1px dashed #000 }
.tk .m { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8pt; line-height: 1.35 }
.tk .n { margin: 1mm 0; font-size: ${width === "58" ? 34 : 44}pt; line-height: 1; font-weight: 800 }
.tk .q { width: ${width === "58" ? 26 : 32}mm; margin: 0 auto } .tk .l { height: 6mm; margin: 2mm auto 0 }`}</style>
      <PrintTrigger
        label={t("print")}
        base={`/desk/print/${ticket.id}`}
        current={width}
        widths={[
          { value: "80", label: "80 mm" },
          { value: "58", label: "58 mm" },
        ]}
      />
      <article
        aria-label={t("title", { code: ticket.display_code })}
        className="tk flex flex-col items-stretch bg-white text-center text-black shadow-card print:shadow-none"
        style={{ width: `${width}mm` }}
      >
        {/* Maquette v2 20 : noir sur blanc pour l'imprimante thermique, sections séparées par des pointillés,
            informations en chasse fixe (lisibles de loin), aucun nom de patient. */}
        <p className="text-[11pt] leading-tight font-bold uppercase">{branch.organization?.name}</p>
        <p className="m">{branch.name}</p>
        <hr />
        <p className="text-[10pt] font-semibold">{service?.name}</p>
        <p className="n">
          <span aria-hidden>{ticket.display_code}</span>
          <span className="sr-only">{spellTicketCode(ticket.display_code)}</span>
        </p>
        {position?.position ? (
          <div className="m">
            <p>{t("ahead", { count: position.position - 1 })}</p>
            {position.wait_seconds ? <p>{t("wait", { minutes: waitMinutes(position.wait_seconds) })}</p> : null}
          </div>
        ) : null}
        {qr ? (
          <>
            <hr />
            <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={t("track")} className="q" shapeRendering="crispEdges">
              <rect width={qr.size} height={qr.size} fill="#fff" />
              <path d={qr.path} fill="#000" />
            </svg>
            <p className="m" style={{ marginTop: "1.5mm" }}>{t("track")}</p>
          </>
        ) : null}
        <hr />
        <p className="m">{t("keep")}</p>
        <p className="m" style={{ marginTop: "1.5mm" }}>{t("takenAt", { date, time })}</p>
        {/* Logo horizontal, version claire (le ticket est toujours en clair). */}
        <Logo className="l" />
      </article>
    </main>
  );
}
