import { Router, type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { iaqExplainRequestSchema } from '../../shared/schemas.js';
import { AppError } from '../errors.js';
import type { IaqService } from '../services/iaqService.js';

export function createIaqRouter(iaqService: IaqService): Router {
  const router = Router();

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
    '/iaq/explain',
    minLimiter,
    dayLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.is('application/json')) {
          throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Content-Type must be application/json');
        }

        const parsed = iaqExplainRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError('VALIDATION', 400, 'Invalid request body', {
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          });
        }

        const response = await iaqService.explainIaq(parsed.data);
        res.status(200).json(response);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
