import { AdsNav } from "@/components/ads/ads-nav";
import { getAdvertiserContext } from "@/lib/ads/context";

/** Espace annonceur (M10b) : compte connecté ; barre latérale sur grand écran. */
export default async function AdsLayout({ children }: { children: React.ReactNode }) {
  const { advertiser, role } = await getAdvertiserContext();
  return (
    <div data-shell="sidebar" className="flex min-h-dvh lg:[--shell-sidebar:16rem]">
      <AdsNav variant="sidebar" advertiser={advertiser?.name} role={role} />
      <main className="min-w-0 flex-1 pb-36">{children}</main>
    </div>
  );
}
