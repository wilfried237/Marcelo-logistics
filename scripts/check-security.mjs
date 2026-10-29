#!/usr/bin/env node
// Static security and content-integrity checks. These complement, and never
// replace, the runtime access-control tests in tests/db and tests/security.
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SOURCE_DIRS = ["app", "components", "lib", "config", "emails", "middleware.ts", "i18n"];
const SERVER_ONLY_MODULES = [/@\/lib\/supabase\/admin/, /@\/lib\/db(\/|["'])/, /@\/lib\/config\/env/, /@\/lib\/email\/send/, /@\/lib\/services\//];

// Claims that must never be published without owner-verified evidence (EN + FR).
export const BANNED_PHRASES = [
  /verified customer/i, /client v[ée]rifi[ée]/i,
  /\b99 ?%/, /\b1 ?000\+/, /\b50\+ ?(countries|pays)/i,
  /guarante/i, /garanti/i,
  /real-time/i, /temps r[ée]el/i,
  /insurance/i, /assurance/i,
  /shadcnblocks/i, /acme (inc|corp)/i, /evil corp/i, /your company/i, /sofia davis/i, /sarah johnson/i,
];

function walk(path, files = []) {
  let stat;
  try { stat = statSync(path); } catch { return files; }
  if (stat.isDirectory()) for (const entry of readdirSync(path)) walk(join(path, entry), files);
  else if (/\.(tsx?|mjs|json)$/.test(path)) files.push(path);
  return files;
}

export function checkClientImports(files) {
  const problems = [];
  for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
    const text = readFileSync(file, "utf8");
    if (!/^\s*["']use client["']/m.test(text.split("\n").slice(0, 5).join("\n"))) continue;
    for (const re of SERVER_ONLY_MODULES) if (re.test(text)) problems.push(`${file}: client component imports server-only module ${re}`);
    if (/SERVICE_ROLE|DATABASE_URL|RESEND_API_KEY/.test(text)) problems.push(`${file}: client component references a server secret name`);
  }
  return problems;
}

export function checkPublicSecretNames(files) {
  return files
    .filter((f) => /NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|DATABASE|RESEND)/.test(readFileSync(f, "utf8")))
    .map((f) => `${f}: exposes a secret through a NEXT_PUBLIC_ variable`);
}

export function checkBannedPhrases(files) {
  const problems = [];
  for (const file of files.filter((f) => f.startsWith("messages") || f.startsWith(`config`) || f.startsWith("components") || f.startsWith("app") || f.startsWith("emails"))) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (line.includes("check-security: allow")) return;
      for (const re of BANNED_PHRASES) if (re.test(line)) problems.push(`${file}:${i + 1}: unverified claim or template leftover matches ${re}`);
    });
  }
  return problems;
}

function trackedEnvFiles() {
  try {
    return execSync("git ls-files", { encoding: "utf8" })
      .split("\n")
      .filter((f) => /(^|\/)\.env/.test(f) && !f.endsWith(".env.example"))
      .map((f) => `${f}: environment file is tracked by git`);
  } catch {
    return [];
  }
}

function main() {
  const files = SOURCE_DIRS.flatMap((d) => walk(d)).concat(walk("messages")).map((f) => relative(".", f).replace(/\\/g, "/"));
  const problems = [...checkClientImports(files), ...checkPublicSecretNames(files), ...checkBannedPhrases(files), ...trackedEnvFiles()];
  if (problems.length) {
    console.error(`security: ${problems.length} problem(s)\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`security: OK (${files.length} files scanned)`);
}

if (process.argv[1]?.endsWith("check-security.mjs")) main();
