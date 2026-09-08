-- ============================================================================
-- ReviewWhisper AI — Supabase / PostgreSQL schema
-- Run this in the Supabase SQL editor (or `psql`) for your project.
-- ============================================================================

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Table 1: Multi-tenant merchant records
-- ---------------------------------------------------------------------------
create table if not exists merchants (
  id uuid default gen_random_uuid() primary key,
  shopify_domain text unique not null,
  access_token text not null,
  plan_status text default 'active',
  subscription_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ---------------------------------------------------------------------------
-- Table 2: Product review vector base
-- ---------------------------------------------------------------------------
create table if not exists product_reviews (
  id uuid default gen_random_uuid() primary key,
  shopify_product_id text not null,
  store_domain text not null,
  review_text text not null,
  rating integer,
  embedding vector(1536),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists product_reviews_tenant_idx
  on product_reviews (store_domain, shopify_product_id);

-- Vector index for performance optimisation using cosine distance
create index if not exists product_reviews_embedding_idx
  on product_reviews using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Table 3: Widget question log (powers the merchant dashboard analytics)
-- ---------------------------------------------------------------------------
create table if not exists widget_questions (
  id uuid default gen_random_uuid() primary key,
  store_domain text not null,
  shopify_product_id text not null,
  question text not null,
  answer text,
  matched_reviews integer default 0,
  answered boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists widget_questions_tenant_idx
  on widget_questions (store_domain, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: all access happens through the service role on the
-- server, so we enable RLS and add no public policies (service role bypasses).
-- ---------------------------------------------------------------------------
alter table merchants enable row level security;
alter table product_reviews enable row level security;
alter table widget_questions enable row level security;

-- ---------------------------------------------------------------------------
-- Similarity vector search RPC routine
-- ---------------------------------------------------------------------------
create or replace function match_reviews (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_product_id text,
  filter_store_domain text
)
returns table (
  id uuid,
  review_text text,
  rating integer,
  similarity float
)
language sql stable
as $$
  select
    product_reviews.id,
    product_reviews.review_text,
    product_reviews.rating,
    1 - (product_reviews.embedding <=> query_embedding) as similarity
  from product_reviews
  where product_reviews.shopify_product_id = filter_product_id
    and product_reviews.store_domain = filter_store_domain
    and 1 - (product_reviews.embedding <=> query_embedding) > match_threshold
  order by product_reviews.embedding <=> query_embedding
  limit match_count;
$$;
