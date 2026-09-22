export type PrimaryAsyncState = 'loading' | 'offline' | 'error' | 'empty' | 'content';
export type DegradedAsyncState = 'refreshing' | 'offline' | 'error';

export interface AsyncStateInput {
  loading?: boolean | undefined;
  offline?: boolean | undefined;
  error?: unknown;
  itemCount?: number | undefined;
}

export interface ResolvedAsyncState {
  primary: PrimaryAsyncState;
  degraded?: DegradedAsyncState;
}

export function resolveAsyncState({ loading = false, offline = false, error, itemCount = 0 }: AsyncStateInput): ResolvedAsyncState {
  const count = Number.isFinite(itemCount) ? Math.max(0, Math.trunc(itemCount)) : 0;
  if (count > 0) {
    if (loading) return { primary: 'content', degraded: 'refreshing' };
    if (offline) return { primary: 'content', degraded: 'offline' };
    if (error) return { primary: 'content', degraded: 'error' };
    return { primary: 'content' };
  }
  if (loading) return { primary: 'loading' };
  if (offline) return { primary: 'offline' };
  if (error) return { primary: 'error' };
  return { primary: 'empty' };
}

export function safeErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
}
