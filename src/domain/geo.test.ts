import { describe, it, expect } from 'vitest';
import { haversineKm } from './geo.js';

describe('haversineKm', () => {
  it('calculates distance between Delhi and Noida (~20 km, asserts 18-22)', () => {
    const delhi = { lat: 28.6139, lon: 77.209 };
    const noida = { lat: 28.5355, lon: 77.391 };

    const distance = haversineKm(delhi, noida);
    expect(distance).toBeGreaterThanOrEqual(18);
    expect(distance).toBeLessThanOrEqual(22);
  });

  it('returns 0 for identical coordinates', () => {
    const point = { lat: 28.6139, lon: 77.209 };
    expect(haversineKm(point, point)).toBe(0);
  });

  it('handles antipodal or distant locations correctly', () => {
    const delhi = { lat: 28.6139, lon: 77.209 };
    const mumbai = { lat: 19.076, lon: 72.8777 };

    const distance = haversineKm(delhi, mumbai);
    // Delhi to Mumbai is roughly 1150-1170 km
    expect(distance).toBeGreaterThan(1100);
    expect(distance).toBeLessThan(1250);
  });

  it('throws RangeError on non-finite or out-of-range coordinates', () => {
    expect(() => haversineKm({ lat: Number.NaN, lon: 77 }, { lat: 28, lon: 77 })).toThrow(
      RangeError,
    );
    expect(() => haversineKm({ lat: 28, lon: 77 }, { lat: 95, lon: 77 })).toThrow(RangeError);
    expect(() => haversineKm({ lat: 28, lon: 77 }, { lat: 28, lon: 185 })).toThrow(RangeError);
    expect(() => haversineKm({ lat: -95, lon: 77 }, { lat: 28, lon: 77 })).toThrow(RangeError);
  });
});
