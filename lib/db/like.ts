/**
 * Escapes LIKE wildcards for Prisma `contains` / `startsWith` filters, which
 * pass the value to PostgreSQL `LIKE` unescaped. With this, a staff search for
 * "%" or "_" matches those characters literally instead of every row.
 * PostgreSQL's default LIKE escape character is the backslash.
 */
export function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
