import { NextResponse } from 'next/server';
import { fetchReviews, resolveStoreDomain } from '@/lib/dashboard';
import { ingestReview } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeDomain = resolveStoreDomain(searchParams.get('shop'));
    const productId = searchParams.get('productId');
    let reviews = await fetchReviews(storeDomain, 200);
    if (productId) reviews = reviews.filter((r) => r.shopify_product_id === productId);
    return NextResponse.json({ reviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load reviews';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const storeDomain = resolveStoreDomain(body.storeDomain);
    if (!body.productId || !body.reviewText) {
      return NextResponse.json({ error: 'productId and reviewText are required' }, { status: 400 });
    }
    const result = await ingestReview({
      productId: String(body.productId),
      storeDomain,
      reviewText: String(body.reviewText),
      rating: typeof body.rating === 'number' ? body.rating : null,
      productTitle: body.productTitle,
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add review';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
