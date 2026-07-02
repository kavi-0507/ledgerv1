import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
};

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't reach your data. Check your connection and try again.",
  onRetry,
  action,
}: Props) {
  return (
    <div className="surface-card flex flex-col items-center gap-4 px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-negative-soft text-negative">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-display text-2xl">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action ?? (onRetry && <Button onClick={onRetry}>Try again</Button>)}
    </div>
  );
}
