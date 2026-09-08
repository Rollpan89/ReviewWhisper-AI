import { NextResponse } from 'next/server';
import { env, hasShopify, resolveHostUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

const SCOPES = 'read_products,read_product_listings,write_script_tags';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get('shop');

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  if (!hasShopify) {
    return NextResponse.json(
      {
        error: 'Shopify credentials are not configured',
        hint: 'Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET in .env.local to enable the OAuth handshake.',
      },
      { status: 503 },
    );
  }

  const redirectUri = `${resolveHostUrl(req)}/api/auth/shopify/callback`;
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(env.shopifyApiKey)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${nonce}`;

  const response = NextResponse.redirect(installUrl);
  response.cookies.set('rw_oauth_state', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return response;
}
