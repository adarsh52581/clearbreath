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
  /\bAQ\.[A-Za-z0-9_-]{20,}/, // newer Google API key format
  /openaq_[a-zA-Z0-9_-]{20,}/,
  /\bsk-[a-zA-Z0-9]{16,}/,
];

// Also look for the literal values of the real keys (from the environment or a local .env),
// so a leaked key is caught whatever its format. Values are never printed.
const SECRET_ENV_NAMES = ['GEMINI_API_KEY', 'OPENAQ_API_KEY', 'GOOGLE_MAPS_API_KEY'];
if (fs.existsSync('.env')) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // ignore unreadable .env
  }
}
const SECRET_VALUES = SECRET_ENV_NAMES.map((name) => ({
  name,
  value: (process.env[name] ?? '').trim(),
})).filter((entry) => entry.value.length >= 8);

function scanFile(fullPath) {
  const content = fs.readFileSync(fullPath, 'utf8');
  let hasViolation = false;
  for (const marker of SECRET_MARKERS) {
    if (content.includes(marker)) {
      console.error(`ERROR: Forbidden secret marker "${marker}" detected in bundle: ${fullPath}`);
      hasViolation = true;
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`ERROR: Potential secret detected in bundle: ${fullPath} matching ${pattern}`);
      hasViolation = true;
    }
  }
  for (const { name, value } of SECRET_VALUES) {
    if (content.includes(value)) {
      console.error(`ERROR: The value of ${name} was found in bundle: ${fullPath}`);
      hasViolation = true;
    }
  }
  return hasViolation;
}

const SCANNED_EXTENSIONS = ['.js', '.css', '.html'];

function scanDir(dir) {
  let hasViolation = false;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      hasViolation = scanDir(fullPath) || hasViolation;
    } else if (entry.isFile() && SCANNED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      hasViolation = scanFile(fullPath) || hasViolation;
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
