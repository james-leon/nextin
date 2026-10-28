import { z } from "zod";
import { MEMBER_ROLES } from "../roles";
import { normalizeCameroonPhone } from "../phone";
import { PRIORITY_REASONS } from "../queue/live";

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

/* ─── M2 : structure de l'établissement ─────────────────────────────────── */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const optionalUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .pipe(z.uuid().nullable());

/** Case à cocher / interrupteur de formulaire HTML ("on", "true" → true). */
export const formBoolean = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const e164 = normalizeCameroonPhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return e164;
  });

export const branchFormSchema = z.object({
  name: z.string().trim().min(2, "name_too_short").max(120),
  address: optionalText(240),
  city: optionalText(80),
  phone: optionalPhone,
  lat: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-90).max(90).optional()),
  lng: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().min(-180).max(180).optional()),
});

export const serviceFormSchema = z.object({
  name: z.string().trim().min(2, "name_too_short").max(80),
  nameEn: optionalText(80),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,2}$/, "prefix_invalid"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "generic"),
  defaultMinutes: z.coerce.number({ error: "duration_invalid" }).int("duration_invalid").min(1, "duration_invalid").max(120, "duration_invalid"),
  maxDailyTickets: z
    .union([z.literal(""), z.coerce.number().int().min(1, "quota_invalid").max(9999, "quota_invalid")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  specialtyId: optionalUuid,
  description: optionalText(280),
  allowPriority: formBoolean,
  allowRemote: formBoolean,
  active: formBoolean,
});

export const counterFormSchema = z.object({
  kind: z.enum(["cabinet", "guichet", "caisse", "laboratoire", "accueil"], { error: "kind_required" }),
  number: z.coerce.number().int().min(1, "number_invalid").max(999, "number_invalid"),
  label: optionalText(60),
  defaultPractitionerId: optionalUuid,
  serviceIds: z.array(z.uuid()).default([]),
  active: formBoolean,
});

export const practitionerFormSchema = z.object({
  title: optionalText(20),
  displayName: z.string().trim().min(2, "name_too_short").max(120),
  specialtyId: optionalUuid,
  branchId: z.uuid({ error: "branch_required" }),
  active: formBoolean,
});

export const specialtyFormSchema = z.object({
  name: z.string().trim().min(2, "name_too_short").max(80),
  nameEn: optionalText(80),
});

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time_invalid");

export const openingHoursSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(1).max(7),
      open: z.boolean(),
      opensAt: timeString,
      closesAt: timeString,
    }),
  )
  .length(7)
  .superRefine((days, ctx) => {
    days.forEach((d, i) => {
      if (d.open && d.closesAt <= d.opensAt) ctx.addIssue({ code: "custom", message: "hours_order", path: [i] });
    });
  });

export const branchSettingsFormSchema = z.object({
  remoteTicketsEnabled: formBoolean,
  prioritiesEnabled: formBoolean,
  ratingEnabled: formBoolean,
  almostTurnThreshold: z.coerce.number().int().min(1).max(10),
});

/** Invitation depuis l'écran Personnel : un rôle d'agence exige une agence, sauf réception/agent « toutes agences ». */
export const inviteFormSchema = z
  .object({
    role: z.enum(MEMBER_ROLES, { error: "role_required" }),
    branchId: optionalUuid,
    email: emailSchema,
  })
  .superRefine((v, ctx) => {
    if (v.role === "org_admin" && v.branchId) ctx.addIssue({ code: "custom", message: "generic", path: ["branchId"] });
    if (v.role === "branch_manager" && !v.branchId) ctx.addIssue({ code: "custom", message: "branch_required", path: ["branchId"] });
  });

/* ─── M3 : prise de ticket ──────────────────────────────────────────────── */

/** Demande de ticket d'un client (route POST /api/tickets). L'accueil passe par la RPC du personnel. */
export const takeTicketSchema = z
  .object({
    serviceId: z.uuid(),
    source: z.enum(["qr", "short_code", "remote"]),
    entryCode: z.string().trim().min(6).max(64).regex(/^[A-Za-z0-9]+$/, "invalid_entry").optional(),
    priorityReason: z.enum(PRIORITY_REASONS).optional(),
    captchaToken: z.string().max(2048).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.source !== "remote" && !v.entryCode) ctx.addIssue({ code: "custom", message: "invalid_entry", path: ["entryCode"] });
  });
export type TakeTicketInput = z.infer<typeof takeTicketSchema>;

/* ─── M6 : écrans TV ────────────────────────────────────────────────────── */

export const pairDisplayFormSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "pairing_code_invalid"),
  name: z.string().trim().min(1, "name_too_short").max(60),
  serviceIds: z.array(z.uuid()).default([]),
});

export const displayFormSchema = z.object({
  name: z.string().trim().min(1, "name_too_short").max(60),
  serviceIds: z.array(z.uuid()).default([]),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time_invalid");

export const announcementSettingsFormSchema = z
  .object({
    languages: z.array(z.enum(["fr", "en"])).min(1, "generic").max(2),
    volume: z.coerce.number().int().min(0).max(100),
    repeatCount: z.coerce.number().int().min(1).max(3),
    chimeEnabled: formBoolean,
    quietEnabled: formBoolean,
    quietFrom: hhmm.optional().or(z.literal("")),
    quietTo: hhmm.optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.quietEnabled && (!v.quietFrom || !v.quietTo || v.quietFrom === v.quietTo)) {
      ctx.addIssue({ code: "custom", message: "time_invalid", path: ["quietTo"] });
    }
  });

/** M7 — abonnement web push depuis « Mon ticket » (jeton du lien + abonnement du navigateur). */
export const pushSubscribeSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9]{22}$/),
  locale: z.enum(["fr", "en"]).default("fr"),
  subscription: z.object({
    endpoint: z.url().startsWith("https://").max(1000),
    keys: z.object({ p256dh: z.string().min(16).max(200), auth: z.string().min(8).max(100) }),
  }),
});

/** M7 — partie utile d'un webhook WhatsApp Cloud API (le reste est ignoré). */
export const whatsappWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z
            .object({
              messages: z
                .array(
                  z.object({
                    id: z.string().min(1).max(200),
                    from: z.string().regex(/^[1-9][0-9]{7,14}$/),
                    type: z.string(),
                    text: z.object({ body: z.string().max(4096) }).optional(),
                    button: z.object({ text: z.string().max(256) }).optional(),
                  }),
                )
                .optional(),
              statuses: z
                .array(
                  z.object({
                    id: z.string().min(1).max(200),
                    status: z.string(),
                    errors: z.array(z.object({ code: z.number().optional(), title: z.string().optional() })).optional(),
                  }),
                )
                .optional(),
            })
            .passthrough(),
        }),
      ),
    }),
  ),
});
