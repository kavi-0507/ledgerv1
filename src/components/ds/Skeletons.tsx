import { cn } from "@/lib/utils";

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full rounded-sm", className)} />;
}

export function SkeletonStatCard() {
  return (
    <div className="surface-card space-y-4 p-6">
      <SkeletonLine className="h-3 w-24" />
      <SkeletonLine className="h-10 w-40" />
      <SkeletonLine className="h-3 w-32" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="skeleton h-10 w-10 rounded-md shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonLine className="h-3 w-1/3" />
        <SkeletonLine className="h-3 w-1/4" />
      </div>
      <SkeletonLine className="h-4 w-16 shrink-0" />
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return <div className={cn("skeleton h-56 w-full rounded-lg", className)} />;
}
