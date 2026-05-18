export function formatMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "exceptZero",
  }).format(value);
}

/** YYYY-MM-DD from ISO createdAt */
export function dateFromCreatedAt(iso: string): string {
  return iso.slice(0, 10);
}

/** Local calendar date YYYY-MM-DD (browser timezone). */
export function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Short display for pair row, e.g. "May 15". */
export function formatShortMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
