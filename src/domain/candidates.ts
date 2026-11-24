import type {
  Activity,
  AirReport,
  Candidates,
  Commute,
  HouseholdProfile,
  Member,
  Mode,
  Option,
} from '../shared/schemas.js';
import type { CleanWindow } from './windows.js';
import type { CommuteOption } from './commute.js';
import type { IndoorScenario } from './indoor.js';
import { isSensitive } from './exposure.js';

export function stripDigits(str: string, fallback: string): string {
  const cleaned = str.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

const MODE_LABELS: Record<Mode, string> = {
  walk: 'Walking',
  cycle: 'Bicycle',
  two_wheeler: 'Two-wheeler',
  auto: 'Auto rickshaw',
  car: 'Personal car',
  cab: 'Cab or taxi',
  bus: 'Public bus',
  metro: 'Metro train',
};

export interface ActivityCandidateContext {
  readonly activity: Activity;
  readonly usualWindow: CleanWindow | null;
  readonly bestWindow: CleanWindow | null;
  readonly usualDose: number;
  readonly bestDose: number | null;
  readonly indoorDose: number;
}

export interface CandidatesContext {
  readonly profile: HouseholdProfile;
  readonly air: AirReport;
  readonly activityContexts: readonly ActivityCandidateContext[];
  readonly commuteContexts: readonly {
    readonly commute: Commute;
    readonly options: readonly CommuteOption[];
  }[];
  readonly indoorScenarios: readonly IndoorScenario[];
  readonly tripChainWindow?: CleanWindow | null;
}

function shouldAddIndoorOption(
  activity: Activity,
  currentCategory: string | undefined,
  members: readonly Member[],
): boolean {
  const isPoor =
    currentCategory === 'poor' ||
    currentCategory === 'very_poor' ||
    currentCategory === 'severe';
  if (!isPoor) return false;
  if (activity.intensity === 'high') return true;
  return activity.memberIds.some((id) => {
    const m = members.find((mem) => mem.id === id);
    return m ? isSensitive(m) : false;
  });
}

function buildActivityOptions(
  ctx: ActivityCandidateContext,
  currentCategory: string | undefined,
  members: readonly Member[],
): { options: Option[]; chosenRecommendedId: string } {
  const { activity, bestWindow, usualDose, bestDose, indoorDose } = ctx;
  const options: Option[] = [
    {
      optionId: `${activity.id}_usual`,
      label: 'Usual time',
      recommended: false,
      factIds: [`act_${activity.id}_usual_window`, `act_${activity.id}_usual_pm25`],
    },
  ];

  if (bestWindow && bestDose !== null && usualDose > 0) {
    const pctDose = ((bestDose - usualDose) / usualDose) * 100;
    if (pctDose <= -10) {
      options.push({
        optionId: `${activity.id}_best`,
        label: 'Cleanest forecast window',
        recommended: false,
        factIds: [
          `act_${activity.id}_best_window`,
          `act_${activity.id}_best_pm25`,
          `act_${activity.id}_dose_change`,
        ],
      });
    }
  }

  if (shouldAddIndoorOption(activity, currentCategory, members)) {
    options.push({
      optionId: `${activity.id}_indoor`,
      label: 'Move activity indoors',
      recommended: false,
      factIds: [`act_${activity.id}_indoor_pm25`, `act_${activity.id}_indoor_dose_change`],
    });
  }

  // Determine lowest dose
  let minDose = usualDose;
  let recId = `${activity.id}_usual`;
  const bestOpt = options.find((o) => o.optionId === `${activity.id}_best`);
  if (bestOpt && bestDose !== null && bestDose < minDose) {
    minDose = bestDose;
    recId = bestOpt.optionId;
  }
  const indoorOpt = options.find((o) => o.optionId === `${activity.id}_indoor`);
  if (indoorOpt && indoorDose < minDose) {
    recId = indoorOpt.optionId;
  }

  for (const opt of options) {
    opt.recommended = opt.optionId === recId;
  }

  return { options, chosenRecommendedId: recId };
}

function buildVentilationActions(
  home: HouseholdProfile['home'],
  scenarios: readonly IndoorScenario[],
): Candidates['indoor'] {
  const actions: Candidates['indoor'] = [];

  if (home.windowState === 'partly_open' || home.windowState === 'open') {
    actions.push({
      actionId: 'close_windows',
      label: 'Close external windows',
      cost: 'free',
      factIds: ['in_close_windows_pm25', 'in_close_windows_change'],
    });
  }

  actions.push({
    actionId: 'short_airing',
    label: 'Air out room at cleanest forecast hour',
    cost: 'free',
    factIds: ['air_cleanest_hour_next24', 'air_cleanest_pm25_next24'],
  });

  if (home.windowState !== 'sealed') {
    actions.push({
      actionId: 'seal_gaps',
      label: 'Draught-proof doors and window frames',
      cost: 'low',
      factIds: ['in_sealed_pm25', 'in_sealed_change'],
    });
  }

  if (scenarios.some((s) => s.id === 'purifier_recommended')) {
    actions.push({
      actionId: 'add_or_upgrade_purifier',
      label: 'Add or upgrade HEPA air purifier',
      cost: 'medium',
      factIds: ['in_purifier_recommended_pm25', 'in_purifier_recommended_change', 'in_recommended_cadr'],
    });
  }

  actions.push({
    actionId: 'clean_room',
    label: 'Designate clean room with purifier',
    cost: 'free',
    factIds: ['tip_clean_room'],
  });

  return actions;
}

function buildSourceControlActions(home: HouseholdProfile['home']): Candidates['indoor'] {
  const actions: Candidates['indoor'] = [];

  if (!home.kitchenExhaust) {
    actions.push({
      actionId: 'kitchen_exhaust',
      label: 'Use kitchen exhaust during cooking',
      cost: 'low',
      factIds: ['tip_cooking_exhaust'],
    });
  }

  if (home.incense) {
    actions.push({
      actionId: 'skip_incense',
      label: 'Pause incense and dhoop burning',
      cost: 'free',
      factIds: ['tip_incense'],
    });
  }

  if (home.mosquitoCoil) {
    actions.push({
      actionId: 'replace_mosquito_coil',
      label: 'Switch from mosquito coils to window nets',
      cost: 'low',
      factIds: ['ref_mosquito_coil'],
    });
  }

  actions.push(
    {
      actionId: 'wet_mop',
      label: 'Wet-mop floors instead of dry sweeping',
      cost: 'free',
      factIds: ['tip_wet_mop'],
    },
    {
      actionId: 'plants_reality_check',
      label: 'Potted plants indoor air reality check',
      cost: 'free',
      factIds: ['ref_plants', 'in_plants_plus_10_pm25', 'in_plants_plus_10_change'],
    },
  );

  return actions;
}

function buildIndoorActions(
  home: HouseholdProfile['home'],
  scenarios: readonly IndoorScenario[],
): Candidates['indoor'] {
  return [
    ...buildVentilationActions(home, scenarios),
    ...buildSourceControlActions(home),
  ];
}

function buildCommunityActions(profile: HouseholdProfile): Candidates['community'] {
  const community: Candidates['community'] = [];
  const hasCarCommute = profile.commutes.some(
    (c) => c.currentMode === 'car' || c.currentMode === 'cab',
  );
  if (hasCarCommute) {
    community.push({
      actionId: 'carpool_pod',
      label: 'Form a neighborhood carpool pod',
      factIds: ['ref_emissions'],
    });
  }
  community.push(
    {
      actionId: 'report_burning',
      label: 'Report local biomass and waste burning',
      factIds: ['tip_report_burning'],
    },
    {
      actionId: 'shared_clean_room',
      label: 'Create shared clean room for building residents',
      factIds: ['tip_clean_room'],
    },
  );
  return community.slice(0, 3);
}

export function buildCandidates({
  profile,
  air,
  activityContexts,
  commuteContexts,
  indoorScenarios,
  tripChainWindow,
}: CandidatesContext): Candidates {
  const currentCategory = air.naqi?.category;

  const activities = activityContexts.map((ctx) => {
    const { options } = buildActivityOptions(ctx, currentCategory, profile.members);
    return {
      itemId: ctx.activity.id,
      label: stripDigits(ctx.activity.label, 'Outdoor activity'),
      memberIds: ctx.activity.memberIds,
      options,
    };
  });

  const commutes = commuteContexts.map(({ commute, options }) => {
    const optionList: Option[] = options.map((opt) => ({
      optionId: `${commute.id}_${opt.mode}`,
      label: MODE_LABELS[opt.mode] ?? 'Transit mode',
      recommended: opt.recommended,
      factIds: [
        `com_${commute.id}_${opt.mode}_minutes`,
        `com_${commute.id}_${opt.mode}_dose_change`,
        `com_${commute.id}_${opt.mode}_co2_week`,
        `com_${commute.id}_${opt.mode}_co2_saved_week`,
        `com_${commute.id}_${opt.mode}_vehicle_km_avoided_week`,
      ],
    }));

    return {
      itemId: commute.id,
      label: stripDigits(commute.label, 'Daily commute'),
      memberIds: commute.memberIds,
      options: optionList,
    };
  });

  if (tripChainWindow) {
    activities.push({
      itemId: 'chain',
      label: 'Combined local errands',
      memberIds: profile.members.map((m) => m.id),
      options: [
        {
          optionId: 'chain_best',
          label: 'Single combined trip during clean air window',
          recommended: true,
          factIds: ['chain_best_window', 'chain_dose_change', 'chain_trips_saved'],
        },
      ],
    });
  }

  return {
    activities,
    commutes,
    indoor: buildIndoorActions(profile.home, indoorScenarios),
    community: buildCommunityActions(profile),
  };
}
