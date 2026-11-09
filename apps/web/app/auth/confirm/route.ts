import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@nextin/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Lien de confirmation reçu par e-mail (inscription, connexion par lien) : ouvre la session puis redirige. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));
  const target = request.nextUrl.clone();
  target.search = "";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const [path, query] = next.split("?");
      target.pathname = path ?? "/app";
      target.search = query ? `?${query}` : "";
      return NextResponse.redirect(target);
    }
  }
  target.pathname = "/login";
  target.search = "?error=code_invalid";
  return NextResponse.redirect(target);
}
