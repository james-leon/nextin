import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatCameroonPhone } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { BranchForm } from "@/components/admin/branch-form";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { getBranch } from "@/lib/admin/branch";
import { updateBranch } from "../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("branches");
  return { title: t("editTitle") };
}

export default async function EditBranchPage({ params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("branches");
  const ta = await getTranslations("admin");
  return (
    <AdminPage narrow title={t("editTitle")} eyebrow={branch.name} back={{ href: `/app/o/${orgId}/branches/${branchId}`, label: branch.name }}>
      <ReadOnlyNotice show={!canManage} />
      <fieldset disabled={!canManage} className="contents">
        <BranchForm
          action={updateBranch.bind(null, orgId, branchId)}
          initial={{
            name: branch.name,
            address: branch.address,
            city: branch.city,
            phone: branch.phone_e164 ? formatCameroonPhone(branch.phone_e164) : null,
            lat: branch.latitude,
            lng: branch.longitude,
          }}
          submitLabel={ta("save")}
          submittingLabel={ta("saving")}
        />
      </fieldset>
    </AdminPage>
  );
}
