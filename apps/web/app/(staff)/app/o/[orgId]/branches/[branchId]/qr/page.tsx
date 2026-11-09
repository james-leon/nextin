import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Download, FileText, RefreshCw } from "lucide-react";
import { qrEntryUrl } from "@nextin/shared";
import { ActionButton } from "@/components/admin/action-button";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { CopyButton } from "@/components/admin/copy-button";
import { QrImage } from "@/components/admin/qr-image";
import { SavedNotice } from "@/components/admin/saved-notice";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { ScannerFrame } from "@/components/ui/scanner-frame";
import { ServiceTile } from "@/components/ui/service-tile";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { regenerateQrCode } from "../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("qr");
  return { title: t("title") };
}

export default async function QrPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; branchId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, branchId } = await params;
  const { regenerated } = await searchParams;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("qr");
  const supabase = await getSupabaseServerClient();
  const [{ data: codes }, { data: services }] = await Promise.all([
    supabase.from("qr_codes").select("token, short_code, service_id").eq("branch_id", branchId).eq("active", true),
    supabase.from("services").select("id, name, prefix, color").eq("branch_id", branchId).order("sort_order").order("prefix"),
  ]);
  const main = codes?.find((c) => c.service_id === null);
  const byService = new Map((codes ?? []).filter((c) => c.service_id).map((c) => [c.service_id, c]));
  const pdf = (format: "a5" | "a4", service?: string) =>
    `/app/o/${orgId}/branches/${branchId}/qr/pdf?format=${format}${service ? `&service=${service}` : ""}`;
  const base = `/app/o/${orgId}/branches/${branchId}`;
  const link = main ? qrEntryUrl(main.token) : null;

  return (
    <AdminPage narrow title={t("title")} subtitle={t("subtitle")} eyebrow={branch.name} back={{ href: base, label: branch.name }}>
      <SavedNotice show={!!regenerated} message={t("regenerated")} />
      {main && link ? (
        <section className="flex flex-col items-center gap-5 rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-7 shadow-card">
          <ScannerFrame className="w-56">
            <div className="flex h-full items-center justify-center bg-white p-5">
              <QrImage value={link} label={t("imageAlt", { name: branch.name })} className="size-full" />
            </div>
          </ScannerFrame>
          <div className="text-center">
            <p className="text-footnote uppercase text-label-secondary">{t("shortCode")}</p>
            <p className="mt-1 text-title1 font-bold tracking-[0.25em] text-ticket-number">{main.short_code}</p>
            <p className="mt-1 text-footnote text-label-secondary">{t("shortCodeHint")}</p>
          </div>
          <p className="max-w-full truncate text-subheadline text-label-secondary" title={link}>
            {link}
          </p>
          <CopyButton value={link} label={t("copyLink")} copiedLabel={t("copied")} />
        </section>
      ) : null}

      <ListSection header={t("printables")}>
        <ListRow
          href={pdf("a5")}
          download
          icon={<ListIcon color="var(--accent-fill)"><FileText /></ListIcon>}
          title={t("tent")}
          subtitle={t("tentHint")}
          accessory={<Download aria-hidden className="size-5 stroke-[1.75] text-accent-text" />}
        />
        <ListRow
          href={pdf("a4")}
          download
          icon={<ListIcon color="var(--brand-tile)"><FileText /></ListIcon>}
          title={t("poster")}
          subtitle={t("posterHint")}
          accessory={<Download aria-hidden className="size-5 stroke-[1.75] text-accent-text" />}
        />
      </ListSection>

      {services?.length ? (
        <ListSection header={t("serviceQr")} footer={t("serviceQrHint")}>
          {services.map((s) => {
            const code = byService.get(s.id);
            return code ? (
              <ListRow
                key={s.id}
                href={pdf("a5", s.id)}
                download
                icon={<ServiceTile letter={s.prefix} color={s.color} />}
                title={s.name}
                subtitle={`${t("shortCode")} : ${code.short_code}`}
                accessory={<Download aria-hidden className="size-5 stroke-[1.75] text-accent-text" />}
              />
            ) : (
              <li key={s.id} className="group/row flex items-center gap-3 pl-4">
                <ServiceTile letter={s.prefix} color={s.color} />
                <span className="list-separator flex min-h-11 flex-1 items-center justify-between gap-3 py-1.5 pr-4">
                  <span className="text-body">{s.name}</span>
                  {canManage ? (
                    <ActionButton action={regenerateQrCode.bind(null, orgId, branchId, s.id)}>{t("createServiceQr")}</ActionButton>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ListSection>
      ) : null}

      {canManage ? (
        <ConfirmAction
          action={regenerateQrCode.bind(null, orgId, branchId, null)}
          label={t("regenerate")}
          title={t("regenerateTitle")}
          body={t("regenerateBody")}
          confirmLabel={t("regenerate")}
          icon={<RefreshCw aria-hidden className="size-5" />}
        />
      ) : null}
    </AdminPage>
  );
}
