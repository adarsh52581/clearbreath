import { Router } from 'express';
import { CITIES } from '../../domain/data/cities.js';
import type { City } from '../../shared/schemas.js';

export function createCitiesRouter(): Router {
  const router = Router();

  router.get('/cities', (_req, res) => {
    const cities: City[] = CITIES.map((c) => ({
      id: c.id,
      name: c.name,
      state: c.state,
      lat: c.lat,
      lon: c.lon,
      ncr: c.ncr,
    }));
    res.json({ cities });
  });

  return router;
}
