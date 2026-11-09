import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Link2Off, MailCheck, UsersRound } from "lucide-react";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getStaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("title"), robots: { index: false } };
}

function StateMessage({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 pt-6 text-center">
      <span className="squircle flex size-16 items-center justify-center rounded-[18px] bg-fill-tertiary text-label-secondary [&_svg]:size-8 [&_svg]:stroke-[1.5]">
        {icon}
      </span>
      <h1 className="text-title1 font-bold">{title}</h1>
      <p className="text-body text-label-secondary">{body}</p>
      {action ? <div className="mt-2 w-full">{action}</div> : null}
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const tr = await getTranslations("roles");
  const ta = await getTranslations("auth");
  const supabase = await getSupabaseServerClient();
  const [{ data: rows }, session] = await Promise.all([
    /^[A-Za-z0-9_-]{16,128}$/.test(token) ? supabase.rpc("get_invitation", { p_token: token }) : Promise.resolve({ data: [] }),
    getStaffSession(),
  ]);
  const invitation = rows?.[0];
  const here = `/invite/${token}`;

  if (!invitation) {
    return <StateMessage icon={<Link2Off aria-hidden />} title={t("invalidTitle")} body={t("invalidBody")} />;
  }
  if (invitation.state === "expired") {
    return <StateMessage icon={<Clock aria-hidden />} title={t("expiredTitle")} body={t("expiredBody")} />;
  }
  if (invitation.state === "accepted") {
    return (
      <StateMessage
        icon={<MailCheck aria-hidden />}
        title={t("acceptedTitle")}
        body={t("acceptedBody")}
        action={
          <Button asChild block variant="tinted">
            <Link href="/app">{t("goToApp")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-large-title font-bold">{t("title")}</h1>
      <Card className="flex items-start gap-4">
        <span className="squircle flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-accent-tint text-accent-on-tint">
          <UsersRound aria-hidden className="size-6 stroke-[1.75]" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-body">
            {t.rich("body", {
              name: invitation.organization_name,
              role: tr(invitation.role),
            })}
          </p>
          {invitation.email_hint ? (
            <p className="text-subheadline text-label-secondary">{t("sentTo", { email: invitation.email_hint })}</p>
          ) : null}
        </div>
      </Card>
      {session ? (
        <AcceptInvitationForm token={token} acceptLabel={t("accept")} acceptingLabel={t("accepting")} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-subheadline text-label-secondary">{t("signInToAccept")}</p>
          <Button asChild block>
            <Link href={`/signup?next=${encodeURIComponent(here)}`}>{ta("createAccount")}</Link>
          </Button>
          <Button asChild block variant="plain">
            <Link href={`/login?next=${encodeURIComponent(here)}`}>{ta("signIn")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
