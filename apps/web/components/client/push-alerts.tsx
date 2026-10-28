"use client";

import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";

type State = "unsupported" | "idle" | "pending" | "on" | "denied" | "error";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Web push en complément de WhatsApp : notification sur ce téléphone même page fermée.
 * Affiché seulement si le navigateur le permet (HTTPS, service worker actif ; sur iPhone, app installée).
 */
export function PushAlerts({ token, vapidKey, subscribed }: { token: string; vapidKey: string; subscribed: boolean }) {
  const t = useLiteT("client.ticket");
  const locale = useLiteLocale();
  const [state, setState] = useState<State>("unsupported");

  useEffect(() => {
    if (!window.isSecureContext || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    let alive = true;
    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!alive || !reg) return;
      setState(Notification.permission === "denied" ? "denied" : "idle");
    });
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setState("pending");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const subscription =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidKey) }));
      const res = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, locale, subscription: subscription.toJSON() }),
      });
      setState(res.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }

  if (subscribed || state === "on") {
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-subheadline text-label-secondary">
        <Check aria-hidden className="size-4 text-green" />
        {t("pushOn")}
      </p>
    );
  }
  if (state === "unsupported") return null;
  if (state === "denied") return <p className="text-center text-footnote text-label-secondary">{t("pushDenied")}</p>;
  return (
    <div className="flex flex-col items-center gap-1">
      <Button block variant="plain" leadingIcon={<BellRing />} onClick={enable} disabled={state === "pending"}>
        {t("push")}
      </Button>
      {state === "error" ? (
        <p role="alert" className="text-footnote text-red-text">
          {t("pushError")}
        </p>
      ) : null}
    </div>
  );
}
