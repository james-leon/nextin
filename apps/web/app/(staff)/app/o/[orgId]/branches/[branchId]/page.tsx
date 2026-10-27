import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Clock, ConciergeBell, DoorOpen, Info, QrCode, SlidersHorizontal, Stethoscope, Tv } from "lucide-react";
import { SERVICE_COLORS, summarizeOpeningHours } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { SavedNotice } from "@/components/admin/saved-notice";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ orgId: string; branchId: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orgId, branchId } = await params;
  const { branch } = await getBranch(orgId, branchId);
  return { title: branch.name };
}

export default async function BranchPage({ params, searchParams }: Props) {
  const { orgId, branchId } = await params;
  const { saved } = await searchParams;
  const { ctx, branch } = await getBranch(orgId, branchId);
  const t = await getTranslations("branches");
  const th = await getTranslations("hours");
  const td = await getTranslations("desk");
  const tv = await getTranslations("displays");
  const tw = await getTranslations("weekdaysShort");
  const supabase = await getSupabaseServerClient();
  const [services, counters, hours, qr] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    supabase.from("counters").select("id", { count: "exact", head: true }).eq("branch_id", branchId),
    supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("branch_id", branchId).order("weekday"),
    supabase.from("qr_codes").select("short_code").eq("branch_id", branchId).is("service_id", null).eq("active", true).maybeSingle(),
  ]);
  const base = `/app/o/${orgId}/branches/${branchId}`;
  const place = [branch.address, branch.city].filter(Boolean).join(", ");

  return (
    <AdminPage title={branch.name} eyebrow={ctx.org.name} subtitle={place || undefined} back={{ href: `/app/o/${orgId}/branches`, label: t("title") }}>
      <SavedNotice show={!!saved} />
      <ListSection>
        <ListRow
          href={`${base}/services`}
          icon={<ListIcon color="var(--accent-fill)"><Stethoscope /></ListIcon>}
          title={t("servicesCount", { count: services.count ?? 0 })}
          accessory="chevron"
        />
        <ListRow
          href={`${base}/counters`}
          icon={<ListIcon color={SERVICE_COLORS.green}><DoorOpen /></ListIcon>}
          title={t("countersCount", { count: counters.count ?? 0 })}
          accessory="chevron"
        />
        <ListRow
          href={`${base}/qr`}
          icon={<ListIcon color={SERVICE_COLORS.purple}><QrCode /></ListIcon>}
          title={t("qr")}
          subtitle={qr.data ? qr.data.short_code : undefined}
          accessory="chevron"
        />
        <ListRow
          href={`${base}/displays`}
          icon={<ListIcon color="var(--brand-tile)"><Tv /></ListIcon>}
          title={tv("link")}
          subtitle={tv("linkHint")}
          accessory="chevron"
        />
      </ListSection>
      <ListSection>
        <ListRow
          href={`${base}/hours`}
          icon={<ListIcon color={SERVICE_COLORS.ochre}><Clock /></ListIcon>}
          title={t("hours")}
          subtitle={summarizeOpeningHours(hours.data ?? [], (d) => tw(String(d) as "1"), th("closed"))}
          accessory="chevron"
        />
        <ListRow
          href={`${base}/settings`}
          icon={<ListIcon color={SERVICE_COLORS.slate}><SlidersHorizontal /></ListIcon>}
          title={t("settings")}
          accessory="chevron"
        />
        <ListRow
          href={`${base}/edit`}
          icon={<ListIcon color="var(--brand-tile)"><Info /></ListIcon>}
          title={t("info")}
          subtitle={branch.phone_e164 ?? undefined}
          accessory="chevron"
        />
      </ListSection>
      <ListSection>
        <ListRow
          href={`/desk/reception/${branchId}`}
          icon={<ListIcon color="var(--orange-fill)"><ConciergeBell /></ListIcon>}
          title={td("open")}
          subtitle={td("openHint")}
          accessory="chevron"
        />
      </ListSection>
    </AdminPage>
  );
}
