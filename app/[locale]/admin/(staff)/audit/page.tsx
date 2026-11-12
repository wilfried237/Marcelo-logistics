import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDb } from "@/lib/db/client";
import { pageStaff } from "@/lib/auth/page-user";
import { AUDIT_ACTIONS, AUDIT_ENTITIES, listAuditActors, searchAudit, type AuditFilter } from "@/lib/services/audit";
import { Alert } from "@/components/app/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { selectClassName } from "@/components/app/form-field";

type Search = { [K in keyof Omit<AuditFilter, "page">]?: string } & { page?: string };

/**
 * Staff audit history (Stage 6). Filters, reference search and pagination run on
 * the server; each entry shows WHICH fields changed, never their values (D3).
 */
export default async function AdminAudit({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Search> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await pageStaff(locale, "/admin/audit");
  const raw = await searchParams;
  const one = (v: unknown) => (typeof v === "string" ? v.slice(0, 64) : undefined);
  const filter: AuditFilter = { entity: one(raw.entity), action: one(raw.action), actor: one(raw.actor), from: one(raw.from), to: one(raw.to), q: one(raw.q), page: Number(one(raw.page) ?? 1) };
  const t = await getTranslations("admin.audit");
  const format = await getFormatter();
  const db = getDb();
  const [result, actors] = await Promise.all([searchAudit(db, user, filter), listAuditActors(db, user)]);

  const query = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filter, page: String(page) })) if (v && k !== "page") p.set(k, String(v));
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/audit${s ? `?${s}` : ""}`;
  };
  const actorLabel = (actor: { id: string | null; name: string | null }) =>
    actor.id === null ? t("system") : actor.id === user.id ? t("you") : (actor.name ?? t("staffMember", { id: actor.id.slice(0, 8) }));

  return (
    <div className="space-y-6">
      <PageHeader title={(await getTranslations("admin"))("nav.audit")} description={t("intro")} />

      <form method="get" role="search" aria-label={t("filters")} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("reference")}</span>
          <input name="q" type="search" defaultValue={filter.q ?? ""} placeholder={t("referencePlaceholder")} maxLength={40} className={selectClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("recordType")}</span>
          <select name="entity" defaultValue={filter.entity ?? ""} className={selectClassName}>
            <option value="">{t("allTypes")}</option>
            {AUDIT_ENTITIES.map((e) => (
              <option key={e} value={e}>
                {t(`entities.${e}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("action")}</span>
          <select name="action" defaultValue={filter.action ?? ""} className={selectClassName}>
            <option value="">{t("allActions")}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`actions.${a}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("actor")}</span>
          <select name="actor" defaultValue={filter.actor ?? ""} className={selectClassName}>
            <option value="">{t("allActors")}</option>
            <option value="system">{t("system")}</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? t("staffMember", { id: a.id.slice(0, 8) })}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("from")}</span>
          <input name="from" type="date" defaultValue={filter.from ?? ""} className={selectClassName} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t("to")}</span>
          <input name="to" type="date" defaultValue={filter.to ?? ""} className={selectClassName} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <Button type="submit">{t("apply")}</Button>
          <Link href="/admin/audit" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {t("clear")}
          </Link>
          <span className="text-xs text-muted-foreground">{t("datesNote")}</span>
        </div>
      </form>

      {result.invalidReference && <Alert variant="warning">{t("invalidReference")}</Alert>}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("count", { count: result.total })}
      </p>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <caption className="sr-only">{t("intro")}</caption>
          <thead className="border-b bg-secondary/50">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("when")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("action")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("entity")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("fields")}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t("actor")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {result.entries.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{format.dateTime(new Date(e.at), { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Dublin" })}</td>
                <td className="px-4 py-2.5">{(AUDIT_ACTIONS as readonly string[]).includes(e.action) ? t(`actions.${e.action as "insert"}`) : e.action}</td>
                <td className="px-4 py-2.5">
                  <span>{(AUDIT_ENTITIES as readonly string[]).includes(e.entity) ? t(`entities.${e.entity as "quotes"}`) : e.entity}</span>
                  {e.link && (
                    <>
                      {" · "}
                      <Link href={e.link.href} className="font-medium text-primary underline-offset-4 hover:underline">
                        {e.link.label || t("open")}
                      </Link>
                    </>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs">{e.fields.length ? e.fields.join(", ") : "—"}</td>
                <td className="px-4 py-2.5">{actorLabel(e.actor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result.entries.length && <p className="p-4 text-sm text-muted-foreground">{t("none")}</p>}
      </div>

      <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
        {result.page > 1 ? (
          <Link href={query(result.page - 1)} className="font-medium text-primary underline-offset-4 hover:underline">
            {t("previous")}
          </Link>
        ) : (
          <span />
        )}
        <span className="text-muted-foreground">{t("page", { page: result.page, pages: result.pages })}</span>
        {result.page < result.pages ? (
          <Link href={query(result.page + 1)} className="font-medium text-primary underline-offset-4 hover:underline">
            {t("next")}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
