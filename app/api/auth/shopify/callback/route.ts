import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { env, hasShopify, resolveHostUrl } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import { demoDb } from '@/lib/demo-store';

export const dynamic = 'force-dynamic';

const API_VERSION = '2024-01';

/** Verifies the HMAC Shopify appends to every OAuth callback. */
function verifyHmac(searchParams: URLSearchParams, secret: string): boolean {
  const provided = searchParams.get('hmac');
  if (!provided) return false;

  const message = [...searchParams.entries()]
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const digest = createHmac('sha256', secret).update(message).digest('hex');
  const a = Buffer.from(digest, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');

  if (!code || !shop) {
    return NextResponse.json({ error: 'Invalid token request parameters' }, { status: 400 });
  }

  if (!hasShopify) {
    return NextResponse.json({ error: 'Shopify credentials are not configured' }, { status: 503 });
  }

  if (!verifyHmac(searchParams, env.shopifyApiSecret)) {
    return NextResponse.json({ error: 'HMAC validation failed' }, { status: 401 });
  }

  const cookieState = req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('rw_oauth_state='))
    ?.split('=')[1];

  if (cookieState && state && cookieState !== state) {
    return NextResponse.json({ error: 'OAuth state mismatch' }, { status: 401 });
  }

  const hostUrl = resolveHostUrl(req);

  try {
    // 1. Exchange the authorization code for a permanent access token.
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: env.shopifyApiKey,
        client_secret: env.shopifyApiSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken: string | undefined = tokenData.access_token;
    if (!accessToken) throw new Error('Token acquisition failed');

    // 2. Persist the tenant record.
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from('merchants')
        .upsert(
          { shopify_domain: shop, access_token: accessToken, plan_status: 'pending' },
          { onConflict: 'shopify_domain' },
        );
      if (error) throw new Error(error.message);
    } else {
      const db = demoDb();
      const existing = db.merchants.find((m) => m.shopify_domain === shop);
      if (existing) {
        existing.access_token = accessToken;
        existing.plan_status = 'pending';
      } else {
        db.merchants.push({
          id: `merchant-${Date.now()}`,
          shopify_domain: shop,
          access_token: accessToken,
          plan_status: 'pending',
          created_at: new Date().toISOString(),
        });
      }
    }

    // 3. Inject the storefront widget script tag (idempotent).
    await registerScriptTag(shop, accessToken, `${hostUrl}/widget.js`);

    // 4. Start the recurring billing handshake.
    const billingResponse = await fetch(`${hostUrl}/api/shopify/billing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop, accessToken }),
    });
    const billingData = await billingResponse.json();

    if (billingData?.url) return NextResponse.redirect(billingData.url);

    // Billing unavailable — send the merchant to the dashboard regardless.
    return NextResponse.redirect(`${hostUrl}/dashboard?shop=${encodeURIComponent(shop)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected OAuth error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function registerScriptTag(shop: string, accessToken: string, src: string) {
  const headers = {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };

  // Avoid duplicate script tags on re-installs.
  const existing = await fetch(
    `https://${shop}/admin/api/${API_VERSION}/script_tags.json?src=${encodeURIComponent(src)}`,
    { headers },
  ).then((r) => (r.ok ? r.json() : { script_tags: [] }));

  if (existing?.script_tags?.length) return;

  await fetch(`https://${shop}/admin/api/${API_VERSION}/script_tags.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ script_tag: { event: 'onload', src } }),
  });
}
