import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { ToastProvider } from "@/components/ui/toast";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const m = await getMessages();
  return (
    <NextIntlClientProvider
      messages={{
        common: m.common,
        errors: m.errors,
        roles: m.roles,
        orgNew: m.orgNew,
        orgTypes: m.orgTypes,
        staff: m.staff,
        admin: m.admin,
        branches: m.branches,
        services: m.services,
        serviceColors: m.serviceColors,
        counters: m.counters,
        counterKinds: m.counterKinds,
        hours: m.hours,
        weekdays: m.weekdays,
        weekdaysShort: m.weekdaysShort,
        branchSettings: m.branchSettings,
        qr: m.qr,
        practitioners: m.practitioners,
        staffMgmt: m.staffMgmt,
        theme: m.theme,
        settings: m.settings,
        desk: m.desk,
        absence: m.absence,
        reception: m.reception,
        displays: m.displays,
        appointments: m.appointments,
        schedule: m.schedule,
        client: { service: { reasons: m.client.service.reasons } },
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </NextIntlClientProvider>
  );
}
