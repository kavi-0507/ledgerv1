import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 pb-6 sm:pb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 truncate text-display text-3xl sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
