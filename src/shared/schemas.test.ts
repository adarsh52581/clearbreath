import { describe, it, expect } from 'vitest';
import {
  idSchema,
  memberSchema,
  activitySchema,
  commuteSchema,
  purifierSchema,
  homeSchema,
  householdProfileSchema,
  hourlyValueSchema,
  forecastPointSchema,
  naqiResultSchema,
  type HouseholdProfile,
} from './schemas.js';

describe('schemas - HouseholdProfile and component schemas', () => {
  const validProfile: HouseholdProfile = {
    id: 'hh_delhi_1',
    title: 'Sharma Family in Delhi',
    description: '4-member family near Anand Vihar',
    cityId: 'delhi',
    members: [
      { id: 'm1', label: 'Aditi', ageGroup: 'adult', sensitivities: ['asthma'] },
      { id: 'm2', label: 'Rohan', ageGroup: 'adult', sensitivities: [] },
      { id: 'm3', label: 'Aarav', ageGroup: 'child', sensitivities: [] },
    ],
    activities: [
      {
        id: 'a1',
        label: 'Evening park play',
        memberIds: ['m3'],
        kind: 'outdoor_play',
        intensity: 'high',
        durationMin: 60,
        usualStartHour: 17,
        flexible: { earliestHour: 16, latestHour: 19 },
      },
    ],
    commutes: [
      {
        id: 'c1',
        label: 'Office commute',
        memberIds: ['m1'],
        distanceKm: 12,
        currentMode: 'car',
        allowedModes: ['car', 'metro', 'bus'],
        usualStartHour: 8,
        daysPerWeek: 5,
      },
    ],
    home: {
      roomAreaM2: 25,
      ceilingHeightM: 2.8,
      windowState: 'closed',
      purifier: { present: true, cadrM3h: 300 },
      cookingFuel: 'png',
      kitchenExhaust: true,
      incense: false,
      mosquitoCoil: false,
      smokingIndoors: false,
      hoursIndoorsPerDay: 16,
      plantsCount: 4,
    },
    constraints: {
      budget: 'medium',
      rented: false,
      mobilityLimited: false,
    },
    notes: 'Ground floor apartment near main road',
  };

  it('accepts a fully valid household profile', () => {
    const parsed = householdProfileSchema.parse(validProfile);
    expect(parsed.id).toBe('hh_delhi_1');
    expect(parsed.members).toHaveLength(3);
  });

  describe('idSchema limits', () => {
    it.each([
      ['valid_id_1', true],
      ['m1', true],
      ['', false],
      ['Invalid-Upper', false],
      ['id_with_space ', false],
      ['this_id_is_way_too_long_for_schema', false],
    ])('id %s validity -> %s', (id, shouldPass) => {
      const result = idSchema.safeParse(id);
      expect(result.success).toBe(shouldPass);
    });
  });

  describe('Member validation', () => {
    it('rejects member with duplicate sensitivities', () => {
      const result = memberSchema.safeParse({
        id: 'm1',
        label: 'Aditi',
        ageGroup: 'adult',
        sensitivities: ['asthma', 'asthma'],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['sensitivities']);
      }
    });

    it('rejects member with label exceeding 24 chars', () => {
      const result = memberSchema.safeParse({
        id: 'm1',
        label: 'A'.repeat(25),
        ageGroup: 'adult',
        sensitivities: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['label']);
      }
    });
  });

  describe('Activity validation and cross-field rules', () => {
    it('fails when latestHour <= earliestHour', () => {
      const result = activitySchema.safeParse({
        id: 'a1',
        label: 'Play',
        memberIds: ['m1'],
        kind: 'outdoor_play',
        intensity: 'high',
        durationMin: 60,
        usualStartHour: 17,
        flexible: { earliestHour: 18, latestHour: 18 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['flexible', 'latestHour']);
      }
    });

    it('fails when durationMin exceeds flexible range window', () => {
      const result = activitySchema.safeParse({
        id: 'a1',
        label: 'Play',
        memberIds: ['m1'],
        kind: 'outdoor_play',
        intensity: 'high',
        durationMin: 150, // 2.5 hours, but window is 16:00 to 18:00 (2 hours)
        usualStartHour: 17,
        flexible: { earliestHour: 16, latestHour: 18 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['durationMin']);
      }
    });

    it('rejects durationMin below 10 or above 240', () => {
      expect(
        activitySchema.safeParse({
          ...validProfile.activities[0],
          durationMin: 5,
        }).success,
      ).toBe(false);
      expect(
        activitySchema.safeParse({
          ...validProfile.activities[0],
          durationMin: 300,
        }).success,
      ).toBe(false);
    });
  });

  describe('Commute validation', () => {
    it('rejects duplicate allowedModes', () => {
      const result = commuteSchema.safeParse({
        id: 'c1',
        label: 'Commute',
        memberIds: ['m1'],
        distanceKm: 10,
        currentMode: 'car',
        allowedModes: ['car', 'car'],
        usualStartHour: 9,
        daysPerWeek: 5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['allowedModes']);
      }
    });

    it('rejects distance outside 0.5–60 km', () => {
      expect(
        commuteSchema.safeParse({ ...validProfile.commutes[0], distanceKm: 0.2 }).success,
      ).toBe(false);
      expect(
        commuteSchema.safeParse({ ...validProfile.commutes[0], distanceKm: 70 }).success,
      ).toBe(false);
    });

    it('rejects daysPerWeek outside 1–7', () => {
      expect(
        commuteSchema.safeParse({ ...validProfile.commutes[0], daysPerWeek: 0 }).success,
      ).toBe(false);
      expect(
        commuteSchema.safeParse({ ...validProfile.commutes[0], daysPerWeek: 8 }).success,
      ).toBe(false);
    });
  });

  describe('Home and Purifier cross-field rule', () => {
    it('fails when purifier is absent but cadrM3h > 0', () => {
      const result = purifierSchema.safeParse({
        present: false,
        cadrM3h: 250,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['cadrM3h']);
      }
    });

    it('passes when purifier is absent and cadrM3h is 0', () => {
      expect(purifierSchema.safeParse({ present: false, cadrM3h: 0 }).success).toBe(true);
    });

    it('rejects home limits: roomAreaM2, ceilingHeightM, plantsCount', () => {
      expect(homeSchema.safeParse({ ...validProfile.home, roomAreaM2: 4 }).success).toBe(false);
      expect(homeSchema.safeParse({ ...validProfile.home, ceilingHeightM: 1.8 }).success).toBe(
        false,
      );
      expect(homeSchema.safeParse({ ...validProfile.home, plantsCount: 25 }).success).toBe(false);
    });
  });

  describe('HouseholdProfile cross-field rules', () => {
    it('fails when member ids are duplicated', () => {
      const profile = {
        ...validProfile,
        members: [
          { id: 'm1', label: 'Aditi', ageGroup: 'adult', sensitivities: [] },
          { id: 'm1', label: 'Rohan', ageGroup: 'adult', sensitivities: [] },
        ],
      };
      const result = householdProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['members', 1, 'id']);
      }
    });

    it('fails when activity ids are duplicated', () => {
      const profile = {
        ...validProfile,
        activities: [
          validProfile.activities[0],
          { ...validProfile.activities[0], id: 'a1' },
        ],
      };
      const result = householdProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['activities', 1, 'id']);
      }
    });

    it('fails when an activity references a non-existent memberId', () => {
      const profile = {
        ...validProfile,
        activities: [
          {
            ...validProfile.activities[0],
            memberIds: ['m99'],
          },
        ],
      };
      const result = householdProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['activities', 0, 'memberIds', 0]);
      }
    });

    it('fails when commute ids are duplicated', () => {
      const profile = {
        ...validProfile,
        commutes: [
          validProfile.commutes[0],
          { ...validProfile.commutes[0], id: 'c1' },
        ],
      };
      const result = householdProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['commutes', 1, 'id']);
      }
    });

    it('fails when a commute references a non-existent memberId', () => {
      const profile = {
        ...validProfile,
        commutes: [
          {
            ...validProfile.commutes[0],
            memberIds: ['m404'],
          },
        ],
      };
      const result = householdProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.path).toEqual(['commutes', 0, 'memberIds', 0]);
      }
    });
  });

  describe('Section 5.2 Schemas', () => {
    it('validates HourlyValue and ForecastPoint', () => {
      expect(
        hourlyValueSchema.safeParse({ timeUtc: '2026-11-23T10:00:00Z', value: 45.5 }).success,
      ).toBe(true);
      expect(
        forecastPointSchema.safeParse({
          timeUtc: '2026-11-23T10:00:00Z',
          pm25: 40,
          pm10: null,
        }).success,
      ).toBe(true);
    });

    it('validates NaqiResult', () => {
      const naqi = {
        value: 150,
        category: 'moderate',
        dominant: 'pm25',
        basis: '24h',
        subIndices: { pm25: 150, pm10: 90 },
        note: 'Indicative',
      };
      expect(naqiResultSchema.safeParse(naqi).success).toBe(true);
    });
  });
});
