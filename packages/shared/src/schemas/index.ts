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
