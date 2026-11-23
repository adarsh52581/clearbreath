import { describe, it, expect } from "vitest";
import {
  steadyStateIndoor,
  roomVolume,
  recommendedCadrM3h,
  cfmToM3h,
  m3hToCfm,
  indoorScenarios,
  sourceWarnings,
} from "./indoor";
import { indoorDefaults } from "./data/indoorDefaults";

// ─── steadyStateIndoor ───────────────────────────────────────────────────────

describe("steadyStateIndoor", () => {
  const P = indoorDefaults.P.value;
  const k = indoorDefaults.k.value;

  it("closed windows, no purifier → matches formula P·a/(a+k)·cOut", () => {
    const a = indoorDefaults.airExchangeByWindowState.closed.value;
    const cOut = 100;
    const V = 60;
    const expected = (P * a * cOut) / (a + k + 0 / V);
    const result = steadyStateIndoor({
      cOut,
      penetration: P,
      airExchangePerHour: a,
      depositionPerHour: k,
      cadrM3h: 0,
      volumeM3: V,
    });
    expect(result).toBeCloseTo(expected, 10);
  });

  it("adding a purifier lowers cIn", () => {
    const a = indoorDefaults.airExchangeByWindowState.closed.value;
    const cOut = 100;
    const V = 60;
    const noPurifier = steadyStateIndoor({ cOut, penetration: P, airExchangePerHour: a, depositionPerHour: k, cadrM3h: 0, volumeM3: V });
    const withPurifier = steadyStateIndoor({ cOut, penetration: P, airExchangePerHour: a, depositionPerHour: k, cadrM3h: 300, volumeM3: V });
    expect(withPurifier).toBeLessThan(noPurifier);
  });

  it("monotonicity: increasing CADR never increases cIn", () => {
    const a = 1.0;
    const cOut = 80;
    const V = 50;
    const cadrValues = [0, 50, 100, 200, 500, 1000];
    let prev = Infinity;
    for (const cadr of cadrValues) {
      const val = steadyStateIndoor({ cOut, penetration: P, airExchangePerHour: a, depositionPerHour: k, cadrM3h: cadr, volumeM3: V });
      expect(val).toBeLessThanOrEqual(prev + 1e-10);
      prev = val;
    }
  });

  it("monotonicity: increasing air exchange never decreases cIn (no indoor sources)", () => {
    // More ventilation brings in more outdoor air → can raise or at best equal cIn when P≤1
    // The spec says "increasing air exchange never lowers cIn" — i.e. more exchange ≥ current
    const cOut = 80;
    const V = 50;
    const aValues = [0.3, 0.6, 2.0, 5.0];
    let prev = -Infinity;
    for (const a of aValues) {
      const val = steadyStateIndoor({ cOut, penetration: P, airExchangePerHour: a, depositionPerHour: k, cadrM3h: 0, volumeM3: V });
      expect(val).toBeGreaterThanOrEqual(prev - 1e-10);
      prev = val;
    }
  });

  it("NaN cOut → RangeError", () => {
    expect(() =>
      steadyStateIndoor({ cOut: NaN, penetration: 0.8, airExchangePerHour: 0.6, depositionPerHour: 0.2, cadrM3h: 0, volumeM3: 60 })
    ).toThrow(RangeError);
  });

  it("negative volume → RangeError", () => {
    expect(() =>
      steadyStateIndoor({ cOut: 80, penetration: 0.8, airExchangePerHour: 0.6, depositionPerHour: 0.2, cadrM3h: 0, volumeM3: -1 })
    ).toThrow(RangeError);
  });

  it("zero volume → RangeError", () => {
    expect(() =>
      steadyStateIndoor({ cOut: 80, penetration: 0.8, airExchangePerHour: 0.6, depositionPerHour: 0.2, cadrM3h: 0, volumeM3: 0 })
    ).toThrow(RangeError);
  });

  it("Infinity cOut → RangeError", () => {
    expect(() =>
      steadyStateIndoor({ cOut: Infinity, penetration: 0.8, airExchangePerHour: 0.6, depositionPerHour: 0.2, cadrM3h: 0, volumeM3: 60 })
    ).toThrow(RangeError);
  });
});

// ─── roomVolume ──────────────────────────────────────────────────────────────

describe("roomVolume", () => {
  it("computes area × height", () => {
    expect(roomVolume({ roomAreaM2: 20, ceilingHeightM: 3 })).toBeCloseTo(60);
  });

  it("zero area → RangeError", () => {
    expect(() => roomVolume({ roomAreaM2: 0, ceilingHeightM: 3 })).toThrow(RangeError);
  });

  it("negative height → RangeError", () => {
    expect(() => roomVolume({ roomAreaM2: 20, ceilingHeightM: -1 })).toThrow(RangeError);
  });
});

// ─── recommendedCadrM3h ──────────────────────────────────────────────────────

describe("recommendedCadrM3h", () => {
  it("5 × volume", () => {
    expect(recommendedCadrM3h(60)).toBeCloseTo(300);
  });

  it("zero volume → RangeError", () => {
    expect(() => recommendedCadrM3h(0)).toThrow(RangeError);
  });
});

// ─── CFM ↔ m³/h round-trip ──────────────────────────────────────────────────

describe("cfmToM3h / m3hToCfm round-trip", () => {
  it("roundtrip is within floating-point tolerance", () => {
    const cfm = 150;
    expect(m3hToCfm(cfmToM3h(cfm))).toBeCloseTo(cfm, 8);
  });

  it("known value: 1 CFM = 1.699 m³/h", () => {
    expect(cfmToM3h(1)).toBeCloseTo(1.699, 5);
  });

  it("negative cfm → RangeError", () => {
    expect(() => cfmToM3h(-1)).toThrow(RangeError);
  });

  it("negative m3h → RangeError", () => {
    expect(() => m3hToCfm(-1)).toThrow(RangeError);
  });
});

// ─── indoorScenarios ─────────────────────────────────────────────────────────

const baseHome = {
  roomAreaM2: 20,
  ceilingHeightM: 3,
  windowState: "closed" as const,
  purifierCadrM3h: 0,
  plants: 0,
};

const members = [{ id: "adult1", activityHours: 1, commuteHours: 1 }];

describe("indoorScenarios", () => {
  it("always contains baseline as first scenario", () => {
    const sc = indoorScenarios(baseHome, 100, members, 0);
    expect(sc[0]?.id).toBe("baseline");
  });

  it("close_windows omitted when windowState is closed", () => {
    const sc = indoorScenarios(baseHome, 100, members, 0);
    expect(sc.map((s) => s.id)).not.toContain("close_windows");
  });

  it("close_windows present when windowState is partly_open", () => {
    const sc = indoorScenarios({ ...baseHome, windowState: "partly_open" }, 100, members, 0);
    expect(sc.map((s) => s.id)).toContain("close_windows");
  });

  it("close_windows present when windowState is open", () => {
    const sc = indoorScenarios({ ...baseHome, windowState: "open" }, 100, members, 0);
    expect(sc.map((s) => s.id)).toContain("close_windows");
  });

  it("sealed scenario omitted when already sealed", () => {
    const sc = indoorScenarios({ ...baseHome, windowState: "sealed" }, 100, members, 0);
    expect(sc.map((s) => s.id)).not.toContain("sealed");
  });

  it("purifier_recommended present when no purifier", () => {
    const sc = indoorScenarios(baseHome, 100, members, 0);
    expect(sc.map((s) => s.id)).toContain("purifier_recommended");
  });

  it("purifier_recommended absent when purifier >= recommended CADR", () => {
    const volume = 20 * 3; // 60 m³
    const recommended = 5 * volume; // 300
    const sc = indoorScenarios({ ...baseHome, purifierCadrM3h: recommended }, 100, members, 0);
    expect(sc.map((s) => s.id)).not.toContain("purifier_recommended");
  });

  it("plants_plus_10 always present", () => {
    const sc = indoorScenarios(baseHome, 100, members, 0);
    expect(sc.map((s) => s.id)).toContain("plants_plus_10");
  });

  it("plants_plus_10 changes cIn by less than 1 %", () => {
    const sc = indoorScenarios(baseHome, 100, members, 0);
    const plants10 = sc.find((s) => s.id === "plants_plus_10")!;
    const pctChange = Math.abs(plants10.pctVsBaseline);
    expect(pctChange).toBeLessThan(1);
  });

  it("recommended purifier lowers cIn vs baseline", () => {
    const sc = indoorScenarios(baseHome, 100, members, 0);
    const baselineScenario = sc.find((s) => s.id === "baseline")!;
    const purifier = sc.find((s) => s.id === "purifier_recommended")!;
    expect(purifier.cIn).toBeLessThan(baselineScenario.cIn);
  });

  it("doseByMember has an entry for each member", () => {
    const twoMembers = [
      { id: "adult1", activityHours: 1, commuteHours: 1 },
      { id: "child1", activityHours: 2, commuteHours: 0 },
    ];
    const sc = indoorScenarios(baseHome, 100, twoMembers, 0);
    for (const scenario of sc) {
      expect(scenario.doseByMember).toHaveLength(2);
    }
  });

  it("pctVsBaseline is 0 for the baseline scenario", () => {
    const sc = indoorScenarios(baseHome, 100, members, 0);
    const baseline = sc.find((s) => s.id === "baseline")!;
    expect(baseline.pctVsBaseline).toBeCloseTo(0, 10);
  });
});

// ─── sourceWarnings ──────────────────────────────────────────────────────────

describe("sourceWarnings", () => {
  it("returns incense tip when incense is true", () => {
    expect(sourceWarnings({ incense: true })).toContain("tip_incense");
  });

  it("returns mosquito coil ref when mosquitoCoil is true", () => {
    expect(sourceWarnings({ mosquitoCoil: true })).toContain("ref_mosquito_coil");
  });

  it("returns cooking exhaust tip when no exhaust and cookingFuel present", () => {
    expect(sourceWarnings({ cookingFuel: "lpg", kitchenExhaust: false })).toContain("tip_cooking_exhaust");
  });

  it("does NOT return cooking exhaust tip when exhaust is on", () => {
    expect(sourceWarnings({ cookingFuel: "lpg", kitchenExhaust: true })).not.toContain("tip_cooking_exhaust");
  });

  it("returns clean room tip when smoking indoors", () => {
    expect(sourceWarnings({ smokingIndoors: true })).toContain("tip_clean_room");
  });

  it("returns empty when no sources flagged", () => {
    expect(sourceWarnings({})).toHaveLength(0);
  });

  it("does NOT return incense tip when incense is false", () => {
    expect(sourceWarnings({ incense: false })).not.toContain("tip_incense");
  });
});
