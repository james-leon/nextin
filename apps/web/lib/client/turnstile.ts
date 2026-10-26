/** Chargement du script Cloudflare Turnstile et obtention d'un jeton à la demande (widget invisible). */
export type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  execute: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

export function loadTurnstile(): Promise<void> {
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
 * Jeton à usage unique pour `action`. Le widget n'apparaît dans `container` que si Cloudflare
 * demande une interaction ; il est retiré ensuite. Rejette si le défi échoue ou expire.
 */
export async function requestTurnstileToken(siteKey: string, action: string, container: HTMLElement): Promise<string> {
  await loadTurnstile();
  const api = window.turnstile!;
  return new Promise((resolve, reject) => {
    let id = "";
    const done = (fn: () => void) => {
      fn();
      if (id) setTimeout(() => api.remove(id), 0);
    };
    id = api.render(container, {
      sitekey: siteKey,
      action,
      appearance: "interaction-only",
      execution: "render",
      callback: (token: string) => done(() => resolve(token)),
      "error-callback": () => done(() => reject(new Error("captcha"))),
      "expired-callback": () => done(() => reject(new Error("captcha"))),
    });
  });
}
