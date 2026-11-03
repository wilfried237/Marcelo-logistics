// Local stand-in for the Resend HTTP API, for full-stack journeys only.
// The application's real sending code talks to it through RESEND_BASE_URL, so
// nothing ever leaves the machine. Control endpoints (test-only):
//   GET  /__sent          -> every captured email (to, subject, html, text)
//   POST /__mode?fail=1   -> answer 503 to sends (provider outage); fail=0 restores
//   POST /__reset         -> forget captured emails
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_RESEND_PORT ?? 4010);
const sent = [];
let failing = false;

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    if (req.method === "GET" && url.pathname === "/__sent") return json(res, 200, sent);
    if (req.method === "POST" && url.pathname === "/__mode") {
      failing = url.searchParams.get("fail") === "1";
      return json(res, 200, { failing });
    }
    if (req.method === "POST" && url.pathname === "/__reset") {
      sent.length = 0;
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/emails") {
      if (failing) return json(res, 503, { name: "application_error", message: "Service unavailable (mock outage)" });
      const body = JSON.parse(raw || "{}");
      const id = `mock_${sent.length + 1}_${Date.now()}`;
      sent.push({ id, to: [].concat(body.to ?? []), subject: body.subject, html: body.html, text: body.text, idempotencyKey: req.headers["idempotency-key"] ?? null });
      return json(res, 200, { id });
    }
    json(res, 404, { message: "not found" });
  });
}).listen(PORT, "127.0.0.1", () => console.log(`mock resend listening on ${PORT}`));
