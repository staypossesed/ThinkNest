#!/usr/bin/env node
/**
 * Test Stripe billing configuration.
 * Run: node scripts/test-billing.mjs
 * Requires: backend running on http://localhost:8787
 */
const BASE = process.env.BACKEND_URL || "http://localhost:8787";

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (e) {
    console.log(`✗ ${name}:`, e.message);
    return false;
  }
}

async function main() {
  console.log("Testing Stripe billing config at", BASE, "\n");

  let passed = 0;
  let failed = 0;

  const ok1 = await test("GET /billing/status", async () => {
    const res = await fetch(`${BASE}/billing/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.configured && !data.hasPrices) throw new Error("Stripe not configured");
    if (data.configured && !data.hasPrices) throw new Error("Missing price IDs");
    if (data.configured && !data.hasSuccessUrl) throw new Error("Missing STRIPE_SUCCESS_URL");
    if (data.configured && !data.hasCancelUrl) throw new Error("Missing STRIPE_CANCEL_URL");
  });
  ok1 ? passed++ : failed++;

  const ok2 = await test("GET /health", async () => {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error("Health check failed");
  });
  ok2 ? passed++ : failed++;

  console.log("\n---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
