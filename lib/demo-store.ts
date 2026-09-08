/**
 * In-memory tenant store used when Supabase/OpenAI credentials are absent.
 *
 * It mirrors the shape of the Postgres tables one-to-one so that the API
 * routes can switch between the two backends without branching on shape.
 * Retrieval uses a deterministic lexical similarity (token overlap + IDF)
 * instead of vector cosine distance, which keeps the widget fully functional
 * offline.
 */

import seed from './demo-reviews.json';

export type ReviewRow = {
  id: string;
  shopify_product_id: string;
  store_domain: string;
  product_title?: string;
  review_text: string;
  rating: number | null;
  created_at: string;
};

export type QuestionRow = {
  id: string;
  store_domain: string;
  shopify_product_id: string;
  question: string;
  answer: string | null;
  matched_reviews: number;
  answered: boolean;
  created_at: string;
};

export type MerchantRow = {
  id: string;
  shopify_domain: string;
  access_token: string;
  plan_status: string;
  created_at: string;
};

type DemoDb = {
  merchants: MerchantRow[];
  reviews: ReviewRow[];
  questions: QuestionRow[];
};

const globalRef = globalThis as unknown as { __rwDemoDb?: DemoDb };

function bootstrap(): DemoDb {
  const now = Date.now();
  const reviews: ReviewRow[] = (seed as Omit<ReviewRow, 'id' | 'created_at'>[]).map(
    (row, index) => ({
      ...row,
      rating: row.rating ?? null,
      id: `demo-review-${index + 1}`,
      created_at: new Date(now - (index + 1) * 36e5 * 7).toISOString(),
    }),
  );

  const merchants: MerchantRow[] = [
    {
      id: 'demo-merchant-1',
      shopify_domain: 'demo-store.myshopify.com',
      access_token: 'demo-token',
      plan_status: 'active',
      created_at: new Date(now - 30 * 864e5).toISOString(),
    },
  ];

  const sampleQuestions: Array<[string, string, string, number]> = [
    ['8123456789', 'Is this sweater true to size?', 'Buyers are split: several say it runs about half a size small in the shoulders, while a 180 cm buyer found the medium true to size.', 3],
    ['8123456789', 'Does the wool itch?', 'No — reviewers describe the merino as soft with no itching, even worn directly on the skin.', 2],
    ['8987654321', 'Are these sneakers waterproof?', 'No. One buyer reported heavy rain soaking through the seams, taking a full day to dry.', 2],
    ['8987654321', 'What size should I order?', 'Buyers recommend ordering a full size up; an EU 42 was reported as tight across the toe box.', 2],
    ['8555512345', 'Does it fit in a fridge door?', 'It fits on a fridge door shelf, but only just — buyers suggest measuring yours first.', 1],
    ['8123456789', 'Can I tumble dry it?', 'Reviewers advise against it; one buyer saw slight shrinkage after tumble drying.', 2],
    ['8555512345', 'How long should I steep the coffee?', 'An 18 hour steep in the fridge with coarse ground coffee gave the smoothest result.', 1],
    ['8987654321', 'Do they run hot in summer?', "We don't have enough buyer information to answer this specific question yet.", 0],
  ];

  const questions: QuestionRow[] = sampleQuestions.map(
    ([productId, question, answer, matched], index) => ({
      id: `demo-question-${index + 1}`,
      store_domain: 'demo-store.myshopify.com',
      shopify_product_id: productId,
      question,
      answer,
      matched_reviews: matched,
      answered: matched > 0,
      created_at: new Date(now - (index + 1) * 5.5 * 36e5).toISOString(),
    }),
  );

  return { merchants, reviews, questions };
}

export function demoDb(): DemoDb {
  if (!globalRef.__rwDemoDb) globalRef.__rwDemoDb = bootstrap();
  return globalRef.__rwDemoDb;
}

export const DEMO_STORE_DOMAIN = 'demo-store.myshopify.com';

/* -------------------------------------------------------------------------- */
/* Lexical retrieval                                                           */
/* -------------------------------------------------------------------------- */

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'did', 'do',
  'does', 'for', 'from', 'has', 'have', 'how', 'i', 'if', 'in', 'is', 'it',
  'its', 'me', 'my', 'of', 'on', 'or', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'to', 'was', 'were', 'what', 'when',
  'where', 'which', 'will', 'with', 'would', 'you', 'your',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9åäö\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function stem(token: string): string {
  return token.replace(/(ing|ed|es|s)$/u, '') || token;
}

export type MatchedReview = {
  id: string;
  review_text: string;
  rating: number | null;
  similarity: number;
};

/** Deterministic IDF-weighted overlap scoring, normalised to 0..1. */
export function lexicalMatch(
  question: string,
  corpus: ReviewRow[],
  matchCount: number,
  threshold: number,
): MatchedReview[] {
  if (corpus.length === 0) return [];

  const qTokens = [...new Set(tokenize(question).map(stem))];
  if (qTokens.length === 0) return [];

  const docTokens = corpus.map((r) => new Set(tokenize(r.review_text).map(stem)));

  const idf = new Map<string, number>();
  for (const token of qTokens) {
    const df = docTokens.filter((d) => d.has(token)).length;
    idf.set(token, Math.log((corpus.length + 1) / (df + 1)) + 1);
  }
  const maxScore = qTokens.reduce((sum, t) => sum + (idf.get(t) ?? 0), 0) || 1;

  return corpus
    .map((review, index) => {
      const doc = docTokens[index];
      const score = qTokens.reduce(
        (sum, token) => sum + (doc.has(token) ? (idf.get(token) ?? 0) : 0),
        0,
      );
      return {
        id: review.id,
        review_text: review.review_text,
        rating: review.rating,
        similarity: Number((score / maxScore).toFixed(4)),
      };
    })
    .filter((r) => r.similarity > threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}
