import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const m = await getMessages();
  return (
    <NextIntlClientProvider
      messages={{ common: m.common, errors: m.errors, orgNew: m.orgNew, orgTypes: m.orgTypes, staff: m.staff }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
