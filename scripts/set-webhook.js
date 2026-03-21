#!/usr/bin/env node
/**
 * Set Telegram webhook
 * Usage: WEBHOOK_URL=https://your-domain.com node scripts/set-webhook.js
 */
require('dotenv').config({ path: '.env.local' });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const WEBHOOK_URL = process.argv[2] || process.env.WEBHOOK_URL;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('❌ Pass webhook URL as argument: node scripts/set-webhook.js https://your-domain.com/api/webhook');
  process.exit(1);
}

async function main() {
  const url = WEBHOOK_URL.endsWith('/api/webhook') ? WEBHOOK_URL : `${WEBHOOK_URL}/api/webhook`;

  console.log(`Setting webhook to: ${url}`);

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: SECRET,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    }),
  });

  const data = await res.json();
  if (data.ok) {
    console.log('✅ Webhook set successfully!');
    console.log(`   URL: ${url}`);
  } else {
    console.error('❌ Failed:', data.description);
  }

  // Show webhook info
  const info = await fetch(`https://api.telegram.org/bot${TOKEN}/getWebhookInfo`);
  const infoData = await info.json();
  console.log('\n📊 Webhook info:', JSON.stringify(infoData.result, null, 2));
}

main().catch(console.error);
