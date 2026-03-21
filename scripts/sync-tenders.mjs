// Sync tenders by calling the Vercel /api/sync endpoint
// The actual fetch to zakupki.gov.ru runs on Vercel (AWS), not locally
//
// Usage:
//   VERCEL_APP_URL=https://your-app.vercel.app CRON_SECRET=xxx node scripts/sync-tenders.mjs
//   VERCEL_APP_URL=https://your-app.vercel.app CRON_SECRET=xxx node scripts/sync-tenders.mjs --slot 3

const VERCEL_APP_URL = process.env.VERCEL_APP_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const TOTAL_SLOTS = 13;

if (!VERCEL_APP_URL) {
  console.error('Missing VERCEL_APP_URL env variable');
  console.error('Example: VERCEL_APP_URL=https://your-app.vercel.app CRON_SECRET=xxx node scripts/sync-tenders.mjs');
  process.exit(1);
}

async function syncSlot(slot) {
  const url = `${VERCEL_APP_URL}/api/sync?slot=${slot}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {},
    signal: AbortSignal.timeout(30000),
  });

  const body = await res.json().catch(() => ({}));
  return { slot, status: res.status, ...body };
}

async function main() {
  const slotArg = process.argv.indexOf('--slot');
  const singleSlot = slotArg !== -1 ? parseInt(process.argv[slotArg + 1], 10) : null;

  const slots = singleSlot !== null ? [singleSlot] : Array.from({ length: TOTAL_SLOTS }, (_, i) => i);

  console.log(`Syncing ${slots.length} slot(s) via ${VERCEL_APP_URL}`);
  console.log('');

  let success = 0;
  let fail = 0;
  let totalFetched = 0;
  let totalSaved = 0;

  for (const slot of slots) {
    try {
      const result = await syncSlot(slot);
      const ok = result.ok !== false && result.status === 200;
      if (ok) {
        success++;
        totalFetched += result.fetched ?? 0;
        totalSaved += result.saved ?? 0;
        console.log(`  [${slot}] ✓ ${result.keyword ?? ''}: fetched=${result.fetched ?? 0} saved=${result.saved ?? 0}`);
      } else {
        fail++;
        console.error(`  [${slot}] ✗ HTTP ${result.status} — ${result.error ?? JSON.stringify(result)}`);
      }
    } catch (err) {
      fail++;
      console.error(`  [${slot}] ✗ ${err.message}`);
    }

    if (slots.length > 1) await new Promise(r => setTimeout(r, 1500));
  }

  console.log('');
  console.log(`Done: ${success} succeeded, ${fail} failed`);
  console.log(`Total: fetched=${totalFetched}, saved=${totalSaved}`);

  if (success === 0) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
