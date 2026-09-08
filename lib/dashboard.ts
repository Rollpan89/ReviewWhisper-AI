import { getSupabase } from './supabase';
import { DEMO_STORE_DOMAIN, demoDb, type QuestionRow, type ReviewRow } from './demo-store';
import { isDemoMode } from './env';

export type ProductSummary = {
  productId: string;
  title: string;
  reviewCount: number;
  averageRating: number | null;
};

export type DashboardStats = {
  storeDomain: string;
  planStatus: string;
  demoMode: boolean;
  totalReviews: number;
  totalQuestions: number;
  answeredRate: number;
  averageRating: number | null;
  unansweredCount: number;
  products: ProductSummary[];
  questionsPerDay: Array<{ date: string; count: number }>;
};

export function resolveStoreDomain(input?: string | null): string {
  return input && input.trim() ? input.trim() : DEMO_STORE_DOMAIN;
}

export async function fetchReviews(storeDomain: string, limit = 200): Promise<ReviewRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return demoDb()
      .reviews.filter((r) => r.store_domain === storeDomain)
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from('product_reviews')
    .select('id, shopify_product_id, store_domain, review_text, rating, created_at')
    .eq('store_domain', storeDomain)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ReviewRow[];
}

export async function fetchQuestions(storeDomain: string, limit = 100): Promise<QuestionRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return demoDb()
      .questions.filter((q) => q.store_domain === storeDomain)
      .slice(0, limit);
  }
  const { data, error } = await supabase
    .from('widget_questions')
    .select('*')
    .eq('store_domain', storeDomain)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as QuestionRow[];
}

async function fetchPlanStatus(storeDomain: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    return demoDb().merchants.find((m) => m.shopify_domain === storeDomain)?.plan_status ?? 'demo';
  }
  const { data } = await supabase
    .from('merchants')
    .select('plan_status')
    .eq('shopify_domain', storeDomain)
    .maybeSingle();
  return (data?.plan_status as string) ?? 'not installed';
}

export async function buildStats(storeDomain: string): Promise<DashboardStats> {
  const [reviews, questions, planStatus] = await Promise.all([
    fetchReviews(storeDomain, 500),
    fetchQuestions(storeDomain, 500),
    fetchPlanStatus(storeDomain),
  ]);

  const byProduct = new Map<string, { count: number; ratings: number[]; title: string }>();
  for (const review of reviews) {
    const key = review.shopify_product_id;
    const entry = byProduct.get(key) ?? {
      count: 0,
      ratings: [],
      title: review.product_title ?? `Product ${key}`,
    };
    entry.count += 1;
    if (typeof review.rating === 'number') entry.ratings.push(review.rating);
    if (review.product_title) entry.title = review.product_title;
    byProduct.set(key, entry);
  }

  const products: ProductSummary[] = [...byProduct.entries()]
    .map(([productId, entry]) => ({
      productId,
      title: entry.title,
      reviewCount: entry.count,
      averageRating: entry.ratings.length
        ? Number((entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length).toFixed(2))
        : null,
    }))
    .sort((a, b) => b.reviewCount - a.reviewCount);

  const allRatings = reviews
    .map((r) => r.rating)
    .filter((r): r is number => typeof r === 'number');

  const answered = questions.filter((q) => q.answered).length;

  const dayBuckets = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    dayBuckets.set(d, 0);
  }
  for (const q of questions) {
    const day = q.created_at.slice(0, 10);
    if (dayBuckets.has(day)) dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
  }

  return {
    storeDomain,
    planStatus,
    demoMode: isDemoMode,
    totalReviews: reviews.length,
    totalQuestions: questions.length,
    answeredRate: questions.length ? Math.round((answered / questions.length) * 100) : 0,
    averageRating: allRatings.length
      ? Number((allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2))
      : null,
    unansweredCount: questions.length - answered,
    products,
    questionsPerDay: [...dayBuckets.entries()].map(([date, count]) => ({ date, count })),
  };
}
