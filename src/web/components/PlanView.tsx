import { useLayoutEffect, useRef, type ReactElement, type RefObject } from 'react';
import type { AiPlan, CommunityPlanItem, IndoorPlanItem, RoutinePlanItem } from '../../shared/aiSchemas.js';
import type { Candidates, Fact, HouseholdProfile, PlanResponse } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';
import { FactValue, GroundedText } from './GroundedText.js';
import { OriginBadge } from './OriginBadge.js';

export interface PlanViewProps {
  readonly response: PlanResponse;
  readonly profile: HouseholdProfile;
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
}

const PLACEHOLDER_SCAN_REGEX = /\{\{([a-z0-9_]+)\}\}/g;

function extractPlaceholderIds(texts: readonly (string | null | undefined)[]): string[] {
  const ids: string[] = [];
  for (const text of texts) {
    if (!text) continue;
    let match: RegExpExecArray | null;
    const regex = new RegExp(PLACEHOLDER_SCAN_REGEX.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) ids.push(match[1]);
    }
  }
  return ids;
}

function SeeNumbersDetails({ facts }: { readonly facts: readonly Fact[] }): ReactElement | null {
  const { t } = useI18n();
  if (facts.length === 0) return null;
  return (
    <details className="rounded-md border border-surface-2 bg-surface-2 p-2.5 text-xs">
      <summary className="cursor-pointer font-semibold text-accent min-h-8 flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        {t.plan.seeNumbers}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-surface text-ink-muted">
              <th className="py-1 pr-3 font-semibold">{t.plan.factLabelCol}</th>
              <th className="py-1 pr-3 font-semibold">{t.plan.factValueCol}</th>
              <th className="py-1 pr-3 font-semibold">{t.plan.factKindCol}</th>
              <th className="py-1 font-semibold">{t.plan.factProvenanceCol}</th>
            </tr>
          </thead>
          <tbody>
            {facts.map((f) => (
              <tr key={f.id} className="border-b border-surface last:border-b-0">
                <td className="py-1.5 pr-3 text-ink">{f.label}</td>
                <td className="py-1.5 pr-3 font-semibold text-ink">{f.display}</td>
                <td className="py-1.5 pr-3 text-ink-muted">{t.facts.kinds[f.kind]}</td>
                <td className="py-1.5 text-ink-muted">{f.provenance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function RoutineCard({
  item,
  candidates,
  factMap,
  allFacts,
}: {
  readonly item: RoutinePlanItem;
  readonly candidates: Candidates;
  readonly factMap: ReadonlyMap<string, Fact>;
  readonly allFacts: readonly Fact[];
}): ReactElement {
  const { t } = useI18n();
  const candidateItem =
    candidates.activities.find((a) => a.itemId === item.itemId) ??
    candidates.commutes.find((c) => c.itemId === item.itemId);
  const chosenOption = candidateItem?.options.find((o) => o.optionId === item.chosenOptionId);
  const optLabelFact = factMap.get(`opt_${item.chosenOptionId}_label`);
  const referencedIds = new Set<string>([
    ...(chosenOption?.factIds ?? []),
    ...extractPlaceholderIds([item.headline, item.why, item.tradeoff]),
  ]);
  const referencedFacts = Array.from(referencedIds)
    .map((id) => factMap.get(id))
    .filter((f): f is Fact => f !== undefined);

  return (
    <article className="rounded-lg border border-surface-2 bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {candidateItem?.label ?? item.itemId}
          </p>
          <h4 className="text-base font-bold text-ink">
            <GroundedText text={item.headline} facts={allFacts} />
          </h4>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-ink-muted bg-surface-2 text-xs font-semibold text-ink">
          {t.plan.priorityLabel}: {t.plan.priorities[item.priority]}
        </span>
      </div>
      <p className="text-sm text-ink">
        <span className="font-semibold text-ink-muted">{t.plan.chosenOptionLabel}: </span>
        {optLabelFact ? <FactValue fact={optLabelFact} /> : <span>{chosenOption?.label ?? item.chosenOptionId}</span>}
      </p>
      <p className="text-sm text-ink leading-relaxed">
        <GroundedText text={item.why} facts={allFacts} />
      </p>
      {item.tradeoff && (
        <p className="text-xs text-ink-muted">
          <span className="font-semibold">{t.plan.tradeoffLabel}: </span>
          <GroundedText text={item.tradeoff} facts={allFacts} />
        </p>
      )}
      <SeeNumbersDetails facts={referencedFacts} />
    </article>
  );
}

function computeVehicleKmAvoided(candidates: Candidates, plan: AiPlan, factMap: ReadonlyMap<string, Fact>): number {
  let total = 0;
  for (const com of candidates.commutes) {
    const chosenId =
      plan.routine.find((r) => r.itemId === com.itemId)?.chosenOptionId ??
      com.options.find((o) => o.recommended)?.optionId;
    if (!chosenId) continue;
    const mode = chosenId.replace(`${com.itemId}_`, '');
    const kmFact = factMap.get(`com_${com.itemId}_${mode}_vehicle_km_avoided_week`);
    if (kmFact && typeof kmFact.value === 'number') total += kmFact.value;
  }
  return total;
}

function ImpactLedger({
  profile,
  plan,
  candidates,
  factMap,
}: {
  readonly profile: HouseholdProfile;
  readonly plan: AiPlan;
  readonly candidates: Candidates;
  readonly factMap: ReadonlyMap<string, Fact>;
}): ReactElement {
  const { t } = useI18n();
  const co2Fact = factMap.get('led_household_co2_saved_week');
  const totalVehicleKmAvoided = computeVehicleKmAvoided(candidates, plan, factMap);

  return (
    <section aria-labelledby="ledger-heading" className="space-y-3">
      <h3 id="ledger-heading" className="text-lg font-bold text-ink">{t.plan.ledgerHeading}</h3>
      <div className="overflow-x-auto rounded-lg border border-surface-2 bg-surface">
        <table className="w-full text-left border-collapse text-sm">
          <caption className="px-4 py-2 text-left text-xs text-ink-muted bg-surface-2 border-b border-surface-2">
            {t.plan.ledgerCaption}
          </caption>
          <thead>
            <tr className="border-b border-surface-2 text-xs text-ink-muted bg-surface-2">
              <th scope="col" className="py-2 px-4 font-semibold">{t.plan.ledgerMemberCol}</th>
              <th scope="col" className="py-2 px-4 font-semibold">{t.plan.ledgerUsualCol}</th>
              <th scope="col" className="py-2 px-4 font-semibold">{t.plan.ledgerPlanCol}</th>
              <th scope="col" className="py-2 px-4 font-semibold">{t.plan.ledgerChangeCol}</th>
            </tr>
          </thead>
          <tbody>
            {profile.members.map((m) => {
              const usualFact = factMap.get(`led_${m.id}_usual`);
              const planFact = factMap.get(`led_${m.id}_plan`);
              const changeFact = factMap.get(`led_${m.id}_change`);
              return (
                <tr key={m.id} className="border-b border-surface-2 last:border-b-0">
                  <td className="py-2.5 px-4 font-medium text-ink">{m.label} ({t.household.ageGroups[m.ageGroup]})</td>
                  <td className="py-2.5 px-4 text-ink">{usualFact ? <FactValue fact={usualFact} /> : t.facts.unknownValue}</td>
                  <td className="py-2.5 px-4 text-ink">{planFact ? <FactValue fact={planFact} /> : t.facts.unknownValue}</td>
                  <td className="py-2.5 px-4 text-ink">{changeFact ? <FactValue fact={changeFact} /> : t.facts.unknownValue}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-ink">
        {co2Fact && <p><span className="font-semibold text-ink-muted">{t.plan.ledgerCo2SavedLabel}: </span><FactValue fact={co2Fact} /></p>}
        <p><span className="font-semibold text-ink-muted">{t.plan.ledgerVehicleKmLabel}: </span><span className="font-semibold">{Math.round(totalVehicleKmAvoided)} km</span></p>
      </div>
      <p className="text-xs text-ink-muted">{t.plan.ledgerHoursNote}</p>
    </section>
  );
}

function IndoorSection({
  items,
  candidates,
  facts,
}: {
  readonly items: readonly IndoorPlanItem[];
  readonly candidates: Candidates['indoor'];
  readonly facts: readonly Fact[];
}): ReactElement {
  const { t } = useI18n();
  return (
    <section aria-labelledby="indoor-heading" className="space-y-3">
      <h3 id="indoor-heading" className="text-lg font-bold text-ink">{t.plan.indoorHeading}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.plan.noIndoor}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((act) => {
            const cost = candidates.find((c) => c.actionId === act.actionId)?.cost ?? 'free';
            return (
              <article key={act.actionId} className="rounded-lg border border-surface-2 bg-surface p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-ink"><GroundedText text={act.headline} facts={facts} /></h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-ink-muted bg-surface-2 text-xs font-semibold text-ink">
                    {t.plan.costTiers[cost]}
                  </span>
                </div>
                <p className="text-xs text-ink leading-relaxed"><GroundedText text={act.why} facts={facts} /></p>
                <p className="text-xs text-ink-muted font-semibold">{t.plan.priorityLabel}: {t.plan.priorities[act.priority]}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CommunitySection({
  items,
  facts,
}: {
  readonly items: readonly CommunityPlanItem[];
  readonly facts: readonly Fact[];
}): ReactElement {
  const { t } = useI18n();
  return (
    <section aria-labelledby="community-heading" className="space-y-3">
      <h3 id="community-heading" className="text-lg font-bold text-ink">{t.plan.communityHeading}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{t.plan.noCommunity}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {items.slice(0, 3).map((act) => (
            <article key={act.actionId} className="rounded-lg border border-surface-2 bg-surface p-4 space-y-1.5">
              <h4 className="text-sm font-bold text-ink"><GroundedText text={act.headline} facts={facts} /></h4>
              <p className="text-xs text-ink leading-relaxed"><GroundedText text={act.why} facts={facts} /></p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PlanView({ response, profile, headingRef }: PlanViewProps): ReactElement {
  const { t } = useI18n();
  const plan = response.plan as AiPlan;
  const facts = response.facts;
  const factMap = new Map<string, Fact>(facts.map((f) => [f.id, f]));
  const internalRef = useRef<HTMLHeadingElement | null>(null);
  const targetRef = headingRef ?? internalRef;

  useLayoutEffect(() => {
    targetRef.current?.focus();
  }, [response, targetRef]);

  return (
    <section aria-labelledby="plan-heading" className="rounded-lg border border-surface-2 bg-surface-2 p-4 sm:p-6 space-y-6">
      <div className="rounded-lg border border-surface-2 bg-surface p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="plan-heading" ref={targetRef} tabIndex={-1} className="text-xl font-bold text-ink">
            {t.plan.heading}
          </h2>
          <OriginBadge meta={response.meta} />
        </div>
        <p className="text-base text-ink leading-relaxed"><GroundedText text={plan.summary} facts={facts} /></p>
      </div>
      <section aria-labelledby="routine-heading" className="space-y-3">
        <h3 id="routine-heading" className="text-lg font-bold text-ink">{t.plan.routineHeading}</h3>
        {plan.routine.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.plan.noRoutine}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {plan.routine.map((item) => (
              <RoutineCard key={item.itemId} item={item} candidates={response.candidates} factMap={factMap} allFacts={facts} />
            ))}
          </div>
        )}
      </section>
      <ImpactLedger profile={profile} plan={plan} candidates={response.candidates} factMap={factMap} />
      <IndoorSection items={plan.indoor} candidates={response.candidates.indoor} facts={facts} />
      <CommunitySection items={plan.community} facts={facts} />
      {plan.caveats.length > 0 && (
        <section aria-labelledby="caveats-heading" className="space-y-2">
          <h3 id="caveats-heading" className="text-base font-bold text-ink">{t.plan.caveatsHeading}</h3>
          <ul className="list-disc pl-5 space-y-1 text-xs text-ink-muted">
            {plan.caveats.map((cav, idx) => (
              <li key={idx}><GroundedText text={cav} facts={facts} /></li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
