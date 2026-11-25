import { describe, it, expect } from 'vitest';
import { validatePlan, validateIndoorExplanation } from './grounding.js';
import type { Candidates, Fact } from '../../shared/schemas.js';
import type { AiPlan } from '../../shared/aiSchemas.js';

function parsePlan(json: string): AiPlan {
  return JSON.parse(json) as AiPlan;
}

describe('grounding validator - validatePlan', () => {
  const dummyFacts: Fact[] = [
    {
      id: 'air_category_now',
      label: 'Current AQI category',
      value: 'very_poor',
      display: 'Very Poor',
      kind: 'computed',
      provenance: 'CPCB',
    },
    {
      id: 'act_park_best_window',
      label: 'Activity cleanest window',
      value: '15:00–16:00 IST',
      display: '15:00–16:00 IST',
      kind: 'forecast',
      provenance: 'Clean window finder',
    },
    {
      id: 'act_park_dose_change',
      label: 'Activity exposure reduction',
      value: -35,
      display: '35% lower',
      kind: 'computed',
      provenance: 'Dose model',
    },
    {
      id: 'in_close_windows_change',
      label: 'Indoor change',
      value: -40,
      display: '40% lower',
      kind: 'computed',
      provenance: 'Mass balance',
    },
    {
      id: 'tip_clean_room',
      label: 'Clean room tip',
      value: 'Keep one clean room with air purifier',
      display: 'Keep one clean room with air purifier',
      kind: 'guidance',
      provenance: 'Guidance',
    },
  ];

  const dummyCandidates: Candidates = {
    activities: [
      {
        itemId: 'park',
        label: 'Evening park play',
        memberIds: ['m1'],
        options: [
          { optionId: 'park_usual', label: 'Usual time', recommended: false, factIds: [] },
          { optionId: 'park_best', label: 'Cleanest window', recommended: true, factIds: ['act_park_best_window'] },
        ],
      },
    ],
    commutes: [
      {
        itemId: 'work',
        label: 'Office commute',
        memberIds: ['m1'],
        options: [
          { optionId: 'work_car', label: 'Car', recommended: false, factIds: [] },
          { optionId: 'work_metro', label: 'Metro', recommended: true, factIds: [] },
        ],
      },
    ],
    indoor: [
      { actionId: 'close_windows', label: 'Close windows', cost: 'free', factIds: ['in_close_windows_change'] },
    ],
    community: [
      { actionId: 'shared_clean_room', label: 'Clean room', factIds: ['tip_clean_room'] },
    ],
  };

  const validPlanJson = JSON.stringify({
    summary: 'Air quality is {{air_category_now}} today with high PM2.5 and PM10 levels.',
    routine: [
      {
        itemId: 'park',
        chosenOptionId: 'park_best',
        headline: 'Move park play to {{act_park_best_window}}',
        why: 'Inhaled dose is {{act_park_dose_change}} with N95 mask guidance.',
        tradeoff: null,
        priority: 'high',
      },
      {
        itemId: 'work',
        chosenOptionId: 'work_metro',
        headline: 'Switch commute to metro transit',
        why: 'Reduces individual exposure and saves CO2 emissions.',
        tradeoff: null,
        priority: 'medium',
      },
    ],
    indoor: [
      {
        actionId: 'close_windows',
        headline: 'Keep windows closed',
        why: 'Expected reduction is {{in_close_windows_change}}.',
        priority: 'high',
      },
    ],
    community: [
      {
        actionId: 'shared_clean_room',
        headline: 'Establish clean room',
        why: '{{tip_clean_room}}',
      },
    ],
    caveats: ['Estimates use live outdoor data and published rates.'],
  });

  it('accepts fully valid grounded plan with allowed tokens PM2.5, PM10, N95, CO2', () => {
    const result = validatePlan(validPlanJson, dummyFacts, dummyCandidates);
    expect(result.ok).toBe(true);
  });

  it('rejects invalid JSON with INVALID_JSON error', () => {
    const result = validatePlan('not a json string', dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('INVALID_JSON');
    }
  });

  it('rejects schema mismatch with SCHEMA error', () => {
    const invalidSchema = JSON.stringify({ summary: 123 });
    const result = validatePlan(invalidSchema, dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('SCHEMA');
    }
  });

  it('rejects unknown fact id with UNKNOWN_FACT error', () => {
    const plan = parsePlan(validPlanJson);
    plan.summary = 'Air is {{unknown_fact_id}}';
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('UNKNOWN_FACT'))).toBe(true);
    }
  });

  it('rejects unknown candidate itemId with UNKNOWN_ID error', () => {
    const plan = parsePlan(validPlanJson);
    const firstRoutine = plan.routine[0];
    if (firstRoutine) {
      firstRoutine.itemId = 'unknown_item';
    }
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('UNKNOWN_ID'))).toBe(true);
    }
  });

  it('rejects chosenOptionId belonging to another item with UNKNOWN_ID error', () => {
    const plan = parsePlan(validPlanJson);
    const firstRoutine = plan.routine[0];
    if (firstRoutine) {
      firstRoutine.chosenOptionId = 'work_metro'; // park item, but work option!
    }
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('UNKNOWN_ID'))).toBe(true);
    }
  });

  it('rejects duplicate routine item with DUPLICATE_ITEM error', () => {
    const plan = parsePlan(validPlanJson);
    const firstRoutine = plan.routine[0];
    if (firstRoutine) {
      plan.routine.push({ ...firstRoutine });
    }
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('DUPLICATE_ITEM'))).toBe(true);
    }
  });

  it('rejects raw ASCII digits outside placeholders with RAW_NUMBER error', () => {
    const plan = parsePlan(validPlanJson);
    plan.summary = 'PM2.5 concentration is 45 today.';
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('RAW_NUMBER') && e.includes('digits'))).toBe(true);
    }
  });

  it('rejects Devanagari digits outside placeholders with RAW_NUMBER error', () => {
    const plan = parsePlan(validPlanJson);
    plan.summary = 'प्रदूषण स्तर २५ बढ़ गया है।';
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('RAW_NUMBER') && e.includes('digits'))).toBe(true);
    }
  });

  it('rejects English number words with RAW_NUMBER error', () => {
    const plan = parsePlan(validPlanJson);
    plan.summary = 'Exposure will be reduced by twenty percent.';
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('RAW_NUMBER') && e.includes('number word'))).toBe(true);
    }
  });

  it('allows everyday "one" and the word two-wheeler, but still rejects other number words', () => {
    const plan = parsePlan(validPlanJson);
    plan.summary = 'Keep one room clean; skip the two-wheeler today. Air is {{air_category_now}}.';
    expect(validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates).ok).toBe(true);

    plan.summary = 'Play outside for two hours less.';
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes('number word "two"'))).toBe(true);
  });

  it('accepts placeholders written with spaces or capitals and returns them normalised', () => {
    const plan = parsePlan(validPlanJson);
    plan.summary = 'Air is {{ AIR_CATEGORY_NOW }} today.';
    const result = validatePlan(JSON.stringify(plan), dummyFacts, dummyCandidates);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.plan.summary).toBe('Air is {{air_category_now}} today.');
  });
});

describe('grounding validator - validateIndoorExplanation', () => {
  const dummyFacts: Fact[] = [
    { id: 'in_close_windows_change', label: 'Indoor change', value: -40, display: '40% lower', kind: 'computed', provenance: 'Mass balance' },
  ];
  const dummyCandidates: Candidates = {
    activities: [],
    commutes: [],
    indoor: [{ actionId: 'close_windows', label: 'Close windows', cost: 'free', factIds: ['in_close_windows_change'] }],
    community: [],
  };

  it('validates a correct indoor explanation', () => {
    const json = JSON.stringify({
      summary: 'Closing windows reduces indoor infiltration significantly.',
      actions: [{ actionId: 'close_windows', headline: 'Close windows', why: 'Reduces intake by {{in_close_windows_change}}.', priority: 'high' }],
      caveats: ['Room air exchange should be maintained.'],
    });
    const result = validateIndoorExplanation(json, dummyFacts, dummyCandidates);
    expect(result.ok).toBe(true);
  });
});
