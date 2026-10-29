import { describe, expect, it } from "vitest";
import { dublinLocalToIso } from "@/lib/domain/time";

describe("Irish local time conversion", () => {
  it("handles winter (GMT, UTC+0)", () => {
    expect(dublinLocalToIso("2026-01-15T10:30")).toBe("2026-01-15T10:30:00.000Z");
  });
  it("handles summer (IST, UTC+1)", () => {
    expect(dublinLocalToIso("2026-07-15T10:30")).toBe("2026-07-15T09:30:00.000Z");
  });
  it("handles the days of the DST changes", () => {
    expect(dublinLocalToIso("2026-03-29T12:00")).toBe("2026-03-29T11:00:00.000Z");
    expect(dublinLocalToIso("2026-10-25T12:00")).toBe("2026-10-25T12:00:00.000Z");
  });
  it("rejects malformed input", () => {
    for (const bad of ["", "2026-01-15", "2026-01-15 10:30", "2026-13-40T99:99", "<script>"]) expect(dublinLocalToIso(bad)).toBeNull();
  });
});
