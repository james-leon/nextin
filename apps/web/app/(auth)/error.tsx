"use client";

import { useLocale } from "next-intl";
import { errorTexts } from "@nextin/shared/i18n/error-texts";
import { ErrorScreen } from "@/components/ui/error-screen";

/** Erreur de rendu (U1) : textes FR/EN de la langue courante, « Réessayer » relance le segment. */
export default function SegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen texts={errorTexts(useLocale())} homeHref="/login" digest={error.digest} error={error} onRetry={reset} />;
}
