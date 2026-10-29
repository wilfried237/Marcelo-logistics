import { useTranslations } from "next-intl";
import { NEEDS_OWNER } from "@/config/owner";

/**
 * Renders the business name from the `brand.name` translation key.
 * While the name is unresolved (owner decision B-01) a clearly-marked pending
 * label is shown instead; release builds cannot ship with the marker.
 */
export function BrandName({ className }: { className?: string }) {
  const t = useTranslations("brand");
  const name = t("name");
  if (name.includes(NEEDS_OWNER)) {
    return (
      <span className={className} data-owner-pending="brand.name">
        {t("tagline")}
      </span>
    );
  }
  return <span className={className}>{name}</span>;
}
