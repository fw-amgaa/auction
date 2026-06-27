/**
 * Bid service (skeleton — Phase 0).
 *
 * Today: a WebSocket server that accepts connections, validates inbound
 * messages against the shared Zod contracts, and answers ping/pong.
 * Phase 5 adds: ticket auth, Redis Lua bid arbitration, holds, anti-snipe,
 * pub/sub fan-out, Postgres persistence, and crash-recovery rehydration.
 */
import { createServer } from "node:http";

import { ClientMessage, type ServerMessage } from "@auction/shared";
import { WebSocketServer, type WebSocket } from "ws";

import { log } from "./logger";
import { redis } from "./redis";

const PORT = Number(process.env.BID_WS_PORT ?? 8080);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "bid" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

wss.on("connection", (ws) => {
  log.info("client connected");

  ws.on("message", (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return; // ignore non-JSON
    }
    const result = ClientMessage.safeParse(parsed);
    if (!result.success) {
      log.warn({ issues: result.error.issues }, "invalid client message");
      return;
    }
    const msg = result.data;
    switch (msg.t) {
      case "ping":
        send(ws, { t: "pong" });
        break;
      // subscribe / bid / watch / unsubscribe — implemented in Phase 5
      default:
        log.debug({ t: msg.t }, "message received (not yet handled)");
    }
  });

  ws.on("close", () => log.info("client disconnected"));
});

async function start() {
  await redis.ping();
  log.info("redis connected");
  httpServer.listen(PORT, () => log.info(`bid service listening on :${PORT} (ws path /ws)`));
}

start().catch((err) => {
  log.error({ err }, "failed to start bid service");
  process.exit(1);
});
