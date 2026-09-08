#!/usr/bin/env node
/**
 * Seeds reviews into a running ReviewWhisper instance through the public
 * ingestion endpoint (embeddings are generated server-side).
 *
 *   node scripts/seed-reviews.mjs [baseUrl] [storeDomain]
 *
 * Defaults: http://localhost:3000, demo-store.myshopify.com
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const storeDomain = process.argv[3] ?? 'demo-store.myshopify.com';

const raw = await readFile(join(here, '..', 'lib', 'demo-reviews.json'), 'utf8');
const seed = JSON.parse(raw);

const payload = {
  storeDomain,
  reviews: seed.map((r) => ({
    productId: r.shopify_product_id,
    reviewText: r.review_text,
    rating: r.rating,
    productTitle: r.product_title,
  })),
};

const res = await fetch(`${baseUrl}/api/shopify/webhook/review-sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

const data = await res.json();
if (!res.ok) {
  console.error('Seeding failed:', data);
  process.exit(1);
}
console.log(`Seeded ${data.ingested} reviews into ${storeDomain} via ${baseUrl}`);
