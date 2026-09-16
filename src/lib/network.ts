export async function fetchText(url: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    if (Number(response.headers.get("content-length") ?? 0) > 20_000_000) throw new Error("Provider response exceeds 20 MB.");
    const text = await response.text();
    if (text.length > 20_000_000) throw new Error("Provider response exceeds 20 MB.");
    return text;
  } finally { clearTimeout(timeout); }
}
export async function mapConcurrent<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Invalid concurrency.");
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) { const index = cursor++; results[index] = await task(items[index]); }
  }));
  return results;
}
