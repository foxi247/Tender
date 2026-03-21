#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/deleteWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drop_pending_updates: true }),
  });
  const data = await res.json();
  console.log(data.ok ? '✅ Webhook deleted' : `❌ ${data.description}`);
}

main().catch(console.error);
