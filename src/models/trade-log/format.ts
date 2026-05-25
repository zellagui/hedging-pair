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
  if (!iso || iso.length < 10) return localTodayYmd();
  return iso.slice(0, 10);
}

/** Apply YYYY-MM-DD to an ISO timestamp, preserving time-of-day when possible. */
export function ymdToIsoPreserveTime(ymd: string, existingIso?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) {
    return existingIso && !Number.isNaN(new Date(existingIso).getTime())
      ? existingIso
      : new Date().toISOString();
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (existingIso) {
    const prev = new Date(existingIso);
    if (!Number.isNaN(prev.getTime())) {
      return new Date(
        y,
        m - 1,
        d,
        prev.getHours(),
        prev.getMinutes(),
        prev.getSeconds(),
        prev.getMilliseconds()
      ).toISOString();
    }
  }
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
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
