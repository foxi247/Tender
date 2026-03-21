// Local runner: same as .github/scripts/sync-tenders.js
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-tenders.mjs
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = readFileSync(join(__dirname, '../.github/scripts/sync-tenders.js'), 'utf8');

// Execute the sync script inline (it uses CommonJS-compatible syntax)
eval(script);
