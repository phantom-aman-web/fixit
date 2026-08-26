"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Caught in root error boundary:", error);
  }, [error]);

  return (
    <div className="flex h-[100vh] w-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
        <AlertTriangle className="h-10 w-10" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold tracking-tight">Something went wrong</h2>
      <p className="mb-8 max-w-md text-muted-foreground">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
      {process.env.NODE_ENV !== "production" && error.stack && (
        <pre className="mt-8 max-w-4xl overflow-auto rounded bg-muted p-4 text-left text-xs">
          {error.stack}
        </pre>
      )}
    </div>
  );
}
