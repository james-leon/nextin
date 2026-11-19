"use client";

import { Suspense, lazy, useSyncExternalStore, type ComponentType } from "react";

const subscribe = () => () => {};

/**
 * Composant chargé à la demande pour les pages client au budget serré (« Mon ticket ») : `React.lazy`, déjà dans React,
 * au lieu de `next/dynamic`, dont le chargeur (préchargement, repli côté client, stockage asynchrone) pèse ≈ 2 Ko de
 * plus au premier chargement. `ssr: false` : rendu seulement dans le navigateur, après l'hydratation (comme
 * `next/dynamic` avec `ssr: false`). Sinon rendu côté serveur s'il sert ; le code n'est téléchargé que s'il s'affiche.
 */
export function lazyComponent<P extends object>(load: () => Promise<ComponentType<P>>, { ssr = true }: { ssr?: boolean } = {}) {
  const Inner = lazy(() => load().then((component) => ({ default: component })));
  function Lazy(props: P) {
    const client = useSyncExternalStore(subscribe, () => true, () => false);
    if (!ssr && !client) return null;
    return (
      <Suspense fallback={null}>
        <Inner {...props} />
      </Suspense>
    );
  }
  return Lazy;
}
