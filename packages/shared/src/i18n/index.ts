import { en } from "./en";
import { fr, type Messages } from "./fr";
import type { Locale } from "./config";

export * from "./config";
export type { Messages };

export const messages: Record<Locale, Messages> = { fr, en };
