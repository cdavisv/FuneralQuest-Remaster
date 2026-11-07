import { type Algorithm, hash, verify } from "@node-rs/argon2";

/**
 * Password hashing: Argon2id through `@node-rs/argon2`.
 *
 * Why a native module and not `node:crypto` scrypt: Argon2id is the OWASP first
 * choice and the plan names it; `@node-rs/argon2` ships prebuilt binaries for
 * Linux (glibc and musl), macOS and Windows through npm optional dependencies,
 * so there is no compiler step and it runs on the libuv thread pool without
 * blocking the event loop. The PHC string it produces records the parameters,
 * so they can be raised later without invalidating old hashes.
 */
/** The server is hashing as many passwords as it will queue; the caller should answer 503. */
export class HasherBusy extends Error {
  constructor() {
    super("password hashing is busy");
  }
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** True when `password` matches `stored`. Never throws on a malformed hash. */
  verify(stored: string, password: string): Promise<boolean>;
}

/**
 * Hashing runs on the libuv thread pool (four threads) and each run holds `memoryKiB` of memory,
 * so a flood of sign-ups from many addresses could queue thousands of them. At most `running`
 * hash at once and at most `waiting` more queue; past that `HasherBusy` is thrown at once instead
 * of piling more memory and latency on a server that is already behind.
 */
export function createPasswordHasher(options: {
  memoryKiB: number;
  passes: number;
  running?: number;
  waiting?: number;
}): PasswordHasher {
  const maxRunning = options.running ?? 4;
  const maxWaiting = options.waiting ?? 64;
  let running = 0;
  const waiting: Array<() => void> = [];
  const slot = async (): Promise<void> => {
    if (running < maxRunning) {
      running++;
      return;
    }
    if (waiting.length >= maxWaiting) throw new HasherBusy();
    await new Promise<void>((resolve) => waiting.push(resolve));
  };
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };
  const limited = async <T>(work: () => Promise<T>): Promise<T> => {
    await slot();
    try {
      return await work();
    } finally {
      release();
    }
  };
  const params = {
    // `Algorithm.Argon2id` is 2; the library declares a const enum, which this build cannot import.
    algorithm: 2 as Algorithm.Argon2id,
    memoryCost: options.memoryKiB,
    timeCost: options.passes,
    parallelism: 1,
  } as const;
  return {
    hash: (password) => limited(() => hash(password, params)),
    async verify(stored, password) {
      try {
        return await limited(() => verify(stored, password));
      } catch (error) {
        if (error instanceof HasherBusy) throw error;
        return false;
      }
    },
  };
}
