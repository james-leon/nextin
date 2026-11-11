"use client";

import { errorTexts } from "@nextin/shared/i18n/error-texts";

/**
 * Erreur du gabarit racine lui-même (U1) : remplace tout le document, sans la feuille de style de l'application
 * (l'importer ici l'ajouterait une seconde fois à chaque page : budget des pages client). Couleurs système
 * (`Canvas`, `CanvasText`, `LinkText`) : lisibles en clair comme en sombre, sans couleur en dur. « Réessayer »
 * relance le rendu.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = typeof navigator !== "undefined" ? navigator.language : "fr";
  const texts = errorTexts(locale);
  return (
    <html lang={locale.toLowerCase().startsWith("en") ? "en" : "fr"} style={{ colorScheme: "light dark" }}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "Canvas", color: "CanvasText" }}>
        <main style={{ maxWidth: "28rem", margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "1rem", padding: "0 1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.375rem", margin: 0 }}>{texts.title}</h1>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{texts.body}</p>
          <button type="button" onClick={reset} style={{ minHeight: "2.75rem", padding: "0 1.25rem", borderRadius: "0.75rem", font: "inherit", fontWeight: 600 }}>
            {texts.retry}
          </button>
          {/* Lien simple, pas de routeur : l'application est relancée entièrement. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ color: "LinkText", minHeight: "2.75rem", display: "inline-flex", alignItems: "center" }}>
            {texts.home}
          </a>
          {error.digest ? <p style={{ margin: 0, fontSize: "0.8125rem" }}>{texts.code.replace("{digest}", error.digest)}</p> : null}
        </main>
      </body>
    </html>
  );
}
