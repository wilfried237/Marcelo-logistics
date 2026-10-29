import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Container({ children, className, size = "default" }: { children: React.ReactNode; className?: string; size?: "default" | "narrow" | "wide" }) {
  const width = size === "narrow" ? "max-w-3xl" : size === "wide" ? "max-w-7xl" : "max-w-6xl";
  return <div className={cn("mx-auto w-full px-4 md:px-6", width, className)}>{children}</div>;
}
