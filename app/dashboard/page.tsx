'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BarChart3,
  MessageSquare,
  Plus,
  RefreshCw,
  Star,
  Store,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Stats = {
  storeDomain: string;
  planStatus: string;
  demoMode: boolean;
  totalReviews: number;
  totalQuestions: number;
  answeredRate: number;
  averageRating: number | null;
  unansweredCount: number;
  products: Array<{ productId: string; title: string; reviewCount: number; averageRating: number | null }>;
  questionsPerDay: Array<{ date: string; count: number }>;
};

type Review = {
  id: string;
  shopify_product_id: string;
  review_text: string;
  rating: number | null;
  created_at: string;
};

type Question = {
  id: string;
  shopify_product_id: string;
  question: string;
  answer: string | null;
  matched_reviews: number;
  answered: boolean;
  created_at: string;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const DEFAULT_SHOP = 'demo-store.myshopify.com';

const EMPTY_SUBSCRIBE = () => () => {};

/** Client-only browser origin without triggering a hydration mismatch. */
function useOrigin(): string {
  return useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => window.location.origin,
    () => '',
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading dashboard…</div>}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const searchParams = useSearchParams();
  const shopParam = searchParams.get('shop') ?? DEFAULT_SHOP;
  const [shop, setShop] = useState(shopParam);
  const [shopInput, setShopInput] = useState(shopParam);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const query = `?shop=${encodeURIComponent(shop)}`;
    setLoading(true);
    setError(null);
    try {
      const [s, r, q] = await Promise.all([
        fetch(`/api/dashboard/stats${query}`).then((res) => res.json()),
        fetch(`/api/dashboard/reviews${query}`).then((res) => res.json()),
        fetch(`/api/dashboard/questions${query}`).then((res) => res.json()),
      ]);
      if (s.error) throw new Error(s.error);
      setStats(s);
      setReviews(r.reviews ?? []);
      setQuestions(q.questions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    // Data fetch on mount / shop change; state updates happen asynchronously
    // once the network round-trip resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, reloadToken]);

  const refresh = useCallback(() => {
    setReloadToken((t) => t + 1);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-900">ReviewWhisper AI</h1>
              <p className="text-xs text-zinc-500">Merchant dashboard</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-1.5">
              <Store className="h-4 w-4 text-zinc-400" />
              <input
                value={shopInput}
                onChange={(e) => setShopInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setShop(shopInput.trim() || DEFAULT_SHOP);
                }}
                className="w-56 bg-transparent text-sm outline-none"
                aria-label="Store domain"
              />
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {stats?.demoMode && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong className="font-semibold">Demo mode.</strong> No Supabase or OpenAI
              credentials detected, so the platform is running on an in-memory store with seeded
              reviews and deterministic lexical retrieval. Add the keys from{' '}
              <code className="rounded bg-amber-100 px-1">.env.example</code> to switch to live
              pgvector + GPT-4o-mini.
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Indexed reviews" value={stats?.totalReviews ?? '—'} icon={<BarChart3 className="h-4 w-4" />} />
          <StatCard label="Buyer questions" value={stats?.totalQuestions ?? '—'} icon={<MessageSquare className="h-4 w-4" />} />
          <StatCard label="Answer rate" value={stats ? `${stats.answeredRate}%` : '—'} icon={<BarChart3 className="h-4 w-4" />} />
          <StatCard
            label="Average rating"
            value={stats?.averageRating != null ? `${stats.averageRating} / 5` : '—'}
            icon={<Star className="h-4 w-4" />}
          />
        </section>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="playground">Playground</TabsTrigger>
            <TabsTrigger value="install">Install</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Questions over the last 7 days</CardTitle>
                  <CardDescription>Widget conversations logged per day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Sparkline data={stats?.questionsPerDay ?? []} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Products by review coverage</CardTitle>
                  <CardDescription>Where the assistant has the most context.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(stats?.products ?? []).length === 0 && (
                    <p className="text-sm text-zinc-500">No reviews indexed yet.</p>
                  )}
                  {(stats?.products ?? []).map((p) => (
                    <div key={p.productId} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">{p.title}</p>
                        <p className="text-xs text-zinc-500">ID {p.productId}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.averageRating != null && (
                          <Badge tone="muted">
                            <Star className="mr-1 h-3 w-3" />
                            {p.averageRating}
                          </Badge>
                        )}
                        <Badge tone="success">{p.reviewCount} reviews</Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Tenant status</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <Info label="Store domain" value={stats?.storeDomain ?? shop} />
                  <Info label="Plan status" value={stats?.planStatus ?? '—'} />
                  <Info label="Unanswered questions" value={String(stats?.unansweredCount ?? 0)} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            <ReviewsTab shop={shop} reviews={reviews} onAdded={refresh} />
          </TabsContent>

          <TabsContent value="questions">
            <Card>
              <CardHeader>
                <CardTitle>Buyer questions</CardTitle>
                <CardDescription>Every widget conversation, newest first.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[520px] space-y-3 pr-2">
                  {questions.length === 0 && <p className="text-sm text-zinc-500">No questions yet.</p>}
                  {questions.map((q) => (
                    <div key={q.id} className="mb-3 rounded-lg border border-zinc-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-zinc-900">{q.question}</p>
                        <Badge tone={q.answered ? 'success' : 'warning'}>
                          {q.answered ? `${q.matched_reviews} sources` : 'no data'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600">{q.answer}</p>
                      <p className="mt-2 text-xs text-zinc-400">
                        Product {q.shopify_product_id} · {new Date(q.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playground">
            <Playground shop={shop} products={stats?.products ?? []} onAsked={refresh} />
          </TabsContent>

          <TabsContent value="install">
            <InstallTab shop={shop} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{value}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">{icon}</div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function Sparkline({ data }: { data: Array<{ date: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) return <p className="text-sm text-zinc-500">No activity yet.</p>;
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t bg-zinc-900/80"
            style={{ height: `${Math.max(4, (d.count / max) * 120)}px` }}
            title={`${d.count} questions`}
          />
          <span className="text-[10px] text-zinc-500">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({
  shop,
  reviews,
  onAdded,
}: {
  shop: string;
  reviews: Review[];
  onAdded: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState('5');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!productId.trim() || !reviewText.trim()) {
      setMessage('Product ID and review text are required.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dashboard/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeDomain: shop,
          productId: productId.trim(),
          reviewText: reviewText.trim(),
          rating: Number(rating),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setReviewText('');
      setMessage('Review indexed.');
      onAdded();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add review');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Indexed reviews</CardTitle>
          <CardDescription>{reviews.length} reviews available to the assistant.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[520px] pr-2">
            {reviews.length === 0 && <p className="text-sm text-zinc-500">Nothing indexed yet.</p>}
            {reviews.map((r) => (
              <div key={r.id} className="mb-3 rounded-lg border border-zinc-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-zinc-500">Product {r.shopify_product_id}</span>
                  {r.rating != null && <Badge tone="muted">{'★'.repeat(r.rating)}</Badge>}
                </div>
                <p className="mt-2 text-sm text-zinc-700">{r.review_text}</p>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Add a review manually</CardTitle>
          <CardDescription>Ingests through the same embedding pipeline as the webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Shopify product ID" value={productId} onChange={(e) => setProductId(e.target.value)} />
          <Textarea placeholder="Review text" value={reviewText} onChange={(e) => setReviewText(e.target.value)} />
          <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
          <Button onClick={() => void submit()} disabled={saving} className="w-full">
            <Plus className="h-4 w-4" />
            {saving ? 'Indexing…' : 'Index review'}
          </Button>
          {message && <p className="text-xs text-zinc-500">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function Playground({
  shop,
  products,
  onAsked,
}: {
  shop: string;
  products: Array<{ productId: string; title: string }>;
  onAsked: () => void;
}) {
  const [productId, setProductId] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showSources, setShowSources] = useState(true);
  const [sources, setSources] = useState<Array<{ text: string; similarity: number }>>([]);
  const [busy, setBusy] = useState(false);

  const activeProduct = useMemo(
    () => productId || products[0]?.productId || '',
    [productId, products],
  );

  async function ask() {
    const q = question.trim();
    if (!q || !activeProduct || busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', content: q }]);
    setQuestion('');
    try {
      const res = await fetch('/api/widget/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: activeProduct, storeDomain: shop, question: q }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.response ?? data.error }]);
      setSources(data.sources ?? []);
      onAsked();
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Request failed.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Widget playground</CardTitle>
          <CardDescription>Exercises the same /api/widget/ask endpoint as the storefront.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={activeProduct}
            onChange={(e) => setProductId(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
          >
            {products.length === 0 && <option value="">No products indexed</option>}
            {products.map((p) => (
              <option key={p.productId} value={p.productId}>
                {p.title} ({p.productId})
              </option>
            ))}
          </select>

          <ScrollArea className="h-72 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            {messages.length === 0 && (
              <p className="text-sm text-zinc-500">
                Try: “Is it true to size?”, “Does the wool itch?”, “Are these waterproof?”
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'mb-3 text-right' : 'mb-3 text-left'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'inline-block max-w-[85%] rounded-lg bg-zinc-900 px-3 py-2 text-left text-sm text-white'
                      : 'inline-block max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-zinc-400">AI is thinking…</p>}
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              value={question}
              placeholder="Ask about fit, material, quality…"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void ask();
              }}
            />
            <Button onClick={() => void ask()} disabled={busy}>
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Retrieved sources</CardTitle>
          <CardDescription>
            <span className="flex items-center gap-2 pt-1">
              <Switch checked={showSources} onCheckedChange={setShowSources} id="sources" />
              <label htmlFor="sources" className="text-sm text-zinc-600">
                Show matched reviews
              </label>
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!showSources && <p className="text-sm text-zinc-500">Hidden.</p>}
          {showSources && sources.length === 0 && <p className="text-sm text-zinc-500">No sources yet.</p>}
          {showSources &&
            sources.map((s, i) => (
              <div key={i} className="rounded-lg border border-zinc-200 p-3">
                <p className="text-xs text-zinc-500">similarity {s.similarity}</p>
                <p className="mt-1 text-sm text-zinc-700">{s.text}</p>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function InstallTab({ shop }: { shop: string }) {
  const origin = useOrigin();

  const snippet = `<script src="${origin}/widget.js" data-product-id="{{ product.id }}" data-store-domain="${shop}" defer></script>`;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Automatic installation</CardTitle>
          <CardDescription>The OAuth callback registers the script tag for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-600">
          <p>Open the install URL with your shop domain:</p>
          <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
            {`${origin}/api/auth/shopify?shop=${shop}`}
          </pre>
          <p>
            Shopify redirects back to the callback, which stores the access token, injects{' '}
            <code>widget.js</code> and starts the $29/month recurring charge.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual theme snippet</CardTitle>
          <CardDescription>Paste into your product template if you prefer.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">{snippet}</pre>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Live widget demo</CardTitle>
          <CardDescription>A simulated product page with the real storefront widget.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => window.open('/demo', '_blank')}>
            Open demo storefront
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
