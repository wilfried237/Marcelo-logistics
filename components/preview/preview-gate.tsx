import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isPreviewAreasEnabled } from "@/lib/config/flags";

/** Server-side gate for placeholder areas. Renders a 404 unless previews are enabled. */
export async function PreviewGate({ children }: { children: React.ReactNode }) {
  if (!isPreviewAreasEnabled()) notFound();
  const t = await getTranslations("preview");
  return (
    <>
      <div role="status" className="bg-amber-100 text-amber-950 border-b border-amber-300 px-4 py-2 text-center text-sm font-medium">
        {t("banner")}
      </div>
      {children}
    </>
  );
}
