import "server-only";

import { hash, verify } from "@node-rs/argon2";

// argon2id with library defaults — strong and prebuilt (no node-gyp).
export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  return verify(hashed, plain);
}
