"use client";

import { useSyncExternalStore } from "react";
import { useLiteT } from "@/lib/i18n/lite";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { OrgTypeIcon, sectorColor } from "@/components/ui/org-type-icon";
import { recentBranchesStore } from "@/lib/client/recent-branches";

/** « Récents » de l'accueil : établissements ouverts sur cet appareil (informations publiques seulement). */
export function HomeRecents() {
  const t = useLiteT("client.home");
  const recents = useSyncExternalStore(recentBranchesStore.subscribe, recentBranchesStore.getSnapshot, recentBranchesStore.getServerSnapshot);
  if (!recents.length) return null;
  return (
    <ListSection header={t("recent")}>
      {recents.slice(0, 4).map((r) => (
        <ListRow
          key={r.id}
          href={`/b/${r.id}`}
          prefetch={false}
          icon={
            <ListIcon color={sectorColor(r.type)}>
              <OrgTypeIcon type={r.type} />
            </ListIcon>
          }
          title={r.organization}
          subtitle={[r.name, r.city].filter(Boolean).join(" · ")}
          accessory="chevron"
        />
      ))}
    </ListSection>
  );
}
