/** Prevents duplicate consequential submissions and stale completions from closing a newer draft. */
export type ComposerOperationToken = number;

export const createComposerOperationGate = () => {
  let session = 0;
  let pending = false;

  return {
    beginSession(): void {
      session += 1;
    },
    endSession(): void {
      session += 1;
    },
    beginOperation(): ComposerOperationToken | null {
      if (pending) return null;
      pending = true;
      return session;
    },
    isCurrent(token: ComposerOperationToken): boolean {
      return token === session;
    },
    endOperation(): void {
      pending = false;
    },
  };
};
