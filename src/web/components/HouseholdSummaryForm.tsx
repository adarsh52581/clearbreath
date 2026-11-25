import type { ReactElement } from 'react';
import type {
  Activity,
  Commute,
  CookingFuel,
  Home,
  HouseholdProfile,
  Member,
  Mode,
  Sensitivity,
  WindowState,
} from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

const AGE_GROUPS: readonly Member['ageGroup'][] = ['toddler', 'child', 'teen', 'adult', 'older_adult'];
const SENSITIVITIES: readonly Sensitivity[] = ['asthma', 'copd', 'heart', 'pregnant'];
const WINDOW_STATES: readonly WindowState[] = ['sealed', 'closed', 'partly_open', 'open'];
const COOKING_FUELS: readonly CookingFuel[] = ['lpg', 'png', 'induction', 'biomass', 'kerosene'];
const MODES: readonly Mode[] = ['walk', 'cycle', 'two_wheeler', 'auto', 'car', 'cab', 'bus', 'metro'];

const inputCls =
  'w-full min-h-11 rounded-md border border-ink-muted bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';
const checkboxCls =
  'h-5 w-5 rounded border-ink-muted text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

export interface HouseholdSummaryFormProps {
  readonly profile: HouseholdProfile;
  readonly onChange: (next: HouseholdProfile) => void;
}

function RangeErrorMsg({
  id,
  value,
  min,
  max,
}: {
  readonly id: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
}): ReactElement | null {
  const { t } = useI18n();
  if (Number.isFinite(value) && value >= min && value <= max) return null;
  return (
    <p id={id} className="text-xs text-danger mt-1">
      {t.household.validation.rangePrefix} {min} {t.household.validation.andWord} {max}.
    </p>
  );
}

function MemberRow({
  member,
  onPatch,
  onToggleSensitivity,
}: {
  readonly member: Member;
  readonly onPatch: (patch: Partial<Member>) => void;
  readonly onToggleSensitivity: (s: Sensitivity) => void;
}): ReactElement {
  const { t } = useI18n();
  const labelInvalid = member.label.trim().length === 0;
  const labelErrId = `member-label-err-${member.id}`;
  return (
    <div className="rounded-md border border-surface-2 bg-surface p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor={`member-label-${member.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
            {t.household.memberLabel}
          </label>
          <input
            id={`member-label-${member.id}`}
            type="text"
            maxLength={24}
            value={member.label}
            aria-invalid={labelInvalid || undefined}
            aria-describedby={labelInvalid ? labelErrId : undefined}
            onChange={(e) => onPatch({ label: e.target.value })}
            className={inputCls}
          />
          {labelInvalid && <p id={labelErrId} className="text-xs text-danger mt-1">{t.household.validation.required}</p>}
        </div>
        <div>
          <label htmlFor={`member-age-${member.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
            {t.household.ageGroupLabel}
          </label>
          <select
            id={`member-age-${member.id}`}
            value={member.ageGroup}
            onChange={(e) => onPatch({ ageGroup: e.target.value as Member['ageGroup'] })}
            className={inputCls}
          >
            {AGE_GROUPS.map((ag) => (
              <option key={ag} value={ag}>{t.household.ageGroups[ag]}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 pt-1" aria-label={t.household.sensitivitiesLabel}>
        {SENSITIVITIES.map((s) => (
          <label key={s} className="inline-flex items-center gap-2 text-xs text-ink min-h-11">
            <input
              type="checkbox"
              checked={member.sensitivities.includes(s)}
              onChange={() => onToggleSensitivity(s)}
              className={checkboxCls}
            />
            <span>{t.household.sensitivities[s]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  onPatch,
}: {
  readonly activity: Activity;
  readonly onPatch: (patch: Partial<Activity>) => void;
}): ReactElement {
  const { t } = useI18n();
  const hourInvalid = !Number.isFinite(activity.usualStartHour) || activity.usualStartHour < 0 || activity.usualStartHour > 23;
  const durInvalid = !Number.isFinite(activity.durationMin) || activity.durationMin < 10 || activity.durationMin > 240;
  return (
    <div className="rounded-md border border-surface-2 bg-surface p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label htmlFor={`act-label-${activity.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
          {t.household.activityLabel}
        </label>
        <input
          id={`act-label-${activity.id}`}
          type="text"
          maxLength={40}
          value={activity.label}
          aria-invalid={activity.label.trim().length === 0 || undefined}
          onChange={(e) => onPatch({ label: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`act-hour-${activity.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
          {t.household.usualHourLabel}
        </label>
        <input
          id={`act-hour-${activity.id}`}
          type="number"
          min={0}
          max={23}
          value={activity.usualStartHour}
          aria-invalid={hourInvalid || undefined}
          aria-describedby={hourInvalid ? `act-hour-err-${activity.id}` : undefined}
          onChange={(e) => onPatch({ usualStartHour: Number(e.target.value) })}
          className={inputCls}
        />
        <RangeErrorMsg id={`act-hour-err-${activity.id}`} value={activity.usualStartHour} min={0} max={23} />
      </div>
      <div>
        <label htmlFor={`act-dur-${activity.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
          {t.household.durationMinLabel}
        </label>
        <input
          id={`act-dur-${activity.id}`}
          type="number"
          min={10}
          max={240}
          value={activity.durationMin}
          aria-invalid={durInvalid || undefined}
          aria-describedby={durInvalid ? `act-dur-err-${activity.id}` : undefined}
          onChange={(e) => onPatch({ durationMin: Number(e.target.value) })}
          className={inputCls}
        />
        <RangeErrorMsg id={`act-dur-err-${activity.id}`} value={activity.durationMin} min={10} max={240} />
      </div>
    </div>
  );
}

function CommuteRow({
  commute,
  onPatch,
}: {
  readonly commute: Commute;
  readonly onPatch: (patch: Partial<Commute>) => void;
}): ReactElement {
  const { t } = useI18n();
  const distInvalid = !Number.isFinite(commute.distanceKm) || commute.distanceKm < 0.5 || commute.distanceKm > 60;
  return (
    <div className="rounded-md border border-surface-2 bg-surface p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <label htmlFor={`com-label-${commute.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
          {t.household.commuteLabel}
        </label>
        <input
          id={`com-label-${commute.id}`}
          type="text"
          maxLength={40}
          value={commute.label}
          onChange={(e) => onPatch({ label: e.target.value })}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor={`com-dist-${commute.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
          {t.household.distanceKmLabel}
        </label>
        <input
          id={`com-dist-${commute.id}`}
          type="number"
          min={0.5}
          max={60}
          step={0.5}
          value={commute.distanceKm}
          aria-invalid={distInvalid || undefined}
          aria-describedby={distInvalid ? `com-dist-err-${commute.id}` : undefined}
          onChange={(e) => onPatch({ distanceKm: Number(e.target.value) })}
          className={inputCls}
        />
        <RangeErrorMsg id={`com-dist-err-${commute.id}`} value={commute.distanceKm} min={0.5} max={60} />
      </div>
      <div>
        <label htmlFor={`com-mode-${commute.id}`} className="block text-xs font-semibold text-ink-muted mb-1">
          {t.household.currentModeLabel}
        </label>
        <select
          id={`com-mode-${commute.id}`}
          value={commute.currentMode}
          onChange={(e) => {
            const mode = e.target.value as Mode;
            const allowed = commute.allowedModes.includes(mode) ? commute.allowedModes : [...commute.allowedModes, mode];
            onPatch({ currentMode: mode, allowedModes: allowed });
          }}
          className={inputCls}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>{t.household.modes[m]}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function HomeToggles({
  home,
  onPatch,
}: {
  readonly home: Home;
  readonly onPatch: (patch: Partial<Home>) => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <label className="inline-flex items-center gap-2 text-xs text-ink min-h-11">
        <input
          type="checkbox"
          checked={home.purifier.present}
          onChange={(e) =>
            onPatch({ purifier: { present: e.target.checked, cadrM3h: e.target.checked ? Math.max(150, home.purifier.cadrM3h) : 0 } })
          }
          className={checkboxCls}
        />
        <span>{t.household.purifierPresentLabel}</span>
      </label>
      {home.purifier.present && (
        <div className="w-40">
          <label htmlFor="home-cadr" className="block text-xs font-semibold text-ink-muted mb-1">
            {t.household.purifierCadrLabel}
          </label>
          <input
            id="home-cadr"
            type="number"
            min={0}
            max={1500}
            value={home.purifier.cadrM3h}
            onChange={(e) => onPatch({ purifier: { present: true, cadrM3h: Number(e.target.value) } })}
            className={inputCls}
          />
        </div>
      )}
      <label className="inline-flex items-center gap-2 text-xs text-ink min-h-11">
        <input type="checkbox" checked={home.kitchenExhaust} onChange={(e) => onPatch({ kitchenExhaust: e.target.checked })} className={checkboxCls} />
        <span>{t.household.kitchenExhaustLabel}</span>
      </label>
      <label className="inline-flex items-center gap-2 text-xs text-ink min-h-11">
        <input type="checkbox" checked={home.incense} onChange={(e) => onPatch({ incense: e.target.checked })} className={checkboxCls} />
        <span>{t.household.incenseLabel}</span>
      </label>
      <label className="inline-flex items-center gap-2 text-xs text-ink min-h-11">
        <input type="checkbox" checked={home.mosquitoCoil} onChange={(e) => onPatch({ mosquitoCoil: e.target.checked })} className={checkboxCls} />
        <span>{t.household.mosquitoCoilLabel}</span>
      </label>
    </div>
  );
}

function HomeSection({
  home,
  onUpdate,
}: {
  readonly home: Home;
  readonly onUpdate: (next: Home) => void;
}): ReactElement {
  const { t } = useI18n();
  const patch = (p: Partial<Home>) => onUpdate({ ...home, ...p });
  const areaInvalid = !Number.isFinite(home.roomAreaM2) || home.roomAreaM2 < 6 || home.roomAreaM2 > 80;
  const hoursInvalid = !Number.isFinite(home.hoursIndoorsPerDay) || home.hoursIndoorsPerDay < 0 || home.hoursIndoorsPerDay > 24;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold text-ink">{t.household.homeHeading}</legend>
      <div className="rounded-md border border-surface-2 bg-surface p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="home-area" className="block text-xs font-semibold text-ink-muted mb-1">{t.household.roomAreaLabel}</label>
            <input id="home-area" type="number" min={6} max={80} value={home.roomAreaM2} aria-invalid={areaInvalid || undefined} aria-describedby={areaInvalid ? 'home-area-err' : undefined} onChange={(e) => patch({ roomAreaM2: Number(e.target.value) })} className={inputCls} />
            <RangeErrorMsg id="home-area-err" value={home.roomAreaM2} min={6} max={80} />
          </div>
          <div>
            <label htmlFor="home-windows" className="block text-xs font-semibold text-ink-muted mb-1">{t.household.windowStateLabel}</label>
            <select id="home-windows" value={home.windowState} onChange={(e) => patch({ windowState: e.target.value as WindowState })} className={inputCls}>
              {WINDOW_STATES.map((ws) => <option key={ws} value={ws}>{t.household.windowStates[ws]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="home-cooking" className="block text-xs font-semibold text-ink-muted mb-1">{t.household.cookingFuelLabel}</label>
            <select id="home-cooking" value={home.cookingFuel} onChange={(e) => patch({ cookingFuel: e.target.value as CookingFuel })} className={inputCls}>
              {COOKING_FUELS.map((cf) => <option key={cf} value={cf}>{t.household.cookingFuels[cf]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="home-hours" className="block text-xs font-semibold text-ink-muted mb-1">{t.household.hoursIndoorsLabel}</label>
            <input id="home-hours" type="number" min={0} max={24} value={home.hoursIndoorsPerDay} aria-invalid={hoursInvalid || undefined} aria-describedby={hoursInvalid ? 'home-hours-err' : undefined} onChange={(e) => patch({ hoursIndoorsPerDay: Number(e.target.value) })} className={inputCls} />
            <RangeErrorMsg id="home-hours-err" value={home.hoursIndoorsPerDay} min={0} max={24} />
          </div>
        </div>
        <HomeToggles home={home} onPatch={patch} />
      </div>
    </fieldset>
  );
}

export function HouseholdSummaryForm({ profile, onChange }: HouseholdSummaryFormProps): ReactElement {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-ink">{t.household.summaryHeading}</h3>
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-ink">{t.household.membersHeading}</legend>
        {profile.members.map((m, idx) => (
          <MemberRow
            key={m.id}
            member={m}
            onPatch={(patch) => onChange({ ...profile, members: profile.members.map((x, i) => (i === idx ? { ...x, ...patch } : x)) })}
            onToggleSensitivity={(s) => {
              const nextSens = m.sensitivities.includes(s) ? m.sensitivities.filter((x) => x !== s) : [...m.sensitivities, s];
              onChange({ ...profile, members: profile.members.map((x, i) => (i === idx ? { ...x, sensitivities: nextSens } : x)) });
            }}
          />
        ))}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-ink">{t.household.activitiesHeading}</legend>
        {profile.activities.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.household.noActivities}</p>
        ) : (
          profile.activities.map((a, idx) => (
            <ActivityRow key={a.id} activity={a} onPatch={(patch) => onChange({ ...profile, activities: profile.activities.map((x, i) => (i === idx ? { ...x, ...patch } : x)) })} />
          ))
        )}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-ink">{t.household.commutesHeading}</legend>
        {profile.commutes.length === 0 ? (
          <p className="text-sm text-ink-muted">{t.household.noCommutes}</p>
        ) : (
          profile.commutes.map((c, idx) => (
            <CommuteRow key={c.id} commute={c} onPatch={(patch) => onChange({ ...profile, commutes: profile.commutes.map((x, i) => (i === idx ? { ...x, ...patch } : x)) })} />
          ))
        )}
      </fieldset>
      <HomeSection home={profile.home} onUpdate={(home) => onChange({ ...profile, home })} />
    </div>
  );
}
