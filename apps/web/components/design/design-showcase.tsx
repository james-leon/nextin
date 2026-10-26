"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Bell,
  Building2,
  CheckCircle2,
  DoorOpen,
  FlaskConical,
  MapPin,
  MoreHorizontal,
  QrCode,
  ScanLine,
  Share,
  Stethoscope,
  Ticket,
  TrendingDown,
  UserRound,
  Users,
  WifiOff,
} from "lucide-react";
import { normalizeCameroonPhone } from "@nextin/shared";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/cn";
import { useThemePreference, type ThemePreference } from "@/components/theme/theme";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TabBar } from "@/components/ui/tab-bar";
import { SearchField, TextField } from "@/components/ui/text-field";
import { TicketHero } from "@/components/ui/ticket-hero";
import { useToast } from "@/components/ui/toast";

const SECTIONS = [
  "typography",
  "colors",
  "buttons",
  "lists",
  "cards",
  "toggles",
  "segmented",
  "fields",
  "navigation",
  "tabbar",
  "sheet",
  "alerts",
  "badges",
  "ticket",
] as const;
type SectionKey = (typeof SECTIONS)[number];

function Section({ id, title, children }: { id: SectionKey; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-16">
      <h2 id={`${id}-title`} className="px-1 pb-3 text-title2 font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DesignShowcase() {
  const t = useTranslations("design");
  const tc = useTranslations("common");
  const tt = useTranslations("theme");

  return (
    <div className="pb-24">
      <NavigationBar title={t("title")} contentClassName="max-w-6xl">
        <p className="mt-1 text-subheadline text-label-secondary">{t("subtitle")}</p>
      </NavigationBar>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label={t("title")} className="sticky top-16">
            <ListSection>
              {SECTIONS.map((key) => (
                <ListRow key={key} title={t(`nav.${key}`)} href={`#${key}`} accessory="chevron" />
              ))}
            </ListSection>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-12">
          <Preferences themeLabel={tt("label")} languageLabel={tc("language")} />
          <TypographySection />
          <ColorsSection />
          <ButtonsSection />
          <ListsSection />
          <CardsSection />
          <TogglesSection />
          <SegmentedSection />
          <FieldsSection />
          <NavigationSection />
          <TabBarSection />
          <SheetSection />
          <AlertsSection />
          <BadgesSection />
          <TicketSection />
        </div>
      </div>
    </div>
  );
}

function Preferences({ themeLabel, languageLabel }: { themeLabel: string; languageLabel: string }) {
  const tt = useTranslations("theme");
  const tc = useTranslations("common");
  const [pref, setPref] = useThemePreference();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <span className="px-1 text-footnote uppercase text-label-secondary">{themeLabel}</span>
        <SegmentedControl<ThemePreference>
          label={themeLabel}
          value={pref}
          onValueChange={setPref}
          options={[
            { value: "auto", label: tt("auto") },
            { value: "light", label: tt("light") },
            { value: "dark", label: tt("dark") },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="flex items-center gap-2 px-1 text-footnote uppercase text-label-secondary">
          {languageLabel}
          {pending ? <Spinner className="size-3.5" /> : null}
        </span>
        <SegmentedControl
          label={languageLabel}
          value={locale}
          onValueChange={(v) =>
            startTransition(async () => {
              await setLocale(v);
              router.refresh();
            })
          }
          options={[
            { value: "fr", label: tc("french") },
            { value: "en", label: tc("english") },
          ]}
        />
      </div>
    </Card>
  );
}

function TypographySection() {
  const t = useTranslations("design");
  const styles = [
    { key: "largeTitle", cls: "text-large-title font-bold", spec: "34 / 41 · Bold" },
    { key: "title1", cls: "text-title1 font-bold", spec: "28 / 34 · Bold" },
    { key: "title2", cls: "text-title2 font-bold", spec: "22 / 28 · Bold" },
    { key: "title3", cls: "text-title3 font-semibold", spec: "20 / 25 · Semibold" },
    { key: "headline", cls: "text-headline font-semibold", spec: "17 / 22 · Semibold" },
    { key: "body", cls: "text-body", spec: "17 / 22 · Regular" },
    { key: "callout", cls: "text-callout", spec: "16 / 21 · Regular" },
    { key: "subheadline", cls: "text-subheadline", spec: "15 / 20 · Regular" },
    { key: "footnote", cls: "text-footnote", spec: "13 / 18 · Regular" },
    { key: "caption", cls: "text-caption", spec: "12 / 16 · Regular" },
  ] as const;
  return (
    <Section id="typography" title={t("nav.typography")}>
      <ListSection footer={t("typography.dynamicType")}>
        {styles.map((s) => (
          <li key={s.key} className="group/row flex flex-col gap-0.5 px-4 py-3 hairline-b last:shadow-none">
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-footnote font-semibold text-label-secondary">{t(`typography.${s.key}`)}</span>
              <span className="text-caption text-label-secondary tabular">{s.spec}</span>
            </span>
            <span className={cn(s.cls, "truncate")}>{t("typography.sample")}</span>
          </li>
        ))}
      </ListSection>
    </Section>
  );
}

function Swatch({ name, value, bg, ring }: { name: string; value: string; bg: string; ring?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        aria-hidden
        className={cn("squircle block h-16 rounded-[var(--radius-lg)]", ring && "shadow-[inset_0_0_0_0.5px_var(--separator)]")}
        style={{ background: bg }}
      />
      <span className="flex flex-col px-1">
        <span className="text-subheadline font-medium">{name}</span>
        <span className="text-caption text-label-secondary uppercase tabular">{value}</span>
      </span>
    </div>
  );
}

function ColorsSection() {
  const t = useTranslations("design.colors");
  const tn = useTranslations("design.nav");
  return (
    <Section id="colors" title={tn("colors")}>
      <div className="flex flex-col gap-4">
        <Card>
          <CardTitle className="pb-3">{t("brand")}</CardTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Swatch name={t("navy")} value="#0D2C54" bg="var(--navy)" />
            <Swatch name={t("blue")} value="#1A6BB5" bg="var(--accent-fill)" />
            <Swatch name={t("orange")} value="#F58B1F" bg="var(--orange-fill)" />
            <Swatch name={t("green")} value="#2EC04E" bg="var(--green-fill)" />
            <Swatch name={t("red")} value="#D70015" bg="var(--red-fill)" />
          </div>
        </Card>
        <Card>
          <CardTitle className="pb-3">{t("system")}</CardTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Swatch name={t("groupedBg")} value="#F2F2F7 · #000000" bg="var(--bg-grouped)" ring />
            <Swatch name={t("card")} value="#FFFFFF · #1C1C1E" bg="var(--bg-grouped-secondary)" ring />
            <Swatch name={t("label")} value="#000000 · #FFFFFF" bg="var(--label)" />
            <Swatch name={t("secondaryLabel")} value="60% · 60%" bg="var(--label-secondary)" />
            <Swatch name={t("separator")} value="0,5 px" bg="var(--separator)" />
            <Swatch name={t("fill")} value="20% · 36%" bg="var(--fill)" />
          </div>
        </Card>
      </div>
    </Section>
  );
}

function ButtonsSection() {
  const t = useTranslations("design.buttons");
  const tn = useTranslations("design.nav");
  return (
    <Section id="buttons" title={tn("buttons")}>
      <Card className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button block leadingIcon={<Ticket aria-hidden className="size-5" />}>
            {t("filled")}
          </Button>
          <Button block variant="tinted" leadingIcon={<Bell aria-hidden className="size-5" />}>
            {t("tinted")}
          </Button>
          <Button block variant="gray">
            {t("gray")}
          </Button>
          <Button block variant="plain">
            {t("plain")}
          </Button>
          <Button block variant="destructive">
            {t("destructive")}
          </Button>
          <Button block loading loadingLabel={t("loading")}>
            {t("filled")}
          </Button>
          <Button block disabled>
            {t("disabled")}
          </Button>
          <Button block variant="navy" leadingIcon={<QrCode aria-hidden className="size-5" />}>
            {t("plain")}
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-footnote uppercase text-label-secondary">{t("sizes")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">{t("large")}</Button>
            <Button size="md">{t("medium")}</Button>
            <Button size="sm">{t("small")}</Button>
            <Button size="sm" variant="gray">
              {t("small")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-footnote uppercase text-label-secondary">{t("iconOnly")}</span>
          <div className="flex items-center gap-3">
            <IconButton label={t("share")} icon={<Share />} />
            <IconButton label={t("more")} icon={<MoreHorizontal />} variant="tinted" />
            <IconButton label={t("share")} icon={<ScanLine />} variant="filled" />
            <IconButton label={t("more")} icon={<MoreHorizontal />} variant="plain" />
          </div>
        </div>
      </Card>
    </Section>
  );
}

function ListsSection() {
  const t = useTranslations("design.lists");
  const tn = useTranslations("design.nav");
  const [service, setService] = useState("consultation");
  const services = [
    { key: "consultation", icon: <Stethoscope />, color: "var(--accent-fill)", count: 7, minutes: 18 },
    { key: "pediatrics", icon: <Users />, color: "var(--green-fill)", count: 3, minutes: 9 },
    { key: "laboratory", icon: <FlaskConical />, color: "var(--orange-fill)", count: 12, minutes: 25 },
  ] as const;
  return (
    <Section id="lists" title={tn("lists")}>
      <div className="grid gap-6 lg:grid-cols-2">
        <ListSection header={t("header")} footer={t("footer")}>
          <ListRow
            icon={
              <ListIcon color="var(--navy)">
                <Building2 />
              </ListIcon>
            }
            title={t("name")}
            detail={t("nameValue")}
            href="#lists"
            accessory="chevron"
          />
          <ListRow
            icon={
              <ListIcon color="var(--accent-fill)">
                <MapPin />
              </ListIcon>
            }
            title={t("city")}
            detail={t("cityValue")}
            href="#lists"
            accessory="chevron"
          />
          <ListRow
            icon={
              <ListIcon color="var(--green-fill)">
                <Stethoscope />
              </ListIcon>
            }
            title={t("services")}
            detail={t("servicesValue")}
            href="#lists"
            accessory="chevron"
          />
          <ListRow
            icon={
              <ListIcon color="var(--orange-fill)">
                <DoorOpen />
              </ListIcon>
            }
            title={t("counters")}
            detail="5"
            href="#lists"
            accessory="chevron"
          />
          <ListRow
            icon={
              <ListIcon color="#ff3b30">
                <Bell />
              </ListIcon>
            }
            title={t("notifications")}
            subtitle={t("notificationsHint")}
            href="#lists"
            accessory="chevron"
          />
        </ListSection>

        <ListSection header={t("selectHeader")} radioGroupLabel={t("selectHeader")}>
            {services.map((s) => (
              <ListRow
                key={s.key}
                role="radio"
                selected={service === s.key}
                onClick={() => setService(s.key)}
                icon={<ListIcon color={s.color}>{s.icon}</ListIcon>}
                title={t(s.key)}
                subtitle={`${t("waiting", { count: s.count })} · ${t("minutes", { minutes: s.minutes })}`}
                accessory="check"
              />
            ))}
        </ListSection>
      </div>
    </Section>
  );
}

function CardsSection() {
  const t = useTranslations("design.cards");
  const tn = useTranslations("design.nav");
  return (
    <Section id="cards" title={tn("cards")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>{t("waitTitle")}</CardTitle>
          <p className="mt-1 text-large-title font-bold tabular">{t("waitValue")}</p>
          <p className="mt-1 flex items-center gap-1 text-footnote text-green-text">
            <TrendingDown aria-hidden className="size-4 stroke-2" />
            {t("waitTrend")}
          </p>
        </Card>
        <Card>
          <CardTitle>{t("servedTitle")}</CardTitle>
          <p className="mt-1 text-large-title font-bold tabular">{t("servedValue")}</p>
          <p className="mt-1 text-footnote text-label-secondary">{t("servedTrend")}</p>
        </Card>
        <Card className="relative overflow-hidden bg-navy text-white">
          <Badge tone="orange" className="bg-orange text-navy">
            {t("adTag")}
          </Badge>
          <p className="mt-3 text-headline">{t("adTitle")}</p>
          <p className="mt-1 text-subheadline text-white/80">{t("adBody")}</p>
        </Card>
      </div>
    </Section>
  );
}

function TogglesSection() {
  const t = useTranslations("design.toggles");
  const tn = useTranslations("design.nav");
  return (
    <Section id="toggles" title={tn("toggles")}>
      <ListSection>
        <ListSwitchRow title={t("remote")} subtitle={t("remoteHint")} defaultChecked={false} />
        <ListSwitchRow title={t("priority")} defaultChecked />
        <ListSwitchRow title={t("chime")} defaultChecked />
        <ListSwitchRow title={t("disabled")} defaultChecked disabled />
      </ListSection>
    </Section>
  );
}

function SegmentedSection() {
  const t = useTranslations("design.segmented");
  const tn = useTranslations("design.nav");
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const [lang, setLang] = useState<"fr" | "en">("fr");
  return (
    <Section id="segmented" title={tn("segmented")}>
      <Card className="flex flex-col gap-4">
        <SegmentedControl
          label={tn("segmented")}
          value={period}
          onValueChange={setPeriod}
          options={[
            { value: "today", label: t("today") },
            { value: "week", label: t("week") },
            { value: "month", label: t("month") },
          ]}
        />
        <SegmentedControl
          className="w-40"
          label={tn("segmented")}
          value={lang}
          onValueChange={setLang}
          options={[
            { value: "fr", label: t("fr") },
            { value: "en", label: t("en") },
          ]}
        />
      </Card>
    </Section>
  );
}

function FieldsSection() {
  const t = useTranslations("design.fields");
  const tn = useTranslations("design.nav");
  const tc = useTranslations("common");
  const [phone, setPhone] = useState("6 77 12 34");
  const [touched, setTouched] = useState(true);
  const phoneError = touched && phone && !normalizeCameroonPhone(phone) ? t("phoneError") : undefined;
  return (
    <Section id="fields" title={tn("fields")}>
      <div className="flex flex-col gap-5">
        <SearchField label={t("search")} clearLabel={tc("close")} />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label={t("code")}
            placeholder={t("codePlaceholder")}
            hint={t("codeHint")}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={6}
            className="[&_input:not(:placeholder-shown)]:font-semibold [&_input:not(:placeholder-shown)]:tracking-[0.2em] [&_input:not(:placeholder-shown)]:uppercase"
          />
          <TextField
            label={t("phone")}
            placeholder={t("phonePlaceholder")}
            inputMode="tel"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched(true)}
            error={phoneError}
          />
        </div>
        <TextField label={t("note")} placeholder={t("notePlaceholder")} />
      </div>
    </Section>
  );
}

function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "squircle relative mx-auto h-[40rem] w-full max-w-[24.375rem] overflow-hidden rounded-[2.75rem] bg-grouped",
        "shadow-[0_0_0_10px_#1c1c1e,0_0_0_11px_#3a3a3c,var(--elev-floating)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function NavigationSection() {
  const t = useTranslations("design");
  const tc = useTranslations("common");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState("ticket");
  const tabs = useTabItems();
  return (
    <Section id="navigation" title={t("nav.navigation")}>
      <PhoneFrame>
        <div ref={scrollRef} className="absolute inset-0 overflow-y-auto overscroll-contain">
          <NavigationBar
            title={t("navigation.demoTitle")}
            back={{ label: tc("back"), onClick: () => {} }}
            trailing={<IconButton label={t("buttons.more")} icon={<MoreHorizontal />} variant="plain" />}
            scrollRoot={scrollRef}
          >
            <p className="mt-1 text-subheadline text-label-secondary">{t("navigation.demoBody")}</p>
          </NavigationBar>
          <div className="px-4 pt-2 pb-6">
            <ListSection>
              {Array.from({ length: 14 }, (_, i) => {
                const code = `C${String(40 + i).padStart(3, "0")}`;
                return (
                  <ListRow
                    key={code}
                    title={t("navigation.row", { code })}
                    subtitle={t("lists.consultation")}
                    detail={i === 0 ? <Badge tone="green">{t("badges.called")}</Badge> : undefined}
                    onClick={() => {}}
                    accessory="chevron"
                  />
                );
              })}
            </ListSection>
          </div>
          <TabBar label={t("nav.tabbar")} items={tabs} active={tab} onSelect={setTab} position="sticky" />
        </div>
      </PhoneFrame>
    </Section>
  );
}

function useTabItems() {
  const t = useTranslations("design.tabbar");
  return [
    { key: "ticket", label: t("ticket"), icon: <Ticket aria-hidden /> },
    { key: "nearby", label: t("nearby"), icon: <MapPin aria-hidden /> },
    { key: "scan", label: t("scan"), icon: <ScanLine aria-hidden />, badge: 1 },
    { key: "account", label: t("account"), icon: <UserRound aria-hidden /> },
  ];
}

function TabBarSection() {
  const t = useTranslations("design.nav");
  const [tab, setTab] = useState("nearby");
  const tabs = useTabItems();
  return (
    <Section id="tabbar" title={t("tabbar")}>
      <div className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
        <div aria-hidden className="h-24 bg-[linear-gradient(135deg,var(--accent-tint),var(--orange-tint))]" />
        <TabBar label={t("tabbar")} items={tabs} active={tab} onSelect={setTab} position="static" />
      </div>
    </Section>
  );
}

function SheetSection() {
  const t = useTranslations("design.sheet");
  const tn = useTranslations("design.nav");
  const tc = useTranslations("common");
  const options = ["none", "appointment", "pregnancy", "elderly"] as const;
  const [choice, setChoice] = useState<(typeof options)[number]>("none");
  const [open, setOpen] = useState(false);
  return (
    <Section id="sheet" title={tn("sheet")}>
      <Card className="flex flex-col items-start gap-3">
        <Sheet
          open={open}
          onOpenChange={setOpen}
          title={t("title")}
          description={t("body")}
          closeLabel={tc("close")}
          trigger={<Button variant="tinted">{t("open")}</Button>}
          footer={
            <SheetClose asChild>
              <Button block>{t("confirm")}</Button>
            </SheetClose>
          }
        >
          <ListSection radioGroupLabel={t("title")}>
              {options.map((o) => (
                <ListRow
                  key={o}
                  role="radio"
                  title={t(o)}
                  selected={choice === o}
                  onClick={() => setChoice(o)}
                  accessory="check"
                />
              ))}
          </ListSection>
        </Sheet>
        <p className="text-subheadline text-label-secondary">
          {t("title")} : <span className="font-semibold text-label">{t(choice)}</span>
        </p>
      </Card>
    </Section>
  );
}

function AlertsSection() {
  const t = useTranslations("design.alerts");
  const tn = useTranslations("design.nav");
  const toast = useToast();
  return (
    <Section id="alerts" title={tn("alerts")}>
      <Card className="flex flex-wrap gap-3">
        <AlertDialog
          trigger={<Button variant="destructive">{t("open")}</Button>}
          title={t("title")}
          description={t("body")}
          cancelLabel={t("keep")}
          actionLabel={t("confirm")}
          destructive
          onAction={() => {}}
        />
        <Button variant="gray" onClick={() => toast(t("toastBody"), <Bell aria-hidden />)}>
          {t("toast")}
        </Button>
      </Card>
    </Section>
  );
}

function BadgesSection() {
  const t = useTranslations("design.badges");
  const tn = useTranslations("design.nav");
  const tc = useTranslations("common");
  return (
    <Section id="badges" title={tn("badges")}>
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <Badge>{t("waiting")}</Badge>
          <Badge tone="accent">{t("called")}</Badge>
          <Badge tone="orange">{t("serving")}</Badge>
          <Badge tone="green">
            <CheckCircle2 aria-hidden />
            {t("served")}
          </Badge>
          <Badge tone="red">{t("noShow")}</Badge>
          <Badge tone="navy">{t("priority")}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <StatusDot tone="green" label={tc("online")} />
          <StatusDot tone="red" label={tc("offline")} />
          <Badge tone="red">
            <WifiOff aria-hidden />
            {t("offline")}
          </Badge>
          <Spinner label={tc("loading")} className="text-label-secondary" />
        </div>
        <div className="flex flex-col gap-2" aria-label={t("skeleton")} role="group">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </Card>
    </Section>
  );
}

function TicketSection() {
  const t = useTranslations("design.ticket");
  const tn = useTranslations("design.nav");
  const tb = useTranslations("design.buttons");
  const [called, setCalled] = useState(false);
  return (
    <Section id="ticket" title={tn("ticket")}>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <TicketHero
          label={t("label")}
          code="C047"
          service={t("service")}
          positionLabel={t("position")}
          position={t("positionValue")}
          waitLabel={t("wait")}
          wait={t("waitValue")}
          footnote={t("ahead", { count: 2 })}
          state={called ? "called" : "waiting"}
          calledTitle={t("calledTitle")}
          calledBody={t("calledBody")}
        />
        <Button variant="tinted" block leadingIcon={<Bell aria-hidden className="size-5" />}>
          {tb("tinted")}
        </Button>
        <SegmentedControl
          label={tn("ticket")}
          value={called ? "called" : "waiting"}
          onValueChange={(v) => setCalled(v === "called")}
          options={[
            { value: "waiting", label: t("wait") },
            { value: "called", label: t("calledTitle") },
          ]}
        />
      </div>
    </Section>
  );
}
