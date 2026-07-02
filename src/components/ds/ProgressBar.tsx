import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  tone = "primary",
  className,
}: {
  value: number; // 0..100
  tone?: "primary" | "positive" | "warning" | "negative";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const toneClass =
    tone === "positive"
      ? "bg-positive"
      : tone === "warning"
        ? "bg-warning"
        : tone === "negative"
          ? "bg-negative"
          : "bg-primary";
  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-pill bg-muted",
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-pill transition-all", toneClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
