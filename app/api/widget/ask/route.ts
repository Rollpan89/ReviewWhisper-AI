import { NextResponse } from 'next/server';
import { answerQuestion, NO_INFO_ANSWER } from '@/lib/ai';
import { logQuestion, searchReviews } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const { productId, storeDomain, question } = await req.json();

    if (!productId || !storeDomain || !question) {
      return NextResponse.json(
        { error: 'Payload missing data keys: productId, storeDomain, question' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const trimmed = String(question).slice(0, 500).trim();
    const reviews = await searchReviews(trimmed, String(productId), String(storeDomain));
    const answer = await answerQuestion(trimmed, reviews);

    await logQuestion({
      storeDomain: String(storeDomain),
      productId: String(productId),
      question: trimmed,
      answer,
      matched: reviews.length,
      answered: answer !== NO_INFO_ANSWER,
    });

    return NextResponse.json(
      {
        response: answer,
        sources: reviews.map((r) => ({
          text: r.review_text,
          rating: r.rating,
          similarity: r.similarity,
        })),
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assistant request failed';
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
