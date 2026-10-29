import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  info: { icon: Info, className: "border-info/30 bg-info-soft text-info" },
  success: { icon: CheckCircle2, className: "border-success/30 bg-success-soft text-success" },
  warning: { icon: AlertTriangle, className: "border-warning/30 bg-warning-soft text-warning" },
  danger: { icon: XCircle, className: "border-destructive/30 bg-danger-soft text-destructive" },
} as const;

/** Errors use role="alert"; everything else is a polite status message. */
export function Alert({
  variant = "info",
  title,
  children,
  className,
  id,
}: {
  variant?: keyof typeof VARIANTS;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const { icon: Icon, className: tone } = VARIANTS[variant];
  return (
    <div id={id} role={variant === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-4", tone, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="space-y-1 text-sm text-foreground">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
