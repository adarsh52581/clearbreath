import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { planRequestSchema } from '../../shared/schemas.js';
import { AppError } from '../errors.js';
import type { PlanService } from '../services/planService.js';

export function createPlanRouter(planService: PlanService): Router {
  const router = Router();

  // Rate limit: 10/min per IP
  const minLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfterSeconds: 60,
        },
      });
    },
  });

  // Rate limit: 100/day per IP
  const dayLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Daily request limit exceeded. Please try again tomorrow.',
          retryAfterSeconds: 86400,
        },
      });
    },
  });

  router.post(
    '/plan',
    minLimiter,
    dayLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Enforce Content-Type application/json per ARCHITECTURE §8
        if (!req.is('application/json')) {
          throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Content-Type must be application/json');
        }

        const parsed = planRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError('VALIDATION', 400, 'Invalid request body', {
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          });
        }

        const planResponse = await planService.createPlan(parsed.data);
        res.status(200).json(planResponse);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
