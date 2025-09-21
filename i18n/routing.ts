// i18n/routing.ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'fr'] as const,
  defaultLocale: 'en',
  localePrefix: "always"
});

export type Locale = (typeof routing.locales)[number];