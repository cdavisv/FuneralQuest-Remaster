/**
 * A promise-chain mutex. Every operation on a town goes through one of these,
 * so two requests can never interleave even if a step becomes asynchronous.
 * Operations run strictly in the order they were enqueued; a failure rejects
 * only its own caller.
 */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private waiting = 0;

  run<T>(fn: () => T | Promise<T>): Promise<T> {
    this.waiting++;
    const result = this.tail.then(fn);
    this.tail = result.then(
      () => {
        this.waiting--;
      },
      () => {
        this.waiting--;
      },
    );
    return result;
  }

  get length(): number {
    return this.waiting;
  }

  /** Resolves when everything enqueued so far has finished. */
  async drain(): Promise<void> {
    await this.run(() => undefined);
  }
}
