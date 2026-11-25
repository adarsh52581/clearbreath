import express, { type Express } from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from './config.js';
import { configureSecurity } from './middleware/security.js';
import { apiNotFoundHandler, errorHandler } from './errors.js';
import { createCitiesRouter } from './routes/cities.js';
import { createAirRouter } from './routes/air.js';
import { createPlanRouter } from './routes/plan.js';
import { createIaqRouter } from './routes/iaq.js';
import type { AirService } from './services/airService.js';
import type { PlanService } from './services/planService.js';
import type { IaqService } from './services/iaqService.js';

export interface AppDeps {
  config: Config;
  airService?: AirService;
  planService?: PlanService;
  iaqService?: IaqService;
}

export function createApp({ config, airService, planService, iaqService }: AppDeps): Express {
  const app = express();

  app.set('trust proxy', 1); // Cloud Run — use client IP for rate limiting

  configureSecurity(app);
  app.use(compression());
  app.use(express.json({ limit: '256kb' }));

  const baseApiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfterSeconds: 60,
        },
      });
    },
  });
  app.use('/api', baseApiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: config.appVersion,
      time: new Date().toISOString(),
    });
  });

  // Cities route (no rate-limit; cheap static data)
  app.use('/api', createCitiesRouter());

  // Air route (rate-limited; requires airService)
  if (airService) {
    app.use('/api', createAirRouter(airService));
  }

  // Plan route (rate-limited; requires planService)
  if (planService) {
    app.use('/api', createPlanRouter(planService));
  }

  // Indoor air explanation route (rate-limited; requires iaqService)
  if (iaqService) {
    app.use('/api', createIaqRouter(iaqService));
  }

  app.use('/api', apiNotFoundHandler);

  if (config.nodeEnv === 'production') {
    const webDistPath = path.resolve(process.cwd(), 'dist/web');
    const indexPath = path.join(webDistPath, 'index.html');

    app.use(
      '/assets',
      express.static(path.join(webDistPath, 'assets'), {
        maxAge: '1y',
        immutable: true,
      }),
    );

    app.use(
      express.static(webDistPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );

    app.use((req, res, next) => {
      if (req.method === 'GET' && fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  app.use(errorHandler);

  return app;
}
