import { describe, expect, it } from "vitest";
import {
  QUOTE_REFERENCE_PATTERN,
  SHIPMENT_REFERENCE_PATTERN,
  generateQuoteReference,
  generateShipmentReference,
  normaliseReference,
} from "@/lib/domain/references";
import { QUOTE_TRANSITIONS, actorMayTransition, canTransition, isTerminal } from "@/lib/domain/quote-lifecycle";
import { QUOTE_STATUSES } from "@/lib/domain/enums";

describe("references", () => {
  it("match the documented formats", () => {
    for (let i = 0; i < 500; i++) {
      expect(generateQuoteReference()).toMatch(QUOTE_REFERENCE_PATTERN);
      expect(generateShipmentReference()).toMatch(SHIPMENT_REFERENCE_PATTERN);
    }
  });

  it("are not sequential or repeated in practice", () => {
    const refs = new Set(Array.from({ length: 5000 }, generateShipmentReference));
    expect(refs.size).toBe(5000);
    const quoteRefs = Array.from({ length: 50 }, generateQuoteReference);
    expect(new Set(quoteRefs).size).toBeGreaterThan(45);
  });

  it("use every base32 symbol (no modulo bias toward a subset)", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) for (const ch of generateShipmentReference().slice(2)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    expect(counts.size).toBe(32);
  });

  it("normalise user input", () => {
    expect(normaliseReference("  ml-abcd efgh 23 ")).toBe("MLABCDEFGH23");
  });
});

describe("quote lifecycle", () => {
  it("covers every status", () => {
    expect(Object.keys(QUOTE_TRANSITIONS).sort()).toEqual([...QUOTE_STATUSES].sort());
  });

  it("allows the documented happy path", () => {
    const path = ["SUBMITTED", "UNDER_REVIEW", "AWAITING_CUSTOMER", "UNDER_REVIEW", "QUOTED", "ACCEPTED"] as const;
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1], path[i])).toBe(true);
  });

  it("allows cancellation from every non-cancelled status", () => {
    for (const s of QUOTE_STATUSES) expect(canTransition(s, "CANCELLED")).toBe(s !== "CANCELLED");
  });

  it("rejects skipping review and going backwards", () => {
    expect(canTransition("SUBMITTED", "QUOTED")).toBe(false);
    expect(canTransition("QUOTED", "UNDER_REVIEW")).toBe(false);
    expect(canTransition("ACCEPTED", "QUOTED")).toBe(false);
  });

  it("restricts who may perform each transition", () => {
    expect(actorMayTransition("customer", "QUOTED", "ACCEPTED")).toBe(true);
    expect(actorMayTransition("staff", "QUOTED", "ACCEPTED")).toBe(false);
    expect(actorMayTransition("customer", "SUBMITTED", "UNDER_REVIEW")).toBe(false);
    expect(actorMayTransition("staff", "SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(actorMayTransition("staff", "QUOTED", "EXPIRED")).toBe(false);
    expect(actorMayTransition("system", "QUOTED", "EXPIRED")).toBe(true);
    expect(actorMayTransition("customer", "SUBMITTED", "CANCELLED")).toBe(false);
  });

  it("identifies terminal statuses", () => {
    expect(isTerminal("ACCEPTED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("QUOTED")).toBe(false);
  });
});
