import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Link2Off, MailCheck } from "lucide-react";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { Button } from "@/components/ui/button";
import { getStaffSession } from "@/lib/auth/session";
import { initialsOf } from "@/lib/text/initials";
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
      <header className="flex flex-col items-center gap-2 text-center">
        <span
          aria-hidden
          className="squircle mb-2 flex size-16 items-center justify-center rounded-[16px] bg-primary font-rounded text-title2 font-bold text-on-accent"
        >
          {initialsOf(invitation.organization_name)}
        </span>
        <p className="text-footnote font-medium tracking-wide text-label-secondary uppercase">{t("title")}</p>
        <h1 className="text-title1 font-bold text-balance">{t("joinTitle", { name: invitation.organization_name })}</h1>
        <p className="text-body text-label-secondary">
          {t("body", { name: invitation.organization_name, role: tr(invitation.role) })}
        </p>
        {invitation.email_hint ? (
          <p className="text-subheadline text-label-secondary">{t("sentTo", { email: invitation.email_hint })}</p>
        ) : null}
      </header>
      {session ? (
        <AcceptInvitationForm token={token} acceptLabel={t("accept")} acceptingLabel={t("accepting")} />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-subheadline text-label-secondary">{t("signInToAccept")}</p>
          <Button asChild block>
            <Link href={`/signup?next=${encodeURIComponent(here)}`}>{ta("createAccount")}</Link>
          </Button>
          <Button asChild block variant="tinted">
            <Link href={`/login?next=${encodeURIComponent(here)}`}>{ta("signIn")}</Link>
          </Button>
        </div>
      )}
      <p className="text-center text-footnote text-label-secondary">{t("validity")}</p>
    </div>
  );
}
