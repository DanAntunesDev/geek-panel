import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OAuthManager } from "../../src/main/oauth.js";
import { SecretStore } from "../../src/main/secretStore.js";

const cipher = {
  isAvailable: () => true,
  encrypt: (plain: string) => Buffer.from(plain).reverse(),
  decrypt: (data: Buffer) => Buffer.from(data).reverse().toString(),
};

describe("OAuthManager", () => {
  let dir: string;
  let idp: http.Server;
  let idpUrl: string;
  let tokenBodies: URLSearchParams[];
  let refreshToken: string | undefined;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "oauth-"));
    tokenBodies = [];
    refreshToken = "refresh-abc";
    idp = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        if (req.url === "/token") {
          tokenBodies.push(new URLSearchParams(body));
          res.end(JSON.stringify({ access_token: "access-1", refresh_token: refreshToken, expires_in: 3600 }));
        } else if (req.url === "/me") {
          res.end(JSON.stringify({ display_name: "Pessoa Teste" }));
        } else res.writeHead(404).end("{}");
      });
    });
    await new Promise<void>((resolve) => idp.listen(0, "127.0.0.1", resolve));
    idpUrl = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise((resolve) => idp.close(resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });

  function manager(openUrl: (url: string) => Promise<void>, loginTimeoutMs = 3000) {
    return new OAuthManager({
      store: new SecretStore(dir, cipher),
      openUrl,
      loginTimeoutMs,
      endpoints: { spotify: { authorizeUrl: `${idpUrl}/authorize`, tokenUrl: `${idpUrl}/token`, profileUrl: `${idpUrl}/me`, callbackPort: 0 } },
    });
  }

  // Simula o navegador: abre a URL de autorização e segue o redirecionamento.
  const browser = (override?: (params: URLSearchParams) => string) => async (url: string) => {
    const params = new URL(url).searchParams;
    const redirect = new URL(params.get("redirect_uri")!);
    redirect.search = override ? override(params) : `code=the-code&state=${params.get("state")}`;
    await fetch(redirect);
  };

  it("completa o fluxo PKCE e guarda só o refresh token", async () => {
    let challenge = "";
    const oauth = manager(async (url) => {
      challenge = new URL(url).searchParams.get("code_challenge")!;
      await browser()(url);
    });

    const status = await oauth.login("spotify", "client-123");
    expect(status).toEqual({ connected: true, account: "Pessoa Teste" });

    const body = tokenBodies[0];
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("client_id")).toBe("client-123");
    expect(createHash("sha256").update(body.get("code_verifier")!).digest("base64url")).toBe(challenge);

    expect(await oauth.status("spotify")).toEqual({ connected: true, account: "Pessoa Teste" });
    const raw = await fs.readFile(path.join(dir, "secrets.json"), "utf-8");
    expect(raw).not.toContain("refresh-abc");
    expect(raw).not.toContain("access-1");
  });

  it("rejeita retorno com state diferente", async () => {
    const oauth = manager(browser(() => "code=x&state=forjado"));
    await expect(oauth.login("spotify", "client-123")).rejects.toThrow("inválida");
    expect((await oauth.status("spotify")).connected).toBe(false);
  });

  it("propaga recusa do usuário e tempo esgotado", async () => {
    await expect(manager(browser((p) => `error=access_denied&state=${p.get("state")}`)).login("spotify", "c")).rejects.toThrow("recusada");
    await expect(manager(async () => undefined, 200).login("spotify", "c")).rejects.toThrow("tempo esgotado");
  });

  it("exige ID do aplicativo e refresh token do serviço", async () => {
    await expect(manager(browser()).login("spotify", " ")).rejects.toThrow("ID do aplicativo");
    refreshToken = undefined;
    await expect(manager(browser()).login("spotify", "c")).rejects.toThrow("longa duração");
  });

  it("renova o token de acesso e desconecta", async () => {
    const oauth = manager(browser());
    await oauth.login("spotify", "client-123");
    expect(await oauth.accessToken("spotify", "client-123")).toBe("access-1");
    await oauth.logout("spotify");
    expect(await oauth.status("spotify")).toEqual({ connected: false, account: null });
    expect(await oauth.accessToken("spotify", "client-123")).toBeNull();
  });
});
