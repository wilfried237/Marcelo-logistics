# Cookie policy: DRAFT for legal review (not approved)

The live page `/en/cookies` and `/fr/cookies` (with a draft notice) is the source of truth for the wording. This file records the inventory, the method used to establish it, and the open points for review (L-04).

## Inventory (verified 2026-11-09)

**Method:**

- Live production responses for `/`, `/en`, `/fr`, `/en/login`, `/en/track` and `/en/contact` were inspected: the only `Set-Cookie` header is `NEXT_LOCALE`.
- Every cookie write in the code was reviewed: next-intl middleware, Supabase SSR session handling and the consent banner.
- No third-party script, iframe, font, analytics or advertising tag is loaded. The Content Security Policy allows scripts from `'self'` with a nonce only, and frames are blocked.

| Cookie | Set by | Purpose | Category | Duration | Attributes |
| --- | --- | --- | --- | --- | --- |
| `NEXT_LOCALE` | First party (next-intl) | Remembers the chosen language | Strictly necessary | Session | Path=/, SameSite=Lax |
| `ml_consent` | First party (consent banner) | Records the cookie choices and policy version, e.g. `1.0.0.0.<time>`. It holds no personal data. | Strictly necessary | 180 days | Path=/, SameSite=Lax, Secure on HTTPS |
| `sb-<project>-auth-token` (may be split into `.0`, `.1`, …) | First party (Supabase SSR) | Sign-in session, only after login | Strictly necessary | Up to 400 days (the library default) or until sign-out | HttpOnly, Secure, SameSite=Lax |
| `sb-<project>-auth-token-code-verifier` | First party (Supabase SSR, PKCE) | Secures a password-reset request | Strictly necessary | Up to 400 days or until the reset is completed | HttpOnly, Secure, SameSite=Lax |

No `localStorage` or `sessionStorage` is used.

## Consent manager (implemented)

- **First visit:** a banner, not a modal, offering **Accept all**, **Reject optional cookies** and **Customise preferences**. Accept and Reject have identical styling and size.
- **Categories:** strictly necessary (always on, no switch), functional, analytics and marketing. Each optional category is off by default and labelled "Not used on this website at present".
- **Storage:** the choice is stored with the policy version and time. A change of version, an expired choice or a malformed value shows the banner again.
- **Withdrawing consent:** "Cookie preferences" in the footer of every public page reopens the dialog. Cookies of refused categories are deleted, and `<ConsentGate>` unmounts anything that depended on them.
- **Future tools:** any optional script must be wrapped in `<ConsentGate category="…">`. It must also be listed in `OPTIONAL_COOKIES` and on the policy page, and `CONSENT_POLICY_VERSION` must be bumped (see `lib/consent/consent.ts`).
- **Tests:** `tests/unit/consent.test.ts` and `tests/e2e/consent.spec.ts` cover first visit, reject, accept, customise, withdraw, Escape, version change, French, mobile layout and axe accessibility.

## Points for review (L-04)

1. **Is the banner needed at all?** Under Regulation 5(3) of S.I. 336/2011 and the Data Protection Commission's guidance, strictly necessary cookies are exempt from consent. A banner is therefore not legally required **today**. It is shown because the owner asked for one and so that the mechanism exists before any optional tool is added. **[LEGAL: confirm the wording does not suggest optional cookies are in use.]**
2. **Proof of consent.** Today the choice is recorded only on the visitor's device. If optional tools are added, decide whether a server-side consent log is needed.
3. **Duration.** 180 days was chosen to follow common European regulator guidance, which suggests re-asking at about six months. **[LEGAL: confirm.]**
4. **Session cookie duration.** The Supabase session cookie lasts up to 400 days, the library default. **[OWNER: a shorter cap can be configured if preferred.]**

## English and French text

The full wording is in `messages/en.json` and `messages/fr.json`, in the `cookiePolicy` and `consent` sections. It is reproduced on the live pages `/en/cookies` and `/fr/cookies`.
