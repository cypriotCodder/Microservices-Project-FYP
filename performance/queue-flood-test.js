#!/usr/bin/env node
/**
 * queue-flood-test.js
 * 
 * Floods the COMMENT_CREATED RabbitMQ queue and monitors depth in real-time.
 * Produces a JSON data file consumed by queue-depth-dashboard.html.
 *
 * Usage:
 *   node queue-flood-test.js [--duration 30] [--concurrency 50] [--rps 200]
 *
 * Prerequisites:
 *   - docker compose up -d  (all services + RabbitMQ running)
 *   - Products seeded:  curl -X POST http://localhost:8080/products/seed
 *   - Users seeded:     via seed script or manual register
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────────────────────────
const API_BASE = process.env.TARGET_URL || 'http://localhost:8080';
const RABBITMQ_API = 'http://localhost:15672/api';
const RABBITMQ_AUTH = Buffer.from('guest:guest').toString('base64');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? Number(args[idx + 1]) : defaultVal;
}

const FLOOD_DURATION_SEC = getArg('duration', 30);
const CONCURRENCY = getArg('concurrency', 50);
const TARGET_RPS = getArg('rps', 200);
const MONITOR_INTERVAL_MS = 500;
const DRAIN_TIMEOUT_SEC = 120;

// ─── HTTP helpers ──────────────────────────────────────────────────────────────
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const headers = { ...(options.headers || {}) };
    if (options.body) {
      headers['Content-Length'] = Buffer.byteLength(options.body);
    }
    const req = lib.request(url, {
      method: options.method || 'GET',
      headers,
      timeout: 30000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ─── RabbitMQ polling ──────────────────────────────────────────────────────────
async function getQueueDepth(queueName) {
  try {
    const res = await request(`${RABBITMQ_API}/queues/%2f/${queueName}`, {
      headers: { 'Authorization': `Basic ${RABBITMQ_AUTH}` }
    });
    const data = JSON.parse(res.body);
    return {
      total: data.messages || 0,
      ready: data.messages_ready || 0,
      unacked: data.messages_unacknowledged || 0,
      publishRate: data.message_stats?.publish_details?.rate || 0,
      deliverRate: data.message_stats?.deliver_get_details?.rate || 0,
      ackRate: data.message_stats?.ack_details?.rate || 0,
    };
  } catch (e) {
    return { total: 0, ready: 0, unacked: 0, publishRate: 0, deliverRate: 0, ackRate: 0 };
  }
}

// Also check the DLQ
async function getDLQDepth() {
  try {
    const res = await request(`${RABBITMQ_API}/queues/%2f/COMMENT_DLQ`, {
      headers: { 'Authorization': `Basic ${RABBITMQ_AUTH}` }
    });
    const data = JSON.parse(res.body);
    return data.messages || 0;
  } catch { return 0; }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     RabbitMQ COMMENT_CREATED Queue Flood Test              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Duration:    ${FLOOD_DURATION_SEC}s`);
  console.log(`  Concurrency: ${CONCURRENCY}`);
  console.log(`  Target RPS:  ${TARGET_RPS}`);
  console.log(`  API:         ${API_BASE}`);
  console.log(`  RabbitMQ:    ${RABBITMQ_API}\n`);

  // ── Step 1: Verify RabbitMQ is reachable ───────────────────────────────────
  process.stdout.write('① Checking RabbitMQ... ');
  try {
    const depth = await getQueueDepth('COMMENT_CREATED');
    console.log(`✅ Queue exists (current depth: ${depth.total})`);
  } catch (e) {
    console.log('❌ Cannot reach RabbitMQ Management API at localhost:15672');
    console.log('   Make sure docker compose is running.');
    process.exit(1);
  }

  // ── Step 2: Login to get JWT ───────────────────────────────────────────────
  process.stdout.write('② Logging in to get JWT token... ');
  const loginRes = await request(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin@fyp.com', password: 'admin' })
  });

  if (loginRes.status !== 200) {
    console.log(`❌ Login failed (${loginRes.status})`);
    console.log('   Seed users first: node seed-admin-micro.js');
    console.log(`   Response: ${loginRes.body}`);
    process.exit(1);
  }

  const { token, userId } = JSON.parse(loginRes.body);
  console.log(`✅ Got token for userId=${userId}`);

  // ── Step 3: Get a product ID ───────────────────────────────────────────────
  process.stdout.write('③ Fetching product catalog... ');
  const catalogRes = await request(`${API_BASE}/products`);
  const catalog = JSON.parse(catalogRes.body);
  const products = catalog.products || catalog;
  if (!products || products.length === 0) {
    console.log('❌ No products found. Seed first: curl -X POST http://localhost:8080/products/seed');
    process.exit(1);
  }
  const productId = products[0]._id || products[0].id;
  console.log(`✅ Using product: ${productId} (${products.length} total)`);

  // ── Step 4: Start monitoring ───────────────────────────────────────────────
  const dataPoints = [];
  const startTime = Date.now();
  let monitoring = true;
  let phase = 'FLOOD';
  let totalSent = 0;
  let totalErrors = 0;

  const monitorLoop = setInterval(async () => {
    const depth = await getQueueDepth('COMMENT_CREATED');
    const dlq = await getDLQDepth();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    dataPoints.push({
      time: Number(elapsed),
      total: depth.total,
      ready: depth.ready,
      unacked: depth.unacked,
      publishRate: depth.publishRate,
      deliverRate: depth.deliverRate,
      ackRate: depth.ackRate,
      dlq,
      phase,
      sent: totalSent,
    });

    // Live status line
    const bar = '█'.repeat(Math.min(50, Math.round(depth.total / 10))) || '▏';
    process.stdout.write(
      `\r  [${elapsed.padStart(6)}s] ${phase.padEnd(5)} | ` +
      `Queue: ${String(depth.total).padStart(5)} (R:${String(depth.ready).padStart(5)} U:${String(depth.unacked).padStart(5)}) | ` +
      `Pub: ${depth.publishRate.toFixed(0).padStart(4)}/s | ` +
      `Ack: ${depth.ackRate.toFixed(0).padStart(4)}/s | ` +
      `Sent: ${totalSent} | ${bar}`
    );
  }, MONITOR_INTERVAL_MS);

  // ── Step 5: Flood phase ────────────────────────────────────────────────────
  console.log('\n④ Starting comment flood...\n');

  const floodEnd = Date.now() + (FLOOD_DURATION_SEC * 1000);
  const delayBetweenRequests = Math.max(1, Math.floor(1000 / (TARGET_RPS / CONCURRENCY)));

  // Create worker pool
  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push((async () => {
      let seq = 0;
      while (Date.now() < floodEnd) {
        try {
          const commentPayload = JSON.stringify({
            userId: userId || 'flood-test',
            content: `k6 flood-test w${w} seq${seq++} t${Date.now()}`
          });

          // Pick a random product to spread load
          const pid = (products[Math.floor(Math.random() * products.length)]._id ||
            products[Math.floor(Math.random() * products.length)].id);

          await request(`${API_BASE}/products/${pid}/comments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: commentPayload
          });
          totalSent++;
        } catch (e) {
          totalErrors++;
        }

        // Pace the requests
        await new Promise(r => setTimeout(r, delayBetweenRequests));
      }
    })());
  }

  // Wait for all workers to finish
  await Promise.all(workers);
  phase = 'DRAIN';
  console.log(`\n\n⑤ Flood phase complete. Sent ${totalSent} comments (${totalErrors} errors).`);
  console.log('   Waiting for queue to drain...\n');

  // ── Step 6: Wait for drain ─────────────────────────────────────────────────
  const drainStart = Date.now();
  while (Date.now() - drainStart < DRAIN_TIMEOUT_SEC * 1000) {
    const depth = await getQueueDepth('COMMENT_CREATED');
    if (depth.total === 0) {
      console.log(`\n\n✅ Queue fully drained! Took ${((Date.now() - drainStart) / 1000).toFixed(1)}s`);
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // Stop monitoring
  clearInterval(monitorLoop);

  // Final data point
  const finalDepth = await getQueueDepth('COMMENT_CREATED');
  const finalDlq = await getDLQDepth();
  dataPoints.push({
    time: Number(((Date.now() - startTime) / 1000).toFixed(1)),
    total: finalDepth.total,
    ready: finalDepth.ready,
    unacked: finalDepth.unacked,
    publishRate: 0,
    deliverRate: 0,
    ackRate: finalDepth.ackRate,
    dlq: finalDlq,
    phase: 'DONE',
    sent: totalSent,
  });

  // ── Step 7: Save results ───────────────────────────────────────────────────
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const outputFile = path.join(resultsDir, 'queue-depth-data.json');
  const output = {
    meta: {
      startTime: new Date(startTime).toISOString(),
      floodDurationSec: FLOOD_DURATION_SEC,
      concurrency: CONCURRENCY,
      targetRPS: TARGET_RPS,
      totalSent,
      totalErrors,
    },
    data: dataPoints,
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n\n📊 Data saved to: ${outputFile}`);
  console.log(`📈 Open queue-depth-dashboard.html to visualize the results.`);

  // ── Step 8: Cleanup k6 flood comments ──────────────────────────────────────
  process.stdout.write('\n⑥ Cleaning up flood-test comments... ');
  try {
    await request(`${API_BASE}/products/comments/k6`, { method: 'DELETE' });
    console.log('✅ Done');
  } catch (e) {
    console.log('⚠️  Cleanup request failed (non-critical)');
  }

  console.log('\n✨ Test complete!\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
