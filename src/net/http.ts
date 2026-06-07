export interface Endpoints { primary: string; fallback: string[]; }

export async function httpJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Try primary, then each fallback in order. Throw the last error if all fail.
export async function withFailover<T>(
  endpoints: Endpoints,
  fn: (base: string) => Promise<T>,
): Promise<T> {
  const bases = [endpoints.primary, ...endpoints.fallback];
  let lastErr: unknown = new Error('no endpoints configured');
  for (const base of bases) {
    try {
      return await fn(base);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
