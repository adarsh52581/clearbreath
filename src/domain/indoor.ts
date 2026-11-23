import { indoorDefaults } from "./data/indoorDefaults";
import type { IndoorScenario } from "../shared/schemas";

export type { IndoorScenario };

/**
 * Steady-state indoor PM2.5 concentration (single-zone mass balance).
 * C_in = (P * a * C_out) / (a + k + CADR/V)
 * Source: DOMAIN_MODEL §5
 */
export function steadyStateIndoor({
  cOut,
  penetration,
  airExchangePerHour,
  depositionPerHour,
  cadrM3h,
  volumeM3,
}: {
  cOut: number;
  penetration: number;
  airExchangePerHour: number;
  depositionPerHour: number;
  cadrM3h: number;
  volumeM3: number;
}): number {
  for (const [name, val] of [
    ["cOut", cOut],
    ["penetration", penetration],
    ["airExchangePerHour", airExchangePerHour],
    ["depositionPerHour", depositionPerHour],
    ["cadrM3h", cadrM3h],
    ["volumeM3", volumeM3],
  ] as [string, number][]) {
    if (typeof val !== "number" || !Number.isFinite(val) || val < 0) {
      throw new RangeError(`${name} must be a non-negative finite number`);
    }
  }
  if (volumeM3 === 0) throw new RangeError("volumeM3 must be non-zero");

  const numerator = penetration * airExchangePerHour * cOut;
  const denominator = airExchangePerHour + depositionPerHour + cadrM3h / volumeM3;
  return numerator / denominator;
}

/** Room volume in m³ */
export function roomVolume(home: { roomAreaM2: number; ceilingHeightM: number }): number {
  if (home.roomAreaM2 <= 0 || !Number.isFinite(home.roomAreaM2))
    throw new RangeError("roomAreaM2 must be positive finite");
  if (home.ceilingHeightM <= 0 || !Number.isFinite(home.ceilingHeightM))
    throw new RangeError("ceilingHeightM must be positive finite");
  return home.roomAreaM2 * home.ceilingHeightM;
}

/** Recommended purifier CADR: 5 ACH × volume */
export function recommendedCadrM3h(volumeM3: number): number {
  if (!Number.isFinite(volumeM3) || volumeM3 <= 0)
    throw new RangeError("volumeM3 must be positive finite");
  return indoorDefaults.recommendedCadrAch.ach * volumeM3;
}

/** Convert CFM → m³/h (1 CFM = 1.699 m³/h) */
export function cfmToM3h(cfm: number): number {
  if (!Number.isFinite(cfm) || cfm < 0)
    throw new RangeError("cfm must be a non-negative finite number");
  return cfm * indoorDefaults.cfmToM3hFactor.value;
}

/** Convert m³/h → CFM */
export function m3hToCfm(m3h: number): number {
  if (!Number.isFinite(m3h) || m3h < 0)
    throw new RangeError("m³/h must be a non-negative finite number");
  return m3h / indoorDefaults.cfmToM3hFactor.value;
}

type WindowState = keyof typeof indoorDefaults.airExchangeByWindowState;

type HomeInput = {
  roomAreaM2: number;
  ceilingHeightM: number;
  windowState: WindowState;
  purifierCadrM3h?: number;
  plants?: number;
};

type MemberInput = {
  id: string;
  activityHours: number;
  commuteHours: number;
};

function computeCIn(
  home: HomeInput,
  cOut: number,
  volume: number,
  overrideWindowState?: WindowState,
  overridePurifier?: number,
  overridePlants?: number,
): number {
  const ws = overrideWindowState ?? home.windowState;
  const a = indoorDefaults.airExchangeByWindowState[ws].value;
  const k = indoorDefaults.k.value;
  const plants = overridePlants ?? home.plants ?? 0;
  const purifier = overridePurifier ?? home.purifierCadrM3h ?? 0;
  const cadr = purifier + plants * indoorDefaults.plantCadrPerPlant.value;
  return steadyStateIndoor({
    cOut,
    penetration: indoorDefaults.P.value,
    airExchangePerHour: a,
    depositionPerHour: k,
    cadrM3h: cadr,
    volumeM3: volume,
  });
}

function computeDoseByMember(
  cIn: number,
  members: MemberInput[],
): Array<{ memberId: string; dose: number }> {
  // Sedentary inhalation rate from EPA EFH table (adult): 0.26 m³/h
  // (used as a conservative lower bound; member-specific rates are a future enhancement)
  const sedentaryRateM3h = 0.26 * 60; // 15.6 m³/h
  return members.map((m) => {
    const indoorHours = Math.max(0, 24 - m.activityHours - m.commuteHours);
    const dose = cIn * sedentaryRateM3h * indoorHours;
    return { memberId: m.id, dose };
  });
}

/**
 * Compute all applicable indoor scenarios for the given home and outdoor concentration.
 * memberOutdoorHours is not currently used (each member carries its own hours).
 */
export function indoorScenarios(
  home: HomeInput,
  cOut: number,
  members: MemberInput[],
  // memberOutdoorHours is not used: each MemberInput carries its own activityHours + commuteHours.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _memberOutdoorHours: number, // reserved for future use; each member carries its own hours
): IndoorScenario[] {
  if (!Number.isFinite(cOut) || cOut < 0)
    throw new RangeError("cOut must be a non-negative finite number");

  const volume = roomVolume(home);
  const baselineCIn = computeCIn(home, cOut, volume);
  const recommended = recommendedCadrM3h(volume);

  const scenarios: IndoorScenario[] = [];

  function add(id: string, label: string, cIn: number): void {
    const pctVsBaseline =
      baselineCIn > 0 ? ((cIn - baselineCIn) / baselineCIn) * 100 : 0;
    const pctVsOutdoor =
      cOut > 0 ? ((cIn - cOut) / cOut) * 100 : 0;
    scenarios.push({
      id,
      label,
      cIn,
      pctVsBaseline,
      pctVsOutdoor,
      doseByMember: computeDoseByMember(cIn, members),
    });
  }

  // baseline — always
  add("baseline", "Baseline", baselineCIn);

  // close_windows — only when partly_open or open
  if (home.windowState === "partly_open" || home.windowState === "open") {
    add("close_windows", "Close windows", computeCIn(home, cOut, volume, "closed"));
  }

  // sealed — only when not already sealed
  if (home.windowState !== "sealed") {
    add("sealed", "Seal (draught-proof)", computeCIn(home, cOut, volume, "sealed"));
  }

  // purifier_recommended — when no purifier or CADR below target
  const hasPurifier = (home.purifierCadrM3h ?? 0) > 0;
  const belowTarget = (home.purifierCadrM3h ?? 0) < recommended;
  if (!hasPurifier || belowTarget) {
    add(
      "purifier_recommended",
      "Recommended purifier",
      computeCIn(home, cOut, volume, undefined, recommended),
    );
    // sealed_plus_purifier only when purifier_recommended applies
    add(
      "sealed_plus_purifier",
      "Seal + recommended purifier",
      computeCIn(home, cOut, volume, "sealed", recommended),
    );
  }

  // plants_plus_10 — always
  const basePlants = home.plants ?? 0;
  add(
    "plants_plus_10",
    "Add 10 plants",
    computeCIn(home, cOut, volume, undefined, undefined, basePlants + 10),
  );

  return scenarios;
}

/**
 * Returns evidence IDs for flagged indoor sources present in the home.
 * Never invents or assigns numeric values — only links to reference evidence entries.
 */
export function sourceWarnings(home: {
  incense?: boolean;
  mosquitoCoil?: boolean;
  kitchenExhaust?: boolean;
  smokingIndoors?: boolean;
  cookingFuel?: string;
}): string[] {
  const warnings: string[] = [];
  if (home.incense) warnings.push("tip_incense");
  if (home.mosquitoCoil) warnings.push("ref_mosquito_coil");
  if (home.cookingFuel !== undefined && !home.kitchenExhaust) warnings.push("tip_cooking_exhaust");
  if (home.smokingIndoors) warnings.push("tip_clean_room");
  return warnings;
}
