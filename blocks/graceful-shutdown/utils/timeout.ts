/**
 * Wraps a promise so it rejects if it does not settle within `ms` milliseconds.
 *
 * @param promise The promise to race against the timeout.
 * @param ms Timeout in milliseconds.
 * @param label Used in the thrown error message to identify the task.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () => reject(new Error(`Shutdown task "${label}" timed out after ${ms}ms`)),
      ms
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timerId);
  }
}
