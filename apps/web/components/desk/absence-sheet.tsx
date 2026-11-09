"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ActiveAbsence = { id: string; kind: "absent" | "late"; until: string | null } | null;

/** « HH:MM » aujourd'hui (heure locale) → ISO, ou null si l'heure est passée. */
export function todayAt(time: string, now = new Date()): string | null {
  const m = time.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.getTime() > now.getTime() ? d.toISOString() : null;
}

function inMinutes(minutes: number): string {
  const d = new Date(Date.now() + minutes * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Déclaration d'absence ou de retard d'un praticien (§12.2), par lui-même ou par l'accueil.
 * Absent : réorientation automatique vers un collègue de la même spécialité. Retard : les patients l'attendent.
 */
export function AbsenceSheet({
  practitioner,
  active,
  open,
  onOpenChange,
  onDone,
}: {
  practitioner: { id: string; name: string };
  active: ActiveAbsence;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations("absence");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const supabase = getSupabaseBrowserClient();
  const [kind, setKind] = useState<"absent" | "late">("late");
  const [time, setTime] = useState(() => inMinutes(30));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function declare() {
    const until = kind === "late" ? todayAt(time) : null;
    if (kind === "late" && !until) return setError(te("time_invalid"));
    setPending(true);
    setError(null);
    const { data, error: e } = await supabase.rpc("declare_practitioner_absence", {
      p_practitioner: practitioner.id,
      p_kind: kind,
      p_until: until as string,
      p_reason: reason.trim() || (null as unknown as string),
    });
    setPending(false);
    if (e) return setError(te.has(e.message as never) ? te(e.message as never) : te("generic"));
    onOpenChange(false);
    onDone(kind === "absent" ? t("rerouted", { count: (data as { rerouted: number }).rerouted }) : t("activeLate", { time }));
  }

  async function markBack() {
    if (!active) return;
    setPending(true);
    const { error: e } = await supabase.rpc("end_practitioner_absence", { p_absence: active.id });
    setPending(false);
    if (e) return setError(te("generic"));
    onOpenChange(false);
    onDone(t("present"));
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${t("title")} · ${practitioner.name}`}
      description={kind === "absent" ? t("absentHint") : t("lateHint")}
      closeLabel={tc("close")}
      footer={
        <div className="flex flex-col gap-2">
          {error ? (
            <p role="alert" className="text-center text-subheadline text-red-text">
              {error}
            </p>
          ) : null}
          <Button block onClick={declare} loading={pending}>
            {t("declare")}
          </Button>
          {active ? (
            <Button block variant="tinted" onClick={markBack} disabled={pending}>
              {t("back")}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-5 pt-2">
        <SegmentedControl
          label={t("kind")}
          value={kind}
          onValueChange={setKind}
          options={[
            { value: "late", label: t("late") },
            { value: "absent", label: t("absent") },
          ]}
        />
        {kind === "late" ? (
          <TextField type="time" label={t("expectedAt")} value={time} onChange={(e) => setTime(e.target.value)} required />
        ) : null}
        <TextField label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </div>
    </Sheet>
  );
}
