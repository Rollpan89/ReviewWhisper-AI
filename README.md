# ReviewWhisper AI

Multi-tenant Shopify micro-SaaS that answers shopper questions on the product page using
retrieval-augmented generation over verified buyer reviews.

Ask *"is it true to size?"* on a product page and the widget searches that store's reviews for
that product, retrieves the closest matches and has an LLM answer **only** from that evidence —
or explicitly say it doesn't know.

## Stack

| Layer | Technology |
| --- | --- |
| App | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4, shadcn-style UI primitives (`components/ui`) |
| Database | Supabase / PostgreSQL + `pgvector` (HNSW, cosine) |
| AI | OpenAI `text-embedding-3-small` (1536d) + `gpt-4o-mini` |
| Commerce | Shopify OAuth, ScriptTag injection, GraphQL recurring billing |
| CI/CD | GitHub Actions → Vercel |

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — see "Demo mode" below
npm run dev
```

Then open:

- <http://localhost:3000> — landing page
- <http://localhost:3000/dashboard> — merchant dashboard (stats, reviews, questions, playground)
- <http://localhost:3000/demo> — simulated storefront running the real `widget.js`

### Demo mode

If `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `OPENAI_API_KEY` are missing, the app
does **not** break. It transparently falls back to:

- an in-memory tenant store seeded with 20 realistic reviews across 3 products
  (`lib/demo-reviews.json`), and
- deterministic IDF-weighted lexical retrieval plus an extractive answer generator
  (`lib/demo-store.ts`, `lib/ai.ts`).

Every route, the dashboard and the widget stay fully functional. The dashboard shows a banner when
demo mode is active. Add credentials to switch to live pgvector + GPT-4o-mini with zero code
changes.

## Database setup

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor. It creates:

- `merchants` — tenant records (`shopify_domain`, `access_token`, `plan_status`)
- `product_reviews` — review text + `vector(1536)` embedding, HNSW cosine index
- `widget_questions` — conversation log powering dashboard analytics
- `match_reviews(...)` — similarity search RPC scoped by product **and** store domain
- RLS enabled on all tables (server access uses the service role, which bypasses RLS)

## Environment

See [`.env.example`](.env.example). `HOST_URL` is optional — the app derives its own origin from
the request (or `VERCEL_URL`) when it is unset.

## API surface

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/shopify` | GET | Starts OAuth; validates the shop domain and sets a state nonce cookie |
| `/api/auth/shopify/callback` | GET | Verifies HMAC + state, stores the token, injects the ScriptTag (idempotent), starts billing |
| `/api/shopify/billing` | POST | `appSubscriptionCreate` — $29/month, `EVERY_30_DAYS`, returns `confirmationUrl` |
| `/api/shopify/webhook/review-sync` | POST | Ingests one review or a batch; verifies Shopify's base64 HMAC when present |
| `/api/widget/ask` | POST | RAG endpoint used by the storefront widget (CORS enabled) |
| `/api/dashboard/stats` | GET | Aggregate tenant metrics |
| `/api/dashboard/reviews` | GET/POST | List indexed reviews / index one manually |
| `/api/dashboard/questions` | GET | Widget conversation log |

Example:

```bash
curl -s localhost:3000/api/widget/ask \
  -H 'content-type: application/json' \
  -d '{"productId":"8123456789","storeDomain":"demo-store.myshopify.com","question":"Is it true to size?"}'
```

## Storefront widget

`public/widget.js` is dependency-free and derives its API origin from its own `src`, so the same
file works on any deployment. It can be installed automatically by the OAuth callback, or manually:

```liquid
<script src="https://your-domain/widget.js"
        data-product-id="{{ product.id }}"
        data-store-domain="{{ shop.permanent_domain }}" defer></script>
```

## Seeding

With the dev server running:

```bash
node scripts/seed-reviews.mjs http://localhost:3000 demo-store.myshopify.com
```

## Deployment

`.github/workflows/vercel-deploy.yml` lints, typechecks and builds on every push to `main`, then
deploys to Vercel production using `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets.

## Notes on the original specification

Several issues in the source spec were corrected while implementing it:

- `chatCompletion.choices.message.content` → `choices[0].message.content` (would always be `undefined`).
- An unbalanced `)` in the billing `fetch` call made that module fail to parse.
- The widget's hardcoded `https://your-vercel-domain.vercel.app` API URL is now derived at runtime.
- OAuth had no HMAC or state verification — both are now enforced, as is webhook HMAC verification.
- The ScriptTag registration was not idempotent and duplicated on every re-install.
- The `edge` runtime was dropped from `/api/widget/ask` since the Node crypto/Supabase paths are shared.
