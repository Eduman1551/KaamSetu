// Tavily Search API (https://docs.tavily.com). Groq can't browse, so Tavily
// finds the live job listing and course URLs.
import { env } from './env';

export interface TavilyResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

interface SearchOpts {
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

export async function tavilySearch(query: string, o: SearchOpts = {}): Promise<TavilyResult[]> {
  const body: Record<string, unknown> = {
    query,
    search_depth: 'basic',
    max_results: Math.min(20, o.maxResults ?? 10),
  };
  if (o.includeDomains?.length) body.include_domains = o.includeDomains;
  if (o.excludeDomains?.length) body.exclude_domains = o.excludeDomains;
  if (o.timeRange) body.time_range = o.timeRange;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.tavilyKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (res.status === 401 || res.status === 403) throw new Error('The web search key is invalid. Check TAVILY_API_KEY in .env.local.');
    if (res.status === 429 || res.status === 432) throw new Error('The web search service limit was reached. Please try again later or use the demo.');
    if (!res.ok) throw new Error(`Web search failed (HTTP ${res.status}).`);
    const json = (await res.json()) as { results?: TavilyResult[] };
    return json.results ?? [];
  } finally {
    clearTimeout(timer);
  }
}
