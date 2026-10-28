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
  // M5b — règle d'équité des rendez-vous.
  appointmentMode: z.enum(["ratio", "strict"]),
  appointmentWalkinRatio: z.coerce.number().int().min(0).max(10),
  appointmentEarlyMinutes: z.coerce.number().int().min(0).max(120),
  appointmentLateGraceMinutes: z.coerce.number().int().min(0).max(120),
  appointmentNoShowMinutes: z.coerce.number().int().min(15).max(480),
  // M9 — visibilité publique, ticket à distance et demandes de rendez-vous.
  publicListingEnabled: formBoolean,
  remoteMaxDistanceKm: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .pipe(z.number().min(0.5).max(200).nullable()),
  remoteConfirmThreshold: z.coerce.number().int().min(1).max(10),
  remotePenaltyPlaces: z.coerce.number().int().min(1).max(20),
  remoteMaxDelays: z.coerce.number().int().min(1).max(5),
  remoteTravelKmh: z.coerce.number().int().min(5).max(80),
  remoteLeaveMarginMinutes: z.coerce.number().int().min(0).max(60),
  appointmentRequestsEnabled: formBoolean,
  appointmentRequestDays: z.coerce.number().int().min(1).max(60),
  appointmentRequestMaxPending: z.coerce.number().int().min(1).max(10),
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
    // M9 — ticket à distance : position du client (calcul du trajet, jamais enregistrée).
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.source !== "remote" && !v.entryCode) ctx.addIssue({ code: "custom", message: "invalid_entry", path: ["entryCode"] });
    if ((v.latitude == null) !== (v.longitude == null)) ctx.addIssue({ code: "custom", message: "location_required", path: ["latitude"] });
  });
export type TakeTicketInput = z.infer<typeof takeTicketSchema>;

/* ─── M9 : demande de rendez-vous du patient ───────────────────────────── */

export const REQUEST_PERIODS = ["morning", "afternoon", "any"] as const;
export type RequestPeriod = (typeof REQUEST_PERIODS)[number];

/**
 * Demande de rendez-vous (route POST /api/appointment-requests) : créneau précis libre, ou jour + moment de la
 * journée ; praticien facultatif (« peu importe ») ; numéro WhatsApp camerounais, vérifié ensuite par code.
 */
export const appointmentRequestSchema = z
  .object({
    branchId: z.uuid(),
    serviceId: z.uuid(),
    practitionerId: z.uuid().nullable().optional(),
    startsAt: z.iso.datetime({ offset: true }).nullable().optional(),
    day: z.iso.date().nullable().optional(),
    period: z.enum(REQUEST_PERIODS).nullable().optional(),
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        const e164 = normalizeCameroonPhone(v);
        if (!e164) {
          ctx.addIssue({ code: "custom", message: "phone_invalid" });
          return z.NEVER;
        }
        return e164;
      }),
    label: z.string().trim().max(40).optional().transform((v) => v || null),
    locale: z.enum(["fr", "en"]).default("fr"),
    captchaToken: z.string().max(2048).optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.startsAt && !(v.day && v.period)) ctx.addIssue({ code: "custom", message: "slot_required", path: ["startsAt"] });
  });
export type AppointmentRequestInput = z.infer<typeof appointmentRequestSchema>;

/** Code de vérification reçu sur WhatsApp (6 chiffres, espaces tolérés). */
export const requestCodeSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[0-9]{6}$/, "code_invalid"));

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

/** M5b — plage de consultation hebdomadaire d'un praticien (créneaux de rendez-vous). */
export const practitionerScheduleFormSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(7),
    startsAt: hhmm,
    endsAt: hhmm,
    slotMinutes: z.coerce.number().int().min(5).max(240),
    serviceId: z.uuid(),
  })
  .refine((v) => v.endsAt > v.startsAt, { message: "time_invalid", path: ["endsAt"] });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "generic");

/** M5b — congé d'un praticien (dates incluses). */
export const practitionerLeaveFormSchema = z
  .object({
    startsOn: isoDate,
    endsOn: isoDate,
    reason: z.string().trim().max(120).optional().transform((v) => v || undefined),
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "generic", path: ["endsOn"] });

/* ─── M10a : inscription, abonnement, paiement, super admin ─────────────── */

/** Étape 1 de l'inscription : téléphone du directeur (code envoyé sur WhatsApp). */
export const phoneCodeRequestSchema = z.object({
  phone: z.string().trim().transform((v, ctx) => {
    const e164 = normalizeCameroonPhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return e164;
  }),
  locale: z.enum(["fr", "en"]).default("fr"),
  captchaToken: z.string().max(2048).optional(),
});

/** Étape 2 : code reçu. */
export const phoneCodeVerifySchema = z.object({
  verificationId: z.uuid(),
  code: requestCodeSchema,
});

/** Étape 3 : établissement (téléphone déjà vérifié). */
export const selfServiceSignupSchema = z.object({
  verificationId: z.uuid(),
  name: z.string().trim().min(2, "name_too_short").max(120),
  type: orgTypeSchema,
  defaultLocale: z.enum(["fr", "en"]).default("fr"),
});

export const billingCheckoutSchema = z.object({
  planId: z.uuid(),
  period: z.enum(["monthly", "annual"]),
});

/** Page publique `/pay/<jeton>` : opérateur et numéro débité. */
export const startPaymentSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9]{32}$/, "not_found"),
  channel: z.enum(["mtn_momo", "orange_money"]),
  msisdn: z.string().trim().transform((v, ctx) => {
    const e164 = normalizeCameroonPhone(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return e164;
  }),
  captchaToken: z.string().max(2048).optional(),
});

const adminReason = z.string().trim().min(3, "reason_required").max(200);

export const adminGrantDaysSchema = z.object({
  subscriptionId: z.uuid(),
  days: z.coerce.number().int().min(1).max(365),
  reason: adminReason,
});

export const adminDiscountSchema = z
  .object({
    organizationId: z.uuid(),
    kind: z.enum(["percent", "fixed_xaf"]),
    value: z.coerce.number().int().min(1),
    invoices: z.coerce.number().int().min(1).max(24),
    reason: adminReason,
  })
  .refine((v) => v.kind !== "percent" || v.value <= 100, { message: "generic", path: ["value"] });

export const adminChangePlanSchema = z.object({ subscriptionId: z.uuid(), planId: z.uuid(), reason: adminReason });

export const adminSuspensionSchema = z.object({ organizationId: z.uuid(), suspended: formBoolean, reason: adminReason });

const optionalInt = (min: number, max: number) =>
  z
    .union([z.literal(""), z.coerce.number().int().min(min).max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

/** Formule (prix hors taxe en FCFA, limites vides = illimité). */
export const adminPlanFormSchema = z.object({
  planId: z.uuid(),
  name: z.string().trim().min(2, "name_too_short").max(60),
  nameEn: z.string().trim().max(60).optional().transform((v) => v || null),
  description: z.string().trim().max(240).optional().transform((v) => v || null),
  basePriceXaf: z.coerce.number().int().min(0).max(100_000_000),
  includedBranches: z.coerce.number().int().min(1).max(999),
  extraBranchPriceXaf: optionalInt(0, 100_000_000),
  maxCountersPerBranch: optionalInt(1, 999),
  maxDisplaysPerBranch: optionalInt(0, 999),
  whatsappQuotaPerBranch: z.coerce.number().int().min(0).max(1_000_000),
  annualFreeMonths: z.coerce.number().int().min(0).max(11),
  voiceAnnouncements: formBoolean,
  appointments: formBoolean,
  remoteTickets: formBoolean,
  advancedStats: formBoolean,
  export: formBoolean,
  dedicatedSupport: formBoolean,
  active: formBoolean,
});

export const platformSettingsFormSchema = z.object({
  companyLegalName: z.string().trim().max(160),
  companyRc: z.string().trim().max(60),
  companyNiu: z.string().trim().max(60),
  companyAddress: z.string().trim().max(240),
  companyPhone: z.string().trim().max(40),
  companyEmail: z.string().trim().max(120),
  invoiceFooter: z.string().trim().max(500),
  trialDays: z.coerce.number().int().min(0).max(90),
  graceDays: z.coerce.number().int().min(0).max(60),
  readOnlyDays: z.coerce.number().int().min(1).max(60),
  retentionAfterSuspensionDays: z.coerce.number().int().min(7).max(365),
  defaultClosingTime: hhmm,
  vatRate: z.coerce.number().min(0).max(50),
  invoiceLeadDays: z.coerce.number().int().min(1).max(30),
  quotaAlertPercent: z.coerce.number().int().min(50).max(100),
});
