import express, { type Express } from 'express';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import type { Config } from './config.js';
import { configureSecurity } from './middleware/security.js';
import { apiNotFoundHandler, errorHandler } from './errors.js';

export interface AppDeps {
  config: Config;
}

export function createApp({ config }: AppDeps): Express {
  const app = express();

  configureSecurity(app);
  app.use(compression());
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: config.appVersion,
      time: new Date().toISOString(),
    });
  });

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
