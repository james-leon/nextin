"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, CheckCircle2, Clock, FileUp, Gamepad2, Plus, Trash2 } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { CAMPAIGN_STEPS, campaignSummary, canOpenStep, gamesOffer, packageBadges, stepNumber, visibleCities, type CampaignStep } from "@nextin/shared/ads";
import { saveCampaignStep, saveQuiz, submitCampaignStep } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { Sheet } from "@/components/ui/sheet";
import { StepProgress } from "@/components/ui/step-progress";
import { FormGroup, TextField } from "@/components/ui/text-field";
import type { ActionResult } from "@/lib/auth/errors";
import type { CreativeRow, PackageRow, SkinRow } from "@/lib/ads/types";
import { medalColor } from "@/lib/ads/format";
import { AD_FILE_LIMITS, uploadAdFile } from "@/lib/ads/upload";
import { cn } from "@/lib/cn";
import { BranchesSection, type BranchOption } from "./branches-section";
import type { CampaignInitial } from "./campaign-form";
import { CampaignSummaryCard } from "./campaign-summary";
import { CreativesSection } from "./creatives-section";
import type { QuizInitial } from "./quiz-editor";
import { SkinEditor } from "./skin-editor";

export type WizardProps = {
  step: CampaignStep;
  campaignId: string | null;
  advertiserId: string;
  packages: PackageRow[];
  orgTypes: readonly string[];
  cities: string[];
  today: string;
  initial: CampaignInitial;
  creatives: CreativeRow[];
  quiz: QuizInitial;
  skin: SkinRow | null;
  visa: { required: boolean; number: string | null; hasDocument: boolean };
  branchOptions: BranchOption[] | null;
  supabaseUrl: string;
};

type Action = (prev: ActionResult | null, data: FormData) => Promise<ActionResult>;

/**
 * Nouvelle campagne en cinq étapes (maquette v2 24) : 1 Formule · 2 Ciblage · 3 Visuels · 4 Jeux · 5 Envoi.
 * Frise numérotée sur tablette et ordinateur, « Étape 2 sur 5 » sur téléphone ; récapitulatif permanent à droite à
 * partir de 1 024 px (sur téléphone, c'est l'étape 5). « Continuer » enregistre le brouillon puis ouvre l'étape
 * suivante ; le retour garde ce qui est enregistré.
 */
export function CampaignWizard(props: WizardProps) {
  const t = useTranslations("ads");
  const locale = useLocale() === "en" ? "en" : "fr";
  const { step, campaignId, packages, initial, creatives, quiz } = props;
  const [name, setName] = useState(initial.name);
  const [packageCode, setPackageCode] = useState(initial.packageCode || (packages.find((p) => p.code === "argent") ?? packages[0])?.code || "");
  const [startsOn, setStartsOn] = useState(initial.startsOn);
  const [cities, setCities] = useState<string[]>(initial.targetCities);
  const [orgTypes, setOrgTypes] = useState<string[]>(initial.targetOrgTypes);
  const [schedules, setSchedules] = useState(initial.schedules);
  const pkg = packages.find((p) => p.code === packageCode) ?? null;
  const pkgName = pkg ? (locale === "en" ? pkg.name_en : pkg.name) : null;
  const progress = { saved: !!campaignId, creatives: creatives.length };
  const href = (n: number) => (campaignId ? `/ads/campaigns/${campaignId}/edit?step=${n}` : "/ads/campaigns/new");
  const summary = campaignSummary({
    package: pkg,
    startsOn,
    cities,
    orgTypes,
    creatives: creatives.map((c) => ({ kind: c.kind })),
    quizQuestions: quiz?.questions.length ?? 0,
  });
  const payload = JSON.stringify({
    name,
    packageCode,
    sector: initial.sector,
    startsOn,
    surfaces: pkg?.surfaces ?? ["tv"],
    targetCities: cities,
    targetOrgTypes: orgTypes,
    schedules,
  });

  let content: ReactNode = null;
  if (step === "package") {
    content = (
      <PackageStep
        action={saveCampaignStep.bind(null, campaignId ? { campaignId } : { advertiserId: props.advertiserId }, 2)}
        payload={payload}
        packages={packages}
        packageCode={packageCode}
        onPackage={setPackageCode}
        name={name}
        onName={setName}
        startsOn={startsOn}
        onStartsOn={setStartsOn}
        today={props.today}
      />
    );
  } else if (step === "targeting" && campaignId) {
    const chosen = props.branchOptions?.filter((o) => o.chosen).length ?? 0;
    content = (
      <TargetingStep
        action={saveCampaignStep.bind(null, { campaignId }, 3)}
        payload={payload}
        allCities={props.cities}
        cities={cities}
        onCities={setCities}
        allTypes={props.orgTypes}
        orgTypes={orgTypes}
        onOrgTypes={setOrgTypes}
        schedules={schedules}
        onSchedules={setSchedules}
        branches={
          <BranchesSection
            campaignId={campaignId}
            max={pkg?.max_branches ?? null}
            options={props.branchOptions}
            list={null}
            returnTo={href(2)}
            asRow={{
              title: t("wizard.summary.branches"),
              detail:
                pkg?.max_branches == null
                  ? t("wizard.branchesAll")
                  : chosen
                    ? t("branchesLimit", { count: chosen, max: pkg.max_branches })
                    : t("wizard.branchesMax", { count: pkg.max_branches }),
            }}
          />
        }
      />
    );
  } else if (step === "creatives" && campaignId) {
    content = (
      <div className="flex flex-col gap-6">
        <CreativesSection
          campaignId={campaignId}
          owner={props.advertiserId}
          creatives={creatives}
          editable
          videoAllowed={!!pkg && pkg.surfaces.length === 1 && pkg.surfaces[0] === "tv"}
          supabaseUrl={props.supabaseUrl}
          returnTo={href(3)}
        />
        <ContinueBar href={creatives.length ? href(4) : null} note={creatives.length ? null : t("wizard.creativeNeeded")} />
      </div>
    );
  } else if (step === "games" && campaignId && pkg) {
    const offer = gamesOffer(pkg);
    content =
      offer === "none" ? (
        <div className="flex flex-col gap-6">
          <CalloutCard tinted tone="neutral" icon={<Gamepad2 />} data-testid="games-none">
            <span className="block font-semibold">{t("wizard.gamesNone", { name: pkgName ?? "" })}</span>
            {t("wizard.gamesNoneHint")}
          </CalloutCard>
          <ContinueBar href={href(5)} />
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          {offer === "quiz_skin" ? (
            <SkinEditor campaignId={campaignId} owner={props.advertiserId} skin={props.skin} editable supabaseUrl={props.supabaseUrl} returnTo={href(4)} />
          ) : null}
          <QuizStep campaignId={campaignId} campaignName={name} quiz={quiz} next={href(5)} />
        </div>
      );
  } else if (step === "submit" && campaignId) {
    content = (
      <SubmitStep
        campaignId={campaignId}
        owner={props.advertiserId}
        visa={props.visa}
        summary={<CampaignSummaryCard variant="full" packageName={pkgName} durationDays={pkg?.duration_days ?? null} summary={summary} quizAllowed={pkg?.quiz_allowed} />}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Stepper current={step} progress={progress} href={href} />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="@container flex min-w-0 flex-col gap-6">{content}</div>
        {step !== "submit" ? (
          <aside aria-label={t("summaryTitle")} className="hidden flex-col gap-1.5 lg:sticky lg:top-6 lg:flex">
            <p className="px-4 text-footnote tracking-wide text-label-secondary uppercase">{t("summaryTitle")}</p>
            <CampaignSummaryCard variant="aside" packageName={pkgName} durationDays={pkg?.duration_days ?? null} summary={summary} />
            <p className="px-4 text-footnote text-label-secondary">{t("wizard.summaryNote")}</p>
          </aside>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">
        {pkg && step === "package" ? `${pkgName} · ${pkg.price_xaf ? formatXaf(pkg.price_xaf, locale) : t("free")}` : ""}
      </span>
    </div>
  );
}

/** Frise numérotée (tablette et ordinateur) ; « Étape 2 sur 5 » et traits sur téléphone. */
function Stepper({ current, progress, href }: { current: CampaignStep; progress: { saved: boolean; creatives: number }; href: (n: number) => string }) {
  const t = useTranslations("ads.wizard");
  const index = stepNumber(current);
  return (
    <>
      <StepProgress className="md:hidden" step={index} total={CAMPAIGN_STEPS.length} label={t("stepOf", { n: index, total: CAMPAIGN_STEPS.length })} />
      <nav aria-label={t("progress")} className="hidden md:block">
        <ol className="flex flex-wrap items-center gap-2" data-testid="wizard-stepper">
          {CAMPAIGN_STEPS.map((s, i) => {
            const n = i + 1;
            const on = s === current;
            const done = n < index;
            const open = !on && canOpenStep(s, progress);
            const inner = (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full font-rounded text-caption font-bold",
                    on && "bg-primary text-on-accent",
                    done && "bg-green text-white",
                    !on && !done && "border-[1.5px] border-label-tertiary text-label-secondary",
                  )}
                >
                  {done ? <Check className="size-3.5 stroke-[3]" /> : n}
                </span>
                <span className={cn("text-footnote", on ? "font-semibold text-label" : "text-label-secondary")}>{t(`steps.${s}`)}</span>
              </>
            );
            return (
              <li key={s} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden className="h-px w-5 bg-separator" /> : null}
                {open ? (
                  <Link href={href(n)} className="pressable flex min-h-11 items-center gap-2 rounded-[8px] px-1">
                    {inner}
                  </Link>
                ) : (
                  <span aria-current={on ? "step" : undefined} className="flex min-h-11 items-center gap-2 px-1">
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/** « Continuer » d'une étape sans formulaire (lien vers l'étape suivante), désactivé avec sa raison si besoin. */
function ContinueBar({ href, note }: { href: string | null; note?: string | null }) {
  const t = useTranslations("ads.wizard");
  return (
    <BottomBar dock={false} summary={note ?? undefined}>
      {href ? (
        <Button asChild block>
          <Link href={href}>{t("continue")}</Link>
        </Button>
      ) : (
        <Button block disabled>
          {t("continue")}
        </Button>
      )}
    </BottomBar>
  );
}

/** Étape 1 : nom, début de la diffusion, puis la formule (cartes à choix unique, prix et durée de la base). */
function PackageStep({
  action,
  payload,
  packages,
  packageCode,
  onPackage,
  name,
  onName,
  startsOn,
  onStartsOn,
  today,
}: {
  action: Action;
  payload: string;
  packages: PackageRow[];
  packageCode: string;
  onPackage: (code: string) => void;
  name: string;
  onName: (v: string) => void;
  startsOn: string;
  onStartsOn: (v: string) => void;
  today: string;
}) {
  const t = useTranslations("ads");
  const locale = useLocale() === "en" ? "en" : "fr";
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <input type="hidden" name="payload" value={payload} />
      <FormGroup>
        <TextField grouped label={t("name")} placeholder={t("namePlaceholder")} value={name} onChange={(e) => onName(e.target.value)} maxLength={120} required error={field("name")} />
        <TextField grouped type="date" label={t("startsOn")} min={today} value={startsOn} onChange={(e) => onStartsOn(e.target.value)} error={field("startsOn")} />
      </FormGroup>
      <section aria-labelledby="pkg-title" className="flex flex-col gap-1.5">
        <h2 id="pkg-title" className="px-4 text-footnote tracking-wide text-label-secondary uppercase">
          {t("wizard.packageSection")}
        </h2>
        <div role="radiogroup" aria-labelledby="pkg-title" className="squircle flex flex-col overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary [&>*+*]:hairline-t">
          {packages.map((p) => {
            const selected = p.code === packageCode;
            const label = locale === "en" ? p.name_en : p.name;
            return (
              <button
                key={p.code}
                type="button"
                role="radio"
                aria-checked={selected}
                data-package={p.code}
                onClick={() => onPackage(p.code)}
                className={cn(
                  "pressable flex w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline-none",
                  selected && "bg-accent-tint",
                )}
              >
                <span aria-hidden className="mt-0.5 flex size-[1.875rem] shrink-0 items-center justify-center rounded-full text-caption font-extrabold text-white" style={{ background: medalColor(p.code) }}>
                  {label.charAt(0).toUpperCase()}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-headline">{label}</span>
                  {p.description ? <span className="text-footnote text-label-secondary">{locale === "en" ? (p.description_en ?? p.description) : p.description}</span> : null}
                  <span className="flex flex-wrap gap-1.5 pt-0.5">
                    {packageBadges(p).map((b) => (
                      <span key={b} className="rounded-full bg-fill-tertiary px-2 py-0.5 text-caption font-semibold text-label">
                        {t(`badges.${b}` as "badges.tv")}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end text-right">
                  <span className="font-rounded text-headline font-bold tabular">{p.price_xaf ? formatXaf(p.price_xaf, locale) : t("free")}</span>
                  <span className="text-caption text-label-secondary">{t("days", { count: p.duration_days })}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <BottomBar dock={false}>
        <Button type="submit" block loading={pending} loadingLabel={t("wizard.saving")} disabled={!packageCode}>
          {t("wizard.continue")}
        </Button>
      </BottomBar>
    </form>
  );
}

/** Pastilles à cocher (villes, types d'établissement) : cochée = bleu nuit plein. */
function Pills({ label, options, selected, onChange, more }: { label: string; options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void; more?: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2 p-3">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(on ? selected.filter((x) => x !== o.value) : [...selected, o.value])}
            className={cn("pressable min-h-11 rounded-full px-4 text-subheadline", on ? "bg-primary font-semibold text-on-accent" : "bg-fill-tertiary text-label")}
          >
            {o.label}
          </button>
        );
      })}
      {more}
    </div>
  );
}

/** Étape 2 : villes et types en pastilles (rien de coché = partout), agences choisies, plages de diffusion. */
function TargetingStep({
  action,
  payload,
  allCities,
  cities,
  onCities,
  allTypes,
  orgTypes,
  onOrgTypes,
  schedules,
  onSchedules,
  branches,
}: {
  action: Action;
  payload: string;
  allCities: string[];
  cities: string[];
  onCities: (v: string[]) => void;
  allTypes: readonly string[];
  orgTypes: string[];
  onOrgTypes: (v: string[]) => void;
  schedules: CampaignInitial["schedules"];
  onSchedules: (v: CampaignInitial["schedules"]) => void;
  branches: ReactNode;
}) {
  const t = useTranslations("ads");
  const tt = useTranslations("orgTypes");
  const [state, formAction, pending] = useActionState(action, null);
  const { top } = useFormErrors(state);
  const [expanded, setExpanded] = useState(false);
  const [sheet, setSheet] = useState(false);
  const shown = visibleCities(allCities, cities, expanded);
  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <input type="hidden" name="payload" value={payload} />
      <section className="flex flex-col gap-1.5">
        <h2 className="px-4 text-footnote tracking-wide text-label-secondary uppercase">{t("cities")}</h2>
        <div className="squircle rounded-[var(--radius-lg)] bg-grouped-secondary">
          {allCities.length ? (
            <Pills
              label={t("cities")}
              options={shown.shown.map((c) => ({ value: c, label: c }))}
              selected={cities}
              onChange={onCities}
              more={
                shown.hidden ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    aria-label={t("wizard.citiesMoreLabel", { count: shown.hidden })}
                    className="pressable min-h-11 rounded-full bg-fill-tertiary px-4 text-subheadline font-semibold text-label"
                  >
                    {t("wizard.citiesMore", { count: shown.hidden })}
                  </button>
                ) : null
              }
            />
          ) : (
            <p className="p-4 text-subheadline text-label-secondary">{t("wizard.citiesEmpty")}</p>
          )}
        </div>
        <p className="px-4 text-footnote text-label-secondary">{t("citiesHint")}</p>
      </section>
      <section className="flex flex-col gap-1.5">
        <h2 className="px-4 text-footnote tracking-wide text-label-secondary uppercase">{t("orgTypes")}</h2>
        <div className="squircle rounded-[var(--radius-lg)] bg-grouped-secondary">
          <Pills label={t("orgTypes")} options={allTypes.map((o) => ({ value: o, label: tt(o as "clinic") }))} selected={orgTypes} onChange={onOrgTypes} />
        </div>
        <p className="px-4 text-footnote text-label-secondary">{t("orgTypesHint")}</p>
      </section>
      <ListSection>
        {branches}
        <ListRow
          onClick={() => setSheet(true)}
          icon={
            <ListIcon color="var(--icon-indigo)">
              <Clock />
            </ListIcon>
          }
          title={t("schedules")}
          subtitle={t("summarySchedules", { count: schedules.length })}
          accessory="chevron"
        />
      </ListSection>
      <SchedulesSheet open={sheet} onOpenChange={setSheet} schedules={schedules} onChange={onSchedules} />
      <BottomBar dock={false}>
        <Button type="submit" block loading={pending} loadingLabel={t("wizard.saving")}>
          {t("wizard.continue")}
        </Button>
      </BottomBar>
    </form>
  );
}

/** Plages de diffusion (`ad_schedules`) dans une feuille ; enregistrées avec « Continuer ». */
function SchedulesSheet({
  open,
  onOpenChange,
  schedules,
  onChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  schedules: CampaignInitial["schedules"];
  onChange: (v: CampaignInitial["schedules"]) => void;
}) {
  const t = useTranslations("ads");
  const tw = useTranslations("weekdays");
  const tc = useTranslations("common");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("wizard.schedulesTitle")}
      description={t("schedulesHint")}
      closeLabel={tc("close")}
      footer={
        <Button type="button" block onClick={() => onOpenChange(false)}>
          {t("wizard.schedulesDone")}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        {schedules.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <SelectField
              label={t("weekday")}
              value={String(s.weekday)}
              onChange={(e) => onChange(schedules.map((x, j) => (j === i ? { ...x, weekday: Number(e.target.value) } : x)))}
              options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: tw(String(d) as "1") }))}
            />
            <TextField type="time" label={t("from")} value={s.start_time} onChange={(e) => onChange(schedules.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} />
            <TextField type="time" label={t("to")} value={s.end_time} onChange={(e) => onChange(schedules.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))} />
            <IconButton label={t("removeSchedule")} icon={<Trash2 />} variant="plain" onClick={() => onChange(schedules.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button type="button" variant="gray" size="md" className="self-start" leadingIcon={<Plus />} onClick={() => onChange([...schedules, { weekday: 1, start_time: "08:00", end_time: "12:00" }])}>
          {t("addSchedule")}
        </Button>
      </div>
    </Sheet>
  );
}

type Question = { question: string; answers: { text: string; correct: boolean }[] };
const blank = (): Question => ({ question: "", answers: [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }] });

/**
 * Étape 4 (Argent, Or) : quiz sponsorisé — récompense, validité du bon, puis « Question 1 sur 3 » avec ses réponses,
 * la bonne cochée en vert. Facultatif : sans rien saisir, « Continuer » passe à l'envoi.
 */
function QuizStep({ campaignId, campaignName, quiz, next }: { campaignId: string; campaignName: string; quiz: QuizInitial; next: string }) {
  const t = useTranslations("ads");
  const router = useRouter();
  const [state, action, pending] = useActionState(saveQuiz.bind(null, campaignId), null);
  const { top } = useFormErrors(state);
  const [reward, setReward] = useState(quiz?.reward_text ?? "");
  const [validity, setValidity] = useState(quiz?.coupon_validity_days ?? 15);
  const [questions, setQuestions] = useState<Question[]>(
    quiz?.questions.map((q) => ({ question: q.question, answers: q.answers.map((a) => ({ text: a.text, correct: !!a.correct })) })) ?? [blank(), blank(), blank()],
  );
  const untouched = !quiz && !reward.trim() && questions.every((q) => !q.question.trim() && q.answers.every((a) => !a.text.trim()));
  const update = (i: number, fn: (q: Question) => Question) => setQuestions((cur) => cur.map((q, j) => (j === i ? fn(q) : q)));
  const payload = useMemo(
    () =>
      JSON.stringify({
        title: quiz?.title ?? campaignName,
        rewardText: reward,
        couponValidityDays: validity,
        maxCoupons: quiz?.max_coupons ?? null,
        questions: questions.map((q) => ({ question: q.question, answers: q.answers.filter((a) => a.text.trim() || a.correct) })),
      }),
    [quiz, campaignName, reward, validity, questions],
  );
  const onSubmit = (e: FormEvent) => {
    // Quiz facultatif : rien saisi, on passe à l'envoi sans rien enregistrer.
    if (untouched) {
      e.preventDefault();
      router.push(next);
    }
  };
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col gap-6" data-testid="quiz-step">
      <input type="hidden" name="payload" value={payload} />
      <input type="hidden" name="returnTo" value={next} />
      <div className="flex flex-col gap-1 px-4">
        <h2 className="text-title3 font-bold">{t("wizard.quizTitle")}</h2>
        <p className="text-footnote text-label-secondary">{t("wizard.quizOptional")}</p>
      </div>
      <FormError message={top} />
      <FormGroup>
        <TextField grouped label={t("reward")} placeholder={t("rewardPlaceholder")} value={reward} onChange={(e) => setReward(e.target.value)} maxLength={120} />
        <TextField grouped type="number" inputMode="numeric" min={1} max={365} label={t("couponValidity")} value={validity} onChange={(e) => setValidity(Number(e.target.value))} />
      </FormGroup>
      {questions.map((q, i) => (
        <fieldset key={i} className="flex min-w-0 flex-col gap-1.5">
          <legend className="sr-only">{t("wizard.questionOf", { n: i + 1, total: questions.length })}</legend>
          <div className="flex min-h-11 items-center justify-between gap-2 px-4">
            <span aria-hidden className="text-footnote tracking-wide text-label-secondary uppercase">
              {t("wizard.questionOf", { n: i + 1, total: questions.length })}
            </span>
            {questions.length > 3 ? (
              <IconButton label={t("removeQuestion")} icon={<Trash2 />} variant="plain" onClick={() => setQuestions((cur) => cur.filter((_, j) => j !== i))} />
            ) : null}
          </div>
          <div className="squircle flex flex-col overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary">
            <input
              aria-label={t("question", { n: i + 1 })}
              value={q.question}
              maxLength={160}
              onChange={(e) => update(i, (x) => ({ ...x, question: e.target.value }))}
              placeholder={t("question", { n: i + 1 })}
              className="min-h-12 w-full min-w-0 bg-transparent px-4 text-body text-label placeholder:text-label-tertiary"
              style={{ outlineOffset: -3 }}
            />
            <div role="radiogroup" aria-label={t("correct")} className="flex flex-col">
              {q.answers.map((a, k) => (
                <div key={k} className="flex items-center gap-1 pl-1.5 hairline-t">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={a.correct}
                    aria-label={`${t("correct")} : ${t("answer", { n: k + 1 })}`}
                    onClick={() => update(i, (x) => ({ ...x, answers: x.answers.map((y, m) => ({ ...y, correct: m === k })) }))}
                    className="pressable flex size-11 shrink-0 items-center justify-center rounded-full"
                  >
                    <span
                      aria-hidden
                      className={cn("size-[1.375rem] rounded-full", a.correct ? "border-[7px] border-green" : "border-[1.5px] border-label-tertiary")}
                    />
                  </button>
                  <input
                    aria-label={t("answer", { n: k + 1 })}
                    value={a.text}
                    maxLength={80}
                    placeholder={t("answer", { n: k + 1 })}
                    onChange={(e) => update(i, (x) => ({ ...x, answers: x.answers.map((y, m) => (m === k ? { ...y, text: e.target.value } : y)) }))}
                    className="h-11 min-w-0 flex-1 bg-transparent pr-4 text-body text-label outline-none placeholder:text-label-tertiary"
                  />
                </div>
              ))}
            </div>
          </div>
          {q.answers.length < 4 ? (
            <Button type="button" variant="plain" size="md" className="self-start" leadingIcon={<Plus />} onClick={() => update(i, (x) => ({ ...x, answers: [...x.answers, { text: "", correct: false }] }))}>
              {t("addAnswer")}
            </Button>
          ) : null}
        </fieldset>
      ))}
      <p className="px-4 text-footnote text-label-secondary">{t("wizard.quizHint")}</p>
      {questions.length < 5 ? (
        <Button type="button" variant="gray" className="self-start" leadingIcon={<Plus />} onClick={() => setQuestions((cur) => [...cur, blank()])}>
          {t("addQuestion")}
        </Button>
      ) : null}
      <BottomBar dock={false}>
        <Button type="submit" block loading={pending} loadingLabel={t("wizard.saving")}>
          {t("wizard.continue")}
        </Button>
      </BottomBar>
    </form>
  );
}

/**
 * Étape 5 : récapitulatif, visa du ministère de la Santé (seulement si le secteur l'exige : numéro et justificatif),
 * puis « Soumettre à la validation ». La base refuse l'envoi sans visa : la raison s'affiche telle quelle.
 */
function SubmitStep({ campaignId, owner, visa, summary }: { campaignId: string; owner: string; visa: WizardProps["visa"]; summary: ReactNode }) {
  const t = useTranslations("ads");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(submitCampaignStep.bind(null, campaignId), null);
  const { field, top } = useFormErrors(state);
  const [path, setPath] = useState("");
  // Champ contrôlé : React vide un formulaire après son action, le numéro saisi doit rester affiché après un refus.
  const [number, setNumber] = useState(visa.number ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const hasDocument = visa.hasDocument || !!path;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const r = await uploadAdFile("ad-documents", owner, campaignId, file, AD_FILE_LIMITS.document);
    setUploading(false);
    if (r.ok) setPath(r.path);
    else setUploadError(r.error === "file_too_large" ? t("tooLarge", { max: "10 Mo" }) : te("generic"));
  }

  const fileInput = <input type="file" accept="application/pdf,image/jpeg,image/png" className="absolute inset-0 cursor-pointer opacity-0" onChange={(e) => onFile(e.target.files?.[0])} data-testid="visa-file" />;
  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {summary}
      <p className="-mt-4 px-4 text-footnote text-label-secondary">{t("wizard.summaryNote")}</p>
      <FormError message={top ?? uploadError} />
      {visa.required ? (
        <section aria-labelledby="visa-title" className="flex flex-col gap-1.5">
          <h2 id="visa-title" className="px-4 text-footnote tracking-wide text-label-secondary uppercase">
            {t("visaTitle")}
          </h2>
          <FormGroup>
            <TextField grouped name="visaNumber" label={t("visaNumber")} value={number} onChange={(e) => setNumber(e.target.value)} maxLength={60} error={field("visaNumber")} />
            {hasDocument ? (
              <div className="flex min-h-11 items-center gap-3 px-4" data-testid="visa-document">
                <CheckCircle2 aria-hidden className="size-5 shrink-0 text-green-text" />
                <span className="flex-1 text-body">{t("visaUploaded")}</span>
                <label className="pressable relative flex min-h-11 cursor-pointer items-center text-subheadline text-accent-text">
                  {t("wizard.visaReplace")}
                  {fileInput}
                </label>
              </div>
            ) : (
              <label className="pressable relative flex min-h-11 cursor-pointer items-center gap-3 px-4 text-accent-text">
                <FileUp aria-hidden className="size-5" />
                <span className="text-body">{uploading ? t("uploading") : t("wizard.visaAdd")}</span>
                {fileInput}
              </label>
            )}
          </FormGroup>
          <input type="hidden" name="visaPath" value={path} />
          <p className="px-4 text-footnote text-label-secondary">{t("wizard.visaHint")}</p>
        </section>
      ) : null}
      <BottomBar dock={false}>
        <Button type="submit" block loading={pending || uploading} loadingLabel={uploading ? t("uploading") : t("submitting")}>
          {t("submit")}
        </Button>
      </BottomBar>
    </form>
  );
}
