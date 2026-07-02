import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col items-center gap-4 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          {icon}
        </div>
      )}
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-display text-2xl">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
