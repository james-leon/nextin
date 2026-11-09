import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function describe(error: z.ZodError): string {
  return error.issues.map((i) => i.path.join(".")).join(", ");
}

/** Variables publiques (inlinées par Next.js au build). */
export function publicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) throw new Error(`Missing or invalid public env: ${describe(parsed.error)}`);
  return parsed.data;
}

/** Variables serveur — ne jamais appeler depuis un composant client. */
export function serverEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new Error(`Missing or invalid server env: ${describe(parsed.error)}`);
  return parsed.data;
}
