import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { safeNextPath } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { MfaSetup } from "@/components/security/mfa-setup";
import { requireStaffSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mfa");
  return { title: t("title") };
}

/** Double authentification du compte (B5) : configuration, état, désactivation si le rôle le permet. */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { next } = await searchParams;
  const target = next ? safeNextPath(next) : null;
  const session = await requireStaffSession("/app/settings/security", { mfa: false });
  // Facteur enregistré mais code pas encore saisi dans cette session : le code d'abord.
  if (session.mfa.enrolled && session.mfa.aal !== "aal2") redirect("/mfa?next=%2Fapp%2Fsettings%2Fsecurity");
  const t = await getTranslations("mfa");
  const tc = await getTranslations("common");
  return (
    <main className="pb-24">
      <AdminPage narrow title={t("title")} back={{ href: "/app/settings", label: tc("back") }}>
        <MfaSetup enrolled={session.mfa.enrolled} required={session.mfa.required} next={target} />
      </AdminPage>
    </main>
  );
}
