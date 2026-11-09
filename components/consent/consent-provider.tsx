"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  consentCookieString,
  cookiesToRemove,
  hasConsent,
  newConsent,
  type ConsentCategory,
  type ConsentChoices,
  type ConsentState,
} from "@/lib/consent/consent";

interface ConsentContextValue {
  consent: ConsentState | null;
  save: (choices: ConsentChoices) => void;
  preferencesOpen: boolean;
  openPreferences: () => void;
  setPreferencesOpen: (open: boolean) => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function deleteCookie(name: string) {
  // Covers cookies set on this host and on the parent domain (e.g. by a future tool).
  const host = window.location.hostname;
  for (const domain of ["", `; Domain=${host}`, `; Domain=.${host.replace(/^www\./, "")}`]) {
    document.cookie = `${name}=; Path=/; Max-Age=0${domain}`;
  }
}

/**
 * Holds the visitor's choice. The initial value is read on the server from the
 * request cookie, so a returning visitor never sees the banner flash.
 */
export function ConsentProvider({ initial, children }: { initial: ConsentState | null; children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(initial);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const save = useCallback((choices: ConsentChoices) => {
    const state = newConsent(choices);
    document.cookie = consentCookieString(state, window.location.protocol === "https:");
    // Withdrawal is as effective as refusal: cookies of refused categories are removed now,
    // and <ConsentGate> unmounts anything that depended on them.
    for (const name of cookiesToRemove(choices)) deleteCookie(name);
    setConsent(state);
    setPreferencesOpen(false);
    window.dispatchEvent(new CustomEvent("ml:consent-change", { detail: { choices } }));
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({ consent, save, preferencesOpen, openPreferences: () => setPreferencesOpen(true), setPreferencesOpen }),
    [consent, save, preferencesOpen],
  );
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const value = useContext(ConsentContext);
  if (!value) throw new Error("useConsent must be used inside <ConsentProvider>");
  return value;
}

/** Renders its children (e.g. a future analytics script) only after the visitor accepted that category. */
export function ConsentGate({ category, children }: { category: ConsentCategory; children: React.ReactNode }) {
  const { consent } = useConsent();
  return hasConsent(consent, category) ? <>{children}</> : null;
}
