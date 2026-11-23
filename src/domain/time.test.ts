import { describe, it, expect } from 'vitest';
import { toIst, rangeLabelIst, addHours } from './time.js';

describe('time - IST conversions and range labelling', () => {
  it('converts 2026-11-23T10:00:00Z to 15:30 IST on the same day', () => {
    const ist = toIst('2026-11-23T10:00:00Z');
    expect(ist.dateIst).toBe('2026-11-23');
    expect(ist.hourFraction).toBe(15.5);
    expect(ist.hhmm).toBe('15:30');
  });

  it('converts 2026-11-23T18:30:00Z to next IST day 00:00', () => {
    const ist = toIst('2026-11-23T18:30:00Z');
    expect(ist.dateIst).toBe('2026-11-24');
    expect(ist.hourFraction).toBe(0);
    expect(ist.hhmm).toBe('00:00');
  });

  it('converts 2026-11-23T18:00:00Z to 23:30 IST', () => {
    const ist = toIst('2026-11-23T18:00:00Z');
    expect(ist.dateIst).toBe('2026-11-23');
    expect(ist.hourFraction).toBe(23.5);
    expect(ist.hhmm).toBe('23:30');
  });

  it('throws RangeError for invalid ISO timestamp in toIst', () => {
    expect(() => toIst('not-a-timestamp')).toThrow(RangeError);
    expect(() => toIst('')).toThrow(RangeError);
  });

  it('creates an IST range label with en-dash separator', () => {
    const label = rangeLabelIst('2026-11-23T10:00:00Z', '2026-11-23T11:00:00Z');
    expect(label).toBe('15:30–16:30 IST');
  });

  it('handles multi-hour range across midnight in rangeLabelIst', () => {
    const label = rangeLabelIst('2026-11-23T17:30:00Z', '2026-11-23T19:30:00Z');
    expect(label).toBe('23:00–01:00 IST');
  });

  it('adds hours accurately', () => {
    const start = '2026-11-23T10:00:00.000Z';
    expect(addHours(start, 2)).toBe('2026-11-23T12:00:00.000Z');
    expect(addHours(start, 14)).toBe('2026-11-24T00:00:00.000Z');
    expect(addHours(start, 0)).toBe('2026-11-23T10:00:00.000Z');
  });

  it('throws RangeError in addHours for invalid timestamp or non-finite hours', () => {
    expect(() => addHours('invalid', 2)).toThrow(RangeError);
    expect(() => addHours('2026-11-23T10:00:00.000Z', NaN)).toThrow(RangeError);
    expect(() => addHours('2026-11-23T10:00:00.000Z', Infinity)).toThrow(RangeError);
  });
});
