import { useId, useState, type ChangeEvent, type ReactElement } from 'react';
import { MapPin } from 'lucide-react';
import type { City, LocationRef } from '../../shared/schemas.js';
import { useI18n } from '../i18n/index.js';

// India bounding box per ARCHITECTURE §5.4
const LAT_MIN = 6;
const LAT_MAX = 37.5;
const LON_MIN = 68;
const LON_MAX = 97.5;
const GEO_TIMEOUT_MS = 10_000;
const CUSTOM_VALUE = '__custom__';

function isInIndia(lat: number, lon: number): boolean {
  return lat >= LAT_MIN && lat <= LAT_MAX && lon >= LON_MIN && lon <= LON_MAX;
}

export interface GeolocationLike {
  getCurrentPosition: (
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) => void;
}

export interface LocationPickerProps {
  readonly cities: readonly City[];
  readonly selected: LocationRef;
  readonly onSelect: (location: LocationRef) => void;
  readonly geolocation?: GeolocationLike;
}

function resolveGeoErrorKey(
  code: number,
): 'denied' | 'unavailable' | 'timeout' {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

function CitySelectField({
  cities,
  selectId,
  selectValue,
  errorId,
  hasError,
  onChange,
}: {
  readonly cities: readonly City[];
  readonly selectId: string;
  readonly selectValue: string;
  readonly errorId: string;
  readonly hasError: boolean;
  readonly onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
}): ReactElement {
  const { t } = useI18n();
  const ncrCities = cities.filter((c) => c.ncr);
  const otherCities = cities.filter((c) => !c.ncr);

  return (
    <div className="flex-1">
      <label htmlFor={selectId} className="block text-sm font-semibold text-ink mb-1.5">
        {t.location.label}
      </label>
      <select
        id={selectId}
        value={selectValue}
        onChange={onChange}
        aria-describedby={hasError ? errorId : undefined}
        aria-invalid={hasError ? 'true' : undefined}
        className="w-full min-h-11 px-3 py-2 rounded-md border border-ink-muted bg-surface text-ink text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {selectValue === CUSTOM_VALUE && (
          <option value={CUSTOM_VALUE}>{t.location.customLocationLabel}</option>
        )}
        {ncrCities.length > 0 && (
          <optgroup label={t.location.ncrGroup}>
            {ncrCities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}, {city.state}
              </option>
            ))}
          </optgroup>
        )}
        {otherCities.length > 0 && (
          <optgroup label={t.location.otherCitiesGroup}>
            {otherCities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}, {city.state}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}

export function LocationPicker({
  cities,
  selected,
  onSelect,
  geolocation,
}: LocationPickerProps): ReactElement {
  const { t } = useI18n();
  const selectId = useId();
  const errorId = useId();
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const selectValue = 'cityId' in selected ? selected.cityId : CUSTOM_VALUE;

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value;
    if (value && value !== CUSTOM_VALUE) {
      setGeoError(null);
      onSelect({ cityId: value });
    }
  };

  const handleUseLocation = (): void => {
    const geo =
      geolocation ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);

    if (!geo) {
      setGeoError(t.location.errors.unsupported);
      return;
    }

    setLocating(true);
    setGeoError(null);

    geo.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (!isInIndia(latitude, longitude)) {
          setGeoError(t.location.errors.outsideIndia);
          return;
        }
        onSelect({ lat: latitude, lon: longitude });
      },
      (err) => {
        setLocating(false);
        setGeoError(t.location.errors[resolveGeoErrorKey(err.code)]);
      },
      { timeout: GEO_TIMEOUT_MS, enableHighAccuracy: false, maximumAge: 60_000 },
    );
  };

  return (
    <div className="bg-surface-2 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <CitySelectField
          cities={cities}
          selectId={selectId}
          selectValue={selectValue}
          errorId={errorId}
          hasError={Boolean(geoError)}
          onChange={handleSelectChange}
        />
        <button
          type="button"
          onClick={handleUseLocation}
          disabled={locating}
          className="min-h-11 px-4 py-2 rounded-md bg-accent text-surface font-semibold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <MapPin className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{locating ? t.location.locating : t.location.useMyLocation}</span>
        </button>
      </div>
      {geoError && (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger font-medium">
          {geoError}
        </p>
      )}
    </div>
  );
}
