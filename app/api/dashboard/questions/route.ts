import { NextResponse } from 'next/server';
import { fetchQuestions, resolveStoreDomain } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storeDomain = resolveStoreDomain(searchParams.get('shop'));
    return NextResponse.json({ questions: await fetchQuestions(storeDomain, 100) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load questions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
