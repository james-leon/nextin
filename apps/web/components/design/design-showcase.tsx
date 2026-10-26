"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  DoorOpen,
  Keyboard,
  MapPin,
  MoreHorizontal,
  QrCode,
  ScanLine,
  Share,
  Stethoscope,
  Ticket,
  TrendingDown,
  UserRound,
  WifiOff,
} from "lucide-react";
import { SERVICE_COLORS, formatTicketCode, normalizeCameroonPhone } from "@nextin/shared";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/cn";
import { useThemePreference, type ThemePreference } from "@/components/theme/theme";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Badge, StatusDot } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { Card, CardTitle } from "@/components/ui/card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { Logo, LogoMark } from "@/components/ui/logo";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { NowServingCard } from "@/components/ui/now-serving-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ScannerFrame } from "@/components/ui/scanner-frame";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ServiceTile } from "@/components/ui/service-tile";
import { Sheet, SheetClose } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { TabBar } from "@/components/ui/tab-bar";
import { SearchField, TextField } from "@/components/ui/text-field";
import { TicketHero } from "@/components/ui/ticket-hero";
import { useToast } from "@/components/ui/toast";

const SECTIONS = [
  "brand",
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
  "mockups",
] as const;
type SectionKey = (typeof SECTIONS)[number];

/** Données fictives de la maquette (DOUALA CLINIC). */
const DEMO_SERVICES = [
  { key: "consultation", prefix: "C", color: SERVICE_COLORS.blue, count: 6, minutes: 18 },
  { key: "pediatrics", prefix: "P", color: SERVICE_COLORS.green, count: 3, minutes: 12 },
  { key: "laboratory", prefix: "L", color: SERVICE_COLORS.purple, count: 9, minutes: 25 },
  { key: "cashier", prefix: "K", color: SERVICE_COLORS.ochre, count: 2, minutes: 4 },
] as const;

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
      <NavigationBar title={t("title")} eyebrow="NextIn by Wintek" contentClassName="max-w-6xl">
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
          <BrandSection />
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
          <MockupsSection />
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

function BrandSection() {
  const t = useTranslations("design");
  return (
    <Section id="brand" title={t("nav.brand")}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex flex-col items-start justify-between gap-6">
          <Logo />
          <div className="flex items-center gap-3">
            <LogoMark label={t("brand.logo")} className="size-14 rounded-[15px]" />
            <LogoMark className="size-11" />
            <LogoMark className="size-8 rounded-[8px]" />
          </div>
        </Card>
        <Card className="flex flex-col justify-between gap-6 bg-tv text-white">
          <Logo tone="inverse" />
          <p className="text-title2 leading-tight font-extrabold">{t("brand.tagline")}</p>
        </Card>
        <Card className="flex items-center justify-center">
          <ScannerFrame className="w-40">
            <div className="flex h-full items-center justify-center bg-grouped-tertiary">
              <QrCode aria-hidden className="size-16 stroke-1 text-label-secondary" />
            </div>
          </ScannerFrame>
          <span className="sr-only">{t("brand.scannerFrame")}</span>
        </Card>
      </div>
    </Section>
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
        <li className="flex flex-col gap-0.5 px-4 py-3 hairline-b">
          <span className="flex items-baseline justify-between gap-3">
            <span className="text-footnote font-semibold text-label-secondary">Hero · {t("nav.ticket")}</span>
            <span className="text-caption text-label-secondary tabular">88 · Heavy</span>
          </span>
          <span className="text-hero font-extrabold text-ticket-number">C-047</span>
        </li>
        {styles.map((s) => (
          <li key={s.key} className="flex flex-col gap-0.5 px-4 py-3 hairline-b last:shadow-none">
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
  const tl = useTranslations("design.lists");
  const tm = useTranslations("design.mockups.service");
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
          <CardTitle className="pb-3">{tl("selectHeader")}</CardTitle>
          <div className="flex flex-wrap gap-4">
            {DEMO_SERVICES.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <ServiceTile letter={s.prefix} color={s.color} />
                <span className="text-subheadline">{s.key === "cashier" ? tm("cashier") : tl(s.key)}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle className="pb-3">{t("system")}</CardTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Swatch name={t("groupedBg")} value="#F2F2F7 · #000000" bg="var(--bg-grouped)" ring />
            <Swatch name={t("card")} value="#FFFFFF · #1C1C1E" bg="var(--bg-grouped-secondary)" ring />
            <Swatch name={t("label")} value="#000000 · #FFFFFF" bg="var(--label)" />
            <Swatch name={t("secondaryLabel")} value="#6C6C70 · 60%" bg="var(--label-secondary)" />
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
  const tm = useTranslations("design.mockups");
  return (
    <Section id="buttons" title={tn("buttons")}>
      <Card className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button block>{tm("service.take")}</Button>
          <Button block trailingIcon={<ArrowRight aria-hidden className="size-5 stroke-[2.25]" />}>
            {tm("counter.next")}
          </Button>
          <Button block variant="tinted">
            {tm("ticket.onMyWay")}
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
          <Button block variant="destructive-plain">
            {tm("ticket.cancel")}
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
            <IconButton label={t("share")} icon={<Share />} variant="plain" />
            <IconButton label={t("share")} icon={<Share />} />
            <IconButton label={t("more")} icon={<MoreHorizontal />} variant="tinted" />
            <IconButton label={t("share")} icon={<ScanLine />} variant="filled" />
          </div>
        </div>
      </Card>
    </Section>
  );
}

function ServicePicker({ withHeader = true }: { withHeader?: boolean }) {
  const t = useTranslations("design");
  const [service, setService] = useState<string>("consultation");
  return (
    <ListSection
      header={withHeader ? t("mockups.service.header") : undefined}
      radioGroupLabel={t("mockups.service.header")}
    >
      {DEMO_SERVICES.map((s) => (
        <ListRow
          key={s.key}
          role="radio"
          selected={service === s.key}
          onClick={() => setService(s.key)}
          icon={<ServiceTile letter={s.prefix} color={s.color} />}
          title={s.key === "cashier" ? t("mockups.service.cashier") : t(`lists.${s.key}`)}
          subtitle={t("mockups.service.people", { count: s.count, minutes: s.minutes })}
          accessory="check"
        />
      ))}
    </ListSection>
  );
}

function ListsSection() {
  const t = useTranslations("design.lists");
  const tn = useTranslations("design.nav");
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
              <ListIcon color={SERVICE_COLORS.green}>
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
              <ListIcon color={SERVICE_COLORS.ochre}>
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
              <ListIcon color="var(--red-fill)">
                <Bell />
              </ListIcon>
            }
            title={t("notifications")}
            subtitle={t("notificationsHint")}
            href="#lists"
            accessory="chevron"
          />
        </ListSection>
        <ServicePicker />
      </div>
    </Section>
  );
}

function AdRow() {
  const t = useTranslations("design.mockups.ticket");
  return (
    <ListSection header={t("sponsored")}>
      <ListRow
        href="#cards"
        icon={
          <span
            aria-hidden
            className="squircle my-2 flex size-16 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-orange-tint text-orange-text"
          >
            <Building2 className="size-7 stroke-[1.5]" />
          </span>
        }
        title={<span className="font-semibold">{t("adTitle")}</span>}
        subtitle={t("adBody")}
        accessory="chevron"
      />
    </ListSection>
  );
}

function CardsSection() {
  const t = useTranslations("design.cards");
  const tn = useTranslations("design.nav");
  const tm = useTranslations("design.mockups");
  return (
    <Section id="cards" title={tn("cards")}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t("servedTitle")} value={t("servedValue")} trend="+12 %" trendTone="good" />
          <StatCard
            label={t("waitTitle")}
            value={t("waitValue")}
            trend={
              <span className="inline-flex items-center gap-1">
                <TrendingDown aria-hidden className="size-3.5 stroke-2" />
                {t("waitTrend")}
              </span>
            }
            trendTone="good"
          />
          <StatCard label={tm("counter.served")} value="23" />
          <StatCard label={tm("counter.avgDuration")} value="6 min" trend="+0,8 pt" trendTone="bad" />
        </div>
        <CalloutCard icon={<Bell />}>
          {tm.rich("ticket.alert", { count: 3, b: (chunks) => <strong className="font-semibold">{chunks}</strong> })}
        </CalloutCard>
        <AdRow />
      </div>
    </Section>
  );
}

function TogglesSection() {
  const t = useTranslations("design.toggles");
  const tn = useTranslations("design.nav");
  const tm = useTranslations("design.mockups.service");
  return (
    <Section id="toggles" title={tn("toggles")}>
      <div className="flex flex-col gap-4">
        <ListSection>
          <ListSwitchRow title={tm("priority")} subtitle={tm("priorityHint")} />
        </ListSection>
        <ListSection>
          <ListSwitchRow title={t("remote")} subtitle={t("remoteHint")} defaultChecked={false} />
          <ListSwitchRow title={t("priority")} defaultChecked />
          <ListSwitchRow title={t("chime")} defaultChecked />
          <ListSwitchRow title={t("disabled")} defaultChecked disabled />
        </ListSection>
      </div>
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

function PhoneFrame({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <figure className="flex flex-col items-center gap-3">
      <div
        className={cn(
          "squircle relative h-[44rem] w-full max-w-[24.375rem] overflow-hidden rounded-[2.75rem] bg-grouped",
          "shadow-[0_0_0_10px_#1c1c1e,0_0_0_11px_#3a3a3c,var(--elev-floating)]",
          className,
        )}
      >
        {children}
      </div>
      {label ? <figcaption className="pt-2 text-footnote text-label-secondary">{label}</figcaption> : null}
    </figure>
  );
}

function useTabItems() {
  const t = useTranslations("design.tabbar");
  return [
    { key: "scan", label: t("scan"), icon: <ScanLine aria-hidden /> },
    { key: "ticket", label: t("ticket"), icon: <Clock aria-hidden />, badge: 1 },
    { key: "profile", label: t("profile"), icon: <UserRound aria-hidden /> },
  ];
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
            eyebrow="DOUALA CLINIC"
            back={{ label: tc("back"), onClick: () => {} }}
            trailing={<IconButton label={t("buttons.more")} icon={<MoreHorizontal />} variant="plain" />}
            scrollRoot={scrollRef}
          >
            <p className="mt-1 text-subheadline text-label-secondary">{t("navigation.demoBody")}</p>
          </NavigationBar>
          <div className="px-4 pt-2 pb-6">
            <ListSection>
              {Array.from({ length: 14 }, (_, i) => {
                const code = formatTicketCode("C", 40 + i);
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

function TabBarSection() {
  const t = useTranslations("design.nav");
  const [tab, setTab] = useState("scan");
  const tabs = useTabItems();
  return (
    <Section id="tabbar" title={t("tabbar")}>
      <div className="flex flex-col gap-4">
        <div className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
          <div aria-hidden className="h-24 bg-[linear-gradient(135deg,var(--accent-tint),var(--orange-tint))]" />
          <TabBar label={t("tabbar")} items={tabs} active={tab} onSelect={setTab} position="static" />
        </div>
        <div className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-scanner" data-theme="dark">
          <div aria-hidden className="h-16" />
          <TabBar
            label={t("tabbar")}
            items={tabs}
            active={tab}
            onSelect={setTab}
            position="static"
            className="bg-scanner-surface/90"
          />
        </div>
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
  const tm = useTranslations("design.mockups");
  return (
    <Section id="badges" title={tn("badges")}>
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge shape="pill" tone="green">
            <span aria-hidden className="size-2 rounded-full bg-green" />
            {tm("counter.open")}
          </Badge>
          <Badge shape="pill" tone="green">
            <Check aria-hidden />
            {tm("service.recognized")}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{t("waiting")}</Badge>
          <Badge tone="accent">{t("called")}</Badge>
          <Badge tone="green">{tm("counter.open")}</Badge>
          <Badge tone="orange">{tm("counter.appointment")}</Badge>
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
          <Badge tone="red" shape="pill">
            <WifiOff aria-hidden />
            {t("offline")}
          </Badge>
          <Spinner label={tc("loading")} className="text-label-secondary" />
        </div>
        <div className="flex flex-col gap-3">
          <ProgressBar value={0.75} label={tm("service.header")} />
          <ProgressBar value={0.4} label={tm("service.header")} />
          <ProgressBar value={1} label={tm("service.header")} tone="orange" />
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

function DemoTicketHero({ called = false }: { called?: boolean }) {
  const t = useTranslations("design.ticket");
  return (
    <TicketHero
      code={formatTicketCode("C", 47)}
      service={t("service")}
      place={t("place")}
      aheadLabel={t("ahead")}
      ahead={4}
      waitLabel={t("wait")}
      wait={t("waitValue")}
      progress={0.64}
      progressLabel={t("progress")}
      nowServing={t("nowServing", { code: formatTicketCode("C", 43), counter: "Guichet 2" })}
      state={called ? "called" : "waiting"}
      calledTitle={t("calledTitle")}
      calledBody={t("calledBody")}
    />
  );
}

function TicketSection() {
  const t = useTranslations("design.ticket");
  const tn = useTranslations("design.nav");
  const [called, setCalled] = useState(false);
  return (
    <Section id="ticket" title={tn("ticket")}>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
        <DemoTicketHero called={called} />
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

/* ─── Écrans de la maquette, reconstruits avec les composants ─────────────── */

function MockScanner() {
  const t = useTranslations("design.mockups.scanner");
  const tn = useTranslations("design.nav");
  const tabs = useTabItems();
  return (
    <PhoneFrame className="bg-scanner text-white" label={`01 · ${t("title")}`}>
      <div className="absolute inset-0 flex flex-col" data-theme="dark">
        <div className="flex flex-1 flex-col items-center px-6 pt-14 text-center">
          <p className="text-footnote font-semibold tracking-[0.12em] text-white/70 uppercase">{t("eyebrow")}</p>
          <p className="mt-1 text-title1 leading-tight font-bold">{t("title")}</p>
          <p className="mt-2 text-subheadline text-white/75">{t("body")}</p>
          <button type="button" className="pressable mt-10 w-60" aria-label={t("hint")}>
            <ScannerFrame scanning>
              <div className="flex h-full items-end justify-center bg-scanner-surface pb-14">
                <span className="text-footnote text-white/70">{t("hint")}</span>
              </div>
            </ScannerFrame>
          </button>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-3">
          <Button block variant="gray" className="justify-start bg-scanner-control text-white" leadingIcon={<Keyboard aria-hidden className="size-5" />}>
            {t("code")}
          </Button>
          <Button block variant="gray" className="justify-start bg-scanner-control text-white" leadingIcon={<MapPin aria-hidden className="size-5" />}>
            {t("nearby")}
          </Button>
        </div>
        <TabBar label={tn("tabbar")} items={tabs} active="scan" position="static" className="bg-scanner-surface/90" />
      </div>
    </PhoneFrame>
  );
}

function MockChooseService() {
  const t = useTranslations("design.mockups.service");
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <PhoneFrame label={`02 · ${t("title")}`}>
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto pb-40">
        <NavigationBar
          title={t("title")}
          eyebrow="DOUALA CLINIC"
          back={{ label: t("back"), onClick: () => {} }}
          trailing={
            <Badge shape="pill" tone="green">
              <Check aria-hidden />
              {t("recognized")}
            </Badge>
          }
          scrollRoot={scrollRef}
        >
          <p className="mt-1 text-subheadline text-label-secondary">{t("subtitle")}</p>
        </NavigationBar>
        <div className="flex flex-col gap-5 px-4 pt-3">
          <ServicePicker />
          <ListSection>
            <ListSwitchRow title={t("priority")} subtitle={t("priorityHint")} />
          </ListSection>
        </div>
      </div>
      <BottomBar position="sticky" className="absolute inset-x-0 bottom-0" summary={t("people", { count: 6, minutes: 18 })}>
        <Button block>{t("take")}</Button>
      </BottomBar>
    </PhoneFrame>
  );
}

function MockMyTicket() {
  const t = useTranslations("design.mockups.ticket");
  return (
    <PhoneFrame label={`03 · ${t("title")}`}>
      <div className="absolute inset-0 overflow-y-auto">
        <NavigationBar
          variant="inline"
          title={t("title")}
          back={{ label: t("back"), onClick: () => {} }}
          trailing={<IconButton label={t("share")} icon={<Share />} variant="plain" />}
        />
        <div className="flex flex-col gap-4 px-4 pt-3 pb-6">
          <DemoTicketHero />
          <CalloutCard icon={<Bell />}>
            {t.rich("alert", { count: 3, b: (chunks) => <strong className="font-semibold">{chunks}</strong> })}
          </CalloutCard>
          <AdRow />
          <div className="flex flex-col gap-1 pt-2">
            <Button block variant="tinted">
              {t("onMyWay")}
            </Button>
            <Button block variant="destructive-plain">
              {t("cancel")}
            </Button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function MockCounter() {
  const t = useTranslations("design.mockups.counter");
  const next = [
    { n: 48, status: t("arrived", { time: "9:18" }), rdv: true },
    { n: 47, status: t("onTheWay", { time: "9:12" }) },
    { n: 49, status: t("onSite", { time: "9:21" }) },
  ];
  return (
    <PhoneFrame label={`04 · ${t("title")}`}>
      <div className="absolute inset-0 overflow-y-auto pb-32">
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <Badge shape="pill" tone="green">
            <span aria-hidden className="size-2 rounded-full bg-green" />
            {t("open")}
          </Badge>
          <Button variant="plain" size="md">
            {t("pause")}
          </Button>
        </div>
        <div className="px-4">
          <p className="text-large-title font-bold">{t("title")}</p>
          <p className="mt-1 text-subheadline text-label-secondary">{t("subtitle", { agent: "Mireille A." })}</p>
        </div>
        <div className="flex flex-col gap-5 px-4 pt-5">
          <NowServingCard
            label={t("current")}
            code={formatTicketCode("C", 46)}
            elapsedSeconds={252}
            elapsedLabel={t("elapsed")}
            actions={[{ label: t("recall") }, { label: t("transfer") }, { label: t("absent") }]}
          />
          <ListSection header={t("nextHeader", { count: 6 })}>
            {next.map((r) => (
              <ListRow
                key={r.n}
                title={
                  <span className="flex items-baseline gap-4">
                    <span className="w-16 font-semibold">{formatTicketCode("C", r.n)}</span>
                    <span className="text-label-secondary">{r.status}</span>
                  </span>
                }
                accessory={r.rdv ? <Badge tone="orange">{t("appointment")}</Badge> : undefined}
              />
            ))}
          </ListSection>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t("served")} value="23" />
            <StatCard label={t("avgDuration")} value="6 min" />
          </div>
        </div>
      </div>
      <BottomBar position="sticky" className="absolute inset-x-0 bottom-0">
        <Button block trailingIcon={<ArrowRight aria-hidden className="size-5 stroke-[2.25]" />}>
          {t("next")}
        </Button>
      </BottomBar>
    </PhoneFrame>
  );
}

function MockupsSection() {
  const t = useTranslations("design");
  return (
    <Section id="mockups" title={t("nav.mockups")}>
      <p className="-mt-1 px-1 pb-6 text-subheadline text-label-secondary">{t("mockups.intro")}</p>
      <div className="grid gap-10 xl:grid-cols-2">
        <MockScanner />
        <MockChooseService />
        <MockMyTicket />
        <MockCounter />
      </div>
      <p className="mt-6 flex items-center gap-2 px-1 text-footnote text-label-secondary">
        <Ticket aria-hidden className="size-4 stroke-[1.75]" />
        {t("mockups.later")}
      </p>
    </Section>
  );
}
