import { NextResponse } from 'next/server';
import { buildStats, resolveStoreDomain } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeDomain = resolveStoreDomain(searchParams.get('shop'));
    return NextResponse.json(await buildStats(storeDomain));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load stats';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
