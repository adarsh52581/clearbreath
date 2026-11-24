import type { Messages } from './en.js';

export const hi: Messages = {
  app: {
    name: 'ClearBreath',
    skipToContent: 'मुख्य सामग्री पर जाएँ',
    headline: 'आपके परिवार के लिए स्वच्छ हवा के निर्णय',
    intro:
      'ClearBreath भारतीय शहरों के परिवारों को वायु प्रदूषण से बचाव के लिए प्रमाण-आधारित निर्णय लेने में मदद करता है।',
    languageLabel: 'भाषा',
    switchToHindi: 'हिन्दी',
    switchToEnglish: 'English',
    liveUpdatePrefix: 'वायु गुणवत्ता अपडेट की गई:',
    unavailableCategory: 'डेटा उपलब्ध नहीं',
  },
  footer: {
    dataSourcesHeading: 'डेटा स्रोत',
    openAqAttribution:
      'OpenAQ v3 से लाइव स्टेशन माप, जो CPCB और राज्य प्रदूषण नियंत्रण बोर्ड जैसे आधिकारिक नेटवर्क से प्राप्त होते हैं।',
    forecastAttribution:
      'Google Air Quality API से 48 घंटे का पूर्वानुमान, और विकल्प के रूप में Open-Meteo (CAMS मॉडल)।',
    aqiMethod: 'CPCB 2014 मानकों के अनुसार भारतीय राष्ट्रीय AQI (NAQI) की गणना।',
    howNumbersHeading: 'आँकड़े कैसे तैयार होते हैं',
    howNumbersNote:
      'सभी प्रदूषण स्तर, AQI मान और प्रभाव अनुमान सार्वजनिक API से लिए जाते हैं या कोड में निश्चित सूत्रों से गिने जाते हैं। स्वास्थ्य जानकारी सामान्य CPCB श्रेणियों पर आधारित है, चिकित्सा सलाह नहीं।',
  },
  location: {
    label: 'शहर चुनें',
    ncrGroup: 'दिल्ली-एनसीआर',
    otherCitiesGroup: 'अन्य भारतीय शहर',
    useMyLocation: 'मेरा स्थान उपयोग करें',
    locating: 'स्थान खोज रहे हैं…',
    customLocationLabel: 'वर्तमान GPS स्थान',
    errors: {
      unsupported: 'इस ब्राउज़र में स्थान पहचान समर्थित नहीं है।',
      denied: 'स्थान की अनुमति अस्वीकार कर दी गई। कृपया सूची से शहर चुनें।',
      unavailable: 'आपका वर्तमान स्थान उपलब्ध नहीं है। कृपया शहर चुनें।',
      timeout: 'स्थान अनुरोध का समय समाप्त हो गया। कृपया पुनः प्रयास करें या शहर चुनें।',
      outsideIndia:
        'आपका स्थान भारत से बाहर है। ClearBreath अभी केवल भारतीय शहरों को कवर करता है।',
    },
  },
  source: {
    measuredHeading: 'मापी गई वायु गुणवत्ता',
    providerLabel: 'प्रदाता',
    stationLabel: 'स्टेशन',
    distanceUnit: 'किमी दूर',
    updatedPrefix: 'अपडेट:',
    minAgoSuffix: 'मिनट पहले',
    justNow: 'अभी-अभी',
    freshness: {
      fresh: 'ताज़ा (< 3 घंटे)',
      stale: 'पुराना (3–12 घंटे)',
      unavailable: 'उपलब्ध नहीं',
    },
    forecastHeading: 'पूर्वानुमान स्रोत',
    modelForecastTag: 'मॉडल पूर्वानुमान',
    uploadedHeading: 'अपलोड किया गया डेटा',
    uploadedBanner: 'अपलोड किया गया — लाइव डेटा नहीं',
    uploadedFileLabel: 'फ़ाइल',
  },
  aqi: {
    heading: 'भारतीय राष्ट्रीय AQI',
    basis24h: '24-घंटे का औसत',
    basisIndicative: 'सांकेतिक: नवीनतम घंटा',
    dominantLabel: 'प्रमुख प्रदूषक',
    pm25Name: 'PM2.5',
    pm10Name: 'PM10',
    pmOnlyNote: 'केवल PM2.5 और PM10 पर आधारित — सांकेतिक',
    unavailableTitle: 'AQI उपलब्ध नहीं',
    unavailableNote: 'AQI की गणना के लिए कोई हालिया स्टेशन या अपलोड डेटा उपलब्ध नहीं है।',
  },
  pollutants: {
    heading: 'कण प्रदूषण का स्तर',
    caption: 'µg/m³ में नवीनतम और 24-घंटे का औसत PM2.5 तथा PM10 स्तर',
    pollutantCol: 'प्रदूषक',
    latestCol: 'नवीनतम',
    avg24hCol: '24-घंटे औसत',
    unitCol: 'इकाई',
    timeCol: 'समय (IST)',
    unitValue: 'µg/m³',
    notAvailable: '—',
    insufficient24h: 'अपर्याप्त (< 16 घंटे)',
  },
  forecast: {
    heading: '48-घंटे का PM2.5 पूर्वानुमान',
    chartTitle: 'CPCB AQI श्रेणी के अनुसार रंगीन 48-घंटे का प्रति घंटा PM2.5 पूर्वानुमान चार्ट',
    cleanestLabel: 'सबसे साफ़ समय',
    worstLabel: 'सबसे ख़राब समय',
    showTable: 'डेटा तालिका देखें',
    tableCaption: 'अगले 48 घंटों का प्रति घंटा PM2.5 और PM10 पूर्वानुमान',
    timeCol: 'समय (IST)',
    pm25Col: 'PM2.5 (µg/m³)',
    pm10Col: 'PM10 (µg/m³)',
    categoryCol: 'श्रेणी',
    unavailable: 'पूर्वानुमान डेटा अभी उपलब्ध नहीं है।',
    noValue: '—',
  },
  status: {
    loadingLabel: 'वायु गुणवत्ता डेटा लोड हो रहा है…',
    retry: 'पुनः प्रयास करें',
    errorTitle: 'वायु गुणवत्ता डेटा लोड नहीं हो सका',
    warnings: {
      NO_STATION:
        '25 किमी के भीतर कोई सक्रिय निगरानी स्टेशन नहीं मिला। जहाँ उपलब्ध हो, केवल पूर्वानुमान दिखाया जा रहा है।',
      STALE_STATION:
        'निकटतम स्टेशन ने पिछले 3 घंटों में डेटा नहीं भेजा है। आँकड़े वर्तमान स्थिति से भिन्न हो सकते हैं।',
      FORECAST_FALLBACK:
        'प्राथमिक पूर्वानुमान सेवा उपलब्ध नहीं थी। Open-Meteo (CAMS मॉडल) का पूर्वानुमान दिखाया जा रहा है।',
      FORECAST_UNAVAILABLE:
        '48-घंटे का पूर्वानुमान अभी उपलब्ध नहीं है। समय बदलने के सुझाव बंद हैं।',
      INDICATIVE_AQI:
        '24-घंटे के औसत के लिए 16 से कम घंटे उपलब्ध थे। यह AQI नवीनतम घंटे पर आधारित सांकेतिक मान है।',
      UPLOADED_DATA:
        'आप अपलोड किया गया वायु गुणवत्ता डेटा देख रहे हैं, लाइव माप नहीं।',
      UNIT_MISMATCH:
        'कुछ पूर्वानुमान मानों की इकाई अलग थी, इसलिए सटीकता के लिए उन्हें हटा दिया गया।',
    },
  },
};
