export function formatPrice(value: number, currency = "CNY") {
  const digits = value < 10 ? 3 : 2;
  try {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

export function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatSigned(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}
