import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from 'react';
import { CITIES } from '../domain/data/cities.js';
import { CATEGORIES } from '../domain/data/naqiBreakpoints.js';
import { HOUSEHOLD_PRESETS } from '../domain/data/presets.js';
import { buildUploadedAirReport } from '../domain/uploadedAir.js';
import type {
  AirReport,
  City,
  HouseholdProfile,
  IaqExplainRequest,
  IaqExplainResponse,
  Language,
  LocationRef,
  PlanRequest,
  PlanResponse,
  UploadedSeries,
} from '../shared/schemas.js';
import { getCities, type ApiErrorPayload } from './api/client.js';
import { AqiCard } from './components/AqiCard.js';
import { ForecastChart } from './components/ForecastChart.js';
import { HouseholdPanel } from './components/HouseholdPanel.js';
import { Layout } from './components/Layout.js';
import { LocationPicker, type GeolocationLike } from './components/LocationPicker.js';
import { PollutantTable } from './components/PollutantTable.js';
import { SourceBadge } from './components/SourceBadge.js';
import { ErrorState, LoadingSkeleton, WarningBanners } from './components/StatusViews.js';
import { useAir, type UseAirStatus } from './hooks/useAir.js';
import { usePlan } from './hooks/usePlan.js';
import { I18nProvider, useI18n } from './i18n/index.js';

const PlanView = lazy(() => import('./components/PlanView.js'));
const IndoorSimulator = lazy(() => import('./components/IndoorSimulator.js'));

export interface AppProps {
  readonly fetchAir?: (location: LocationRef) => Promise<AirReport>;
  readonly fetchCities?: () => Promise<City[]>;
  readonly postPlan?: (body: PlanRequest) => Promise<PlanResponse>;
  readonly postIaqExplain?: (body: IaqExplainRequest) => Promise<IaqExplainResponse>;
  readonly clock?: () => number;
  readonly geolocation?: GeolocationLike;
}

const DEFAULT_CITIES: City[] = CITIES.map((c) => ({ ...c }));
const DEFAULT_PROFILE: HouseholdProfile = JSON.parse(
  JSON.stringify(HOUSEHOLD_PRESETS[0]),
) as HouseholdProfile;

function resolveLocationMeta(
  location: LocationRef,
  cities: readonly City[],
  customLabel: string,
): { label: string; lat: number; lon: number; cityId?: string } {
  if ('cityId' in location) {
    const city = cities.find((c) => c.id === location.cityId);
    return city
      ? { label: city.name, lat: city.lat, lon: city.lon, cityId: city.id }
      : { label: location.cityId, lat: 28.6139, lon: 77.209, cityId: location.cityId };
  }
  return { label: customLabel, lat: location.lat, lon: location.lon };
}

function getLiveAnnouncement(
  displayedAir: AirReport | null,
  lang: Language,
  liveUpdatePrefix: string,
  unavailableCategory: string,
): string {
  if (!displayedAir) return '';
  const catKey = displayedAir.naqi?.category;
  const catMeta = catKey ? CATEGORIES.find((c) => c.key === catKey) : undefined;
  const catText = catMeta
    ? lang === 'hi'
      ? catMeta.hiLabel
      : catMeta.enLabel
    : unavailableCategory;
  return `${liveUpdatePrefix} ${displayedAir.location.label}: ${catText}`;
}

function AirPanelSection({
  isUploaded,
  airStatus,
  airError,
  onRetry,
  displayedAir,
  clock,
}: {
  readonly isUploaded: boolean;
  readonly airStatus: UseAirStatus;
  readonly airError: ApiErrorPayload | null;
  readonly onRetry: () => void;
  readonly displayedAir: AirReport | null;
  readonly clock?: () => number;
}): ReactElement {
  return (
    <>
      {!isUploaded && airStatus === 'loading' && <LoadingSkeleton />}
      {!isUploaded && airStatus === 'error' && airError && (
        <ErrorState message={airError.message} onRetry={onRetry} />
      )}
      {displayedAir && (
        <div className="space-y-4">
          <WarningBanners warnings={displayedAir.warnings} />
          <SourceBadge report={displayedAir} clock={clock} />
          <AqiCard naqi={displayedAir.naqi} />
          <PollutantTable
            measured={displayedAir.measured}
            fetchedAtUtc={displayedAir.fetchedAtUtc}
          />
          <ForecastChart forecast={displayedAir.forecast} />
        </div>
      )}
    </>
  );
}

function PlanSection({
  plan,
  profile,
  planHeadingRef,
}: {
  readonly plan: ReturnType<typeof usePlan>;
  readonly profile: HouseholdProfile;
  readonly planHeadingRef: RefObject<HTMLHeadingElement | null>;
}): ReactElement {
  const { t } = useI18n();
  return (
    <>
      {plan.status === 'error' && plan.error && (
        <div role="alert" className="rounded-lg border border-danger bg-surface p-4 space-y-1">
          <h2 className="text-base font-bold text-danger">{t.plan.errorTitle}</h2>
          <p className="text-sm text-ink">{plan.error}</p>
        </div>
      )}
      {plan.status === 'success' && plan.data && (
        <Suspense fallback={<p className="text-sm text-ink-muted">{t.plan.loadingLabel}</p>}>
          <PlanView response={plan.data} profile={profile} headingRef={planHeadingRef} />
        </Suspense>
      )}
    </>
  );
}

function AirDashboardContent({
  fetchAir,
  fetchCities,
  postPlan,
  postIaqExplain,
  clock,
  geolocation,
}: AppProps): ReactElement {
  const { lang, t } = useI18n();
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES);
  const [location, setLocation] = useState<LocationRef>({ cityId: 'delhi' });
  const [profile, setProfile] = useState<HouseholdProfile>(DEFAULT_PROFILE);
  const [uploadedAir, setUploadedAir] = useState<UploadedSeries | null>(null);
  const [uploadedAtIso, setUploadedAtIso] = useState<string>('');
  const planHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    let active = true;
    const loadCities = fetchCities ?? getCities;
    loadCities()
      .then((list) => {
        if (active && list.length > 0) setCities(list);
      })
      .catch(() => { });
    return () => { active = false; };
  }, [fetchCities]);

  const air = useAir(location, { fetchAir, clock });
  const plan = usePlan({ postPlan });

  const uploadedAirReport = useMemo(() => {
    if (!uploadedAir) return null;
    const locMeta = resolveLocationMeta(location, cities, t.location.customLocationLabel);
    return buildUploadedAirReport(uploadedAir, locMeta, uploadedAtIso || new Date().toISOString());
  }, [uploadedAir, uploadedAtIso, location, cities, t.location.customLocationLabel]);

  const displayedAir = uploadedAirReport ?? (air.status === 'success' ? air.data : null);
  const liveAnnouncement = getLiveAnnouncement(
    displayedAir, lang, t.app.liveUpdatePrefix, t.app.unavailableCategory,
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">{t.app.headline}</h1>
          <p className="text-ink-muted text-base leading-relaxed">{t.app.intro}</p>
        </div>
        <LocationPicker cities={cities} selected={location} onSelect={setLocation} geolocation={geolocation} />
        <div aria-live="polite" className="sr-only">{liveAnnouncement}</div>
        <AirPanelSection
          isUploaded={uploadedAirReport !== null} airStatus={air.status}
          airError={air.error} onRetry={air.refresh} displayedAir={displayedAir} clock={clock}
        />
        <HouseholdPanel
          profile={profile} onChange={setProfile}
          onSelectPreset={(preset) => { setProfile(preset); if (preset.cityId) setLocation({ cityId: preset.cityId }); }}
          uploadedAir={uploadedAir}
          onUploadedAir={(series) => { setUploadedAir(series); setUploadedAtIso(series ? new Date((clock ?? Date.now)()).toISOString() : ''); }}
        />
        <div>
          <button
            type="button" disabled={plan.status === 'loading'} aria-busy={plan.status === 'loading'}
            onClick={() => void plan.postPlan(profile, location, uploadedAir ?? undefined, lang)}
            className="min-h-11 px-6 py-3 rounded-md bg-accent text-surface text-base font-bold hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {plan.status === 'loading' ? t.household.buildingPlanButton : t.household.buildPlanButton}
          </button>
        </div>
        <PlanSection plan={plan} profile={profile} planHeadingRef={planHeadingRef} />
        <Suspense fallback={<p className="text-sm text-ink-muted">{t.indoor.loadingLabel}</p>}>
          <IndoorSimulator
            profile={profile}
            location={location}
            air={displayedAir}
            upload={uploadedAir}
            postIaqExplain={postIaqExplain}
          />
        </Suspense>
      </div>
    </Layout>
  );
}

export default function App(props: AppProps): ReactElement {
  return (
    <I18nProvider>
      <AirDashboardContent {...props} />
    </I18nProvider>
  );
}
