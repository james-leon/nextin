import { z } from "zod";
import { MEMBER_ROLES } from "../roles";
import { normalizeCameroonPhone } from "../phone";

export const ORG_TYPES = ["clinic", "hospital", "telecom", "bank", "utility", "administration", "other"] as const;
export const orgTypeSchema = z.enum(ORG_TYPES);

export const slugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug");

export const cameroonPhoneSchema = z
  .string()
  .transform((v, ctx) => {
    const e164 = normalizeCameroonPhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "phone" });
      return z.NEVER;
    }
    return e164;
  });

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  type: orgTypeSchema,
  defaultLocale: z.enum(["fr", "en"]).default("fr"),
  dataRetentionDays: z.number().int().min(7).max(365).default(30),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const inviteMemberSchema = z
  .object({
    organizationId: z.uuid(),
    role: z.enum(MEMBER_ROLES),
    branchId: z.uuid().nullable().default(null),
    email: z.email().optional(),
    phone: cameroonPhoneSchema.optional(),
  })
  .refine((v) => v.email || v.phone, { message: "contact", path: ["email"] });
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const turnstileTokenSchema = z.string().min(1).max(2048);

/** Mot de passe du personnel : 10 caractères minimum, lettres et chiffres (aligné sur Supabase Auth). */
export const passwordSchema = z
  .string()
  .min(10, "password_too_short")
  .max(72, "password_too_long")
  .regex(/[A-Za-z]/, "password_needs_letter")
  .regex(/\d/, "password_needs_digit");

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("email_invalid"));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "password_required").max(72),
  next: z.string().optional(),
  captchaToken: z.string().max(2048).optional(),
});

export const loginCodeRequestSchema = z.object({
  email: emailSchema,
  captchaToken: z.string().max(2048).optional(),
});

export const loginCodeVerifySchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "code_invalid"),
  next: z.string().optional(),
});

export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "name_too_short").max(120),
  email: emailSchema,
  password: passwordSchema,
  next: z.string().optional(),
  captchaToken: z.string().max(2048).optional(),
});

/** Formulaire « Nouvel établissement » (le slug est dérivé du nom côté serveur). */
export const newOrganizationFormSchema = z.object({
  name: z.string().trim().min(2, "name_too_short").max(120),
  type: orgTypeSchema,
  defaultLocale: z.enum(["fr", "en"]).default("fr"),
  captchaToken: z.string().max(2048).optional(),
});
