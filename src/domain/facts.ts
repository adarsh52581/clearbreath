import type {
  AirReport,
  Fact,
  HouseholdProfile,
  Language,
} from '../shared/schemas.js';
import { evidence } from './data/evidence.js';
import {
  describeChange,
  formatCo2Kg,
  formatDose,
  formatIstTime,
  formatMinutes,
  formatUgM3,
} from './format.js';
import type { ActivityCandidateContext } from './candidates.js';
import type { CommuteOption } from './commute.js';
import type { CleanWindow } from './windows.js';
import type { IndoorScenario } from './indoor.js';
import type { HouseholdLedger } from './ledger.js';
import { percentChange } from './exposure.js';

export interface FactsContext {
  readonly profile: HouseholdProfile;
  readonly air: AirReport;
  readonly activityContexts: readonly ActivityCandidateContext[];
  readonly commuteContexts: readonly {
    readonly commuteId: string;
    readonly options: readonly CommuteOption[];
  }[];
  readonly indoorScenarios: readonly IndoorScenario[];
  readonly ledger: HouseholdLedger;
  readonly language: Language;
  readonly tripChain?: {
    readonly window: CleanWindow;
    readonly doseChangePct: number;
  } | null;
  readonly grapStage?: number | string | null;
}

const CATEGORY_NAMES_EN: Record<string, string> = {
  good: 'Good',
  satisfactory: 'Satisfactory',
  moderate: 'Moderate',
  poor: 'Poor',
  very_poor: 'Very Poor',
  severe: 'Severe',
};

const CATEGORY_NAMES_HI: Record<string, string> = {
  good: 'अच्छा',
  satisfactory: 'संतोषजनक',
  moderate: 'मध्यम',
  poor: 'ख़राब',
  very_poor: 'बहुत ख़राब',
  severe: 'गंभीर',
};

function addNaqiFacts(air: AirReport, lang: Language, facts: Fact[]): void {
  const naqi = air.naqi;
  if (!naqi) return;

  facts.push({
    id: 'air_naqi_now',
    label: 'Current NAQI index',
    value: naqi.value,
    display: String(Math.round(naqi.value)),
    kind: 'computed',
    provenance: 'CPCB NAQI computation',
  });

  const catMap = lang === 'hi' ? CATEGORY_NAMES_HI : CATEGORY_NAMES_EN;
  facts.push({
    id: 'air_category_now',
    label: 'Current AQI category',
    value: naqi.category,
    display: catMap[naqi.category] ?? naqi.category,
    kind: 'computed',
    provenance: 'CPCB category classification',
  });

  const basisText =
    naqi.basis === '24h'
      ? lang === 'hi'
        ? 'चौबीस घंटे का औसत'
        : 'Twenty-four hour average'
      : lang === 'hi'
        ? 'सांकेतिक ताज़ा रीडिंग'
        : 'Indicative latest reading';

  facts.push({
    id: 'air_naqi_basis',
    label: 'NAQI basis',
    value: naqi.basis,
    display: basisText,
    kind: 'computed',
    provenance: 'CPCB basis standard',
  });
}

function addStationFacts(air: AirReport, facts: Fact[]): void {
  if (air.measured?.station) {
    facts.push({
      id: 'air_station',
      label: 'Monitoring station name',
      value: air.measured.station.name,
      display: air.measured.station.name,
      kind: 'measured',
      provenance: air.measured.source.name,
    });
    facts.push({
      id: 'air_station_distance',
      label: 'Distance to monitoring station',
      value: air.measured.station.distanceKm,
      unit: 'km',
      display: `${air.measured.station.distanceKm.toFixed(1)} km`,
      kind: 'computed',
      provenance: 'Haversine distance computation',
    });
  }

  facts.push({
    id: 'air_updated',
    label: 'Air quality data timestamp',
    value: air.fetchedAtUtc,
    display: formatIstTime(air.fetchedAtUtc),
    kind: 'measured',
    provenance: 'Data fetch timestamp',
    asOfUtc: air.fetchedAtUtc,
  });
}

function addMeasuredAirFacts(air: AirReport, facts: Fact[]): void {
  const measured = air.measured;
  if (!measured) {
    addStationFacts(air, facts);
    return;
  }
  const sourceName = measured.source.name;
  const pm25 = measured.latest.pm25;
  if (typeof pm25?.value === 'number') {
    facts.push({
      id: 'air_pm25_now',
      label: 'Current PM2.5 concentration',
      value: pm25.value,
      unit: 'µg/m³',
      display: formatUgM3(pm25.value),
      kind: 'measured',
      provenance: sourceName,
      asOfUtc: pm25.atUtc,
    });
  }

  const pm10 = measured.latest.pm10;
  if (typeof pm10?.value === 'number') {
    facts.push({
      id: 'air_pm10_now',
      label: 'Current PM10 concentration',
      value: pm10.value,
      unit: 'µg/m³',
      display: formatUgM3(pm10.value),
      kind: 'measured',
      provenance: sourceName,
      asOfUtc: pm10.atUtc,
    });
  }

  addStationFacts(air, facts);
}

function addForecastAirFacts(air: AirReport, grapStage: number | string | null | undefined, facts: Fact[]): void {
  const forecastSource = air.forecast?.source.name ?? 'Forecast provider';
  facts.push({
    id: 'air_forecast_source',
    label: 'Forecast data provider',
    value: forecastSource,
    display: forecastSource,
    kind: 'reference',
    provenance: 'Forecast service provider',
  });

  const points = (air.forecast?.points ?? []).filter(
    (p): p is { timeUtc: string; pm25: number; pm10: number | null } =>
      typeof p.pm25 === 'number',
  );

  if (points.length > 0) {
    const next24 = points.slice(0, 24);
    let minPt = next24[0]!;
    let maxPt = next24[0]!;
    for (const pt of next24) {
      if (pt.pm25 < minPt.pm25) minPt = pt;
      if (pt.pm25 > maxPt.pm25) maxPt = pt;
    }

    facts.push({
      id: 'air_cleanest_hour_next24',
      label: 'Cleanest forecast hour in next day',
      value: minPt.timeUtc,
      display: formatIstTime(minPt.timeUtc),
      kind: 'forecast',
      provenance: forecastSource,
    });
    facts.push({
      id: 'air_cleanest_pm25_next24',
      label: 'Cleanest forecast PM2.5 in next day',
      value: minPt.pm25,
      unit: 'µg/m³',
      display: formatUgM3(minPt.pm25),
      kind: 'forecast',
      provenance: forecastSource,
    });
    facts.push({
      id: 'air_worst_hour_next24',
      label: 'Peak pollution forecast hour in next day',
      value: maxPt.timeUtc,
      display: formatIstTime(maxPt.timeUtc),
      kind: 'forecast',
      provenance: forecastSource,
    });
    facts.push({
      id: 'air_worst_pm25_next24',
      label: 'Peak pollution forecast PM2.5 in next day',
      value: maxPt.pm25,
      unit: 'µg/m³',
      display: formatUgM3(maxPt.pm25),
      kind: 'forecast',
      provenance: forecastSource,
    });
  }

  if (grapStage !== undefined && grapStage !== null && String(grapStage).trim() !== '') {
    const stageStr = String(grapStage).trim();
    facts.push({
      id: 'air_grap_stage',
      label: 'GRAP restriction stage in force',
      value: stageStr,
      display: `Stage ${stageStr}`,
      kind: 'reference',
      provenance: 'CAQM Delhi-NCR GRAP order',
    });
  }
}

function addActivityOptionFacts(
  a: string,
  actCtx: ActivityCandidateContext,
  lang: Language,
  facts: Fact[],
): void {
  facts.push({
    id: `opt_${a}_usual_label`,
    label: 'Activity usual choice label',
    value: actCtx.usualWindow?.labelIst ?? 'Usual time',
    display: actCtx.usualWindow?.labelIst ?? 'Usual time',
    kind: 'computed',
    provenance: 'Activity schedule',
  });

  if (actCtx.bestWindow) {
    facts.push({
      id: `opt_${a}_best_label`,
      label: 'Activity cleanest window choice label',
      value: actCtx.bestWindow.labelIst,
      display: actCtx.bestWindow.labelIst,
      kind: 'computed',
      provenance: 'Clean window finder',
    });
  }

  facts.push({
    id: `opt_${a}_indoor_label`,
    label: 'Activity indoor choice label',
    value: 'Move indoors',
    display: lang === 'hi' ? 'घर के अंदर जाएँ' : 'Move indoors',
    kind: 'computed',
    provenance: 'Indoor activity recommendation',
  });
}

function addSingleActivityFacts(
  actCtx: ActivityCandidateContext,
  indoorCIn: number,
  forecastSource: string,
  lang: Language,
  facts: Fact[],
): void {
  const a = actCtx.activity.id;

  if (actCtx.usualWindow) {
    facts.push({
      id: `act_${a}_usual_window`,
      label: 'Activity usual schedule window',
      value: actCtx.usualWindow.labelIst,
      display: actCtx.usualWindow.labelIst,
      kind: 'forecast',
      provenance: 'Usual start hour matching',
    });
    facts.push({
      id: `act_${a}_usual_pm25`,
      label: 'Activity usual PM2.5 forecast',
      value: actCtx.usualWindow.meanPm25,
      unit: 'µg/m³',
      display: formatUgM3(actCtx.usualWindow.meanPm25),
      kind: 'forecast',
      provenance: forecastSource,
    });
  }

  if (actCtx.bestWindow) {
    facts.push({
      id: `act_${a}_best_window`,
      label: 'Activity cleanest schedule window',
      value: actCtx.bestWindow.labelIst,
      display: actCtx.bestWindow.labelIst,
      kind: 'forecast',
      provenance: 'Clean-window optimization algorithm',
    });
    facts.push({
      id: `act_${a}_best_pm25`,
      label: 'Activity cleanest window PM2.5 forecast',
      value: actCtx.bestWindow.meanPm25,
      unit: 'µg/m³',
      display: formatUgM3(actCtx.bestWindow.meanPm25),
      kind: 'forecast',
      provenance: forecastSource,
    });
  }

  const bestChange =
    actCtx.bestDose !== null ? percentChange(actCtx.usualDose, actCtx.bestDose) : null;
  facts.push({
    id: `act_${a}_dose_change`,
    label: 'Activity exposure reduction for cleanest window',
    value: bestChange ?? 0,
    display: describeChange(bestChange, lang),
    kind: 'computed',
    provenance: 'Inhaled dose model',
  });

  facts.push({
    id: `act_${a}_indoor_pm25`,
    label: 'Indoor space baseline PM2.5 level',
    value: indoorCIn,
    unit: 'µg/m³',
    display: formatUgM3(indoorCIn),
    kind: 'computed',
    provenance: 'Indoor steady-state model',
  });

  const indoorChange = percentChange(actCtx.usualDose, actCtx.indoorDose);
  facts.push({
    id: `act_${a}_indoor_dose_change`,
    label: 'Activity exposure change moving indoors',
    value: indoorChange ?? 0,
    display: describeChange(indoorChange, lang),
    kind: 'computed',
    provenance: 'Indoor steady-state model',
  });

  addActivityOptionFacts(a, actCtx, lang, facts);
}

function addCommuteFacts(
  commuteContexts: readonly { readonly commuteId: string; readonly options: readonly CommuteOption[] }[],
  lang: Language,
  facts: Fact[],
): void {
  for (const comCtx of commuteContexts) {
    const c = comCtx.commuteId;
    const carOpt = comCtx.options.find((o) => o.mode === 'car') ?? comCtx.options[0];
    const usualDose = carOpt?.doseUg ?? 1;

    for (const opt of comCtx.options) {
      const x = opt.mode;
      facts.push({
        id: `com_${c}_${x}_minutes`,
        label: 'Commute travel duration',
        value: opt.minutes,
        display: formatMinutes(opt.minutes, lang),
        kind: 'computed',
        provenance: 'Speed and distance estimation',
      });

      const doseChange = percentChange(usualDose, opt.doseUg);
      facts.push({
        id: `com_${c}_${x}_dose_change`,
        label: 'Commute exposure difference versus usual',
        value: doseChange ?? 0,
        display: describeChange(doseChange, lang),
        kind: 'computed',
        provenance: 'Commute inhalation model',
      });

      facts.push({
        id: `com_${c}_${x}_co2_week`,
        label: 'Commute weekly CO2 footprint',
        value: opt.weeklyCo2Kg,
        unit: 'kg',
        display: formatCo2Kg(opt.weeklyCo2Kg, lang),
        kind: 'computed',
        provenance: 'TERI passenger emission factors',
      });

      facts.push({
        id: `com_${c}_${x}_co2_saved_week`,
        label: 'Commute weekly CO2 saved',
        value: opt.co2SavedKg,
        unit: 'kg',
        display: formatCo2Kg(opt.co2SavedKg, lang),
        kind: 'computed',
        provenance: 'TERI passenger emission factors',
      });

      facts.push({
        id: `com_${c}_${x}_vehicle_km_avoided_week`,
        label: 'Commute private vehicle distance avoided per week',
        value: opt.vehicleKmAvoidedWeek,
        unit: 'km',
        display: `${Math.round(opt.vehicleKmAvoidedWeek)} km`,
        kind: 'computed',
        provenance: 'Vehicle distance computation',
      });

      facts.push({
        id: `opt_${c}_${x}_label`,
        label: 'Commute mode selection label',
        value: x,
        display: x,
        kind: 'reference',
        provenance: 'Commute mode list',
      });
    }
  }
}

function addIndoorFacts(
  indoorScenarios: readonly IndoorScenario[],
  home: HouseholdProfile['home'],
  lang: Language,
  facts: Fact[],
): void {
  for (const s of indoorScenarios) {
    facts.push({
      id: `in_${s.id}_pm25`,
      label: 'Indoor scenario PM2.5 concentration',
      value: s.cIn,
      unit: 'µg/m³',
      display: formatUgM3(s.cIn),
      kind: 'computed',
      provenance: 'Indoor single-zone mass balance model',
    });
    facts.push({
      id: `in_${s.id}_change`,
      label: 'Indoor scenario change versus baseline',
      value: s.pctVsBaseline,
      display: describeChange(s.pctVsBaseline, lang),
      kind: 'computed',
      provenance: 'Indoor single-zone mass balance model',
    });
  }

  const baselineScen = indoorScenarios.find((s) => s.id === 'baseline');
  if (baselineScen) {
    facts.push({
      id: 'in_baseline_vs_outdoor',
      label: 'Baseline indoor versus outdoor PM2.5 difference',
      value: baselineScen.pctVsOutdoor,
      display: describeChange(baselineScen.pctVsOutdoor, lang),
      kind: 'computed',
      provenance: 'Indoor mass balance model',
    });
  }

  const volume = home.roomAreaM2 * home.ceilingHeightM;
  facts.push({
    id: 'in_recommended_cadr',
    label: 'Recommended air purifier CADR delivery rate',
    value: volume * 5,
    unit: 'm³/h',
    display: `${Math.round(volume * 5)} m³/h`,
    kind: 'reference',
    provenance: 'AHAM room air exchange standard',
  });
  facts.push({
    id: 'in_room_volume',
    label: 'Room volume capacity',
    value: volume,
    unit: 'm³',
    display: `${Math.round(volume)} m³`,
    kind: 'computed',
    provenance: 'Room area and ceiling height',
  });
}

function addLedgerFacts(ledger: HouseholdLedger, lang: Language, facts: Fact[]): void {
  for (const entry of ledger.members) {
    const m = entry.memberId;
    facts.push({
      id: `led_${m}_usual`,
      label: 'Member daily usual intake dose',
      value: entry.usualDoseUg,
      unit: 'µg',
      display: formatDose(entry.usualDoseUg, lang),
      kind: 'computed',
      provenance: 'Daily inhaled dose model',
    });
    facts.push({
      id: `led_${m}_plan`,
      label: 'Member daily plan intake dose',
      value: entry.planDoseUg,
      unit: 'µg',
      display: formatDose(entry.planDoseUg, lang),
      kind: 'computed',
      provenance: 'Plan exposure optimization',
    });
    facts.push({
      id: `led_${m}_change`,
      label: 'Member overall daily intake difference',
      value: entry.doseChangePct ?? 0,
      display: describeChange(entry.doseChangePct, lang),
      kind: 'computed',
      provenance: 'Intake ledger comparison',
    });
  }

  facts.push({
    id: 'led_household_co2_saved_week',
    label: 'Household weekly CO2 emissions avoided',
    value: ledger.householdCo2SavedWeekKg,
    unit: 'kg',
    display: formatCo2Kg(ledger.householdCo2SavedWeekKg, lang),
    kind: 'computed',
    provenance: 'Commute mode substitution model',
  });
}

function addTripChainAndEvidenceFacts(
  tripChain: FactsContext['tripChain'],
  lang: Language,
  facts: Fact[],
): void {
  if (tripChain) {
    facts.push({
      id: 'chain_best_window',
      label: 'Combined errands cleanest schedule window',
      value: tripChain.window.labelIst,
      display: tripChain.window.labelIst,
      kind: 'forecast',
      provenance: 'Trip-chaining clean window finder',
    });
    facts.push({
      id: 'chain_dose_change',
      label: 'Combined errands exposure reduction',
      value: tripChain.doseChangePct,
      display: describeChange(tripChain.doseChangePct, lang),
      kind: 'computed',
      provenance: 'Combined trip exposure comparison',
    });
    facts.push({
      id: 'chain_trips_saved',
      label: 'Separate round trips eliminated',
      value: 1,
      display: lang === 'hi' ? 'एक फेरा' : 'one round trip',
      kind: 'computed',
      provenance: 'Trip chaining logic',
    });
    facts.push({
      id: 'opt_chain_best_label',
      label: 'Combined errands option label',
      value: tripChain.window.labelIst,
      display: tripChain.window.labelIst,
      kind: 'computed',
      provenance: 'Trip chaining schedule',
    });
  }

  for (const e of evidence) {
    const finding = lang === 'hi' && e.findingHi ? e.findingHi : e.findingEn;
    facts.push({
      id: e.id,
      label: 'Scientific reference finding',
      value: finding,
      display: finding,
      kind: e.kind === 'guidance' ? 'guidance' : 'reference',
      provenance: e.citation || 'Published scientific reference',
    });
  }
}

export function buildFacts({
  profile,
  air,
  activityContexts,
  commuteContexts,
  indoorScenarios,
  ledger,
  language,
  tripChain,
  grapStage,
}: FactsContext): Fact[] {
  const facts: Fact[] = [];
  const lang = language;

  addNaqiFacts(air, lang, facts);
  addMeasuredAirFacts(air, facts);
  addForecastAirFacts(air, grapStage, facts);

  const baselineCIn = indoorScenarios.find((s) => s.id === 'baseline')?.cIn ?? 0;
  const forecastSource = air.forecast?.source.name ?? 'Forecast provider';

  for (const actCtx of activityContexts) {
    addSingleActivityFacts(actCtx, baselineCIn, forecastSource, lang, facts);
  }

  addCommuteFacts(commuteContexts, lang, facts);
  addIndoorFacts(indoorScenarios, profile.home, lang, facts);
  addLedgerFacts(ledger, lang, facts);
  addTripChainAndEvidenceFacts(tripChain, lang, facts);

  return facts;
}
