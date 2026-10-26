"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile-load-failed"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile invisible : n'apparaît que si Cloudflare demande une interaction.
 * Place le jeton dans un champ caché `captchaToken` du formulaire parent.
 * Sans `siteKey` (développement local), ne rend rien. Pour un nouveau jeton après une tentative,
 * remonter le composant (prop `key`) : un jeton ne sert qu'une fois.
 */
export function Turnstile({ siteKey, action }: { siteKey: string | null; action: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          callback: (t: string) => setToken(t),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      })
      .catch(() => setToken(""));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action]);

  if (!siteKey) return null;
  return (
    <>
      <div ref={container} className="flex justify-center empty:hidden" />
      <input type="hidden" name="captchaToken" value={token} />
    </>
  );
}
