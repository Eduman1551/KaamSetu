// JSON fetcher for SWR and simple API calls (client side).
export const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? 'Could not load data.');
  return r.json();
};

/** POST/PATCH/DELETE JSON helper that throws the API's friendly error message. */
export async function send<T = unknown>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json?.error ?? 'Something went wrong. Please try again.');
  return json as T;
}
