import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/legal/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await legalTitle("privacy") };
}

export default function Page() {
  return <LegalPage docKey="privacy" />;
}
