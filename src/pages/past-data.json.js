import { getPastPapers } from '../lib/catalog.js';

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(getPastPapers()), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
