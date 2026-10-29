import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Plain GET form: works without JavaScript and produces a shareable URL. */
export function TrackSearch({ locale, defaultValue, error }: { locale: string; defaultValue?: string; error?: string }) {
  const t = useTranslations("track.form");
  return (
    <form action={`/${locale}/track`} method="get" className="space-y-2" role="search">
      <label htmlFor="reference" className="text-sm font-medium">
        {t("title")}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="reference"
          name="reference"
          defaultValue={defaultValue}
          placeholder={t("placeholder")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "reference-error reference-hint" : "reference-hint"}
          className="h-12 flex-1 font-mono text-base uppercase"
        />
        <Button type="submit" size="lg" className="h-12">
          <Search className="mr-2 h-4 w-4" aria-hidden />
          {t("buttons.track")}
        </Button>
      </div>
      <p id="reference-hint" className="text-xs text-muted-foreground">
        {t("description")}
      </p>
      {error && (
        <p id="reference-error" role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
