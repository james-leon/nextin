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
  try {
    await loadTurnstile();
  } catch (error) {
    reportCaptchaFailure(action, "script");
    throw error;
  }
  const api = window.turnstile!;
  return new Promise((resolve, reject) => {
    let id = "";
    const done = (fn: () => void) => {
      fn();
      if (id) setTimeout(() => api.remove(id), 0);
    };
    const fail = (code: string) =>
      done(() => {
        reportCaptchaFailure(action, code);
        reject(new Error(`captcha:${code}`));
      });
    id = api.render(container, {
      sitekey: siteKey,
      action,
      appearance: "interaction-only",
      execution: "render",
      callback: (token: string) => done(() => resolve(token)),
      // Code d'erreur Turnstile (ex. 110200 : domaine non autorisé pour la clé du site, 300xxx/600xxx : défi échoué).
      "error-callback": (code?: string | number) => {
        fail(String(code ?? "error"));
        // Erreur traitée ici : pas de nouvel essai automatique ni d'exception non rattrapée de Cloudflare.
        return true;
      },
      "expired-callback": () => fail("expired"),
      "timeout-callback": () => fail("timeout"),
    });
  });
}

/** Rapport d'échec chargé seulement quand il sert (budget des pages client). */
function reportCaptchaFailure(action: string, code: string) {
  void import("./captcha-report").then((m) => m.reportCaptchaFailure(action, code)).catch(() => {});
}
