// OAuth com PKCE: o navegador autoriza e o retorno cai num servidor local efêmero

import { createHash, randomBytes } from "node:crypto";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import type { AuthService, AuthStatus } from "../shared/types.js";
import type { SecretStore } from "./secretStore.js";

interface OAuthProvider {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string[];
  // o cliente desktop do Google exige client_secret
  usesClientSecret: boolean;
  // o Spotify exige a porta cadastrada no painel deles
  callbackPort: number;
  extraAuthParams: Record<string, string>;
  accountName(profile: unknown): string | null;
}

export const OAUTH_PROVIDERS: Record<AuthService, OAuthProvider> = {
  spotify: {
    authorizeUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    profileUrl: "https://api.spotify.com/v1/me",
    scopes: ["user-read-playback-state", "user-modify-playback-state", "user-read-currently-playing"],
    usesClientSecret: false,
    callbackPort: 4615,
    extraAuthParams: {},
    accountName: (profile) => stringField((profile as { display_name?: unknown })?.display_name),
  },
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    usesClientSecret: true,
    callbackPort: 0,
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    accountName: (profile) => stringField((profile as { items?: { snippet?: { title?: unknown } }[] })?.items?.[0]?.snippet?.title),
  },
  // Mesmo app do Google, outro login: a conta da agenda pode ser diferente da do YouTube.
  calendar: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/calendar/v3/calendars/primary",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    usesClientSecret: true,
    callbackPort: 0,
    extraAuthParams: { access_type: "offline", prompt: "consent select_account" },
    accountName: (profile) => stringField((profile as { id?: unknown })?.id),
  },
};

function stringField(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value.slice(0, 120) : null;
}

type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface OAuthOptions {
  store: SecretStore;
  openUrl: (url: string) => Promise<void>;
  fetchImpl?: FetchLike;
  loginTimeoutMs?: number;
  // para testes
  endpoints?: Partial<Record<AuthService, Partial<Pick<OAuthProvider, "authorizeUrl" | "tokenUrl" | "profileUrl" | "callbackPort">>>>;
}

const refreshName = (service: AuthService) => `oauth:${service}:refresh`;
const accountNameKey = (service: AuthService) => `oauth:${service}:account`;

export class OAuthManager {
  private readonly fetchImpl: FetchLike;
  private readonly accessTokens = new Map<AuthService, { token: string; expiresAt: number }>();
  private loginInFlight = false;

  constructor(private readonly options: OAuthOptions) {
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  }

  private provider(service: AuthService): OAuthProvider {
    return { ...OAUTH_PROVIDERS[service], ...this.options.endpoints?.[service] };
  }

  async status(service: AuthService): Promise<AuthStatus> {
    const connected = await this.options.store.has(refreshName(service));
    return { connected, account: connected ? await this.options.store.get(accountNameKey(service)) : null };
  }

  async logout(service: AuthService): Promise<void> {
    this.accessTokens.delete(service);
    await this.options.store.delete(refreshName(service));
    await this.options.store.delete(accountNameKey(service));
  }

  async login(service: AuthService, clientId: string): Promise<AuthStatus> {
    if (clientId.trim() === "") throw new Error("informe o ID do aplicativo antes de conectar");
    if (this.loginInFlight) throw new Error("já existe uma conexão em andamento");
    this.loginInFlight = true;
    try {
      const provider = this.provider(service);
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      const state = randomBytes(16).toString("hex");

      const callback = await this.listenForCallback(provider.callbackPort, state);
      try {
        const authorize = new URL(provider.authorizeUrl);
        authorize.search = new URLSearchParams({
          response_type: "code",
          client_id: clientId.trim(),
          redirect_uri: callback.redirectUri,
          scope: provider.scopes.join(" "),
          state,
          code_challenge_method: "S256",
          code_challenge: challenge,
          ...provider.extraAuthParams,
        }).toString();
        await this.options.openUrl(authorize.toString());

        const code = await callback.code;
        const tokens = await this.requestTokens(service, provider, clientId.trim(), {
          grant_type: "authorization_code",
          code,
          redirect_uri: callback.redirectUri,
          code_verifier: verifier,
        });
        if (!tokens.refresh_token) throw new Error("o serviço não devolveu permissão de longa duração");

        await this.options.store.set(refreshName(service), tokens.refresh_token);
        this.accessTokens.set(service, { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 });

        const account = await this.fetchAccountName(provider, tokens.access_token);
        if (account) await this.options.store.set(accountNameKey(service), account);
        return { connected: true, account };
      } finally {
        callback.close();
      }
    } finally {
      this.loginInFlight = false;
    }
  }

  async accessToken(service: AuthService, clientId: string): Promise<string | null> {
    const cached = this.accessTokens.get(service);
    if (cached && cached.expiresAt - 30_000 > Date.now()) return cached.token;
    const refresh = await this.options.store.get(refreshName(service));
    if (!refresh) return null;
    try {
      const tokens = await this.requestTokens(service, this.provider(service), clientId.trim(), {
        grant_type: "refresh_token",
        refresh_token: refresh,
      });
      this.accessTokens.set(service, { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 });
      if (tokens.refresh_token) await this.options.store.set(refreshName(service), tokens.refresh_token);
      return tokens.access_token;
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_grant") await this.logout(service);
      return null;
    }
  }

  private async requestTokens(
    service: AuthService,
    provider: OAuthProvider,
    clientId: string,
    params: Record<string, string>,
  ): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
    const body = new URLSearchParams({ ...params, client_id: clientId });
    if (provider.usesClientSecret) {
      const secret = await this.options.store.get("google:clientSecret");
      if (!secret) throw new Error("informe o segredo do aplicativo Google antes de conectar");
      body.set("client_secret", secret);
    }
    const response = await this.fetchImpl(provider.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await response.json().catch(() => ({}))) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
      error?: unknown;
    };
    if (response.status < 200 || response.status >= 300 || typeof json.access_token !== "string") {
      throw new Error(json.error === "invalid_grant" ? "invalid_grant" : `${service}: troca de código recusada`);
    }
    return {
      access_token: json.access_token,
      refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
      expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    };
  }

  private async fetchAccountName(provider: OAuthProvider, accessToken: string): Promise<string | null> {
    try {
      const response = await this.fetchImpl(provider.profileUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (response.status < 200 || response.status >= 300) return null;
      return provider.accountName(await response.json());
    } catch {
      return null;
    }
  }

  private listenForCallback(port: number, state: string): Promise<{ redirectUri: string; code: Promise<string>; close: () => void }> {
    return new Promise((resolveListener, rejectListener) => {
      let settle: { resolve: (code: string) => void; reject: (error: Error) => void };
      const code = new Promise<string>((resolve, reject) => {
        settle = { resolve, reject };
      });
      code.catch(() => undefined);

      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (url.pathname !== "/callback") {
          res.writeHead(404).end();
          return;
        }
        const failed = url.searchParams.get("error");
        const received = url.searchParams.get("code");
        const valid = url.searchParams.get("state") === state;
        res.writeHead(valid && received ? 200 : 400, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": "default-src 'none'",
        });
        res.end(valid && received ? "<p>Conexão concluída. Pode fechar esta janela.</p>" : "<p>Não foi possível concluir a conexão.</p>");
        if (failed) settle.reject(new Error(`autorização recusada (${failed})`));
        else if (!valid) settle.reject(new Error("resposta de autorização inválida"));
        else if (received) settle.resolve(received);
      });

      const timer = setTimeout(
        () => settle.reject(new Error("tempo esgotado esperando a autorização")),
        this.options.loginTimeoutMs ?? 120_000,
      );

      server.once("error", rejectListener);
      server.listen(port, "127.0.0.1", () => {
        const { port: bound } = server.address() as AddressInfo;
        resolveListener({
          redirectUri: `http://127.0.0.1:${bound}/callback`,
          code,
          close: () => {
            clearTimeout(timer);
            server.close();
          },
        });
      });
    });
  }
}
