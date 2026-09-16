export const createId = (prefix: string): string => `${prefix}-${globalThis.crypto.randomUUID()}`;
