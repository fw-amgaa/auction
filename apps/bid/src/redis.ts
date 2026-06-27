import Redis from "ioredis";

import { log } from "./logger";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Main command connection. */
export const redis = new Redis(url, { maxRetriesPerRequest: null });

/** Dedicated subscriber connection (pub/sub requires its own client). */
export const sub = new Redis(url, { maxRetriesPerRequest: null });

redis.on("error", (e) => log.error({ err: e }, "redis error"));
sub.on("error", (e) => log.error({ err: e }, "redis sub error"));
