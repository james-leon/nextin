"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { usePageFrame } from "./page-frame";

/**
 * Zone d'action principale (maquettes 02 et 04) : un résumé facultatif puis le bouton principal — une seule action
 * principale par écran. Revue responsive R3 :
 * - téléphone : collée en bas de l'écran ; le contenu garde une marge basse suffisante (`pb-36` des gabarits) ;
 * - tablette (≥ 768 px) : à la fin du contenu, collée au bas de la fenêtre au défilement, à la largeur exacte du contenu ;
 * - ordinateur (≥ 1024 px), dans un `PageFrame` : l'action remonte dans la barre de titre, à droite du grand titre.
 *   Un bouton d'envoi y reste relié à son formulaire (attribut `form`).
 */
export function BottomBar({
  summary,
  children,
  position = "fixed",
  dock = true,
  className,
}: {
  summary?: ReactNode;
  children: ReactNode;
  /** `absolute` : dans un conteneur positionné (aperçus, cadres). `sticky` : collée en bas de son conteneur. */
  position?: "fixed" | "sticky" | "absolute";
  /** Faux : jamais déplacée dans la barre de titre (la page place elle-même son action sur ordinateur). */
  dock?: boolean;
  className?: string;
}) {
  const frame = usePageFrame();
  const docked = dock && position === "fixed" && !!frame;
  const anchor = useRef<HTMLDivElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const [formId, setFormId] = useState<string | null>(null);

  // Formulaire de la barre (s'il y en a un) : identifiant pour relier le bouton déplacé dans la barre de titre.
  const setAnchor = (el: HTMLDivElement | null) => {
    anchor.current = el;
    const form = el?.closest("form");
    if (!form) return;
    if (!form.id) form.id = `form-${generatedId.replace(/[^a-zA-Z0-9-]/g, "")}`;
    if (form.id !== formId) setFormId(form.id);
  };

  useEffect(() => {
    if (!formId || !portal.current) return;
    for (const button of portal.current.querySelectorAll("button")) {
      if (button.type === "submit") button.setAttribute("form", formId);
    }
  });

  return (
    <>
      <div
        ref={setAnchor}
        className={cn(
          "safe-bottom z-20 bg-gradient-to-t from-grouped from-70% to-transparent pt-6 pb-4",
          position === "fixed" && "fixed right-0 bottom-0 left-[var(--shell-sidebar,0px)] px-4 md:sticky md:right-auto md:left-auto md:px-0",
          position === "absolute" && "absolute inset-x-0 bottom-0 px-4",
          position === "sticky" && "sticky bottom-0 px-4",
          docked && "lg:hidden",
          className,
        )}
      >
        {/* Personnel (dans un cadre de page) : toute la largeur du contenu ; pages client : colonne centrée du contenu. */}
        <div className={cn("mx-auto flex max-w-lg flex-col gap-3", position === "fixed" && (frame ? "md:max-w-none" : "md:px-4"))}>
          {summary ? <p className="text-center text-subheadline text-label-secondary">{summary}</p> : null}
          {children}
        </div>
      </div>
      {docked && frame.slot
        ? createPortal(
            <div ref={portal} className="hidden items-center gap-3 lg:flex [&>*]:w-auto">
              {summary ? <p className="text-subheadline text-label-secondary">{summary}</p> : null}
              {children}
            </div>,
            frame.slot,
          )
        : null}
    </>
  );
}
