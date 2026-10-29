import { useTranslations } from "next-intl";

/** Placeholder until the role-protected staff area (/admin) replaces it. Reachable only as a preview. */
export default function DashboardPreviewPage() {
  const t = useTranslations("preview");
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-muted-foreground">{t("banner")}</p>
    </div>
  );
}
