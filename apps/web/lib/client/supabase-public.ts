/**
 * Accès public à Supabase depuis les pages client, sans supabase-js (pages < 200 Ko) :
 * appels RPC REST avec la clé anonyme, éventuellement au nom d'une session anonyme.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type RpcError = { code?: string; message: string; details?: string | null; status: number };
export type RpcResult<T> = { data: T; error: null } | { data: null; error: RpcError };

export async function callRpc<T>(fn: string, args: Record<string, unknown>, options: { accessToken?: string; signal?: AbortSignal } = {}): Promise<RpcResult<T>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${options.accessToken ?? SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: options.signal,
      cache: "no-store",
    });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
      const e = (body ?? {}) as { code?: string; message?: string; details?: string | null };
      return { data: null, error: { code: e.code, message: e.message ?? `http_${res.status}`, details: e.details, status: res.status } };
    }
    return { data: body as T, error: null };
  } catch {
    return { data: null, error: { message: "network", status: 0 } };
  }
}
