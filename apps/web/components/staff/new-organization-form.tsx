"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { slugify } from "@nextin/shared";
import { ORG_TYPES } from "@nextin/shared/schemas";
import { createOrganization } from "@/app/(staff)/app/new/actions";
import { FormError } from "@/components/auth/form-error";
import { Turnstile } from "@/components/security/turnstile";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TextField } from "@/components/ui/text-field";
import { OrgTypeIcon } from "./org-type-icon";

type OrgType = (typeof ORG_TYPES)[number];

export function NewOrganizationForm({ siteKey, defaultLocale }: { siteKey: string | null; defaultLocale: "fr" | "en" }) {
  const t = useTranslations("orgNew");
  const tt = useTranslations("orgTypes");
  const te = useTranslations("errors");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(createOrganization, null);
  const [name, setName] = useState("");
  const [type, setType] = useState<OrgType | "">("");
  const [locale, setLocale] = useState<"fr" | "en">(defaultLocale);

  const fieldError = (f: string) => {
    const code = state && !state.ok ? state.fieldErrors?.[f] : undefined;
    return code ? te(code) : undefined;
  };
  const topError = state && !state.ok && !state.fieldErrors ? te(state.error) : null;
  const typeError = fieldError("type");

  return (
    <form action={action} noValidate className="pb-36">
      <NavigationBar title={t("title")} back={{ href: "/app", label: t("back") }} />
      <div className="mx-auto flex max-w-3xl flex-col gap-7 px-4 pt-3">
        <FormError message={topError} />
        <TextField
          name="name"
          label={t("name")}
          placeholder={t("namePlaceholder")}
          hint={name.trim().length >= 2 ? t("identifier", { slug: slugify(name) }) : t("nameHint")}
          autoComplete="organization"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          error={fieldError("name")}
        />

        <div className="flex flex-col gap-1.5">
          <ListSection header={t("sector")} radioGroupLabel={t("sector")}>
            {ORG_TYPES.map((value) => (
              <ListRow
                key={value}
                role="radio"
                selected={type === value}
                onClick={() => setType(value)}
                icon={
                  <ListIcon color="var(--brand-tile)">
                    <OrgTypeIcon type={value} />
                  </ListIcon>
                }
                title={tt(value)}
                accessory="check"
              />
            ))}
          </ListSection>
          {typeError ? (
            <p role="alert" className="px-4 text-footnote text-red-text">
              {typeError}
            </p>
          ) : null}
          <input type="hidden" name="type" value={type} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="org-locale-label" className="px-4 text-footnote uppercase text-label-secondary">
            {t("language")}
          </span>
          <SegmentedControl
            label={t("language")}
            value={locale}
            onValueChange={setLocale}
            options={[
              { value: "fr", label: tc("french") },
              { value: "en", label: tc("english") },
            ]}
          />
          <input type="hidden" name="defaultLocale" value={locale} />
        </div>

        <p className="px-4 text-footnote text-label-secondary">{t("footer")}</p>
        <Turnstile key={String(pending)} siteKey={siteKey} action="create_organization" />
      </div>
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={t("submitting")}>
          {t("submit")}
        </Button>
      </BottomBar>
    </form>
  );
}
