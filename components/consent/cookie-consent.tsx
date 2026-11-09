"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ALL_OPTIONAL, NO_OPTIONAL, OPTIONAL_CATEGORIES, OPTIONAL_COOKIES, type ConsentChoices } from "@/lib/consent/consent";
import { useConsent } from "./consent-provider";

/**
 * First-visit banner and the preferences dialog.
 * - Accept and Reject have the same size, style and position weight.
 * - Nothing optional is pre-ticked; the banner is not a modal, so the page stays usable.
 * - The dialog can be reopened at any time from the footer ("Cookie preferences").
 */
/** Long labels (French) wrap instead of overflowing. */
const WRAP = "h-auto min-h-9 whitespace-normal py-2 text-center";

export function CookieConsent() {
  const t = useTranslations("consent");
  const { consent, save, preferencesOpen, setPreferencesOpen } = useConsent();

  return (
    <>
      {consent === null && !preferencesOpen && (
        <section
          aria-label={t("bannerLabel")}
          data-testid="cookie-banner"
          className="fixed inset-x-3 bottom-3 z-40 rounded-lg border bg-background p-4 text-sm shadow-lg md:inset-x-auto md:right-6 md:bottom-6 md:max-w-md"
        >
          <h2 className="font-semibold">{t("bannerTitle")}</h2>
          <p className="mt-1 text-muted-foreground">
            {t("bannerBody")}{" "}
            <Link href="/cookies" className="font-medium text-primary underline underline-offset-2">
              {t("policyLink")}
            </Link>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" className={WRAP} onClick={() => save(ALL_OPTIONAL)}>
              {t("acceptAll")}
            </Button>
            <Button type="button" className={WRAP} onClick={() => save(NO_OPTIONAL)}>
              {t("rejectOptional")}
            </Button>
            <Button type="button" variant="outline" className={`${WRAP} col-span-2`} onClick={() => setPreferencesOpen(true)}>
              {t("customise")}
            </Button>
          </div>
        </section>
      )}

      <Dialog.Root open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed inset-x-3 top-1/2 z-50 max-h-[90vh] -translate-y-1/2 overflow-y-auto rounded-lg border bg-background p-5 shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2">
            <Dialog.Title className="pr-8 text-lg font-semibold">{t("dialogTitle")}</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">{t("dialogIntro")}</Dialog.Description>
            {/* Remounted on every opening, so unsaved changes never linger. */}
            {preferencesOpen && <PreferencesForm initial={consent?.choices ?? NO_OPTIONAL} onSave={save} />}
            <Dialog.Close className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
              <XIcon className="size-5" />
              <span className="sr-only">{t("close")}</span>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function PreferencesForm({ initial, onSave }: { initial: ConsentChoices; onSave: (choices: ConsentChoices) => void }) {
  const t = useTranslations("consent");
  const [choices, setChoices] = useState<ConsentChoices>(initial);

  return (
    <form
      className="mt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(choices);
      }}
    >
      <ul className="divide-y rounded-md border">
        <li className="flex items-start justify-between gap-4 p-3">
          <div>
            <p className="font-medium" id="consent-necessary">
              {t("categories.necessary.title")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("categories.necessary.description")}</p>
          </div>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{t("alwaysActive")}</span>
        </li>
        {OPTIONAL_CATEGORIES.map((category) => (
          <li key={category} className="flex items-start justify-between gap-4 p-3">
            <label htmlFor={`consent-${category}`} className="cursor-pointer">
              <span className="block font-medium">{t(`categories.${category}.title`)}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{t(`categories.${category}.description`)}</span>
              {OPTIONAL_COOKIES[category].length === 0 && <span className="mt-1 block text-xs text-muted-foreground italic">{t("notInUse")}</span>}
            </label>
            <input
              id={`consent-${category}`}
              type="checkbox"
              role="switch"
              aria-checked={choices[category]}
              checked={choices[category]}
              onChange={(event) => setChoices((current) => ({ ...current, [category]: event.target.checked }))}
              className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
            />
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button type="button" className={WRAP} onClick={() => onSave(NO_OPTIONAL)}>
          {t("rejectOptional")}
        </Button>
        <Button type="button" className={WRAP} onClick={() => onSave(ALL_OPTIONAL)}>
          {t("acceptAll")}
        </Button>
        <Button type="submit" variant="outline" className={`${WRAP} sm:col-span-2`}>
          {t("save")}
        </Button>
      </div>
      <p className="mt-4 text-sm">
        <Link href="/cookies" className="text-primary underline underline-offset-2">
          {t("policyLink")}
        </Link>
      </p>
    </form>
  );
}

/** Footer entry point: reopens the preferences dialog so consent can be changed or withdrawn at any time. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  const t = useTranslations("consent");
  const { openPreferences } = useConsent();
  return (
    <button type="button" onClick={openPreferences} className={className}>
      {t("footerLink")}
    </button>
  );
}
