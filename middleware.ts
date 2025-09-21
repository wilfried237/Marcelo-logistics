import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all routes (whether they have locale or not)
  matcher: ["/((?!_next|.*\\..*).*)"],
};
