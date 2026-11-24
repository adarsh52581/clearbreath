import { describe, it, expect } from 'vitest';
import { buildLedger } from './ledger.js';
import { HOUSEHOLD_PRESETS } from './data/presets.js';
import { indoorScenarios } from './indoor.js';

describe('domain/ledger - buildLedger', () => {
  it('plan <= usual for delhi-asthma-child preset with fixed fake forecast', () => {
    const delhiPreset = HOUSEHOLD_PRESETS[0]!; // non-null: HOUSEHOLD_PRESETS contains 6 predefined presets
    const cOut = 300;

    const scenarios = indoorScenarios(
      {
        roomAreaM2: delhiPreset.home.roomAreaM2,
        ceilingHeightM: delhiPreset.home.ceilingHeightM,
        windowState: delhiPreset.home.windowState, // partly_open
        purifierCadrM3h: 0,
        plants: 0,
      },
      cOut,
      delhiPreset.members.map((m) => ({ id: m.id, activityHours: 1, commuteHours: 1 })),
      0,
    );

    // Activity doses: plan is lower than usual
    const activities = [
      {
        activityId: 'a1',
        memberIds: ['m2'],
        usualDoseByMember: { m2: 250 },
        planDoseByMember: { m2: 150 },
        durationHours: 1,
      },
      {
        activityId: 'a2',
        memberIds: ['m2'],
        usualDoseByMember: { m2: 50 },
        planDoseByMember: { m2: 50 },
        durationHours: 0.33,
      },
    ];

    // Commute: metro saves exposure and CO2 vs car
    const commutes = [
      {
        commuteId: 'c1',
        memberIds: ['m1'],
        currentMode: 'car',
        options: [
          {
            mode: 'car' as const,
            minutes: 40,
            dosePerTravellerUg: 100,
            doseUg: 100,
            weeklyCo2Kg: 25,
            co2SavedKg: 0,
            vehicleKmAvoidedWeek: 0,
            recommended: false,
          },
          {
            mode: 'metro' as const,
            minutes: 45,
            dosePerTravellerUg: 60,
            doseUg: 60,
            weeklyCo2Kg: 5,
            co2SavedKg: 20,
            vehicleKmAvoidedWeek: 140,
            recommended: true,
          },
        ],
        durationHours: 0.67,
      },
    ];

    const ledger = buildLedger({
      profile: delhiPreset,
      activities,
      commutes,
      indoorScenarios: scenarios,
    });

    expect(ledger.members).toHaveLength(2);

    for (const mem of ledger.members) {
      expect(mem.planDoseUg).toBeLessThanOrEqual(mem.usualDoseUg);
      if (mem.doseChangePct !== null) {
        expect(mem.doseChangePct).toBeLessThanOrEqual(0);
      }
    }

    expect(ledger.householdCo2SavedWeekKg).toBe(20);
  });

  it('members with no activities still get non-zero indoor doses', () => {
    const minimalPreset = HOUSEHOLD_PRESETS[4]!; // non-null: HOUSEHOLD_PRESETS has 6 presets
    const scenarios = indoorScenarios(
      {
        roomAreaM2: 20,
        ceilingHeightM: 2.8,
        windowState: 'closed',
        purifierCadrM3h: 0,
        plants: 0,
      },
      250,
      [{ id: 'm1', activityHours: 0, commuteHours: 0 }],
      0,
    );

    const ledger = buildLedger({
      profile: minimalPreset,
      activities: [],
      commutes: [],
      indoorScenarios: scenarios,
    });

    expect(ledger.members).toHaveLength(1);
    expect(ledger.members[0]!.usualDoseUg).toBeGreaterThan(0); // non-null: verified length 1
    expect(ledger.members[0]!.planDoseUg).toBeGreaterThan(0); // non-null: verified length 1
  });
});
