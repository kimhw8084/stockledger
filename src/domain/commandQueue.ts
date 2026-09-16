/** Commands see the latest durable state and publish only after successful writes. */
export function createCommandQueue<T>(read: () => T | null, persist: (next: T) => Promise<void>, publish: (next: T) => void) {
  let tail: Promise<unknown> = Promise.resolve();
  return (change: T | ((current: T) => T)): Promise<T> => {
    const command = tail.then(async () => {
      const current = read();
      if (current === null && typeof change === "function") throw new Error("Workspace is not loaded.");
      const next = typeof change === "function" ? (change as (current: T) => T)(current as T) : change;
      await persist(next);
      publish(next);
      return next;
    });
    tail = command.catch(() => {});
    return command;
  };
}
