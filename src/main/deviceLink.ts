import { createHash, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import * as dgram from "node:dgram";
import * as net from "node:net";
import type { AddressInfo } from "node:net";
import {
  configMessage,
  HELLO_WAIT_MS,
  DISCOVERY_PORT,
  DISCOVERY_REQUEST,
  discoveryReply,
  frameMessage,
  MESSAGE,
  message,
  MessageReader,
  TCP_PORT,
} from "../shared/deviceProtocol.js";
import type { DeviceLinkStatus } from "../shared/types.js";

// Código errado demais da mesma máquina: ela fica de fora por um tempo.
const MAX_WRONG_CODES = 5;
const BLOCK_MS = 60_000;
const MAX_UNKNOWN_SOCKETS = 16;

const digest = (value: string) => createHash("sha256").update(value).digest();

export interface DeviceLinkOptions {
  tcpPort?: number;
  discoveryPort?: number;
  keepAliveMs?: number;
  // Sem ouvir nada do aparelho por este tempo, a conexão cai.
  idleTimeoutMs?: number;
  // Código que o aparelho precisa mandar no hello; vazio ou ausente = aceita qualquer um.
  pairingCode?: () => string;
  helloWaitMs?: number;
}

// Mantém a ligação com o GeekMagic: responde à descoberta, aceita a conexão e empurra os quadros.
export class DeviceLink extends EventEmitter {
  private readonly keepAliveMs: number;
  private readonly idleTimeoutMs: number;
  private tcp: net.Server | null = null;
  private udp: dgram.Socket | null = null;
  private socket: net.Socket | null = null;
  private watchdog: NodeJS.Timeout | null = null;
  private frame: Buffer | null = null;
  private lastFrameSent: Buffer | null = null;
  private brightness: number | null = null;
  private palette: readonly string[] | undefined;
  private readonly wrongCodes = new Map<string, { count: number; blockedUntil: number }>();
  private unknownSockets = 0;
  private lastHeard = 0;
  private lastSent = 0;
  private current: DeviceLinkStatus = { running: false, connected: false, address: null, since: null, framesSent: 0, error: null, rejected: null };

  constructor(private readonly options: DeviceLinkOptions = {}) {
    super();
    this.keepAliveMs = options.keepAliveMs ?? 2000;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 8000;
  }

  status(): DeviceLinkStatus {
    return this.current;
  }

  ports(): { tcp: number; discovery: number } {
    return {
      tcp: (this.tcp?.address() as AddressInfo | null)?.port ?? 0,
      discovery: (this.udp?.address() as AddressInfo | null)?.port ?? 0,
    };
  }

  async start(): Promise<void> {
    if (this.current.running) return;
    try {
      this.tcp = net.createServer((socket) => this.accept(socket));
      await new Promise<void>((resolve, reject) => {
        this.tcp!.once("error", reject);
        this.tcp!.listen(this.options.tcpPort ?? TCP_PORT, "0.0.0.0", resolve);
      });

      this.udp = dgram.createSocket({ type: "udp4", reuseAddr: true });
      this.udp.on("message", (data, remote) => {
        if (!data.subarray(0, DISCOVERY_REQUEST.length).equals(DISCOVERY_REQUEST)) return;
        this.udp?.send(discoveryReply(this.ports().tcp), remote.port, remote.address);
      });
      await new Promise<void>((resolve, reject) => {
        this.udp!.once("error", reject);
        this.udp!.bind(this.options.discoveryPort ?? DISCOVERY_PORT, "0.0.0.0", resolve);
      });
    } catch (error) {
      await this.stop();
      const code = (error as NodeJS.ErrnoException).code;
      this.update({ error: code === "EADDRINUSE" ? "porta em uso por outro programa" : "não foi possível abrir as portas" });
      throw error;
    }

    this.watchdog = setInterval(() => this.tick(), Math.max(100, Math.floor(this.keepAliveMs / 2)));
    this.update({ running: true, error: null });
  }

  async stop(): Promise<void> {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.socket?.destroy();
    this.socket = null;
    await new Promise<void>((resolve) => (this.tcp ? this.tcp.close(() => resolve()) : resolve()));
    await new Promise<void>((resolve) => (this.udp ? this.udp.close(() => resolve()) : resolve()));
    this.tcp = null;
    this.udp = null;
    this.update({ running: false, connected: false, address: null, since: null });
  }

  setFrame(pixels: Uint8Array): void {
    this.frame = Buffer.from(pixels);
    this.sendFrame(false);
  }

  setBrightness(percent: number): void {
    this.brightness = Math.max(0, Math.min(100, Math.round(percent)));
    this.write(message(MESSAGE.brightness, Uint8Array.of(this.brightness)));
  }

  // Cor nova: o aparelho recebe a paleta de novo e o quadro inteiro.
  setPalette(palette: readonly string[]): void {
    this.palette = palette;
    if (!this.socket) return;
    this.write(configMessage(palette));
    this.sendFrame(true);
  }

  private accept(socket: net.Socket): void {
    const address = socket.remoteAddress ?? "";
    if ((this.wrongCodes.get(address)?.blockedUntil ?? 0) > Date.now() || this.unknownSockets >= MAX_UNKNOWN_SOCKETS) {
      socket.destroy();
      return;
    }
    this.unknownSockets += 1;
    socket.once("close", () => {
      this.unknownSockets -= 1;
    });
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 5000);
    socket.on("error", () => undefined);

    const reader = new MessageReader();
    let ready = false;
    // quem não se apresenta a tempo é descartado
    const helloTimer = setTimeout(() => {
      if (!ready) socket.destroy();
    }, this.options.helloWaitMs ?? HELLO_WAIT_MS);

    socket.on("data", (chunk) => {
      if (this.socket === socket) this.lastHeard = Date.now();
      for (const item of reader.push(chunk)) {
        if (item.type === MESSAGE.hello && !ready) {
          const sentCode = Buffer.from(item.body.subarray(2, 2 + (item.body[1] ?? 0))).toString("ascii");
          if (!this.codeMatches(sentCode)) {
            this.noteWrongCode(address);
            this.reject(socket);
            return;
          }
          ready = true;
          this.wrongCodes.delete(address);
          clearTimeout(helloTimer);
          this.promote(socket);
        }
      }
    });
    socket.on("close", () => {
      clearTimeout(helloTimer);
      if (this.socket !== socket) return;
      this.socket = null;
      this.update({ connected: false, address: null, since: null });
    });
  }

  private codeMatches(sent: string): boolean {
    const expected = this.options.pairingCode?.() ?? "";
    return expected === "" || timingSafeEqual(digest(sent), digest(expected));
  }

  private noteWrongCode(address: string): void {
    const entry = this.wrongCodes.get(address) ?? { count: 0, blockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_WRONG_CODES) {
      entry.blockedUntil = Date.now() + BLOCK_MS;
      entry.count = 0;
    }
    this.wrongCodes.set(address, entry);
  }

  private reject(socket: net.Socket): void {
    socket.end(message(MESSAGE.reject, Uint8Array.of(1)));
    this.update({ rejected: socket.remoteAddress?.replace(/^::ffff:/, "") ?? "desconhecido" });
  }

  // O aparelho se apresentou direito: vira o aparelho ativo e recebe as telas.
  private promote(socket: net.Socket): void {
    // o aparelho mais novo vence: reconexão depois de queda de energia, por exemplo
    this.socket?.destroy();
    this.socket = socket;
    this.lastHeard = Date.now();
    this.lastFrameSent = null;

    this.write(configMessage(this.palette));
    if (this.brightness !== null) this.write(message(MESSAGE.brightness, Uint8Array.of(this.brightness)));
    this.sendFrame(true);
    this.update({
      connected: true,
      address: socket.remoteAddress?.replace(/^::ffff:/, "") ?? null,
      since: new Date().toISOString(),
      rejected: null,
    });
  }

  private sendFrame(force: boolean): void {
    if (!this.frame || !this.socket) return;
    if (!force && this.lastFrameSent?.equals(this.frame)) return;
    // se o aparelho não dá conta, pula o quadro em vez de acumular atraso
    if (this.socket.writableLength > 128 * 1024) return;
    this.lastFrameSent = this.frame;
    if (this.write(frameMessage(this.frame))) this.update({ framesSent: this.current.framesSent + 1 });
  }

  private write(data: Buffer): boolean {
    if (!this.socket || this.socket.destroyed) return false;
    this.lastSent = Date.now();
    this.socket.write(data);
    return true;
  }

  private tick(): void {
    if (!this.socket) return;
    const now = Date.now();
    if (now - this.lastHeard > this.idleTimeoutMs) {
      this.socket.destroy();
      return;
    }
    if (now - this.lastSent >= this.keepAliveMs) this.write(message(MESSAGE.ping));
  }

  private update(patch: Partial<DeviceLinkStatus>): void {
    const before = JSON.stringify(this.current);
    this.current = { ...this.current, ...patch };
    // contador de quadros muda o tempo todo; só avisa quando o resto muda
    const changed = JSON.stringify({ ...this.current, framesSent: 0 }) !== JSON.stringify({ ...JSON.parse(before), framesSent: 0 });
    if (changed) this.emit("status", this.current);
  }
}
