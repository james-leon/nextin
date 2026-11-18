"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Laptop, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { describeUserAgent } from "@/lib/auth/user-agent";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Session = { id: string; user_agent: string | null; created_at: string; last_active_at: string | null; is_current: boolean };

/** Temps écoulé lisible (« il y a 2 h », « hier »), dans la langue de l'interface. */
function relative(iso: string, locale: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  return rtf.format(Math.round(seconds / 86_400), "day");
}

/**
 * Appareils connectés (maquette v2 07, « Sécurité ») : sessions ouvertes du compte, la plus récente en premier,
 * « cet appareil » signalé ; « Déconnecter » ferme une autre session (`revoke_my_session`, journalisée).
 * Jamais d'adresse IP : seuls le navigateur, le système et la dernière activité sont montrés.
 */
export function ConnectedDevices() {
  const t = useTranslations("settings");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.rpc("my_sessions").then(({ data, error }) => {
      if (!alive) return;
      if (error) setFailed(true);
      else setSessions((data ?? []) as Session[]);
    });
    return () => {
      alive = false;
    };
  }, [supabase]);

  const label = (s: Session) => {
    const { browser, os } = describeUserAgent(s.user_agent);
    if (browser && os) return t("deviceOn", { browser, os });
    return browser ?? os ?? t("deviceUnknown");
  };

  async function disconnect(s: Session) {
    setBusy(s.id);
    const { error } = await supabase.rpc("revoke_my_session", { p_session: s.id });
    setBusy(null);
    if (error) {
      toast(te.has(error.message as never) ? te(error.message as never) : te("generic"));
      return;
    }
    setSessions((list) => list?.filter((x) => x.id !== s.id) ?? null);
    toast(t("disconnected"), <CheckCircle2 aria-hidden />);
  }

  const footer = failed ? t("devicesError") : sessions && sessions.length <= 1 ? t("devicesEmpty") : t("devicesFooter");

  return (
    <ListSection header={t("devicesTitle")} footer={footer}>
      {sessions === null && !failed ? (
        <li className="flex flex-col gap-2 px-4 py-3" aria-hidden>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </li>
      ) : (
        (sessions ?? []).map((s) => {
          const { os } = describeUserAgent(s.user_agent);
          const mobile = os === "iPhone" || os === "Android" || os === "iPad";
          const name = label(s);
          return (
            <ListRow
              key={s.id}
              icon={<ListIcon color="var(--icon-gray)">{mobile ? <Smartphone /> : <Laptop />}</ListIcon>}
              title={name}
              subtitle={s.is_current ? t("thisDevice") : t("lastActive", { when: relative(s.last_active_at ?? s.created_at, locale) })}
              trailing={
                s.is_current ? undefined : (
                  <Button
                    variant="destructive-plain"
                    size="md"
                    loading={busy === s.id}
                    onClick={() => void disconnect(s)}
                    aria-label={t("disconnectLabel", { device: name })}
                  >
                    {t("disconnect")}
                  </Button>
                )
              }
            />
          );
        })
      )}
    </ListSection>
  );
}
