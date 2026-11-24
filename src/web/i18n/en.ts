export const en = {
  app: {
    name: 'ClearBreath',
    skipToContent: 'Skip to main content',
    headline: 'Cleaner-air decisions for your family',
    intro:
      'ClearBreath helps families in Indian cities make evidence-backed decisions to reduce air pollution exposure.',
    languageLabel: 'Language',
    switchToHindi: 'हिन्दी',
    switchToEnglish: 'English',
    liveUpdatePrefix: 'Air quality updated for',
    unavailableCategory: 'Data unavailable',
  },
  footer: {
    dataSourcesHeading: 'Data sources',
    openAqAttribution:
      'Live station measurements from OpenAQ v3, sourced from official monitoring networks including CPCB and state pollution control boards.',
    forecastAttribution:
      'Hourly 48-hour forecasts from Google Air Quality API with Open-Meteo (CAMS model) fallback.',
    aqiMethod: 'Indian National AQI (NAQI) computed using CPCB 2014 breakpoints.',
    howNumbersHeading: 'How the numbers are made',
    howNumbersNote:
      'All pollution concentrations, AQI values, and exposure estimates are fetched from public APIs or computed by deterministic formulas in code. Health guidance reflects general CPCB categories and is not medical advice.',
  },
  location: {
    label: 'Select city',
    ncrGroup: 'Delhi-NCR',
    otherCitiesGroup: 'Other Indian cities',
    useMyLocation: 'Use my location',
    locating: 'Locating…',
    customLocationLabel: 'Current GPS location',
    errors: {
      unsupported: 'Location detection is not supported in this browser.',
      denied: 'Location access was denied. Please select a city from the list instead.',
      unavailable: 'Your current location is unavailable. Please select a city.',
      timeout: 'Location request timed out. Please try again or choose a city.',
      outsideIndia:
        'Your detected coordinates are outside India. ClearBreath currently covers Indian cities only.',
    },
  },
  source: {
    measuredHeading: 'Measured air quality',
    providerLabel: 'Provider',
    stationLabel: 'Station',
    distanceUnit: 'km away',
    updatedPrefix: 'Updated',
    minAgoSuffix: 'min ago',
    justNow: 'just now',
    freshness: {
      fresh: 'Fresh (< 3 h)',
      stale: 'Stale (3–12 h)',
      unavailable: 'Unavailable',
    },
    forecastHeading: 'Forecast source',
    modelForecastTag: 'model forecast',
    uploadedHeading: 'Uploaded data',
    uploadedBanner: 'Uploaded — not live data',
    uploadedFileLabel: 'File',
  },
  aqi: {
    heading: 'Indian National AQI',
    basis24h: '24-hour average',
    basisIndicative: 'Indicative: latest hour',
    dominantLabel: 'Dominant pollutant',
    pm25Name: 'PM2.5',
    pm10Name: 'PM10',
    pmOnlyNote: 'Based on PM2.5 and PM10 only — indicative',
    unavailableTitle: 'AQI unavailable',
    unavailableNote: 'No recent station or uploaded particulate readings are available to compute AQI.',
  },
  pollutants: {
    heading: 'Particulate readings',
    caption: 'Latest and 24-hour average PM2.5 and PM10 concentrations in µg/m³',
    pollutantCol: 'Pollutant',
    latestCol: 'Latest',
    avg24hCol: '24-h average',
    unitCol: 'Unit',
    timeCol: 'Time (IST)',
    unitValue: 'µg/m³',
    notAvailable: '—',
    insufficient24h: 'Insufficient (< 16 h)',
  },
  forecast: {
    heading: '48-hour PM2.5 forecast',
    chartTitle: '48-hour hourly PM2.5 forecast bar chart coloured by CPCB AQI category',
    cleanestLabel: 'Cleanest expected',
    worstLabel: 'Worst expected',
    showTable: 'Show data table',
    tableCaption: 'Hourly PM2.5 and PM10 forecast for the next 48 hours',
    timeCol: 'Time (IST)',
    pm25Col: 'PM2.5 (µg/m³)',
    pm10Col: 'PM10 (µg/m³)',
    categoryCol: 'Category',
    unavailable: 'Forecast data is currently unavailable.',
    noValue: '—',
  },
  status: {
    loadingLabel: 'Loading air quality data…',
    retry: 'Retry',
    errorTitle: 'Could not load air quality data',
    warnings: {
      NO_STATION:
        'No active monitoring station was found within 25 km. Showing forecast data only where available.',
      STALE_STATION:
        'The nearest monitoring station has not reported in the last 3 hours. Readings may not reflect current conditions.',
      FORECAST_FALLBACK:
        'Primary forecast service was unavailable. Showing Open-Meteo (CAMS model) forecast instead.',
      FORECAST_UNAVAILABLE:
        '48-hour forecast is currently unavailable. Time-shifting recommendations are disabled.',
      INDICATIVE_AQI:
        'Fewer than 16 hourly readings were available for a 24-hour average. This AQI is indicative based on the latest hour.',
      UPLOADED_DATA:
        'You are viewing uploaded air quality data, not live measurements.',
      UNIT_MISMATCH:
        'Some forecast values used an unexpected unit and were excluded for accuracy.',
    },
  },
} as const;

export type Messages = {
  app: { [K in keyof typeof en.app]: string };
  footer: { [K in keyof typeof en.footer]: string };
  location: {
    label: string;
    ncrGroup: string;
    otherCitiesGroup: string;
    useMyLocation: string;
    locating: string;
    customLocationLabel: string;
    errors: { [K in keyof typeof en.location.errors]: string };
  };
  source: {
    measuredHeading: string;
    providerLabel: string;
    stationLabel: string;
    distanceUnit: string;
    updatedPrefix: string;
    minAgoSuffix: string;
    justNow: string;
    freshness: { [K in keyof typeof en.source.freshness]: string };
    forecastHeading: string;
    modelForecastTag: string;
    uploadedHeading: string;
    uploadedBanner: string;
    uploadedFileLabel: string;
  };
  aqi: { [K in keyof typeof en.aqi]: string };
  pollutants: { [K in keyof typeof en.pollutants]: string };
  forecast: { [K in keyof typeof en.forecast]: string };
  status: {
    loadingLabel: string;
    retry: string;
    errorTitle: string;
    warnings: { [K in keyof typeof en.status.warnings]: string };
  };
};
