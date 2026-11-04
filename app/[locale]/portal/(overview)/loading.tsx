import { useTranslations } from "next-intl";

export default function PortalLoading() {
  const t = useTranslations("common");
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">{t("loading")}</span>
      <div className="h-9 w-64 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
    </div>
  );
}
