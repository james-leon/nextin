import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QrScanner } from "@/components/client/qr-scanner";
import { LiteMessages } from "@/lib/i18n/lite-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.scanner");
  return { title: t("title") };
}

/**
 * Scanner (maquette v2 02) : toujours sombre, comme l'appareil photo ; la caméra démarre seule, le cadre se resserre
 * et le téléphone vibre quand le code est lu. « Saisir le code » en secours si la caméra ne marche pas.
 */
export default function ScanPage() {
  return (
    <LiteMessages paths={["client.scanner"]}>
      <QrScanner />
    </LiteMessages>
  );
}
