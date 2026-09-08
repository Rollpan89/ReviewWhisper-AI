import { NextResponse } from 'next/server';
import { resolveHostUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

const API_VERSION = '2024-01';

const MUTATION = `
  mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!, $test: Boolean) {
    appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, test: $test) {
      confirmationUrl
      appSubscription { id status }
      userErrors { field message }
    }
  }
`;

export async function POST(req: Request) {
  try {
    const { shop, accessToken, test } = await req.json();

    if (!shop || !accessToken) {
      return NextResponse.json({ error: 'shop and accessToken are required' }, { status: 400 });
    }

    const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: MUTATION,
        variables: {
          name: 'ReviewWhisper Professional Tier Plan',
          returnUrl: `${resolveHostUrl(req)}/dashboard?shop=${encodeURIComponent(shop)}`,
          test: Boolean(test) || process.env.NODE_ENV !== 'production',
          lineItems: [
            {
              plan: {
                appRecurringPricingDetails: {
                  price: { amount: 29.0, currencyCode: 'USD' },
                  interval: 'EVERY_30_DAYS',
                },
              },
            },
          ],
        },
      }),
    });

    const resData = await response.json();
    const userErrors = resData?.data?.appSubscriptionCreate?.userErrors ?? [];

    if (resData?.errors || userErrors.length > 0) {
      throw new Error(JSON.stringify(resData.errors ?? userErrors));
    }

    return NextResponse.json({
      url: resData.data.appSubscriptionCreate.confirmationUrl,
      subscription: resData.data.appSubscriptionCreate.appSubscription ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Billing handshake failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
