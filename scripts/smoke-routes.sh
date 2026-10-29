#!/usr/bin/env bash
# Routing and API probes against a running server (default http://localhost:3100).
# Usage: scripts/smoke-routes.sh [base-url]
B="${1:-http://localhost:3100}"
for i in $(seq 1 60); do curl -s -o /dev/null "$B/en" && break; sleep 1; done
probe() {
  local body; body=$(mktemp)
  local out; out=$(curl -s -o "$body" -w '%{http_code} %{redirect_url}' -X "$1" "$B$2")
  printf "%-6s %-44s %s %s\n" "$1" "$2" "$out" "$(head -c 80 "$body" | tr -d '\n\0')"
  rm -f "$body"
}
probe GET  "/api/track?reference=MLDEMO000001"
probe GET  "/api/track?reference=%3Cx%3E"
probe POST "/api/track"
probe GET  "/api/quote"
probe POST "/api/quote"
probe GET  "/"
probe GET  "/quote"
probe GET  "/en"
probe GET  "/fr"
probe GET  "/en/quote"
probe GET  "/fr/track"
probe GET  "/en/portal"
probe GET  "/en/dashboard"
probe GET  "/en/login"
probe GET  "/en/does-not-exist"
