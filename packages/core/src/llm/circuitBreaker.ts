export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number; // default 3
  cooldownMs?: number;       // default 60_000 (60s)
}

export class CircuitBreaker {
  private failureThreshold: number;
  private cooldownMs: number;
  private consecutiveFailures = 0;
  private state: CircuitBreakerState = "CLOSED";
  private openedAt = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 60_000;
  }

  public getState(): CircuitBreakerState {
    if (this.state === "OPEN") {
      const now = Date.now();
      if (now - this.openedAt >= this.cooldownMs) {
        this.state = "HALF_OPEN";
      }
    }
    return this.state;
  }

  public canExecute(): boolean {
    const current = this.getState();
    return current === "CLOSED" || current === "HALF_OPEN";
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
    this.openedAt = 0;
  }

  public recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
    this.openedAt = 0;
  }
}
