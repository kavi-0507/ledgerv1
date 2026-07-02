import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  Sparkles,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { AppShell } from "@/components/ds/AppShell";
import { StatCard } from "@/components/ds/StatCard";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { ErrorState } from "@/components/ds/ErrorState";
import {
  SkeletonChart,
  SkeletonRow,
  SkeletonStatCard,
} from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  component: DesignSystem,
});

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h2 className="text-display text-3xl sm:text-4xl">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="surface-card overflow-hidden">
      <div className={`h-20 w-full ${className}`} />
      <div className="p-3">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{className}</p>
      </div>
    </div>
  );
}

function DesignSystem() {
  return (
    <>
      <AppShell
        header={
          <div className="flex w-full items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Design system
              </p>
              <h1 className="truncate text-display text-xl sm:text-2xl">
                Ledger — foundations
              </h1>
            </div>
            <Button variant="default" size="sm">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Preview
            </Button>
          </div>
        }
      >
        <div className="space-y-14">
          {/* HERO */}
          <section className="surface-elevated relative overflow-hidden p-6 sm:p-10">
            <div className="max-w-2xl space-y-4">
              <StatusPill tone="primary" dot>
                v0.1 — foundations
              </StatusPill>
              <h1 className="text-display text-4xl sm:text-6xl">
                See your money{" "}
                <span className="italic text-primary">clearly.</span>
              </h1>
              <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
                A calm, visual-first finance app. Large numbers. Soft charts.
                No dense tables. This page is the design system — no pages are
                wired yet.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="lg">Open dashboard</Button>
                <Button size="lg" variant="outline">
                  View components
                </Button>
              </div>
            </div>
          </section>

          {/* TYPOGRAPHY */}
          <Section eyebrow="Typography" title="Editorial display, quiet UI">
            <div className="surface-card space-y-6 p-6 sm:p-8">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Display · Instrument Serif
                </p>
                <p className="text-display text-6xl sm:text-7xl">
                  £12,480<span className="italic text-primary">.32</span>
                </p>
              </div>
              <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Heading
                  </p>
                  <h2 className="text-display text-3xl">This month's spending</h2>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Body · Geist
                  </p>
                  <p className="text-base text-muted-foreground">
                    A refined, geometric sans for the interface. Neutral, legible,
                    never in the way.
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Numeric · tabular
                  </p>
                  <p data-numeric className="text-2xl">
                    1,204.50 · 88.20 · 340.00
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Label
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.16em]">
                    Category · Groceries
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* COLOUR */}
          <Section eyebrow="Colour" title="Calm, visible, accessible">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Swatch name="Background" className="bg-background" />
              <Swatch name="Surface" className="bg-surface" />
              <Swatch name="Elevated" className="bg-surface-elevated" />
              <Swatch name="Card" className="bg-card" />
              <Swatch name="Primary" className="bg-primary" />
              <Swatch name="Primary soft" className="bg-primary-soft" />
              <Swatch name="Muted" className="bg-muted" />
              <Swatch name="Accent" className="bg-accent" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="surface-card p-4">
                <StatusPill tone="positive" dot>
                  Positive
                </StatusPill>
                <p className="mt-2 text-sm text-muted-foreground">
                  Income · under budget
                </p>
              </div>
              <div className="surface-card p-4">
                <StatusPill tone="negative" dot>
                  Negative
                </StatusPill>
                <p className="mt-2 text-sm text-muted-foreground">
                  Overspend · declined
                </p>
              </div>
              <div className="surface-card p-4">
                <StatusPill tone="warning" dot>
                  Warning
                </StatusPill>
                <p className="mt-2 text-sm text-muted-foreground">
                  Approaching limit
                </p>
              </div>
              <div className="surface-card p-4">
                <StatusPill tone="info" dot>
                  Info
                </StatusPill>
                <p className="mt-2 text-sm text-muted-foreground">
                  Review pending
                </p>
              </div>
            </div>
          </Section>

          {/* STAT CARDS */}
          <Section eyebrow="Cards" title="Numbers first, always">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Remaining this month"
                value="£1,284"
                delta={{ value: "+8%", tone: "positive" }}
                hint="You're ahead of last month by £96"
                icon={<Wallet className="h-4 w-4" />}
              />
              <StatCard
                label="Spent so far"
                value="£2,116"
                delta={{ value: "−3%", tone: "positive" }}
                hint="Groceries and travel are your top two"
                icon={<ArrowDownRight className="h-4 w-4" />}
              />
              <StatCard
                label="Saved"
                value="£420"
                delta={{ value: "+£120", tone: "positive" }}
                hint="Auto-transfer on the 1st"
                icon={<PiggyBank className="h-4 w-4" />}
              />
            </div>
          </Section>

          {/* BUTTONS */}
          <Section eyebrow="Buttons" title="Confident, tactile, quiet">
            <div className="surface-card flex flex-wrap gap-3 p-6">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">
                <ArrowUpRight className="mr-1.5 h-4 w-4" />
                Large action
              </Button>
              <Button disabled>Disabled</Button>
              <Button
                onClick={() =>
                  toast.success("Saved", {
                    description: "Your changes are stored.",
                  })
                }
              >
                Trigger toast
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.error("Couldn't reach backend", {
                    description: "Retry when the API is running.",
                  })
                }
              >
                Trigger error toast
              </Button>
            </div>
          </Section>

          {/* FORMS */}
          <Section eyebrow="Forms" title="Effortless input">
            <div className="surface-card grid gap-5 p-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ds-amount">Amount</Label>
                <Input id="ds-amount" placeholder="0.00" inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ds-category">Category</Label>
                <Select>
                  <SelectTrigger id="ds-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groceries">Groceries</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ds-note">Note</Label>
                <Textarea id="ds-note" placeholder="Optional details" />
              </div>
            </div>
          </Section>

          {/* STATES */}
          <Section eyebrow="States" title="Loading, empty, error">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Loading
                </p>
                <SkeletonStatCard />
                <div className="surface-card p-4">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
                <SkeletonChart />
              </div>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Empty
                </p>
                <EmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title="No transactions yet"
                  description="When you log or import a transaction, it will appear here."
                  action={<Button size="sm">Add transaction</Button>}
                />
              </div>
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Error
                </p>
                <ErrorState
                  onRetry={() => toast("Retrying…")}
                  description="We couldn't reach the local backend at 127.0.0.1:8000. Make sure it's running."
                />
              </div>
            </div>
          </Section>

          <p className="pt-4 text-center text-xs text-muted-foreground">
            Design system only · No pages are wired to the API yet.
          </p>
        </div>
      </AppShell>
      <Toaster richColors position="top-right" />
    </>
  );
}
