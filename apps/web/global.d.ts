import type { Messages } from "@nextin/shared/i18n";
import type { Locale } from "@nextin/shared/i18n";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
