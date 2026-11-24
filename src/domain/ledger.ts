import type { HouseholdProfile } from '../shared/schemas.js';
import { doseUg, inhalationRate, percentChange } from './exposure.js';
import type { CommuteOption } from './commute.js';
import type { IndoorScenario } from './indoor.js';

export interface MemberLedgerEntry {
  readonly memberId: string;
  readonly usualDoseUg: number;
  readonly planDoseUg: number;
  readonly doseChangePct: number | null;
}

export interface HouseholdLedger {
  readonly members: readonly MemberLedgerEntry[];
  readonly householdCo2SavedWeekKg: number;
}

export interface ActivityDoseInfo {
  readonly activityId: string;
  readonly memberIds: readonly string[];
  readonly usualDoseByMember: Record<string, number>;
  readonly planDoseByMember: Record<string, number>;
  readonly durationHours: number;
}

export interface CommuteDoseInfo {
  readonly commuteId: string;
  readonly memberIds: readonly string[];
  readonly currentMode: string;
  readonly options: readonly CommuteOption[];
  readonly durationHours: number;
}

function computeMemberDoses(
  m: HouseholdProfile['members'][number],
  activities: readonly ActivityDoseInfo[],
  commutes: readonly CommuteDoseInfo[],
  hoursIndoorsPerDay: number,
  baselineCIn: number,
  freeCIn: number,
): MemberLedgerEntry {
  let usualActDose = 0;
  let planActDose = 0;
  let totalActHours = 0;

  for (const act of activities) {
    if (act.memberIds.includes(m.id)) {
      usualActDose += act.usualDoseByMember[m.id] ?? 0;
      planActDose += act.planDoseByMember[m.id] ?? 0;
      totalActHours += act.durationHours;
    }
  }

  let usualCommuteDose = 0;
  let planCommuteDose = 0;
  let totalCommuteHours = 0;

  for (const com of commutes) {
    if (com.memberIds.includes(m.id)) {
      const currentOpt = com.options.find((o) => o.mode === com.currentMode) ?? com.options[0];
      const recOpt = com.options.find((o) => o.recommended) ?? com.options[0];
      if (currentOpt) {
        usualCommuteDose += currentOpt.dosePerTravellerUg;
        totalCommuteHours += com.durationHours;
      }
      if (recOpt) {
        planCommuteDose += recOpt.dosePerTravellerUg;
      }
    }
  }

  const indoorHours = Math.max(0, hoursIndoorsPerDay - totalActHours - totalCommuteHours);
  const sedentaryRate = inhalationRate(m.ageGroup, 'sedentary');

  const usualIndoorDose = doseUg({
    concentration: baselineCIn,
    ratePerHour: sedentaryRate,
    hours: indoorHours,
  });

  const planIndoorDose = doseUg({
    concentration: freeCIn,
    ratePerHour: sedentaryRate,
    hours: indoorHours,
  });

  const totalUsual = usualActDose + usualCommuteDose + usualIndoorDose;
  const totalPlan = planActDose + planCommuteDose + planIndoorDose;
  const changePct = percentChange(totalUsual, totalPlan);

  return {
    memberId: m.id,
    usualDoseUg: Math.max(0, totalUsual),
    planDoseUg: Math.max(0, totalPlan),
    doseChangePct: changePct,
  };
}

export function buildLedger({
  profile,
  activities,
  commutes,
  indoorScenarios,
}: {
  profile: HouseholdProfile;
  activities: readonly ActivityDoseInfo[];
  commutes: readonly CommuteDoseInfo[];
  indoorScenarios: readonly IndoorScenario[];
}): HouseholdLedger {
  const baselineScenario = indoorScenarios.find((s) => s.id === 'baseline');
  const closeWindowsScenario = indoorScenarios.find((s) => s.id === 'close_windows');
  const freeScenario = closeWindowsScenario ?? baselineScenario;

  const baselineCIn = baselineScenario?.cIn ?? 0;
  const freeCIn = freeScenario?.cIn ?? baselineCIn;

  let householdCo2SavedWeekKg = 0;
  for (const c of commutes) {
    const recOpt = c.options.find((o) => o.recommended) ?? c.options[0];
    if (recOpt) {
      householdCo2SavedWeekKg += recOpt.co2SavedKg;
    }
  }

  const memberEntries = profile.members.map((m) =>
    computeMemberDoses(
      m,
      activities,
      commutes,
      profile.home.hoursIndoorsPerDay,
      baselineCIn,
      freeCIn,
    ),
  );

  return {
    members: memberEntries,
    householdCo2SavedWeekKg: Math.max(0, householdCo2SavedWeekKg),
  };
}
