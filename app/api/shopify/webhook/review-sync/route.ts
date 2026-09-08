import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { env, hasShopify } from '@/lib/env';
import { ingestReview } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

/** Verifies Shopify's base64 HMAC over the raw request body. */
function verifyWebhook(rawBody: string, header: string | null): boolean {
  if (!header || !hasShopify) return false;
  const digest = createHmac('sha256', env.shopifyApiSecret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(header, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

type Payload = {
  productId?: string | number;
  storeDomain?: string;
  reviewText?: string;
  rating?: number | null;
  productTitle?: string;
  reviews?: Array<{
    productId: string | number;
    reviewText: string;
    rating?: number | null;
    productTitle?: string;
  }>;
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');

    // When Shopify signs the request we always validate it. Unsigned requests
    // are accepted only for local/demo ingestion.
    if (hmacHeader && !verifyWebhook(rawBody, hmacHeader)) {
      return NextResponse.json({ error: 'Webhook HMAC validation failed' }, { status: 401 });
    }

    const body = JSON.parse(rawBody || '{}') as Payload;
    const storeDomain =
      body.storeDomain ?? req.headers.get('x-shopify-shop-domain') ?? undefined;

    if (!storeDomain) {
      return NextResponse.json({ error: 'Required attributes are missing: storeDomain' }, { status: 400 });
    }

    // Batch mode
    if (Array.isArray(body.reviews) && body.reviews.length > 0) {
      const results = [];
      for (const review of body.reviews) {
        if (!review.productId || !review.reviewText) continue;
        results.push(
          await ingestReview({
            productId: String(review.productId),
            storeDomain,
            reviewText: review.reviewText,
            rating: review.rating ?? null,
            productTitle: review.productTitle,
          }),
        );
      }
      return NextResponse.json({ success: true, ingested: results.length }, { status: 200 });
    }

    // Single review mode
    if (!body.productId || !body.reviewText) {
      return NextResponse.json(
        { error: 'Required attributes are missing: productId, reviewText' },
        { status: 400 },
      );
    }

    const result = await ingestReview({
      productId: String(body.productId),
      storeDomain,
      reviewText: body.reviewText,
      rating: body.rating ?? null,
      productTitle: body.productTitle,
    });

    return NextResponse.json({ success: true, id: result.id, embedded: result.embedded }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ingestion failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
