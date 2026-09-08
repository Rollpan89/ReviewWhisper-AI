/**
 * Centralised environment access.
 *
 * The platform is designed to run in two modes:
 *  - "live"  : Supabase + OpenAI + Shopify credentials are configured.
 *  - "demo"  : no credentials present. The app falls back to an in-memory
 *              store with seeded reviews and a deterministic keyword-based
 *              retrieval engine so every screen and endpoint still works.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  shopifyApiKey: process.env.SHOPIFY_API_KEY ?? '',
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET ?? '',
  hostUrl: process.env.HOST_URL ?? '',
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? '',
};

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
export const hasOpenAI = Boolean(env.openaiApiKey);
export const hasShopify = Boolean(env.shopifyApiKey && env.shopifyApiSecret);

/** True when the app runs without external credentials. */
export const isDemoMode = !hasSupabase || !hasOpenAI;

/** Absolute base URL of this deployment, safe in every runtime. */
export function resolveHostUrl(req?: Request): string {
  if (env.hostUrl) return env.hostUrl.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (req) {
    const url = new URL(req.url);
    const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host;
    return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}
