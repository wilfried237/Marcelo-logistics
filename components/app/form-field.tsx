import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type ControlProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

/**
 * Label + control + hint + error, wired with aria-describedby / aria-invalid.
 * The render prop receives the props the control must spread.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  className?: string;
  children: (props: ControlProps) => React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted-foreground">({optionalLabel})</span>}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export const selectClassName =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-[invalid=true]:border-destructive";

export const inputClassName = "h-11";
