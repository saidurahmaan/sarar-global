import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div
      className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2
        className="size-11 shrink-0 animate-spin text-primary"
        strokeWidth={2}
        aria-hidden
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
