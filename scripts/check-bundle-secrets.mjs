import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist/web');

if (!fs.existsSync(distDir)) {
  console.log('dist/web does not exist yet, skipping bundle secret scan');
  process.exit(0);
}

const SECRET_MARKERS = [
  'AIza',
  'GEMINI_API_KEY',
  'OPENAQ_API_KEY',
  'X-Goog-Api-Key',
];

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/,
  /openaq_[a-zA-Z0-9_-]{20,}/,
  /\bsk-[a-zA-Z0-9]{16,}/,
];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let hasViolation = false;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (scanDir(fullPath)) {
        hasViolation = true;
      }
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.js') || entry.name.endsWith('.css') || entry.name.endsWith('.html'))
    ) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const marker of SECRET_MARKERS) {
        if (content.includes(marker)) {
          console.error(
            `ERROR: Forbidden secret marker "${marker}" detected in bundle: ${fullPath}`,
          );
          hasViolation = true;
        }
      }
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          console.error(
            `ERROR: Potential secret detected in bundle: ${fullPath} matching ${pattern}`,
          );
          hasViolation = true;
        }
      }
    }
  }

  return hasViolation;
}

const foundSecrets = scanDir(distDir);
if (foundSecrets) {
  console.error('Bundle secret scan failed!');
  process.exit(1);
} else {
  console.log('Bundle secret scan passed: No secrets found in dist/web');
}
