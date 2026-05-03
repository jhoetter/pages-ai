/** Locale-aware fuzzy relative timestamps (Intl.RelativeTimeFormat). */
export function formatRelativeTime(
  isoOrDate: string | Date,
  locale: string,
): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(locale.includes("de") ? "de" : "en", {
    numeric: "auto",
  });

  let unit: Intl.RelativeTimeFormatUnit = "second";
  let divisor = 1000;
  const absMs = Math.abs(diffMs);

  if (absMs >= 86400000 * 260) {
    return new Intl.DateTimeFormat(locale.includes("de") ? "de" : "en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  }
  if (absMs >= 86400000) {
    unit = "day";
    divisor = 86400000;
  } else if (absMs >= 3600000) {
    unit = "hour";
    divisor = 3600000;
  } else if (absMs >= 60000) {
    unit = "minute";
    divisor = 60000;
  }

  const n = Math.round(diffMs / divisor);
  return rtf.format(n, unit);
}
