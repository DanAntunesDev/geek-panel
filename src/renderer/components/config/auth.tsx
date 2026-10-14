import { useCallback, useEffect, useState } from "react";
import type { AuthService, AuthStatus } from "../../../shared/types.js";
import { Chip } from "./ui.js";

export type Notice = { tone: "ok" | "err"; text: string } | null;

export function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p className="cfg-note">{notice.tone === "ok" ? "OK: " : "ERRO: "}{notice.text}</p>;
}

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "falha desconhecida";
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}

export function useAuth(service: AuthService, persist: () => Promise<void>) {
  const [status, setStatus] = useState<AuthStatus>({ connected: false, account: null });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    window.painelApi.getAuthStatus(service).then(setStatus).catch(() => undefined);
  }, [service]);

  const connect = useCallback(async () => {
    setBusy(true);
    setNotice({ tone: "ok", text: "autorize no navegador que abriu…" });
    try {
      await persist();
      setStatus(await window.painelApi.login(service));
      setNotice(null);
    } catch (error) {
      setNotice({ tone: "err", text: describeError(error) });
    } finally {
      setBusy(false);
    }
  }, [service, persist]);

  const disconnect = useCallback(async () => {
    await window.painelApi.logout(service);
    setStatus({ connected: false, account: null });
    setNotice(null);
  }, [service]);

  return { status, busy, notice, connect, disconnect };
}

export function AuthControls({ auth, ready, readyHint }: { auth: ReturnType<typeof useAuth>; ready: boolean; readyHint: string }) {
  return (
    <>
      <div className="cfg-service-head">
        {auth.status.connected ? (
          <Chip>CONECTADO{auth.status.account ? `: ${auth.status.account.toUpperCase()}` : ""}</Chip>
        ) : (
          <Chip tone="off">DESCONECTADO</Chip>
        )}
        {auth.status.connected ? (
          <button className="px-btn" type="button" onClick={auth.disconnect}>
            SAIR
          </button>
        ) : (
          <button className="px-btn px-btn-primary" type="button" disabled={!ready || auth.busy} onClick={auth.connect}>
            {auth.busy ? "AGUARDANDO…" : "CONECTAR"}
          </button>
        )}
      </div>
      {!ready && !auth.status.connected ? <p className="cfg-note">{readyHint}</p> : null}
      <NoticeLine notice={auth.notice} />
    </>
  );
}

