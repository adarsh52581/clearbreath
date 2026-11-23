import { z } from 'zod';

export const idSchema = z.string().regex(/^[a-z0-9_]{1,16}$/, {
  message: 'Id must match /^[a-z0-9_]{1,16}$/',
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
