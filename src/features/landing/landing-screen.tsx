"use client";

import { useSession } from "next-auth/react";
import {
  Wrench,
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  CalendarCheck,
  ClipboardList,
  Star,
  MapPin,
  ArrowRight,
  Search,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { PageContainer } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { navigate } from "@/store/router";

const STEPS: {
  icon: typeof Stethoscope;
  title: string;
  description: string;
}[] = [
  {
    icon: LifeBuoy,
    title: "Describe the problem",
    description:
      "Pick the equipment category and tell us what you see, hear, or smell. No jargon required.",
  },
  {
    icon: Stethoscope,
    title: "Diagnose",
    description:
      "Answer a short, deterministic decision-tree. FixIt returns likely causes with confidence levels.",
  },
  {
    icon: Wrench,
    title: "Troubleshoot safely",
    description:
      "Follow step-by-step instructions tagged Safe, Caution, or Professional only — so you never cross your comfort line.",
  },
  {
    icon: ShieldAlert,
    title: "Decide",
    description:
      "If the fix is beyond the safety level you accept, FixIt escalates straight to a professional match.",
  },
  {
    icon: UserCheck,
    title: "Match",
    description:
      "We rank verified Addis Ababa technicians by skill, distance, and availability — you pick.",
  },
  {
    icon: CalendarCheck,
    title: "Book & track",
    description:
      "Schedule the visit, review the quote, pay, then follow the repair job live until it's done.",
  },
];

const STATS: { label: string; value: string }[] = [
  { value: "5", label: "Verified technicians" },
  { value: "3", label: "Equipment categories" },
  { value: "10", label: "Addis Ababa service areas" },
  { value: "100%", label: "Transparent quotes" },
];

const WHY: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}[] = [
  {
    icon: ShieldCheck,
    title: "Safety first",
    description:
      "Every cause and step is rated Safe, Caution, or Professional only. You decide how far to go — we make the line obvious.",
  },
  {
    icon: ClipboardList,
    title: "Clarity over hype",
    description:
      "Plain-language diagnoses with confidence percentages and risk badges. No mystery recommendations.",
  },
  {
    icon: UserCheck,
    title: "Real, verified technicians",
    description:
      "Every technician on FixIt is reviewed for skills and service areas. Profiles show ratings, response time, and pricing.",
  },
  {
    icon: MapPin,
    title: "Built for Addis Ababa",
    description:
      "Coverage across Bole, Kazanchis, Piazza, Arada, Kirkos, Yeka, Lideta, Nifas Silk-Lafto, Kolfe Keranio, and Gulele.",
  },
];

export function LandingScreen() {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  const goDiagnose = () => navigate(signedIn ? "diagnose" : "auth/signin");
  const goAIDiagnose = () => navigate(signedIn ? "ai-diagnose" : "auth/signin");
  const goTech = () => navigate(signedIn ? "technicians" : "auth/signin");

  return (
    <PageContainer className="py-8 sm:py-12 lg:py-16">
      {/* Hero */}
      <section className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-primary" aria-hidden />
            FixIt · Addis Ababa home equipment troubleshooting
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Fix the problem yourself — or find the right person to fix it.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            FixIt walks you from problem to diagnosis to safe troubleshooting,
            then matches you with a verified technician, helps you book the
            visit, and tracks the repair all the way to a written warranty —
            all in one place.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" onClick={goAIDiagnose} className="w-full sm:w-auto">
              <Sparkles className="h-4 w-4" aria-hidden />
              AI-assisted diagnosis
            </Button>
            <Button size="lg" variant="outline" onClick={goDiagnose} className="w-full sm:w-auto">
              <Stethoscope className="h-4 w-4" aria-hidden />
              Guided diagnosis
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={goTech}
              className="w-full sm:w-auto"
            >
              <Search className="h-4 w-4" aria-hidden />
              Find a technician
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {signedIn
              ? "You're signed in — pick an action above."
              : "Free to explore. Sign in to save equipment and start a diagnosis."}
          </p>
        </div>

        {/* Hero card cluster */}
        <div className="relative">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="sm:row-span-2">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <Stethoscope className="h-5 w-5" aria-hidden />
                  <span className="text-sm font-medium">Diagnosis</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  "Washing machine won't drain" → likely causes, ranked.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    ✓ Safe
                  </span>
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    ▲ Caution
                  </span>
                  <span className="rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    ⚠ Professional only
                  </span>
                </div>
                <div className="mt-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Clogged drain pump
                  </span>{" "}
                  · 72% confidence
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary">
                  <UserCheck className="h-5 w-5" aria-hidden />
                  <span className="text-sm font-medium">Match</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  3 technicians nearby ranked by skill and distance.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-primary">
                  <CalendarCheck className="h-5 w-5" aria-hidden />
                  <span className="text-sm font-medium">Track</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  En route → arrived → repairing → completed. Live status.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stat band */}
      <section className="mt-12 grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-4 sm:mt-16 sm:grid-cols-4 sm:gap-4 sm:p-6">
        {STATS.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-2xl font-semibold text-foreground sm:text-3xl">
              {s.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {s.label}
            </div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section className="mt-12 sm:mt-16">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <p className="text-sm text-muted-foreground">
            From a strange noise to a fixed appliance — eight steps, no
            guesswork.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="h-5 w-5" aria-hidden />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      Step {i + 1}
                    </span>
                  </div>
                  <div className="font-medium">{step.title}</div>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Why FixIt */}
      <section className="mt-12 sm:mt-16">
        <div className="mb-6 flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Why FixIt
          </h2>
          <p className="text-sm text-muted-foreground">
            Built for trust, clarity, and safety — not for upsells.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <Card key={w.title} className="h-full">
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <w.icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="font-medium">{w.title}</div>
                <p className="text-sm text-muted-foreground">{w.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mt-12 sm:mt-16">
        <Card className="overflow-hidden border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Star className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold">Ready when you are</h3>
                <p className="text-sm text-muted-foreground">
                  Start with a quick diagnosis. If a professional is the right
                  call, FixIt has them lined up.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button onClick={goDiagnose} className="w-full sm:w-auto">
                Diagnose a problem
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="outline"
                onClick={goTech}
                className="w-full sm:w-auto"
              >
                Find a technician
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Phase 1 demo · Deterministic engine · No AI integrated
      </p>
    </PageContainer>
  );
}

export default LandingScreen;
