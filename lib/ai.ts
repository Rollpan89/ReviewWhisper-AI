import OpenAI from 'openai';
import { env, hasOpenAI } from './env';
import type { MatchedReview } from './demo-store';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const CHAT_MODEL = 'gpt-4o-mini';
export const EMBEDDING_DIMENSIONS = 1536;

export const NO_INFO_ANSWER =
  "We don't have enough buyer information to answer this specific question yet.";

let cached: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  if (!hasOpenAI) return null;
  if (!cached) cached = new OpenAI({ apiKey: env.openaiApiKey });
  return cached;
}

export async function embed(input: string): Promise<number[] | null> {
  const client = getOpenAI();
  if (!client) return null;
  const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input });
  return response.data[0].embedding;
}

export function buildContext(reviews: MatchedReview[]): string {
  if (!reviews || reviews.length === 0) return 'No verified reviews provide concrete info.';
  return reviews
    .map((r) => `- "${r.review_text}"${r.rating ? ` (rated ${r.rating}/5)` : ''}`)
    .join('\n');
}

export const SYSTEM_PROMPT = (context: string) =>
  `You are an AI assistant placed on an e-commerce product page. Your function is answering customer questions strictly using the verified buyer feedback provided below. Never invent details. If the feedback does not cover the question, respond exactly: "${NO_INFO_ANSWER}". Keep answers brief (1-2 sentences) and neutral in tone.\n\nBuyer feedback context:\n${context}`;

/**
 * Generates an answer. Falls back to a deterministic extractive summary when
 * no OpenAI key is configured, so the widget always returns something useful.
 */
export async function answerQuestion(
  question: string,
  reviews: MatchedReview[],
): Promise<string> {
  if (!reviews || reviews.length === 0) return NO_INFO_ANSWER;

  const client = getOpenAI();
  const context = buildContext(reviews);

  if (!client) return extractiveAnswer(reviews);

  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT(context) },
      { role: 'user', content: question },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || NO_INFO_ANSWER;
}

/** Offline fallback: quote the strongest matching buyer statements. */
export function extractiveAnswer(reviews: MatchedReview[]): string {
  const top = reviews.slice(0, 2);
  if (top.length === 0) return NO_INFO_ANSWER;
  const quotes = top
    .map((r) => {
      const sentence = r.review_text.split(/(?<=[.!?])\s/)[0] ?? r.review_text;
      return sentence.replace(/\s+$/, '');
    })
    .join(' ');
  const label = top.length > 1 ? 'Buyers report' : 'A buyer reports';
  return `${label}: ${quotes}`;
}
