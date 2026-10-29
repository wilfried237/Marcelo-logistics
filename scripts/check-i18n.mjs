#!/usr/bin/env node
// Verifies that every locale file has exactly the same keys, value types and
// ICU arguments as the reference locale (en), and that no value is empty or
// contains leftover technical placeholders. Exit code 1 on any problem.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = "messages";
const REFERENCE = "en";
const OWNER_PLACEHOLDER = "{{NEEDS_OWNER}}";
const FORBIDDEN = [/\bTODO\b/i, /\bFIXME\b/i, /lorem ipsum/i, /\bundefined\b/, /\bnull\b/, /\[object Object\]/];

export function flatten(obj, prefix = "") {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(out, flatten(value, path));
    else out[path] = value;
  }
  return out;
}

/** Top-level ICU argument names, e.g. "{count, plural, ...}" -> count. */
export function icuArgs(message) {
  const args = new Set();
  let depth = 0;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (ch === "{") {
      if (depth === 0) {
        const match = /^\{\s*([A-Za-z_][\w]*)/.exec(message.slice(i));
        if (match && !message.startsWith(OWNER_PLACEHOLDER, i - 1)) args.add(match[1]);
      }
      depth++;
    } else if (ch === "}") depth = Math.max(0, depth - 1);
  }
  return [...args].sort();
}

export function checkMessages(locales) {
  const problems = [];
  const ref = flatten(locales[REFERENCE]);
  for (const [locale, messages] of Object.entries(locales)) {
    const flat = flatten(messages);
    for (const key of Object.keys(ref)) if (!(key in flat)) problems.push(`${locale}: missing key "${key}"`);
    for (const key of Object.keys(flat)) {
      if (!(key in ref)) problems.push(`${locale}: extra key "${key}" (not in ${REFERENCE})`);
      const value = flat[key];
      if (Array.isArray(value)) problems.push(`${locale}: "${key}" is an array; use nested keys instead`);
      else if (typeof value !== "string") problems.push(`${locale}: "${key}" must be a string`);
      else {
        if (value.trim() === "") problems.push(`${locale}: "${key}" is empty`);
        for (const re of FORBIDDEN) if (re.test(value)) problems.push(`${locale}: "${key}" contains ${re}`);
        if (key in ref && typeof ref[key] === "string" && value !== OWNER_PLACEHOLDER && ref[key] !== OWNER_PLACEHOLDER) {
          const a = icuArgs(ref[key]).join(",");
          const b = icuArgs(value).join(",");
          if (a !== b) problems.push(`${locale}: "${key}" ICU arguments [${b}] differ from ${REFERENCE} [${a}]`);
        }
      }
    }
  }
  return problems;
}

function main() {
  const locales = {};
  for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
    const locale = file.replace(/\.json$/, "");
    try {
      locales[locale] = JSON.parse(readFileSync(join(DIR, file), "utf8"));
    } catch (error) {
      console.error(`i18n: ${file} is not valid JSON: ${error.message}`);
      process.exit(1);
    }
  }
  if (!locales[REFERENCE]) {
    console.error(`i18n: reference locale ${REFERENCE}.json not found`);
    process.exit(1);
  }
  const problems = checkMessages(locales);
  if (problems.length) {
    console.error(`i18n: ${problems.length} problem(s)\n  - ${problems.join("\n  - ")}`);
    process.exit(1);
  }
  const count = Object.keys(flatten(locales[REFERENCE])).length;
  console.log(`i18n: OK (${Object.keys(locales).join(", ")}; ${count} keys each)`);
}

if (process.argv[1]?.endsWith("check-i18n.mjs")) main();
