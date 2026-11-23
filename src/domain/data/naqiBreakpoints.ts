export interface Breakpoint {
  readonly cLo: number;
  readonly cHi: number;
  readonly iLo: number;
  readonly iHi: number;
}

export type CategoryKey = 'good' | 'satisfactory' | 'moderate' | 'poor' | 'very_poor' | 'severe';

export interface Category {
  readonly key: CategoryKey;
  readonly indexRange: readonly [min: number, max: number];
  readonly enLabel: string;
  readonly hiLabel: string;
  readonly swatchToken: string;
  readonly healthNoteEn: string;
  readonly healthNoteHi: string;
}

/**
 * CPCB Indian National AQI PM2.5 breakpoints.
 * Source: CPCB National Air Quality Index (2014), DOMAIN_MODEL §1.
 */
export const PM25_BREAKPOINTS: readonly Breakpoint[] = [
  { cLo: 0, cHi: 30, iLo: 0, iHi: 50 },
  { cLo: 30, cHi: 60, iLo: 50, iHi: 100 },
  { cLo: 60, cHi: 90, iLo: 100, iHi: 200 },
  { cLo: 90, cHi: 120, iLo: 200, iHi: 300 },
  { cLo: 120, cHi: 250, iLo: 300, iHi: 400 },
  { cLo: 250, cHi: 380, iLo: 400, iHi: 500 },
] as const;

/**
 * CPCB Indian National AQI PM10 breakpoints.
 * Source: CPCB National Air Quality Index (2014), DOMAIN_MODEL §1.
 */
export const PM10_BREAKPOINTS: readonly Breakpoint[] = [
  { cLo: 0, cHi: 50, iLo: 0, iHi: 50 },
  { cLo: 50, cHi: 100, iLo: 50, iHi: 100 },
  { cLo: 100, cHi: 250, iLo: 100, iHi: 200 },
  { cLo: 250, cHi: 350, iLo: 200, iHi: 300 },
  { cLo: 350, cHi: 430, iLo: 300, iHi: 400 },
  { cLo: 430, cHi: 510, iLo: 400, iHi: 500 },
] as const;

/**
 * CPCB AQI Categories and health impact notes.
 * Source: CPCB National Air Quality Index (2014), DOMAIN_MODEL §1.
 */
export const CATEGORIES: readonly Category[] = [
  {
    key: 'good',
    indexRange: [0, 50],
    enLabel: 'Good',
    hiLabel: 'अच्छा',
    swatchToken: '--color-aqi-good',
    healthNoteEn: 'Minimal impact.',
    healthNoteHi: 'न्यूनतम प्रभाव।',
  },
  {
    key: 'satisfactory',
    indexRange: [51, 100],
    enLabel: 'Satisfactory',
    hiLabel: 'संतोषजनक',
    swatchToken: '--color-aqi-satisfactory',
    healthNoteEn: 'Minor breathing discomfort for sensitive people.',
    healthNoteHi: 'संवेदनशील लोगों को साँस लेने में हल्की तकलीफ़ हो सकती है।',
  },
  {
    key: 'moderate',
    indexRange: [101, 200],
    enLabel: 'Moderate',
    hiLabel: 'मध्यम',
    swatchToken: '--color-aqi-moderate',
    healthNoteEn:
      'Breathing discomfort for people with lung disease such as asthma; discomfort for people with heart disease, children and older adults.',
    healthNoteHi:
      'अस्थमा जैसी फेफड़ों की बीमारी वाले लोगों को साँस लेने में तकलीफ़; हृदय रोगियों, बच्चों और बुज़ुर्गों को असुविधा।',
  },
  {
    key: 'poor',
    indexRange: [201, 300],
    enLabel: 'Poor',
    hiLabel: 'ख़राब',
    swatchToken: '--color-aqi-poor',
    healthNoteEn:
      'Breathing discomfort for most people on prolonged exposure; discomfort for people with heart disease.',
    healthNoteHi:
      'लंबे समय तक संपर्क में रहने पर अधिकतर लोगों को साँस लेने में तकलीफ़; हृदय रोगियों को असुविधा।',
  },
  {
    key: 'very_poor',
    indexRange: [301, 400],
    enLabel: 'Very Poor',
    hiLabel: 'बहुत ख़राब',
    swatchToken: '--color-aqi-very-poor',
    healthNoteEn:
      'Respiratory illness possible on prolonged exposure; stronger effects in people with lung and heart disease.',
    healthNoteHi:
      'लंबे संपर्क से साँस की बीमारी हो सकती है; फेफड़े और हृदय रोगियों पर अधिक असर।',
  },
  {
    key: 'severe',
    indexRange: [401, 500],
    enLabel: 'Severe',
    hiLabel: 'गंभीर',
    swatchToken: '--color-aqi-severe',
    healthNoteEn:
      'Affects healthy people; serious impact on people with existing disease, even during light activity.',
    healthNoteHi: 'स्वस्थ लोगों पर भी असर; बीमार लोगों पर गंभीर प्रभाव, हल्की गतिविधि में भी।',
  },
] as const;
