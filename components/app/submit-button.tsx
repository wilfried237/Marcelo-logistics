"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Disables itself and announces progress while the enclosing form action runs. */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: React.ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
