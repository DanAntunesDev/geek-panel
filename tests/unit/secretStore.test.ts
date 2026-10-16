import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SecretStore, SecretStoreUnavailableError, type Cipher } from "../../src/main/secretStore.js";

// Cifra de teste reversível e claramente diferente do texto original.
function fakeCipher(available = true): Cipher {
  return {
    isAvailable: () => available,
    encrypt: (plain) => Buffer.from(`enc:${Buffer.from(plain).toString("hex")}`),
    decrypt: (data) => Buffer.from(data.toString().slice(4), "hex").toString(),
  };
}

describe("SecretStore", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "secret-store-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("guarda e devolve o segredo sem gravá-lo em texto puro", async () => {
    const store = new SecretStore(dir, fakeCipher());
    await store.set("provider:openai", "sk-test-1234567890abcdef");
    expect(await store.get("provider:openai")).toBe("sk-test-1234567890abcdef");
    const raw = await fs.readFile(path.join(dir, "secrets.json"), "utf-8");
    expect(raw).not.toContain("sk-test-1234567890abcdef");
  });

  it("restringe o arquivo ao dono", async () => {
    const store = new SecretStore(dir, fakeCipher());
    await store.set("provider:openai", "valor-secreto");
    const mode = (await fs.stat(path.join(dir, "secrets.json"))).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("expõe só uma máscara com os 4 últimos caracteres", async () => {
    const store = new SecretStore(dir, fakeCipher());
    await store.set("provider:openai", "sk-test-1234567890abcdef");
    expect(await store.hint("provider:openai")).toBe("••••cdef");
    await store.set("provider:anthropic", "curto");
    expect(await store.hint("provider:anthropic")).toBe("••••");
    expect(await store.hint("provider:gemini")).toBeNull();
  });

  it("remove segredos e informa se existem", async () => {
    const store = new SecretStore(dir, fakeCipher());
    await store.set("provider:openai", "abc");
    expect(await store.has("provider:openai")).toBe(true);
    await store.delete("provider:openai");
    expect(await store.has("provider:openai")).toBe(false);
  });

  it("recusa gravar sem cifra do sistema", async () => {
    const store = new SecretStore(dir, fakeCipher(false));
    await expect(store.set("provider:openai", "abc")).rejects.toBeInstanceOf(SecretStoreUnavailableError);
  });

  it("rejeita nomes e valores inválidos", async () => {
    const store = new SecretStore(dir, fakeCipher());
    await expect(store.set("../x", "abc")).rejects.toThrow();
    await expect(store.set("provider:openai", "")).rejects.toThrow();
  });
});
