import { useCallback, useEffect, useState } from "react";
import type { AuthService, AuthStatus } from "../../../shared/types.js";
import { notify } from "./toast.js";
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
      const next = await window.painelApi.login(service);
      setStatus(next);
      setNotice(null);
      notify("ok", `conta conectada${next.account ? `: ${next.account}` : ""}`);
    } catch (error) {
      setNotice({ tone: "err", text: describeError(error) });
      notify("err", describeError(error));
    } finally {
      setBusy(false);
    }
  }, [service, persist]);

  const disconnect = useCallback(async () => {
    try {
      await window.painelApi.logout(service);
      setStatus({ connected: false, account: null });
      setNotice(null);
      notify("ok", "conta desconectada");
    } catch (error) {
      notify("err", describeError(error));
    }
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
          <button className="px-btn px-btn-primary" type="button" disabled={auth.busy} onClick={ready ? auth.connect : () => notify("err", readyHint)}>
            {auth.busy ? "AGUARDANDO…" : "CONECTAR"}
          </button>
        )}
      </div>
      {!ready && !auth.status.connected ? (
        <p className="cfg-note">
          <strong>Falta configurar:</strong> {readyHint}
        </p>
      ) : null}
      <NoticeLine notice={auth.notice} />
    </>
  );
}

