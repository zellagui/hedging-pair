export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay: "exceptZero",
  }).format(value);
}

export function formatUsdUnsigned(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 0) {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatDisplayDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}
