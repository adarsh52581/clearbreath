import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-z0-9_-]{1,32}$/, {
  message: 'Id must match /^[a-z0-9_-]{1,32}$/',
});
export type Id = z.infer<typeof idSchema>;

export const ageGroupSchema = z.enum(['toddler', 'child', 'teen', 'adult', 'older_adult']);
export type AgeGroup = z.infer<typeof ageGroupSchema>;

export const sensitivitySchema = z.enum(['asthma', 'copd', 'heart', 'pregnant']);
export type Sensitivity = z.infer<typeof sensitivitySchema>;

export const intensitySchema = z.enum(['sedentary', 'light', 'moderate', 'high']);
export type Intensity = z.infer<typeof intensitySchema>;

export const modeSchema = z.enum([
  'walk',
  'cycle',
  'two_wheeler',
  'auto',
  'car',
  'cab',
  'bus',
  'metro',
]);
export type Mode = z.infer<typeof modeSchema>;

export const windowStateSchema = z.enum(['sealed', 'closed', 'partly_open', 'open']);
export type WindowState = z.infer<typeof windowStateSchema>;

export const cookingFuelSchema = z.enum(['lpg', 'png', 'induction', 'biomass', 'kerosene']);
export type CookingFuel = z.infer<typeof cookingFuelSchema>;

export const memberSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(24),
  ageGroup: ageGroupSchema,
  sensitivities: z
    .array(sensitivitySchema)
    .max(4)
    .refine((items) => new Set(items).size === items.length, {
      message: 'Sensitivities must be unique',
    }),
});
export type Member = z.infer<typeof memberSchema>;

export const activityKindSchema = z.enum([
  'outdoor_play',
  'exercise',
  'walk',
  'errand',
  'school_run',
  'other',
]);
export type ActivityKind = z.infer<typeof activityKindSchema>;

export const flexibleRangeSchema = z
  .object({
    earliestHour: z.number().int().min(0).max(23),
    latestHour: z.number().int().min(1).max(24),
  })
  .superRefine((data, ctx) => {
    if (data.latestHour <= data.earliestHour) {
      ctx.addIssue({
        code: 'custom',
        message: 'latestHour must be strictly greater than earliestHour',
        path: ['latestHour'],
      });
    }
  });
export type FlexibleRange = z.infer<typeof flexibleRangeSchema>;

export const activitySchema = z
  .object({
    id: idSchema,
    label: z.string().min(1).max(40),
    memberIds: z.array(idSchema).min(1),
    kind: activityKindSchema,
    intensity: z.enum(['light', 'moderate', 'high']),
    durationMin: z.number().min(10).max(240),
    usualStartHour: z.number().int().min(0).max(23),
    flexible: flexibleRangeSchema.nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.flexible !== null) {
      const rangeMin = (data.flexible.latestHour - data.flexible.earliestHour) * 60;
      if (data.durationMin > rangeMin) {
        ctx.addIssue({
          code: 'custom',
          message: 'durationMin must fit inside the flexible range',
          path: ['durationMin'],
        });
      }
    }
  });
export type Activity = z.infer<typeof activitySchema>;

export const commuteSchema = z.object({
  id: idSchema,
  label: z.string().min(1).max(40),
  memberIds: z.array(idSchema).min(1),
  distanceKm: z.number().min(0.5).max(60),
  currentMode: modeSchema,
  allowedModes: z
    .array(modeSchema)
    .min(1)
    .refine((items) => new Set(items).size === items.length, {
      message: 'allowedModes must be unique',
    }),
  usualStartHour: z.number().int().min(0).max(23),
  daysPerWeek: z.number().int().min(1).max(7),
});
export type Commute = z.infer<typeof commuteSchema>;

export const purifierSchema = z
  .object({
    present: z.boolean(),
    cadrM3h: z.number().min(0).max(1500),
  })
  .superRefine((data, ctx) => {
    if (!data.present && data.cadrM3h !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'cadrM3h must be 0 when purifier is not present',
        path: ['cadrM3h'],
      });
    }
  });
export type Purifier = z.infer<typeof purifierSchema>;

export const homeSchema = z.object({
  roomAreaM2: z.number().min(6).max(80),
  ceilingHeightM: z.number().min(2.2).max(4.5),
  windowState: windowStateSchema,
  purifier: purifierSchema,
  cookingFuel: cookingFuelSchema,
  kitchenExhaust: z.boolean(),
  incense: z.boolean(),
  mosquitoCoil: z.boolean(),
  smokingIndoors: z.boolean(),
  hoursIndoorsPerDay: z.number().min(0).max(24),
  plantsCount: z.number().int().min(0).max(20),
});
export type Home = z.infer<typeof homeSchema>;

// Indoor scenario (DOMAIN_MODEL §5)
export const indoorScenarioSchema = z.object({
  id: z.string(),
  label: z.string(),
  cIn: z.number().nonnegative(),
  pctVsBaseline: z.number(),
  pctVsOutdoor: z.number(),
  doseByMember: z.array(
    z.object({
      memberId: z.string(),
      dose: z.number().nonnegative(),
    })
  ),
});
export type IndoorScenario = z.infer<typeof indoorScenarioSchema>;

export const constraintsSchema = z.object({
  budget: z.enum(['none', 'low', 'medium', 'high']),
  rented: z.boolean(),
  mobilityLimited: z.boolean(),
});
export type Constraints = z.infer<typeof constraintsSchema>;

export const householdProfileSchema = z
  .object({
    id: idSchema,
    title: z.string().min(1).max(60),
    description: z.string().max(120).optional(),
    cityId: z.string().min(1),
    members: z.array(memberSchema).min(1).max(8),
    activities: z.array(activitySchema).min(0).max(10),
    commutes: z.array(commuteSchema).min(0).max(4),
    home: homeSchema,
    constraints: constraintsSchema,
    notes: z.string().max(300).optional(),
  })
  .superRefine((data, ctx) => {
    const memberIdSet = new Set<string>();
    data.members.forEach((m, idx) => {
      if (memberIdSet.has(m.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate member id: ${m.id}`,
          path: ['members', idx, 'id'],
        });
      }
      memberIdSet.add(m.id);
    });

    const activityIdSet = new Set<string>();
    data.activities.forEach((a, idx) => {
      if (activityIdSet.has(a.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate activity id: ${a.id}`,
          path: ['activities', idx, 'id'],
        });
      }
      activityIdSet.add(a.id);

      a.memberIds.forEach((mId, mIdx) => {
        if (!memberIdSet.has(mId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Referenced member id ${mId} does not exist`,
            path: ['activities', idx, 'memberIds', mIdx],
          });
        }
      });
    });

    const commuteIdSet = new Set<string>();
    data.commutes.forEach((c, idx) => {
      if (commuteIdSet.has(c.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate commute id: ${c.id}`,
          path: ['commutes', idx, 'id'],
        });
      }
      commuteIdSet.add(c.id);

      c.memberIds.forEach((mId, mIdx) => {
        if (!memberIdSet.has(mId)) {
          ctx.addIssue({
            code: 'custom',
            message: `Referenced member id ${mId} does not exist`,
            path: ['commutes', idx, 'memberIds', mIdx],
          });
        }
      });
    });
  });
export type HouseholdProfile = z.infer<typeof householdProfileSchema>;

// Section 5.2 Air Data Schemas
export const hourlyValueSchema = z.object({
  timeUtc: z.string(),
  value: z.number(),
});
export type HourlyValue = z.infer<typeof hourlyValueSchema>;

export const forecastPointSchema = z.object({
  timeUtc: z.string(),
  pm25: z.number().nullable(),
  pm10: z.number().nullable(),
});
export type ForecastPoint = z.infer<typeof forecastPointSchema>;

export const categoryKeySchema = z.enum([
  'good',
  'satisfactory',
  'moderate',
  'poor',
  'very_poor',
  'severe',
]);
export type CategoryKey = z.infer<typeof categoryKeySchema>;

export const naqiResultSchema = z.object({
  value: z.number(),
  category: categoryKeySchema,
  dominant: z.enum(['pm25', 'pm10']),
  basis: z.enum(['24h', 'indicative-latest']),
  subIndices: z.object({
    pm25: z.number().optional(),
    pm10: z.number().optional(),
  }),
  note: z.string(),
});
export type NaqiResult = z.infer<typeof naqiResultSchema>;

// Section 5.2 extended — AirReport and related types

export const warningCodeSchema = z.enum([
  'NO_STATION',
  'STALE_STATION',
  'FORECAST_FALLBACK',
  'FORECAST_UNAVAILABLE',
  'INDICATIVE_AQI',
  'UPLOADED_DATA',
  'UNIT_MISMATCH',
]);
export type WarningCode = z.infer<typeof warningCodeSchema>;

export const sourceRefSchema = z.object({
  name: z.string(),
  provider: z.string().optional(),
  url: z.string(),
  kind: z.enum(['measured', 'forecast', 'uploaded']),
  fetchedAtUtc: z.string(),
  dataTimeUtc: z.string().optional(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const readingSchema = z.object({
  value: z.number(),
  unit: z.literal('µg/m³'),
  atUtc: z.string(),
});
export type Reading = z.infer<typeof readingSchema>;

export const measuredAirSchema = z.object({
  source: sourceRefSchema,
  station: z.object({
    id: z.number(),
    name: z.string(),
    distanceKm: z.number(),
    isMonitor: z.boolean(),
  }),
  latest: z.object({
    pm25: readingSchema.optional(),
    pm10: readingSchema.optional(),
  }),
  series24h: z.object({
    pm25: z.array(hourlyValueSchema),
    pm10: z.array(hourlyValueSchema),
  }),
  freshness: z.enum(['fresh', 'stale', 'unavailable']),
});
export type MeasuredAir = z.infer<typeof measuredAirSchema>;

export const forecastSchema = z.object({
  source: sourceRefSchema,
  points: z.array(forecastPointSchema),
});
export type Forecast = z.infer<typeof forecastSchema>;

export const airReportSchema = z.object({
  location: z.object({
    label: z.string(),
    lat: z.number(),
    lon: z.number(),
    cityId: z.string().optional(),
  }),
  measured: measuredAirSchema.nullable(),
  naqi: naqiResultSchema.nullable(),
  forecast: forecastSchema.nullable(),
  warnings: z.array(z.object({ code: warningCodeSchema, message: z.string() })),
  fetchedAtUtc: z.string(),
});
export type AirReport = z.infer<typeof airReportSchema>;

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  lat: z.number(),
  lon: z.number(),
  ncr: z.boolean(),
});
export type City = z.infer<typeof citySchema>;

export const uploadedSeriesSchema = z.object({
  fileName: z.string().max(80),
  points: z
    .array(
      z.object({
        timeUtc: z.string(),
        pm25: z.number().min(0).max(2000).nullable(),
        pm10: z.number().min(0).max(2000).nullable(),
      }),
    )
    .min(1)
    .max(500),
});
export type UploadedSeries = z.infer<typeof uploadedSeriesSchema>;

// Section 5.3 Facts and Candidates
export const factKindSchema = z.enum([
  'measured',
  'forecast',
  'computed',
  'reference',
  'assumption',
  'guidance',
  'uploaded',
]);
export type FactKind = z.infer<typeof factKindSchema>;

export const factSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]{3,80}$/),
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string().optional(),
  display: z.string(),
  kind: factKindSchema,
  provenance: z.string(),
  asOfUtc: z.string().optional(),
});
export type Fact = z.infer<typeof factSchema>;

export const optionSchema = z.object({
  optionId: z.string(),
  label: z.string(),
  recommended: z.boolean(),
  factIds: z.array(z.string()),
});
export type Option = z.infer<typeof optionSchema>;

export const candidatesSchema = z.object({
  activities: z.array(
    z.object({
      itemId: z.string(),
      label: z.string(),
      memberIds: z.array(z.string()),
      options: z.array(optionSchema),
    }),
  ),
  commutes: z.array(
    z.object({
      itemId: z.string(),
      label: z.string(),
      memberIds: z.array(z.string()),
      options: z.array(optionSchema),
    }),
  ),
  indoor: z.array(
    z.object({
      actionId: z.string(),
      label: z.string(),
      cost: z.enum(['free', 'low', 'medium', 'high']),
      factIds: z.array(z.string()),
    }),
  ),
  community: z.array(
    z.object({
      actionId: z.string(),
      label: z.string(),
      factIds: z.array(z.string()),
    }),
  ),
});
export type Candidates = z.infer<typeof candidatesSchema>;

// Section 5.4 Plan API Schemas
export const languageSchema = z.enum(['en', 'hi']);
export type Language = z.infer<typeof languageSchema>;

export const locationRefSchema = z.union([
  z.object({ cityId: z.string() }),
  z.object({ lat: z.number(), lon: z.number() }),
]);
export type LocationRef = z.infer<typeof locationRefSchema>;

export const planRequestSchema = z.object({
  profile: householdProfileSchema,
  location: locationRefSchema,
  upload: uploadedSeriesSchema.optional(),
  language: languageSchema,
});
export type PlanRequest = z.infer<typeof planRequestSchema>;

export const responseMetaSchema = z.object({
  origin: z.enum(['gemini', 'cache', 'last-good', 'fallback']),
  model: z.string().optional(),
  attempts: z.number().int().min(0).max(2),
  generatedAtUtc: z.string(),
  warnings: z.array(z.string()),
});
export type ResponseMeta = z.infer<typeof responseMetaSchema>;

export const planResponseSchema = z.object({
  air: airReportSchema,
  facts: z.array(factSchema),
  candidates: candidatesSchema,
  plan: z.any(), // detailed typing in aiSchemas.ts
  meta: responseMetaSchema,
});
export type PlanResponse = z.infer<typeof planResponseSchema>;


