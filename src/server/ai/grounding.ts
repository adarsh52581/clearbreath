import type { Candidates, Fact } from '../../shared/schemas.js';
import {
  AiPlan,
  AiIndoorExplanation,
  type AiPlan as AiPlanType,
  type AiIndoorExplanation as AiIndoorExplanationType,
} from '../../shared/aiSchemas.js';

export type ValidationResult<T> =
  | { ok: true; plan: T }
  | { ok: false; errors: string[] };

/**
 * Models sometimes write "{{ fact_id }}" or upper-case ids. Normalise to "{{fact_id}}" so a valid
 * reference is not rejected (and the UI can render it).
 */
export function normalizePlaceholders(raw: string): string {
  return raw.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_m, id: string) => `{{${id.toLowerCase()}}}`);
}

/**
 * Models sometimes write a fact id without its braces ("act_a1_usual_window" instead of
 * "{{act_a1_usual_window}}"). When a bare word is exactly a known fact id, add the braces so the
 * answer is not rejected and the UI can show the real number.
 */
export function wrapBareFactIds(text: string, knownFactIds: ReadonlySet<string>): string {
  return text.replace(/\{\{[^}]*\}\}|\b[a-z][a-z0-9]*_[a-z0-9_]*\b/g, (token) =>
    !token.startsWith('{{') && knownFactIds.has(token) ? `{{${token}}}` : token,
  );
}

function repairPlanText(plan: AiPlanType, ids: ReadonlySet<string>): AiPlanType {
  const fix = (text: string): string => wrapBareFactIds(text, ids);
  return {
    ...plan,
    summary: fix(plan.summary),
    routine: plan.routine.map((r) => ({
      ...r,
      headline: fix(r.headline),
      why: fix(r.why),
      tradeoff: r.tradeoff === null ? null : fix(r.tradeoff),
    })),
    indoor: plan.indoor.map((a) => ({ ...a, headline: fix(a.headline), why: fix(a.why) })),
    community: plan.community.map((a) => ({ ...a, headline: fix(a.headline), why: fix(a.why) })),
    caveats: plan.caveats.map(fix),
  };
}

function repairExplanationText(
  explanation: AiIndoorExplanationType,
  ids: ReadonlySet<string>,
): AiIndoorExplanationType {
  const fix = (text: string): string => wrapBareFactIds(text, ids);
  return {
    ...explanation,
    summary: fix(explanation.summary),
    actions: explanation.actions.map((a) => ({ ...a, headline: fix(a.headline), why: fix(a.why) })),
    caveats: explanation.caveats.map(fix),
  };
}

const NUMBER_WORDS_REGEX =
  /\b(zero|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|crore|percent|half|double|twice|dozen)\b/i;

function checkStringForGrounding(
  text: string | null | undefined,
  fieldPath: string,
  knownFactIds: ReadonlySet<string>,
  errors: string[],
): void {
  if (!text) return;

  const placeholderRegex = /\{\{([a-z0-9_]+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = placeholderRegex.exec(text)) !== null) {
    const factId = match[1];
    if (factId && !knownFactIds.has(factId)) {
      errors.push(`UNKNOWN_FACT: {{${factId}}} in ${fieldPath}`);
    }
  }

  let stripped = text.replace(placeholderRegex, '');
  stripped = stripped.replace(/PM2\.5|PM10|N95|CO2|two-wheelers?/gi, '');

  if (/\p{Nd}/u.test(stripped)) {
    errors.push(`RAW_NUMBER: contains digits in ${fieldPath} ("${text}")`);
  }

  const wordMatch = NUMBER_WORDS_REGEX.exec(stripped);
  if (wordMatch) {
    errors.push(
      `RAW_NUMBER: contains number word "${wordMatch[0]}" in ${fieldPath} ("${text}")`,
    );
  }
}

function validateRoutine(
  routine: AiPlanType['routine'],
  candidateItemMap: Map<string, Set<string>>,
  knownFactIds: ReadonlySet<string>,
  errors: string[],
): void {
  const seenItems = new Set<string>();
  for (let idx = 0; idx < routine.length; idx++) {
    const item = routine[idx]!;
    if (seenItems.has(item.itemId)) {
      errors.push(`DUPLICATE_ITEM: ${item.itemId} appears multiple times in routine`);
    }
    seenItems.add(item.itemId);

    const validOptions = candidateItemMap.get(item.itemId);
    if (!validOptions) {
      errors.push(`UNKNOWN_ID: routine item "${item.itemId}" does not exist in candidates`);
    } else if (!validOptions.has(item.chosenOptionId)) {
      errors.push(
        `UNKNOWN_ID: option "${item.chosenOptionId}" does not belong to candidate item "${item.itemId}"`,
      );
    }

    checkStringForGrounding(item.headline, `routine[${idx}].headline`, knownFactIds, errors);
    checkStringForGrounding(item.why, `routine[${idx}].why`, knownFactIds, errors);
    checkStringForGrounding(item.tradeoff, `routine[${idx}].tradeoff`, knownFactIds, errors);
  }
}

function validateActionList(
  actions: readonly { actionId: string; headline: string; why: string }[],
  validActionIds: ReadonlySet<string>,
  groupName: string,
  knownFactIds: ReadonlySet<string>,
  errors: string[],
): void {
  const seen = new Set<string>();
  for (let idx = 0; idx < actions.length; idx++) {
    const item = actions[idx]!;
    if (seen.has(item.actionId)) {
      errors.push(`DUPLICATE_ITEM: ${groupName} action "${item.actionId}" appears multiple times`);
    }
    seen.add(item.actionId);

    if (!validActionIds.has(item.actionId)) {
      errors.push(`UNKNOWN_ID: ${groupName} action "${item.actionId}" does not exist in candidates`);
    }

    checkStringForGrounding(item.headline, `${groupName}[${idx}].headline`, knownFactIds, errors);
    checkStringForGrounding(item.why, `${groupName}[${idx}].why`, knownFactIds, errors);
  }
}

export function validatePlan(
  raw: string,
  facts: readonly Fact[],
  candidates: Candidates,
): ValidationResult<AiPlanType> {
  const errors: string[] = [];

  let json: unknown;
  try {
    json = JSON.parse(normalizePlaceholders(raw));
  } catch (err) {
    return {
      ok: false,
      errors: [`INVALID_JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const parsed = AiPlan.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `SCHEMA: ${i.path.join('.')} ${i.message}`),
    };
  }

  const knownFactIds = new Set(facts.map((f) => f.id));
  const plan = repairPlanText(parsed.data, knownFactIds);

  const candidateItemMap = new Map<string, Set<string>>();
  for (const act of candidates.activities) {
    candidateItemMap.set(act.itemId, new Set(act.options.map((o) => o.optionId)));
  }
  for (const com of candidates.commutes) {
    candidateItemMap.set(com.itemId, new Set(com.options.map((o) => o.optionId)));
  }

  validateRoutine(plan.routine, candidateItemMap, knownFactIds, errors);
  validateActionList(plan.indoor, new Set(candidates.indoor.map((a) => a.actionId)), 'indoor', knownFactIds, errors);
  validateActionList(plan.community, new Set(candidates.community.map((a) => a.actionId)), 'community', knownFactIds, errors);

  checkStringForGrounding(plan.summary, 'summary', knownFactIds, errors);
  plan.caveats.forEach((c, idx) => {
    checkStringForGrounding(c, `caveats[${idx}]`, knownFactIds, errors);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, plan };
}

export function validateIndoorExplanation(
  raw: string,
  facts: readonly Fact[],
  candidates: Candidates,
): ValidationResult<AiIndoorExplanationType> {
  const errors: string[] = [];

  let json: unknown;
  try {
    json = JSON.parse(normalizePlaceholders(raw));
  } catch (err) {
    return {
      ok: false,
      errors: [`INVALID_JSON: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const parsed = AiIndoorExplanation.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `SCHEMA: ${i.path.join('.')} ${i.message}`),
    };
  }

  const knownFactIds = new Set(facts.map((f) => f.id));
  const explanation = repairExplanationText(parsed.data, knownFactIds);
  validateActionList(
    explanation.actions,
    new Set(candidates.indoor.map((a) => a.actionId)),
    'actions',
    knownFactIds,
    errors,
  );

  checkStringForGrounding(explanation.summary, 'summary', knownFactIds, errors);
  explanation.caveats.forEach((c, idx) => {
    checkStringForGrounding(c, `caveats[${idx}]`, knownFactIds, errors);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, plan: explanation };
}
