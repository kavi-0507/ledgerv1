import type { ReactNode } from "react";
import { ErrorState } from "./ErrorState";

type Props = {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  loading?: ReactNode;
  children: ReactNode;
};

export function QueryBoundary({
  isLoading,
  isError,
  error,
  onRetry,
  loading,
  children,
}: Props) {
  if (isLoading) return <>{loading}</>;
  if (isError) {
    const message =
      error instanceof Error
        ? error.message
        : "Something went wrong loading this data.";
    return (
      <ErrorState
        title="We couldn't load this"
        description={message}
        onRetry={onRetry}
      />
    );
  }
  return <>{children}</>;
}
