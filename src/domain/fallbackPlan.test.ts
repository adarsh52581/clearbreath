import { describe, it, expect } from 'vitest';
import { fallbackPlan } from './fallbackPlan.js';
import { validatePlan } from '../server/ai/grounding.js';
import { HOUSEHOLD_PRESETS } from './data/presets.js';
import { indoorScenarios } from './indoor.js';
import { commuteOptions } from './commute.js';
import { usualWindow, bestWindow } from './windows.js';
import { buildCandidates } from './candidates.js';
import { buildLedger } from './ledger.js';
import { buildFacts } from './facts.js';
import type { AirReport } from '../shared/schemas.js';

describe('fallbackPlan across all six presets', () => {
  const fakeAir: AirReport = {
    location: { label: 'Delhi', lat: 28.6139, lon: 77.209, cityId: 'delhi' },
    measured: {
      source: { name: 'OpenAQ', provider: 'CPCB', url: 'https://openaq.org', kind: 'measured', fetchedAtUtc: '2026-11-23T12:00:00Z' },
      station: { id: 101, name: 'Anand Vihar', distanceKm: 4.5, isMonitor: true },
      latest: {
        pm25: { value: 340, unit: 'µg/m³', atUtc: '2026-11-23T11:00:00Z' },
        pm10: { value: 480, unit: 'µg/m³', atUtc: '2026-11-23T11:00:00Z' },
      },
      series24h: { pm25: [], pm10: [] },
      freshness: 'fresh',
    },
    naqi: {
      value: 390,
      category: 'very_poor',
      dominant: 'pm25',
      basis: '24h',
      subIndices: { pm25: 390, pm10: 360 },
      note: 'Based on PM2.5 and PM10 only',
    },
    forecast: {
      source: { name: 'Google Air Quality API', url: 'https://airquality.googleapis.com', kind: 'forecast', fetchedAtUtc: '2026-11-23T12:00:00Z' },
      points: Array.from({ length: 48 }, (_, i) => ({
        timeUtc: new Date(Date.parse('2026-11-23T12:00:00Z') + i * 3600 * 1000).toISOString(),
        pm25: 150 + ((i * 17) % 200),
        pm10: 250 + ((i * 23) % 200),
      })),
    },
    warnings: [],
    fetchedAtUtc: '2026-11-23T12:00:00Z',
  };

  const languages = ['en', 'hi'] as const;

  for (const preset of HOUSEHOLD_PRESETS) {
    for (const lang of languages) {
      it(`fallbackPlan passes validatePlan for ${preset.id} in ${lang}`, () => {
        const cOut = 340;
        const indoorScenariosList = indoorScenarios(
          {
            roomAreaM2: preset.home.roomAreaM2,
            ceilingHeightM: preset.home.ceilingHeightM,
            windowState: preset.home.windowState,
            purifierCadrM3h: preset.home.purifier.present ? preset.home.purifier.cadrM3h : 0,
            plants: preset.home.plantsCount,
          },
          cOut,
          preset.members.map((m) => ({ id: m.id, activityHours: 1, commuteHours: 1 })),
          0,
        );

        const activityContexts = preset.activities.map((a) => ({
          activity: a,
          usualWindow: usualWindow(fakeAir.forecast?.points, a.durationMin, a.usualStartHour, '2026-11-23T12:00:00Z'),
          bestWindow: a.flexible ? bestWindow(fakeAir.forecast?.points, a.durationMin, a.flexible, '2026-11-23T12:00:00Z') : null,
          usualDose: 100,
          bestDose: 60,
          indoorDose: 40,
        }));

        const commuteContexts = preset.commutes.map((c) => ({
          commute: c,
          commuteId: c.id,
          options: commuteOptions(c, preset.members, cOut),
        }));

        const candidates = buildCandidates({
          profile: preset,
          air: fakeAir,
          activityContexts,
          commuteContexts,
          indoorScenarios: indoorScenariosList,
        });

        const ledger = buildLedger({
          profile: preset,
          activities: activityContexts.map((ac) => ({
            activityId: ac.activity.id,
            memberIds: ac.activity.memberIds,
            usualDoseByMember: { m1: 50 },
            planDoseByMember: { m1: 30 },
            durationHours: ac.activity.durationMin / 60,
          })),
          commutes: commuteContexts.map((cc) => ({
            commuteId: cc.commuteId,
            memberIds: cc.commute.memberIds,
            currentMode: cc.commute.currentMode,
            options: cc.options,
            durationHours: 1,
          })),
          indoorScenarios: indoorScenariosList,
        });

        const facts = buildFacts({
          profile: preset,
          air: fakeAir,
          activityContexts,
          commuteContexts,
          indoorScenarios: indoorScenariosList,
          ledger,
          language: lang,
        });

        const plan = fallbackPlan({ facts, candidates, language: lang });
        const rawJson = JSON.stringify(plan);

        const result = validatePlan(rawJson, facts, candidates);
        expect(
          result.ok,
          `Validation failed for ${preset.id} (${lang}): ${!result.ok ? result.errors.join('; ') : ''}`,
        ).toBe(true);
      });
    }
  }
});
