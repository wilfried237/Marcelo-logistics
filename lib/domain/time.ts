/**
 * Converts a datetime-local value ("2026-03-29T10:30") entered in Irish time
 * (Europe/Dublin, GMT/IST) into an absolute ISO instant. Returns null if invalid.
 */
export function dublinLocalToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const asUtc = new Date(`${value}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  const offsetAt = (instant: Date) =>
    (new Date(instant.toLocaleString("en-US", { timeZone: "Europe/Dublin" })).getTime() - new Date(instant.toLocaleString("en-US", { timeZone: "UTC" })).getTime()) / 60000;
  // Two passes handle instants close to a DST change.
  let guess = new Date(asUtc.getTime() - offsetAt(asUtc) * 60000);
  guess = new Date(asUtc.getTime() - offsetAt(guess) * 60000);
  return guess.toISOString();
}
