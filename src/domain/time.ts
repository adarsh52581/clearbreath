/**
 * IST time utilities.
 * Indian Standard Time (IST) is fixed at UTC+05:30 with no daylight saving time.
 * DOMAIN_MODEL §0, §3.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export interface IstTime {
  readonly dateIst: string; // 'YYYY-MM-DD'
  readonly hourFraction: number; // e.g. 15.5 for 15:30
  readonly hhmm: string; // 'HH:MM'
}

/**
 * Converts a UTC ISO timestamp to IST components.
 * Throws RangeError if utcIso is not a valid ISO timestamp.
 */
export function toIst(utcIso: string): IstTime {
  const utcMs = Date.parse(utcIso);
  if (Number.isNaN(utcMs)) {
    throw new RangeError(`Invalid UTC ISO timestamp: ${utcIso}`);
  }

  const istDate = new Date(utcMs + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();

  return {
    dateIst: `${year}-${month}-${day}`,
    hourFraction: hours + minutes / 60,
    hhmm: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

/**
 * Formats a UTC start/end range into an IST range label: "HH:MM–HH:MM IST".
 * Uses the en-dash (–) separator.
 */
export function rangeLabelIst(startUtc: string, endUtc: string): string {
  const start = toIst(startUtc);
  const end = toIst(endUtc);
  return `${start.hhmm}–${end.hhmm} IST`;
}

/**
 * Adds n hours to a UTC ISO timestamp and returns the resulting UTC ISO string.
 * Throws RangeError if utcIso is invalid or n is not finite.
 */
export function addHours(utcIso: string, n: number): string {
  const utcMs = Date.parse(utcIso);
  if (Number.isNaN(utcMs) || !Number.isFinite(n)) {
    throw new RangeError(`Invalid timestamp or hours: ${utcIso}, ${n}`);
  }
  return new Date(utcMs + n * 3600 * 1000).toISOString();
}
