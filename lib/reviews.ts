import { getSupabase } from './supabase';
import { embed } from './ai';
import {
  demoDb,
  lexicalMatch,
  type MatchedReview,
  type ReviewRow,
} from './demo-store';

export const MATCH_THRESHOLD = 0.35;
export const MATCH_COUNT = 5;

/** Whether a Supabase-backed request is possible. */
export function isLive(): boolean {
  return getSupabase() !== null;
}

export type IngestInput = {
  productId: string;
  storeDomain: string;
  reviewText: string;
  rating?: number | null;
  productTitle?: string;
};

export async function ingestReview(input: IngestInput): Promise<{ id: string; embedded: boolean }> {
  const supabase = getSupabase();
  const embedding = await embed(input.reviewText);

  if (supabase) {
    const { data, error } = await supabase
      .from('product_reviews')
      .insert({
        shopify_product_id: String(input.productId),
        store_domain: input.storeDomain,
        review_text: input.reviewText,
        rating: input.rating ?? null,
        embedding,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id as string, embedded: embedding !== null };
  }

  const db = demoDb();
  const row: ReviewRow = {
    id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    shopify_product_id: String(input.productId),
    store_domain: input.storeDomain,
    product_title: input.productTitle,
    review_text: input.reviewText,
    rating: input.rating ?? null,
    created_at: new Date().toISOString(),
  };
  db.reviews.unshift(row);
  return { id: row.id, embedded: false };
}

export async function searchReviews(
  question: string,
  productId: string,
  storeDomain: string,
): Promise<MatchedReview[]> {
  const supabase = getSupabase();
  const embedding = await embed(question);

  if (supabase && embedding) {
    const { data, error } = await supabase.rpc('match_reviews', {
      query_embedding: embedding,
      match_threshold: MATCH_THRESHOLD,
      match_count: MATCH_COUNT,
      filter_product_id: String(productId),
      filter_store_domain: storeDomain,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as MatchedReview[];
  }

  if (supabase && !embedding) {
    // Supabase configured but no OpenAI key: fall back to lexical scoring
    // over the tenant's stored reviews.
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id, shopify_product_id, store_domain, review_text, rating, created_at')
      .eq('shopify_product_id', String(productId))
      .eq('store_domain', storeDomain)
      .limit(200);
    if (error) throw new Error(error.message);
    return lexicalMatch(question, (data ?? []) as ReviewRow[], MATCH_COUNT, 0.05);
  }

  const corpus = demoDb().reviews.filter(
    (r) => r.shopify_product_id === String(productId) && r.store_domain === storeDomain,
  );
  return lexicalMatch(question, corpus, MATCH_COUNT, 0.05);
}

export async function logQuestion(params: {
  storeDomain: string;
  productId: string;
  question: string;
  answer: string;
  matched: number;
  answered: boolean;
}): Promise<void> {
  const supabase = getSupabase();
  const payload = {
    store_domain: params.storeDomain,
    shopify_product_id: String(params.productId),
    question: params.question,
    answer: params.answer,
    matched_reviews: params.matched,
    answered: params.answered,
  };

  if (supabase) {
    await supabase.from('widget_questions').insert(payload);
    return;
  }

  demoDb().questions.unshift({
    ...payload,
    id: `question-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  });
}
