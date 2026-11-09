"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { deleteQuiz, saveQuiz } from "@/app/(staff)/ads/actions";
import { FormError } from "@/components/auth/form-error";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { useFormErrors } from "@/components/admin/use-form-errors";
import { Button, IconButton } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import type { QuizAnswer } from "@/lib/ads/types";

type Question = { question: string; answers: { text: string; correct: boolean }[] };
export type QuizInitial = {
  title: string;
  reward_text: string;
  coupon_validity_days: number;
  max_coupons: number | null;
  questions: { question: string; answers: QuizAnswer[] }[];
} | null;

const blank = (): Question => ({ question: "", answers: [{ text: "", correct: true }, { text: "", correct: false }] });

/** Quiz sponsorisé : aperçu des questions (bonne réponse cochée), édition dans une feuille. */
export function QuizEditor({ campaignId, quiz, editable }: { campaignId: string; quiz: QuizInitial; editable: boolean }) {
  const t = useTranslations("ads");
  const ta = useTranslations("admin");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveQuiz.bind(null, campaignId), null);
  const { top } = useFormErrors(state);
  const [title, setTitle] = useState(quiz?.title ?? "");
  const [reward, setReward] = useState(quiz?.reward_text ?? "");
  const [validity, setValidity] = useState(quiz?.coupon_validity_days ?? 30);
  const [max, setMax] = useState<string>(quiz?.max_coupons ? String(quiz.max_coupons) : "");
  const [questions, setQuestions] = useState<Question[]>(
    quiz?.questions.map((q) => ({ question: q.question, answers: q.answers.map((a) => ({ text: a.text, correct: !!a.correct })) })) ?? [blank(), blank(), blank()],
  );
  const update = (i: number, fn: (q: Question) => Question) => setQuestions((cur) => cur.map((q, j) => (j === i ? fn(q) : q)));
  const payload = JSON.stringify({ title, rewardText: reward, couponValidityDays: validity, maxCoupons: max ? Number(max) : null, questions });

  return (
    <section aria-labelledby="quiz-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-4">
        <h2 id="quiz-title" className="text-title3 font-bold">
          {t("quiz")}
        </h2>
        {editable ? (
          <Button variant="gray" size="md" onClick={() => setOpen(true)}>
            {quiz ? t("editQuiz") : t("createQuiz")}
          </Button>
        ) : null}
      </div>
      {quiz ? (
        <ListSection header={`${quiz.title} · ${quiz.reward_text}`}>
          {quiz.questions.map((q, i) => (
            <ListRow key={i} title={q.question} subtitle={q.answers.map((a) => (a.correct ? `✓ ${a.text}` : a.text)).join(" · ")} />
          ))}
        </ListSection>
      ) : (
        <p className="px-4 text-footnote text-label-secondary">{t("quizHint")}</p>
      )}
      {quiz && editable ? (
        <ConfirmAction action={deleteQuiz.bind(null, campaignId)} label={t("deleteQuiz")} title={t("deleteQuiz")} body={quiz.title} confirmLabel={ta("delete")} size="md" />
      ) : null}

      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={quiz ? t("editQuiz") : t("createQuiz")}
        description={t("quizHint")}
        closeLabel={tc("close")}
        footer={
          <Button type="submit" form="quiz-form" block loading={pending} loadingLabel={t("saving")}>
            {t("save")}
          </Button>
        }
      >
        <form id="quiz-form" action={action} noValidate className="flex flex-col gap-5 pt-2">
          <FormError message={top} />
          <input type="hidden" name="payload" value={payload} />
          <TextField label={t("quizTitle")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
          <TextField label={t("reward")} placeholder={t("rewardPlaceholder")} value={reward} onChange={(e) => setReward(e.target.value)} maxLength={120} required />
          <div className="grid grid-cols-2 gap-3">
            <TextField type="number" inputMode="numeric" min={1} max={365} label={t("couponValidity")} value={validity} onChange={(e) => setValidity(Number(e.target.value))} />
            <TextField type="number" inputMode="numeric" min={1} label={t("maxCoupons")} value={max} onChange={(e) => setMax(e.target.value)} />
          </div>
          {questions.map((q, i) => (
            <fieldset key={i} className="flex flex-col gap-2">
              <div className="flex items-end gap-2">
                <TextField
                  label={t("question", { n: i + 1 })}
                  value={q.question}
                  onChange={(e) => update(i, (x) => ({ ...x, question: e.target.value }))}
                  maxLength={160}
                  required
                />
                {questions.length > 3 ? (
                  <IconButton label={t("removeQuestion")} icon={<Trash2 />} variant="plain" onClick={() => setQuestions((cur) => cur.filter((_, j) => j !== i))} />
                ) : null}
              </div>
              <ListSection radioGroupLabel={t("correct")}>
                {q.answers.map((a, k) => (
                  <li key={k} className="group/row flex items-center gap-2 pl-2">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={a.correct}
                      aria-label={`${t("correct")} : ${t("answer", { n: k + 1 })}`}
                      onClick={() => update(i, (x) => ({ ...x, answers: x.answers.map((y, m) => ({ ...y, correct: m === k })) }))}
                      className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-accent-text"
                    >
                      {a.correct ? <CheckCircle2 aria-hidden className="size-6" /> : <Circle aria-hidden className="size-6 text-label-tertiary" />}
                    </button>
                    <input
                      aria-label={t("answer", { n: k + 1 })}
                      value={a.text}
                      maxLength={80}
                      onChange={(e) => update(i, (x) => ({ ...x, answers: x.answers.map((y, m) => (m === k ? { ...y, text: e.target.value } : y)) }))}
                      className="h-11 min-w-0 flex-1 bg-transparent pr-4 text-body text-label outline-none list-separator"
                    />
                  </li>
                ))}
              </ListSection>
              {q.answers.length < 4 ? (
                <Button
                  type="button"
                  variant="plain"
                  size="md"
                  className="self-start"
                  leadingIcon={<Plus />}
                  onClick={() => update(i, (x) => ({ ...x, answers: [...x.answers, { text: "", correct: false }] }))}
                >
                  {t("addAnswer")}
                </Button>
              ) : null}
            </fieldset>
          ))}
          {questions.length < 5 ? (
            <Button type="button" variant="gray" leadingIcon={<Plus />} onClick={() => setQuestions((cur) => [...cur, blank()])}>
              {t("addQuestion")}
            </Button>
          ) : null}
        </form>
      </Sheet>
    </section>
  );
}
