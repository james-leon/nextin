import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatCameroonPhone } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { BranchPhotoCard } from "@/components/admin/branch-photo-card";
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
    <AdminPage narrow title={t("info")} eyebrow={branch.name} back={{ href: `/app/o/${orgId}/branches/${branchId}`, label: branch.name }}>
      <ReadOnlyNotice show={!canManage} />
      {/* Maquette v2 17 : photo de l'établissement en tête, puis les informations (enregistrement automatique). */}
      <BranchPhotoCard
        orgId={orgId}
        branchId={branchId}
        canManage={canManage}
        photoUrl={
          branch.photo_updated_at
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branch-photos/${orgId}/${branchId}/cover.webp?v=${new Date(branch.photo_updated_at).getTime()}`
            : null
        }
      />
      <fieldset disabled={!canManage} className="contents">
        <BranchForm
          disabled={!canManage}
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
