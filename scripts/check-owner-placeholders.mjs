#!/usr/bin/env node
// Release gate for unresolved owner decisions.
//
// Scans owner-controlled content (translation files and config/owner.ts) for the
// {{NEEDS_OWNER}} marker.
// - Release builds (RELEASE_BUILD=true, or VERCEL_ENV=production) FAIL if any remain.
// - Every other build (local dev, CI, preview) only prints a warning, so normal
//   development is not blocked.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const MARKER = "{{NEEDS_OWNER}}";
export const OWNER_CONTENT = ["config/owner.ts", "config/retention.ts", ...readdirSync("messages").filter((f) => f.endsWith(".json")).map((f) => join("messages", f))];

export function findPlaceholders(files = OWNER_CONTENT) {
  const hits = [];
  for (const file of files) {
    if (!existsSync(file)) continue;
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (line.includes(MARKER) && !line.includes("@owner-marker-definition")) hits.push(`${file}:${index + 1}: ${line.trim().slice(0, 100)}`);
      });
  }
  return hits;
}

/** @param {Record<string, string | undefined>} [env] */
export function isReleaseBuild(env = process.env) {
  return env.RELEASE_BUILD === "true" || env.VERCEL_ENV === "production";
}

function main() {
  const hits = findPlaceholders();
  if (hits.length === 0) {
    console.log("owner placeholders: none remaining");
    return;
  }
  if (isReleaseBuild()) {
    console.error(`owner placeholders: ${hits.length} unresolved ${MARKER} value(s). A release build cannot ship them.\nResolve them via docs/DECISIONS-REQUIRED.md:\n  ${hits.join("\n  ")}`);
    process.exit(1);
  }
  console.warn(`owner placeholders: ${hits.length} unresolved (allowed in non-release builds; a release build will fail). Run "npm run check:owner" for details.`);
  if (process.argv.includes("--list")) console.warn(`  ${hits.join("\n  ")}`);
}

if (process.argv[1]?.endsWith("check-owner-placeholders.mjs")) main();
