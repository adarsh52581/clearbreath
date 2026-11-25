import type { Candidates, Fact, Language } from '../shared/schemas.js';
import type {
  AiIndoorExplanation,
  AiPlan,
  RoutinePlanItem,
  IndoorPlanItem,
  CommunityPlanItem,
} from '../shared/aiSchemas.js';

function buildFallbackRoutine(candidates: Candidates, isHi: boolean): RoutinePlanItem[] {
  const routine: RoutinePlanItem[] = [];

  for (const act of candidates.activities) {
    const recOpt = act.options.find((o) => o.recommended) ?? act.options[0];
    if (!recOpt) continue;

    let whyText = isHi
      ? `इस गतिविधि के लिए अनुमानित संपर्क: {{act_${act.itemId}_dose_change}}।`
      : `Estimated intake for this activity: {{act_${act.itemId}_dose_change}}.`;

    if (act.itemId === 'chain') {
      whyText = isHi
        ? 'संयुक्त फेरे से संपर्क में बचत {{chain_dose_change}}।'
        : 'Combined errands trip exposure {{chain_dose_change}}.';
    }

    routine.push({
      itemId: act.itemId,
      chosenOptionId: recOpt.optionId,
      headline: `${act.label}: {{opt_${recOpt.optionId}_label}}`,
      why: whyText,
      tradeoff: null,
      priority: 'medium',
    });
  }

  for (const com of candidates.commutes) {
    const recOpt = com.options.find((o) => o.recommended) ?? com.options[0];
    if (!recOpt) continue;

    const mode = recOpt.optionId.replace(`${com.itemId}_`, '');
    const whyText = isHi
      ? `वर्तमान की तुलना में संपर्क {{com_${com.itemId}_${mode}_dose_change}}; प्रति सप्ताह बचाई गई CO2 {{com_${com.itemId}_${mode}_co2_saved_week}}।`
      : `Exposure {{com_${com.itemId}_${mode}_dose_change}} than now; CO2 saved per week {{com_${com.itemId}_${mode}_co2_saved_week}}.`;

    routine.push({
      itemId: com.itemId,
      chosenOptionId: recOpt.optionId,
      headline: `${com.label}: {{opt_${recOpt.optionId}_label}}`,
      why: whyText,
      tradeoff: null,
      priority: 'medium',
    });
  }

  return routine.slice(0, 15);
}

function buildFallbackIndoor(indoor: Candidates['indoor'], isHi: boolean): IndoorPlanItem[] {
  const result: IndoorPlanItem[] = [];
  for (const act of indoor.slice(0, 5)) {
    const changeFactId = act.factIds.find((id) => id.startsWith('in_') && id.endsWith('_change'));
    let whyText = `{{${act.factIds[0]}}}`;
    if (changeFactId) {
      whyText = isHi
        ? `अनुमानित इनडोर बदलाव: {{${changeFactId}}}।`
        : `Estimated indoor change: {{${changeFactId}}}.`;
    }

    result.push({
      actionId: act.actionId,
      headline: act.label,
      why: whyText,
      priority: 'medium',
    });
  }
  return result;
}

export function fallbackPlan({
  candidates,
  language,
}: {
  facts: readonly Fact[];
  candidates: Candidates;
  language: Language;
}): AiPlan {
  const isHi = language === 'hi';

  const summary = isHi
    ? 'अभी वायु गुणवत्ता: {{air_category_now}} ({{air_naqi_basis}})। AI व्याख्या अभी उपलब्ध नहीं है, इसलिए ये ClearBreath के गणना किए गए सबसे कम-संपर्क वाले विकल्प हैं।'
    : "Air quality now: {{air_category_now}} ({{air_naqi_basis}}). AI explanations are unavailable right now, so these are ClearBreath's computed lowest-exposure options.";

  const community: CommunityPlanItem[] = candidates.community.slice(0, 2).map((act) => ({
    actionId: act.actionId,
    headline: act.label,
    why: `{{${act.factIds[0]}}}`,
  }));

  const caveats = isHi
    ? ['अनुमान लाइव बाहरी डेटा और प्रकाशित श्वसन दरों पर आधारित हैं; ये चिकित्सीय माप नहीं हैं।']
    : ['Estimates use live outdoor data and published breathing rates; they are not medical measurements.'];

  return {
    summary,
    routine: buildFallbackRoutine(candidates, isHi),
    indoor: buildFallbackIndoor(candidates.indoor, isHi),
    community,
    caveats,
  };
}

/**
 * Deterministic fallback for POST /api/iaq/explain when Gemini is unavailable or fails twice.
 * Implements AI_CONTRACT §6 & §8.
 */
export function fallbackIndoorExplanation({
  candidates,
  language,
}: {
  facts: readonly Fact[];
  candidates: Candidates;
  language: Language;
}): AiIndoorExplanation {
  const isHi = language === 'hi';

  const summary = isHi
    ? 'अनुमानित घर के अंदर PM2.5: {{in_baseline_pm25}}। AI व्याख्या अभी उपलब्ध नहीं है, इसलिए ये ClearBreath के गणना किए गए इनडोर उपाय हैं।'
    : "Estimated indoor PM2.5: {{in_baseline_pm25}}. AI explanations are unavailable right now, so these are ClearBreath's computed indoor actions.";

  const caveats = isHi
    ? ['इनडोर अनुमान बिना किसी घरेलू धुएँ के स्रोत के स्थिर स्थिति पर आधारित हैं; ये चिकित्सीय माप नहीं हैं।']
    : ['Indoor estimates assume steady-state conditions with no indoor smoke sources; they are not medical measurements.'];

  return {
    summary,
    actions: buildFallbackIndoor(candidates.indoor, isHi),
    caveats,
  };
}
