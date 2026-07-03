export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private lastRefill: number;
  private refillRate: number;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.refillRate = maxTokens / 60_000;
  }

  updateFromHeaders(remaining: number | null, reset: number | null, limit: number | null) {
    if (remaining !== null) {
      this.tokens = remaining;
    }
    if (reset !== null) {
      this.lastRefill = Date.now();
    }
    if (limit !== null && limit !== this.maxTokens) {
      this.maxTokens = limit;
      this.refillRate = limit / 60_000;
    }
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const added = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + added);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    this.tokens = 0;
    this.lastRefill = Date.now();
  }

  get available(): number {
    this.refill();
    return this.tokens;
  }
}
