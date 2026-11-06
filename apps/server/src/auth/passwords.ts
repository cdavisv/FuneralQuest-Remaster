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
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** True when `password` matches `stored`. Never throws on a malformed hash. */
  verify(stored: string, password: string): Promise<boolean>;
}

export function createPasswordHasher(options: {
  memoryKiB: number;
  passes: number;
}): PasswordHasher {
  const params = {
    // `Algorithm.Argon2id` is 2; the library declares a const enum, which this build cannot import.
    algorithm: 2 as Algorithm.Argon2id,
    memoryCost: options.memoryKiB,
    timeCost: options.passes,
    parallelism: 1,
  } as const;
  return {
    hash: (password) => hash(password, params),
    async verify(stored, password) {
      try {
        return await verify(stored, password);
      } catch {
        return false;
      }
    },
  };
}
