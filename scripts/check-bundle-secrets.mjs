import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist/web');

if (!fs.existsSync(distDir)) {
  console.log('dist/web does not exist yet, skipping bundle secret scan');
  process.exit(0);
}

const SECRET_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/,
  /openaq_[a-zA-Z0-9_-]{20,}/,
  /sk-[a-zA-Z0-9]{20,}/,
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
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
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
