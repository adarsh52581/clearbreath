import { describe, it, expect } from 'vitest';
import { buildFacts } from './facts.js';
import { buildCandidates } from './candidates.js';
import { HOUSEHOLD_PRESETS } from './data/presets.js';
import type { AirReport } from '../shared/schemas.js';
import { indoorScenarios } from './indoor.js';
import { commuteOptions } from './commute.js';
import { usualWindow, bestWindow } from './windows.js';
import { buildLedger } from './ledger.js';

describe('facts and candidates domain logic', () => {
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

  const delhiPreset = HOUSEHOLD_PRESETS[0]!; // non-null: HOUSEHOLD_PRESETS contains 6 predefined presets

  it('fact ids match DOMAIN_MODEL §7 pattern (^[a-z0-9_]{3,80}$)', () => {
    const cOut = 340;
    const indoorScenariosList = indoorScenarios(
      {
        roomAreaM2: delhiPreset.home.roomAreaM2,
        ceilingHeightM: delhiPreset.home.ceilingHeightM,
        windowState: delhiPreset.home.windowState,
        purifierCadrM3h: delhiPreset.home.purifier.present ? delhiPreset.home.purifier.cadrM3h : 0,
        plants: delhiPreset.home.plantsCount,
      },
      cOut,
      delhiPreset.members.map((m) => ({ id: m.id, activityHours: 1, commuteHours: 1 })),
      0,
    );

    const activityContexts = delhiPreset.activities.map((a) => {
      const usual = usualWindow(fakeAir.forecast?.points, a.durationMin, a.usualStartHour, '2026-11-23T12:00:00Z');
      const best = a.flexible ? bestWindow(fakeAir.forecast?.points, a.durationMin, a.flexible, '2026-11-23T12:00:00Z') : null;
      return {
        activity: a,
        usualWindow: usual,
        bestWindow: best,
        usualDose: 50,
        bestDose: 30,
        indoorDose: 20,
      };
    });

    const commuteContexts = delhiPreset.commutes.map((c) => ({
      commuteId: c.id,
      options: commuteOptions(c, delhiPreset.members, cOut),
    }));

    const ledger = buildLedger({
      profile: delhiPreset,
      activities: activityContexts.map((ac) => ({
        activityId: ac.activity.id,
        memberIds: ac.activity.memberIds,
        usualDoseByMember: { m1: 20, m2: 30 },
        planDoseByMember: { m1: 15, m2: 20 },
        durationHours: ac.activity.durationMin / 60,
      })),
      commutes: commuteContexts.map((cc) => ({
        commuteId: cc.commuteId,
        memberIds: delhiPreset.commutes[0]!.memberIds, // non-null: delhiPreset has 1 commute
        currentMode: 'car',
        options: cc.options,
        durationHours: 1,
      })),
      indoorScenarios: indoorScenariosList,
    });

    const facts = buildFacts({
      profile: delhiPreset,
      air: fakeAir,
      activityContexts,
      commuteContexts,
      indoorScenarios: indoorScenariosList,
      ledger,
      language: 'en',
    });

    const idRegex = /^[a-z0-9_]{3,80}$/;
    for (const f of facts) {
      expect(f.id).toMatch(idRegex);
      // Fact labels must never contain raw digits except allowed tokens PM2.5, PM10, N95, CO2
      const strippedLabel = f.label.replace(/PM2\.5|PM10|N95|CO2/gi, '');
      expect(/\p{Nd}/u.test(strippedLabel)).toBe(false);
    }
  });

  it('candidates: labels never contain digits, and facts exist for every factId referenced by candidates', () => {
    const cOut = 340;
    const indoorScenariosList = indoorScenarios(
      {
        roomAreaM2: delhiPreset.home.roomAreaM2,
        ceilingHeightM: delhiPreset.home.ceilingHeightM,
        windowState: delhiPreset.home.windowState,
        purifierCadrM3h: 0,
        plants: 0,
      },
      cOut,
      delhiPreset.members.map((m) => ({ id: m.id, activityHours: 1, commuteHours: 1 })),
      0,
    );

    const activityContexts = delhiPreset.activities.map((a) => ({
      activity: a,
      usualWindow: usualWindow(fakeAir.forecast?.points, a.durationMin, a.usualStartHour, '2026-11-23T12:00:00Z'),
      bestWindow: a.flexible ? bestWindow(fakeAir.forecast?.points, a.durationMin, a.flexible, '2026-11-23T12:00:00Z') : null,
      usualDose: 100,
      bestDose: 60,
      indoorDose: 40,
    }));

    const commuteContexts = delhiPreset.commutes.map((c) => ({
      commute: c,
      commuteId: c.id,
      options: commuteOptions(c, delhiPreset.members, cOut),
    }));

    const candidates = buildCandidates({
      profile: delhiPreset,
      air: fakeAir,
      activityContexts,
      commuteContexts,
      indoorScenarios: indoorScenariosList,
    });

    const ledger = buildLedger({
      profile: delhiPreset,
      activities: activityContexts.map((ac) => ({
        activityId: ac.activity.id,
        memberIds: ac.activity.memberIds,
        usualDoseByMember: { m1: 50, m2: 50 },
        planDoseByMember: { m1: 30, m2: 30 },
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
      profile: delhiPreset,
      air: fakeAir,
      activityContexts,
      commuteContexts,
      indoorScenarios: indoorScenariosList,
      ledger,
      language: 'en',
    });

    const factIdSet = new Set(facts.map((f) => f.id));

    // Verify candidate and option labels do not contain digits
    for (const act of candidates.activities) {
      const strippedAct = act.label.replace(/PM2\.5|PM10|N95|CO2/gi, '');
      expect(/\p{Nd}/u.test(strippedAct)).toBe(false);
      for (const opt of act.options) {
        const strippedOpt = opt.label.replace(/PM2\.5|PM10|N95|CO2/gi, '');
        expect(/\p{Nd}/u.test(strippedOpt)).toBe(false);
        for (const fid of opt.factIds) {
          expect(factIdSet.has(fid), `Missing fact id: ${fid}`).toBe(true);
        }
      }
    }

    for (const com of candidates.commutes) {
      const strippedCom = com.label.replace(/PM2\.5|PM10|N95|CO2/gi, '');
      expect(/\p{Nd}/u.test(strippedCom)).toBe(false);
      for (const opt of com.options) {
        const strippedOpt = opt.label.replace(/PM2\.5|PM10|N95|CO2/gi, '');
        expect(/\p{Nd}/u.test(strippedOpt)).toBe(false);
        for (const fid of opt.factIds) {
          expect(factIdSet.has(fid), `Missing fact id: ${fid}`).toBe(true);
        }
      }
    }

    for (const ind of candidates.indoor) {
      const strippedInd = ind.label.replace(/PM2\.5|PM10|N95|CO2/gi, '');
      expect(/\p{Nd}/u.test(strippedInd)).toBe(false);
      for (const fid of ind.factIds) {
        expect(factIdSet.has(fid), `Missing indoor fact id: ${fid}`).toBe(true);
      }
    }

    for (const comm of candidates.community) {
      const strippedComm = comm.label.replace(/PM2\.5|PM10|N95|CO2/gi, '');
      expect(/\p{Nd}/u.test(strippedComm)).toBe(false);
      for (const fid of comm.factIds) {
        expect(factIdSet.has(fid), `Missing community fact id: ${fid}`).toBe(true);
      }
    }
  });
});
