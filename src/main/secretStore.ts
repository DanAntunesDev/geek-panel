import { promises as fs } from "node:fs";
import * as path from "node:path";

export interface Cipher {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(data: Buffer): string;
}

export class SecretStoreUnavailableError extends Error {
  constructor() {
    super("armazenamento seguro do sistema indisponível");
  }
}

const NAME_PATTERN = /^[A-Za-z0-9:_-]{1,64}$/;
const MAX_SECRET_LENGTH = 4096;

interface SecretFile {
  version: 1;
  entries: Record<string, string>;
}

export class SecretStore {
  private readonly filePath: string;

  constructor(
    directory: string,
    private readonly cipher: Cipher,
  ) {
    this.filePath = path.join(directory, "secrets.json");
  }

  private async read(): Promise<SecretFile> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, "utf-8")) as SecretFile;
      return parsed.version === 1 && typeof parsed.entries === "object" ? parsed : { version: 1, entries: {} };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, entries: {} };
      throw error;
    }
  }

  private async write(file: SecretFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(file), { encoding: "utf-8", mode: 0o600 });
    await fs.rename(temporary, this.filePath);
  }

  private assertName(name: string): void {
    if (!NAME_PATTERN.test(name)) throw new Error("nome de segredo inválido");
  }

  async set(name: string, value: string): Promise<void> {
    this.assertName(name);
    if (value.length === 0 || value.length > MAX_SECRET_LENGTH) throw new Error("segredo vazio ou grande demais");
    if (!this.cipher.isAvailable()) throw new SecretStoreUnavailableError();
    const file = await this.read();
    file.entries[name] = this.cipher.encrypt(value).toString("base64");
    await this.write(file);
  }

  async get(name: string): Promise<string | null> {
    this.assertName(name);
    const encoded = (await this.read()).entries[name];
    if (encoded === undefined) return null;
    if (!this.cipher.isAvailable()) throw new SecretStoreUnavailableError();
    return this.cipher.decrypt(Buffer.from(encoded, "base64"));
  }

  async has(name: string): Promise<boolean> {
    this.assertName(name);
    return (await this.read()).entries[name] !== undefined;
  }

  async delete(name: string): Promise<void> {
    this.assertName(name);
    const file = await this.read();
    if (file.entries[name] === undefined) return;
    delete file.entries[name];
    await this.write(file);
  }

  async hint(name: string): Promise<string | null> {
    const value = await this.get(name);
    if (value === null) return null;
    return value.length >= 16 ? `••••${value.slice(-4)}` : "••••";
  }

  get available(): boolean {
    return this.cipher.isAvailable();
  }
}
