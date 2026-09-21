export function resolveMotionDuration(durationMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  if (!Number.isFinite(durationMs)) return 0;
  return Math.max(0, Math.min(2000, Math.trunc(durationMs)));
}

export function normalizeLiveMessage(message: string): string {
  return message.trim().replace(/\s+/g, ' ');
}

export function shouldAnnounceChange(previous: string | undefined, next: string): boolean {
  const normalized = normalizeLiveMessage(next);
  return normalized.length > 0 && normalized !== normalizeLiveMessage(previous ?? '');
}
