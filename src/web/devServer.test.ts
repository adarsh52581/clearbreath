import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// In development Vite serves src/web at "/" and proxies every URL that starts with "/api"
// to the Express API (vite.config.ts). A file or folder under src/web whose name starts
// with "api" (e.g. src/web/api/client.ts → "/api/client.ts") would be sent to Express
// instead of Vite, the module would 404 and the page would render blank.
describe('dev server URL space', () => {
  it('has no src/web entry whose name starts with "api"', () => {
    const webDir = path.resolve(process.cwd(), 'src/web');
    const clashes = fs
      .readdirSync(webDir)
      .filter((name) => name.toLowerCase().startsWith('api'));
    expect(clashes).toEqual([]);
  });
});
