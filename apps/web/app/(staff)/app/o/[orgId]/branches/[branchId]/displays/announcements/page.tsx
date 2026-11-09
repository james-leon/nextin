import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { AnnouncementSettingsForm } from "@/components/admin/display-forms";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { saveAnnouncementSettings } from "../../../../_actions/displays";

type Props = { params: Promise<{ orgId: string; branchId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("displays");
  return { title: t("announcements") };
}

export default async function AnnouncementsPage({ params }: Props) {
  const { orgId, branchId } = await params;
  const { ctx, branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("displays");
  const supabase = await getSupabaseServerClient();
  const { data: s } = await supabase.from("announcement_settings").select("*").eq("branch_id", branchId).maybeSingle();
  const quiet = (s?.quiet_hours as { from: string; to: string }[] | null)?.[0] ?? null;
  return (
    <AdminPage narrow title={t("announcements")} eyebrow={branch.name} back={{ href: `/app/o/${orgId}/branches/${branchId}/displays`, label: t("title") }}>
      <ReadOnlyNotice show={!canManage} />
      <AnnouncementSettingsForm
        action={saveAnnouncementSettings.bind(null, orgId, branchId)}
        disabled={!canManage}
        initial={{
          languages: (s?.languages as ("fr" | "en")[] | undefined) ?? [ctx.org.default_locale === "en" ? "en" : "fr"],
          volume: s?.volume ?? 80,
          repeatCount: s?.repeat_count ?? 1,
          chimeEnabled: s?.chime_enabled ?? true,
          quiet,
        }}
      />
    </AdminPage>
  );
}
