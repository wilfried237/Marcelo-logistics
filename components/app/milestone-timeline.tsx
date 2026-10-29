import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { EXCEPTION_MILESTONES, type MilestoneCode } from "@/lib/domain/enums";
import { cn } from "@/lib/utils";

export interface TimelineEvent {
  milestone: MilestoneCode;
  location: string | null;
  occurredAt: string | Date;
  noteEn: string | null;
  noteFr: string | null;
  public?: boolean;
}

/** Newest first. Exception milestones (delays, holds) are visually distinct and labelled. */
export function MilestoneTimeline({ events, showVisibility = false }: { events: TimelineEvent[]; showVisibility?: boolean }) {
  const t = useTranslations("milestones");
  const tc = useTranslations("common");
  const format = useFormatter();
  const locale = useLocale();
  return (
    <ol className="relative space-y-6 border-l-2 border-border pl-6">
      {events.map((event, index) => {
        const exception = EXCEPTION_MILESTONES.includes(event.milestone);
        const Icon = exception ? AlertTriangle : CheckCircle2;
        const note = locale === "fr" ? (event.noteFr ?? event.noteEn) : (event.noteEn ?? event.noteFr);
        const at = new Date(event.occurredAt);
        return (
          <li key={`${event.milestone}-${index}`} className="relative">
            <span
              className={cn(
                "absolute -left-[2.15rem] flex h-7 w-7 items-center justify-center rounded-full border-2 bg-background",
                exception ? "border-warning text-warning" : index === 0 ? "border-primary text-primary" : "border-border text-muted-foreground",
              )}
              aria-hidden
            >
              <Icon className="h-4 w-4" />
            </span>
            <p className="font-semibold">
              {t(event.milestone)}
              {index === 0 && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">{tc("latest")}</span>}
              {showVisibility && (
                <span className="ml-2 rounded border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {event.public ? tc("visibleToCustomer") : tc("internalOnly")}
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              <time dateTime={at.toISOString()}>{format.dateTime(at, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Dublin" })}</time>
              {event.location ? ` · ${event.location}` : ""}
            </p>
            {note && <p className="mt-1 text-sm">{note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
