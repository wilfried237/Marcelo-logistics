import { randomInt } from "node:crypto";

/** RFC 4648 base32 alphabet: no 0/1/8/9, so no confusion with O/I/B/g. */
export const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const QUOTE_REFERENCE_PATTERN = /^QR[A-Z2-7]{6}$/;
export const SHIPMENT_REFERENCE_PATTERN = /^ML[A-Z2-7]{10}$/;
export const CONTACT_REFERENCE_PATTERN = /^CE[A-Z2-7]{6}$/;

function randomBase32(length: number): string {
  let out = "";
  // crypto.randomInt draws from a CSPRNG without modulo bias.
  for (let i = 0; i < length; i++) out += BASE32_ALPHABET[randomInt(32)];
  return out;
}

/** "QR" + 6 random base32 characters (about 1.07e9 values). Uniqueness is enforced by the database. */
export function generateQuoteReference(): string {
  return `QR${randomBase32(6)}`;
}

/**
 * "ML" + 10 random base32 characters (about 1.1e15 values). Shipment references are
 * used for public tracking, so they get more entropy than quote references.
 * Knowing a reference never grants access to private data.
 */
export function generateShipmentReference(): string {
  return `ML${randomBase32(10)}`;
}

/** "CE" + 6 random base32 characters for contact enquiries. */
export function generateContactReference(): string {
  return `CE${randomBase32(6)}`;
}

/** Normalise user input: trim, uppercase, drop spaces and dashes. */
export function normaliseReference(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, "");
}

export const MAX_REFERENCE_ATTEMPTS = 5;
