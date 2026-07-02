import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { StatusPill } from "./StatusPill";

type Props = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: string; tone: "positive" | "negative" | "neutral" };
  icon?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, hint, delta, icon, className }: Props) {
  return (
    <div
      className={cn(
        "surface-card interactive group p-5 sm:p-6",
        "flex flex-col gap-4",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <p className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {icon && (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span
          data-numeric
          className="text-display text-4xl sm:text-5xl text-foreground"
        >
          {value}
        </span>
        {delta && (
          <StatusPill
            tone={
              delta.tone === "positive"
                ? "positive"
                : delta.tone === "negative"
                  ? "negative"
                  : "neutral"
            }
          >
            {delta.value}
          </StatusPill>
        )}
      </div>

      {hint && (
        <p className="text-sm text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
