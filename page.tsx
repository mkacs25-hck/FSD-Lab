"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Leaf,
  LoaderCircle,
  MapPin,
  Plane,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TrainFront,
  TrendingDown,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import Bars from "@/components/bars";
import Gate from "@/components/gate";
import { ShareReport } from "@/components/share-report";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, inp } from "@/lib/api";

const FIELDS = [
  {
    key: "kwh",
    label: "Electricity consumption",
    unit: "kWh / month",
    description: "Check your electricity bill for your monthly usage.",
    icon: Zap,
    section: "home",
  },
  {
    key: "car",
    label: "Car travel",
    unit: "km / month",
    description: "Total distance travelled in a car.",
    icon: MapPin,
    section: "travel",
  },
  {
    key: "bike",
    label: "Motorbike travel",
    unit: "km / month",
    description: "Distance travelled by motorcycle or scooter.",
    icon: MapPin,
    section: "travel",
  },
  {
    key: "bus",
    label: "Bus travel",
    unit: "km / month",
    description: "Approximate distance travelled by bus.",
    icon: MapPin,
    section: "travel",
  },
  {
    key: "rail",
    label: "Train and metro",
    unit: "km / month",
    description: "Total distance travelled by train or metro.",
    icon: TrainFront,
    section: "travel",
  },
  {
    key: "flight",
    label: "Air travel",
    unit: "km / month",
    description: "Approximate flight distance for the month.",
    icon: Plane,
    section: "travel",
  },
  {
    key: "lpgKg",
    label: "LPG consumption",
    unit: "kg / month",
    description: "Estimate the LPG used for household cooking.",
    icon: Wallet,
    section: "home",
  },
  {
    key: "wasteKg",
    label: "Household waste",
    unit: "kg / month",
    description: "Estimate the waste your household generates.",
    icon: Cloud,
    section: "home",
  },
] as const;

const DIETS = [
  {
    value: "vegan",
    label: "Vegan",
    description: "Plant-based foods only",
  },
  {
    value: "vegetarian",
    label: "Vegetarian",
    description: "No meat or fish",
  },
  {
    value: "pescatarian",
    label: "Pescatarian",
    description: "Plant-based foods and seafood",
  },
  {
    value: "mixed",
    label: "Mixed diet",
    description: "A varied diet including meat",
  },
  {
    value: "meat_heavy",
    label: "Meat-heavy",
    description: "Meat features in most meals",
  },
] as const;

type FormValues = Record<string, string>;

type Benchmark = {
  region: string;
  year: number;
  monthlyKgCO2: number;
  source?: string;
};

type Recommendation = {
  action: string;
  savingKgPerMonth?: number;
};

type CalculationResult = {
  totalKgCO2e: number;
  breakdown: Record<string, number>;
  recommendations: Recommendation[];
};

type Benchmarks = {
  perCapita?: Benchmark[];
  note?: string;
  scenarios?: {
    label: string;
    annualTonnes: number;
    source?: string;
  }[];
  investmentAssociated?: {
    label: string;
    annualTonnes: number;
    source?: string;
    year?: number;
  }[];
};

function localMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
          <Icon className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Page() {
  return (
    <Gate>
      <Calculator />
    </Gate>
  );
}

function Calculator() {
  const [f, setF] = useState<FormValues>({});
  const [diet, setDiet] = useState("mixed");
  const [month, setMonth] = useState("");
  const [res, setRes] = useState<CalculationResult | null>(null);
  const [bm, setBm] = useState<Benchmarks | null>(null);
  const [msg, setMsg] = useState("");
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setMonth(localMonth());

    api("/api/benchmarks")
      .then((data) => setBm(data))
      .catch((e) =>
        setMsg(
          e instanceof Error
            ? `Benchmarks unavailable: ${e.message}`
            : "Benchmarks are currently unavailable.",
        ),
      )
      .finally(() => setLoadingBenchmarks(false));
  }, []);

  const sections = [
    {
      title: "Home and household",
      description: "Energy consumption and household waste.",
      icon: Zap,
      keys: ["kwh", "lpgKg", "wasteKg"],
    },
    {
      title: "Getting around",
      description: "Your monthly travel by each transport type.",
      icon: MapPin,
      keys: ["car", "bike", "bus", "rail", "flight"],
    },
  ];

  const completedFields = FIELDS.filter(
    (field) => f[field.key]?.trim() !== "" && f[field.key] !== undefined,
  ).length;

  const progress = Math.round((completedFields / FIELDS.length) * 100);

  const payload = () => {
    const n = (key: string) => {
      const value = f[key]?.trim();
      return value ? Number(value) : 0;
    };

    return {
      kwh: n("kwh"),
      diet,
      lpgKg: n("lpgKg"),
      wasteKg: n("wasteKg"),
      km: {
        car: n("car"),
        bike: n("bike"),
        bus: n("bus"),
        rail: n("rail"),
        flight: n("flight"),
      },
    };
  };

  function validate() {
    const invalid = FIELDS.find((field) => {
      const raw = f[field.key]?.trim();

      if (!raw) return false;

      const value = Number(raw);
      return !Number.isFinite(value) || value < 0;
    });

    if (invalid) {
      setMsg(`${invalid.label} must be a valid, non-negative number.`);
      return false;
    }

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      setMsg("Choose a valid month for this assessment.");
      return false;
    }

    setMsg("");
    return true;
  }

  async function calculate() {
    if (!validate()) return;

    setCalculating(true);
    setMsg("");

    try {
      const data = await api("/api/calculate", payload());
      setRes(data);
      setStep(2);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not calculate your footprint.");
    } finally {
      setCalculating(false);
    }
  }

  async function saveMonth() {
    if (!validate()) return;

    setSaving(true);
    setMsg("");

    try {
      await api("/api/footprints", { ...payload(), month });
      setMsg("Your monthly footprint has been saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save your assessment.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setF({});
    setDiet("mixed");
    setRes(null);
    setMsg("");
    setStep(0);
  }

  const comparisonRows = useMemo(() => {
    if (!res) return [];

    return [
      ["You", res.totalKgCO2e] as [string, number],
      ...(bm?.perCapita ?? []).map((b): [string, number] => [
        `${b.region} (${b.year})`,
        b.monthlyKgCO2,
      ]),
    ];
  }, [res, bm]);

  const maxComparison = Math.max(1, ...comparisonRows.map((row) => row[1]));

  const sectionsForStep = step === 0 ? sections.slice(0, 1) : step === 1 ? sections.slice(1) : [];

  return (
    <main className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(5,150,105,0.10),transparent_55%)]" />

      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8 sm:px-8 sm:py-12">
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Link
              href="/dashboard"
              className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>

            <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
              <Leaf className="size-4" />
              PERSONAL CARBON ASSESSMENT
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Understand your footprint.
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Estimate your monthly emissions using your everyday activities. Review your results,
              compare documented benchmarks, and find practical opportunities to reduce your impact.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Your assessment</p>
              <p className="text-xs text-muted-foreground">Estimated CO₂ equivalent</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Assessment progress</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter what you know. Fields can be left blank when you don't have an estimate.
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums text-emerald-500">
              {completedFields} of {FIELDS.length} fields
            </span>
          </div>

          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { title: "01", label: "Home and household", done: step > 0 },
              { title: "02", label: "Travel and diet", done: step > 1 },
              { title: "03", label: "Results and actions", done: Boolean(res) },
            ].map((item) => (
              <div
                key={item.title}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  item.done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
                }`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                  {item.done ? <Check className="size-4 text-emerald-500" /> : item.title}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        {msg && (
          <div
            role="status"
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
              msg.startsWith("Your monthly footprint")
                ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600"
                : "border-red-500/20 bg-red-500/5 text-red-500"
            }`}
          >
            {msg.startsWith("Your monthly footprint") ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Activity className="mt-0.5 size-4 shrink-0" />
            )}
            <span>{msg}</span>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
          <div className="space-y-6">
            {sectionsForStep.map((section) => {
              const fields = FIELDS.filter((field) => section.keys.includes(field.key));

              return (
                <SectionCard
                  key={section.title}
                  icon={section.icon}
                  title={section.title}
                  description={section.description}
                >
                  <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                    {fields.map((field) => {
                      const Icon = field.icon;

                      return (
                        <label key={field.key} className="block min-w-0">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <Icon className="size-4 text-emerald-500" />
                            {field.label}
                          </span>

                          <span className="mt-1 block text-xs text-muted-foreground">
                            {field.unit}
                          </span>

                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            className={`${inp} mt-2`}
                            placeholder="0"
                            value={f[field.key] ?? ""}
                            onChange={(e) =>
                              setF((current) => ({
                                ...current,
                                [field.key]: e.target.value,
                              }))
                            }
                          />

                          <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                            {field.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </SectionCard>
              );
            })}

            {step === 0 && (
              <div className="flex justify-end">
                <Button onClick={() => setStep(1)}>
                  Continue to travel and diet
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            )}

            {step === 1 && (
              <>
                <SectionCard
                  icon={Utensils}
                  title="Food and diet"
                  description="Choose the option that best represents your usual eating habits."
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    {DIETS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setDiet(item.value)}
                        className={`rounded-xl border p-4 text-left transition ${
                          diet === item.value
                            ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                            : "border-border hover:border-emerald-500/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{item.label}</span>
                          {diet === item.value && (
                            <CheckCircle2 className="size-4 text-emerald-500" />
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  icon={Wallet}
                  title="Assessment period"
                  description="Choose which month these activities represent."
                >
                  <div className="max-w-xs space-y-2">
                    <label htmlFor="month" className="text-sm font-medium">
                      Month
                    </label>
                    <input
                      id="month"
                      type="month"
                      className={inp}
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      required
                    />
                  </div>
                </SectionCard>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    <ArrowLeft className="mr-2 size-4" />
                    Back
                  </Button>

                  <Button onClick={() => void calculate()} disabled={calculating}>
                    {calculating ? (
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 size-4" />
                    )}
                    {calculating ? "Calculating..." : "Calculate footprint"}
                  </Button>
                </div>
              </>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-emerald-500" />
                What you'll discover
              </div>

              <div className="mt-5 space-y-4">
                {[
                  {
                    icon: Activity,
                    title: "Monthly emissions",
                    text: "An estimate in kilograms of CO₂ equivalent.",
                  },
                  {
                    icon: BarChartIcon,
                    title: "Category breakdown",
                    text: "See how your recorded activities contribute.",
                  },
                  {
                    icon: TrendingDown,
                    title: "Reduction ideas",
                    text: "Review actions and their estimated savings.",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title} className="flex gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="size-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">Estimates, not exact measurements</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Results depend on the activity data and emission factors used. Use them to identify
                patterns, not as formal carbon accounting.
              </p>
            </section>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium">Already calculated?</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Review your previous assessments and track your history.
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-500 hover:underline"
              >
                Go to dashboard
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </aside>
        </div>

        {res && (
          <section id="results" className="scroll-mt-24 space-y-6 border-t border-border/60 pt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-500">
                  <CheckCircle2 className="size-4" />
                  ASSESSMENT COMPLETE
                </div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                  Your results
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {month} · Estimated monthly emissions
                </p>
              </div>

              <Button variant="outline" onClick={resetForm}>
                <RefreshCw className="mr-2 size-4" />
                Start over
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 sm:p-8">
                <p className="text-sm text-muted-foreground">Estimated monthly footprint</p>
                <p className="mt-3 text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
                  {formatNumber(res.totalKgCO2e)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  kilograms of CO₂ equivalent (kg CO₂e)
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <Button onClick={() => void saveMonth()} disabled={saving}>
                    {saving ? (
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    Save this month
                  </Button>

                  <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
                    View dashboard
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TrendingDown className="size-4 text-emerald-500" />
                  Your reduction opportunities
                </div>

                {res.recommendations?.length ? (
                  <>
                    <p className="mt-4 text-3xl font-semibold">
                      {formatNumber(
                        res.recommendations.reduce((sum, r) => sum + (r.savingKgPerMonth ?? 0), 0),
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      kg CO₂e/month in listed potential savings
                    </p>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">
                      This is the sum of the recommendation estimates, not a guarantee of achievable
                      savings. Actions may overlap.
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    No recommendations were returned for this assessment.
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                icon={Activity}
                title="Emissions by category"
                description="A breakdown of the categories returned by the calculator."
              >
                {Object.keys(res.breakdown ?? {}).length ? (
                  <Bars
                    rows={Object.entries(res.breakdown)}
                    max={Math.max(1, ...Object.values(res.breakdown))}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No category breakdown is available.
                  </p>
                )}
              </SectionCard>

              <SectionCard
                icon={TrendingDown}
                title="Ways to reduce your footprint"
                description="Potential savings returned by the recommendation engine."
              >
                {res.recommendations?.length ? (
                  <div className="space-y-3">
                    {res.recommendations.map((recommendation, index) => (
                      <div
                        key={`${recommendation.action}-${index}`}
                        className="flex items-start gap-3 rounded-xl border border-border p-4"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                          <Check className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-6">{recommendation.action}</p>
                          {recommendation.savingKgPerMonth != null && (
                            <p className="mt-2 text-xs font-medium text-emerald-500">
                              Estimated saving: {formatNumber(recommendation.savingKgPerMonth)}{" "}
                              kg/month
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recommendations are available for this assessment.
                  </p>
                )}
              </SectionCard>
            </div>

            <SectionCard
              icon={Sparkles}
              title="Share your report"
              description="Post your results as an image on Instagram, Facebook, WhatsApp and more."
            >
              <ShareReport month={month} result={res} />
            </SectionCard>

            <SectionCard
              icon={Activity}
              title="How you compare"
              description="Monthly per-capita benchmark values provided by your benchmark API."
            >
              {loadingBenchmarks ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading benchmark data...
                </div>
              ) : comparisonRows.length > 1 ? (
                <>
                  <Bars rows={comparisonRows} max={maxComparison} />
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    {bm?.perCapita?.[0]?.source ? `Source: ${bm.perCapita[0].source}. ` : ""}
                    {bm?.note ?? ""} Check the reference year, geographic coverage, and emissions
                    scope before treating these values as directly comparable.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Benchmark comparisons are currently unavailable.
                </p>
              )}
            </SectionCard>

            {bm && (bm.scenarios?.length || bm.investmentAssociated?.length) ? (
              <SectionCard
                icon={Cloud}
                title="Wider emissions context"
                description="Additional scenarios returned by your benchmark API. These are not your personal footprint."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {bm.scenarios?.map((scenario) => (
                    <div key={scenario.label} className="rounded-xl border border-border p-4">
                      <p className="text-sm font-medium">{scenario.label}</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatNumber(scenario.annualTonnes)} t/yr
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {scenario.source ?? "Source not provided"}
                      </p>
                    </div>
                  ))}

                  {bm.investmentAssociated?.map((scenario) => (
                    <div key={scenario.label} className="rounded-xl border border-border p-4">
                      <p className="text-sm font-medium">Investment-associated: {scenario.label}</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatNumber(scenario.annualTonnes)} t/yr
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {scenario.source ?? "Source not provided"}
                        {scenario.year ? ` · ${scenario.year}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            <p className="text-xs leading-5 text-muted-foreground">
              Estimates depend on the underlying activity data, emission factors, methodology and
              assumptions. Benchmarks can use different scopes, so comparisons are indicative rather
              than exact.
            </p>
          </section>
        )}

        <footer className="border-t border-border/60 pt-6 text-xs leading-5 text-muted-foreground">
          Ecometrics · Personal carbon awareness and reduction planning.
        </footer>
      </div>
    </main>
  );
}

function BarChartIcon({ className }: { className?: string }) {
  return <Activity className={className} />;
}
