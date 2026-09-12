/**
 * Simple counting semaphore — bounds how many async operations run at once, queueing the rest
 * (FIFO) instead of rejecting or racing them. Used to cap global concurrency into external APIs
 * with a shared rate limit (see openai.provider.ts).
 */
export class Semaphore {
  private available: number;
  private readonly waiters: (() => void)[] = [];

  constructor(max: number) {
    this.available = max;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
    } else {
      this.available++;
    }
  }
}
