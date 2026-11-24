import { useEffect, useState, type ReactElement } from 'react';
import { CITIES } from '../domain/data/cities.js';
import { CATEGORIES } from '../domain/data/naqiBreakpoints.js';
import type { AirReport, City, LocationRef } from '../shared/schemas.js';
import { getCities } from './api/client.js';
import { AqiCard } from './components/AqiCard.js';
import { ForecastChart } from './components/ForecastChart.js';
import { Layout } from './components/Layout.js';
import { LocationPicker, type GeolocationLike } from './components/LocationPicker.js';
import { PollutantTable } from './components/PollutantTable.js';
import { SourceBadge } from './components/SourceBadge.js';
import { ErrorState, LoadingSkeleton, WarningBanners } from './components/StatusViews.js';
import { useAir } from './hooks/useAir.js';
import { I18nProvider, useI18n } from './i18n/index.js';

export interface AppProps {
  readonly fetchAir?: (location: LocationRef) => Promise<AirReport>;
  readonly fetchCities?: () => Promise<City[]>;
  readonly clock?: () => number;
  readonly geolocation?: GeolocationLike;
}

const DEFAULT_CITIES: City[] = CITIES.map((c) => ({ ...c }));

function AirDashboard({ fetchAir, fetchCities, clock, geolocation }: AppProps): ReactElement {
  const { lang, t } = useI18n();
  const [cities, setCities] = useState<City[]>(DEFAULT_CITIES);
  const [location, setLocation] = useState<LocationRef>({ cityId: 'delhi' });

  useEffect(() => {
    let active = true;
    const loadCities = fetchCities ?? getCities;
    loadCities()
      .then((list) => {
        if (active && list.length > 0) {
          setCities(list);
        }
      })
      .catch(() => {
        // Keep built-in city list if /api/cities fails
      });
    return () => {
      active = false;
    };
  }, [fetchCities]);

  const air = useAir(location, { fetchAir, clock });

  const liveAnnouncement = (() => {
    if (air.status !== 'success' || !air.data) return '';
    const cityLabel = air.data.location.label;
    const catKey = air.data.naqi?.category;
    const catMeta = catKey ? CATEGORIES.find((c) => c.key === catKey) : undefined;
    const catText = catMeta
      ? lang === 'hi'
        ? catMeta.hiLabel
        : catMeta.enLabel
      : t.app.unavailableCategory;
    return `${t.app.liveUpdatePrefix} ${cityLabel}: ${catText}`;
  })();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
            {t.app.headline}
          </h1>
          <p className="text-ink-muted text-base leading-relaxed">{t.app.intro}</p>
        </div>

        <LocationPicker
          cities={cities}
          selected={location}
          onSelect={setLocation}
          geolocation={geolocation}
        />

        <div aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>

        {air.status === 'loading' && <LoadingSkeleton />}

        {air.status === 'error' && air.error && (
          <ErrorState message={air.error.message} onRetry={air.refresh} />
        )}

        {air.status === 'success' && air.data && (
          <div className="space-y-4">
            <WarningBanners warnings={air.data.warnings} />
            <SourceBadge report={air.data} clock={clock} />
            <AqiCard naqi={air.data.naqi} />
            <PollutantTable
              measured={air.data.measured}
              fetchedAtUtc={air.data.fetchedAtUtc}
            />
            <ForecastChart forecast={air.data.forecast} />
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function App(props: AppProps): ReactElement {
  return (
    <I18nProvider>
      <AirDashboard {...props} />
    </I18nProvider>
  );
}
