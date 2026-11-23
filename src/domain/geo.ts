function validateCoord(pt: { lat: number; lon: number }): void {
  if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lon)) {
    throw new RangeError('Coordinates must be finite numbers');
  }
  if (pt.lat < -90 || pt.lat > 90 || pt.lon < -180 || pt.lon > 180) {
    throw new RangeError('Coordinates out of range [-90..90, -180..180]');
  }
}

/**
 * Calculates the great-circle distance between two points in kilometres
 * using the Haversine formula (Earth radius R = 6371 km).
 */
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  validateCoord(a);
  validateCoord(b);
  if (a.lat === b.lat && a.lon === b.lon) {
    return 0;
  }

  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;

  const sinHalfDLat = Math.sin(dLat / 2);
  const sinHalfDLon = Math.sin(dLon / 2);

  const h = sinHalfDLat * sinHalfDLat + Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon * sinHalfDLon;

  const clampedH = Math.min(1, Math.max(0, h));
  const c = 2 * Math.atan2(Math.sqrt(clampedH), Math.sqrt(1 - clampedH));
  return 6371 * c;
}
