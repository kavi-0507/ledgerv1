import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const pill = cva(
  "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-medium tracking-tight",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        positive: "bg-positive-soft text-positive",
        negative: "bg-negative-soft text-negative",
        warning: "bg-warning-soft text-warning",
        info: "bg-info-soft text-info",
        primary: "bg-primary-soft text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

type Props = VariantProps<typeof pill> & {
  children: ReactNode;
  className?: string;
  dot?: boolean;
};

export function StatusPill({ tone, dot, className, children }: Props) {
  return (
    <span className={cn(pill({ tone }), className)}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-pill bg-current opacity-80"
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
