import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { absoluteUrl, spellTicketCode } from "@nextin/shared";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { PrintTrigger } from "@/components/desk/print-trigger";
import { requireStaffSession } from "@/lib/auth/session";
import { qrMatrix } from "@/lib/qr/matrix";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ ticketId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reception");
  return { title: t("print"), robots: { index: false } };
}

/**
 * Ticket thermique 80 mm (ou 58 mm) : établissement, service, numéro en grand, position, attente,
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
  const tr = await getTranslations("reception");
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
      <style>{`@page { size: ${width}mm auto; margin: 0 } @media print { html, body { background: #fff } }`}</style>
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
        className="flex flex-col items-center gap-[2mm] bg-white px-[3mm] py-[4mm] text-center text-black shadow-card print:shadow-none"
        style={{ width: `${width}mm` }}
      >
        <p className="text-[11pt] font-bold uppercase">{branch.organization?.name}</p>
        <p className="text-[9pt]">{branch.name}</p>
        <p className="mt-[2mm] text-[10pt] font-semibold uppercase">{service?.name}</p>
        <p className={width === "58" ? "text-[34pt] leading-none font-extrabold" : "text-[44pt] leading-none font-extrabold"}>
          <span aria-hidden>{ticket.display_code}</span>
          <span className="sr-only">{spellTicketCode(ticket.display_code)}</span>
        </p>
        {position?.position ? (
          <p className="text-[10pt]">
            {t("ahead", { count: position.position - 1 })}
            {position.wait_seconds ? ` · ${t("wait", { minutes: waitMinutes(position.wait_seconds) })}` : ""}
          </p>
        ) : null}
        {qr ? (
          <>
            <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={t("track")} className="mt-[2mm] w-[38mm]" shapeRendering="crispEdges">
              <rect width={qr.size} height={qr.size} fill="#fff" />
              <path d={qr.path} fill="#000" />
            </svg>
            <p className="text-[8.5pt] leading-tight">{t("track")}</p>
          </>
        ) : null}
        <p className="mt-[2mm] text-[8.5pt] leading-tight">{t("keep")}</p>
        <p className="text-[8pt]">{t("takenAt", { date, time })}</p>
        <p className="text-[7pt]">NextIn · {tr("title")}</p>
      </article>
    </main>
  );
}
