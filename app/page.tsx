import Link from 'next/link';
import { MessageSquare, Sparkles, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="font-semibold text-zinc-900">ReviewWhisper AI</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/demo" className="text-zinc-600 hover:text-zinc-900">
              Demo store
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800"
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
          <Sparkles className="h-3 w-3" /> Multi-tenant Shopify micro-SaaS
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          Let shoppers ask your past buyers anything.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600">
          ReviewWhisper embeds every product review as a vector, then answers buyer questions on the
          product page with retrieval-augmented generation — grounded strictly in verified feedback.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Merchant dashboard
          </Link>
          <Link
            href="/demo"
            className="rounded-lg border border-zinc-200 px-5 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Try the storefront widget
          </Link>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <Feature
            icon={<Zap className="h-4 w-4" />}
            title="Vector ingestion"
            body="Reviews stream in via webhook, get embedded with text-embedding-3-small and land in pgvector with an HNSW cosine index."
          />
          <Feature
            icon={<MessageSquare className="h-4 w-4" />}
            title="Grounded answers"
            body="Top-5 cosine matches above a 0.35 threshold are handed to GPT-4o-mini, which must answer from the reviews or say it doesn't know."
          />
          <Feature
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Tenant isolation"
            body="Every query is scoped by store domain and product ID, with RLS enabled and all access via the service role on the server."
          />
        </div>
      </section>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-5">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600">{body}</p>
    </div>
  );
}
