import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Après la suite : suppression des établissements, annonceurs et comptes créés par les tests (`@nextin.test`),
 * pour que la démo et les captures ne montrent que des données réalistes. Base locale uniquement.
 */
export default function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url) || process.env.E2E_KEEP_DATA === "1") return;
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const r = spawnSync(process.execPath, ["scripts/e2e-cleanup.mjs"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) console.warn("Nettoyage des données e2e impossible (voir ci-dessus).");
}
