import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asSystem, createTestDb, createUser, type TestDb } from "./harness";
import { seedDemoData } from "../../scripts/seed-data";

let t: TestDb;
let users: { adminId: string; staffId: string; customerOneId: string; customerTwoId: string };

beforeAll(async () => {
  t = await createTestDb();
  users = {
    adminId: (await createUser(t.client, "demo.admin@example.test", "admin", "Demo Admin")).id,
    staffId: (await createUser(t.client, "demo.staff@example.test", "staff", "Demo Staff")).id,
    customerOneId: (await createUser(t.client, "demo.customer1@example.test", "customer", "Demo Customer One")).id,
    customerTwoId: (await createUser(t.client, "demo.customer2@example.test", "customer", "Demo Customer Two")).id,
  };
});
afterAll(async () => t?.client.close());

const query = async (sql: string, params: unknown[] = []) => (await t.client.query<Record<string, unknown>>(sql, params)).rows;
const queryAs = (actor: string, sql: string, params: unknown[] = []) => asSystem(t.client, sql, params, actor);

describe("local seed", () => {
  it("creates requests in every workflow stage through the real triggers", async () => {
    const result = await seedDemoData(query, queryAs, users);
    expect(result).toEqual({ quoteRequests: 5, quotes: 2, shipments: 1, events: 4 });
    const statuses = (await query("select reference, status from public.quote_requests order by reference")).map((r) => `${r.reference}:${r.status}`);
    expect(statuses).toEqual(["QRDEMOAA:SUBMITTED", "QRDEMOAB:AWAITING_CUSTOMER", "QRDEMOAC:QUOTED", "QRDEMOAD:ACCEPTED", "QRDEMOAE:CANCELLED"]);
  });

  it("is idempotent", async () => {
    const again = await seedDemoData(query, queryAs, users);
    expect(again).toEqual({ quoteRequests: 0, quotes: 0, shipments: 0, events: 0 });
  });

  it("records audit entries attributed to the acting users", async () => {
    const actors = await query("select distinct actor from public.audit_log where entity = 'quote_requests' and actor is not null");
    expect(actors.map((r) => r.actor).sort()).toEqual([users.staffId, users.customerOneId, users.customerTwoId].sort());
  });

  it("only contains clearly fictitious data", async () => {
    const dump = JSON.stringify(await query("select c.name, c.email, r.items, r.notes from public.customers c left join public.quote_requests r on r.customer_id = c.id"));
    expect(dump).not.toMatch(/@(?!example\.test)[a-z0-9.-]+\.[a-z]{2,}/i);
    expect(dump).toMatch(/Demo/);
  });

  it("exposes only the public demo events through public tracking", async () => {
    const [{ result }] = (await t.client.query<{ result: { events: unknown[] } }>("select public.public_track_shipment('MLDEMOAAAAAA') result")).rows;
    expect(result.events).toHaveLength(3);
    expect(JSON.stringify(result)).not.toMatch(/internal/i);
  });
});
