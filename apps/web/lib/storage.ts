import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage abstraction. Local disk in dev; S3 is wired in at deploy time
 * (ARCHITECTURE.md §10) by branching on S3_BUCKET. KYC docs are private — they
 * are only ever served back through an access-controlled route (Phase 2).
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

export async function putObject(key: string, bytes: Buffer): Promise<string> {
  if (process.env.S3_BUCKET) {
    // TODO(deploy): S3 PutObject via @aws-sdk/client-s3
    throw new Error("S3 storage not yet wired; unset S3_BUCKET for local disk.");
  }
  const dest = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return key;
}
