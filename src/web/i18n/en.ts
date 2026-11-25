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
  facts: {
    kinds: {
      measured: 'Measured',
      forecast: 'Forecast (model)',
      computed: 'Computed',
      reference: 'Reference',
      assumption: 'Assumption',
      guidance: 'Guidance',
      uploaded: 'Uploaded',
    },
    unknownValue: '—',
  },
  household: {
    heading: 'Your household',
    presetsHeading: 'Choose a sample household',
    selectPreset: 'Select',
    selectedPreset: 'Selected',
    summaryHeading: 'Household details',
    membersHeading: 'Family members',
    memberLabel: 'Member label',
    ageGroupLabel: 'Age group',
    sensitivitiesLabel: 'Health sensitivities',
    ageGroups: {
      toddler: 'Toddler',
      child: 'Child',
      teen: 'Teen',
      adult: 'Adult',
      older_adult: 'Older adult',
    },
    sensitivities: {
      asthma: 'Asthma',
      copd: 'COPD',
      heart: 'Heart disease',
      pregnant: 'Pregnant',
    },
    activitiesHeading: 'Daily outdoor activities',
    activityLabel: 'Activity',
    usualHourLabel: 'Usual start hour (0–23)',
    durationMinLabel: 'Duration (min)',
    noActivities: 'No outdoor activities configured.',
    commutesHeading: 'Commutes',
    commuteLabel: 'Commute',
    distanceKmLabel: 'Distance (km)',
    currentModeLabel: 'Current mode',
    noCommutes: 'No commutes configured.',
    modes: {
      walk: 'Walking',
      cycle: 'Bicycle',
      two_wheeler: 'Two-wheeler',
      auto: 'Auto rickshaw',
      car: 'Personal car',
      cab: 'Cab / taxi',
      bus: 'Public bus',
      metro: 'Metro',
    },
    homeHeading: 'Home & indoor setup',
    roomAreaLabel: 'Room area (m²)',
    windowStateLabel: 'Windows',
    windowStates: {
      sealed: 'Sealed',
      closed: 'Closed',
      partly_open: 'Partly open',
      open: 'Open',
    },
    purifierPresentLabel: 'Air purifier present',
    purifierCadrLabel: 'Purifier CADR (m³/h)',
    cookingFuelLabel: 'Cooking fuel',
    cookingFuels: {
      lpg: 'LPG',
      png: 'PNG',
      induction: 'Induction',
      biomass: 'Biomass',
      kerosene: 'Kerosene',
    },
    kitchenExhaustLabel: 'Kitchen exhaust fan',
    incenseLabel: 'Incense / agarbatti indoors',
    mosquitoCoilLabel: 'Mosquito coil indoors',
    hoursIndoorsLabel: 'Hours indoors per day',
    plantsCountLabel: 'Indoor plants count',
    notesLabel: 'Additional notes (optional)',
    notesHelper: "Don't include names or addresses",
    notesCounterSuffix: '/ 300',
    uploadsHeading: 'Upload custom data',
    uploadHouseholdLabel: 'Upload household (JSON)',
    uploadAirLabel: 'Upload air data (CSV)',
    useLiveData: 'Use live data',
    uploadHouseholdSuccess: 'Loaded household:',
    uploadAirSuccessPrefix: 'Loaded',
    uploadAirSuccessMiddle: 'readings from',
    uploadErrorHeading: 'Upload could not be loaded:',
    validation: {
      required: 'This field is required.',
      rangePrefix: 'Must be between',
      andWord: 'and',
    },
    buildPlanButton: "Build my family's plan",
    buildingPlanButton: 'Building plan…',
  },
  plan: {
    heading: "Your family's cleaner-air plan",
    loadingLabel: 'Loading plan view…',
    errorTitle: 'Could not build plan',
    rateLimitError: 'Too many requests — please try again in a minute.',
    origin: {
      gemini: 'Explained by Gemini',
      savedPrefix: 'Saved explanation from',
      fallback: "AI explanation unavailable — showing ClearBreath's computed ranking",
    },
    routineHeading: 'Daily routine & commutes',
    chosenOptionLabel: 'Recommended choice',
    tradeoffLabel: 'Trade-off',
    priorityLabel: 'Priority',
    priorities: {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },
    seeNumbers: 'See the numbers',
    factLabelCol: 'Fact',
    factValueCol: 'Value',
    factKindCol: 'Kind',
    factProvenanceCol: 'Source',
    ledgerHeading: 'Family impact ledger',
    ledgerCaption: 'Estimated with recommended options; not a medical measurement',
    ledgerMemberCol: 'Member (age group)',
    ledgerUsualCol: 'Usual-day intake',
    ledgerPlanCol: 'Plan intake',
    ledgerChangeCol: 'Change',
    ledgerCo2SavedLabel: 'Weekly CO2 saved',
    ledgerVehicleKmLabel: 'Weekly private vehicle-km avoided',
    ledgerHoursNote:
      'Hours not covered by listed activities, commutes, or hours indoors per day (such as school or office time) are not counted.',
    indoorHeading: 'Indoor air actions',
    costTiers: {
      free: 'Free',
      low: 'Low cost',
      medium: 'Medium cost',
      high: 'Higher cost',
    },
    communityHeading: 'Community actions',
    caveatsHeading: 'Important caveats',
    noRoutine: 'No outdoor activities or commutes to adjust.',
    noIndoor: 'No additional indoor actions suggested.',
    noCommunity: 'No community actions suggested.',
  },
  indoor: {
    heading: 'Indoor air simulator',
    intro: 'Adjust your room setup to see instant estimated indoor PM2.5 changes.',
    loadingLabel: 'Loading indoor air simulator…',
    noOutdoorData: 'Waiting for outdoor PM2.5 data to estimate indoor air quality.',
    roomAreaLabel: 'Room area (m²)',
    ceilingHeightLabel: 'Ceiling height (m)',
    windowStateLegend: 'Window state',
    windowDescriptions: {
      sealed: 'Draught-proofed or tightly sealed (lowest outdoor infiltration).',
      closed: 'Standard closed windows with normal frame gaps.',
      partly_open: 'Partially open for ventilation.',
      open: 'Wide open; indoor air tracks outdoor pollution closely.',
    },
    purifierSwitchLabel: 'Air purifier running',
    cadrLabel: 'Purifier CADR',
    unitToggleLabel: 'CADR unit',
    unitM3h: 'm³/h',
    unitCfm: 'CFM',
    plantsLabel: 'Potted plants',
    plantsDecrease: 'Decrease plants',
    plantsIncrease: 'Increase plants',
    sourcesLegend: 'Indoor smoke & cooking sources',
    sourceIncense: 'Incense / agarbatti',
    sourceMosquitoCoil: 'Mosquito coil',
    sourceCookingNoExhaust: 'Cooking without exhaust fan',
    sourceSmoking: 'Smoking indoors',
    estimatedPm25Label: 'Estimated indoor PM2.5',
    vsOutdoorsLabel: 'vs outdoors',
    recommendedCadrLabel: 'Recommended purifier CADR (5 ACH)',
    chartHeading: 'Scenario comparison',
    chartTitle: 'Estimated indoor PM2.5 across room scenarios in µg/m³',
    plantsCalloutHeading: 'Honest check: plants',
    plantsCalloutPrefix: 'Adding 10 plants changes estimated indoor PM2.5 by',
    plantsCitationLabel: 'Source:',
    sourcesWarningHeading: 'Indoor sources not included in the estimate',
    sourcesWarningNote:
      'These sources release fine particles indoors, so actual PM2.5 will be higher than the steady-state estimate above.',
    explainButton: 'Explain my setup',
    explainingButton: 'Explaining setup…',
    explainErrorTitle: 'Could not explain indoor setup',
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
  facts: {
    kinds: { [K in keyof typeof en.facts.kinds]: string };
    unknownValue: string;
  };
  household: {
    heading: string;
    presetsHeading: string;
    selectPreset: string;
    selectedPreset: string;
    summaryHeading: string;
    membersHeading: string;
    memberLabel: string;
    ageGroupLabel: string;
    sensitivitiesLabel: string;
    ageGroups: { [K in keyof typeof en.household.ageGroups]: string };
    sensitivities: { [K in keyof typeof en.household.sensitivities]: string };
    activitiesHeading: string;
    activityLabel: string;
    usualHourLabel: string;
    durationMinLabel: string;
    noActivities: string;
    commutesHeading: string;
    commuteLabel: string;
    distanceKmLabel: string;
    currentModeLabel: string;
    noCommutes: string;
    modes: { [K in keyof typeof en.household.modes]: string };
    homeHeading: string;
    roomAreaLabel: string;
    windowStateLabel: string;
    windowStates: { [K in keyof typeof en.household.windowStates]: string };
    purifierPresentLabel: string;
    purifierCadrLabel: string;
    cookingFuelLabel: string;
    cookingFuels: { [K in keyof typeof en.household.cookingFuels]: string };
    kitchenExhaustLabel: string;
    incenseLabel: string;
    mosquitoCoilLabel: string;
    hoursIndoorsLabel: string;
    plantsCountLabel: string;
    notesLabel: string;
    notesHelper: string;
    notesCounterSuffix: string;
    uploadsHeading: string;
    uploadHouseholdLabel: string;
    uploadAirLabel: string;
    useLiveData: string;
    uploadHouseholdSuccess: string;
    uploadAirSuccessPrefix: string;
    uploadAirSuccessMiddle: string;
    uploadErrorHeading: string;
    validation: { [K in keyof typeof en.household.validation]: string };
    buildPlanButton: string;
    buildingPlanButton: string;
  };
  plan: {
    heading: string;
    loadingLabel: string;
    errorTitle: string;
    rateLimitError: string;
    origin: { [K in keyof typeof en.plan.origin]: string };
    routineHeading: string;
    chosenOptionLabel: string;
    tradeoffLabel: string;
    priorityLabel: string;
    priorities: { [K in keyof typeof en.plan.priorities]: string };
    seeNumbers: string;
    factLabelCol: string;
    factValueCol: string;
    factKindCol: string;
    factProvenanceCol: string;
    ledgerHeading: string;
    ledgerCaption: string;
    ledgerMemberCol: string;
    ledgerUsualCol: string;
    ledgerPlanCol: string;
    ledgerChangeCol: string;
    ledgerCo2SavedLabel: string;
    ledgerVehicleKmLabel: string;
    ledgerHoursNote: string;
    indoorHeading: string;
    costTiers: { [K in keyof typeof en.plan.costTiers]: string };
    communityHeading: string;
    caveatsHeading: string;
    noRoutine: string;
    noIndoor: string;
    noCommunity: string;
  };
  indoor: {
    heading: string;
    intro: string;
    loadingLabel: string;
    noOutdoorData: string;
    roomAreaLabel: string;
    ceilingHeightLabel: string;
    windowStateLegend: string;
    windowDescriptions: { [K in keyof typeof en.indoor.windowDescriptions]: string };
    purifierSwitchLabel: string;
    cadrLabel: string;
    unitToggleLabel: string;
    unitM3h: string;
    unitCfm: string;
    plantsLabel: string;
    plantsDecrease: string;
    plantsIncrease: string;
    sourcesLegend: string;
    sourceIncense: string;
    sourceMosquitoCoil: string;
    sourceCookingNoExhaust: string;
    sourceSmoking: string;
    estimatedPm25Label: string;
    vsOutdoorsLabel: string;
    recommendedCadrLabel: string;
    chartHeading: string;
    chartTitle: string;
    plantsCalloutHeading: string;
    plantsCalloutPrefix: string;
    plantsCitationLabel: string;
    sourcesWarningHeading: string;
    sourcesWarningNote: string;
    explainButton: string;
    explainingButton: string;
    explainErrorTitle: string;
  };
};
