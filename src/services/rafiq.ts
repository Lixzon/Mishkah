export interface RafiqSource {
  title: string;
  url: string;
}

export interface RafiqOnlineAnswer {
  answer: string;
  sources: RafiqSource[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function searchRafiqOnline(
  endpoint: string,
  query: string,
  locale = 'en',
): Promise<RafiqOnlineAnswer> {
  const cleanQuery = query.trim();
  if (!cleanQuery || cleanQuery.length > 1000) {
    throw new Error('Enter a question of 1,000 characters or fewer.');
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error('Rafiq online search is not configured with a valid endpoint.');
  }
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('Rafiq online search requires a secure HTTPS endpoint.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: cleanQuery, locale }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Rafiq online search timed out. Try again or use the offline guide.');
    }
    throw new Error('Rafiq online search could not connect. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`Rafiq online search failed (HTTP ${response.status}).`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Rafiq online search returned an unreadable response.');
  }
  if (!isRecord(payload) || typeof payload.answer !== 'string' || !Array.isArray(payload.sources)) {
    throw new Error('Rafiq online search returned an invalid answer or sources.');
  }

  const sources = payload.sources.flatMap((source): RafiqSource[] => {
    if (!isRecord(source) || typeof source.title !== 'string' || typeof source.url !== 'string') return [];
    try {
      const sourceUrl = new URL(source.url);
      if (sourceUrl.protocol !== 'https:') return [];
      return [{ title: source.title.slice(0, 160), url: sourceUrl.toString() }];
    } catch {
      return [];
    }
  }).slice(0, 5);
  const answer = payload.answer.trim();
  if (!answer || answer.length > 12_000) {
    throw new Error('Rafiq online search returned an empty or oversized answer.');
  }
  if (sources.length === 0) {
    throw new Error('Rafiq online search did not return any verified HTTPS source links.');
  }

  return { answer, sources };
}