import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getCityById } from '../../domain/data/cities.js';
import { AppError } from '../errors.js';
import type { AirService } from '../services/airService.js';

// India bounding box (ARCHITECTURE §5.4)
const LAT_MIN = 6;
const LAT_MAX = 37.5;
const LON_MIN = 68;
const LON_MAX = 97.5;

const cityIdQuerySchema = z.object({ cityId: z.string().min(1) });
const latLonQuerySchema = z.object({
  lat: z.coerce.number().finite(),
  lon: z.coerce.number().finite(),
});

function isInIndia(lat: number, lon: number): boolean {
  return lat >= LAT_MIN && lat <= LAT_MAX && lon >= LON_MIN && lon <= LON_MAX;
}

export function createAirRouter(airService: AirService): Router {
  const router = Router();

  // 60 req/min/IP per ARCHITECTURE §8
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      const retryAfter = 60;
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfterSeconds: retryAfter,
        },
      });
    },
  });

  router.get('/air', limiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as Record<string, string>;

      // Resolve location from query params
      let lat: number;
      let lon: number;
      let label: string;
      let cityId: string | undefined;

      if (query.cityId !== undefined) {
        // cityId path
        const parsed = cityIdQuerySchema.safeParse(query);
        if (!parsed.success) {
          throw new AppError('VALIDATION', 400, 'Invalid cityId parameter');
        }
        const city = getCityById(parsed.data.cityId);
        if (!city) {
          throw new AppError('OUT_OF_COVERAGE', 422, `Unknown city: ${parsed.data.cityId}`);
        }
        lat = city.lat;
        lon = city.lon;
        label = city.name;
        cityId = city.id;
      } else if (query.lat !== undefined || query.lon !== undefined) {
        // lat/lon path
        const parsed = latLonQuerySchema.safeParse(query);
        if (!parsed.success) {
          throw new AppError('VALIDATION', 400, 'lat and lon must be valid numbers');
        }
        lat = parsed.data.lat;
        lon = parsed.data.lon;

        if (!isInIndia(lat, lon)) {
          throw new AppError(
            'OUT_OF_COVERAGE',
            422,
            'Coordinates are outside the supported coverage area (India).',
          );
        }
        label = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      } else {
        throw new AppError('VALIDATION', 400, 'Provide either cityId or lat and lon query parameters.');
      }

      const report = await airService.getAirReport({ lat, lon, label, cityId });
      res.json(report);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
