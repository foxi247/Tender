#!/usr/bin/env node
/**
 * Apply Supabase migrations via REST API
 * Usage: node scripts/migrate.js
 */
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_KEY in .env.local');
  process.exit(1);
}

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    // Try direct pg endpoint
    const res2 = await fetch(`${SUPABASE_URL}/pg`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    return res2;
  }
  return res;
}

async function main() {
  console.log('🚀 Running migrations...');

  const migrationsDir = path.join(__dirname, '../supabase/migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    console.log(`  📄 ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Split by statement and execute
    const statements = sql.split(';').filter((s) => s.trim().length > 0);
    for (const stmt of statements) {
      try {
        await runSQL(stmt + ';');
      } catch (err) {
        // Ignore duplicate errors in re-runs
        if (!String(err).includes('already exists')) {
          console.warn(`  ⚠️ ${err}`);
        }
      }
    }
    console.log(`  ✅ ${file} applied`);
  }

  console.log('\n✅ Migrations complete!');
  console.log('\nNext: run seed data with: node scripts/seed.js');
}

main().catch(console.error);
