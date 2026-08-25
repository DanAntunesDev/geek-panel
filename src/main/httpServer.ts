// Servidor HTTP local consultado pelo display (seção 17.2 da spec).
// Por padrão escuta somente em 127.0.0.1; o modo LAN precisa ser habilitado
// explicitamente pelo usuário e vinculado a uma interface de rede específica.

import express, { type Express, type NextFunction, type Request, type Response } from "express";
import * as http from "node:http";
import * as os from "node:os";
import { PROTOCOL_VERSION, type DeviceStateMessage, type HealthResponse } from "../shared/protocol.js";
import type { AppConfig } from "../shared/types.js";
import { buildFakeSnapshot } from "../services/fixtures/fakeState.js";

const MAX_REQUESTS_PER_WINDOW = 20;
const RATE_WINDOW_MS = 10_000;

// Limitador simples por IP, suficiente para uma rede doméstica de baixo tráfego.
function rateLimiter() {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
      hits.set(ip, { count: 1, windowStart: now });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({ error: "too many requests" });
      return;
    }
    next();
  };
}

export function resolveInterfaceAddress(interfaceName: string): string | null {
  const interfaces = os.networkInterfaces()[interfaceName];
  if (!interfaces) return null;
  const ipv4 = interfaces.find((entry) => entry.family === "IPv4" && !entry.internal);
  return ipv4?.address ?? null;
}

export function createHttpApp(getConfig: () => AppConfig): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use(rateLimiter());

  let sequence = 0;

  app.get("/api/health", (_req: Request, res: Response) => {
    const body: HealthResponse = { status: "ok" };
    res.status(200).json(body);
  });

  app.get("/api/state", (_req: Request, res: Response) => {
    sequence += 1;
    const config = getConfig();
    const snapshot = buildFakeSnapshot(config.clock, sequence);
    const message: DeviceStateMessage = {
      protocolVersion: PROTOCOL_VERSION,
      ...snapshot,
    };
    res.status(200).json(message);
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "not found" });
  });

  return app;
}

export interface RunningServer {
  close: () => Promise<void>;
  address: string;
  port: number;
}

// Decide o host de bind conforme o modo LAN configurado. Nunca escuta em
// 0.0.0.0: em modo LAN, vincula ao IP da interface escolhida pelo usuário.
export function resolveBindHost(config: AppConfig): string {
  if (!config.server.lanMode) {
    return "127.0.0.1";
  }
  if (config.server.lanInterface) {
    const address = resolveInterfaceAddress(config.server.lanInterface);
    if (address) return address;
  }
  return "127.0.0.1";
}

export function startHttpServer(getConfig: () => AppConfig): Promise<RunningServer> {
  const config = getConfig();
  const app = createHttpApp(getConfig);
  const host = resolveBindHost(config);
  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.server.port, host, () => {
      resolve({
        address: host,
        port: config.server.port,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
