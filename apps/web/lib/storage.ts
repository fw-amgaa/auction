import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Object storage abstraction. Uses S3 when S3_BUCKET is set (prod), else local
 * disk (dev). Credentials in prod come from the EC2 instance IAM role (default
 * AWS credential chain) — no static keys. KYC docs are private and only ever
 * served back through access-controlled routes.
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");
const S3_REGION = process.env.S3_REGION ?? process.env.AWS_REGION;

async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client(S3_REGION ? { region: S3_REGION } : {});
}

export async function putObject(key: string, bytes: Buffer): Promise<string> {
  const bucket = process.env.S3_BUCKET;
  if (bucket) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentTypeFor(key) }),
    );
    return key;
  }
  const dest = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return key;
}

export async function getObject(key: string): Promise<Buffer> {
  const bucket = process.env.S3_BUCKET;
  if (bucket) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
  return readFile(path.join(UPLOAD_DIR, key));
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = process.env.S3_BUCKET;
  if (bucket) {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await s3();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  await rm(path.join(UPLOAD_DIR, key), { force: true });
}

export function contentTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}
